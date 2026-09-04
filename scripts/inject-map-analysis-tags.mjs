#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';

const path = process.argv[2] || 'app.js';
let source = await readFile(path, 'utf8');

// Keep every lazily loaded map-analysis module on the same cache version.
const version = 13;
const files = [
  'fishing-structures.js',
  'depth-structures.js',
  'gtk-substrate.js',
  'gtk-habitats.js',
  'velmu-fish.js'
];

const manifestPattern = /const MAP_ANALYSIS_SCRIPTS = \[[\s\S]*?\n\];/;
if (!manifestPattern.test(source)) throw new Error(`${path} has no MAP_ANALYSIS_SCRIPTS manifest`);

const manifest = [
  'const MAP_ANALYSIS_SCRIPTS = [',
  ...files.map(file => `  '/${file}?v=${version}',`),
  '];'
].join('\n');
source = source.replace(manifestPattern, manifest);

await writeFile(path, source, 'utf8');
console.log(`Updated ${files.length} lazy map-analysis modules (v${version}) in ${path}`);
