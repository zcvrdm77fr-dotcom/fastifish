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
import { findBlockedTerm } from './wordlist.js';
import { asyncHandler } from './async-handler.js';
import { logError, logWarn } from './logger.js';
import { createRateLimiter } from './security.js';
import { queueUploadCleanup } from './upload-cleanup.js';

const MAX_CAPTION_LEN = 280;
const MAX_COMMENT_LEN = 300;
const POST_COOLDOWN_MS = 60 * 1000;
const COMMENT_COOLDOWN_MS = 5 * 1000;
const uploadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyPrefix: 'upload',
  message: 'Liikaa kuvanlähetyksiä. Yritä myöhemmin uudelleen.'
});
const ALLOWED_SPECIES = new Set([
  'Ahven', 'Hauki', 'Kuha', 'Toutain',
  'Lohi', 'Taimen', 'Kirjolohi', 'Siika', 'Muikku', 'Harjus',
  'Made', 'Särki', 'Lahna', 'Säyne', 'Sorva', 'Suutari',
  'Karppi', 'Kiiski', 'Salakka', 'Muu kala'
]);

function optionalText(value, maxLength){
  if (typeof value !== 'string') return null;
  const text = value.trim().slice(0, maxLength);
  return text || null;
}

function optionalNumber(value){
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return Number(String(value).trim().replace(',', '.'));
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1,
    fields: 7,
    parts: 8,
    fieldNameSize: 80,
    fieldSize: 4096,
    fieldArrayIndexLimit: 0
  },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.mimetype)) {
      const err = new Error('Vain JPEG-, PNG-, WebP-, HEIC- tai HEIF-kuvat ovat sallittuja.');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  }
});

const router = express.Router();

function selectPosts({ before, limit, myUserId }){
  const sql = `
    SELECT posts.id, posts.caption, posts.created_at, posts.image_path, posts.user_id,
      posts.species, posts.weight_g, posts.length_cm, posts.catch_location, posts.lure,
      users.username,
      (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS like_count,
      (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comment_count,
      EXISTS(SELECT 1 FROM likes WHERE likes.post_id = posts.id AND likes.user_id = ?) AS liked_by_me
    FROM posts JOIN users ON users.id = posts.user_id
    WHERE posts.status = 'published' ${Number.isInteger(before) ? 'AND posts.id < ?' : ''}
    ORDER BY posts.id DESC LIMIT ?
  `;
  const params = Number.isInteger(before) ? [myUserId || 0, before, limit] : [myUserId || 0, limit];
  return db.prepare(sql).all(...params);
}

function serializePost(r, myUserId, myIsAdmin){
  return {
    id: r.id,
    username: r.username,
    caption: r.caption,
    species: r.species || null,
    weightKg: r.weight_g === null ? null : r.weight_g / 1000,
    lengthCm: r.length_cm === null ? null : r.length_cm,
    catchLocation: r.catch_location || null,
    lure: r.lure || null,
    createdAt: r.created_at,
    imageUrl: `/uploads/${r.image_path}`,
    likeCount: r.like_count,
    commentCount: r.comment_count,
    likedByMe: !!r.liked_by_me,
    canDelete: !!myUserId && (myUserId === r.user_id || myIsAdmin)
  };
}

router.get('/', (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const before = parseInt(req.query.before, 10);
  const rows = selectPosts({ before: Number.isInteger(before) ? before : undefined, limit, myUserId: req.user && req.user.id });
  res.json({ posts: rows.map(r => serializePost(r, req.user && req.user.id, req.user && req.user.isAdmin)) });
});

router.post('/', requireAuth, uploadLimiter, upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Liitä saaliskuva.' });

  const caption = typeof req.body.caption === 'string' ? req.body.caption.trim().slice(0, MAX_CAPTION_LEN) : '';
  const species = optionalText(req.body.species, 40);
  const weightKg = optionalNumber(req.body.weightKg);
  const lengthCm = optionalNumber(req.body.lengthCm);
  const shareLocation = req.body.shareLocation === '1' || req.body.shareLocation === 'true';
  const catchLocation = shareLocation ? optionalText(req.body.catchLocation, 100) : null;
  const lure = optionalText(req.body.lure, 100);

  if (species && !ALLOWED_SPECIES.has(species)) return res.status(400).json({ error: 'Valitse kalalaji valikosta.' });
  if (weightKg !== null && (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 500)) {
    return res.status(400).json({ error: 'Painon tulee olla 0,01–500 kg.' });
  }
  if (lengthCm !== null && (!Number.isFinite(lengthCm) || lengthCm <= 0 || lengthCm > 500)) {
    return res.status(400).json({ error: 'Pituuden tulee olla 0,1–500 cm.' });
  }

  const recent = db.prepare('SELECT created_at FROM posts WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(req.user.id);
  if (recent && Date.now() - new Date(recent.created_at + 'Z').getTime() < POST_COOLDOWN_MS) {
    return res.status(429).json({ error: 'Odota hetki ennen seuraavaa julkaisua.' });
  }

  let processedBuffer;
  try {
    processedBuffer = await sharp(req.file.buffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    return res.status(400).json({ error: 'Kuvaa ei voitu käsitellä - varmista että tiedosto on kelvollinen kuva.' });
  }

  try {
    const moderationText = [caption, species, catchLocation, lure].filter(Boolean).join('\n');
    const modResult = await moderatePost(processedBuffer, 'image/jpeg', moderationText);
    if (!modResult.allowed) return res.status(400).json({ error: modResult.reason || 'Kuva ei läpäissyt sisällöntarkistusta.' });
  } catch (e) {
    if (e instanceof ModerationUnavailableError) {
      return res.status(503).json({ error: 'Sisällöntarkistus ei ole juuri nyt käytettävissä. Yritä hetken kuluttua uudelleen.' });
    }
    throw e;
  }

  const filename = `${crypto.randomBytes(16).toString('hex')}.jpg`;
  const imagePath = path.join(UPLOADS_DIR, filename);
  await fs.promises.writeFile(imagePath, processedBuffer);

  const weightG = weightKg === null ? null : Math.round(weightKg * 1000);
  const roundedLengthCm = lengthCm === null ? null : Math.round(lengthCm * 10) / 10;
  let info;
  try {
    info = db.prepare(`
      INSERT INTO posts (user_id, image_path, caption, species, weight_g, length_cm, catch_location, lure, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published')
    `).run(req.user.id, filename, caption, species, weightG, roundedLengthCm, catchLocation, lure);
  } catch (error) {
    try { await fs.promises.unlink(imagePath); } catch (cleanupError) {
      logError('orphan_image_cleanup_failed', { imagePath: filename, message: cleanupError.message });
      queueUploadCleanup(filename, cleanupError.message);
    }
    throw error;
  }

  res.status(201).json({
    id: info.lastInsertRowid,
    username: req.user.username,
    caption,
    species,
    weightKg,
    lengthCm: roundedLengthCm,
    catchLocation,
    lure,
    imageUrl: `/uploads/${filename}`,
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    canDelete: true
  });
}));

function findPostOr404(req, res){
  const id = parseInt(req.params.id, 10);
  const post = Number.isInteger(id) ? db.prepare('SELECT * FROM posts WHERE id = ?').get(id) : null;
  if (!post || post.status !== 'published') {
    res.status(404).json({ error: 'Julkaisua ei löytynyt.' });
    return null;
  }
  return post;
}

router.post('/:id/like', requireAuth, (req, res) => {
  const post = findPostOr404(req, res);
  if (!post) return;
  const existing = db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?').get(post.id, req.user.id);
  if (existing) db.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').run(post.id, req.user.id);
  else db.prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)').run(post.id, req.user.id);
  const likeCount = db.prepare('SELECT COUNT(*) AS n FROM likes WHERE post_id = ?').get(post.id).n;
  res.json({ liked: !existing, likeCount });
});

router.get('/:id/comments', (req, res) => {
  const post = findPostOr404(req, res);
  if (!post) return;
  const rows = db.prepare(`
    SELECT comments.id, comments.body, comments.created_at, comments.user_id, users.username
    FROM comments JOIN users ON users.id = comments.user_id
    WHERE comments.post_id = ?
    ORDER BY comments.id ASC LIMIT 200
  `).all(post.id);
  const myUserId = req.user && req.user.id;
  const myIsAdmin = req.user && req.user.isAdmin;
  res.json({
    comments: rows.map(r => ({
      id: r.id,
      username: r.username,
      body: r.body,
      createdAt: r.created_at,
      canDelete: !!myUserId && (myUserId === r.user_id || myIsAdmin)
    }))
  });
});

router.post('/:id/comments', requireAuth, (req, res) => {
  const post = findPostOr404(req, res);
  if (!post) return;
  const body = typeof req.body.body === 'string' ? req.body.body.trim().slice(0, MAX_COMMENT_LEN) : '';
  if (!body) return res.status(400).json({ error: 'Kommentti ei voi olla tyhjä.' });

  const recent = db.prepare('SELECT created_at FROM comments WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(req.user.id);
  if (recent && Date.now() - new Date(recent.created_at + 'Z').getTime() < COMMENT_COOLDOWN_MS) {
    return res.status(429).json({ error: 'Odota hetki ennen seuraavaa kommenttia.' });
  }

  if (findBlockedTerm(body)) return res.status(400).json({ error: 'Kommentti sisältää asiattomaksi tulkittavaa sisältöä.' });

  const info = db.prepare('INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?)').run(post.id, req.user.id, body);
  res.status(201).json({
    id: info.lastInsertRowid,
    username: req.user.username,
    body,
    createdAt: new Date().toISOString(),
    canDelete: true
  });
});

function deleteCommentHandler(req, res){
  const post = findPostOr404(req, res);
  if (!post) return;
  const commentId = parseInt(req.params.commentId, 10);
  const comment = Number.isInteger(commentId)
    ? db.prepare('SELECT id, user_id FROM comments WHERE id = ? AND post_id = ?').get(commentId, post.id)
    : null;
  if (!comment) return res.status(404).json({ error: 'Kommenttia ei löytynyt.' });
  if (comment.user_id !== req.user.id && !req.user.isAdmin) return res.status(403).json({ error: 'Et voi poistaa tätä kommenttia.' });
  db.prepare('DELETE FROM comments WHERE id = ?').run(comment.id);
  res.json({ ok: true, id: comment.id });
}

router.post('/:id/comments/:commentId/delete', requireAuth, deleteCommentHandler);
router.delete('/:id/comments/:commentId', requireAuth, deleteCommentHandler);

async function removePostImage(post) {
  try {
    await fs.promises.unlink(path.join(UPLOADS_DIR, post.image_path));
  } catch (error) {
    const fields = { postId: post.id, imagePath: post.image_path, code: error.code, message: error.message };
    if (error.code === 'ENOENT') logWarn('post_image_already_missing', fields);
    else {
      logError('post_image_delete_failed', fields);
      queueUploadCleanup(post.image_path, error.message);
    }
  }
}

async function deletePostHandler(req, res) {
  const post = findPostOr404(req, res);
  if (!post) return;
  if (post.user_id !== req.user.id && !req.user.isAdmin) {
    return res.status(403).json({ error: 'Et voi poistaa tätä julkaisua.' });
  }

  db.prepare('DELETE FROM posts WHERE id = ?').run(post.id);
  await removePostImage(post);
  res.json({ ok: true, id: post.id });
}

// Frontend käyttää POST-aliasia CORS-yhteensopivuuden vuoksi. DELETE säilyy yhden yhteisen
// handlerin aliasina vanhoille asiakkaille, joten poistologiikka ei enää duplikoidu.
router.post('/:id/delete', requireAuth, asyncHandler(deletePostHandler));
router.delete('/:id', requireAuth, asyncHandler(deletePostHandler));

export default router;
