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

function removeLegacyConsentGrant(html) {
  // Vanhoilla sisältösivuilla oli oma cookie_consent=all -> granted -silta.
  // Poistetaan koko IIFE täsmällisten alku- ja loppumerkkien avulla.
  const startMarker = "  (function(){\n    try {\n      var m = document.cookie.match(/(?:^|; )cookie_consent=([^;]*)/);";
  const endMarker = '  })();';
  let out = html;
  while (out.includes(startMarker)) {
    const start = out.indexOf(startMarker);
    const end = out.indexOf(endMarker, start);
    if (end < 0) throw new Error('Legacy consent block start found without end marker');
    out = out.slice(0, start) + out.slice(end + endMarker.length);
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
    html = removeLegacyConsentGrant(html);
  }
  html = canonicalizeHomeLinks(html);

  if (/gtag\(['"]consent['"],\s*['"]update['"]/.test(html)) {
    throw new Error(`${file}: legacy direct consent update remains`);
  }
  if (file !== 'index.html' && file !== 'tietosuoja.html' && html.includes('cookie_consent')) {
    throw new Error(`${file}: legacy cookie_consent state remains`);
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
