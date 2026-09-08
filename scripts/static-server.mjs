import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const port = Number.parseInt(process.env.PORT || '4173', 10);
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.ico', 'image/x-icon'],
  ['.webp', 'image/webp']
]);

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const safe = path.normalize(requested).replace(/^([.][.][/\\])+/, '');
  const filePath = path.resolve(root, `.${safe}`);
  if (!filePath.startsWith(root + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      fs.createReadStream(path.join(root, '404.html')).pipe(res);
      return;
    }
    res.setHeader('Content-Type', types.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Static test server listening on http://127.0.0.1:${port}`);
});
