import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAllowedOrigins, readRuntimeConfig } from '../config.js';

test('allowed origins are normalized and deduplicated', () => {
  assert.deepEqual(
    parseAllowedOrigins('https://fastfishin.com/, https://fastfishin.com,https://www.fastfishin.com'),
    ['https://fastfishin.com', 'https://www.fastfishin.com']
  );
});

test('production refuses to start without allowed origins', () => {
  assert.throws(
    () => readRuntimeConfig({ NODE_ENV: 'production', PORT: '3000' }),
    /ALLOWED_ORIGINS/
  );
});

test('local development can run without cross-origin config', () => {
  const config = readRuntimeConfig({ NODE_ENV: 'development', PORT: '3000' });
  assert.equal(config.serveFrontend, true);
  assert.deepEqual(config.allowedOrigins, []);
});
