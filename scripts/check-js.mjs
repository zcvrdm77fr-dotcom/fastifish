import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const files = fs.readdirSync(root)
  .filter(file => file.endsWith('.js'))
  .map(file => path.join(root, file));

for (const dir of ['scripts', 'tests', 'e2e']) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) continue;
  for (const file of fs.readdirSync(full)) {
    if (file.endsWith('.js') || file.endsWith('.mjs')) files.push(path.join(full, file));
  }
}

const failures = [];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${path.relative(root, file)}: ${(result.stderr || result.stdout).trim()}`);
}

if (failures.length) {
  console.error(`JavaScript-syntaksitarkistus epäonnistui (${failures.length}):\n${failures.join('\n\n')}`);
  process.exit(1);
}

console.log(`OK: ${files.length} JavaScript/ESM-tiedostoa läpäisi node --check -tarkistuksen.`);
