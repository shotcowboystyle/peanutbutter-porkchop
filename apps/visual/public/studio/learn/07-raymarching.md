# Raymarching and signed distance functions

[Toric](#toric) draws a 3-D object with no triangles. The recipe, which you can read top to
bottom in its source:

1. **A camera** (`getCamera`): for each pixel, a ray origin `ro` and direction `rd`.
2. **A distance function** (`map` / `model`): given any point in space, return the distance to the nearest surface. Negative inside. This *is* the geometry.
3. **March** (`march`): start at `ro`, call `map`, step forward by that distance (it is safe, nothing is closer), repeat until the distance is tiny (hit) or you have gone too far (sky).
4. **Normal** (`calcNormal`): sample `map` slightly left/right, up/down, front/back. The gradient of a distance field points out of the surface.
5. **Shade** (`shade`): dot the normal with a light direction, add ambient, rim, occlusion.

## Building shapes from distances

```glsl
float sphere(vec3 p, float r) { return length(p) - r; }
float torus(vec3 p, float R, float r) { return length(vec2(length(p.xz) - R, p.y)) - r; }
min(a, b)           // union
max(a, b)           // intersection
max(a, -b)          // subtraction
abs(a) - t          // hollow shell of thickness t
```

Toric's `model` is a torus turned into a shell, intersected with a **gyroid**
(`abs(dot(sin(p.yzx), cos(p.zxy)))`, a triply periodic surface) via `length(vec2(d, g)) - thickness`.

## Cost

Each pixel calls `map` up to `maxSteps` times, and `calcNormal` calls it six more. Set
`maxSteps` to 32 in the controls (it is a compile-time constant, so the shader rebuilds) to
see what under-marching looks like, and watch the fps readout as you raise dpr.
