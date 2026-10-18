// Hex grid — the site's original viz. Shader by the original author, after
// https://tympanus.net/Development/ScrollSpiral/
import { shaderViz } from '../shader.js';

export default shaderViz({
  title: 'Hex',
  credit: 'original site shader, after tympanus.net/Development/ScrollSpiral',
  uniforms(gl, u, t, w, h) {
    gl.uniform2f(u('resolution'), w, h);
    gl.uniform1f(u('time'), 1 + t * 3); // original: starts at 1.0, +0.05 per frame
  },
  frag: `
#define TWO_PI 6.2831853072
#define PI 3.14159265359

precision highp float;
uniform vec2 resolution;
uniform float time;

const float displace = 1.;
const float gridSize = 6.;
const int layers = 1;
const float detail = 1.0;
const float wave = 5.0;

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
		rgb[i] = pow(calc(hex, t * displace, len),5.0) * (0.2 + 0.8 * sin(PI * len * 0.5)) * 2. - 1.0;
	}

	gl_FragColor = vec4(rgb[0], rgb[1], rgb[2], 1.0);
}
`,
});
