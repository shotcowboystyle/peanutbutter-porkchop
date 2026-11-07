// glslsandbox.com/e#362696.0 (the stock sandbox plasma). mouse exposed as two sliders.
import { shaderViz } from '../shader.js';

export default shaderViz({
  title: 'Plasma',
  credit: 'https://glslsandbox.com/e#362696.0',
  tags: ['plasma', 'sine sum', 'classic'],
  about: `The classic demoscene plasma: sum a handful of sines of the pixel position, each
with its own frequency that itself drifts with time, and colour the result. It is the
simplest possible "shader that moves" and a good first file to edit: change one number in
the \`color +=\` lines and watch what happens.`,
  params: {
    speed: {
      type: 'float',
      default: 1,
      min: 0,
      max: 4,
      step: 0.01,
      group: 'Motion',
      doc: 'Clock multiplier.',
    },
    freq: {
      type: 'float',
      default: 1,
      min: 0.1,
      max: 4,
      step: 0.01,
      group: 'Shape',
      doc: 'Scales every spatial frequency at once. Higher = finer bands.',
    },
    mouseX: {
      type: 'float',
      default: 0,
      min: -2,
      max: 2,
      step: 0.01,
      group: 'Shape',
      doc: 'The sandbox `mouse.x`, which simply offsets the pattern.',
    },
    mouseY: {
      type: 'float',
      default: 0,
      min: -2,
      max: 2,
      step: 0.01,
      group: 'Shape',
      doc: 'The sandbox `mouse.y`.',
    },
    contrast: {
      type: 'float',
      default: 0.5,
      min: 0,
      max: 2,
      step: 0.01,
      group: 'Colour',
      doc: 'Overall gain on the summed field.',
    },
    blue: {
      type: 'float',
      default: 0.75,
      min: 0,
      max: 2,
      step: 0.01,
      group: 'Colour',
      doc: 'Weight of the blue channel, which is a sine of the field plus time.',
    },
  },
  presets: {
    Default: {},
    Fine: { freq: 3, contrast: 0.3 },
    'Slow blue': { speed: 0.25, blue: 1.8, contrast: 0.2 },
  },
  notes: [
    {
      title: 'Normalised position',
      find: 'vec2 position =',
      body: '0..1 across the canvas, not aspect-corrected: the pattern stretches on wide screens, which the original accepted.',
    },
    {
      title: 'Summing sines',
      find: 'color += sin( position.x * cos( time / 15.0 )',
      body: 'Each term is sin(position * frequency). The frequency is itself cos(time / k), so the bands slowly compress and expand.',
    },
    {
      title: 'Colour mapping',
      find: 'gl_FragColor = vec4( vec3( color',
      body: 'A scalar field becomes colour by feeding it to R, G and B with different transforms. Try swapping channels.',
    },
  ],
  uniforms(gl, u, t, w, h, p) {
    gl.uniform1f(u('time'), t * p.speed);
    gl.uniform2f(u('mouse'), p.mouseX, p.mouseY);
    gl.uniform2f(u('resolution'), w, h);
  },
  frag: `
precision highp float;

uniform float time;
uniform vec2 mouse;
uniform vec2 resolution;
uniform float freq;
uniform float contrast;
uniform float blue;
//siema

void main( void ) {

	vec2 position = ( gl_FragCoord.xy / resolution.xy ) + mouse / 4.0;
	position *= freq;

	float color = 0.0;
	color += sin( position.x * cos( time / 15.0 ) * 80.0 ) + cos( position.y * cos( time / 15.0 ) * 10.0 );
	color += sin( position.y * sin( time / 10.0 ) * 40.0 ) + cos( position.x * sin( time / 25.0 ) * 40.0 );
	color += sin( position.x * sin( time / 5.0 ) * 10.0 ) + sin( position.y * sin( time / 35.0 ) * 80.0 );
	color *= sin( time / 10.0 ) * contrast;

	gl_FragColor = vec4( vec3( color, color * 0.5, sin( color + time / 3.0 ) * blue ), 1.0 );

}
`,
});
