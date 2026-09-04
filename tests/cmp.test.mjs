import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const appJs = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const browserSource = `${index}\n${appJs}`;
const privacy = fs.readFileSync(new URL('../tietosuoja.html', import.meta.url), 'utf8');
const contentPagesJs = fs.readFileSync(new URL('../content-pages.js', import.meta.url), 'utf8');
const htmlFiles = fs.readdirSync(root).filter((name) => name.endsWith('.html')).sort();
const indexableHtmlFiles = htmlFiles.filter((name) => name !== '404.html');
const publisherMeta = /<meta\s+name=["']google-adsense-account["']\s+content=["']ca-pub-7506133239289138["']\s*\/?\s*>/i;

test('Google-certified CMP owns ad and analytics consent on the main page', () => {
  assert.doesNotMatch(index, /id=["']consentBanner["']/);
  assert.doesNotMatch(index, /storage\.(?:getItem|setItem)\(['"]cookie_consent['"]\)/);
  assert.doesNotMatch(index, /gtag\(['"]consent['"],\s*['"]update['"]/);
  assert.match(index, /Google-certified CMP/);
  assert.match(browserSource, /googlefc\.showRevocationMessage/);
  assert.match(browserSource, /id=\"changeConsentBtn\"/);
});

test('browser geolocation is separate from advertising consent', () => {
  assert.match(browserSource, /id=\"nearbyLocationBtn\"/);
  assert.match(browserSource, /Käytä sijaintiani/);
  assert.match(browserSource, /navigator\.permissions\?\.query/);
  assert.doesNotMatch(browserSource, /cookie_consent[^\n]{0,120}geolocation|geolocation[^\n]{0,120}cookie_consent/);
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
  assert.ok(indexableHtmlFiles.length >= 15, `expected at least 15 HTML pages, found ${indexableHtmlFiles.length}`);
  for (const file of indexableHtmlFiles) {
    const html = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(html, publisherMeta, `${file}: missing google-adsense-account meta`);
    assert.doesNotMatch(html, /gtag\(['"]consent['"],\s*['"]update['"]/, `${file}: direct consent update must not bypass the CMP`);
    if (file !== 'index.html' && file !== 'tietosuoja.html') {
      assert.doesNotMatch(html, /cookie_consent/, `${file}: legacy FastFishing consent state remains`);
      assert.doesNotMatch(html, /cookieConsentBanner/, `${file}: legacy FastFishing consent banner remains`);
    }
  }
});

test('shared content page JavaScript does not implement a second consent system', () => {
  assert.doesNotMatch(contentPagesJs, /cookie_consent|cookieConsentBanner|cookieAcceptBtn|cookieDeclineBtn/);
  assert.doesNotMatch(contentPagesJs, /gtag\(['"]consent['"],\s*['"]update['"]/);
});
