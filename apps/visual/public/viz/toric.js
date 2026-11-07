// "Toric" by Liam Egan (shubniggurath) — https://codepen.io/shubniggurath/pen/ZYpmaEd
// Original ran through wtc-gl with a DollyCamera at (100,100,-200); the shader
// only ever saw u_cp = position * (-1,1,1), so that is baked in below.
import { shaderViz } from '../shader.js';

export default shaderViz({
  title: 'Toric',
  credit: 'Liam Egan — https://codepen.io/shubniggurath/pen/ZYpmaEd',
  webgl2: true,
  dpr: 1, // 256-step raymarcher; dpr 1 keeps it smooth on laptops
  tags: ['raymarching', 'SDF', 'gyroid', 'lighting'],
  about: `A **raymarched** torus carved by a gyroid. There is no geometry: for every pixel a
ray leaves the camera and steps forward by the distance to the nearest surface (the *signed
distance function*, \`map()\`) until it lands. The torus SDF is intersected with a gyroid
field, the surface normal is estimated by sampling the SDF around the hit, and a small
lighting model (diffuse, hemisphere, back light, fresnel, AO) shades it.`,
  params: {
    speed: {
      type: 'float',
      default: 0.3,
      min: 0,
      max: 1.5,
      step: 0.01,
      group: 'Motion',
      doc: 'Clock multiplier (the original ran at 1.0).',
    },
    fov: {
      type: 'float',
      default: 0.8,
      min: 0.2,
      max: 2,
      step: 0.01,
      group: 'Camera',
      doc: 'Base field of view factor.',
    },
    fovAmp: {
      type: 'float',
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
      group: 'Camera',
      doc: 'How much the FOV breathes with cos(time).',
    },
    major: {
      type: 'float',
      default: 2,
      min: 0.5,
      max: 4,
      step: 0.05,
      group: 'Shape',
      doc: 'Torus ring radius.',
    },
    tube: {
      type: 'float',
      default: 1.8,
      min: 0.2,
      max: 3,
      step: 0.05,
      group: 'Shape',
      doc: 'Torus tube radius. Larger than `major` turns it inside out.',
    },
    breathe: {
      type: 'float',
      default: 0.3,
      min: 0,
      max: 1,
      step: 0.01,
      group: 'Shape',
      doc: 'Amplitude of the tube radius pulse.',
    },
    gyroid: {
      type: 'float',
      default: 4,
      min: 1,
      max: 12,
      step: 0.1,
      group: 'Shape',
      doc: 'Frequency of the gyroid field that carves the surface.',
    },
    thickness: {
      type: 'float',
      default: 0.3,
      min: 0.02,
      max: 0.8,
      step: 0.01,
      group: 'Shape',
      doc: 'Shell thickness after the gyroid cut.',
    },
    colA: { type: 'color', default: [0.8, 0.3, 0.6], group: 'Colour', doc: 'Surface colour A.' },
    colB: { type: 'color', default: [0.6, 0.3, 0.8], group: 'Colour', doc: 'Surface colour B.' },
    bgCentre: {
      type: 'color',
      default: [0.9, 0.85, 0.8],
      group: 'Colour',
      doc: 'Background at the centre of the screen.',
    },
    bgEdge: {
      type: 'color',
      default: [0.35, 0.5, 0.75],
      group: 'Colour',
      doc: 'Background toward the edges.',
    },
    diffuse: {
      type: 'float',
      default: 1,
      min: 0,
      max: 3,
      step: 0.05,
      group: 'Light',
      doc: 'Diffuse light strength.',
    },
    fresnel: {
      type: 'float',
      default: 0.3,
      min: 0,
      max: 2,
      step: 0.05,
      group: 'Light',
      doc: 'Rim light strength.',
    },
    maxSteps: {
      type: 'int',
      default: 256,
      min: 16,
      max: 512,
      step: 16,
      live: false,
      group: 'Quality',
      doc: 'Max raymarch steps (compile-time). Lower is faster and shows the classic banding artefacts.',
    },
  },
  presets: {
    Default: {},
    Coral: {
      gyroid: 8,
      thickness: 0.12,
      colA: [1, 0.5, 0.3],
      colB: [1, 0.85, 0.6],
      bgEdge: [0.1, 0.2, 0.4],
    },
    'Low-fi': { maxSteps: 32, fovAmp: 0, speed: 0.15 },
    'Fat ring': { major: 1.2, tube: 2.6, gyroid: 2.5, thickness: 0.5 },
  },
  notes: [
    {
      title: 'The SDF',
      find: 'Model model(vec3 p) {',
      body: 'Everything about the shape lives here. `length(vec2(p.y, length(p.xz) - major)) - tube` is a torus; `D()` is a gyroid; combining them with `length(vec2(d, g)) - thickness` makes a shell.',
    },
    {
      title: 'Marching',
      find: 'Surface march( in Camera cam )',
      body: 'Step along the ray by the SDF value (times STEP_MULTIPLIER for safety). Stop when close enough or too far.',
    },
    {
      title: 'Normal by finite differences',
      find: 'vec3 calcNormal( in vec3 pos )',
      body: 'Sample the SDF a hair left/right, up/down, front/back. The gradient of a distance field is the surface normal.',
    },
    {
      title: 'Compile-time step count',
      find: 'for( int i=0; i< maxSteps ; i++ )',
      body: '`maxSteps` is a #define so the loop bound is constant. Try 32 to see what under-marching looks like.',
    },
    {
      title: 'Lighting',
      find: 'vec3 shade(vec3 col',
      body: 'Diffuse + hemisphere ambient + back light + fresnel, each scaled by AO. A compact, readable lighting rig worth copying.',
    },
  ],
  uniforms(gl, u, t, w, h, p) {
    gl.uniform2f(u('u_resolution'), w, h);
    gl.uniform1f(u('u_time'), t * p.speed); // default 0.3: 70% slower than the original
    gl.uniform3f(u('u_cp'), -100, 100, -200);
  },
  frag: `#version 300 es
  precision highp float;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec3 u_cp;
  uniform float fov;
  uniform float fovAmp;
  uniform float major;
  uniform float tube;
  uniform float breathe;
  uniform float gyroid;
  uniform float thickness;
  uniform vec3 colA;
  uniform vec3 colB;
  uniform vec3 bgCentre;
  uniform vec3 bgEdge;
  uniform float diffuse;
  uniform float fresnel;

  out vec4 c;

  /* Shading constants */
  /* --------------------- */
  const vec3 LP = vec3(-0.6, 0.7, -0.3);  // light position
  const vec3 LC = vec3(.85,0.80,0.70);    // light colour
  const vec3 HC1 = vec3(.5, .4, .3);      // hemisphere light colour 1
  const vec3 HC2 = vec3(0.1,.1,.6)*.5;    // hemisphere light colour 2
  const vec3 HLD = vec3(0,1,0);     // hemisphere light direction
  const vec3 BC = vec3(0.25,0.25,0.25);   // back light colour
  const vec3 FC = vec3(1.30,1.20,1.00);   // fresnel colour
  const float AS = .5;                     // ambient light strength
  const float BS = .3;                     // back light strength
  /* Raymarching constants */
  /* --------------------- */
  const float MAX_TRACE_DISTANCE = 10.;             // max trace distance
  const float INTERSECTION_PRECISION = 0.001;       // precision of the intersection
  // maxSteps (max trace steps) is a #define
  const float STEP_MULTIPLIER = .5;                 // the step mutliplier - ie, how much further to progress on each step

  /* Structures */
  /* ---------- */
  struct Camera {
    vec3 ro;
    vec3 rd;
    vec3 forward;
    vec3 right;
    vec3 up;
    float FOV;
  };
  struct Surface {
    float len;
    vec3 position;
    vec3 colour;
    float id;
    float steps;
    float AO;
  };
  struct Model {
    float dist;
    vec3 colour;
    float id;
  };

  /* Utilities */
  /* ---------- */
  vec2 toScreenspace(in vec2 p) {
    vec2 uv = (p - 0.5 * u_resolution.xy) / min(u_resolution.y, u_resolution.x);
    return uv;
  }
  mat2 R(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
  }
  Camera getCamera(in vec2 uv, in vec3 pos, in vec3 target) {
    vec3 f = normalize(target - pos);
    vec3 r = normalize(vec3(f.z, 0., -f.x));
    vec3 u = normalize(cross(f, r));

    float FOV = fov+cos(u_time)*fovAmp;

    return Camera(
      pos,
      normalize(f + FOV * uv.x * r + FOV * uv.y * u),
      f,
      r,
      u,
      FOV
    );
  }


  //--------------------------------
  // Modelling
  //--------------------------------
  float D( vec3 p ) {
    return abs(dot(sin(p.yzx), cos(p.zxy)));
  }
  float O(float f, float s) { return abs(f)-s; }
  Model model(vec3 p) {
    p.xz *= R(u_time*2.);
    p.xy *= R(.3);
    p.x -= .5;
    p.y -= .5;
    float d = abs(-(length(vec2(p.y, length(p.xz)-major))-tube+cos(u_time)*breathe));
    float t = u_time * 10.;

    float g = D(p.yxz*gyroid+u_time*5.)/gyroid;

    d= length(vec2(d,g))-thickness;

    vec3 colour = vec3(g);

    return Model(d, colour, 1.);
  }
  Model map( vec3 p ){
    return model(p);
  }

  /* Modelling utilities */
  /* ---------- */
  // Calculates the normal by taking a very small distance,
  // remapping the function, and getting normal for that
  vec3 calcNormal( in vec3 pos ){
    vec3 eps = vec3( 0.001, 0.0, 0.0 );
    vec3 nor = vec3(
      map(pos+eps.xyy).dist - map(pos-eps.xyy).dist,
      map(pos+eps.yxy).dist - map(pos-eps.yxy).dist,
      map(pos+eps.yyx).dist - map(pos-eps.yyx).dist );
    return normalize(nor);
  }

  //--------------------------------
  // Raymarcher
  //--------------------------------
  Surface march( in Camera cam ){
    float h = 1e4; // local distance
    float d = 0.; // ray depth
    float id = -1.; // surace id
    float s = 0.; // number of steps
    float ao = 0.; // march space AO. Simple weighted accumulator
    vec3 p; // ray position
    vec3 c; // surface colour

    for( int i=0; i< maxSteps ; i++ ) {
      if( abs(h) < INTERSECTION_PRECISION || d > MAX_TRACE_DISTANCE ) break;
      p = cam.ro+cam.rd*d;
      Model m = map( p );
      h = m.dist;
      d += h * STEP_MULTIPLIER;
      id = m.id;
      s += 1.;
      ao += max(h, 0.);
      c = m.colour;
    }

    if( d >= MAX_TRACE_DISTANCE ) id = -1.0;

    return Surface( d, p, c, id, s, ao );
  }

  //--------------------------------
  // Shading
  //--------------------------------
  /*
   * Soft shadows curtesy of Inigo Quilez
   * https://iquilezles.org/articles/rmshadows
  */
  float softshadow( in vec3 ro, in vec3 rd, in float mint, in float tmax ) {
    float res = 1.0;
    float t = mint;
    for( int i=0; i<16; i++ ) {
      float h = map( ro + rd*t ).dist;
      res = min( res, 8.0*h/t );
      t += clamp( h, 0.02, 0.10 );
      if( h<0.001 || t>tmax ) break;
    }
    return clamp( res, 0.0, 1.0 );
  }
  float AO( in vec3 pos, in vec3 nor ) {
    float occ = 0.0;
    float sca = 1.0;
    for( int i=0; i<5; i++ )
    {
      float hr = 0.01 + 0.12*float(i)/4.0;
      vec3 aopos =  nor * hr + pos;
      float dd = map( aopos ).dist;
      occ += -(dd-hr)*sca;
      sca *= 0.95;
    }
    return clamp( 1.0 - 3.0*occ, 0.0, 1.0 );
  }
  vec3 shade(vec3 col, vec3 pos, vec3 nor, vec3 ref, Camera cam) {

    vec3 plp = LP - pos; // point light

    float o = AO( pos, nor );                 // Ambient occlusion
    vec3  l = normalize( plp );                    // light direction

    float d = clamp( dot( nor, l ), 0.0, 1.0 )*diffuse;   // diffuse component
    float b = clamp( dot( nor, normalize(vec3(-l.x,0,-l.z))), 0.0, 1.0 )*clamp( 1.0-pos.y,0.0,1.0)*BS; // back light component
    float f = pow( clamp(1.0+dot(nor,cam.rd),0.0,1.0), 2.0 )*fresnel; // fresnel component

    vec3 c = vec3(0.0);
    c += d*LC;                           // diffuse light integration
    c += mix(HC1,HC2,dot(nor, HLD))*AS;        // hemisphere light integration (ambient)
    c += b*BC*o;       // back light component
    c += f*FC*o;       // fresnel component

    return col*c;
  }
  vec3 render(Surface surface, Camera cam, vec2 uv) {
    vec3 colour = bgEdge;
    vec3 colourB = bgCentre;

    vec2 pp = uv;

    colour = mix(colourB, colour, pow(length(pp), 2.)/1.5);

    if (surface.id > -1.){
      vec3 surfaceNormal = calcNormal( surface.position );
      vec3 ref = reflect(cam.rd, surfaceNormal);
      colour = surfaceNormal;
      vec3 pos = surface.position;

      float t = u_time*10.;
      vec3 col = mix(mix(colA, colB, cos(length(pos.xy)*3. + t)*cos(length(pos.yz+5.)*1. + t)+sin(length(pos.zx)*10.+10. + t)*.2*cos(length(pos.zy))), vec3(1), smoothstep(0., .1, cos(surface.colour.r*40.)));

      colour = shade(col, pos, surfaceNormal, ref, cam);
    }

    return colour;
  }


  void main() {
    vec2 uv = toScreenspace(gl_FragCoord.xy);

    Camera cam = getCamera(uv, u_cp * .01, vec3(0));

    Surface surface = march(cam);

    c = vec4(render(surface, cam, uv), 1.);
  }
`,
});
