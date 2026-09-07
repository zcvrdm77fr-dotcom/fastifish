import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRateLimiter,
  createMemoryRateLimitStore,
  useRateLimitStore,
  activeRateLimitStoreName,
  _resetRateLimitersForTests
} from '../security.js';

function mockRes() {
  return {
    headers: new Map(), statusCode: 200, body: null,
    setHeader(k, v) { this.headers.set(k, v); },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function callLimiter(limiter, req) {
  const res = mockRes();
  let passed = false;
  limiter(req, res, () => { passed = true; });
  return { res, passed };
}

test('memory store counts within a window and rolls over after it', () => {
  const store = createMemoryRateLimitStore();
  assert.deepEqual(store.hit('a', 1000, 0), { count: 1, resetAt: 1000 });
  assert.deepEqual(store.hit('a', 1000, 500), { count: 2, resetAt: 1000 });
  // Ikkunan päätyttyä laskuri alkaa alusta uudella resetAt-hetkellä.
  assert.deepEqual(store.hit('a', 1000, 1000), { count: 1, resetAt: 2000 });
});

test('memory store keeps keys independent', () => {
  const store = createMemoryRateLimitStore();
  store.hit('a', 1000, 0);
  store.hit('a', 1000, 0);
  assert.equal(store.hit('b', 1000, 0).count, 1);
  assert.equal(store.hit('a', 1000, 0).count, 3);
});

test('limiter reads the store that is active at request time', () => {
  _resetRateLimitersForTests();
  const limiter = createRateLimiter({ windowMs: 60000, max: 1, keyPrefix: 'swap' });
  const req = { ip: '10.0.0.1' };

  assert.equal(callLimiter(limiter, req).passed, true);
  assert.equal(callLimiter(limiter, req).res.statusCode, 429);

  // Varaston vaihto nollaa laskurin, koska limiter hakee sen joka pyynnöllä.
  useRateLimitStore(createMemoryRateLimitStore());
  assert.equal(callLimiter(limiter, req).passed, true);
});

test('limiter separates callers by ip and key prefix', () => {
  _resetRateLimitersForTests();
  const login = createRateLimiter({ windowMs: 60000, max: 1, keyPrefix: 'login' });
  const signup = createRateLimiter({ windowMs: 60000, max: 1, keyPrefix: 'signup' });

  assert.equal(callLimiter(login, { ip: '10.0.0.1' }).passed, true);
  assert.equal(callLimiter(login, { ip: '10.0.0.1' }).res.statusCode, 429);
  // Eri prefix ja eri ip saavat oman kiintiönsä.
  assert.equal(callLimiter(signup, { ip: '10.0.0.1' }).passed, true);
  assert.equal(callLimiter(login, { ip: '10.0.0.2' }).passed, true);
});

test('limiter reports RateLimit headers and Retry-After on rejection', () => {
  _resetRateLimitersForTests();
  const limiter = createRateLimiter({ windowMs: 60000, max: 2, keyPrefix: 'headers' });
  const req = { ip: '10.0.0.3' };

  const first = callLimiter(limiter, req);
  assert.equal(first.res.headers.get('RateLimit-Limit'), '2');
  assert.equal(first.res.headers.get('RateLimit-Remaining'), '1');

  callLimiter(limiter, req);
  const blocked = callLimiter(limiter, req);
  assert.equal(blocked.res.statusCode, 429);
  assert.equal(blocked.res.headers.get('RateLimit-Remaining'), '0');
  assert.ok(Number(blocked.res.headers.get('Retry-After')) > 0);
});

test('limiter falls open if the store throws instead of failing the request', () => {
  useRateLimitStore({
    name: 'broken',
    hit() { throw new Error('store down'); },
    reset() {}
  });
  const limiter = createRateLimiter({ windowMs: 60000, max: 1, keyPrefix: 'broken' });
  const attempt = callLimiter(limiter, { ip: '10.0.0.4' });
  assert.equal(attempt.passed, true, 'rikkinäinen varasto ei saa kaataa pyyntöä');
  assert.equal(attempt.res.statusCode, 200);
  _resetRateLimitersForTests();
});

test('store name is reported so /api/health can show which backend is live', () => {
  _resetRateLimitersForTests();
  assert.equal(activeRateLimitStoreName(), 'memory');
});

test('requests without an ip share the unknown bucket rather than bypassing limits', () => {
  _resetRateLimitersForTests();
  const limiter = createRateLimiter({ windowMs: 60000, max: 1, keyPrefix: 'anon' });
  assert.equal(callLimiter(limiter, {}).passed, true);
  assert.equal(callLimiter(limiter, {}).res.statusCode, 429);
});
