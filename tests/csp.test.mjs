import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_CSP, PAGE_CSP_HEADER, API_CSP } from '../csp.js';
import { securityHeaders, apiCsp, pageCsp } from '../security.js';

function parse(policy) {
  return new Map(policy.split(';').map(part => {
    const [name, ...values] = part.trim().split(/\s+/);
    return [name, values];
  }));
}

function runMiddleware(middleware) {
  const headers = {};
  const res = { setHeader: (name, value) => { headers[name] = value; } };
  let called = false;
  middleware({}, res, () => { called = true; });
  assert.ok(called, 'middleware kutsuu next()');
  return headers;
}

test('page policy locks down the directives that do not depend on AdSense', () => {
  const csp = parse(PAGE_CSP);
  assert.deepEqual(csp.get('default-src'), ["'self'"]);
  assert.deepEqual(csp.get('base-uri'), ["'self'"]);
  assert.deepEqual(csp.get('object-src'), ["'none'"]);
  assert.deepEqual(csp.get('form-action'), ["'self'"]);
  assert.deepEqual(csp.get('worker-src'), ["'self'"]);
  assert.ok(csp.has('upgrade-insecure-requests'));
});

test('connect-src is an allowlist and never a wildcard', () => {
  const connect = parse(PAGE_CSP).get('connect-src');
  assert.ok(connect.includes("'self'"));
  assert.ok(connect.includes('https://api.fastfishin.com'));
  assert.ok(!connect.includes('*'), 'connect-src ei saa olla villikortti');
  assert.ok(!connect.includes('https:'), 'connect-src ei saa sallia kaikkia https-isäntiä');
  for (const source of connect) {
    assert.ok(
      source === "'self'" || source.startsWith('https://'),
      `connect-src sisältää salaamattoman lähteen: ${source}`
    );
  }
});

test('frame-ancestors is served as a header because meta ignores it', () => {
  assert.ok(!PAGE_CSP.includes('frame-ancestors'), 'meta-tagissa frame-ancestors olisi tehoton');
  assert.ok(PAGE_CSP_HEADER.includes("frame-ancestors 'none'"));
});

test('API policy blocks scripts, frames and form posts entirely', () => {
  const csp = parse(API_CSP);
  assert.deepEqual(csp.get('default-src'), ["'none'"]);
  assert.deepEqual(csp.get('frame-ancestors'), ["'none'"]);
  assert.deepEqual(csp.get('form-action'), ["'none'"]);
  assert.deepEqual(csp.get('base-uri'), ["'none'"]);
  assert.ok(!API_CSP.includes("'unsafe-inline'"));
});

test('middlewares set the policies they advertise', () => {
  assert.equal(runMiddleware(apiCsp)['Content-Security-Policy'], API_CSP);
  assert.equal(runMiddleware(pageCsp)['Content-Security-Policy'], PAGE_CSP_HEADER);

  const base = runMiddleware(securityHeaders);
  assert.equal(base['X-Content-Type-Options'], 'nosniff');
  assert.equal(base['X-Frame-Options'], 'DENY');
  assert.ok(!('Content-Security-Policy' in base), 'securityHeaders ei saa asettaa CSP:tä itse');
});
