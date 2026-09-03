import crypto from 'crypto';

const SESSION_TOKEN_BYTES = 32;

export function createSessionToken() {
  return crypto.randomBytes(SESSION_TOKEN_BYTES).toString('hex');
}

export function hashSessionToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new TypeError('Session token must be a non-empty string.');
  }
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}
