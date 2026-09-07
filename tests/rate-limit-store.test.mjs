// SQLite-varaston testit. Vaativat better-sqlite3:n natiivimoduulin, joten ne ajetaan
// samassa ympäristössä kuin db-migrations.test.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createSqliteRateLimitStore } from '../rate-limit-store.js';

function freshStore() {
  const database = new Database(':memory:');
  database.exec(`
    CREATE TABLE rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      reset_at INTEGER NOT NULL
    )
  `);
  return { database, store: createSqliteRateLimitStore(database) };
}

test('sqlite store counts within a window', () => {
  const { store } = freshStore();
  assert.deepEqual(store.hit('api:1.2.3.4', 1000, 0), { count: 1, resetAt: 1000 });
  assert.deepEqual(store.hit('api:1.2.3.4', 1000, 400), { count: 2, resetAt: 1000 });
  assert.deepEqual(store.hit('api:1.2.3.4', 1000, 900), { count: 3, resetAt: 1000 });
});

test('sqlite store starts a new window once the old one expires', () => {
  const { store } = freshStore();
  store.hit('login:1.2.3.4', 1000, 0);
  store.hit('login:1.2.3.4', 1000, 0);
  assert.deepEqual(store.hit('login:1.2.3.4', 1000, 1000), { count: 1, resetAt: 2000 });
});

test('sqlite store keeps keys independent', () => {
  const { store } = freshStore();
  store.hit('login:1.1.1.1', 1000, 0);
  store.hit('login:1.1.1.1', 1000, 0);
  assert.equal(store.hit('login:2.2.2.2', 1000, 0).count, 1);
  assert.equal(store.hit('signup:1.1.1.1', 1000, 0).count, 1);
});

test('counters survive a new store instance on the same database', () => {
  const { database, store } = freshStore();
  store.hit('api:9.9.9.9', 60000, 0);
  store.hit('api:9.9.9.9', 60000, 0);

  // Vastaa palvelimen uudelleenkäynnistystä: uusi prosessi, sama tietokanta.
  const restarted = createSqliteRateLimitStore(database);
  assert.equal(restarted.hit('api:9.9.9.9', 60000, 10).count, 3);
});

test('two stores on one database share the same counter', () => {
  const { database, store } = freshStore();
  const second = createSqliteRateLimitStore(database);
  store.hit('api:8.8.8.8', 60000, 0);
  assert.equal(second.hit('api:8.8.8.8', 60000, 0).count, 2);
  assert.equal(store.hit('api:8.8.8.8', 60000, 0).count, 3);
});

test('reset clears every counter', () => {
  const { database, store } = freshStore();
  store.hit('api:1.1.1.1', 60000, 0);
  store.hit('api:2.2.2.2', 60000, 0);
  store.reset();
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM rate_limits').get().n, 0);
});

test('rate_limits row count stays bounded by distinct keys', () => {
  const { database, store } = freshStore();
  for (let i = 0; i < 50; i += 1) store.hit('api:1.2.3.4', 60000, i);
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM rate_limits').get().n, 1);
});
