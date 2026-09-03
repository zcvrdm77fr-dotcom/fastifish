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
  // Poista vain vanha FastFishingin oma cookie_consent -> granted -silta.
  return html.replace(
    /\s*\(function\(\)\{\s*try\s*\{[\s\S]*?cookie_consent[\s\S]*?gtag\(['"]consent['"],\s*['"]update['"],[\s\S]*?analytics_storage[\s\S]*?granted[\s\S]*?catch\(e\)\s*\{\}\s*\}\)\(\);\s*/g,
    '\n'
  );
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
