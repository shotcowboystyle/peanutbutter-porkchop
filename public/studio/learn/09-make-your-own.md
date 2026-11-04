# Make your own viz

```sh
pnpm new:viz aurora            # fragment shader (default)
pnpm new:viz orbits --type three
pnpm new:viz doodle --type canvas
pnpm dev                       # http://localhost:8787/studio/#aurora
```

The scaffold writes `public/viz/<name>.js` from a template with a working shader, two params,
a preset, an `about` paragraph and one source note, and adds the name to `MANIFEST` in
`public/viz/index.js`. That list is the only registry: the site, the studio, the smoke test
and `pnpm check` all read it.

## The contract

```js
export default shaderViz({            // or a plain object with create(canvas, params)
  title: 'Aurora',
  credit: 'you — https://…',
  tags: ['noise'],
  about: 'Markdown. What the viewer is looking at and the one idea that makes it work.',
  params: {
    speed: { type: 'float', default: 1, min: 0, max: 4, step: 0.01, group: 'Motion', doc: 'Clock multiplier.' },
  },
  presets: { Default: {}, Calm: { speed: 0.2 } },
  notes: [{ title: 'UV setup', find: 'vec2 uv =', body: 'Why this normalisation.' }],
  uniforms(gl, u, t, w, h, p) { gl.uniform1f(u('time'), t * p.speed); gl.uniform2f(u('resolution'), w, h); },
  frag: `precision highp float; uniform float time; uniform vec2 resolution; void main() { … }`,
});
```

- Every `params` key becomes a uniform of the same name (declare it in the GLSL), or a `#define` when `live: false`.
- Non-shader vizes get the same `params` object passed to `create(canvas, params)`; read live values each frame, and read `live: false` ones once at create time (the studio recreates you when they change).
- `notes[].find` is a substring of the source; the Learn panel highlights that line.

## The loop

1. Edit the file. Click **Reload module** in the toolbar (params and time survive) or just refresh.
2. Shader vizes: edit in the **Source** tab, ⌘↩ to recompile, copy the result back into the file when happy.
3. **Diagnostics** shows schema problems, unused uniforms and the compile log. **Run all** mounts every viz once.
4. `pnpm check` runs the same schema checks in node, for CI.

## Taste

Keep defaults equal to the published look so the site does not change when you add a slider.
Give every param a `doc`; it is the tooltip and the lesson. Three good presets beat ten
sliders.
