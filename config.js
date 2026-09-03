function normalizeOrigin(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Virheellinen ALLOWED_ORIGINS-arvo: ${raw}`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`ALLOWED_ORIGINS-arvon pitää olla pelkkä origin, esim. https://fastfishin.com: ${raw}`);
  }
  return url.origin;
}

export function parseAllowedOrigins(value = '') {
  return [...new Set(String(value).split(',').map(normalizeOrigin).filter(Boolean))];
}

export function readRuntimeConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS || '');
  const serveFrontend = env.SERVE_FRONTEND === '1' || (!production && env.SERVE_FRONTEND !== '0');
  const port = Number.parseInt(env.PORT || '3000', 10);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT pitää olla kokonaisluku väliltä 1–65535.');
  }
  if (production && allowedOrigins.length === 0) {
    throw new Error('ALLOWED_ORIGINS must be set in production.');
  }
  if (production && allowedOrigins.some(origin => !origin.startsWith('https://'))) {
    throw new Error('Production browser origins must use HTTPS.');
  }

  return {
    production,
    allowedOrigins,
    serveFrontend,
    port
  };
}
