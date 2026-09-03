import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForHealth(baseUrl, child) {
  let lastError;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`API exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return response.json();
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw lastError || new Error('API did not become healthy in time');
}

function sessionCookie(response) {
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie, 'signup should set an HttpOnly session cookie');
  return setCookie.split(';', 1)[0];
}

test('feed metadata survives create -> database -> feed roundtrip', { timeout: 30_000 }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fastfishing-api-'));
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const frontendOrigin = 'http://127.0.0.1:4173';
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DATA_DIR: dataDir,
      ALLOWED_ORIGINS: frontendOrigin,
      CROSS_SITE_COOKIES: '0',
      SERVE_FRONTEND: '0',
      ADMIN_USERNAMES: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stderr = '';
  child.stderr.on('data', chunk => { stderr += String(chunk); });

  try {
    const health = await waitForHealth(baseUrl, child);
    assert.equal(health.ok, true);
    assert.equal(health.postMetadata, true);
    assert.ok(health.schemaVersion >= 4);

    const signupResponse = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: frontendOrigin
      },
      body: JSON.stringify({ username: 'feedtest', password: 'correct-horse-battery' })
    });
    assert.equal(signupResponse.status, 200);
    assert.equal(signupResponse.headers.get('access-control-allow-origin'), frontendOrigin);
    const cookie = sessionCookie(signupResponse);
    const signup = await signupResponse.json();
    assert.equal(signup.username, 'feedtest');
    assert.equal(Object.hasOwn(signup, 'token'), false, 'bearer token must not be exposed to JavaScript');

    const png = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: { r: 20, g: 90, b: 120 }
      }
    }).png().toBuffer();
    const form = new FormData();
    form.append('image', new Blob([png], { type: 'image/png' }), 'catch.png');
    form.append('caption', 'Integraatiotestin saalis');
    form.append('species', 'Ahven');
    form.append('weightKg', '1.25');
    form.append('lengthCm', '46.5');
    form.append('catchLocation', 'Päijänne, Asikkala');
    form.append('shareLocation', '1');
    form.append('lure', '10 cm vihreä jigi');

    const createResponse = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: { Cookie: cookie, Origin: frontendOrigin },
      body: form
    });
    assert.equal(createResponse.status, 201, await createResponse.text());
    const created = await createResponse.json();
    assert.equal(created.species, 'Ahven');
    assert.equal(created.weightKg, 1.25);
    assert.equal(created.lengthCm, 46.5);
    assert.equal(created.catchLocation, 'Päijänne, Asikkala');
    assert.equal(created.lure, '10 cm vihreä jigi');

    const feedResponse = await fetch(`${baseUrl}/api/posts?limit=5`, {
      headers: { Cookie: cookie, Origin: frontendOrigin }
    });
    assert.equal(feedResponse.status, 200);
    const feed = await feedResponse.json();
    assert.equal(feed.posts.length, 1);
    assert.deepEqual(
      {
        species: feed.posts[0].species,
        weightKg: feed.posts[0].weightKg,
        lengthCm: feed.posts[0].lengthCm,
        catchLocation: feed.posts[0].catchLocation,
        lure: feed.posts[0].lure
      },
      {
        species: 'Ahven',
        weightKg: 1.25,
        lengthCm: 46.5,
        catchLocation: 'Päijänne, Asikkala',
        lure: '10 cm vihreä jigi'
      }
    );
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve => child.once('exit', resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
    assert.equal(stderr.includes('API exited early'), false, stderr);
  }
});
