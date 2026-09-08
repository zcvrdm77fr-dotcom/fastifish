// Pysyvä rate limit -varasto. Muistivarasto nollautuu jokaisessa uudelleenkäynnistyksessä
// ja deployssa, eikä se jaa laskureita useamman instanssin kesken. SQLite-taulu on samassa
// tiedostossa kuin sessiot, joten laskurit säilyvät ja jaetaan saman datalevyn kaikille
// prosesseille.

import { db } from './db.js';

// Siivotaan vanhentuneet rivit satunnaisesti, jotta taulu ei kasva rajatta.
const CLEANUP_PROBABILITY = 0.005;

export function createSqliteRateLimitStore(database = db) {
  const hitStatement = database.prepare(`
    INSERT INTO rate_limits (key, count, reset_at) VALUES (@key, 1, @resetAt)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at <= @now THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= @now THEN @resetAt ELSE rate_limits.reset_at END
    RETURNING count, reset_at AS resetAt
  `);
  const cleanupStatement = database.prepare('DELETE FROM rate_limits WHERE reset_at <= ?');
  const resetStatement = database.prepare('DELETE FROM rate_limits');

  return {
    name: 'sqlite',
    hit(key, windowMs, now) {
      const row = hitStatement.get({ key, now, resetAt: now + windowMs });
      if (Math.random() < CLEANUP_PROBABILITY) cleanupStatement.run(now);
      return { count: row.count, resetAt: row.resetAt };
    },
    reset() {
      resetStatement.run();
    }
  };
}
