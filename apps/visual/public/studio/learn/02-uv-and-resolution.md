# UV coordinates and resolution

`gl_FragCoord.xy` is the pixel position in pixels, origin bottom-left. Almost nothing wants
that directly, so the first line of nearly every shader normalises it. The choice you make
here decides whether circles are round and whether the pattern scales with the window.

```glsl
vec2 uv = gl_FragCoord.xy / resolution;                       // 0..1, stretches with aspect
vec2 p  = (gl_FragCoord.xy - 0.5 * resolution) / resolution.y;  // centred, -0.5..0.5 vertically, round circles
vec2 q  = (2.0 * gl_FragCoord.xy - resolution) / min(resolution.x, resolution.y); // centred, -1..1 on the short side
```

Compare them in the gallery:

- [Plasma](#plasma) uses the first form. Resize the stage with the **aspect** menu: the bands stretch.
- [Hex](#hex) uses the third. The hexagons stay regular at any aspect.
- [CandyWarp](#candywarp) works in raw pixels around the centre and scales its own units by `RENDERSIZE.y`.

## Device pixel ratio

The canvas is rendered at CSS size × dpr. A raymarcher at dpr 2 does four times the work of
dpr 1. Each viz carries a `dpr` cap; the **dpr** menu in the toolbar overrides it so you can
see the cost in the fps readout.

## Try

In [Atan2](#atan2), the shader divides by `vec2(width, height)` and subtracts 0.5. Change the
`- vec2(0.5,0.5)` to `- vec2(0.25,0.5)` and recompile: the centre of rotation moves.
