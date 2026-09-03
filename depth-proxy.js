import express from 'express';

const EMODNET_REST = 'https://rest.emodnet-bathymetry.eu';
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX = 120;
const cache = new Map();

export const depthRouter = express.Router();

function finite(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseDepthBounds(query = {}) {
  const west = finite(query.west);
  const south = finite(query.south);
  const east = finite(query.east);
  const north = finite(query.north);
  if ([west, south, east, north].some(value => value == null)) return null;
  if (!(west < east && south < north)) return null;

  // FastFishing on Suomi-painotteinen. Rajaus estää endpointin käyttämisen yleisenä avoimena proxyna.
  if (west < 17 || east > 33 || south < 58 || north > 72) return null;
  if (east - west > 1.6 || north - south > 1.6) return null;
  return { west, south, east, north };
}

export function buildDepthProfiles(bounds, rows = 5) {
  const safeRows = Math.max(3, Math.min(6, Math.round(Number(rows) || 5)));
  const lines = [];
  for (let i = 0; i < safeRows; i++) {
    const fraction = 0.08 + (0.84 * i) / Math.max(1, safeRows - 1);
    const lat = bounds.south + (bounds.north - bounds.south) * fraction;
    lines.push({
      id: `h${i}`,
      start: { lon: bounds.west, lat },
      end: { lon: bounds.east, lat }
    });
  }
  return lines;
}

export function profileToSamples(values, line) {
  if (!Array.isArray(values) || values.length < 2) return [];
  const denominator = values.length - 1;
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const depth = finite(values[i]);
    if (depth == null || depth < 0 || depth > 500) continue;
    const t = i / denominator;
    out.push({
      profile: line.id,
      index: i,
      lat: line.start.lat + (line.end.lat - line.start.lat) * t,
      lon: line.start.lon + (line.end.lon - line.start.lon) * t,
      depth
    });
  }
  return out;
}

async function fetchProfile(line) {
  const geometry = `LINESTRING(${line.start.lon} ${line.start.lat},${line.end.lon} ${line.end.lat})`;
  const url = `${EMODNET_REST}/depth_profile?${new URLSearchParams({ geom: geometry })}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'FastFishing/1.0 depth-fallback' }
    });
    if (!response.ok) throw new Error(`EMODnet HTTP ${response.status}`);
    const values = await response.json();
    return profileToSamples(values, line);
  } finally {
    clearTimeout(timer);
  }
}

function cacheKey(bounds, rows) {
  return [bounds.west, bounds.south, bounds.east, bounds.north]
    .map(value => value.toFixed(3))
    .concat(rows)
    .join(':');
}

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCached(key, value) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

depthRouter.get('/emodnet', async (req, res, next) => {
  try {
    const bounds = parseDepthBounds(req.query);
    if (!bounds) {
      return res.status(400).json({ error: 'Virheellinen tai liian suuri syvyysalue.' });
    }
    const rows = Math.max(3, Math.min(6, Math.round(Number(req.query.rows) || 5)));
    const key = cacheKey(bounds, rows);
    const cached = getCached(key);
    if (cached) {
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.json({ ...cached, cached: true });
    }

    const profiles = buildDepthProfiles(bounds, rows);
    const settled = await Promise.allSettled(profiles.map(fetchProfile));
    const samples = settled.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    const failures = settled.filter(result => result.status === 'rejected').length;
    if (samples.length < 2) {
      const error = new Error('EMODnet ei palauttanut käyttökelpoista syvyysprofiilia.');
      error.status = 502;
      throw error;
    }

    const payload = {
      source: 'EMODnet Bathymetry DTM',
      sourceUrl: 'https://emodnet.ec.europa.eu/en/bathymetry',
      licence: 'CC BY 4.0 (verify source metadata where applicable)',
      resolutionMetersApprox: 115,
      notForNavigation: true,
      profilesRequested: profiles.length,
      profilesFailed: failures,
      samples
    };
    setCached(key, payload);
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json({ ...payload, cached: false });
  } catch (error) {
    next(error);
  }
});

export function _clearDepthProxyCacheForTests() {
  cache.clear();
}
