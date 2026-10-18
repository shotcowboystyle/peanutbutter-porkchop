// CandyWarp by mojovideotech — https://editor.isf.video/shaders/5e7a802d7c113618206dec38
// ISF inputs baked in at their defaults. CC BY-NC-SA 3.0 (see header in shader).
import { shaderViz } from '../shader.js';

export default shaderViz({
  title: 'CandyWarp',
  credit: 'mojovideotech — https://editor.isf.video/shaders/5e7a802d7c113618206dec38 (CC BY-NC-SA 3.0)',
  uniforms(gl, u, t, w, h) {
    gl.uniform2f(u('RENDERSIZE'), w, h);
    gl.uniform1f(u('TIME'), t);
  },
  frag: `
precision highp float;
uniform vec2 RENDERSIZE;
uniform float TIME;

const float scale = 84.0;
const float cycle = 0.4;
const float thickness = 0.1;
const float loops = 61.0;
const float warp = 2.5;
const float hue = 0.33;
const float tint = 0.1;
const float rate = 1.25;
const bool invert = false;

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
