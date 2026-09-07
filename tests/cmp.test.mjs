import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

// Etusivun tyylit ja logiikka on irrotettu omiin tiedostoihinsa, joten sivun
// käyttäytymistä koskevat väitteet tarkistetaan HTML:n ja sen omien assettien
// yhdistelmästä. Muuten inline-lohkon poisto olisi hiljaa vesittänyt nämä testit.
const INDEX_ASSETS = ['app.js', 'app.css'];
const pageSource = (file) => (file === 'index.html' ? [file, ...INDEX_ASSETS] : [file]).map(read).join('\n');

const index = pageSource('index.html');
const privacy = read('tietosuoja.html');
const contentPagesJs = read('content-pages.js');
const htmlFiles = fs.readdirSync(root).filter((name) => name.endsWith('.html')).sort();
const publisherMeta = /<meta\s+name=["']google-adsense-account["']\s+content=["']ca-pub-7506133239289138["']\s*\/?\s*>/i;

test('Google-certified CMP owns ad and analytics consent on the main page', () => {
  assert.doesNotMatch(index, /id=["']consentBanner["']/);
  assert.doesNotMatch(index, /storage\.(?:getItem|setItem)\(['"]cookie_consent['"]\)/);
  assert.doesNotMatch(index, /gtag\(['"]consent['"],\s*['"]update['"]/);
  assert.match(index, /Google-certified CMP/);
  assert.match(index, /googlefc\.showRevocationMessage/);
  assert.match(index, /id=\"changeConsentBtn\"/);
});

test('browser geolocation is separate from advertising consent', () => {
  assert.match(index, /id=\"nearbyLocationBtn\"/);
  assert.match(index, /Käytä sijaintiani/);
  assert.match(index, /navigator\.permissions\?\.query/);
  assert.doesNotMatch(index, /cookie_consent[^\n]{0,120}geolocation|geolocation[^\n]{0,120}cookie_consent/);
});

test('privacy notice documents Google CMP and has no duplicate FastFishing banner', () => {
  assert.doesNotMatch(privacy, /id=["']cookieConsentBanner["']/);
  assert.doesNotMatch(privacy, /localStorage\.setItem\(['"]cookie_consent['"]/);
  assert.match(privacy, /Google-certified CMP, AdSense, Analytics/);
  assert.match(privacy, /IAB Europe Transparency &amp; Consent Framework \(TCF\)/);
  assert.match(privacy, /id=\"googlePrivacyChoicesBtn\"/);
  assert.match(privacy, /googlefc\.showRevocationMessage/);
});

test('every indexable HTML page carries the AdSense account declaration and no direct consent grant', () => {
  assert.ok(htmlFiles.length >= 15, `expected at least 15 HTML pages, found ${htmlFiles.length}`);
  for (const file of htmlFiles) {
    const html = read(file);
    const source = pageSource(file);
    assert.match(html, publisherMeta, `${file}: missing google-adsense-account meta`);
    assert.doesNotMatch(source, /gtag\(['"]consent['"],\s*['"]update['"]/, `${file}: direct consent update must not bypass the CMP`);
    if (file !== 'index.html' && file !== 'tietosuoja.html') {
      assert.doesNotMatch(source, /cookie_consent/, `${file}: legacy FastFishing consent state remains`);
      assert.doesNotMatch(source, /cookieConsentBanner/, `${file}: legacy FastFishing consent banner remains`);
    }
  }
});

test('shared content page JavaScript does not implement a second consent system', () => {
  assert.doesNotMatch(contentPagesJs, /cookie_consent|cookieConsentBanner|cookieAcceptBtn|cookieDeclineBtn/);
  assert.doesNotMatch(contentPagesJs, /gtag\(['"]consent['"],\s*['"]update['"]/);
});
