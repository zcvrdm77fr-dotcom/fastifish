import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const planner = fs.readFileSync(new URL('../kalareissun-suunnittelu.html', import.meta.url), 'utf8');
const hub = fs.readFileSync(new URL('../kalastusoppaat.html', import.meta.url), 'utf8');
const qualityJs = fs.readFileSync(new URL('../adsense-quality.js', import.meta.url), 'utf8');
const qualityCss = fs.readFileSync(new URL('../adsense-quality.css', import.meta.url), 'utf8');
const about = fs.readFileSync(new URL('../tietoa-meista.html', import.meta.url), 'utf8');
const methodology = fs.readFileSync(new URL('../metodologia.html', import.meta.url), 'utf8');
const contentPagesJs = fs.readFileSync(new URL('../content-pages.js', import.meta.url), 'utf8');

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

test('trip planning guide provides a distinct FastFishing workflow rather than another keyword clone', () => {
  const text = visibleText(planner);
  assert.ok(text.length > 7000, `planning guide visible text is unexpectedly thin (${text.length} chars)`);
  for (const id of ['idea', 'kymmenen', 'muuta', 'esimerkit', 'kartta', 'rajat', 'paivakirja']) {
    assert.match(planner, new RegExp(`id=["']${id}["']`), `planning guide section #${id} missing`);
  }
  assert.match(planner, /hypoteettisia esimerkkejä/i);
  assert.match(planner, /60 sekunnin reissumuistiinpano/i);
  assert.match(planner, /Mitä FastFishing ei tiedä/i);
  assert.match(planner, /paikka A/i);
  assert.match(planner, /paikka B/i);
  assert.doesNotMatch(planner, /utm_medium=affiliate|adtraction|kaupallinen yhteistyö/i);
});

test('guide hub makes the planning workflow a first-class internal destination', () => {
  assert.match(hub, /href=["']kalareissun-suunnittelu\.html["']/i);
  assert.match(hub, /10 minuutin reissusuunnitelma/i);
  assert.match(hub, /Tavoitteena ei ole julkaista mahdollisimman monta lähes samanlaista sivua/i);
});

test('commercial affiliate promo is suspended while editorial content is being strengthened', () => {
  assert.match(qualityJs, /suspendAffiliatePromoDuringReview/);
  assert.match(qualityJs, /gearPromoGrid/);
  assert.match(qualityCss, /#gearPromoGrid\{display:none!important\}/);
  assert.match(about, /affiliate-tuoteruudukko on tällä hetkellä pois käytöstä/i);
  assert.match(qualityJs, /kalareissun-suunnittelu\.html/);
});

test('methodology is accurate in static HTML without relying on a runtime correction', () => {
  assert.match(methodology, /id=["']kalibrointi["']/i);
  assert.match(methodology, /Raakapiste on siis <strong>92<\/strong>, joka näkyy kalibroidulla asteikolla noin <strong>84\/100<\/strong>/i);
  assert.match(methodology, /Teoreettinen raakapiste 100 näkyy nykyisessä näkymässä noin 91\/100/i);
  assert.match(methodology, /dateModified["']:\s*["']2026-09-03["']/i);
  assert.doesNotMatch(contentPagesJs, /Lopputulos on siis|scoreCalibrationNote|metodologia\.html/);
});
