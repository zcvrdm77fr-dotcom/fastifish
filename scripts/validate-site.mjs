import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const htmlFiles = fs.readdirSync(root).filter((file) => file.endsWith('.html')).sort();
const failures = [];
const canonicals = new Map();

function fail(file, message) {
  failures.push(`${file}: ${message}`);
}

function matches(html, pattern) {
  return [...html.matchAll(pattern)];
}

function visibleWords(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const markupOnly = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
  const titles = matches(html, /<title>[^<]+<\/title>/gi);
  const descriptions = matches(html, /<meta\s+name=["']description["'][^>]+>/gi);
  const h1s = matches(html, /<h1\b[^>]*>[\s\S]*?<\/h1>/gi);
  const mains = matches(html, /<main\b[^>]*>/gi);
  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/i)?.[1];

  if (titles.length !== 1) fail(file, `title-elementtejä ${titles.length}, odotettiin 1`);
  if (descriptions.length !== 1) fail(file, `meta description -elementtejä ${descriptions.length}, odotettiin 1`);
  if (h1s.length !== 1) fail(file, `h1-elementtejä ${h1s.length}, odotettiin 1`);
  if (mains.length !== 1) fail(file, `main-elementtejä ${mains.length}, odotettiin 1`);
  if (!canonical) fail(file, 'canonical puuttuu');
  if (canonical && !canonical.startsWith('https://fastfishin.com/')) fail(file, `canonical käyttää väärää hostia: ${canonical}`);
  if (canonical && canonicals.has(canonical)) fail(file, `canonical on sama kuin tiedostolla ${canonicals.get(canonical)}`);
  if (canonical) canonicals.set(canonical, file);
  if (!/<meta\s+name=["']author["']/i.test(html)) fail(file, 'author-meta puuttuu');
  if (!/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-7506133239289138/i.test(html)) fail(file, 'AdSense-tarkistuskoodi puuttuu tai publisher ID ei täsmää');
  if (visibleWords(html) < 200) fail(file, `näkyvää sisältöä vain ${visibleWords(html)} sanaa`);

  const ids = matches(markupOnly, /\sid=["']([^"']+)["']/gi).map((match) => match[1]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicates.length) fail(file, `samat id:t useasti: ${duplicates.join(', ')}`);

  for (const script of matches(html, /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(script[1]); } catch (error) { fail(file, `rikkinäinen JSON-LD: ${error.message}`); }
  }

  for (const link of matches(markupOnly, /<a\b[^>]*\shref=["']([^"']+)["']/gi).map((match) => match[1])) {
    if (/^(?:https?:|mailto:|tel:|#)/i.test(link)) continue;
    const local = link.split('#')[0].split('?')[0];
    if (!local || local === '/') continue;
    const target = path.join(root, local.replace(/^\//, ''));
    if (!fs.existsSync(target)) fail(file, `sisäinen linkki ei löydy: ${link}`);
  }
}

for (const file of fs.readdirSync(root).filter((file) => file.endsWith('.js')).sort()) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  try { new Function(source.replace(/^#!.*\n/, '')); } catch (error) {
    if (!/^\s*import\s/m.test(source) && !/^\s*export\s/m.test(source)) fail(file, `JavaScript-syntaksi: ${error.message}`);
  }
}

const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
for (const file of htmlFiles) {
  const url = file === 'index.html' ? 'https://fastfishin.com/' : `https://fastfishin.com/${file}`;
  if (!sitemap.includes(`<loc>${url}</loc>`)) fail('sitemap.xml', `${file} puuttuu sivukartasta`);
}

const checkedTextFiles = [...htmlFiles, 'robots.txt', 'sitemap.xml'];
for (const file of checkedTextFiles) {
  if (fs.readFileSync(path.join(root, file), 'utf8').includes('https://www.fastfishin.com')) {
    fail(file, 'vanha www-host löytyi');
  }
}

const ads = fs.readFileSync(path.join(root, 'ads.txt'), 'utf8').trim();
if (ads !== 'google.com, pub-7506133239289138, DIRECT, f08c47fec0942fa0') fail('ads.txt', 'publisher-rivi ei täsmää odotettuun');

if (failures.length) {
  console.error(`Sivuston validointi epäonnistui (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`OK: ${htmlFiles.length} HTML-sivua, canonicalit, metatiedot, JSON-LD, sisäiset linkit, sitemap ja ads.txt tarkistettu.`);
