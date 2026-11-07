// CandyWarp by mojovideotech — https://editor.isf.video/shaders/5e7a802d7c113618206dec38
// ISF inputs exposed as params at their defaults. CC BY-NC-SA 3.0 (see header in shader).
import { shaderViz } from '../shader.js';

export default shaderViz({
  title: 'CandyWarp',
  credit:
    'mojovideotech — https://editor.isf.video/shaders/5e7a802d7c113618206dec38 (CC BY-NC-SA 3.0)',
  tags: ['rings', 'mod()', 'ISF'],
  about: `Concentric rings whose radius is warped by a 2-D sine field, then coloured by
\`fract()\` of a scaled distance. Everything is driven by one number per pixel: the distance
\`d\` from the centre. Bending \`d\` bends the rings; taking \`mod(d, ...)\` repeats them.
Ported from an ISF shader, so every slider below is one of the original's inputs.`,
  params: {
    scale: {
      type: 'float',
      default: 84,
      min: 10,
      max: 200,
      step: 1,
      group: 'Rings',
      doc: 'Ring thickness unit, as a fraction of the canvas height.',
    },
    cycle: {
      type: 'float',
      default: 0.4,
      min: 0.05,
      max: 2,
      step: 0.01,
      group: 'Rings',
      doc: 'Radius scale. Smaller = rings spread wider.',
    },
    thickness: {
      type: 'float',
      default: 0.1,
      min: 0,
      max: 1,
      step: 0.01,
      group: 'Rings',
      doc: 'Fraction of each ring band that is lit.',
    },
    loops: {
      type: 'float',
      default: 61,
      min: 1,
      max: 200,
      step: 1,
      group: 'Rings',
      doc: 'Number of rings across the radius.',
    },
    warp: {
      type: 'float',
      default: 2.5,
      min: 0,
      max: 10,
      step: 0.1,
      group: 'Warp',
      doc: 'Amplitude of the sine field that bends the rings.',
    },
    rate: {
      type: 'float',
      default: 1.25,
      min: 0,
      max: 5,
      step: 0.05,
      group: 'Warp',
      doc: 'Speed of the warp and the inward drift.',
    },
    hue: {
      type: 'float',
      default: 0.33,
      min: 0,
      max: 1,
      step: 0.01,
      group: 'Colour',
      doc: 'Red-channel frequency relative to green.',
    },
    tint: {
      type: 'float',
      default: 0.1,
      min: 0,
      max: 1,
      step: 0.01,
      group: 'Colour',
      doc: 'Blue-channel frequency relative to green.',
    },
    invert: {
      type: 'bool',
      default: false,
      group: 'Colour',
      doc: 'Divide by the ring mask instead of multiplying: dark rings on bright.',
    },
  },
  presets: {
    Default: {},
    Vinyl: { loops: 120, thickness: 0.5, warp: 0.4, hue: 0.9, tint: 0.9 },
    Jelly: { warp: 7, rate: 0.6, scale: 40, loops: 20 },
    Negative: { invert: true, thickness: 0.3, loops: 30 },
  },
  notes: [
    {
      title: 'Distance from centre',
      find: 'float d = length(pos);',
      body: 'Radial effects start here. Every later line is a function of `d`.',
    },
    {
      title: 'Warping the radius',
      find: 'd += warp',
      body: 'Adding a slow 2-D sine field to `d` before it is used bends perfect circles into the candy shape.',
    },
    {
      title: 'Repeating rings with mod()',
      find: 'float v = mod(d',
      body: '`mod` folds the radius into a repeating band; `abs(v - half)` turns it into a triangle wave so each ring has a centre line.',
    },
    {
      title: 'Colour from fract()',
      find: 'vec3 m = fract',
      body: 'Three different frequencies of `fract()` on the same distance give three sawtooth channels, hence the rainbow banding.',
    },
  ],
  uniforms(gl, u, t, w, h) {
    gl.uniform2f(u('RENDERSIZE'), w, h);
    gl.uniform1f(u('TIME'), t);
  },
  frag: `
precision highp float;
uniform vec2 RENDERSIZE;
uniform float TIME;

uniform float scale;
uniform float cycle;
uniform float thickness;
uniform float loops;
uniform float warp;
uniform float hue;
uniform float tint;
uniform float rate;
uniform bool invert;

////////////////////////////////////////////////////////////
// CandyWarp  by mojovideotech
//
// based on :
// glslsandbox.com/e#38710.0
// Posted by Trisomie21
// modified by @hintz
//
// Creative Commons Attribution-NonCommercial-ShareAlike 3.0
////////////////////////////////////////////////////////////

void main(void)
{
	float s = RENDERSIZE.y / scale;
	float radius = RENDERSIZE.x / cycle;
	float gap = s * (1.0 - thickness);
	vec2 pos = gl_FragCoord.xy - RENDERSIZE.xy * 0.5;
	float d = length(pos);
	float T = TIME * rate;
	d += warp * (sin(pos.y * 0.25 / s + T) * sin(pos.x * 0.25 / s + T * 0.5)) * s * 5.0;
	float v = mod(d + radius / (loops * 2.0), radius / loops);
	v = abs(v - radius / (loops * 2.0));
	v = clamp(v - gap, 0.0, 1.0);
	d /= radius - T;
	vec3 m = fract((d - 1.0) * vec3(loops * hue, -loops, loops * tint) * 0.5);
	if (invert) 	gl_FragColor = vec4(m / v, 1.0);
	else gl_FragColor = vec4(m * v, 1.0);
}
`,
});
