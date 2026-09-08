import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForServer(baseUrl, child) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Static server exited with code ${child.exitCode}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Static server did not start');
}

test('static delivery serves the application, llms.txt and custom 404 without source maps', { timeout: 15_000 }, async () => {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['scripts/static-server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });

  try {
    await waitForServer(baseUrl, child);

    const root = await fetch(`${baseUrl}/`);
    assert.equal(root.status, 200);
    assert.match(root.headers.get('content-type') || '', /^text\/html/);
    assert.match(await root.text(), /<script defer src="\/app\.js\?v=\d+"><\/script>/);

    const app = await fetch(`${baseUrl}/app.js`);
    assert.equal(app.status, 200);
    assert.match(app.headers.get('content-type') || '', /^text\/javascript/);

    const llms = await fetch(`${baseUrl}/llms.txt`);
    assert.equal(llms.status, 200);
    assert.match(llms.headers.get('content-type') || '', /^text\/plain/);

    const missing = await fetch(`${baseUrl}/sivua-ei-ole`);
    assert.equal(missing.status, 404);
    assert.match(await missing.text(), /<title>Sivua ei löytynyt \| FastFishing<\/title>/);

    const sourceMap = await fetch(`${baseUrl}/app.js.map`);
    assert.equal(sourceMap.status, 404);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    assert.equal(stderr, '', stderr);
  }
});
