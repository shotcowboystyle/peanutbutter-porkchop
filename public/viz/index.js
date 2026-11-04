// The one registry. Order here is the order on the site (keys 1-9, 0) and in the studio.
// `pnpm new:viz <name>` appends to this list.
export const MANIFEST = [
  'hex',
  'mandala',
  'aizawa',
  'toric',
  'triangles',
  'colors',
  'curves',
  'candywarp',
  'atan2',
  'plasma',
];

export const slug = (v) => v.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** @type {import('../shader.js').Viz[]} */
export const VIZ = await Promise.all(MANIFEST.map(async (name) => {
  const v = (await import(`./${name}.js`)).default;
  v.file = `${name}.js`;
  return v;
}));

export const bySlug = (s) => VIZ.find((v) => slug(v) === s);
