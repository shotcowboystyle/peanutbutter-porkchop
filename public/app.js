import hex from './viz/hex.js';
import mandala from './viz/mandala.js';
import aizawa from './viz/aizawa.js';
import toric from './viz/toric.js';
import triangles from './viz/triangles.js';
import colors from './viz/colors.js';
import curves from './viz/curves.js';
import candywarp from './viz/candywarp.js';
import atan2 from './viz/atan2.js';
import plasma from './viz/plasma.js';

const VIZ = [hex, mandala, aizawa, toric, triangles, colors, curves, candywarp, atan2, plasma];
const SNAP_T = 2; // seconds of warm-up time so a snapshot is never a blank first frame
const slug = (v) => v.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const stage = document.getElementById('stage');
const grid = document.getElementById('grid');
const cells = document.getElementById('cells');
const tiles = VIZ.map((v, i) => {
  const f = document.createElement('figure');
  f.dataset.index = i;
  f.append(document.createElement('canvas'));
  cells.append(f);
  return f;
});

let mode = 'full';
let index = Math.max(0, VIZ.findIndex((v) => slug(v) === location.hash.slice(1)));
let playing = true;
let full = null;      // { handle, canvas, index } for the fullscreen viz
let live = null;      // { handle, canvas, index } for the live grid tile
let liveToken = 0;
let fullToken = 0;

const dprFor = (v) => Math.min(devicePixelRatio || 1, v.dpr ?? 2);

// ---------- fullscreen ----------
async function mountFull(i) {
  const token = ++fullToken;
  unmountFull();
  index = i;
  history.replaceState(null, '', '#' + slug(VIZ[i]));
  document.title = VIZ[i].title;
  const canvas = document.createElement('canvas');
  stage.replaceChildren(canvas);
  const d = dprFor(VIZ[i]);
  canvas.width = Math.round(innerWidth * d);
  canvas.height = Math.round(innerHeight * d);
  const handle = await VIZ[i].create(canvas);
  if (token !== fullToken) { handle.destroy(); return; }
  handle.resize(canvas.width, canvas.height);
  full = { handle, canvas, index: i };
  playing ? handle.start() : handle.frame(SNAP_T);
}

function unmountFull() {
  if (!full) return;
  full.handle.destroy();
  full.canvas.remove();
  full = null;
}

function resizeFull() {
  if (!full) return;
  const d = dprFor(VIZ[full.index]);
  full.canvas.width = Math.round(innerWidth * d);
  full.canvas.height = Math.round(innerHeight * d);
  full.handle.resize(full.canvas.width, full.canvas.height);
  if (!playing) full.handle.frame(full.handle.time);
}

// ---------- snapshots ----------
function blit(i, src) {
  const thumb = tiles[i].firstElementChild;
  thumb.width = src.width;
  thumb.height = src.height;
  thumb.getContext('2d').drawImage(src, 0, 0);
}

async function snapshot(i) {
  const tile = tiles[i];
  const c = document.createElement('canvas');
  c.width = Math.max(2, tile.clientWidth);
  c.height = Math.max(2, tile.clientHeight);
  try {
    const handle = await VIZ[i].create(c);
    handle.resize(c.width, c.height);
    handle.frame(SNAP_T);
    blit(i, c);
    handle.destroy();
    tile.dataset.snap = '1';
    tile.classList.remove('broken');
  } catch (e) {
    // One broken viz (e.g. no WebGL2) must not stop the rest of the grid; surface it as an uncaught error.
    tile.classList.add('broken');
    reportError(e);
  }
}

async function snapshotAll() {
  for (let i = 0; i < VIZ.length; i++) {
    if (tiles[i].dataset.snap) continue;
    await new Promise((r) => requestAnimationFrame(r));
    await snapshot(i);
  }
}

// ---------- live tile ----------
function killLive() {
  if (!live) return;
  live.handle.destroy();
  live.canvas.remove();
  live = null;
}

let liveTimer = 0;
function scheduleLive(i) {
  clearTimeout(liveTimer);
  killLive();
  liveTimer = setTimeout(() => setLive(i), 120); // coalesce rapid arrow presses
}

async function setLive(i) {
  const token = ++liveToken;
  killLive();
  const tile = tiles[i];
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, tile.clientWidth);
  canvas.height = Math.max(2, tile.clientHeight);
  let handle;
  try {
    handle = await VIZ[i].create(canvas);
  } catch (e) {
    tile.classList.add('broken');
    reportError(e); // same as snapshot(): keep the grid usable
    return;
  }
  if (token !== liveToken) { handle.destroy(); return; }
  tile.append(canvas);
  handle.resize(canvas.width, canvas.height);
  live = { handle, canvas, index: i };
  playing ? handle.start() : handle.frame(SNAP_T);
}

// ---------- highlight / grid nav ----------
function highlight(i) {
  i = (i + VIZ.length) % VIZ.length;
  tiles[index]?.classList.remove('active');
  index = i;
  tiles[i].classList.add('active');
  if (mode === 'grid') scheduleLive(i);
}

// ---------- layout: fill the viewport, curve like a monitor ----------
let colsN = 1;
const CURVE_DEG = 16;  // yaw of the outermost column
const CURVE_Z = 40;    // px the outermost column comes toward the viewer
function layout() {
  const W = innerWidth, H = innerHeight, N = VIZ.length;
  const gap = Math.round(Math.min(W, H) * 0.06), pad = gap * 1.6;
  let best = { s: 0, c: 1 };
  for (let c = 1; c <= N; c++) {
    const r = Math.ceil(N / c);
    const tw = (W - 2 * pad - gap * (c - 1)) / c;
    const th = (H - 2 * pad - gap * (r - 1)) / r;
    const s = Math.min(tw, th * 16 / 9);
    if (s > best.s) best = { s, c };
  }
  colsN = best.c;
  cells.style.gridTemplateColumns = `repeat(${colsN}, ${Math.floor(best.s)}px)`;
  cells.style.gap = `${gap}px`;
  const half = Math.max(1, (colsN - 1) / 2);
  tiles.forEach((t, i) => {
    const row = Math.floor(i / colsN);
    const inRow = Math.min(colsN, N - row * colsN); // last row may be short and is centred
    const dx = ((i % colsN) - (inRow - 1) / 2) / half; // -1..1 across the full width
    t.style.setProperty('--ry', `${(-dx * CURVE_DEG).toFixed(2)}deg`);
    t.style.setProperty('--z', `${(dx * dx * CURVE_Z).toFixed(1)}px`);
  });
}

// ---------- transitions ----------
function tileTransform(i) {
  const r = tiles[i].getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const k = Math.max(innerWidth / r.width, innerHeight / r.height);
  grid.style.transformOrigin = `${cx}px ${cy}px`;
  return `translate(${innerWidth / 2 - cx}px, ${innerHeight / 2 - cy}px) scale(${k})`;
}

function afterTransition(fn) {
  let done = false;
  const go = () => { if (done) return; done = true; grid.removeEventListener('transitionend', go); fn(); };
  grid.addEventListener('transitionend', go);
  setTimeout(go, 450); // fallback if the transition is skipped (reduced motion, hidden tab)
}

async function openFull(i) {
  if (mode === 'full' && full?.index === i) return;
  i = (i + VIZ.length) % VIZ.length;
  const fromGrid = mode === 'grid';
  killLive();
  tiles[index]?.classList.remove('active');
  index = i;
  tiles[i].classList.add('active');
  if (fromGrid) {
    const t = tileTransform(i);
    mode = 'full';
    // stage must be visible under the grid before the zoom starts
    document.body.dataset.mode = 'full';
    grid.style.opacity = '1';
    grid.style.pointerEvents = 'none';
    grid.style.transform = t;
    requestAnimationFrame(() => { grid.style.opacity = '0'; });
    afterTransition(() => { grid.style.transform = ''; grid.style.opacity = ''; grid.style.pointerEvents = ''; });
  }
  await mountFull(i);
}

function openGrid() {
  if (mode === 'grid') return;
  mode = 'grid';
  if (full) {
    full.handle.frame(full.handle.time);
    blit(full.index, full.canvas); // fresh thumbnail, same task as the frame so the buffer is intact
    unmountFull();
  }
  // start zoomed in on the tile, then animate out to the full grid
  document.body.classList.add('snap');
  grid.style.transform = tileTransform(index);
  grid.style.opacity = '0';
  document.body.dataset.mode = 'grid';
  void grid.offsetWidth;
  document.body.classList.remove('snap');
  grid.style.transform = '';
  grid.style.opacity = '';
  highlight(index);
}

// ---------- play / pause ----------
function togglePlay() {
  playing = !playing;
  const h = (mode === 'full' ? full : live)?.handle;
  if (!h) return;
  playing ? h.start() : h.stop();
}

// ---------- keyboard ----------
const KEYS = {
  ArrowLeft: 'left', h: 'left', a: 'left',
  ArrowRight: 'right', l: 'right', d: 'right',
  ArrowUp: 'up', k: 'up', w: 'up',
  ArrowDown: 'down', j: 'down', s: 'down',
};

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const dir = KEYS[e.key];
  if (dir) {
    e.preventDefault();
    const step = { left: -1, right: 1, up: -colsN, down: colsN }[dir];
    if (mode === 'grid') highlight(index + step);
    else openFull(index + (step < 0 ? -1 : 1));
    return;
  }
  switch (e.key) {
    case 'Escape': case 'g':
      mode === 'grid' ? openFull(index) : openGrid();
      break;
    case 'Enter':
      if (mode === 'grid') openFull(index);
      break;
    case ' ':
      e.preventDefault();
      mode === 'grid' ? openFull(index) : togglePlay();
      break;
    case 'p':
      togglePlay();
      break;
    case 'f':
      document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
      break;
    case 'Home': openFull(0); break;
    case 'End': openFull(VIZ.length - 1); break;
    default:
      if (/^[0-9]$/.test(e.key)) {
        const n = e.key === '0' ? 9 : Number(e.key) - 1;
        if (n < VIZ.length) openFull(n);
      }
  }
});

// ---------- touch / pointer ----------
const pointers = new Map();
let pinchStart = 0, pinchNow = 0, multi = false;
const dist = () => {
  const [a, b] = [...pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
};
const tileAt = (x, y) => document.elementFromPoint(x, y)?.closest('figure');

window.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
  if (pointers.size === 2) { multi = true; pinchStart = pinchNow = dist(); }
});
window.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse' && mode === 'grid') {
    cells.style.setProperty('--tx', `${((0.5 - e.clientY / innerHeight) * 8).toFixed(2)}deg`);
    cells.style.setProperty('--ty', `${((e.clientX / innerWidth - 0.5) * 10).toFixed(2)}deg`);
  }
  const p = pointers.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 2) pinchNow = dist();
});
const end = (e) => {
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (!p) return;
  if (multi) {
    if (pointers.size > 0) return;
    multi = false;
    const ratio = pinchNow / pinchStart;
    if (mode === 'full' && ratio < 0.75) openGrid();
    else if (mode === 'grid' && ratio > 1.33) {
      const t = tileAt(p.x, p.y);
      if (t) openFull(Number(t.dataset.index));
    }
    return;
  }
  if (e.type === 'pointercancel') return;
  const dx = p.x - p.sx, dy = p.y - p.sy;
  if (Math.hypot(dx, dy) < 10) {
    if (mode === 'grid') {
      const t = tileAt(p.x, p.y);
      if (t) openFull(Number(t.dataset.index));
    } else togglePlay();
  } else if (mode === 'full' && Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) {
    openFull(index + (dx < 0 ? 1 : -1));
  }
};
window.addEventListener('pointerup', end);
window.addEventListener('pointercancel', end);

// ---------- lifecycle ----------
window.addEventListener('resize', () => {
  layout();
  resizeFull();
  if (mode === 'grid') scheduleLive(index);
});
document.addEventListener('visibilitychange', () => {
  const h = (mode === 'full' ? full : live)?.handle;
  if (!h) return;
  document.hidden ? h.stop() : playing && h.start();
});

window.addEventListener('hashchange', () => {
  const i = VIZ.findIndex((v) => slug(v) === location.hash.slice(1));
  if (i >= 0 && i !== index) openFull(i);
});

layout();
tiles[index].classList.add('active');
mountFull(index).then(snapshotAll);
