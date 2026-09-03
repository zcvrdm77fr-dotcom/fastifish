import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { attachUser } from './auth.js';
import authRouter from './auth.js';
import postsRouter from './posts.js';
import profilesRouter from './profiles.js';
import insightsRouter from './insights.js';
import { securityHeaders } from './security.js';
import { UPLOADS_DIR } from './paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(securityHeaders);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin.replace(/\/+$/, ''))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.use(cookieParser());
app.use(express.json({ limit: '64kb' }));
app.use(attachUser);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, feed: true, profiles: true, insights: true });
});

app.use('/api/auth', authRouter);
app.use('/api/posts', postsRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/insights', insightsRouter);
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d', index: false, immutable: true }));

const BLOCKED_STATIC_PREFIXES = ['/data', '/node_modules', '/tests', '/scripts'];
const BLOCKED_STATIC_FILES = new Set([
  '/server.js', '/db.js', '/auth.js', '/posts.js', '/profiles.js', '/insights.js', '/security.js',
  '/paths.js', '/wordlist.js', '/moderation.js', '/package.json', '/package-lock.json',
  '/Dockerfile', '/render.yaml', '/DEPLOY.md'
]);
app.use((req, res, next) => {
  if (BLOCKED_STATIC_FILES.has(req.path) || BLOCKED_STATIC_PREFIXES.some(p => req.path.startsWith(p))) {
    return res.status(404).end();
  }
  next();
});

app.use(express.static(__dirname));

app.get('/tietosuoja', (req, res) => {
  res.sendFile(path.join(__dirname, 'tietosuoja.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Ei löytynyt.' });
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    const status = err instanceof multer.MulterError ? 400 : (err.status || 500);
    if (status >= 500) console.error('Palvelinvirhe:', err);
    return res.status(status).json({ error: status >= 500 ? 'Palvelinvirhe.' : (err.message || 'Pyyntö epäonnistui.') });
  }
  next();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
