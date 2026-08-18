import Database from 'better-sqlite3';
import path from 'path';
// paths.js luo hakemistot heti importissa. ES-moduulien importit ajetaan aina ennen tuovan
// moduulin (server.js) omaa koodia, joten hakemistot ovat olemassa ennen kuin tietokanta
// avataan tässä.
import { DATA_DIR } from './paths.js';

export const db = new Database(path.join(DATA_DIR, 'fastfishing.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_path TEXT NOT NULL,
    caption TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    reject_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_posts_status_created ON posts(status, created_at DESC);
`);
