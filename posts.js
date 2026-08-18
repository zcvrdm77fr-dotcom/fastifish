import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { db } from './db.js';
import { requireAuth } from './auth.js';
import { moderatePost, ModerationUnavailableError } from './moderation.js';
import { UPLOADS_DIR } from './paths.js';

const MAX_CAPTION_LEN = 280;
const POST_COOLDOWN_MS = 60 * 1000; // roskapostin/tulvimisen esto - yksi julkaisu per minuutti per käyttäjä

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      const err = new Error('Vain JPEG-, PNG- tai WebP-kuvat ovat sallittuja.');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  }
});

const router = express.Router();

router.get('/', (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const before = parseInt(req.query.before, 10);
  const rows = (Number.isInteger(before)
    ? db.prepare(`
        SELECT posts.id, posts.caption, posts.created_at, posts.image_path, users.username
        FROM posts JOIN users ON users.id = posts.user_id
        WHERE posts.status = 'published' AND posts.id < ?
        ORDER BY posts.id DESC LIMIT ?
      `).all(before, limit)
    : db.prepare(`
        SELECT posts.id, posts.caption, posts.created_at, posts.image_path, users.username
        FROM posts JOIN users ON users.id = posts.user_id
        WHERE posts.status = 'published'
        ORDER BY posts.id DESC LIMIT ?
      `).all(limit)
  );
  res.json({
    posts: rows.map(r => ({
      id: r.id,
      username: r.username,
      caption: r.caption,
      createdAt: r.created_at,
      imageUrl: `/uploads/${r.image_path}`
    }))
  });
});

router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Liitä saaliskuva.' });
  }
  const caption = typeof req.body.caption === 'string' ? req.body.caption.trim().slice(0, MAX_CAPTION_LEN) : '';

  const recent = db.prepare(`
    SELECT created_at FROM posts WHERE user_id = ? ORDER BY id DESC LIMIT 1
  `).get(req.user.id);
  if (recent && Date.now() - new Date(recent.created_at + 'Z').getTime() < POST_COOLDOWN_MS) {
    return res.status(429).json({ error: 'Odota hetki ennen seuraavaa julkaisua.' });
  }

  let processedBuffer;
  try {
    // sharp ei kopioi lähdekuvan metadataa oletuksena (ellei kutsuta withMetadata()) - tämä
    // poistaa samalla EXIF-GPS-sijaintitiedot, jotka muuten voisivat paljastaa tarkan
    // kalastuspaikan tahattomasti kuvan mukana.
    processedBuffer = await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch (e) {
    return res.status(400).json({ error: 'Kuvaa ei voitu käsitellä - varmista että tiedosto on kelvollinen kuva.' });
  }

  try {
    const modResult = await moderatePost(processedBuffer, 'image/jpeg', caption);
    if (!modResult.allowed) {
      return res.status(400).json({ error: modResult.reason || 'Kuva ei läpäissyt sisällöntarkistusta.' });
    }
  } catch (e) {
    if (e instanceof ModerationUnavailableError) {
      return res.status(503).json({ error: 'Sisällöntarkistus ei ole juuri nyt käytettävissä. Yritä hetken kuluttua uudelleen.' });
    }
    throw e;
  }

  const filename = `${crypto.randomBytes(16).toString('hex')}.jpg`;
  await fs.promises.writeFile(path.join(UPLOADS_DIR, filename), processedBuffer);

  const info = db.prepare(`
    INSERT INTO posts (user_id, image_path, caption, status) VALUES (?, ?, ?, 'published')
  `).run(req.user.id, filename, caption);

  res.status(201).json({
    id: info.lastInsertRowid,
    username: req.user.username,
    caption,
    imageUrl: `/uploads/${filename}`
  });
});

export default router;
