# What a fragment shader is

Every viz on this site except *Trippy Curves* ends in a **fragment shader**: a tiny program
the GPU runs once **per pixel, every frame**. It gets the pixel's coordinate and a few
numbers you hand it (uniforms), and it must answer one question: *what colour is this pixel?*

```glsl
precision highp float;
uniform vec2 resolution;
uniform float time;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;      // 0..1 across the canvas
  gl_FragColor = vec4(uv.x, uv.y, 0.5 + 0.5 * sin(time), 1.0);
}
```

Three things make this different from normal code:

- **No loops over pixels.** You write the body for one pixel; the GPU runs it for all of them in parallel. You cannot read your neighbour's result.
- **No state between frames.** Each frame starts from scratch. Motion comes only from `time` changing.
- **Everything is a function of position and time.** That is the whole trick: pick a function of `(x, y, t)` that looks good.

## The plumbing you never see

`shader.js` draws two triangles that cover the canvas and attaches your fragment shader to
them. That is all the geometry there is. Open `public/shader.js` and look at `shaderViz`:
compile vertex + fragment, link, upload uniforms, `drawArrays`. Forty lines.

## Where to start

Open [Plasma](#plasma), switch to the **Source** tab, change `80.0` to `20.0` in the first
`color +=` line and press ⌘↩. Then try the **Uniforms** tab to see exactly what the GPU
receives.
