/**
 * Ticker Delta (Originkit), ported from its Framer/React build to a plain
 * module: an impossible (Penrose) triangle wrapped in three bands of running
 * type. Seen down the (1, 1, 1) diagonal under an orthographic camera, a beam
 * running along Y, then X, then Z closes on itself; each band is the +Z, +Y
 * or +X face of that beam. Hover speeds the belt up; drag winds it by hand.
 */
import * as THREE from 'three';

/* ---------------------------------------------------------------- constants */

/** Leg length in world units. Everything else is a share of it. */
const LEG = 1;
/** How much of an axis survives isometric projection, √(2/3). */
const ISO = Math.sqrt(2 / 3);
/** Triangle side as a share of the frame's width / height; tighter wins. */
const FIT_W = 0.57;
const FIT_H = 0.41;
/** Thickness 0..10 maps the beam width across 0.14..0.34 of the leg. */
const THICK_MIN = 0.14;
const THICK_STEP = 0.02;
/** Roundness adds this much of a beam to the inner corner radius per step. */
const ROUND_STEP = 0.08;
const MAX_RADIUS = 0.45 * LEG;
const BEND_SEGS = 40;
const LINE_SEGS = 4;
/** Shading: AMBIENT + n·KEY (+ BACK for faces turning away). */
const AMBIENT = 0.3;
const KEY = new THREE.Vector3(0.55, 0.7, 0.45);
const BACK = new THREE.Vector3(0.25, 0.1, 0.25);
/** Which way each band's type reads against the flow: left, top, right. */
const SIGNS = [1, -1, -1] as const;
/** Canvas height for one band (the beam's width in texels). */
const TEX_H = 256;
/** WebGL guarantees 4096; a long line is drawn smaller rather than clipped. */
const MAX_TEX_W = 4096;
/** Space between repeats, in ems. */
const GAP_EM = 0.9;
/** Speed 1 is this many legs a second. */
const SPEED_UNIT = 0.034 * LEG;
const FLING_DECAY = 3;
const HOVER_ATTACK = 0.15;
const HOVER_RELEASE = 0.3;
/** Never smear a band over more than half its own repeat. */
const MAX_BLUR = 0.5;
/** Ground shadow, in triangle sides from centre (screen space, y down). */
const SHADOW_OFFSET = { x: -0.13, y: 0.74 };
const SHADOW_SIGMA = { x: 0.27, y: 0.1 };
const SHADOW_STEP = 0.054;

/* ------------------------------------------------------------------- config */

interface Face {
  /** One repeat of the band's type. */
  text: string;
  /** Type size, in tenths of the beam's width. */
  size: number;
  weight: 300 | 400 | 700;
  fill: string;
  ink: string;
}

const FONT_FAMILY = "Montserrat, 'Avenir Next', Inter, Helvetica, Arial, sans-serif";

/** Left (+Z), top (+Y), right (+X). */
const FACES: [Face, Face, Face] = [
  {
    text: 'PEANUT BUTTER PORK CHOP',
    size: 7,
    weight: 400,
    fill: '#0A006B',
    ink: '#FFFFFF',
  },
  { text: 'PEANUT BUTTER PORK CHOP', size: 5, weight: 700, fill: '#FEFE66', ink: '#111111' },
  {
    text: 'PEANUT BUTTER PORK CHOP',
    size: 3,
    weight: 400,
    fill: '#0027FF',
    ink: '#FFFFFF',
  },
];

const CONFIG = {
  thickness: 5,
  roundness: 2.5,
  shadow: 2.3,
  hoverSpeed: 13.5,
  speed: 3.2,
  /** Percent of the fitted size. */
  scale: 149,
};

/* ------------------------------------------------------------------ helpers */

function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

function fontFor(face: Face, px: number): string {
  return `${face.weight} ${px}px ${FONT_FAMILY}`;
}

/** One repeat of a band's type as a coverage mask (white on black). */
function drawStrip(face: Face): { canvas: HTMLCanvasElement; aspect: number } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas unavailable');
  }
  const fontPx = (face.size / 10) * TEX_H;
  ctx.font = fontFor(face, fontPx);
  const gap = GAP_EM * fontPx;
  const unitW = ctx.measureText(face.text).width + gap;
  const scale = Math.min(1, MAX_TEX_W / unitW);
  canvas.width = Math.max(4, Math.round(unitW * scale));
  canvas.height = Math.max(4, Math.round(TEX_H * scale));
  // Resizing resets the context, so the font is set again.
  ctx.font = fontFor(face, fontPx);
  ctx.setTransform(canvas.width / unitW, 0, 0, canvas.height / TEX_H, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, unitW, TEX_H);
  ctx.fillStyle = '#FFF';
  ctx.textBaseline = 'alphabetic';
  // Centre the capitals on the beam.
  const cap = ctx.measureText('H').actualBoundingBoxAscent || fontPx * 0.7;
  ctx.fillText(face.text, gap / 2, TEX_H / 2 + cap / 2);
  return { canvas, aspect: unitW / TEX_H };
}

/* ----------------------------------------------------------------- geometry
 * Centreline: legs along +Y, +X, +Z with quarter bends of radius R. Starts
 * half-way up the left leg and ends there displaced by (L, L, L): the same
 * pixels under this camera, one view-depth nearer, so the loop closes.
 */

interface PathPoint {
  c: THREE.Vector3;
  t: THREE.Vector3;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function buildPath(R: number): { pts: PathPoint[]; midTop: number; midBottom: number } {
  const L = LEG;
  const pts: PathPoint[] = [];
  const push = (c: THREE.Vector3, t: THREE.Vector3) => {
    const last = pts.at(-1);
    if (last && last.c.distanceToSquared(c) < 1e-14) {
      return;
    }
    pts.push({ c, t: t.clone().normalize() });
  };
  const arc = (centre: THREE.Vector3, e0: THREE.Vector3, e1: THREE.Vector3) => {
    for (let i = 0; i <= BEND_SEGS; i++) {
      const a = (Math.PI / 2) * (i / BEND_SEGS);
      const c = centre
        .clone()
        .addScaledVector(e0, R * Math.cos(a))
        .addScaledVector(e1, R * Math.sin(a));
      const t = e0.clone().multiplyScalar(-Math.sin(a)).addScaledVector(e1, Math.cos(a));
      push(c, t);
    }
  };
  /** A straight run; returns the index of its middle sample. */
  const line = (a: THREE.Vector3, b: THREE.Vector3): number => {
    const t = b.clone().sub(a);
    let mid = 0;
    for (let i = 0; i <= LINE_SEGS; i++) {
      push(a.clone().lerp(b, i / LINE_SEGS), t);
      if (i === LINE_SEGS / 2) {
        mid = pts.length - 1;
      }
    }
    return mid;
  };

  line(V(0, L / 2, 0), V(0, L - R, 0));
  arc(V(R, L - R, 0), V(-1, 0, 0), V(0, 1, 0));
  const midTop = line(V(R, L, 0), V(L - R, L, 0));
  arc(V(L - R, L, R), V(0, 0, -1), V(1, 0, 0));
  const midBottom = line(V(L, L, R), V(L, L, L - R));
  arc(V(L, L + R, L - R), V(0, -1, 0), V(0, 0, 1));
  line(V(L, L + R, L), V(L, L + L / 2, L));
  return { pts, midTop, midBottom };
}

/** The square beam swept along the path, carrying arc length (aU) and offset
 * across its face (aV). Back faces are culled: exactly the unseen half. */
function buildBeam(width: number, R: number) {
  const { pts: path, midTop, midBottom } = buildPath(R);
  const count = path.length;
  const half = width / 2;

  // Arc length and a parallel-transported section frame at every sample.
  const s = new Float64Array(count);
  const p: THREE.Vector3[] = [];
  const q: THREE.Vector3[] = [];
  const first = path[0] as PathPoint;
  let fp = new THREE.Vector3(0, 0, 1);
  let fq = new THREE.Vector3().crossVectors(first.t, fp).normalize();
  const turn = new THREE.Quaternion();
  for (let i = 0; i < count; i++) {
    const cur = path[i] as PathPoint;
    if (i > 0) {
      const prev = path[i - 1] as PathPoint;
      s[i] = (s[i - 1] as number) + cur.c.distanceTo(prev.c);
      turn.setFromUnitVectors(prev.t, cur.t);
      fp = fp.clone().applyQuaternion(turn);
      fp.addScaledVector(cur.t, -fp.dot(cur.t)).normalize();
      fq = new THREE.Vector3().crossVectors(cur.t, fp).normalize();
    }
    p.push(fp);
    q.push(fq);
  }

  const verts = count * 2 * 4;
  const position = new Float32Array(verts * 3);
  const normal = new Float32Array(verts * 3);
  const aU = new Float32Array(verts);
  const aV = new Float32Array(verts);
  const index: number[] = [];
  const n = new THREE.Vector3();
  const m = new THREE.Vector3();
  const v = new THREE.Vector3();
  let k = 0;
  for (let face = 0; face < 4; face++) {
    const base = k;
    for (let i = 0; i < count; i++) {
      const pt = path[i] as PathPoint;
      n.copy((face % 2 === 0 ? p[i] : q[i]) as THREE.Vector3).multiplyScalar(face < 2 ? 1 : -1);
      // Across the face: n × t, which keeps the type un-mirrored.
      m.crossVectors(n, pt.t);
      for (const side of [-1, 1]) {
        v.copy(pt.c)
          .addScaledVector(n, half)
          .addScaledVector(m, side * half);
        position.set([v.x, v.y, v.z], k * 3);
        normal.set([n.x, n.y, n.z], k * 3);
        aU[k] = s[i] as number;
        aV[k] = side * half;
        k++;
      }
    }
    for (let i = 0; i < count - 1; i++) {
      const a = base + i * 2;
      index.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute('aU', new THREE.BufferAttribute(aU, 1));
  geometry.setAttribute('aV', new THREE.BufferAttribute(aV, 1));
  geometry.setIndex(index);
  const length = s[count - 1] as number;
  // Arc length jumps at the seam; each band unwraps it where it is unseen.
  const cuts = new THREE.Vector3(s[midBottom], length * 2, s[midTop]);
  return { geometry, length, cuts };
}

/* ------------------------------------------------------------------ shaders */

const BEAM_VERTEX = `
attribute float aU;
attribute float aV;
varying vec3 vN;
varying float vU;
varying float vV;
varying float vScreenY;
void main() {
  vN = normal;
  vU = aU;
  vV = aV;
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vScreenY = clip.y / clip.w;
  gl_Position = clip;
}
`;

const BEAM_FRAGMENT = `
uniform sampler2D uTex0;
uniform sampler2D uTex1;
uniform sampler2D uTex2;
uniform vec3 uLambda;
uniform vec3 uPhase;
uniform vec3 uBlur;
uniform vec3 uTexW;
uniform vec3 uSign;
uniform vec3 uCut;
uniform float uLoop;
uniform float uWidth;
uniform vec3 uFill0;
uniform vec3 uFill1;
uniform vec3 uFill2;
uniform vec3 uInk0;
uniform vec3 uInk1;
uniform vec3 uInk2;
uniform vec3 uKey;
uniform vec3 uBack;
uniform float uAmbient;
varying vec3 vN;
varying float vU;
varying float vV;
varying float vScreenY;

vec2 bandUV(float lambda, float phase, float s, float cut) {
  float u = vU >= cut ? vU - uLoop : vU;
  return vec2(s * (u / lambda - phase), 0.5 + s * vV / uWidth);
}

// Coverage smeared along the band over this frame's travel (3 butted taps).
float smear(sampler2D tex, vec2 uv, vec2 gx, vec2 gy, float blur, float texW) {
  if (blur * texW < 1.0) return textureGrad(tex, uv, gx, gy).r;
  const float n = 3.0;
  vec2 sx = gx + vec2((gx.x < 0.0 ? -1.0 : 1.0) * blur / n, 0.0);
  float sum = 0.0;
  for (int i = 0; i < 3; i++) {
    float o = ((float(i) + 0.5) / n - 0.5) * blur;
    sum += textureGrad(tex, uv + vec2(o, 0.0), sx, gy).r;
  }
  return sum / n;
}

void main() {
  vec3 n = normalize(vN);
  vec2 uv0 = bandUV(uLambda.x, uPhase.x, uSign.x, uCut.x);
  vec2 uv1 = bandUV(uLambda.y, uPhase.y, uSign.y, uCut.y);
  vec2 uv2 = bandUV(uLambda.z, uPhase.z, uSign.z, uCut.z);
  vec2 gx0 = dFdx(uv0); vec2 gy0 = dFdy(uv0);
  vec2 gx1 = dFdx(uv1); vec2 gy1 = dFdy(uv1);
  vec2 gx2 = dFdx(uv2); vec2 gy2 = dFdy(uv2);
  vec3 fill;
  vec3 ink;
  float c;
  if (n.z >= n.x && n.z >= n.y) {
    fill = uFill0; ink = uInk0; c = smear(uTex0, uv0, gx0, gy0, uBlur.x, uTexW.x);
  } else if (n.y >= n.x) {
    fill = uFill1; ink = uInk1; c = smear(uTex1, uv1, gx1, gy1, uBlur.y, uTexW.y);
  } else {
    fill = uFill2; ink = uInk2; c = smear(uTex2, uv2, gx2, gy2, uBlur.z, uTexW.z);
  }
  float shade = clamp(uAmbient + dot(max(n, 0.0), uKey) + dot(max(-n, 0.0), uBack), 0.0, 1.06);
  shade *= 0.975 + 0.025 * vScreenY;
  gl_FragColor = vec4(mix(fill, ink, c) * shade, 1.0);
}
`;

const SHADOW_VERTEX = `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const SHADOW_FRAGMENT = `
uniform vec2 uCenter;
uniform vec2 uSigma;
uniform float uStrength;
void main() {
  vec2 d = (gl_FragCoord.xy - uCenter) / uSigma;
  gl_FragColor = vec4(0.0, 0.0, 0.0, uStrength * exp(-0.5 * dot(d, d)));
}
`;

/* -------------------------------------------------------------------- scene */

/** Mounts the animation into `container` (sized by CSS). Throws without WebGL. */
export function mountTickerDelta(container: HTMLElement): void {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x00_00_00, 0);
  renderer.domElement.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;display:block';
  container.append(renderer.domElement);

  // Looking down the diagonal at the triangle's centre, Y up.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
  const target = new THREE.Vector3(LEG / 3, (2 * LEG) / 3, 0);
  camera.position.copy(target).addScaledVector(new THREE.Vector3(1, 1, 1).normalize(), 10 * LEG);
  camera.lookAt(target);

  const beamWidth = (THICK_MIN + THICK_STEP * CONFIG.thickness) * LEG;
  const radius = Math.min(MAX_RADIUS, beamWidth / 2 + beamWidth * ROUND_STEP * CONFIG.roundness);
  const { geometry, length: loopLength, cuts } = buildBeam(beamWidth, radius);

  const uLambda = new THREE.Vector3(1, 1, 1);
  const uPhase = new THREE.Vector3();
  const uBlur = new THREE.Vector3();
  const uTexW = new THREE.Vector3(4, 4, 4);
  const uniforms: Record<string, THREE.IUniform> = {
    uLambda: { value: uLambda },
    uPhase: { value: uPhase },
    uBlur: { value: uBlur },
    uTexW: { value: uTexW },
    uSign: { value: new THREE.Vector3(...SIGNS) },
    uCut: { value: cuts },
    uLoop: { value: loopLength },
    uWidth: { value: beamWidth },
    uKey: { value: KEY },
    uBack: { value: BACK },
    uAmbient: { value: AMBIENT },
    uTex0: { value: null },
    uTex1: { value: null },
    uTex2: { value: null },
  };
  for (const [i, face] of FACES.entries()) {
    uniforms[`uFill${i}`] = { value: new THREE.Vector3(...hexToRgb(face.fill)) };
    uniforms[`uInk${i}`] = { value: new THREE.Vector3(...hexToRgb(face.ink)) };
  }

  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.ShaderMaterial({
      vertexShader: BEAM_VERTEX,
      fragmentShader: BEAM_FRAGMENT,
      uniforms,
    })
  );
  mesh.frustumCulled = false;
  scene.add(mesh);

  const shadowUniforms = {
    uCenter: { value: new THREE.Vector2() },
    uSigma: { value: new THREE.Vector2(1, 1) },
    uStrength: { value: SHADOW_STEP * CONFIG.shadow },
  };
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: SHADOW_VERTEX,
      fragmentShader: SHADOW_FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: shadowUniforms,
    })
  );
  shadow.frustumCulled = false;
  shadow.renderOrder = -1;
  scene.add(shadow);

  // Band textures: one repeat of type each, redrawn when web fonts land.
  const lambdas = [1, 1, 1];
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const textures: THREE.CanvasTexture[] = [];
  const buildTextures = () => {
    for (const [i, face] of FACES.entries()) {
      const strip = drawStrip(face);
      const texture = new THREE.CanvasTexture(strip.canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.anisotropy = maxAniso;
      texture.colorSpace = THREE.NoColorSpace;
      textures[i]?.dispose();
      textures[i] = texture;
      lambdas[i] = beamWidth * strip.aspect;
      // Mutate .value: three caches the uniform objects at compile time.
      (uniforms[`uTex${i}`] as THREE.IUniform).value = texture;
      uTexW.setComponent(i, strip.canvas.width);
    }
    uLambda.set(...(lambdas as [number, number, number]));
  };
  buildTextures();
  document.fonts.addEventListener('loadingdone', buildTextures);

  const layout = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    const side = Math.max(1, Math.min(w * FIT_W, h * FIT_H)) * (CONFIG.scale / 100);
    const pxPerUnit = side / (LEG * ISO);
    camera.left = -w / 2 / pxPerUnit;
    camera.right = w / 2 / pxPerUnit;
    camera.top = h / 2 / pxPerUnit;
    camera.bottom = -h / 2 / pxPerUnit;
    camera.updateProjectionMatrix();
    const dpr = renderer.getPixelRatio();
    shadowUniforms.uCenter.value.set(
      (w / 2 + SHADOW_OFFSET.x * side) * dpr,
      (h / 2 - SHADOW_OFFSET.y * side) * dpr
    );
    shadowUniforms.uSigma.value.set(SHADOW_SIGMA.x * side * dpr, SHADOW_SIGMA.y * side * dpr);
  };
  layout();
  new ResizeObserver(layout).observe(container);

  // Motion: a belt position (world units), eased running rate, drag fling.
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let scroll = 0;
  let drawnScroll = 0;
  let rate = -1;
  let fling = 0;
  let hovering = false;
  let visible = true;
  let press = { id: -1, angle: 0, time: 0, velocity: 0 };

  const targetRate = () =>
    reducedMotion.matches ? 0 : (hovering ? CONFIG.hoverSpeed : CONFIG.speed) * SPEED_UNIT;

  const angleOf = (event: PointerEvent) => {
    const rect = container.getBoundingClientRect();
    // Screen y runs down, so this angle grows clockwise: the forward flow.
    return Math.atan2(
      event.clientY - (rect.top + rect.height / 2),
      event.clientX - (rect.left + rect.width / 2)
    );
  };

  container.style.cursor = 'grab';
  container.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    press = { id: event.pointerId, angle: angleOf(event), time: performance.now(), velocity: 0 };
    fling = 0;
    container.setPointerCapture(event.pointerId);
    container.style.cursor = 'grabbing';
  });
  container.addEventListener('pointermove', (event) => {
    if (event.pointerId !== press.id) {
      return;
    }
    const angle = angleOf(event);
    let delta = angle - press.angle;
    if (delta > Math.PI) {
      delta -= 2 * Math.PI;
    }
    if (delta < -Math.PI) {
      delta += 2 * Math.PI;
    }
    // Near the centre one pixel is a large angle; cap a single step.
    delta = Math.max(-0.5, Math.min(0.5, delta));
    press.angle = angle;
    const ds = (delta / (2 * Math.PI)) * loopLength;
    scroll += ds;
    const now = performance.now();
    const dt = Math.max(1, now - press.time) / 1000;
    press.time = now;
    press.velocity = press.velocity * 0.5 + (ds / dt) * 0.5;
  });
  const release = (event: PointerEvent) => {
    if (event.pointerId !== press.id) {
      return;
    }
    // What the hand added on top of the running speed carries on, then fades.
    const idle = performance.now() - press.time > 80;
    fling = idle ? 0 : press.velocity - Math.max(0, rate);
    press.id = -1;
    container.style.cursor = 'grab';
  };
  container.addEventListener('pointerup', release);
  container.addEventListener('pointercancel', release);
  // Touch has no hover: a tap would latch the fast speed.
  container.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'touch') {
      hovering = true;
    }
  });
  container.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'touch') {
      hovering = false;
    }
  });
  new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
  }).observe(container);

  const phase = (lambda: number) => {
    const x = scroll / lambda;
    return x - Math.floor(x);
  };

  // Stepped off the frame's own timestamp so motion stays even at hover speed.
  let lastT = -1;
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    // A tab back from the background must not jump the belt.
    const dt = lastT < 0 ? 0 : Math.min(0.1, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    if (!visible) {
      return;
    }

    const goal = targetRate();
    if (rate < 0) {
      rate = goal;
    }
    rate += (goal - rate) * (1 - Math.exp(-dt / (hovering ? HOVER_ATTACK : HOVER_RELEASE)));
    if (press.id === -1) {
      scroll += (rate + fling) * dt;
      fling *= Math.exp(-FLING_DECAY * dt);
      if (Math.abs(fling) < 1e-4) {
        fling = 0;
      }
    }

    const [l0, l1, l2] = lambdas as [number, number, number];
    uPhase.set(phase(l0), phase(l1), phase(l2));
    // Smear each band over its travel since the last frame, so fast type rushes.
    const step = Math.abs(scroll - drawnScroll);
    drawnScroll = scroll;
    const blur = (lambda: number) => Math.min(MAX_BLUR, step / lambda);
    uBlur.set(blur(l0), blur(l1), blur(l2));
    renderer.render(scene, camera);
  };
  requestAnimationFrame(loop);
}
