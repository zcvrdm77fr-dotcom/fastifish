import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const htmlFiles = fs.readdirSync(root).filter((name) => name.endsWith('.html')).sort();
const sitemap = fs.readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8');
const robots = fs.readFileSync(new URL('../robots.txt', import.meta.url), 'utf8');
const adsTxt = fs.readFileSync(new URL('../ads.txt', import.meta.url), 'utf8');
const sitemapUrls = new Set([...sitemap.matchAll(/<loc>(https:\/\/fastfishin\.com\/[^<]*)<\/loc>/g)].map((m) => m[1]));

test('robots and ads.txt expose the expected discovery and publisher records', () => {
  assert.match(robots, /^User-agent:\s*\*/m);
  assert.match(robots, /^Allow:\s*\/$/m);
  assert.match(robots, /^Sitemap:\s*https:\/\/fastfishin\.com\/sitemap\.xml$/m);
  assert.match(adsTxt, /^google\.com, pub-7506133239289138, DIRECT, f08c47fec0942fa0$/m);
});

test('sitemap covers every canonical HTML page without a duplicate index.html homepage', () => {
  assert.ok(sitemapUrls.size >= 15, `expected at least 15 sitemap URLs, found ${sitemapUrls.size}`);
  assert.ok(sitemapUrls.has('https://fastfishin.com/'));
  assert.ok(!sitemapUrls.has('https://fastfishin.com/index.html'));

  for (const file of htmlFiles) {
    const html = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["'](https:\/\/fastfishin\.com\/[^"']*)["'][^>]*>/i)?.[1];
    assert.ok(canonical, `${file}: absolute canonical missing`);
    assert.ok(sitemapUrls.has(canonical), `${file}: canonical ${canonical} missing from sitemap`);
    assert.match(html, /<meta\s+name=["']robots["']\s+content=["'][^"']*index[^"']*follow[^"']*["'][^>]*>/i, `${file}: index,follow robots meta missing`);
    assert.match(html, /<title>[^<]{8,}<\/title>/i, `${file}: useful title missing`);
    assert.match(html, /<meta\s+name=["']description["']\s+content=["'][^"']{40,}["'][^>]*>/i, `${file}: useful meta description missing`);
    assert.doesNotMatch(html, /href=["'](?:\.\/)?index\.html(?:[#?][^"']*)?["']/i, `${file}: internal link still splits homepage signals to index.html`);

    if (/id=["']themeToggle(?:Fab)?["']/.test(html)) {
      const hasThemeHandler = html.includes('content-pages.js') ||
        html.includes('static-theme.js') ||
        /getElementById\(['"]themeToggle(?:Fab)?['"]\)/.test(html);
      assert.ok(hasThemeHandler, `${file}: theme toggle has no JavaScript handler`);
    }
  }
});
