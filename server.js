import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { attachUser } from './auth.js';
import authRouter from './auth.js';
import postsRouter from './posts.js';
import profilesRouter from './profiles.js';
import insightsRouter from './insights.js';
import { createRateLimiter, securityHeaders } from './security.js';
import { UPLOADS_DIR } from './paths.js';
import { db } from './db.js';
import { readRuntimeConfig } from './config.js';
import { requestLogger, logInfo } from './logger.js';
import { apiNotFound, errorHandler } from './error-handler.js';
import { getBackupStatus, startBackupScheduler } from './backup.js';
import { startUploadCleanupScheduler } from './upload-cleanup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const config = readRuntimeConfig(process.env);
const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(requestLogger);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const normalizedOrigin = origin ? origin.replace(/\/+$/, '') : null;
  if (normalizedOrigin && config.allowedOrigins.includes(normalizedOrigin)) {
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
  let database = true;
  let schemaVersion = 0;
  let postMetadata = false;
  let cleanupQueued = 0;
  try {
    db.prepare('SELECT 1 AS ok').get();
    schemaVersion = Number(db.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations').get().version || 0);
    const columns = new Set(db.prepare('PRAGMA table_info(posts)').all().map(column => column.name));
    postMetadata = ['species', 'weight_g', 'length_cm', 'catch_location', 'lure'].every(name => columns.has(name));
    cleanupQueued = Number(db.prepare('SELECT COUNT(*) AS n FROM upload_cleanup_queue').get().n || 0);
  } catch {
    database = false;
  }
  const backup = getBackupStatus();
  const ok = database && postMetadata && schemaVersion >= 4;
  res.status(ok ? 200 : 503).json({
    ok,
    database,
    schemaVersion,
    postMetadata,
    cookieOnlySessions: true,
    cleanupQueued,
    backup,
    feed: true,
    profiles: true,
    insights: true,
    uptimeSeconds: Math.round(process.uptime())
  });
});

const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 600,
  keyPrefix: 'api',
  message: 'Liikaa API-pyyntöjä. Yritä hetken kuluttua uudelleen.'
});
app.use('/api', apiLimiter);

app.use('/api/auth', authRouter);
app.use('/api/posts', postsRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/insights', insightsRouter);
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '30d',
  index: false,
  immutable: true,
  dotfiles: 'deny'
}));

if (config.serveFrontend) {
  // Tuotannossa API-palvelin ei oletuksena tarjoa repositorion juurta lainkaan. Tämä paikallisen
  // kehityksen suoja estää myös vahingossa lisätyt backend-/config-tiedostot ja dotfilet.
  const privatePrefixes = ['/data', '/node_modules', '/tests', '/scripts', '/.github'];
  const privateRootFiles = /\/(?:server|db|auth|posts|profiles|insights|security|paths|wordlist|moderation|config|logger|error-handler|async-handler|session-token)\.js$/i;
  const privateExtensions = /\.(?:env|db|sqlite|sqlite3|log|pem|key|crt|bak|ya?ml)$/i;

  app.use((req, res, next) => {
    const pathName = req.path;
    if (
      pathName.split('/').some(part => part.startsWith('.')) ||
      privatePrefixes.some(prefix => pathName === prefix || pathName.startsWith(prefix + '/')) ||
      privateRootFiles.test(pathName) ||
      privateExtensions.test(pathName) ||
      ['/package.json', '/package-lock.json', '/Dockerfile', '/DEPLOY.md', '/README.md', '/CONTRIBUTING.md'].includes(pathName)
    ) {
      return res.status(404).end();
    }
    next();
  });

  app.use(express.static(__dirname, { dotfiles: 'deny', index: false }));
  app.get('/tietosuoja', (req, res) => res.sendFile(path.join(__dirname, 'tietosuoja.html')));
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
}

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return apiNotFound(req, res);
  if (config.serveFrontend) return res.sendFile(path.join(__dirname, 'index.html'));
  return res.status(404).json({ service: 'FastFishing API', error: 'Ei löytynyt.' });
});

app.use(errorHandler);

app.listen(config.port, '0.0.0.0', () => {
  startUploadCleanupScheduler();
  startBackupScheduler();
  logInfo('server_started', {
    port: config.port,
    production: config.production,
    serveFrontend: config.serveFrontend,
    allowedOrigins: config.allowedOrigins
  });
});
