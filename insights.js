import express from 'express';
import { db } from './db.js';

const router = express.Router();

function normalizeRows(rows, key) {
  return rows.map(row => ({ name: row[key], catches: row.catches }));
}

router.get('/weekly', (req, res) => {
  const total = db.prepare(`
    SELECT COUNT(*) AS n
    FROM posts
    WHERE status = 'published' AND created_at >= datetime('now', '-7 days')
  `).get().n;

  const species = db.prepare(`
    SELECT species, COUNT(*) AS catches
    FROM posts
    WHERE status = 'published'
      AND created_at >= datetime('now', '-7 days')
      AND species IS NOT NULL AND species != ''
    GROUP BY species
    ORDER BY catches DESC, species ASC
    LIMIT 5
  `).all();

  const lures = db.prepare(`
    SELECT lure, COUNT(*) AS catches
    FROM posts
    WHERE status = 'published'
      AND created_at >= datetime('now', '-7 days')
      AND lure IS NOT NULL AND lure != ''
    GROUP BY lure
    ORDER BY catches DESC, lure ASC
    LIMIT 5
  `).all();

  const hours = db.prepare(`
    SELECT CAST(strftime('%H', created_at) AS INTEGER) AS hour, COUNT(*) AS catches
    FROM posts
    WHERE status = 'published' AND created_at >= datetime('now', '-7 days')
    GROUP BY hour
    ORDER BY catches DESC, hour ASC
    LIMIT 1
  `).get();

  res.json({
    days: 7,
    totalCatches: total,
    topSpecies: normalizeRows(species, 'species'),
    topLures: normalizeRows(lures, 'lure'),
    busiestHour: hours ? { hour: hours.hour, catches: hours.catches } : null,
    // Tarkkoja saantipaikkoja ei aggregoida tähän näkymään yksityisyyden vuoksi.
    generatedAt: new Date().toISOString()
  });
});

export default router;
