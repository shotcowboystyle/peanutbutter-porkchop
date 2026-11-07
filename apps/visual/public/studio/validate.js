// Viz contract checks shared by `pnpm check` (node) and the studio's Diagnostics panel.
const TYPES = new Set(['float', 'int', 'bool', 'color', 'select']);

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isColor = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);

function checkValue(def, v) {
  switch (def.type) {
    case 'float':
    case 'int':
      if (!isNum(v)) return 'not a number';
      if (def.type === 'int' && !Number.isInteger(v)) return 'not an integer';
      if (isNum(def.min) && v < def.min) return `below min ${def.min}`;
      if (isNum(def.max) && v > def.max) return `above max ${def.max}`;
      return null;
    case 'bool':
      return typeof v === 'boolean' ? null : 'not a boolean';
    case 'color':
      return isColor(v) && v.every((c) => c >= 0 && c <= 1) ? null : 'not an [r,g,b] 0..1 triple';
    case 'select':
      return def.options?.includes(v) ? null : `not one of ${JSON.stringify(def.options)}`;
    default:
      return `unknown type ${def.type}`;
  }
}

/**
 * @param {import('../shader.js').Viz} v
 * @param {string} [source]  text that `notes[].find` should match (frag for shader vizes, the module otherwise)
 * @returns {{ level: 'error'|'warn', msg: string }[]}
 */
export function validateViz(v, source) {
  const out = [];
  const err = (msg) => out.push({ level: 'error', msg });
  const warn = (msg) => out.push({ level: 'warn', msg });

  if (typeof v?.title !== 'string' || !v.title.trim()) err('title must be a non-empty string');
  if (typeof v?.create !== 'function') err('create(canvas, params) must be a function');
  if (typeof v?.credit !== 'string') warn('credit missing');
  if (v?.dpr !== undefined && !(isNum(v.dpr) && v.dpr > 0)) err('dpr must be a positive number');
  if (!v?.about) warn('about (markdown) missing: the About panel will be empty');

  const params = v?.params ?? {};
  if (params && typeof params !== 'object') err('params must be an object');
  for (const [k, d] of Object.entries(params)) {
    if (!/^[A-Za-z_]\w*$/.test(k)) err(`param "${k}": not a valid GLSL/JS identifier`);
    if (!TYPES.has(d?.type)) {
      err(`param "${k}": type must be one of ${[...TYPES].join(', ')}`);
      continue;
    }
    const bad = checkValue(d, d.default);
    if (bad) err(`param "${k}": default ${JSON.stringify(d.default)} ${bad}`);
    if ((d.type === 'float' || d.type === 'int') && !(isNum(d.min) && isNum(d.max)))
      err(`param "${k}": float/int need numeric min and max`);
    if (isNum(d.min) && isNum(d.max) && d.min >= d.max) err(`param "${k}": min must be < max`);
    if (d.type === 'select' && !(Array.isArray(d.options) && d.options.length))
      err(`param "${k}": select needs options[]`);
    if (!d.doc) warn(`param "${k}": no doc (tooltip will be empty)`);
  }

  for (const [name, p] of Object.entries(v?.presets ?? {})) {
    if (!p || typeof p !== 'object') {
      err(`preset "${name}" must be an object`);
      continue;
    }
    for (const [k, val] of Object.entries(p)) {
      if (!params[k]) {
        err(`preset "${name}": unknown param "${k}"`);
        continue;
      }
      const bad = checkValue(params[k], val);
      if (bad) err(`preset "${name}": ${k}=${JSON.stringify(val)} ${bad}`);
    }
  }

  const lines = source?.split('\n');
  (v?.notes ?? []).forEach((n, i) => {
    if (!n?.title || !n?.body) err(`notes[${i}]: needs title and body`);
    if (n?.find !== undefined && n?.lines !== undefined)
      warn(`notes[${i}]: has both find and lines; find wins`);
    if (n?.find !== undefined && source !== undefined && !source.includes(n.find))
      err(`notes[${i}] "${n.title}": find text not in source: ${JSON.stringify(n.find)}`);
    if (
      n?.lines &&
      lines &&
      (n.lines[0] < 1 || n.lines[1] > lines.length || n.lines[0] > n.lines[1])
    )
      err(`notes[${i}]: lines ${n.lines} out of range 1..${lines.length}`);
    if (n?.find === undefined && n?.lines === undefined)
      warn(`notes[${i}] "${n?.title}": no find/lines anchor, cannot highlight source`);
  });

  if (v?.shader && typeof v.frag === 'string') {
    for (const [k, d] of Object.entries(params)) {
      if (v.jsUsed?.has(k)) continue; // consumed by the uniforms() callback in JS
      const re = new RegExp(`\\b${k}\\b`);
      if (!re.test(v.frag)) warn(`param "${k}" is never referenced in the fragment shader`);
      else if (d.live !== false && !new RegExp(`uniform\\s+\\w+\\s+${k}\\s*;`).test(v.frag))
        warn(`param "${k}": no matching "uniform <type> ${k};" declaration`);
    }
  }
  return out;
}

/** Resolve a note's anchor to a 1-based [from, to] line range in `source`, or null. */
export function noteRange(note, source) {
  if (note.find !== undefined) {
    const i = source.indexOf(note.find);
    if (i < 0) return null;
    const from = source.slice(0, i).split('\n').length;
    return [from, from + (note.span ?? 1) - 1];
  }
  return note.lines ?? null;
}
