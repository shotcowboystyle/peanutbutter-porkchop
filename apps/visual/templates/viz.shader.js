// __TITLE__ — <credit / source link>
import { shaderViz } from '../shader.js';

export default shaderViz({
  title: '__TITLE__',
  credit: 'you — https://example.com',
  tags: ['template'],
  about: `One paragraph on what this is and the single idea that makes it work.
Markdown is fine: **bold**, \`code\`, [links](https://thebookofshaders.com).`,
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
    scale: {
      type: 'float',
      default: 6,
      min: 1,
      max: 30,
      step: 0.1,
      group: 'Shape',
      doc: 'Pattern frequency.',
    },
    tint: { type: 'color', default: [0.2, 0.6, 1.0], group: 'Colour', doc: 'Base colour.' },
    bands: {
      type: 'int',
      default: 3,
      min: 1,
      max: 8,
      live: false,
      group: 'Shape',
      doc: 'Compile-time loop count (a #define; the shader rebuilds).',
    },
  },
  presets: {
    Default: {},
    Calm: { speed: 0.2, scale: 2 },
  },
  notes: [
    {
      title: 'Centred UV',
      find: 'vec2 uv =',
      body: 'Pixels to -1..1 on the short axis, so the pattern is aspect-correct.',
    },
    {
      title: 'Compile-time loop',
      find: 'for (int i = 0; i < bands',
      body: 'GLSL ES 1.0 loop bounds must be constant; `bands` is injected as a #define.',
    },
  ],
  uniforms(gl, u, t, w, h, p) {
    gl.uniform2f(u('resolution'), w, h);
    gl.uniform1f(u('time'), t * p.speed);
  },
  frag: `
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float scale;
uniform vec3 tint;

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);
  float v = 0.0;
  for (int i = 0; i < bands; i++) {
    float k = float(i + 1);
    v += sin(length(uv) * scale * k - time * k) / k;
  }
  vec3 col = tint * (0.5 + 0.5 * v);
  gl_FragColor = vec4(col, 1.0);
}
`,
});
