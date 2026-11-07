// "Display hacked by atan2" by Lea Rosema — https://codepen.io/learosema/pen/avKerm
import { shaderViz } from '../shader.js';

export default shaderViz({
  title: 'Atan2',
  credit: 'Lea Rosema — https://codepen.io/learosema/pen/avKerm',
  tags: ['polar', 'atan', 'rotation'],
  about: `Polar coordinates in action. \`atan(y, x)\` gives every pixel an angle around a
moving centre; sines of that angle, multiplied by distance, produce the spokes and petals.
The whole plane is also rotated and translated each frame, so the centre swings around the
screen. The pastel pass at the end lifts every channel toward white.`,
  params: {
    speed: {
      type: 'float',
      default: 0.2,
      min: 0,
      max: 1,
      step: 0.005,
      group: 'Motion',
      doc: 'Clock multiplier (original: 0.2).',
    },
    spin: {
      type: 'float',
      default: 1,
      min: -3,
      max: 3,
      step: 0.05,
      group: 'Motion',
      doc: 'Rotation rate of the whole plane. Negative spins the other way.',
    },
    drift: {
      type: 'float',
      default: 0.6,
      min: 0,
      max: 1.5,
      step: 0.01,
      group: 'Motion',
      doc: "Radius of the centre's wander.",
    },
    spokes: {
      type: 'float',
      default: 10,
      min: 1,
      max: 40,
      step: 0.5,
      group: 'Pattern',
      doc: 'Angular frequency of the red channel. Integer values close seamlessly.',
    },
    rings: {
      type: 'float',
      default: 3.3,
      min: 0.5,
      max: 10,
      step: 0.1,
      group: 'Pattern',
      doc: 'Multiplier on distance, so how fast the petals repeat outward.',
    },
    pastel: {
      type: 'float',
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      group: 'Colour',
      doc: '0 = raw saturated sines, 1 = the original washed-out look.',
    },
  },
  presets: {
    Default: {},
    Raw: { pastel: 0, spokes: 6 },
    Tight: { spokes: 30, rings: 8, drift: 0.2, spin: 0.2 },
  },
  notes: [
    {
      title: 'Rotate then translate',
      find: 'vec2 p  = R(p0, time',
      body: 'Order matters: rotating about the origin and then adding an offset makes the centre orbit. Swap them and it would spin in place.',
    },
    {
      title: 'The angle',
      find: 'float a = abs(atan(p.y, p.x));',
      body: 'atan(y, x) returns -PI..PI. Taking abs() mirrors the pattern across the x axis.',
    },
    {
      title: 'Angle times distance',
      find: 'float r = 1.0*sin(a',
      body: 'sin(angle * k * distance) is a spiral: at larger radius the same angle step covers more cycles.',
    },
    {
      title: 'Pastel',
      find: 'vec3 pastelize(vec3 c)',
      body: 'Add the channel average to each channel and clamp. A cheap way to desaturate toward white.',
    },
  ],
  uniforms(gl, u, t, w, h, p) {
    gl.uniform1f(u('width'), w);
    gl.uniform1f(u('height'), h);
    gl.uniform1f(u('time'), t * p.speed); // original: ms * .0002
  },
  frag: `
precision mediump float;
uniform float time;
uniform float width;
uniform float height;
uniform float spin;
uniform float drift;
uniform float spokes;
uniform float rings;
uniform float pastel;

#define PI 3.14159265358979323846264

vec3 lighten(vec3 c, float d) {
	return vec3(min(1.0, c.r + d), min(1.0, c.g + d), min(1.0, c.b + d));
}

vec3 pastelize(vec3 c) {
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
  	float r = 1.0*sin(a * sin(t*0.1)*spokes * (mod(l, 10.0)) * rings);
	float g = 0.6*cos(a * cos(sin(sqrt(a))*0.3)*(spokes + 2.0) * (mod(l, 10.0)) * rings);
	float b = 0.7*sin(a * cos(t*0.1)*(spokes + 3.0) * (mod(l, 10.0)) * rings);
	return vec3(r, g, b);
}

void main() {
	vec2 resolution = vec2(width, height);
	vec2 p0 = (gl_FragCoord.xy / resolution) - vec2(0.5,0.5);
	vec2 p  = R(p0, time * spin) + vec2(cos(time*1.6)*drift,sin(time)*drift);

	vec3 col = getdizzy(p, time);
	gl_FragColor = vec4(mix(col, pastelize(col), pastel), 1.0);
}
`,
});
