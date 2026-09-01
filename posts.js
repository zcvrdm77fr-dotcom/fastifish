import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { db } from './db.js';
import { requireAuth, isAdminUsername } from './auth.js';
import { moderatePost, ModerationUnavailableError } from './moderation.js';
import { UPLOADS_DIR } from './paths.js';
import { findBlockedTerm } from './wordlist.js';

const MAX_CAPTION_LEN = 280;
const MAX_COMMENT_LEN = 300;
const POST_COOLDOWN_MS = 60 * 1000; // roskapostin/tulvimisen esto - yksi julkaisu per minuutti per käyttäjä
const COMMENT_COOLDOWN_MS = 5 * 1000; // kevyempi esto kommenteille - ei tarvitse yhtä pitkää taukoa kuin kuvajulkaisulle
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
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.mimetype)) {
      const err = new Error('Vain JPEG-, PNG- tai WebP-kuvat ovat sallittuja.');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  }
});

const router = express.Router();

// myUserId on null jos pyyntö on tekemätön kirjautumatta - silloin likedByMe on aina false
// eikä canDelete-lippua voi koskaan olla true julkiselle katsojalle.
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
  res.json({
    posts: rows.map(r => serializePost(r, req.user && req.user.id, req.user && req.user.isAdmin))
  });
});

router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Liitä saaliskuva.' });
  }
  const caption = typeof req.body.caption === 'string' ? req.body.caption.trim().slice(0, MAX_CAPTION_LEN) : '';
  const species = optionalText(req.body.species, 40);
  const weightKg = optionalNumber(req.body.weightKg);
  const lengthCm = optionalNumber(req.body.lengthCm);
  const catchLocation = optionalText(req.body.catchLocation, 100);
  const lure = optionalText(req.body.lure, 100);

  if (species && !ALLOWED_SPECIES.has(species)) {
    return res.status(400).json({ error: 'Valitse kalalaji valikosta.' });
  }
  if (weightKg !== null && (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 500)) {
    return res.status(400).json({ error: 'Painon tulee olla 0,01–500 kg.' });
  }
  if (lengthCm !== null && (!Number.isFinite(lengthCm) || lengthCm <= 0 || lengthCm > 500)) {
    return res.status(400).json({ error: 'Pituuden tulee olla 0,1–500 cm.' });
  }

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
    const moderationText = [caption, species, catchLocation, lure].filter(Boolean).join('\n');
    const modResult = await moderatePost(processedBuffer, 'image/jpeg', moderationText);
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

  const weightG = weightKg === null ? null : Math.round(weightKg * 1000);
  const roundedLengthCm = lengthCm === null ? null : Math.round(lengthCm * 10) / 10;
  const info = db.prepare(`
    INSERT INTO posts (
      user_id, image_path, caption, species, weight_g, length_cm, catch_location, lure, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published')
  `).run(
    req.user.id, filename, caption, species, weightG, roundedLengthCm, catchLocation, lure
  );

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
});

function findPostOr404(req, res){
  const id = parseInt(req.params.id, 10);
  const post = Number.isInteger(id) ? db.prepare('SELECT * FROM posts WHERE id = ?').get(id) : null;
  if (!post || post.status !== 'published') {
    res.status(404).json({ error: 'Julkaisua ei löytynyt.' });
    return null;
  }
  return post;
}

// Tykkäys on kytkin (toggle) yhdellä reitillä yksinkertaisuuden vuoksi - sama pyyntö sekä
// tykkää että perumaan tykkäyksen sen mukaan onko käyttäjä jo tykännyt. likes-taulun
// (post_id, user_id) yhdistetty pääavain estää tuplatykkäykset tietokantatasolla.
router.post('/:id/like', requireAuth, (req, res) => {
  const post = findPostOr404(req, res);
  if (!post) return;
  const existing = db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?').get(post.id, req.user.id);
  if (existing) {
    db.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').run(post.id, req.user.id);
  } else {
    db.prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)').run(post.id, req.user.id);
  }
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

router.post('/:id/comments', requireAuth, async (req, res) => {
  const post = findPostOr404(req, res);
  if (!post) return;

  const body = typeof req.body.body === 'string' ? req.body.body.trim().slice(0, MAX_COMMENT_LEN) : '';
  if (!body) {
    return res.status(400).json({ error: 'Kommentti ei voi olla tyhjä.' });
  }

  const recent = db.prepare(`
    SELECT created_at FROM comments WHERE user_id = ? ORDER BY id DESC LIMIT 1
  `).get(req.user.id);
  if (recent && Date.now() - new Date(recent.created_at + 'Z').getTime() < COMMENT_COOLDOWN_MS) {
    return res.status(429).json({ error: 'Odota hetki ennen seuraavaa kommenttia.' });
  }

  const blocked = findBlockedTerm(body);
  if (blocked) {
    return res.status(400).json({ error: 'Kommentti sisältää asiattomaksi tulkittavaa sisältöä.' });
  }

  const info = db.prepare('INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?)').run(post.id, req.user.id, body);
  res.status(201).json({
    id: info.lastInsertRowid,
    username: req.user.username,
    body,
    createdAt: new Date().toISOString(),
    canDelete: true
  });
});

// Yksittäisen kommentin poisto - kommentin kirjoittaja tai ylläpitäjä. Sama käsittelijä
// palvelee sekä nykyistä POST .../delete -reittiä että REST-tyylistä DELETE-reittiä. Näin
// frontend ja API voivat päivittyä eri aikaan ilman että käyttäjä saa pelkän "Ei löytynyt" -virheen.
function deleteCommentHandler(req, res){
  const post = findPostOr404(req, res);
  if (!post) return;
  const commentId = parseInt(req.params.commentId, 10);
  const comment = Number.isInteger(commentId)
    ? db.prepare('SELECT id, user_id FROM comments WHERE id = ? AND post_id = ?').get(commentId, post.id)
    : null;
  if (!comment) {
    return res.status(404).json({ error: 'Kommenttia ei löytynyt.' });
  }
  const canDelete = comment.user_id === req.user.id || req.user.isAdmin;
  if (!canDelete) {
    return res.status(403).json({ error: 'Et voi poistaa tätä kommenttia.' });
  }
  db.prepare('DELETE FROM comments WHERE id = ?').run(comment.id);
  res.json({ ok: true, id: comment.id });
}

router.post('/:id/comments/:commentId/delete', requireAuth, deleteCommentHandler);
router.delete('/:id/comments/:commentId', requireAuth, deleteCommentHandler);

// Julkaisun saa poistaa sen omistaja tai sivuston ylläpitäjä (ADMIN_USERNAMES). Poistetaan sekä
// tietokantarivi (likes/comments poistuvat mukana ON DELETE CASCADE -viittausten ansiosta) että
// itse kuvatiedosto levyltä - muuten poistetut kuvat jäisivät roikkumaan levylle ikuisesti.
router.delete('/:id', requireAuth, async (req, res) => {
  const post = findPostOr404(req, res);
  if (!post) return;
  const canDelete = post.user_id === req.user.id || req.user.isAdmin;
  if (!canDelete) {
    return res.status(403).json({ error: 'Et voi poistaa tätä julkaisua.' });
  }
  db.prepare('DELETE FROM posts WHERE id = ?').run(post.id);
  try {
    await fs.promises.unlink(path.join(UPLOADS_DIR, post.image_path));
  } catch (e) {
    // Tiedosto oli jo poistettu tms. - tietokantarivi on silti poistettu, ei kaadeta pyyntöä.
  }
  res.json({ ok: true });
});

// Uusi, CORS-yhteensopiva reitti julkaisun poistoon (POST .../delete eikä HTTP DELETE -verbiä -
// sama syy kuin kommentin poistossa yllä). Sallittu julkaisun omistajalle TAI ylläpitäjälle
// (ADMIN_USERNAMES) - sama periaate kuin vanhassa DELETE /:id -reitissä yllä, joka jätetään
// paikalleen taaksepäinyhteensopivuuden vuoksi mutta jota frontti ei enää kutsu.
router.post('/:id/delete', requireAuth, async (req, res) => {
  const postId = Number(req.params.id);

  if (!Number.isInteger(postId) || postId < 1) {
    return res.status(400).json({ error: 'Virheellinen postaus.' });
  }

  const post = db.prepare(`
    SELECT id, user_id, image_path
    FROM posts
    WHERE id = ?
  `).get(postId);

  if (!post) {
    return res.status(404).json({ error: 'Postausta ei löytynyt.' });
  }

  if (post.user_id !== req.user.id && !req.user.isAdmin) {
    return res.status(403).json({
      error: 'Voit poistaa vain omat julkaisusi.'
    });
  }

  // Poista tietokannasta.
  // likes/comments poistuvat automaattisesti foreign key -sääntöjen ansiosta.
  db.prepare(`
    DELETE FROM posts
    WHERE id = ?
  `).run(postId);

  // Poista kuvatiedosto.
  try {
    await fs.promises.unlink(
      path.join(UPLOADS_DIR, post.image_path)
    );
  } catch (err) {
    // Tiedoston puuttuminen ei estä tietokantapoistoa.
    if (err.code !== 'ENOENT') {
      console.error('Kuvan poistaminen epäonnistui:', err);
    }
  }

  res.json({
    ok: true,
    id: postId
  });
});

export default router;
