// Manifold Mandala scene — adapted from the original main.js:
// tweakpane, DollyCamera (drag/zoom), click/keyboard input and dark mode are
// gone; the auto-orbit, world cycling and ring regrowth are as published.
import {
  Obj,
  Renderer,
  Program,
  Mesh,
  Uniform,
  Camera,
  Triangle,
  Geometry,
  GeometryAttribute,
  Vec2,
  Vec3,
} from "wtc-gl";

import ringVert from "./ring.vert.js";
import ringFrag from "./ring.frag.js";
import postFrag from "./post.frag.js";
import { createSceneTarget, disposeSceneTarget } from "./sceneTarget.js";
import { SHAPES, buildModule, rand, pick, chance } from "./shapes.js";

const TAU = Math.PI * 2;

// --- worlds (palettes). New rings adopt the current world, so a change
// sweeps through the tunnel from the far end.
const WORLDS = [
  {
    // the reference: yellow core, green body, pink lattice
    inner: [0.98, 0.9, 0.32],
    outer: [0.6, 0.78, 0.32],
    accent: [0.93, 0.4, 0.47],
    accent2: [0.86, 0.6, 0.2],
    bg: [
      [1.0, 0.97, 0.88],
      [0.98, 0.8, 0.7],
      [0.82, 0.93, 0.9],
    ],
  },
  {
    inner: [0.4, 0.88, 0.86],
    outer: [0.22, 0.46, 0.78],
    accent: [1.0, 0.55, 0.28],
    accent2: [0.96, 0.86, 0.52],
    bg: [
      [0.93, 0.97, 1.0],
      [0.8, 0.88, 0.98],
      [0.99, 0.9, 0.84],
    ],
  },
  {
    inner: [0.8, 0.64, 0.96],
    outer: [0.46, 0.36, 0.76],
    accent: [0.45, 0.9, 0.7],
    accent2: [0.98, 0.76, 0.86],
    bg: [
      [0.97, 0.94, 1.0],
      [0.92, 0.84, 0.98],
      [0.87, 0.97, 0.93],
    ],
  },
  {
    inner: [0.99, 0.6, 0.32],
    outer: [0.82, 0.22, 0.28],
    accent: [0.32, 0.34, 0.5],
    accent2: [0.99, 0.86, 0.56],
    bg: [
      [1.0, 0.95, 0.9],
      [0.99, 0.82, 0.74],
      [0.95, 0.9, 0.8],
    ],
  },
  {
    // sorbet: mint core, sea-green body, coral lattice
    inner: [0.72, 0.96, 0.78],
    outer: [0.3, 0.7, 0.55],
    accent: [0.98, 0.45, 0.42],
    accent2: [0.99, 0.82, 0.45],
    bg: [
      [0.95, 1.0, 0.95],
      [0.86, 0.96, 0.9],
      [1.0, 0.9, 0.86],
    ],
  },
  {
    // deep teal body, gold core, magenta lattice
    inner: [0.98, 0.82, 0.4],
    outer: [0.12, 0.42, 0.48],
    accent: [0.95, 0.35, 0.55],
    accent2: [0.55, 0.85, 0.92],
    bg: [
      [0.94, 0.98, 0.97],
      [0.84, 0.93, 0.93],
      [0.99, 0.93, 0.82],
    ],
  },
  {
    // rose body, blush core, olive lattice
    inner: [1.0, 0.78, 0.82],
    outer: [0.86, 0.38, 0.52],
    accent: [0.36, 0.55, 0.32],
    accent2: [0.98, 0.9, 0.7],
    bg: [
      [1.0, 0.95, 0.95],
      [0.98, 0.86, 0.88],
      [0.9, 0.95, 0.86],
    ],
  },
  {
    // sky body, lemon core, red lattice
    inner: [0.98, 0.96, 0.6],
    outer: [0.36, 0.62, 0.92],
    accent: [0.92, 0.3, 0.36],
    accent2: [0.7, 0.9, 0.98],
    bg: [
      [0.96, 0.98, 1.0],
      [0.86, 0.93, 1.0],
      [1.0, 0.98, 0.86],
    ],
  },
  {
    // moss body, chartreuse core, lavender lattice
    inner: [0.82, 0.92, 0.5],
    outer: [0.34, 0.52, 0.28],
    accent: [0.7, 0.52, 0.92],
    accent2: [0.96, 0.72, 0.5],
    bg: [
      [0.97, 0.98, 0.92],
      [0.9, 0.94, 0.82],
      [0.93, 0.9, 0.98],
    ],
  },
  {
    // muted: slate body, peach core, teal lattice
    inner: [0.98, 0.8, 0.66],
    outer: [0.42, 0.46, 0.56],
    accent: [0.2, 0.68, 0.66],
    accent2: [0.96, 0.6, 0.5],
    bg: [
      [0.97, 0.96, 0.95],
      [0.9, 0.9, 0.92],
      [0.98, 0.9, 0.84],
    ],
  },
];

// the original's tweakpane defaults
const params = {
  speed: 1,
  spin: 1,
  swirl: 0.035,
  roll: 0.015,
  worldEvery: 45,
  regrowEvery: 2.2,
  fov: 85,
  orbitSpeed: 1,
  fog: 40,
  fogDist: 15,
  lines: 0.5,
  ao: 1,
};

// Lissajous drift in front of the mandala (the original's idle auto-orbit)
const ORBIT = {
  azAmp: 0.955, // radians either side of head-on (left/right)
  elAmp: 0.602, // radians above/below (up/down)
  azRate: 0.09, // rad/s of the sine argument; 0.09 : 0.13 gives a slow-closing figure
  elRate: 0.13,
  elPhase: 10.7,
  follow: 2.6, // how quickly the camera chases the path point (1/s)
  ramp: 0.4, // how quickly the orbit takes hold (1/s)
};

// A compact funnel: ring i sits at a fixed radius slot, small rings deep at
// the back, wide rings near the front. Head-on it reads as a mandala.
const RING_COUNT = 30;
const RING_STEP = 1.15; // radius step between slots
const R_MIN = 2.5;
const DEPTH = 26; // front-to-back extent of the funnel

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const jitter = (c, j) =>
  c.map((v) => Math.min(1, Math.max(0, v + rand(-j, j))));

export function createMandala(canvas) {
  let worldIndex = Math.floor(Math.random() * WORLDS.length);
  let world = WORLDS[worldIndex];

  // --- renderer (the host owns canvas pixel size; dpr is folded into it)
  const d = new Vec2(canvas.width, canvas.height);
  const renderer = new Renderer({ canvas, dpr: 1, width: d.width, height: d.height });
  const { gl } = renderer;
  gl.getExtension("EXT_color_buffer_float");

  const camera = new Camera({ fov: params.fov, near: 0.3, far: 800, aspect: d.width / d.height });
  const target = new Vec3(0, 0, 0);
  camera.position.x = -25;
  camera.position.y = 20;
  camera.position.z = 25;

  // --- uniforms (keys are the GLSL names)
  const uniforms = {
    u_time: new Uniform({ name: "time", value: 0, kind: "float" }),
    u_roll: new Uniform({ name: "roll", value: 0, kind: "float" }),
    u_swirl: new Uniform({ name: "swirl", value: 0.02, kind: "float" }),
    u_resolution: new Uniform({ name: "resolution", value: [d.width, d.height], kind: "float_vec2" }),
    u_dpr: new Uniform({ name: "dpr", value: 1, kind: "float" }),
    u_fog: new Uniform({ name: "fog", value: params.fog, kind: "float" }),
    u_fogStart: new Uniform({ name: "fogStart", value: 0, kind: "float" }),
    u_tA: new Uniform({ name: "tA", value: [0, 0, 0, 1], kind: "float_vec4" }),
    u_tB: new Uniform({ name: "tB", value: [1, 0, 0, 0], kind: "float_vec4" }),
    u_tC: new Uniform({ name: "tC", value: [0, 0, 0, 0], kind: "float_vec4" }),
    u_tD: new Uniform({ name: "tD", value: [0, 0, 0, 0], kind: "float_vec4" }),
    u_tCol: new Uniform({ name: "tCol", value: [1, 1, 1], kind: "float_vec3" }),
    u_bgA: new Uniform({ name: "bgA", value: [...world.bg[0]], kind: "float_vec3" }),
    u_bgB: new Uniform({ name: "bgB", value: [...world.bg[1]], kind: "float_vec3" }),
    u_bgC: new Uniform({ name: "bgC", value: [...world.bg[2]], kind: "float_vec3" }),
    b_scene: new Uniform({ name: "scene", value: null, kind: "texture" }),
    b_normal: new Uniform({ name: "normal", value: null, kind: "texture" }),
    u_lines: new Uniform({ name: "lines", value: params.lines, kind: "float" }),
    u_ao: new Uniform({ name: "ao", value: params.ao, kind: "float" }),
    u_dark: new Uniform({ name: "dark", value: 0, kind: "float" }),
    // near-camera fade is off here; the behind samplers just reuse the scene
    b_behind: new Uniform({ name: "behind", value: null, kind: "texture" }),
    b_behindNormal: new Uniform({ name: "behindNormal", value: null, kind: "texture" }),
    u_nearFade: new Uniform({ name: "nearFade", value: [0, 0], kind: "float_vec2" }),
    u_clipRadius: new Uniform({ name: "clipRadius", value: 0, kind: "float" }),
    u_tanFov: new Uniform({ name: "tanFov", value: 1, kind: "float" }),
  };

  const ringProgram = new Program(gl, {
    vertex: ringVert,
    fragment: ringFrag,
    uniforms,
    cullFace: null, // mirrored modules flip winding
  });

  // --- rings
  const scene = new Obj();
  const rings = [];

  function configureRing(ring) {
    const name = pick(Object.keys(SHAPES));
    const shape = SHAPES[name];

    const R = R_MIN + ring.index * RING_STEP + rand(-0.35, 0.35);
    const z = (ring.index / (RING_COUNT - 1) - 0.5) * DEPTH + rand(-0.6, 0.6);
    const wTarget = rand(1.5, 3.4);
    let N = Math.max(8, Math.round((TAU * R) / wTarget / 4) * 4);
    const w = (TAU * R) / N;

    const B = buildModule(name, w);

    const t01 = ring.index / (RING_COUNT - 1);
    let col = mix(world.inner, world.outer, t01);
    // pink lattice lives on the outside; gold accents are occasional
    const outer = ring.index >= RING_COUNT - 4;
    if (outer && (shape.accent || chance(0.6))) col = world.accent;
    else if (shape.accent ? chance(0.4) : chance(0.12)) col = world.accent2;
    col = jitter(col, 0.04);

    const twistTurns = chance(0.25) ? pick([1, 2, 3, -1, -2, 10]) : 0;

    // a few "hero" rings at a time: bigger modules, big slow undulation
    const heroes = rings.filter((r) => r !== ring && r.cfg?.hero).length;
    const hero = heroes < 3 && chance(0.3);
    const size = hero ? rand(1.6, 4.3) : 1;

    // radial petals (in/out) and axial ripple (forward/back); frequencies are
    // integers so the wave closes seamlessly around the ring
    const waveF = hero ? pick([3, 4, 6]) : pick([0, 2, 3, 4, 5, 6, 8]);
    const waveA = waveF ? (hero ? rand(0.08, 1.16) : rand(0.03, 0.12)) : 0;
    const zWaveA = hero ? rand(1.5, 3.5) : chance(0.7) ? rand(0.3, 1.8) : 0;

    ring.cfg = {
      name,
      R,
      N,
      z,
      hero,
      size,
      spin: rand(0, TAU),
      spinSpeed: rand(0.02, 0.12) * (ring.index % 2 ? 1 : -1),
      tA: [R, z, 0, 0],
      tB: [N, waveA, waveF, rand(-1, 1) * shape.tilt],
      tC: [twistTurns, zWaveA, pick([2, 3, 4, 5, 6]), chance(0.5) ? 1 : 0],
      tD: [
        chance(0.6) ? rand(0.05, 0.25) : 0,
        rand(0, TAU),
        pick([1, 2, 3, 4, 6]),
        rand(0.6, 1.6),
      ],
      col,
    };

    // geometry: module verts + per-instance slot/random
    const inst = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) inst.set([i, Math.random()], i * 2);
    const geometry = new Geometry(gl, {
      position: new GeometryAttribute({ size: 3, data: new Float32Array(B.positions) }),
      normal: new GeometryAttribute({ size: 3, data: new Float32Array(B.normals) }),
      inst: new GeometryAttribute({ size: 2, data: inst, instanced: 1 }),
    });

    if (ring.mesh) {
      disposeGeometry(ring.mesh.geometry);
      ring.mesh.geometry = geometry;
    } else {
      ring.mesh = new Mesh(gl, { geometry, program: ringProgram, frustumCulled: false });
      // per-ring uniforms are pushed into the shared program right before draw
      ring.mesh.addBeforeRender(() => {
        const c = ring.cfg;
        uniforms.u_tA.value = c.tA;
        uniforms.u_tB.value = c.tB;
        uniforms.u_tC.value = c.tC;
        uniforms.u_tD.value = c.tD;
        uniforms.u_tCol.value = c.col;
      });
      ring.mesh.setParent(scene);
    }
  }

  function disposeGeometry(geometry) {
    for (const key in geometry.attributes) {
      const buf = geometry.attributes[key].buffer;
      if (buf) gl.deleteBuffer(buf);
    }
  }

  // Rings regrow: shrink to nothing, re-roll their module, unfold again.
  for (let i = 0; i < RING_COUNT; i++) {
    const ring = { index: i, scale: 0, target: 1, regrowAt: null };
    configureRing(ring);
    rings.push(ring);
  }

  // --- post: colour+depth and normals, read by the post pass
  let sceneTarget = createSceneTarget(gl, d.width, d.height);

  const postMesh = new Mesh(gl, {
    geometry: new Triangle(gl),
    program: new Program(gl, {
      vertex: `#version 300 es
in vec3 position;
void main() { gl_Position = vec4(position, 1.0); }`,
      fragment: postFrag,
      uniforms,
      depthTest: false,
    }),
  });

  // --- state
  let time = 0;
  let worldTimer = 0; // time since the world last changed
  let regrowTimer = 0; // time since a single ring last re-rolled
  let autoBlend = 0; // orbit ramps in from the first frame
  let orbitT = 0;

  // regrow every ring in a wave from the centre outward
  function regrowWave(stagger = 0.08) {
    rings.forEach((r) => (r.regrowAt = time + r.index * stagger));
  }
  function nextWorld() {
    worldIndex = (worldIndex + 1) % WORLDS.length;
    world = WORLDS[worldIndex];
    worldTimer = 0;
    regrowWave();
  }

  function updateAutoOrbit(dt) {
    autoBlend += (1 - autoBlend) * (1 - Math.exp(-dt * ORBIT.ramp));
    orbitT += dt * autoBlend * params.orbitSpeed;

    const p = camera.position;
    const ox = p.x - target.x;
    const oy = p.y - target.y;
    const oz = p.z - target.z;
    const dist = Math.hypot(ox, oy, oz) || 1;

    // +z is "in front": azimuth swings around y, elevation tips up/down
    const az = ORBIT.azAmp * Math.sin(orbitT * ORBIT.azRate);
    const el = ORBIT.elAmp * Math.sin(orbitT * ORBIT.elRate + ORBIT.elPhase);
    const gx = dist * Math.sin(az) * Math.cos(el);
    const gy = dist * Math.sin(el);
    const gz = dist * Math.cos(az) * Math.cos(el);

    // chase the path point, then push back out to the same radius so the
    // linear step doesn't slowly dolly us inward
    const k = 1 - Math.exp(-dt * ORBIT.follow * autoBlend);
    const nx = ox + (gx - ox) * k;
    const ny = oy + (gy - oy) * k;
    const nz = oz + (gz - oz) * k;
    const s = dist / (Math.hypot(nx, ny, nz) || 1);
    p.x = target.x + nx * s;
    p.y = target.y + ny * s;
    p.z = target.z + nz * s;
  }

  return {
    update(dt) {
      const tdt = dt * params.speed;
      time += tdt;

      worldTimer += tdt;
      if (worldTimer >= params.worldEvery) nextWorld();
      // and every so often a single ring re-rolls
      regrowTimer += tdt;
      if (regrowTimer >= params.regrowEvery) {
        regrowTimer = 0;
        pick(rings).regrowAt = time;
      }

      uniforms.u_time.value = time;
      uniforms.u_roll.value = time * params.roll;
      // the vortex slowly winds and unwinds
      uniforms.u_swirl.value = params.swirl * Math.sin(time * 0.07);

      const ke = 1 - Math.exp(-tdt * 5);
      for (const ring of rings) {
        if (ring.regrowAt !== null && time >= ring.regrowAt) {
          ring.target = 0;
          ring.regrowAt = null;
        }
        ring.scale += (ring.target - ring.scale) * ke;
        if (ring.target === 0 && ring.scale < 0.02) {
          configureRing(ring);
          ring.target = 1;
        }
        ring.cfg.spin += ring.cfg.spinSpeed * params.spin * tdt;
        ring.cfg.tA = [ring.cfg.R, ring.cfg.z, ring.cfg.spin, ring.scale * ring.cfg.size];
      }

      // ease the sky toward the current world
      const k = 1 - Math.exp(-dt * 0.25);
      ["u_bgA", "u_bgB", "u_bgC"].forEach((key, i) => {
        uniforms[key].value = mix(uniforms[key].value, world.bg[i], k);
      });

      updateAutoOrbit(dt);
    },

    draw() {
      camera.lookAt(target);
      // fog starts just in front of the mandala, wherever the camera is
      uniforms.u_fogStart.value = Math.max(0, camera.position.distance(target) - params.fogDist);

      gl.clearColor(0, 0, 0, 0);
      uniforms.u_tanFov.value = Math.tan((camera.fov * Math.PI) / 360);
      renderer.render({ scene, camera, target: sceneTarget });
      uniforms.b_scene.value = sceneTarget.textures[0];
      uniforms.b_normal.value = sceneTarget.textures[1];
      uniforms.b_behind.value = sceneTarget.textures[0];
      uniforms.b_behindNormal.value = sceneTarget.textures[1];
      renderer.render({ scene: postMesh, clear: false });
    },

    resize(w, h) {
      d.reset(w, h);
      renderer.dimensions = d;
      uniforms.u_resolution.value = [w, h];
      camera.perspective({ aspect: w / h });
      sceneTarget = createSceneTarget(gl, w, h, sceneTarget);
    },

    dispose() {
      rings.forEach((r) => disposeGeometry(r.mesh.geometry));
      disposeSceneTarget(gl, sceneTarget);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
