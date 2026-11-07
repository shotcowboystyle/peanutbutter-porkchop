// Hex grid — the site's original viz. Shader by the original author, after
// https://tympanus.net/Development/ScrollSpiral/
import { shaderViz } from '../shader.js';

export default shaderViz({
  title: 'Hex',
  credit: 'original site shader, after tympanus.net/Development/ScrollSpiral',
  tags: ['hex grid', 'coordinate transform', 'trig'],
  about: `A plane of hexagons that breathes, rotates and zooms. Every pixel converts its
position into **cube coordinates** on a hex grid (three axes that sum to zero), feeds those
through a few nested sines, and uses the result as a brightness per colour channel. The three
channels are offset in time by \`displace\`, which is where the rainbow fringing comes from.`,
  params: {
    speed: {
      type: 'float',
      default: 1,
      min: 0,
      max: 4,
      step: 0.01,
      group: 'Motion',
      doc: 'Clock multiplier for the whole effect.',
    },
    gridSize: {
      type: 'float',
      default: 6,
      min: 1,
      max: 20,
      step: 0.1,
      group: 'Grid',
      doc: 'Base number of hex cells across the short axis before zoom.',
    },
    wave: {
      type: 'float',
      default: 5,
      min: 0,
      max: 20,
      step: 0.1,
      group: 'Grid',
      doc: 'How quickly the cell shape morphs with distance from centre.',
    },
    detail: {
      type: 'float',
      default: 1,
      min: 0.1,
      max: 6,
      step: 0.05,
      group: 'Shading',
      doc: 'Frequency of the per-cell brightness sine. Higher = more bands.',
    },
    displace: {
      type: 'float',
      default: 1,
      min: 0,
      max: 4,
      step: 0.05,
      group: 'Shading',
      doc: 'Time offset between the R, G and B passes. 0 = greyscale.',
    },
    contrast: {
      type: 'float',
      default: 5,
      min: 1,
      max: 12,
      step: 0.5,
      group: 'Shading',
      doc: 'Exponent applied to the cell value. Sharper peaks as it rises.',
    },
    layers: {
      type: 'int',
      default: 1,
      min: 1,
      max: 6,
      live: false,
      group: 'Shading',
      doc: 'Compile-time loop count of stacked cell passes (a #define, so the shader rebuilds).',
    },
  },
  presets: {
    Default: {},
    'Fine lattice': { gridSize: 14, detail: 2.5, wave: 2 },
    'Slow mono': { speed: 0.3, displace: 0, contrast: 3 },
    Layered: { layers: 4, detail: 0.6, gridSize: 4 },
  },
  notes: [
    {
      title: 'Centred, aspect-correct UV',
      find: 'vec2 uv = (gl_FragCoord.xy',
      body: 'Map pixel coordinates to -1..1 on the short axis so the pattern stays round on wide screens.',
    },
    {
      title: 'Cartesian to hex',
      find: 'vec3 coordToHex',
      body: 'Rotate, then project onto cube coordinates (q, r, -q-r). Any hex-grid effect starts with a transform like this.',
    },
    {
      title: 'Compile-time constant',
      find: 'for (int i = 0; i < layers',
      body: 'GLSL ES 1.0 loop bounds must be constant, so `layers` is a #define injected by shaderViz rather than a uniform.',
    },
    {
      title: 'Per-channel time offset',
      find: 'for (int i = 0; i < 3; i++)',
      body: 'The three channels evaluate the same field at slightly different times. That offset is the colour fringe.',
    },
  ],
  uniforms(gl, u, t, w, h, p) {
    gl.uniform2f(u('resolution'), w, h);
    gl.uniform1f(u('time'), 1 + t * 3 * p.speed); // original: starts at 1.0, +0.05 per frame
  },
  frag: `
#define TWO_PI 6.2831853072
#define PI 3.14159265359

precision highp float;
uniform vec2 resolution;
uniform float time;

uniform float displace;
uniform float gridSize;
uniform float detail;
uniform float wave;
uniform float contrast;
// layers is a #define (compile-time loop bound)

vec2 rotate(vec2 v, float angle) {
	float c = cos(angle);
	float s = sin(angle);
	return v * mat2(c, -s, s, c);
}

vec3 coordToHex(vec2 coord, float scale, float angle) {
	vec2 c = rotate(coord, angle);
	float q = (1.0 / 3.0 * sqrt(3.0) * c.x - 1.0 / 3.0 * c.y) * scale;
	float r = 2.0 / 3.0 * c.y * scale;
	return vec3(q, r, -q - r);
}

vec3 hexToCell(vec3 hex, float m) {
	return sin(hex / m) * 2.0 - 1.0;
}

float absMax(vec3 v) {
	return max(max(abs(v.x), abs(v.y)), abs(v.z));
}

float nsin(float value) {
	return sin(value * TWO_PI) * 0.5 + 0.5;
}

float hexToFloat(vec3 hex, float amt) {
	return mix(absMax(hex), 1.0 - length(hex) / sqrt(3.0), amt);
}

float calc(vec3 hex, float time, float len) {
	float value = 0.0;
	for (int i = 0; i < layers; i++) {
		vec3 cell = hexToCell(hex, 1.0);
		value += nsin(
			hexToFloat(
				cell,
				nsin(len * wave + time + float(i) / float(layers))
			) * detail + nsin(time * 0.5)
		);
	}

	return value / float(layers);
}

void main(void) {
	vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
	float t = time *0.02;

	float rgb[3];
	float len = 1.0 - length(uv)*0.03;

	float zoom = nsin(t*0.1) + len *10.0;
	float angle = TWO_PI * nsin(t * 0.05);
	vec3 hex = coordToHex(uv, gridSize*zoom, angle);

	for (int i = 0; i < 3; i++) {
		float t2 = t + float(i) * displace;
		hex[i] += 0.2;
		rgb[i] = pow(calc(hex, t * displace, len), contrast) * (0.2 + 0.8 * sin(PI * len * 0.5)) * 2. - 1.0;
	}

	gl_FragColor = vec4(rgb[0], rgb[1], rgb[2], 1.0);
}
`,
});
