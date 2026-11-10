// "Segmented spiral whirlpool" by ChunderFPV — https://www.shadertoy.com/view/4ctcRl
// License: CC BY-NC-SA 3.0 (Shadertoy default).
import { shaderViz } from '../shader.js';

export default shaderViz({
  title: 'Segmented Whirlpool',
  credit: 'ChunderFPV — https://www.shadertoy.com/view/4ctcRl',
  webgl2: true,
  tags: ['raymarching', 'vortex', 'polar', 'SDF'],
  about: `Rings of rounded boxes in polar coordinates, each ring orbiting at a speed set by
its radius, with the inner rings bent down into a funnel: a **whirlpool**. The colour is not
lit; it is accumulated along the ray from the distance itself (\`min(s, exp(-s/.08))\`), which
gives soft glowing edges.`,
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
  presets: { Default: {}, Calm: { speed: 0.3 } },
  notes: [
    {
      title: 'Polar segments',
      find: 'y = round(max(p.y-i, 0.)/l)*l+i;',
      body: 'Snap the radius to a ring, then repeat the angle into boxes on that ring.',
    },
    {
      title: 'Funnel',
      find: 'p.z += sqrt(y/w)*w;',
      body: 'Inner rings curve down: z grows with the square root of the radius.',
    },
    {
      title: 'Glow shading',
      find: 'c += min(s, exp(-s/.08))',
      body: 'Accumulate colour every step, weighted by distance.',
    },
  ],
  uniforms(gl, u, t, w, h, p) {
    gl.uniform3f(u('iResolution'), w, h, 1);
    gl.uniform1f(u('iTime'), t * p.speed);
    gl.uniform4f(u('iMouse'), 0, 0, 0, 0); // Shadertoy's no-mouse state
  },
  frag: `#version 300 es
precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;
out vec4 shadertoyFragColor;

// updated (slightly different) SDF with material id here: https://www.shadertoy.com/view/NcsyRn

#define T (iTime*5.)
#define A(v) mat2(cos(m.v*3.1416 + vec4(0, -1.5708, 1.5708, 0)))       // rotate
#define H(v) (cos(((v)+.5)*6.2832 + radians(vec3(60, 0, -60)))*.5+.5)  // hue

float sdRoundBox( vec3 p, vec3 b, float r )
{
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
}

float map(vec3 u)
{
    float t = T,    // speed
          l = 5.,   // loop to reduce clipping
          w = 40.,  // z warp size
          s = .4,   // object size (max)
          f = 1e20, i = 0., y, z;
    
    u.yz = -u.zy;
    u.xy = vec2(atan(u.x, u.y), length(u.xy));  // polar transform
    u.x += t/6.;                                // counter rotation
    
    vec3 p;
    for (; i++<l;)
    {
        p = u;
        y = round(max(p.y-i, 0.)/l)*l+i;  // segment y & skip rows
        p.x *= y;                         // scale x with rounded y
        p.x -= sqrt(y*t*t*2.);            // move x
        p.x -= round(p.x/6.2832)*6.2832;  // segment x
        p.y -= y;                         // move y
        p.z += sqrt(y/w)*w;               // curve inner z down
        z = cos(y*t/50.)*.5+.5;           // radial wave
        p.z += z*2.;                      // wave z
        //p = abs(p);
        //f = min(f, max(p.x, max(p.y, p.z)) - s*z);  // cubes
        f = min(f, sdRoundBox(p, vec3(s*z), .1));  // a bit nicer
    }
    
    return f;
}

void mainImage( out vec4 C, in vec2 U )
{
    float l = 50.,  // loop
          i = 0., d = i, s, r;
    
    vec2 R = iResolution.xy,
         m = iMouse.z > 0. ?  // clicking?
               (iMouse.xy - R/2.)/R.y:  // mouse coords
               vec2(0, -.17);           // default (noclick)
    
    vec3 o = vec3(0, 20, -120),  // camera
         u = normalize(vec3(U - R/2., R.y)),  // 3d coords
         c = vec3(0), p;
    
    mat2 v = A(y),  // pitch
         h = A(x);  // yaw
    
    for (; i++<l;)  // raymarch
    {
        p = u*d + o;
        p.yz *= v;
        p.xz *= h;
        
        s = map(p);
        r = (cos(round(length(p.xz))*T/50.)*.7 - 1.8)/2.;  // color gradient
        c += min(s, exp(-s/.08))  // black & white
           * H(r+.5) * (r+2.4);      // color
        
        if (s < 1e-3 || d > 1e3) break;
        d += s*.7;
    }
    
    C = vec4(exp(log(c)/2.2), 1);
}

void main() { mainImage(shadertoyFragColor, gl_FragCoord.xy); }
`,
});
