import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { attachUser } from './auth.js';
import authRouter from './auth.js';
import postsRouter from './posts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

const app = express();
const PORT = 3000;

app.use(cookieParser());
app.use(express.json());
app.use(attachUser);

app.use('/api/auth', authRouter);
app.use('/api/posts', postsRouter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '30d' }));

// express.static(__dirname) alla tarjoilee koko projektikansion - se sisältää nyt myös
// tietokannan (salasanahashit) ja palvelimen lähdekoodin, joita EI saa koskaan päätyä
// julkisesti ladattaviksi. express.static jättää oletuksena pisteellä alkavat tiedostot pois
// (.env, .gcp-service-account.json ovat siis jo suojattuja), mutta data/, node_modules/ ja
// palvelimen .js-tiedostot eivät ole - estetään ne tässä nimenomaisesti ennen staattista tasoa.
const BLOCKED_STATIC_PREFIXES = ['/data', '/node_modules'];
const BLOCKED_STATIC_FILES = new Set([
  '/server.js', '/db.js', '/auth.js', '/posts.js', '/moderation.js',
  '/package.json', '/package-lock.json'
]);
app.use((req, res, next) => {
  if (BLOCKED_STATIC_FILES.has(req.path) || BLOCKED_STATIC_PREFIXES.some(p => req.path.startsWith(p))) {
    return res.status(404).end();
  }
  next();
});

// Serve static files from root directory
app.use(express.static(__dirname));

// Explicit route for privacy policy (tietosuoja.html)
app.get('/tietosuoja', (req, res) => {
  res.sendFile(path.join(__dirname, 'tietosuoja.html'));
});

// Direct route for main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback to index.html for other unhandled requests (mutta ei /api/-poluille, joille
// puuttuva reitti tarkoittaa oikeasti virhettä eikä SPA-sivua)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Ei löytynyt.' });
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Yhtenäinen JSON-virhevastaus (mm. multerin tiedostokoko/tyyppivirheet) - ilman tätä Express
// palauttaisi HTML-virhesivun, jota frontin fetch-koodi ei osaisi jäsentää siististi.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    const status = err instanceof multer.MulterError ? 400 : (err.status || 500);
    return res.status(status).json({ error: err.message || 'Palvelinvirhe.' });
  }
  next();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
