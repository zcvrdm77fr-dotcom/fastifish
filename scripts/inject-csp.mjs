#!/usr/bin/env node

// Kirjoittaa csp.js:n politiikan jokaisen HTML-sivun <head>-osaan. GitHub Pages ei
// salli omia HTTP-otsakkeita, joten staattiset sivut kantavat CSP:n meta-tagissa.
// Aja tämä aina kun csp.js muuttuu; quality-workflow tarkistaa että tagit ovat ajan tasalla.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { PAGE_CSP } from '../csp.js';

const MARKER = 'http-equiv="Content-Security-Policy"';
const TAG = `<meta ${MARKER} content="${PAGE_CSP}">`;
const EXISTING = /[ \t]*<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>\r?\n?/gi;

const root = process.cwd();
const files = process.argv.length > 2
  ? process.argv.slice(2)
  : (await readdir(root)).filter(file => file.endsWith('.html')).sort();

let changed = 0;
for (const file of files) {
  const full = path.join(root, file);
  const original = await readFile(full, 'utf8');
  const stripped = original.replace(EXISTING, '');

  const charset = stripped.match(/<meta\s+charset=[^>]*>/i);
  if (!charset) throw new Error(`${file}: <meta charset> puuttuu, CSP:tä ei voi sijoittaa.`);

  const at = stripped.indexOf(charset[0]) + charset[0].length;
  const updated = `${stripped.slice(0, at)}\n${TAG}${stripped.slice(at)}`;

  if (updated !== original) {
    await writeFile(full, updated, 'utf8');
    changed += 1;
  }
}

console.log(`CSP-meta ajan tasalla ${files.length} HTML-sivulla (${changed} päivitetty).`);
