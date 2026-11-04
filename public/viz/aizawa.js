// "Holographic Aizawa Attractor" by VoXelo — https://codepen.io/VoXelo/pen/pvRejNE
// Kept: RK4 attractor, 3 additive line layers + shaders, base disk, particles,
// UnrealBloom. Dropped: HUD, fonts, GSAP intro, OrbitControls (orbit is manual).
import { makeHandle } from '../shader.js';

const BURN_IN = 3000;

const vertexShader = `
    attribute float lineDistance;
    varying vec3 vPos;
    varying float vDistance;

    void main() {
        vPos = position;
        vDistance = lineDistance;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const fragmentShader = `
    uniform float time;
    uniform float phase;
    uniform float gain;

    varying vec3 vPos;
    varying float vDistance;

    vec3 palette(float t) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.00, 0.33, 0.67);
        return a + b * cos(6.28318 * (c * t + d));
    }

    void main() {
        float height = clamp((vPos.y + 19.0) / 43.0, 0.0, 1.0);
        float radial = length(vPos.xz) * 0.02;

        float microCell = fract(vDistance * 300.0 - time * 0.5);
        float microBreak = smoothstep(0.1, 0.3, microCell) * (1.0 - smoothstep(0.7, 0.9, microCell));

        float dashCell = fract(vDistance * 20.0 - time * 0.1 + phase);
        float dash = smoothstep(0.0, 0.1, dashCell) * (1.0 - smoothstep(0.8, 0.9, dashCell));

        float mask = mix(1.0, dash * microBreak, 0.8);
        if (mask < 0.05) discard;

        float cometA = fract(vDistance * 12.0 - time * 0.6 + phase);
        float cometB = fract(vDistance * 25.0 - time * 0.9 + phase * 1.5);

        float packetA = pow(1.0 - abs(cometA - 0.5) * 2.0, 12.0);
        float packetB = pow(1.0 - abs(cometB - 0.5) * 2.0, 24.0);

        float wave = pow(sin(vDistance * 40.0 - time * 2.0) * 0.5 + 0.5, 2.0);

        vec3 baseColor = palette(height - time * 0.05 + phase * 0.2);
        vec3 coreGlow = vec3(1.0, 1.0, 1.0);
        vec3 cyanAccent = vec3(0.0, 0.9, 1.0);
        vec3 magentaAccent = vec3(1.0, 0.2, 0.8);

        vec3 color = baseColor * (0.3 + wave * 0.5);
        color += cyanAccent * packetA * 2.0;
        color += magentaAccent * packetB * 2.5;
        color += coreGlow * pow(packetA + packetB, 2.0) * 1.5;

        color *= gain;

        float alpha = mask * (0.5 + wave * 0.3 + packetA + packetB);
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
    }
`;

const baseVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const baseFragmentShader = `
    uniform float time;
    varying vec2 vUv;

    void main() {
        vec2 uv = vUv * 2.0 - 1.0;
        float r = length(uv);
        float angle = atan(uv.y, uv.x);

        if (r > 1.0) discard;

        float rings = fract(r * 15.0 - time * 0.2);
        float ringLines = smoothstep(0.85, 0.95, rings);

        float rays = fract(angle * 6.0 / 3.14159);
        float rayLines = smoothstep(0.95, 1.0, rays) + smoothstep(0.05, 0.0, rays);

        float sweep = mod(angle - time * 1.5, 6.28318) / 6.28318;
        sweep = pow(1.0 - sweep, 6.0);

        float edge = smoothstep(0.9, 1.0, r);
        float centerGlow = exp(-r * 5.0);

        vec3 cyan = vec3(0.0, 0.8, 1.0);
        vec3 blue = vec3(0.1, 0.3, 0.8);

        vec3 color = cyan * (ringLines * 0.2 + rayLines * 0.1 * r) * (1.0 - r);
        color += cyan * sweep * 0.5 * (1.0 - r);
        color += blue * centerGlow * 0.8;
        color += cyan * edge * 0.5;

        float alpha = (ringLines * 0.3 + rayLines * 0.2 + sweep * 0.6 + centerGlow + edge) * (1.0 - r * 0.8);
        gl_FragColor = vec4(color, alpha * 0.8);
    }
`;

// The Aizawa system. a..f are the attractor's constants; the defaults are the classic set.
function derivatives(x, y, z, C) {
  const dx = (z - C.b) * x - C.d * y;
  const dy = C.d * x + (z - C.b) * y;
  const dz = C.c + C.a * z - (z * z * z) / 3.0 - (x * x + y * y) * (1.0 + C.e * z) + C.f * z * x * x * x;
  return { dx, dy, dz };
}

// Classic 4th-order Runge-Kutta: four slope estimates per step, weighted 1-2-2-1.
function rk4Step(state, C) {
  const { x, y, z } = state;
  const dt = C.dt;
  const k1 = derivatives(x, y, z, C);
  const k2 = derivatives(x + k1.dx * dt * 0.5, y + k1.dy * dt * 0.5, z + k1.dz * dt * 0.5, C);
  const k3 = derivatives(x + k2.dx * dt * 0.5, y + k2.dy * dt * 0.5, z + k2.dz * dt * 0.5, C);
  const k4 = derivatives(x + k3.dx * dt, y + k3.dy * dt, z + k3.dz * dt, C);
  state.x += (dt / 6.0) * (k1.dx + 2.0 * k2.dx + 2.0 * k3.dx + k4.dx);
  state.y += (dt / 6.0) * (k1.dy + 2.0 * k2.dy + 2.0 * k3.dy + k4.dy);
  state.z += (dt / 6.0) * (k1.dz + 2.0 * k2.dz + 2.0 * k3.dz + k4.dz);
}

function generateGeometry(THREE, C) {
  const positions = new Float32Array(C.points * 3);
  const lineDistances = new Float32Array(C.points);
  const state = { x: 0.1, y: 0.0, z: 0.0 };
  for (let i = 0; i < BURN_IN; i++) rk4Step(state, C); // let the trajectory fall onto the attractor first
  for (let i = 0; i < C.points; i++) {
    rk4Step(state, C);
    positions[i * 3] = state.x * C.scale;
    positions[i * 3 + 1] = state.z * C.scale;
    positions[i * 3 + 2] = state.y * C.scale;
    lineDistances[i] = i / C.points;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('lineDistance', new THREE.BufferAttribute(lineDistances, 1));
  geometry.computeBoundingBox();
  const center = new THREE.Vector3();
  geometry.boundingBox.getCenter(center);
  geometry.translate(-center.x, -center.y + 6, -center.z);
  return geometry;
}

export default {
  title: 'Aizawa Attractor',
  credit: 'VoXelo — https://codepen.io/VoXelo/pen/pvRejNE',
  dpr: 1, // bloom pass; dpr 1 is the original's practical ceiling on most GPUs anyway
  tags: ['three.js', 'strange attractor', 'RK4', 'additive blending', 'bloom'],
  about: `A **strange attractor**: integrate a small system of differential equations
(the Aizawa system) with Runge-Kutta, and the trajectory traces a shape it never leaves.
120k points become one \`THREE.Line\`, drawn three times with additive blending and a custom
fragment shader that runs dashes and "comet" packets along the line distance. UnrealBloom
on top. The constants a..f are the attractor itself: nudge them and the shape changes
character or collapses.`,
  params: {
    a: { type: 'float', default: 0.95, min: 0.5, max: 1.3, step: 0.005, live: false, group: 'Attractor', doc: 'Aizawa a. Regenerates the trajectory.' },
    b: { type: 'float', default: 0.7, min: 0.3, max: 1.1, step: 0.005, live: false, group: 'Attractor', doc: 'Aizawa b.' },
    c: { type: 'float', default: 0.6, min: 0.2, max: 1.0, step: 0.005, live: false, group: 'Attractor', doc: 'Aizawa c.' },
    d: { type: 'float', default: 3.5, min: 2, max: 5, step: 0.01, live: false, group: 'Attractor', doc: 'Aizawa d (rotation rate around z).' },
    e: { type: 'float', default: 0.25, min: 0, max: 0.6, step: 0.005, live: false, group: 'Attractor', doc: 'Aizawa e.' },
    f: { type: 'float', default: 0.1, min: 0, max: 0.3, step: 0.005, live: false, group: 'Attractor', doc: 'Aizawa f.' },
    points: { type: 'int', default: 120000, min: 5000, max: 300000, step: 5000, live: false, group: 'Attractor', doc: 'Trajectory samples.' },
    dt: { type: 'float', default: 0.0045, min: 0.001, max: 0.02, step: 0.0005, live: false, group: 'Attractor', doc: 'Integration step. Too large and RK4 flies off the attractor.' },
    scale: { type: 'float', default: 16, min: 5, max: 30, step: 0.5, live: false, group: 'Attractor', doc: 'World units per attractor unit.' },
    speed: { type: 'float', default: 1, min: 0, max: 4, step: 0.05, group: 'Motion', doc: 'Shader time multiplier (dash and comet speed).' },
    orbit: { type: 'float', default: 75, min: 5, max: 300, step: 1, group: 'Motion', doc: 'Seconds per camera orbit.' },
    gain: { type: 'float', default: 1, min: 0, max: 3, step: 0.05, group: 'Look', doc: 'Line brightness multiplier (before bloom).' },
    bloom: { type: 'float', default: 0.6, min: 0, max: 3, step: 0.05, group: 'Look', doc: 'UnrealBloom strength.' },
    bloomRadius: { type: 'float', default: 0.5, min: 0, max: 1, step: 0.01, group: 'Look', doc: 'UnrealBloom radius.' },
    bloomThreshold: { type: 'float', default: 0.2, min: 0, max: 1, step: 0.01, group: 'Look', doc: 'Brightness below which bloom ignores a pixel.' },
    fog: { type: 'float', default: 0.006, min: 0, max: 0.03, step: 0.0005, group: 'Look', doc: 'Exponential fog density.' },
  },
  presets: {
    'Default': {},
    'Wild': { a: 1.15, e: 0.45, f: 0.22, bloom: 1.2 },
    'Thin': { points: 40000, gain: 2, bloom: 0.3, dt: 0.009 },
    'Fast orbit': { orbit: 12, speed: 2.5 },
  },
  notes: [
    { title: 'The system', find: 'function derivatives(x, y, z, C)', body: 'Three coupled ODEs. The `z` equation\'s cubic terms are what fold the flow back onto itself.' },
    { title: 'Integration', find: 'function rk4Step(state, C)', body: 'RK4 is accurate enough that a 120k-point trajectory stays on the attractor; Euler would spiral away at this dt.' },
    { title: 'Burn-in', find: 'for (let i = 0; i < BURN_IN; i++)', body: 'Discard the first few thousand steps so the drawn curve starts on the attractor, not on the approach to it.' },
    { title: 'Dashes along the line', find: 'float dashCell = fract(vDistance', body: 'The vertex attribute `lineDistance` (0..1 along the curve) feeds fract() to make moving dashes and comet packets in the fragment shader.' },
    { title: 'Three additive copies', find: 'const lines = [', body: 'Same geometry, three phases and gains, slightly scaled and rotated. Additive blending sums them into a hologram-like glow.' },
  ],
  async create(canvas, p) {
    const [THREE, { EffectComposer }, { RenderPass }, { UnrealBloomPass }] = await Promise.all([
      import('three'),
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'),
    ]);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0515, p.fog);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    const target = new THREE.Vector3(0, 4, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x07041a, 1); // stands in for the original's CSS radial gradient
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), p.bloom, p.bloomRadius, p.bloomThreshold);
    composer.addPass(bloomPass);

    const attractorGeo = generateGeometry(THREE, p);
    const createMaterial = (phase, gain) => new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, phase: { value: phase }, gain: { value: gain } },
      vertexShader, fragmentShader,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    });
    const attractorGroup = new THREE.Group();
    scene.add(attractorGroup);
    const GAINS = [1.2, 0.6, 0.4];
    const lines = [
      new THREE.Line(attractorGeo, createMaterial(0.0, GAINS[0])),
      new THREE.Line(attractorGeo, createMaterial(0.3, GAINS[1])),
      new THREE.Line(attractorGeo, createMaterial(0.6, GAINS[2])),
    ];
    lines[1].scale.setScalar(1.01); lines[1].rotation.y = 0.01;
    lines[2].scale.setScalar(0.99); lines[2].rotation.x = -0.01;
    lines.forEach((l) => attractorGroup.add(l));

    const baseMaterial = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: baseVertexShader, fragmentShader: baseFragmentShader,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const baseDisk = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), baseMaterial);
    baseDisk.rotation.x = -Math.PI / 2;
    baseDisk.position.y = -18;
    scene.add(baseDisk);

    const pCount = 1500;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i++) pPos[i] = (Math.random() - 0.5) * 200;
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x00eaff, size: 0.5, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // OrbitControls autoRotateSpeed 0.8 == one orbit per 75 s, from (0,15,80) around the target.
    let sizeGain = 1;

    return makeHandle({
      render(t) {
        const time = t * p.speed;
        const ORBIT = (Math.PI * 2) / p.orbit;
        lines.forEach((l, i) => { l.material.uniforms.time.value = time; l.material.uniforms.gain.value = GAINS[i] * sizeGain * p.gain; });
        bloomPass.strength = p.bloom; bloomPass.radius = p.bloomRadius; bloomPass.threshold = p.bloomThreshold;
        scene.fog.density = p.fog;
        baseMaterial.uniforms.time.value = time;
        attractorGroup.rotation.y = Math.sin(time * 0.2) * 0.2;
        attractorGroup.position.y = Math.sin(time * 0.5) * 1.5;
        particles.rotation.y = time * 0.02;
        particles.rotation.z = time * 0.01;
        camera.position.set(80 * Math.sin(t * ORBIT), 15, 80 * Math.cos(t * ORBIT));
        camera.lookAt(target);
        composer.render();
      },
      resize(w, h) {
        // 120k additively-blended line segments saturate to white on a small canvas;
        // scale line gain with width so thumbnails and tiles keep the fullscreen look.
        sizeGain = Math.min(1, w / 1600);
        pMat.opacity = 0.4 * sizeGain;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
        composer.setSize(w, h);
        bloomPass.setSize(w, h);
      },
      dispose() {
        attractorGeo.dispose(); pGeo.dispose(); baseDisk.geometry.dispose();
        lines.forEach((l) => l.material.dispose());
        baseMaterial.dispose(); pMat.dispose();
        composer.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      },
    });
  },
};
