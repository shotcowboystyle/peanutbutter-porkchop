// "Shader Art Coding Introduction" by kishimisu — https://www.shadertoy.com/view/mtyGWy
// License: CC BY-NC-SA 3.0 (Shadertoy default).
import { shaderViz } from '../shader.js';

export default shaderViz({
  title: 'Shader Art Intro',
  credit: 'kishimisu — https://www.shadertoy.com/view/mtyGWy',
  webgl2: true,
  tags: ['fractal', 'SDF', 'repetition', 'palette', 'tutorial'],
  about: `kishimisu's companion shader to the
[Shader Art Coding introduction video](https://youtu.be/f4s1h2YETNY). Four layers of
\`fract(uv * 1.5) - 0.5\` repeat space into ever smaller cells; in each cell the distance to
the centre is pushed through \`sin\` and an inverse \`0.01 / d\` to make glowing rings, coloured
by an [Inigo Quilez cosine palette](https://iquilezles.org/articles/palettes/).`,
  params: {
    speed: {
      type: 'float',
      default: 1,
      min: 0,
      max: 4,
      step: 0.01,
      group: 'Motion',
      doc: 'Clock multiplier (scales iTime).',
    },
    phase: {
      type: 'color',
      default: [0.263, 0.416, 0.557],
      group: 'Colour',
      doc: 'The palette phase `d`: shifts where each channel peaks along the gradient.',
    },
  },
  presets: { Default: {}, Warm: { phase: [0, 0.1, 0.2] }, Slow: { speed: 0.3 } },
  notes: [
    {
      title: 'Space repetition',
      find: 'uv = fract(uv * 1.5) - 0.5;',
      body: 'Scale up then fract: each loop tiles the previous tiling, giving the fractal nesting.',
    },
    {
      title: 'Ring glow',
      find: 'd = pow(0.01 / d, 1.2);',
      body: 'Inverting a small distance gives a bright, soft falloff; the power sharpens it.',
    },
    {
      title: 'Cosine palette',
      find: 'return a + b*cos( 6.28318*(c*t+d) );',
      body: 'a + b·cos(2π(c·t + d)) maps one number to a smooth colour ramp. `d` is the Phase control.',
    },
  ],
  uniforms(gl, u, t, w, h, p) {
    gl.uniform3f(u('iResolution'), w, h, 1);
    gl.uniform1f(u('iTime'), t * p.speed);
  },
  frag: `#version 300 es
precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform vec3 phase;
out vec4 shadertoyFragColor;

/* This animation is the material of my first youtube tutorial about creative 
   coding, which is a video in which I try to introduce programmers to GLSL 
   and to the wonderful world of shaders, while also trying to share my recent 
   passion for this community.
                                       Video URL: https://youtu.be/f4s1h2YETNY
*/

//https://iquilezles.org/articles/palettes/
vec3 palette( float t ) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = phase;

    return a + b*cos( 6.28318*(c*t+d) );
}

//https://www.shadertoy.com/view/mtyGWy
void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 uv = (fragCoord * 2.0 - iResolution.xy) / iResolution.y;
    vec2 uv0 = uv;
    vec3 finalColor = vec3(0.0);
    
    for (float i = 0.0; i < 4.0; i++) {
        uv = fract(uv * 1.5) - 0.5;

        float d = length(uv) * exp(-length(uv0));

        vec3 col = palette(length(uv0) + i*.4 + iTime*.4);

        d = sin(d*8. + iTime)/8.;
        d = abs(d);

        d = pow(0.01 / d, 1.2);

        finalColor += col * d;
    }
        
    fragColor = vec4(finalColor, 1.0);
}

void main() { mainImage(shadertoyFragColor, gl_FragCoord.xy); }
`,
});
