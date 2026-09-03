import fs from 'node:fs';

const publisherMeta = '<meta name="google-adsense-account" content="ca-pub-7506133239289138">';
const htmlFiles = fs.readdirSync('.')
  .filter((name) => name.endsWith('.html'))
  .sort();

function addPublisherMeta(html, file) {
  if (html.includes('name="google-adsense-account"')) return html;
  const viewport = /(<meta name="viewport"[^>]*>)/i;
  if (!viewport.test(html)) throw new Error(`${file}: viewport meta not found`);
  return html.replace(viewport, `$1\n${publisherMeta}`);
}

function removeLegacyConsentGrant(html, file) {
  let out = html;
  while (out.includes('cookie_consent')) {
    const marker = out.indexOf('cookie_consent');
    const compactStart = out.lastIndexOf('(function(){', marker);
    const spacedStart = out.lastIndexOf('(function () {', marker);
    const start = Math.max(compactStart, spacedStart);
    const end = out.indexOf('})();', marker);
    if (start < 0 || end < 0) break;

    const block = out.slice(start, end + 5);
    if (!/gtag\(['"]consent['"],\s*['"]update['"]/.test(block)) break;

    out = out.slice(0, start) + out.slice(end + 5);
  }

  if (/gtag\(['"]consent['"],\s*['"]update['"]/.test(out)) {
    throw new Error(`${file}: legacy direct consent update remains`);
  }
  if (out.includes('cookie_consent')) {
    throw new Error(`${file}: legacy cookie_consent state remains`);
  }
  return out;
}

function canonicalizeHomeLinks(html) {
  return html
    .replace(/href=(['"])index\.html([^'"]*)\1/g, (_m, quote, suffix) => `href=${quote}/${suffix}${quote}`)
    .replace(/href=(['"])\.\/index\.html([^'"]*)\1/g, (_m, quote, suffix) => `href=${quote}/${suffix}${quote}`);
}

for (const file of htmlFiles) {
  let html = fs.readFileSync(file, 'utf8');
  html = addPublisherMeta(html, file);
  if (file !== 'index.html' && file !== 'tietosuoja.html') {
    html = removeLegacyConsentGrant(html, file);
  }
  html = canonicalizeHomeLinks(html);

  if (/gtag\(['"]consent['"],\s*['"]update['"]/.test(html)) {
    throw new Error(`${file}: legacy direct consent update remains`);
  }
  fs.writeFileSync(file, html);
}

let sitemap = fs.readFileSync('sitemap.xml', 'utf8');
sitemap = sitemap.replace(
  /(<loc>https:\/\/fastfishin\.com\/tietosuoja\.html<\/loc>\s*<lastmod>)2026-09-02(<\/lastmod>)/,
  '$12026-09-03$2'
);
fs.writeFileSync('sitemap.xml', sitemap);

console.log(`Patched ${htmlFiles.length} HTML files for Google CMP, AdSense ownership and canonical home links.`);
