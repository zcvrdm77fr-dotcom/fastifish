import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const htmlFiles = fs.readdirSync(root).filter((name) => name.endsWith('.html')).sort();
const indexableHtmlFiles = htmlFiles.filter((name) => name !== '404.html');
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
  assert.ok(sitemapUrls.size >= 16, `expected at least 16 sitemap URLs, found ${sitemapUrls.size}`);
  assert.ok(sitemapUrls.has('https://fastfishin.com/'));
  assert.ok(sitemapUrls.has('https://fastfishin.com/kalareissun-suunnittelu.html'));
  assert.ok(!sitemapUrls.has('https://fastfishin.com/index.html'));

  for (const file of indexableHtmlFiles) {
    const html = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["'](https:\/\/fastfishin\.com\/[^"']*)["'][^>]*>/i)?.[1];
    assert.ok(canonical, `${file}: absolute canonical missing`);
    assert.ok(sitemapUrls.has(canonical), `${file}: canonical ${canonical} missing from sitemap`);
    assert.match(html, /<meta\s+name=["']robots["']\s+content=["'][^"']*index[^"']*follow[^"']*["'][^>]*>/i, `${file}: index,follow robots meta missing`);
    assert.match(html, /<title>[^<]{8,}<\/title>/i, `${file}: useful title missing`);
    assert.match(html, /<meta\s+name=["']description["']\s+content=["'][^"']{40,}["'][^>]*>/i, `${file}: useful meta description missing`);
    assert.match(html, /<link\s+rel=["']icon["'][^>]+href=["']\/favicon\.ico["']/i, `${file}: favicon missing`);
    assert.match(html, /<meta\s+property=["']og:image["']\s+content=["']https:\/\/fastfishin\.com\/og-image\.png["']/i, `${file}: social image missing`);
    assert.match(html, /<meta\s+name=["']twitter:card["']\s+content=["']summary_large_image["']/i, `${file}: large social card missing`);
    assert.doesNotMatch(html, /href=["'](?:\.\/)?index\.html(?:[#?][^"']*)?["']/i, `${file}: internal link still splits homepage signals to index.html`);

    if (file === 'index.html') {
      assert.match(html, /"@type"\s*:\s*"Organization"/i, 'index.html: accurate organization schema missing');
    } else {
      assert.match(html, /"@type"\s*:\s*"BreadcrumbList"/i, `${file}: BreadcrumbList schema missing`);
      assert.match(html, /<nav\s+class=["']crumb["']\s+aria-label=["']Murupolku["']/i, `${file}: semantic breadcrumb missing`);
    }

    if (/id=["']themeToggle(?:Fab)?["']/.test(html)) {
      const hasThemeHandler = html.includes('content-pages.js') ||
        html.includes('static-theme.js') ||
        /getElementById\(['"]themeToggle(?:Fab)?['"]\)/.test(html);
      assert.ok(hasThemeHandler, `${file}: theme toggle has no JavaScript handler`);
    }
  }
});

test('custom 404 is helpful and excluded from indexing', () => {
  const notFound = fs.readFileSync(new URL('../404.html', import.meta.url), 'utf8');
  assert.match(notFound, /<title>Sivua ei löytynyt \| FastFishing<\/title>/i);
  assert.match(notFound, /content=["'][^"']*noindex[^"']*nofollow/i);
  assert.match(notFound, /href=["']\/["']/i);
  assert.match(notFound, /href=["']\/kalastusoppaat\.html["']/i);
  assert.doesNotMatch(notFound, /rel=["']canonical["']/i);
  assert.ok(!sitemap.includes('/404.html'));
});

test('llms.txt exposes canonical product, methodology and editorial sources', () => {
  const llms = fs.readFileSync(new URL('../llms.txt', import.meta.url), 'utf8');
  assert.match(llms, /^# FastFishing$/m);
  assert.match(llms, /https:\/\/fastfishin\.com\/kalastusoppaat\.html/);
  assert.match(llms, /https:\/\/fastfishin\.com\/metodologia\.html/);
  assert.match(llms, /https:\/\/fastfishin\.com\/toimitusperiaatteet\.html/);
});

test('main application is cacheable and optional map analysis loads on demand', () => {
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const serviceWorker = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const staticAssets = serviceWorker.match(/const STATIC_ASSETS\s*=\s*\[([\s\S]*?)\];/)?.[1] || '';

  assert.ok(Buffer.byteLength(index) < 160_000, `index.html still contains a large inline bundle (${Buffer.byteLength(index)} bytes)`);
  assert.match(index, /<script\s+defer\s+src=["']\/app\.js\?v=\d+["']><\/script>/i);
  assert.doesNotMatch(index, /\/(?:fishing|depth)-structures\.js|\/gtk-(?:substrate|habitats)\.js|\/velmu-fish\.js/i);
  assert.match(app, /MAP_ANALYSIS_SCRIPTS/);
  assert.match(app, /ensureMapAnalysisModules/);
  assert.doesNotMatch(staticAssets, /(?:fishing|depth)-structures|gtk-(?:substrate|habitats)|velmu-fish|next-features|site-cleanup/);
});

test('production pages expose no placeholder, source map or Vite/React runtime markers', () => {
  for (const file of [...htmlFiles, ...fs.readdirSync(root).filter((name) => name.endsWith('.js'))]) {
    const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\bplaceholder\s*=/i, `${file}: placeholder text remains`);
    assert.doesNotMatch(source, /sourceMappingURL/i, `${file}: source map reference remains`);
    assert.doesNotMatch(source, /\/@vite\/client|react-refresh|data-reactroot|__vite/i, `${file}: development runtime marker remains`);
  }
  assert.equal(fs.readdirSync(root).some((name) => name.endsWith('.map')), false);
});
