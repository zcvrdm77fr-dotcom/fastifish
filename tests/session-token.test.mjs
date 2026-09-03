import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken, hashSessionToken } from '../session-token.js';

test('session token is random 256-bit hex', () => {
  const first = createSessionToken();
  const second = createSessionToken();
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.match(second, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
});

test('database digest is deterministic but not the bearer token', () => {
  const token = 'a'.repeat(64);
  const digest = hashSessionToken(token);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.notEqual(digest, token);
  assert.equal(hashSessionToken(token), digest);
});
