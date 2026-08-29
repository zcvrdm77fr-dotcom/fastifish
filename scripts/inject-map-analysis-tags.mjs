#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';

const path = process.argv[2] || 'index.html';
let html = await readFile(path, 'utf8');

const files = ['fishing-structures.js', 'depth-structures.js', 'gtk-substrate.js', 'gtk-habitats.js'];
for (const file of files) {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  html = html.replace(new RegExp(`\\s*<script\\s+src=["']\\/?${escaped}(?:\\?[^"']*)?["']><\\/script>`, 'gi'), '');
}

const tags = files.map(file => `<script src="/${file}?v=8"></script>`).join('\n');
if (!html.includes('</body>')) throw new Error('index.html has no </body>');
html = html.replace('</body>', `${tags}\n</body>`);

await writeFile(path, html, 'utf8');
console.log(`Injected ${files.length} fishing-map analysis scripts into ${path}`);
