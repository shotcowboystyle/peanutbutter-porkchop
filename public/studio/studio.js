// Studio: pick a viz, tweak its params live, read its source, learn how it works.
import { VIZ, slug, bySlug, MANIFEST } from '../viz/index.js';
import { defaults } from '../shader.js';
import { buildControls, randomValue } from './controls.js';
import { createSourcePanel } from './source.js';
import { validateViz } from './validate.js';
import { marked } from 'marked';

const $ = (id) => document.getElementById(id);
const studio = $('studio'), stage = $('stage'), stageWrap = $('stage-wrap'), stageError = $('stage-error');
const PRIMER = [
  ['01-fragment-shaders.md', 'Fragment shaders'],
  ['02-uv-and-resolution.md', 'UV & resolution'],
  ['03-time-and-uniforms.md', 'Time & uniforms'],
  ['04-shaping-functions.md', 'Shaping functions'],
  ['05-polar-and-rings.md', 'Polar & rings'],
  ['06-noise.md', 'Noise'],
  ['07-raymarching.md', 'Raymarching'],
  ['08-three-and-canvas.md', 'three.js & Canvas 2D'],
  ['09-make-your-own.md', 'Make your own'],
];

// ---------- state ----------
let viz = null, params = null, handle = null, canvas = null;
let playing = true, rate = 1, dprMode = 'auto', aspect = 'fill';
let token = 0, rebuildTimer = 0, urlTimer = 0;
let controls = { refresh() {} };
const hist = { past: [], future: [] };
const source = createSourcePanel($('panel-source'));

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const diff = () => Object.fromEntries(Object.entries(params).filter(([k, v]) => !same(v, viz.params[k].default)));
const dpr = () => (dprMode === 'auto' ? Math.min(devicePixelRatio || 1, viz?.dpr ?? 2) : Number(dprMode));

// ---------- URL state: #slug?p=<base64 json of non-default params>&t=<time> ----------
function readUrl() {
  const [s, q = ''] = location.hash.slice(1).split('?');
  const sp = new URLSearchParams(q);
  let p = {};
  try { if (sp.get('p')) p = JSON.parse(decodeURIComponent(escape(atob(sp.get('p'))))); } catch { /* malformed share link: ignore and use defaults */ }
  return { slug: s, p, t: Number(sp.get('t')) || 0 };
}
function writeUrl(now = false) {
  clearTimeout(urlTimer);
  const go = () => {
    const d = diff();
    const sp = new URLSearchParams();
    if (Object.keys(d).length) sp.set('p', btoa(unescape(encodeURIComponent(JSON.stringify(d)))));
    const q = sp.toString();
    history.replaceState(null, '', `#${slug(viz)}${q ? '?' + q : ''}`);
  };
  now ? go() : (urlTimer = setTimeout(go, 300));
}
function shareUrl() {
  const u = new URL(location.href);
  const [s, q = ''] = u.hash.slice(1).split('?');
  const sp = new URLSearchParams(q);
  sp.set('t', handle ? handle.time.toFixed(2) : '0');
  u.hash = `${s}?${sp}`;
  return u.href;
}

// ---------- stage sizing ----------
function sizeStage() {
  if (aspect === 'fill') { stage.style.width = '100%'; stage.style.height = '100%'; }
  else {
    const [a, b] = aspect.split('/').map(Number);
    const W = stageWrap.clientWidth, H = stageWrap.clientHeight;
    const w = Math.min(W, H * a / b), h = w * b / a;
    stage.style.width = `${Math.floor(w)}px`; stage.style.height = `${Math.floor(h)}px`;
  }
  if (!canvas) return;
  const d = dpr();
  canvas.width = Math.max(2, Math.round(stage.clientWidth * d));
  canvas.height = Math.max(2, Math.round(stage.clientHeight * d));
  handle?.resize(canvas.width, canvas.height);
  if (handle && !playing) handle.frame(handle.time);
}
new ResizeObserver(() => sizeStage()).observe(stageWrap);

// ---------- mount / unmount ----------
function unmount() {
  handle?.destroy();
  canvas?.remove();
  handle = canvas = null;
}

async function mount(v, { keepTime = false, startTime = 0 } = {}) {
  const my = ++token;
  const t = keepTime && handle ? handle.time : startTime;
  unmount();
  viz = v;
  stageError.hidden = true;
  canvas = document.createElement('canvas');
  stage.prepend(canvas);
  sizeStage();
  let h;
  try {
    h = await v.create(canvas, params);
  } catch (e) {
    if (my !== token) return;
    stageError.hidden = false;
    stageError.textContent = `${v.title} failed to create:\n\n${e.stack || e.message}`;
    refreshDiagnostics(e);
    return;
  }
  if (my !== token) { h.destroy(); return; }
  handle = h;
  handle.resize(canvas.width, canvas.height);
  handle.rate = rate;
  handle.time = t;
  playing ? handle.start() : handle.frame(t);
  source.load(v, handle);
  refreshDiagnostics();
}

// Full switch to another viz: new params (from URL or defaults), new controls, new panels.
async function select(v, { fromUrl = false } = {}) {
  const url = fromUrl ? readUrl() : { p: {}, t: 0 };
  params = Object.assign(defaults(v), fromUrl ? url.p : {});
  hist.past.length = hist.future.length = 0;
  lastCommitted = JSON.stringify(params);
  syncHistoryButtons();
  viz = v;
  document.title = `${v.title} · Studio`;
  $('top-title').textContent = v.title;
  const link = (v.credit.match(/https?:\/\/\S+/) || [])[0];
  $('top-credit').textContent = v.credit; $('top-credit').href = link ?? '#';
  $('btn-site').href = `/#${slug(v)}`;
  renderList();
  controls = buildControls($('params'), v, params, { onInput: onParam, onCommit: (k, val) => { onParam(k, val); commit(); } });
  renderPresets();
  renderAbout();
  renderNotes();
  writeUrl(true);
  await mount(v, { startTime: url.t });
}

// ---------- param changes ----------
function onParam(k) {
  const d = viz.params[k];
  if (d.live === false) {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => mount(viz, { keepTime: true }), 150);
  } else if (handle && !playing) handle.frame(handle.time);
  controls.refresh();
  $('preset').value = matchPreset() ?? '';
  writeUrl();
}
function snapshotParams() { return JSON.stringify(params); }
let lastCommitted = null;
function commit() {
  const now = snapshotParams();
  if (now === lastCommitted) return;
  if (lastCommitted !== null) hist.past.push(lastCommitted);
  if (hist.past.length > 100) hist.past.shift();
  hist.future.length = 0;
  lastCommitted = now;
  syncHistoryButtons();
}
function applyParams(next, { pushHistory = true } = {}) {
  const needsRebuild = Object.keys(viz.params).some((k) => viz.params[k].live === false && !same(params[k], next[k]));
  Object.assign(params, next);
  controls.refresh();
  $('preset').value = matchPreset() ?? '';
  if (needsRebuild) mount(viz, { keepTime: true });
  else if (handle && !playing) handle.frame(handle.time);
  writeUrl();
  if (pushHistory) commit();
}
function undo() {
  if (!hist.past.length) return;
  hist.future.push(snapshotParams());
  const s = hist.past.pop();
  lastCommitted = s;
  applyParams(JSON.parse(s), { pushHistory: false });
  syncHistoryButtons();
}
function redo() {
  if (!hist.future.length) return;
  hist.past.push(snapshotParams());
  const s = hist.future.pop();
  lastCommitted = s;
  applyParams(JSON.parse(s), { pushHistory: false });
  syncHistoryButtons();
}
function syncHistoryButtons() {
  $('btn-undo').disabled = !hist.past.length;
  $('btn-redo').disabled = !hist.future.length;
}

// ---------- presets ----------
const userKey = () => `studio:presets:${slug(viz)}`;
const userPresets = () => { try { return JSON.parse(localStorage.getItem(userKey()) || '{}'); } catch { return {}; } };
const allPresets = () => ({ ...(viz.presets ?? { Default: {} }), ...userPresets() });
function matchPreset() {
  const d = diff();
  for (const [name, p] of Object.entries(allPresets())) if (same(p, d)) return name;
  return null;
}
function renderPresets() {
  const sel = $('preset');
  sel.replaceChildren();
  const add = (label, group) => {
    const o = document.createElement('option'); o.value = label; o.textContent = label; group.append(o);
  };
  const built = document.createElement('optgroup'); built.label = 'Presets';
  for (const name of Object.keys(viz.presets ?? { Default: {} })) add(name, built);
  sel.append(built);
  const mine = Object.keys(userPresets());
  if (mine.length) {
    const g = document.createElement('optgroup'); g.label = 'Mine';
    for (const name of mine) add(name, g);
    sel.append(g);
  }
  const custom = document.createElement('option'); custom.value = ''; custom.textContent = '(custom)'; custom.hidden = true;
  sel.append(custom);
  sel.value = matchPreset() ?? '';
}
$('preset').addEventListener('change', (e) => {
  const p = allPresets()[e.target.value];
  if (p) applyParams({ ...defaults(viz), ...p });
});
$('btn-save').addEventListener('click', () => { const i = $('preset-name'); i.hidden = !i.hidden; if (!i.hidden) i.focus(); });
$('preset-name').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.target.hidden = true; return; }
  if (e.key !== 'Enter' || !e.target.value.trim()) return;
  const name = e.target.value.trim();
  localStorage.setItem(userKey(), JSON.stringify({ ...userPresets(), [name]: diff() }));
  e.target.value = ''; e.target.hidden = true;
  renderPresets();
  $('preset').value = name;
});
$('btn-export').addEventListener('click', () => {
  download(`${slug(viz)}.params.json`, JSON.stringify({ viz: slug(viz), params }, null, 2), 'application/json');
});
$('btn-import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    const src = j.params ?? j;
    const next = {};
    for (const k of Object.keys(viz.params)) if (k in src) next[k] = src[k];
    applyParams(next);
  } catch (err) { setDiag([{ level: 'error', msg: `import failed: ${err.message}` }]); }
  e.target.value = '';
});
$('btn-random').addEventListener('click', () => {
  const next = {};
  for (const [k, d] of Object.entries(viz.params)) next[k] = randomValue(d);
  applyParams(next);
});
$('btn-reset').addEventListener('click', () => applyParams(defaults(viz)));
$('btn-undo').addEventListener('click', undo);
$('btn-redo').addEventListener('click', redo);

function download(name, data, type) {
  const a = document.createElement('a');
  a.href = typeof data === 'string' && data.startsWith('data:') ? data : URL.createObjectURL(new Blob([data], { type }));
  a.download = name; a.click();
  if (a.href.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- list ----------
function renderList() {
  const q = $('search').value.trim().toLowerCase();
  const ul = $('list'), sel = $('list-select');
  ul.replaceChildren(); sel.replaceChildren();
  VIZ.forEach((v, i) => {
    const hay = `${v.title} ${(v.tags ?? []).join(' ')} ${v.credit}`.toLowerCase();
    if (q && !hay.includes(q)) return;
    const li = document.createElement('li');
    li.className = v === viz ? 'on' : '';
    li.innerHTML = `<span>${v.title}</span><span class="n">${v.shader ? 'glsl' : (v.tags?.[0] ?? '')}</span>`;
    li.title = (v.tags ?? []).join(', ');
    li.addEventListener('click', () => go(v));
    ul.append(li);
    const o = document.createElement('option'); o.value = i; o.textContent = v.title; o.selected = v === viz; sel.append(o);
  });
}
$('search').addEventListener('input', renderList);
$('list-select').addEventListener('change', (e) => go(VIZ[Number(e.target.value)]));
function go(v) { if (v !== viz) { location.hash = '#' + slug(v); } }

// ---------- about / notes / learn ----------
const md = (s) => marked.parse(s ?? '');
function renderAbout() {
  const link = (v) => v.credit.replace(/(https?:\/\/\S+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  $('panel-about').innerHTML = `
    <h3>${viz.title}</h3>
    <div class="meta">${link(viz)} · <code>viz/${viz.file}</code>${viz.shader ? ' · fragment shader' + (viz.webgl2 ? ' (WebGL2)' : '') : ''}${viz.dpr ? ` · dpr cap ${viz.dpr}` : ''}</div>
    <div class="tags">${(viz.tags ?? []).map((t) => `<span>${t}</span>`).join('')}</div>
    ${viz.about ? md(viz.about) : '<p class="meta">No description yet. Add an <code>about</code> string to the module.</p>'}
    <p class="meta">${Object.keys(viz.params ?? {}).length} params · ${Object.keys(viz.presets ?? {}).length} presets · ${(viz.notes ?? []).length} source notes</p>`;
}
function renderNotes() {
  const el = $('learn-notes');
  const notes = viz.notes ?? [];
  el.innerHTML = `<h3>How ${viz.title} works</h3>` + (notes.length ? '' : '<p class="meta">No notes yet. Add a <code>notes</code> array to the module to annotate its source.</p>');
  notes.forEach((n) => {
    const d = document.createElement('div');
    d.className = 'note';
    d.innerHTML = `<b>${n.title}</b>${md(n.body)}`;
    d.title = 'Show in source';
    d.addEventListener('click', () => { showTab('source'); source.highlight(n); });
    el.append(d);
  });
}
function renderPrimer() {
  const ul = $('primer-list');
  PRIMER.forEach(([file, title], i) => {
    const li = document.createElement('li');
    li.textContent = `${i + 1}. ${title}`;
    li.addEventListener('click', () => loadPrimer(i));
    ul.append(li);
  });
}
async function loadPrimer(i) {
  [...$('primer-list').children].forEach((li, j) => li.classList.toggle('on', i === j));
  const body = $('primer-body');
  body.innerHTML = '<p class="meta">loading…</p>';
  try { body.innerHTML = md(await (await fetch(`learn/${PRIMER[i][0]}`)).text()); } catch (e) { body.innerHTML = `<p class="meta">could not load: ${e.message}</p>`; }
}

// ---------- uniforms panel (live) ----------
function renderUniforms() {
  if (!handle || !$('panel-uniforms').classList.contains('on')) return;
  const rows = [];
  const show = (v) => Array.isArray(v) ? `[${v.map((x) => +(+x).toFixed(3)).join(', ')}]` : typeof v === 'number' ? +v.toFixed(4) : String(v);
  rows.push(['canvas', 'px', `${canvas.width} × ${canvas.height} @ dpr ${dpr().toFixed(2)}`]);
  rows.push(['time', 's', handle.time.toFixed(2)]);
  if (handle.activeUniforms) for (const u of handle.activeUniforms()) rows.push([u.name, u.type, show(u.value)]);
  else for (const [k, v] of Object.entries(params)) rows.push([k, viz.params[k].type + (viz.params[k].live === false ? ' (rebuild)' : ''), show(v)]);
  $('panel-uniforms').innerHTML = `<p class="meta">${handle.activeUniforms ? 'Active uniforms read back from the GPU program.' : 'This viz is not a single fragment shader; showing its live params.'}</p>
    <table class="u">${rows.map(([n, t, v]) => `<tr><td>${n}</td><td>${t}</td><td>${v}</td></tr>`).join('')}</table>`;
}

// ---------- diagnostics ----------
function setDiag(items) {
  $('diag-list').innerHTML = items.map((i) => `<li class="${i.level}">${i.msg}</li>`).join('') || '<li class="ok">no issues</li>';
}
function refreshDiagnostics(err) {
  const items = validateViz(viz, viz.shader ? viz.frag : source.text || undefined);
  if (err) items.unshift({ level: 'error', msg: `create() threw: ${err.message}` });
  if (handle?.unusedParams) for (const k of handle.unusedParams()) items.push({ level: 'warn', msg: `param "${k}" has no active uniform (optimised out or not declared)` });
  setDiag(items);
}
source.onCompiled = (r) => {
  if (r.ok) refreshDiagnostics();
  else setDiag([{ level: 'error', msg: 'shader failed to compile; previous program still running' }, ...r.errors.map((e) => ({ level: 'error', msg: `L${e.line}: ${e.msg}` }))]);
};
async function runAll() {
  const out = $('runall-list'), status = $('runall-status');
  out.replaceChildren();
  let fails = 0;
  for (const v of VIZ) {
    status.textContent = `testing ${v.title}…`;
    const li = document.createElement('li');
    const t0 = performance.now();
    // a fresh canvas per viz: contexts are lost on destroy and cannot be reused
    const c = document.createElement('canvas');
    c.width = 320; c.height = 180;
    try {
      const h = await v.create(c, defaults(v));
      h.resize(c.width, c.height);
      h.frame(2);
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      const glErr = gl?.getError?.();
      h.destroy();
      const issues = validateViz(v, v.shader ? v.frag : undefined).filter((i) => i.level === 'error');
      li.className = issues.length || glErr ? 'warn' : 'ok';
      li.textContent = `${v.title}: ok in ${(performance.now() - t0).toFixed(0)} ms${glErr ? ` · gl error 0x${glErr.toString(16)}` : ''}${issues.length ? ` · ${issues.length} schema error(s)` : ''}`;
    } catch (e) {
      fails++;
      li.className = 'err';
      li.textContent = `${v.title}: ${e.message}`;
    }
    out.append(li);
    await new Promise((r) => setTimeout(r, 50));
  }
  status.textContent = `${VIZ.length - fails}/${VIZ.length} passed`;
  return fails;
}
$('btn-runall').addEventListener('click', runAll);

// ---------- toolbar ----------
function setPlaying(p) {
  playing = p;
  $('btn-play').textContent = p ? 'Pause' : 'Play';
  if (!handle) return;
  p ? handle.start() : handle.stop();
}
$('btn-play').addEventListener('click', () => setPlaying(!playing));
$('btn-restart').addEventListener('click', () => { if (handle) { handle.time = 0; if (!playing) handle.frame(0); } });
$('btn-back').addEventListener('click', () => { setPlaying(false); handle?.step(-1 / 60); });
$('btn-fwd').addEventListener('click', () => { setPlaying(false); handle?.step(1 / 60); });
const seek = (t) => { if (!handle) return; handle.time = Math.max(0, t); if (!playing) handle.frame(handle.time); };
$('time').addEventListener('change', (e) => seek(Number(e.target.value)));
$('scrub').addEventListener('input', (e) => { setPlaying(false); seek(Number(e.target.value)); });
$('rate').addEventListener('change', (e) => { rate = Number(e.target.value); if (handle) handle.rate = rate; });
$('dpr').addEventListener('change', (e) => { dprMode = e.target.value; sizeStage(); });
$('aspect').addEventListener('change', (e) => { aspect = e.target.value; sizeStage(); });
$('btn-full').addEventListener('click', () => (document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen()));
$('btn-snap').addEventListener('click', snapshot);
function snapshot() {
  if (!handle) return;
  handle.frame(handle.time); // draw and read back in the same task, before the buffer is cleared
  download(`${slug(viz)}-${handle.time.toFixed(2)}s.png`, canvas.toDataURL('image/png'));
}
$('btn-reload').addEventListener('click', reloadModule);
async function reloadModule() {
  const i = VIZ.indexOf(viz);
  const fresh = (await import(`../viz/${viz.file}?t=${Date.now()}`)).default;
  fresh.file = viz.file;
  VIZ[i] = fresh;
  const next = defaults(fresh);
  for (const k of Object.keys(next)) if (k in params) next[k] = params[k];
  const t = handle?.time ?? 0;
  viz = fresh; params = next;
  hist.past.length = hist.future.length = 0;
  lastCommitted = JSON.stringify(params);
  syncHistoryButtons();
  controls = buildControls($('params'), viz, params, { onInput: onParam, onCommit: (k, val) => { onParam(k, val); commit(); } });
  renderPresets(); renderAbout(); renderNotes(); renderList();
  await mount(fresh, { startTime: t });
}
$('btn-share').addEventListener('click', async (e) => {
  await navigator.clipboard?.writeText(shareUrl());
  const b = e.currentTarget; b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy link'), 1200);
});
$('btn-help').addEventListener('click', () => $('help').showModal());

// ---------- dock tabs ----------
function showTab(name) {
  document.querySelectorAll('#tabs button[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('on', p.id === `panel-${name}`));
  studio.classList.remove('dock-collapsed');
  if (name === 'uniforms') renderUniforms();
}
document.querySelectorAll('#tabs button[data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
$('btn-dock').addEventListener('click', () => studio.classList.toggle('dock-collapsed'));

// ---------- keyboard ----------
const TABS = ['about', 'source', 'uniforms', 'learn', 'diag'];
window.addEventListener('keydown', (e) => {
  const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !(inField && document.activeElement.tagName === 'TEXTAREA')) {
    e.preventDefault(); e.shiftKey ? redo() : undo(); return;
  }
  if (inField || e.metaKey || e.ctrlKey || e.altKey) return;
  const i = VIZ.indexOf(viz);
  switch (e.key) {
    case ' ': e.preventDefault(); setPlaying(!playing); break;
    case 'r': seek(0); break;
    case ',': setPlaying(false); handle?.step(-1 / 60); break;
    case '.': setPlaying(false); handle?.step(1 / 60); break;
    case '[': go(VIZ[(i - 1 + VIZ.length) % VIZ.length]); break;
    case ']': go(VIZ[(i + 1) % VIZ.length]); break;
    case 'f': $('btn-full').click(); break;
    case 's': snapshot(); break;
    case '?': $('help').open ? $('help').close() : $('help').showModal(); break;
    case 'Escape': if (!document.fullscreenElement && !$('help').open) location.href = `/#${slug(viz)}`; break;
    default: if (/^[1-5]$/.test(e.key)) showTab(TABS[Number(e.key) - 1]);
  }
});

// ---------- UI tick: time readout, scrub, fps ----------
let frames = 0, last = performance.now(), fpsAt = last, uiAt = 0;
function tick(now) {
  requestAnimationFrame(tick);
  frames++;
  if (now - uiAt > 100 && handle) {
    uiAt = now;
    const t = handle.time;
    if (document.activeElement !== $('time')) $('time').value = t.toFixed(2);
    const sc = $('scrub');
    if (t > Number(sc.max)) sc.max = Math.ceil(t / 60) * 60;
    if (document.activeElement !== sc) sc.value = t;
    renderUniforms();
  }
  if (now - fpsAt >= 500) {
    const ms = (now - fpsAt) / frames;
    $('fps').textContent = playing && handle ? `${(1000 / ms).toFixed(0)} fps · ${ms.toFixed(1)} ms` : 'paused';
    frames = 0; fpsAt = now;
  }
}
requestAnimationFrame(tick);
document.addEventListener('visibilitychange', () => { if (!handle) return; document.hidden ? handle.stop() : playing && handle.start(); });

// ---------- boot ----------
renderPrimer();
loadPrimer(0);
async function route() {
  const { slug: s } = readUrl();
  const v = bySlug(s) ?? VIZ[0];
  if (v !== viz) await select(v, { fromUrl: true });
}
window.addEventListener('hashchange', route);
await route();
const tabParam = new URLSearchParams(location.search).get('tab');
if (TABS.includes(tabParam)) showTab(tabParam);
if (tabParam === 'learn') loadPrimer(Number(new URLSearchParams(location.search).get('primer') ?? 0) || 0);
// `/studio/?smoke` : headless smoke test. Prints one line per viz and a final summary to the console.
if (new URLSearchParams(location.search).has('smoke')) {
  showTab('diag');
  let fails = await runAll();
  for (const li of $('runall-list').children) console.log(`[smoke] ${li.textContent}`);
  // live-edit path: a broken shader must report a line and leave the old program running
  const sh = VIZ.find((v) => v.shader);
  const c = document.createElement('canvas'); c.width = c.height = 8;
  const h = await sh.create(c, defaults(sh));
  const bad = h.recompile(sh.frag.replace('void main', 'void main(float oops) {} void main'));
  const good = h.recompile(sh.frag);
  const ok = !bad.ok && bad.errors.length > 0 && bad.errors[0].line > 0 && good.ok;
  h.frame(1); h.destroy();
  console.log(`[smoke] recompile error path (${sh.title}): ${ok ? 'ok' : 'FAIL'} ${JSON.stringify(bad.errors[0] ?? null)}`);
  if (!ok) fails++;
  console.log(`[smoke] ${fails ? 'FAIL' : 'PASS'} ${VIZ.length - fails}/${VIZ.length}`);
}
