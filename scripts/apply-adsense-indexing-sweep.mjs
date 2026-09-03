import fs from 'node:fs';

const publisherMeta = '<meta name="google-adsense-account" content="ca-pub-7506133239289138">';
const analyticsId = 'G-WENSSGS6RJ';
const htmlFiles = fs.readdirSync('.')
  .filter((name) => name.endsWith('.html'))
  .sort();

const standardGoogleTag = `<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'analytics_storage': 'denied',
    'wait_for_update': 500
  });
  gtag('js', new Date());
  gtag('config', '${analyticsId}', { 'anonymize_ip': true });
</script>
`;

function addPublisherMeta(html, file) {
  if (html.includes('name="google-adsense-account"')) return html;
  const viewport = /(<meta name="viewport"[^>]*>)/i;
  if (!viewport.test(html)) throw new Error(`${file}: viewport meta not found`);
  return html.replace(viewport, `$1\n${publisherMeta}`);
}

function removeLegacyBanner(html) {
  let out = html;
  while (out.includes('id="cookieConsentBanner"')) {
    const start = out.lastIndexOf('<div', out.indexOf('id="cookieConsentBanner"'));
    const scriptStart = out.indexOf('<script', start);
    const scriptEnd = out.indexOf('</script>', scriptStart);
    if (start < 0 || scriptStart < 0 || scriptEnd < 0) {
      throw new Error('Could not delimit legacy cookieConsentBanner block');
    }
    out = out.slice(0, start) + out.slice(scriptEnd + '</script>'.length);
  }
  return out;
}

function standardizeGoogleConsent(html, file) {
  let foundConsentBlock = false;
  let out = html.replace(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi, (whole, body) => {
    const isGoogleConsentBlock = /gtag\s*\(/.test(body) && /consent/.test(body) && /default/.test(body) &&
      (body.includes(analyticsId) || body.includes('cookie_consent'));
    if (!isGoogleConsentBlock) return whole;
    foundConsentBlock = true;
    return '';
  });

  if (!foundConsentBlock && !out.includes(analyticsId)) return out;

  const externalTag = new RegExp(`<script[^>]+src=["']https://www\\.googletagmanager\\.com/gtag/js\\?id=${analyticsId}["'][^>]*><\\/script>`, 'i');
  if (!externalTag.test(out)) throw new Error(`${file}: external Google tag not found`);
  out = out.replace(externalTag, (tag) => `${standardGoogleTag}${tag}`);
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
    html = removeLegacyBanner(html);
    html = standardizeGoogleConsent(html, file);
  }
  html = canonicalizeHomeLinks(html);

  if (/gtag\(['"]consent['"],\s*['"]update['"]/.test(html)) {
    throw new Error(`${file}: legacy direct consent update remains`);
  }
  if (file !== 'index.html' && file !== 'tietosuoja.html' && html.includes('cookie_consent')) {
    throw new Error(`${file}: legacy cookie_consent state remains`);
  }
  if (file !== 'index.html' && file !== 'tietosuoja.html' && html.includes('cookieConsentBanner')) {
    throw new Error(`${file}: legacy cookie consent banner remains`);
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
