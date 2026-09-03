import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from './db.js';
import { moderateUsername, ModerationUnavailableError } from './moderation.js';
import { createRateLimiter } from './security.js';

const SESSION_COOKIE = 'ff_session';
const SESSION_DAYS = 30;
const CROSS_SITE = process.env.CROSS_SITE_COOKIES === '1';
const USERNAME_RE = /^[a-zA-Z0-9äöåÄÖÅ_-]{3,20}$/;

const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'ylläpito', 'yllapito', 'moderaattori', 'moderator',
  'fastfishing', 'fastfish', 'root', 'system', 'tuki', 'support'
]);

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyPrefix: 'login',
  message: 'Liikaa kirjautumisyrityksiä. Yritä 15 minuutin kuluttua uudelleen.'
});

const signupLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 8,
  keyPrefix: 'signup',
  message: 'Liikaa rekisteröitymisyrityksiä. Yritä myöhemmin uudelleen.'
});

function cleanupSessions(userId = null){
  db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  if (userId) {
    const extra = db.prepare(`
      SELECT token FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET 5
    `).all(userId);
    const del = db.prepare('DELETE FROM sessions WHERE token = ?');
    const tx = db.transaction(rows => rows.forEach(row => del.run(row.token)));
    tx(extra);
  }
}

function createSession(userId){
  cleanupSessions(userId);
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  return { token, expiresAt };
}

function setSessionCookie(res, token, expiresAt){
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: CROSS_SITE ? 'none' : 'lax',
    secure: CROSS_SITE || process.env.NODE_ENV === 'production',
    expires: new Date(expiresAt),
    path: '/'
  });
}

function clearSessionCookie(res){
  res.clearCookie(SESSION_COOKIE, {
    path: '/',
    sameSite: CROSS_SITE ? 'none' : 'lax',
    secure: CROSS_SITE || process.env.NODE_ENV === 'production'
  });
}

function readSessionToken(req){
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (/^[a-f0-9]{64}$/i.test(token)) return token;
  }
  return (req.cookies && req.cookies[SESSION_COOKIE]) || null;
}

const ADMIN_USERNAMES = new Set(
  (process.env.ADMIN_USERNAMES || '')
    .split(',')
    .map(u => u.trim().toLowerCase())
    .filter(Boolean)
);
export function isAdminUsername(username){
  return !!username && ADMIN_USERNAMES.has(username.toLowerCase());
}

export function attachUser(req, res, next){
  const token = readSessionToken(req);
  if (!token) return next();
  const row = db.prepare(`
    SELECT users.id as id, users.username as username, sessions.expires_at as expires_at
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ?
  `).get(token);
  if (row && new Date(row.expires_at) > new Date()) {
    req.user = { id: row.id, username: row.username, isAdmin: isAdminUsername(row.username) };
  } else if (row) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  next();
}

export function requireAuth(req, res, next){
  if (!req.user) return res.status(401).json({ error: 'Kirjaudu sisään jatkaaksesi.' });
  next();
}

const router = express.Router();

router.post('/signup', signupLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Käyttäjänimen tulee olla 3-20 merkkiä (kirjaimet, numerot, - ja _).' });
  }
  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    return res.status(400).json({ error: 'Tämä käyttäjänimi on varattu.' });
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    return res.status(400).json({ error: 'Salasanan tulee olla 8-72 merkkiä.' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);
  if (existing) return res.status(409).json({ error: 'Käyttäjänimi on jo varattu.' });

  try {
    const modResult = await moderateUsername(username);
    if (!modResult.allowed) return res.status(400).json({ error: modResult.reason || 'Käyttäjänimeä ei voi käyttää.' });
  } catch (e) {
    if (e instanceof ModerationUnavailableError) {
      return res.status(503).json({ error: 'Sisällöntarkistus ei ole juuri nyt käytettävissä. Yritä hetken kuluttua uudelleen.' });
    }
    throw e;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const info = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash);
  const { token, expiresAt } = createSession(info.lastInsertRowid);
  setSessionCookie(res, token, expiresAt);
  res.json({ username, token: CROSS_SITE ? token : null, expiresAt });
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 100 || password.length > 100) {
    return res.status(400).json({ error: 'Anna käyttäjänimi ja salasana.' });
  }
  const user = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE').get(username);
  if (!user) return res.status(401).json({ error: 'Väärä käyttäjänimi tai salasana.' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Väärä käyttäjänimi tai salasana.' });
  const { token, expiresAt } = createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  res.json({ username: user.username, token: CROSS_SITE ? token : null, expiresAt });
});

router.post('/logout', (req, res) => {
  const token = readSessionToken(req);
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.post('/logout-all', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: req.user || null });
});

export default router;
