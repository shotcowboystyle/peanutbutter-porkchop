# Time and uniforms

A **uniform** is a value that is the same for every pixel in a frame: time, resolution, a
colour, a slider. In this studio every param you drag is a uniform with the same name.

```glsl
uniform float warp;     // declared in GLSL…
```

```js
params: { warp: { type: 'float', default: 2.5, min: 0, max: 10 } }   // …described in JS
```

`shaderViz` matches them by name and uploads the value every frame (`gl.uniform1f`). Open the
**Uniforms** tab: it reads the active uniform list back from the compiled program, so if a
param is missing there, the compiler optimised it away because the shader never used it. The
**Diagnostics** tab reports the same thing as a warning.

## Time

`time` arrives in seconds from a pausable clock (`makeHandle` in `shader.js`). Pause, scrub,
and step with `,` and `.` in the toolbar; the shader cannot tell the difference, because it is
a pure function of `time`. Vizes that keep their own state (Mandala's rings, Curves' phase)
*can* tell, which is why they step rather than seek.

## Compile-time constants

GLSL ES 1.0 loop bounds must be constants, so `for (int i = 0; i < layers; i++)` cannot use a
uniform. Params marked `live: false` are injected as `#define layers 3` instead and the shader
is rebuilt when they change. The ⟳ marker in the controls panel means exactly that. See
`layers` in [Hex](#hex) and `maxSteps` in [Toric](#toric).

## Types

| param type | GLSL | upload |
|---|---|---|
| float | `uniform float x;` | `uniform1f` |
| int | `uniform int x;` | `uniform1i` |
| bool | `uniform bool x;` | `uniform1i` (0/1) |
| color | `uniform vec3 x;` | `uniform3f`, components 0..1 |
| select | `uniform int x;` | index into `options` |
