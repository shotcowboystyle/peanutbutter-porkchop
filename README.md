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

Touch: tap a tile to open it; pinch in to zoom out to the grid; pinch out on a
tile to open it; swipe left / right to change viz; tap to pause / resume.

The current viz is kept in the URL hash.

## Layout

- `public/app.js` — state, input, grid <-> fullscreen zoom, thumbnail snapshots.
  Only one render context is live at a time (fullscreen viz, or the highlighted
  grid tile); other tiles are static snapshots.
- `public/shader.js` — `makeHandle` (pausable RAF clock) and `shaderViz`
  (fullscreen-quad WebGL runner).
- `public/viz/*.js` — one module per visualization. Credits live at the top of
  each file. three.js (ESM, CDN import map in `index.html`) is only imported by
  the modules that need it.

## Adding a viz

Create `public/viz/<name>.js` exporting `{ title, credit, dpr?, create(canvas) }`
where `create` returns `{ start, stop, frame(t), resize(w, h), destroy }` —
use `makeHandle` or `shaderViz` from `shader.js`. Add it to the `VIZ` array in
`app.js`.
