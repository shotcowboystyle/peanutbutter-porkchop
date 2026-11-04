#!/usr/bin/env node
// Scaffold a viz: pnpm new:viz <name> [--type shader|three|canvas]
import { readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--'));
const type = args.includes('--type') ? args[args.indexOf('--type') + 1] : 'shader';
if (!name || !/^[a-z][a-z0-9-]*$/.test(name) || !['shader', 'three', 'canvas'].includes(type)) {
  console.error('usage: pnpm new:viz <kebab-name> [--type shader|three|canvas]');
  process.exit(2);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'public', 'viz', `${name}.js`);
await access(dest).then(() => { console.error(`${dest} already exists`); process.exit(1); }, () => {});

const title = name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const tpl = await readFile(join(root, 'templates', `viz.${type}.js`), 'utf8');
await writeFile(dest, tpl.replaceAll('__TITLE__', title));

const indexPath = join(root, 'public', 'viz', 'index.js');
const index = await readFile(indexPath, 'utf8');
if (!index.includes(`'${name}'`)) await writeFile(indexPath, index.replace(/(\n\];)/, `\n  '${name}',$1`));

console.log(`created public/viz/${name}.js (${type}) and registered it.\n  pnpm dev  →  http://localhost:8787/studio/#${name}`);
