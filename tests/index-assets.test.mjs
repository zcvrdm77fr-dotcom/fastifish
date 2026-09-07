// Etusivun tyylit ja logiikka olivat aiemmin yhtenä 7 700 rivin index.html-tiedostona.
// Nämä testit estävät monoliittia palaamasta takaisin.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const index = read('index.html');
const lines = (text) => text.split('\n').length;

// Pieniä bootstrap-lohkoja (teema ennen ensimmäistä piirtoa, service worker, JSON-LD)
// on perusteltua pitää inlinenä. Raja on siinä, missä lohkosta tulee moduuli.
const MAX_INLINE_BLOCK_LINES = 60;
const MAX_INDEX_LINES = 1500;

test('index.html loads its styles and logic from separate files', () => {
  assert.match(index, /<link\s+rel=["']stylesheet["']\s+href=["']\/app\.css["']/);
  assert.match(index, /<script\s+src=["']\/app\.js["']><\/script>/);
  assert.ok(fs.existsSync(new URL('../app.css', import.meta.url)), 'app.css puuttuu');
  assert.ok(fs.existsSync(new URL('../app.js', import.meta.url)), 'app.js puuttuu');
});

test('index.html stays a page, not an application bundle', () => {
  assert.ok(
    lines(index) < MAX_INDEX_LINES,
    `index.html on ${lines(index)} riviä (raja ${MAX_INDEX_LINES}). Irrota uusi koodi omaan tiedostoonsa.`
  );
});

test('no oversized inline style or script block creeps back in', () => {
  const blocks = [
    ...index.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi),
    ...index.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/gi)
  ];
  for (const block of blocks) {
    assert.ok(
      lines(block[1]) <= MAX_INLINE_BLOCK_LINES,
      `index.html sisältää ${lines(block[1])} rivin inline-lohkon (raja ${MAX_INLINE_BLOCK_LINES})`
    );
  }
});

test('extracted assets actually carry the page logic', () => {
  const js = read('app.js');
  const css = read('app.css');
  assert.ok(lines(js) > 1000, `app.js on odottamattoman ohut (${lines(js)} riviä)`);
  assert.ok(lines(css) > 500, `app.css on odottamattoman ohut (${lines(css)} riviä)`);
  // Irrotettu lohko on tavallinen skripti, ei moduuli: myöhemmin ladattavat
  // karttaskriptit ja HTML:n inline-käsittelijät luottavat sen globaaleihin.
  assert.doesNotMatch(index, /<script\s+type=["']module["']\s+src=["']\/app\.js["']/);
});

test('app.js loads before the fishing map analysis scripts that depend on it', () => {
  const appAt = index.indexOf('src="/app.js"');
  const firstAnalysisAt = index.indexOf('src="/fishing-structures.js');
  assert.ok(appAt > 0 && firstAnalysisAt > 0);
  assert.ok(appAt < firstAnalysisAt, 'app.js pitää ladata ennen analyysiskriptejä');
});

test('service worker precaches the extracted assets', () => {
  const sw = read('sw.js');
  assert.match(sw, /'\/app\.css'/);
  assert.match(sw, /'\/app\.js'/);
});
