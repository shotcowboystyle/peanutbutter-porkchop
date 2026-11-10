// "Sponge Tunnel" by hatuxes — https://www.shadertoy.com/view/ttK3Wt
// License: CC BY-NC-SA 3.0 (Shadertoy default).
import { shaderViz } from '../shader.js';

export default shaderViz({
  title: 'Sponge Tunnel',
  credit: 'hatuxes — https://www.shadertoy.com/view/ttK3Wt',
  webgl2: true,
  tags: ['raymarching', 'menger sponge', 'fractal', 'tunnel'],
  about: `A **Menger sponge** repeated through space with \`mod\`, then folded into eight
polar sectors around the view axis (\`pmod\`) and flown through. Shading is just the step count
of the raymarch: hits found in fewer steps are brighter, which reads as ambient occlusion.`,
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
  },
  presets: { Default: {}, Slow: { speed: 0.4 } },
  notes: [
    {
      title: 'Menger sponge',
      find: 'float mengersponge(',
      body: 'A box minus a cross, repeated at 1/3 scale five times.',
    },
    {
      title: 'Polar fold',
      find: 'vec2 pmod(vec2 p, float r){',
      body: 'Snap the angle to n sectors so the tunnel has radial symmetry; the sector size breathes with time.',
    },
    {
      title: 'Step-count shading',
      find: 'col=vec3(1.0-float(i)*0.02);',
      body: 'Fewer steps = brighter.',
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
out vec4 shadertoyFragColor;

const float pi=acos(-1.0);
const float pi2=pi*2.0;

mat2 rot(float a){
    float c=cos(a), s=sin(a);
    return mat2(c, s, -s, c);
}

vec2 pmod(vec2 p, float r){
    float a=atan(p.x, p.y)+pi/r;
    float n=pi2*(-sin(0.42*iTime)*sin(0.42*iTime)+0.35)/r;
    a=floor(a/n)*n-pi;
    return p*rot(-a);
}

float crossf(vec3 p, float r){
    p=abs(p);
    float dxy=max(p.x, p.y);
    float dyz=max(p.y, p.z);
    float dxz=max(p.z, p.x);
    return min(dxy, min(dyz, dxz))-r;
}

float boxf(vec3 p, vec3 b){
    p=abs(p)-b;
    return length(max(p, 0.0))+min(max(p.x, max(p.y, p.z)), 0.0);
}


float mengersponge(vec3 p, float scale, float width){
    float d=boxf(p, vec3(1.0));
    float s=1.0;
    for(int i=0; i<5; i++){
        vec3 a=mod(p*s, 2.0)-1.0;
        s*=scale;
        vec3 r=1.0-scale*abs(a);
        float c=crossf(r, width)/s;
        d=max(d,c);
    }
    return d;
}

float map(vec3 p){
    p=mod(p, 4.0)-2.0;
    return mengersponge(p, 3.0, 1.0);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv=(fragCoord.xy*2.0-iResolution.xy)/min(iResolution.x, iResolution.y);
    vec3 ro=vec3(0.0, 0.0, 8.0*iTime);
    vec3 rd=normalize(vec3(uv, 0.8*sin(0.58*iTime)));
    vec3 col=vec3(0);
    float dp=0.0, dpp=0.0;
    for(int i=0; i<99; i++){
        vec3 pos=ro+rd*dp;
        pos.xy*=rot(0.1*iTime);
        pos.xy=pmod(pos.xy, 8.0);
        float d=map(pos);
        if(d<0.00001){
            col=vec3(1.0-float(i)*0.02);
            break;
        }
        dp+=d*0.8;
        dpp=d*75.516;
    }
    fragColor=vec4(col, dpp);
}

void main() { mainImage(shadertoyFragColor, gl_FragCoord.xy); }
`,
});
