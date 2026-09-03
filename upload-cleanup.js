import fs from 'fs';
import path from 'path';
import { db } from './db.js';
import { UPLOADS_DIR } from './paths.js';
import { logError, logInfo, logWarn } from './logger.js';

function safeImageName(value) {
  const name = path.basename(String(value || ''));
  if (!/^[a-f0-9]{32}\.jpg$/i.test(name)) return null;
  return name;
}

export function queueUploadCleanup(imagePath, reason = '') {
  const name = safeImageName(imagePath);
  if (!name) {
    logWarn('upload_cleanup_rejected_path', { imagePath: String(imagePath || '') });
    return false;
  }

  db.prepare(`
    INSERT INTO upload_cleanup_queue (image_path, last_error)
    VALUES (?, ?)
    ON CONFLICT(image_path) DO UPDATE SET
      last_error = excluded.last_error,
      updated_at = datetime('now')
  `).run(name, String(reason || '').slice(0, 500));
  return true;
}

export async function runUploadCleanup({ limit = 100 } = {}) {
  const rows = db.prepare(`
    SELECT image_path, attempts
    FROM upload_cleanup_queue
    ORDER BY updated_at ASC
    LIMIT ?
  `).all(Math.max(1, Math.min(500, Number(limit) || 100)));

  let cleaned = 0;
  for (const row of rows) {
    const name = safeImageName(row.image_path);
    if (!name) {
      db.prepare('DELETE FROM upload_cleanup_queue WHERE image_path = ?').run(row.image_path);
      continue;
    }

    try {
      await fs.promises.unlink(path.join(UPLOADS_DIR, name));
      db.prepare('DELETE FROM upload_cleanup_queue WHERE image_path = ?').run(name);
      cleaned += 1;
    } catch (error) {
      if (error.code === 'ENOENT') {
        db.prepare('DELETE FROM upload_cleanup_queue WHERE image_path = ?').run(name);
        cleaned += 1;
        continue;
      }

      db.prepare(`
        UPDATE upload_cleanup_queue
        SET attempts = attempts + 1,
            last_error = ?,
            updated_at = datetime('now')
        WHERE image_path = ?
      `).run(String(error.message || error).slice(0, 500), name);
      logError('upload_cleanup_retry_failed', {
        imagePath: name,
        attempts: Number(row.attempts || 0) + 1,
        code: error.code,
        message: error.message
      });
    }
  }

  if (cleaned) logInfo('upload_cleanup_completed', { cleaned, checked: rows.length });
  return { cleaned, checked: rows.length };
}

let cleanupTimer = null;

export function startUploadCleanupScheduler() {
  if (cleanupTimer) return cleanupTimer;

  const run = () => runUploadCleanup().catch(error => {
    logError('upload_cleanup_job_failed', { message: error.message });
  });

  const initial = setTimeout(run, 15_000);
  initial.unref?.();
  cleanupTimer = setInterval(run, 6 * 60 * 60 * 1000);
  cleanupTimer.unref?.();
  return cleanupTimer;
}
