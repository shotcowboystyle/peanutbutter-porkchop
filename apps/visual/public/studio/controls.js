// Schema -> DOM. Native inputs only; one row per param, grouped by `group`.

const hex2 = (x) =>
  Math.round(Math.min(1, Math.max(0, x)) * 255)
    .toString(16)
    .padStart(2, '0');
const rgbToHex = (c) => `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}`;
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fmt = (d, v) => {
  if (d.type === 'color') return rgbToHex(v);
  if (typeof v === 'number')
    return Number.isInteger(d.step ?? 1) && d.type === 'int'
      ? String(v)
      : (+v.toFixed(4)).toString();
  return String(v);
};

/**
 * @param {HTMLElement} root
 * @param {import('../shader.js').Viz} viz
 * @param {Record<string, any>} params  live values; mutated in place
 * @param {{ onInput: (k: string, v: any) => void, onCommit: (k: string, v: any) => void }} cb
 *   onInput fires continuously (slider drag), onCommit once per gesture (for history / URL)
 */
export function buildControls(root, viz, params, { onInput, onCommit }) {
  root.replaceChildren();
  const defs = Object.entries(viz.params ?? {});
  const rows = new Map();
  if (!defs.length) {
    root.insertAdjacentHTML(
      'beforeend',
      '<div class="empty">This viz exposes no params yet. Add a <code>params</code> schema to its module.</div>'
    );
    return { refresh() {} };
  }

  const groups = new Map();
  for (const [k, d] of defs) {
    const g = d.group ?? 'Params';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push([k, d]);
  }

  for (const [g, list] of groups) {
    const h = document.createElement('h4');
    h.textContent = g;
    root.append(h);
    for (const [k, d] of list) root.append(row(k, d));
  }

  function row(k, d) {
    const el = document.createElement('div');
    el.className = 'row' + (d.live === false ? ' static' : '');
    el.title = d.doc ?? '';
    const label = document.createElement('label');
    const reset = document.createElement('button');
    reset.className = 'reset';
    reset.title = `Reset to ${fmt(d, d.default)}`;
    reset.addEventListener('click', () => set(d.default, true));
    label.append(reset, document.createTextNode(d.label ?? k));
    if (d.live === false)
      label.insertAdjacentHTML(
        'beforeend',
        ' <span class="cmp" title="Compile-time / rebuild on change">⟳</span>'
      );
    const val = document.createElement('span');
    val.className = 'val';
    el.append(label, val);

    let input, num;
    const set = (v, commit) => {
      params[k] = Array.isArray(v) ? [...v] : v;
      sync();
      (commit ? onCommit : onInput)(k, params[k]);
    };

    if (d.type === 'float' || d.type === 'int') {
      input = document.createElement('input');
      input.type = 'range';
      input.min = d.min;
      input.max = d.max;
      input.step = d.step ?? (d.type === 'int' ? 1 : (d.max - d.min) / 200);
      num = document.createElement('input');
      num.type = 'number';
      num.min = d.min;
      num.max = d.max;
      num.step = input.step;
      const coerce = (x) => {
        let n = Number(x);
        if (!Number.isFinite(n)) n = d.default;
        if (d.type === 'int') n = Math.round(n);
        return Math.min(d.max, Math.max(d.min, n));
      };
      input.addEventListener('input', () => set(coerce(input.value), false));
      input.addEventListener('change', () => set(coerce(input.value), true));
      num.addEventListener('change', () => set(coerce(num.value), true));
      el.replaceChild(num, val);
      el.append(input);
    } else if (d.type === 'bool') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.addEventListener('change', () => set(input.checked, true));
      el.replaceChild(input, val);
    } else if (d.type === 'color') {
      input = document.createElement('input');
      input.type = 'color';
      input.addEventListener('input', () => set(hexToRgb(input.value), false));
      input.addEventListener('change', () => set(hexToRgb(input.value), true));
      el.replaceChild(input, val);
    } else if (d.type === 'select') {
      input = document.createElement('select');
      for (const o of d.options) {
        const op = document.createElement('option');
        op.value = o;
        op.textContent = o;
        input.append(op);
      }
      input.addEventListener('change', () => set(input.value, true));
      el.replaceChild(input, val);
    }

    function sync() {
      const v = params[k];
      if (d.type === 'float' || d.type === 'int') {
        input.value = v;
        num.value = fmt(d, v);
      } else if (d.type === 'bool') input.checked = !!v;
      else if (d.type === 'color') input.value = rgbToHex(v);
      else input.value = v;
      el.classList.toggle('changed', !same(v, d.default));
    }
    sync();
    rows.set(k, sync);
    return el;
  }

  return {
    /** Re-read `params` into the inputs (after preset / undo / randomize). */
    refresh() {
      for (const s of rows.values()) s();
    },
  };
}

/** Random value inside a param's range. */
export function randomValue(d) {
  switch (d.type) {
    case 'float':
      return +(d.min + Math.random() * (d.max - d.min)).toFixed(4);
    case 'int':
      return Math.round(d.min + Math.random() * (d.max - d.min));
    case 'bool':
      return Math.random() < 0.5;
    case 'color':
      return [Math.random(), Math.random(), Math.random()].map((x) => +x.toFixed(3));
    case 'select':
      return d.options[Math.floor(Math.random() * d.options.length)];
  }
}
