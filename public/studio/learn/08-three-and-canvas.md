# three.js scenes and Canvas 2D

Three vizes are not a single fragment shader.

## three.js

[Trippy Triangles](#trippy-triangles) and [Aizawa Attractor](#aizawa-attractor) build a
scene graph with **three.js** (loaded from a CDN via the import map in `index.html`, only when
the viz is opened). The pattern is the same in both:

```js
const renderer = new THREE.WebGLRenderer({ canvas });
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(...);
// add meshes / lines / lights
return makeHandle({
  render(t) { /* move things by t */ renderer.render(scene, camera); },
  resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); },
  dispose() { /* geometry.dispose(), material.dispose(), renderer.dispose(), forceContextLoss() */ },
});
```

Triangles uses a stock PBR material and six point lights: zero shader code. Aizawa writes a
custom `ShaderMaterial` for the line (dashes and comets driven by a per-vertex `lineDistance`
attribute) and runs `UnrealBloomPass` on top. Its vertex and fragment shaders are plain GLSL
strings in the module; the uniforms are set from `render(t)` by hand.

**Dispose matters.** The site keeps one live context at a time and the studio recreates the
viz when a `live: false` param changes. Leak a renderer and the browser's context limit
(usually 16) bites within a minute.

## Canvas 2D

[Trippy Curves](#trippy-curves) draws with `quadraticCurveTo` and low-alpha strokes. It is
here as a reminder that the ideas (polar coordinates, a slowly moving phase, additive glow)
are not GPU-specific. It is also the slowest viz per pixel: 666 curves stroked in 32 batches.

## wtc-gl

[Manifold Mandala](#manifold-mandala) uses `wtc-gl`, a thin WebGL wrapper, with instanced
geometry, a two-texture float render target (colour+depth and normals) and a screen-space
post pass for outlines, AO and fog. Read `viz/mandala/scene.js` for a complete small engine.
