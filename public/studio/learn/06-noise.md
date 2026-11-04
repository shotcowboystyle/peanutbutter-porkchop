# Noise

Random values per pixel look like TV static. **Noise** functions are random-but-smooth:
nearby inputs give nearby outputs. That is the whole reason they feel organic.

[Trippy Colors](#trippy-colors) carries the standard **3-D simplex noise** by Ian McEwan /
Ashima Arts. You do not need to understand its internals to use it; you need to know:

- Input is a `vec3`. Use `(x, y, time)` and the pattern evolves rather than scrolls.
- Output is roughly -1..1, centred on 0, and smooth.
- The scale of the input sets feature size: `snoise(p * 4.0)` has features a quarter the size of `snoise(p)`.

## Shaping noise

```glsl
float n = snoise(p);
n = abs(n);                         // ridges where the field crosses zero
n = 0.5 + 0.5 * n;                  // 0..1
n = snoise(p) + 0.5 * snoise(2.0 * p) + 0.25 * snoise(4.0 * p);  // fractal (fBm): detail at several scales
```

Trippy Colors does `sin(140.0 * abs(n))`: the gain is so large that each small change in `n`
sweeps a whole colour cycle. Pull `gain` down to 6 in the controls to see the raw field.

## Domain warping

Feed noise into the *input* of another noise: `snoise(p + snoise(p))`. CandyWarp does a
cheap version with sines instead of noise (`d += warp * sin(...) * sin(...)`). Same idea:
bend the coordinate system before you draw in it.
