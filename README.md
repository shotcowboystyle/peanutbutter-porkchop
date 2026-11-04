# peanutbutter-porkchop

A keyboard-driven showcase of trippy WebGL / canvas visualizations, served as
static assets from Cloudflare Workers (`pnpm dev`, `pnpm deploy`). No build step.

## Controls

| Key | Grid | Fullscreen |
|-----|------|------------|
| `Esc` / `g` | zoom into highlighted tile | zoom out to grid |
| Arrows / `hjkl` / `wasd` | move highlight | previous / next viz |
| `Enter` / `Space` | open highlighted tile | `Space` pauses / resumes |
| `p` | pause / resume live tile | pause / resume |
| `1`–`9`, `0` | jump to viz n | jump to viz n |
| `Home` / `End` | first / last | first / last |
| `f` | browser fullscreen | browser fullscreen |
| `e` | open highlighted viz in the Studio | open this viz in the Studio |

Touch: tap a tile to open it; pinch in to zoom out to the grid; pinch out on a
tile to open it; swipe left / right to change viz; tap to pause / resume.

The current viz is kept in the URL hash.

## Studio (`/studio/`)

A playground and learning tool for every viz, served from the same static
bundle. Press `e` on the site, or open `/studio/#<slug>`.

- **Rail**: every viz, filterable by title / tag / credit.
- **Stage**: play / pause / restart, frame step (`,` `.`), time scrub, rate,
  dpr and aspect overrides, fps readout, fullscreen, PNG snapshot, and
  **Reload module** (re-imports the viz file, keeping params and time).
- **Controls**: generated from the viz's `params` schema. Presets (built-in +
  your own, saved in localStorage), Export / Import JSON, Random, Reset,
  Undo / Redo. Params marked ⟳ are compile-time: the viz is rebuilt on change.
- **Dock**: *About* (credit, tags, description), *Source* (fragment shader is
  editable, `⌘↩` recompiles, errors land on their line; other modules are
  read-only), *Uniforms* (active uniforms read back from the GPU each frame),
  *Learn* (per-viz source notes that highlight lines, plus a nine-part shader
  primer in `public/studio/learn/`), *Diagnostics* (schema warnings, unused
  uniforms, compile log, **Run all** smoke test).
- **Copy link** captures viz + non-default params + time in the URL.
  `?tab=source` (or `about|uniforms|learn|diag`) opens a dock tab.
- `/studio/?smoke` runs every viz once headlessly and logs `[smoke] PASS|FAIL`.

## Layout

- `public/app.js` — state, input, grid <-> fullscreen zoom, thumbnail snapshots.
  Only one render context is live at a time (fullscreen viz, or the highlighted
  grid tile); other tiles are static snapshots.
- `public/shader.js` — `makeHandle` (pausable, seekable RAF clock), `shaderViz`
  (fullscreen-quad WebGL runner that uploads params as uniforms / `#define`s
  and can recompile in place), `defaults()`, and JSDoc typedefs for the contract.
- `public/viz/index.js` — the registry (`MANIFEST`). Site, studio, smoke test
  and `pnpm check` all read it.
- `public/viz/*.js` — one module per visualization. Credits live at the top of
  each file. three.js / wtc-gl (ESM, CDN import map) are only imported by the
  modules that need them.
- `public/studio/` — the studio: `studio.js` (state, routing), `controls.js`
  (schema -> inputs), `source.js` (editor), `validate.js` (contract checks,
  shared with node), `learn/*.md`.
- `scripts/` + `templates/` — scaffold and check (below).

## Adding a viz

```sh
pnpm new:viz aurora                # shader (default) | --type three | --type canvas
pnpm dev                           # http://localhost:8787/studio/#aurora
pnpm check                         # contract check for every viz (CI-friendly, exit 1 on error)
```

A viz module exports `{ title, credit, dpr?, params?, presets?, about?, tags?,
notes?, create(canvas, params) }`; `create` returns a handle from `makeHandle`
or `shaderViz`. Each `params` entry is
`{ type: float|int|bool|color|select, default, min?, max?, step?, options?, live?, group?, doc? }`.
`shaderViz` uploads every param as a uniform of the same name (declare it in the
GLSL) or, with `live: false`, injects it as a `#define` and rebuilds. Other vizes
read the `params` object each frame; `live: false` values are read once at
create time because the studio recreates the viz when they change. `presets`
are partial overrides; `notes[].find` is a substring of the source that the
Learn panel highlights. Keep defaults equal to the published look.
