// "Display hacked by atan2" by Lea Rosema — https://codepen.io/learosema/pen/avKerm
import { shaderViz } from '../shader.js';

export default shaderViz({
  title: 'Atan2',
  credit: 'Lea Rosema — https://codepen.io/learosema/pen/avKerm',
  uniforms(gl, u, t, w, h) {
    gl.uniform1f(u('width'), w);
    gl.uniform1f(u('height'), h);
    gl.uniform1f(u('time'), t * 0.2); // original: ms * .0002
  },
  frag: `
precision mediump float;
uniform float time;
uniform float width;
uniform float height;

#define PI 3.14159265358979323846264

vec3 lighten(vec3 c, float d) {
	return vec3(min(1.0, c.r + d), min(1.0, c.g + d), min(1.0, c.b + d));
}

vec3 pastel(vec3 c) {
	float avg = (c.r+c.g+c.b)/3.0;
	return lighten(c, avg);
}

vec2 R(vec2 p,float a) {
	return vec2( p.x*cos(a) + p.y*sin(a),
			    -p.x*sin(a) + p.y*cos(a));
}

vec3 getdizzy(vec2 p, float t){
	float a = abs(atan(p.y, p.x));
	vec2  c = vec2(0.0, sin(t)*1.2);
	float l = pow(distance(p,c), 1.3);
  	float r = 1.0*sin(a * sin(t*0.1)*10.0 * (mod(l, 10.0)) * 3.3);
	float g = 0.6*cos(a * cos(sin(sqrt(a))*0.3)*12.0 * (mod(l, 10.0)) * 3.3);
	float b = 0.7*sin(a * cos(t*0.1)*13.0 * (mod(l, 10.0)) * 3.3);
	return vec3(r, g, b);
}

void main() {
	vec2 resolution = vec2(width, height);
	vec2 p0 = (gl_FragCoord.xy / resolution) - vec2(0.5,0.5);
	vec2 p  = R(p0, time) + vec2(cos(time*1.6)*0.6,sin(time)*0.6);

	gl_FragColor = vec4(pastel(getdizzy(p, time)), 1.0);
}
`,
});
