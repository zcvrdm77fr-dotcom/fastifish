import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { attachUser } from './auth.js';
import authRouter from './auth.js';
import postsRouter from './posts.js';
import { UPLOADS_DIR } from './paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Pilvipalvelut (Render, Fly, Railway...) antavat portin ympäristömuuttujassa eivätkä anna
// valita sitä itse - kovakoodattu 3000 tarkoittaisi, ettei palvelu vastaa lainkaan.
const PORT = parseInt(process.env.PORT, 10) || 3000;

// Palvelu on kuormanjakajan/proxyn takana pilvessä. Ilman tätä Express ei tiedä, että alkuperäinen
// pyyntö tuli HTTPS:llä, eikä Secure-eväste kulkisi läpi.
app.set('trust proxy', 1);

// CORS: sivusto voi olla eri osoitteessa kuin tämä API (esim. staattinen sivusto GitHub
// Pagesissa, API omalla palvelimella). Selain estää tällaiset pyynnöt oletuksena, ellei API
// erikseen kerro sallivansa kyseistä alkuperää. Sallitaan vain nimenomaisesti listatut
// osoitteet - jokerimerkki (*) ei kelpaa, koska kirjautuminen vaatii credentials-tuen.
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
  // Vary kertoo välimuisteille, ettei yhden alkuperän vastausta saa tarjoilla toiselle.
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.use(cookieParser());
app.use(express.json());
app.use(attachUser);

// Terveystarkistus: pilvipalvelut pingaavat tätä, ja frontti käyttää sitä kertoakseen
// käyttäjälle selkeästi jos saalisfeedin palvelin ei ole tavoitettavissa.
app.get('/api/health', (req, res) => {
  res.json({ ok: true, feed: true });
});

app.use('/api/auth', authRouter);
app.use('/api/posts', postsRouter);
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d' }));

// express.static(__dirname) alla tarjoilee koko projektikansion - se sisältää nyt myös
// tietokannan (salasanahashit) ja palvelimen lähdekoodin, joita EI saa koskaan päätyä
// julkisesti ladattaviksi. express.static jättää oletuksena pisteellä alkavat tiedostot pois
// (.env, .gcp-service-account.json ovat siis jo suojattuja), mutta data/, node_modules/ ja
// palvelimen .js-tiedostot eivät ole - estetään ne tässä nimenomaisesti ennen staattista tasoa.
const BLOCKED_STATIC_PREFIXES = ['/data', '/node_modules'];
const BLOCKED_STATIC_FILES = new Set([
  '/server.js', '/db.js', '/auth.js', '/posts.js', '/moderation.js',
  '/paths.js', '/wordlist.js', '/package.json', '/package-lock.json'
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
