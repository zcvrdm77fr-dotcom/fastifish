#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const inputPath = process.argv[2] || 'index.html';
const html = readFileSync(inputPath, 'utf8');
const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
const scripts = [...withoutComments.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(([, attrs]) => !/type=["']application\/ld\+json["']/i.test(attrs));

scripts.forEach((match, index) => {
  new vm.Script(match[2], { filename: `${inputPath}:inline-script-${index + 1}` });
});

console.log(`Checked ${scripts.length} inline scripts in ${inputPath}.`);
