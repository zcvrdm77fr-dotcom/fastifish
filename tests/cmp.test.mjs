import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const privacy = fs.readFileSync(new URL('../tietosuoja.html', import.meta.url), 'utf8');

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
