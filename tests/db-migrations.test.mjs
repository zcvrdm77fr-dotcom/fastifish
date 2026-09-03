import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { hashSessionToken } from '../session-token.js';

test('legacy plaintext session is migrated to a digest', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fastfishing-db-'));
  const dbPath = path.join(dataDir, 'fastfishing.db');
  const legacy = new Database(dbPath);
  const rawToken = 'b'.repeat(64);

  legacy.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );
  `);
  legacy.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('migration-user', 'unused');
  legacy.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, 1, ?)')
    .run(rawToken, new Date(Date.now() + 86400000).toISOString());
  legacy.close();

  process.env.DATA_DIR = dataDir;
  const { db } = await import(`../db.js?migration-test=${Date.now()}`);

  const stored = db.prepare('SELECT token FROM sessions WHERE user_id = 1').get();
  assert.equal(stored.token, hashSessionToken(rawToken));
  assert.notEqual(stored.token, rawToken);
  assert.deepEqual(
    db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(row => row.version),
    [1, 2, 3]
  );
  assert.equal(db.pragma('busy_timeout', { simple: true }), 5000);

  db.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});
