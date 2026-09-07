import { API_CSP, PAGE_CSP_HEADER } from './csp.js';
import { logError } from './logger.js';

// Rate limit -laskurit haetaan varastosta pyyntökohtaisesti, jotta palvelin voi
// vaihtaa muistivaraston pysyvään SQLite-varastoon käynnistyksessä.
export function createMemoryRateLimitStore() {
  const buckets = new Map();

  return {
    name: 'memory',
    hit(key, windowMs, now) {
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.set(key, bucket);
      }
      bucket.count += 1;

      // Kevyt siivous estää mapin kasvamisen rajatta pitkäikäisessä prosessissa.
      if (buckets.size > 5000 && Math.random() < 0.05) {
        for (const [bucketKey, value] of buckets) {
          if (value.resetAt <= now) buckets.delete(bucketKey);
        }
      }

      return { count: bucket.count, resetAt: bucket.resetAt };
    },
    reset() {
      buckets.clear();
    }
  };
}

let activeStore = createMemoryRateLimitStore();

export function useRateLimitStore(store) {
  activeStore = store;
}

export function activeRateLimitStoreName() {
  return activeStore.name;
}

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
}

// JSON-vastaukset ja uploads-kuvat eivät tarvitse skriptejä, tyylejä eivätkä kehyksiä.
export function apiCsp(req, res, next) {
  res.setHeader('Content-Security-Policy', API_CSP);
  next();
}

// Käytetään vain kun API-palvelin tarjoaa frontendin (paikallinen kehitys).
// Tuotannossa staattiset sivut kantavat saman politiikan meta-tagissa.
export function pageCsp(req, res, next) {
  res.setHeader('Content-Security-Policy', PAGE_CSP_HEADER);
  next();
}

export function createRateLimiter({ windowMs, max, message = 'Liikaa pyyntöjä. Yritä myöhemmin uudelleen.', keyPrefix = 'default' }) {
  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;

    let bucket;
    try {
      bucket = activeStore.hit(key, windowMs, now);
    } catch (error) {
      // Varasto ei ole käytettävissä. Palvelu on tällöin muutenkin rikki, joten
      // päästetään pyyntö läpi sen sijaan että koko API kaatuisi 500-virheisiin.
      logError('rate_limit_store_failed', { keyPrefix, error: error.message });
      return next();
    }

    const remaining = Math.max(0, max - bucket.count);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return res.status(429).json({ error: message });
    }

    next();
  };
}

export function _resetRateLimitersForTests() {
  activeStore = createMemoryRateLimitStore();
}
