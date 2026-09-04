import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const htmlFiles = fs.readdirSync(root).filter((file) => file.endsWith('.html')).sort();
const indexableHtmlFiles = htmlFiles.filter((file) => file !== '404.html');
const failures = [];
const canonicals = new Map();
const titles = new Map();
const descriptions = new Map();

function fail(file, message) {
  failures.push(`${file}: ${message}`);
}

function matches(source, pattern) {
  return [...source.matchAll(pattern)];
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

function checkInternalLinks(file, html) {
  const markupOnly = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');

  const ids = matches(markupOnly, /\sid=["']([^"']+)["']/gi).map((match) => match[1]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicates.length) fail(file, `samat id:t useasti: ${duplicates.join(', ')}`);

  for (const link of matches(markupOnly, /<a\b[^>]*\shref=["']([^"']+)["']/gi).map((match) => match[1])) {
    if (/^(?:https?:|mailto:|tel:|#)/i.test(link)) continue;
    const local = link.split('#')[0].split('?')[0];
    if (!local || local === '/') continue;
    const target = path.join(root, local.replace(/^\//, ''));
    if (!fs.existsSync(target)) fail(file, `sisäinen linkki ei löydy: ${link}`);
  }
}

function checkImageAlt(file, source) {
  for (const image of matches(source, /<img\b[^>]*>/gi).map((match) => match[0])) {
    if (!/\balt\s*=\s*["'][^"']+["']/i.test(image)) fail(file, `kuvalta puuttuu kuvaava alt-teksti: ${image.slice(0, 100)}`);
  }
}

for (const file of indexableHtmlFiles) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["'][^>]*>/i)?.[1];
  const h1s = matches(html, /<h1\b[^>]*>[\s\S]*?<\/h1>/gi);
  const mains = matches(html, /<main\b[^>]*>/gi);
  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/i)?.[1];

  if (!title) fail(file, 'title puuttuu');
  if (title && titles.has(title)) fail(file, `title on sama kuin tiedostolla ${titles.get(title)}`);
  if (title) titles.set(title, file);
  if (!description || description.length < 40) fail(file, 'meta description puuttuu tai on liian lyhyt');
  if (description && descriptions.has(description)) fail(file, `meta description on sama kuin tiedostolla ${descriptions.get(description)}`);
  if (description) descriptions.set(description, file);
  if (h1s.length !== 1) fail(file, `h1-elementtejä ${h1s.length}, odotettiin 1`);
  if (mains.length !== 1) fail(file, `main-elementtejä ${mains.length}, odotettiin 1`);
  if (!canonical) fail(file, 'canonical puuttuu');
  if (canonical && !canonical.startsWith('https://fastfishin.com/')) fail(file, `canonical käyttää väärää hostia: ${canonical}`);
  if (canonical && canonicals.has(canonical)) fail(file, `canonical on sama kuin tiedostolla ${canonicals.get(canonical)}`);
  if (canonical) canonicals.set(canonical, file);
  if (!/<meta\s+name=["']author["']/i.test(html)) fail(file, 'author-meta puuttuu');
  if (!/<link\s+rel=["']icon["'][^>]+href=["']\/favicon\.ico["']/i.test(html)) fail(file, 'favicon-linkki puuttuu');
  if (!/<link\s+rel=["']apple-touch-icon["'][^>]+href=["']\/apple-touch-icon\.png["']/i.test(html)) fail(file, 'apple-touch-icon puuttuu');
  if (!/<meta\s+property=["']og:image["']\s+content=["']https:\/\/fastfishin\.com\/og-image\.png["']/i.test(html)) fail(file, 'Open Graph -kuva puuttuu');
  if (!/<meta\s+name=["']twitter:card["']\s+content=["']summary_large_image["']/i.test(html)) fail(file, 'Twitter/X large image -kortti puuttuu');
  if (!/<meta\s+name=["']twitter:image["']\s+content=["']https:\/\/fastfishin\.com\/og-image\.png["']/i.test(html)) fail(file, 'Twitter/X-kuva puuttuu');
  if (!/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-7506133239289138/i.test(html)) fail(file, 'AdSense-tarkistuskoodi puuttuu tai publisher ID ei täsmää');
  if (visibleWords(html) < 200) fail(file, `näkyvää sisältöä vain ${visibleWords(html)} sanaa`);

  if (file === 'index.html') {
    if (!/"@type"\s*:\s*"Organization"/i.test(html)) fail(file, 'Organization-skeema puuttuu');
    if (!/<link\s+rel=["']alternate["'][^>]+href=["']\/llms\.txt["']/i.test(html)) fail(file, 'llms.txt discovery -linkki puuttuu');
  } else {
    if (!/"@type"\s*:\s*"BreadcrumbList"/i.test(html)) fail(file, 'BreadcrumbList-skeema puuttuu');
    if (!/<nav\s+class=["']crumb["']\s+aria-label=["']Murupolku["']/i.test(html)) fail(file, 'semanttinen murupolku puuttuu');
  }

  checkInternalLinks(file, html);
  checkImageAlt(file, html);

  for (const script of matches(html, /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(script[1]); } catch (error) { fail(file, `rikkinäinen JSON-LD: ${error.message}`); }
  }
}

const notFound = fs.readFileSync(path.join(root, '404.html'), 'utf8');
if (!/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(notFound)) fail('404.html', 'noindex puuttuu');
if (/<link\s+rel=["']canonical["']/i.test(notFound)) fail('404.html', '404-sivulla ei pidä olla canonicalia');
if (!/<main\b/i.test(notFound) || !/<h1\b/i.test(notFound)) fail('404.html', 'main tai h1 puuttuu');
checkInternalLinks('404.html', notFound);
checkImageAlt('404.html', notFound);

for (const file of fs.readdirSync(root).filter((file) => file.endsWith('.js')).sort()) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  try { new Function(source.replace(/^#!.*\n/, '')); } catch (error) {
    if (!/^\s*import\s/m.test(source) && !/^\s*export\s/m.test(source)) fail(file, `JavaScript-syntaksi: ${error.message}`);
  }
  checkImageAlt(file, source);
}

const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
for (const file of indexableHtmlFiles) {
  const url = file === 'index.html' ? 'https://fastfishin.com/' : `https://fastfishin.com/${file}`;
  if (!sitemap.includes(`<loc>${url}</loc>`)) fail('sitemap.xml', `${file} puuttuu sivukartasta`);
}
if (sitemap.includes('/404.html')) fail('sitemap.xml', '404-sivua ei pidä indeksoida');

const checkedTextFiles = [...indexableHtmlFiles, 'robots.txt', 'sitemap.xml', 'llms.txt'];
for (const file of checkedTextFiles) {
  if (fs.readFileSync(path.join(root, file), 'utf8').includes('https://www.fastfishin.com')) fail(file, 'vanha www-host löytyi');
}

const ads = fs.readFileSync(path.join(root, 'ads.txt'), 'utf8').trim();
if (ads !== 'google.com, pub-7506133239289138, DIRECT, f08c47fec0942fa0') fail('ads.txt', 'publisher-rivi ei täsmää odotettuun');

const llms = fs.readFileSync(path.join(root, 'llms.txt'), 'utf8');
for (const url of ['https://fastfishin.com/', 'https://fastfishin.com/kalastusoppaat.html', 'https://fastfishin.com/metodologia.html', 'https://fastfishin.com/toimitusperiaatteet.html']) {
  if (!llms.includes(url)) fail('llms.txt', `keskeinen lähde puuttuu: ${url}`);
}

const socialImage = fs.readFileSync(path.join(root, 'og-image.png'));
if (socialImage.readUInt32BE(16) !== 1200 || socialImage.readUInt32BE(20) !== 630) fail('og-image.png', 'koon pitää olla 1200 × 630');

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
if (Buffer.byteLength(index) > 160_000) fail('index.html', 'HTML sisältää edelleen liian suuren inline-bundlen');
if (!/<script\s+defer\s+src=["']\/app\.js\?v=\d+["']><\/script>/i.test(index)) fail('index.html', 'välimuistettava app.js puuttuu');
if (/\/(?:fishing|depth)-structures\.js|\/gtk-(?:substrate|habitats)\.js|\/velmu-fish\.js/i.test(index)) fail('index.html', 'kartta-analyysin skripti ladataan edelleen etukäteen');
if (!/MAP_ANALYSIS_SCRIPTS/.test(app) || !/ensureMapAnalysisModules/.test(app)) fail('app.js', 'kartta-analyysin lazy loading puuttuu');
const staticAssets = serviceWorker.match(/const STATIC_ASSETS\s*=\s*\[([\s\S]*?)\];/)?.[1] || '';
if (/(?:fishing|depth)-structures|gtk-(?:substrate|habitats)|velmu-fish|next-features|site-cleanup/.test(staticAssets)) fail('sw.js', 'valinnaista JavaScriptiä esiladataan edelleen service workerissa');

const sourceFiles = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'coverage', 'playwright-report', 'test-results'].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(absolute);
    else sourceFiles.push(absolute);
  }
}
collect(root);
for (const absolute of sourceFiles) {
  const relative = path.relative(root, absolute);
  if (/\.map$/i.test(relative)) fail(relative, 'tuotannon source map on kielletty');
  if (/\.(?:html|js|css)$/i.test(relative)) {
    const source = fs.readFileSync(absolute, 'utf8');
    if (/sourceMappingURL/i.test(source)) fail(relative, 'sourceMappingURL on kielletty tuotannossa');
    if (/\bplaceholder\s*=/i.test(source)) fail(relative, 'placeholder-teksti pitää korvata labelilla tai näkyvällä ohjeella');
    if (/\/@vite\/client|react-refresh|data-reactroot|__vite/i.test(source)) fail(relative, 'Vite/React-kehitysruntime näkyy selaimelle');
  }
}

if (failures.length) {
  console.error(`Sivuston validointi epäonnistui (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`OK: ${indexableHtmlFiles.length} indeksoitavaa sivua, mukautettu 404, metatiedot, murupolut, kuvat, llms.txt, sisäiset linkit ja tuotantoassetit tarkistettu.`);
