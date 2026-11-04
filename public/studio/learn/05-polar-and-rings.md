# Polar coordinates, rings and spokes

Switch from `(x, y)` to `(radius, angle)` and every circular effect becomes a one-liner.

```glsl
vec2 p = centred_uv;
float r = length(p);          // distance from centre
float a = atan(p.y, p.x);     // angle, -PI..PI
```

- Anything that is a function of `r` alone is **rings** (CandyWarp, the base disk in Aizawa).
- Anything that is a function of `a` alone is **spokes** (`sin(a * 6.0)` gives six).
- A function of `a * r` or `a + r` is a **spiral** (Atan2's `sin(a * k * l)`).

## Rotation

A 2×2 rotation matrix shows up everywhere, usually as a helper called `R` or `rotate`:

```glsl
mat2 R(float t) { return mat2(cos(t), -sin(t), sin(t), cos(t)); }
p = R(time) * p;
```

[Atan2](#atan2) rotates and then translates the plane; swap the order in `main()` and the
centre stops wandering. [Toric](#toric) uses the same `R` in 3-D by rotating two components
of `p` at a time (`p.xz *= R(u_time * 2.)`).

## Seams

`atan` jumps from PI to -PI across the negative x axis. Use integer frequencies
(`sin(a * 6.0)`, not `6.5`) or `abs(a)` to hide the seam. Atan2 does the latter.
