import Database from 'better-sqlite3';
import path from 'path';
import { DATA_DIR } from './paths.js';
import { hashSessionToken } from './session-token.js';

export const db = new Database(path.join(DATA_DIR, 'fastfishing.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');

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

  CREATE TABLE IF NOT EXISTS likes (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (post_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user
    ON sessions(user_id);

  CREATE INDEX IF NOT EXISTS idx_posts_status_created
    ON posts(status, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_likes_post
    ON likes(post_id);

  CREATE INDEX IF NOT EXISTS idx_comments_post_created
    ON comments(post_id, created_at);
`);

function applyMigration(version, name, up) {
  const applied = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(version);
  if (applied) return;

  const migrate = db.transaction(() => {
    up();
    db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(version, name);
  });
  migrate();
}

applyMigration(1, 'optional post metadata', () => {
  const postColumns = new Set(
    db.prepare('PRAGMA table_info(posts)').all().map(column => column.name)
  );
  const optionalPostColumns = [
    ['species', 'TEXT'],
    ['weight_g', 'INTEGER'],
    ['length_cm', 'REAL'],
    ['catch_location', 'TEXT'],
    ['lure', 'TEXT']
  ];
  for (const [name, type] of optionalPostColumns) {
    if (!postColumns.has(name)) {
      db.exec(`ALTER TABLE posts ADD COLUMN ${name} ${type}`);
    }
  }
});

applyMigration(2, 'hash session tokens at rest', () => {
  const rows = db.prepare('SELECT token FROM sessions').all();
  const update = db.prepare('UPDATE sessions SET token = ? WHERE token = ?');
  for (const row of rows) {
    update.run(hashSessionToken(row.token), row.token);
  }
});

applyMigration(3, 'optimize published feed pagination', () => {
  db.exec('CREATE INDEX IF NOT EXISTS idx_posts_status_id ON posts(status, id DESC)');
});
