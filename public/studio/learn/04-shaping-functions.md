# Shaping functions

Most of the "design" in a shader is a handful of one-dimensional functions applied to a
distance, an angle or a coordinate. Learn these six and you can read almost every viz here.

```glsl
sin(x)              // -1..1, periodic. 0.5 + 0.5 * sin(x) puts it in 0..1.
fract(x)            // sawtooth 0..1. Repeats anything.
mod(x, p)           // sawtooth 0..p. Same idea, custom period.
abs(x - 0.5)        // folds a sawtooth into a triangle wave: a line down the middle.
smoothstep(a, b, x) // 0 below a, 1 above b, smooth in between. The anti-aliased threshold.
pow(x, k)           // sharpens (k > 1) or flattens (k < 1) a 0..1 value.
```

Where they appear:

- **CandyWarp**: `mod(d, radius/loops)` makes rings; `abs(v - half)` gives each ring a centre line; `fract(d * k)` makes the rainbow.
- **Hex**: `pow(calc(...), contrast)`. Drag `contrast` from 1 to 12 and watch soft blobs become sharp cells.
- **Aizawa** (fragment shader on the line): `smoothstep` pairs build dashes; `pow(1 - abs(x - 0.5) * 2, 12)` is a comet-shaped pulse.
- **Trippy Colors**: `sin(gain * noise)`. The gain is huge, so a gentle noise field wraps around many times and becomes stripes.

## Combining

Multiply two 0..1 masks to intersect them; add to union; `1 - x` to invert. Feed one
function's output into another's input (`sin(fract(x) * 6.28)`) and you get a new shape for
free. Shadertoy is 80% this.

## Try

Open [CandyWarp](#candywarp), find `v = clamp(v - gap, 0.0, 1.0);` and change it to
`v = smoothstep(gap, gap + 2.0, v);`. Soft-edged rings.
