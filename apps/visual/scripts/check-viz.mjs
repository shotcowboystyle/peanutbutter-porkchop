#!/usr/bin/env node
// Contract check for every viz in public/viz/index.js. Same rules as the studio's
// Diagnostics panel (public/studio/validate.js), runnable in node for CI. Exit 1 on errors.
import { readFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const { VIZ, MANIFEST, slug } = await import(join(root, 'viz', 'index.js'));
const { validateViz } = await import(join(root, 'studio', 'validate.js'));

let errors = 0,
  warnings = 0;
const report = (name, items) => {
  for (const { level, msg } of items) {
    level === 'error' ? errors++ : warnings++;
    console.log(`${level === 'error' ? '✖' : '▲'} ${name}: ${msg}`);
  }
};

// registry
const slugs = VIZ.map(slug);
for (const s of new Set(slugs.filter((x, i) => slugs.indexOf(x) !== i)))
  report('index.js', [{ level: 'error', msg: `duplicate slug "${s}"` }]);
if (new Set(MANIFEST).size !== MANIFEST.length)
  report('index.js', [{ level: 'error', msg: 'duplicate entry in MANIFEST' }]);
for (const name of MANIFEST)
  await access(join(root, 'viz', `${name}.js`)).catch(() =>
    report('index.js', [{ level: 'error', msg: `MANIFEST entry "${name}" has no file` }])
  );

// each viz
for (const v of VIZ) {
  const text = v.shader ? v.frag : await readFile(join(root, 'viz', v.file), 'utf8');
  const items = validateViz(v, text);
  if (!(v.params && Object.keys(v.params).length))
    items.push({ level: 'warn', msg: 'no params: nothing to tweak in the studio' });
  if (!(v.presets && Object.keys(v.presets).length))
    items.push({ level: 'warn', msg: 'no presets' });
  if (!(v.notes && v.notes.length))
    items.push({ level: 'warn', msg: 'no notes: Learn panel will be empty' });
  report(v.file, items);
}

// learn primers referenced by the studio exist
const studio = await readFile(join(root, 'studio', 'studio.js'), 'utf8');
for (const m of studio.matchAll(/\['(\d\d-[\w-]+\.md)'/g))
  await access(join(root, 'studio', 'learn', m[1])).catch(() =>
    report('studio.js', [{ level: 'error', msg: `primer ${m[1]} missing` }])
  );

console.log(`\n${VIZ.length} vizes · ${errors} error(s) · ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
