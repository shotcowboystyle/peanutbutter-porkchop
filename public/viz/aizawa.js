// "Holographic Aizawa Attractor" by VoXelo — https://codepen.io/VoXelo/pen/pvRejNE
// Kept: RK4 attractor, 3 additive line layers + shaders, base disk, particles,
// UnrealBloom. Dropped: HUD, fonts, GSAP intro, OrbitControls (orbit is manual).
import { makeHandle } from '../shader.js';

const CONFIG = {
  points: 120000, burnIn: 3000, dt: 0.0045, scale: 16.0,
  a: 0.95, b: 0.70, c: 0.60, d: 3.50, e: 0.25, f: 0.10,
};

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

function derivatives(x, y, z) {
  const dx = (z - CONFIG.b) * x - CONFIG.d * y;
  const dy = CONFIG.d * x + (z - CONFIG.b) * y;
  const dz = CONFIG.c + CONFIG.a * z - (z * z * z) / 3.0 - (x * x + y * y) * (1.0 + CONFIG.e * z) + CONFIG.f * z * x * x * x;
  return { dx, dy, dz };
}

function rk4Step(state) {
  const { x, y, z } = state;
  const dt = CONFIG.dt;
  const k1 = derivatives(x, y, z);
  const k2 = derivatives(x + k1.dx * dt * 0.5, y + k1.dy * dt * 0.5, z + k1.dz * dt * 0.5);
  const k3 = derivatives(x + k2.dx * dt * 0.5, y + k2.dy * dt * 0.5, z + k2.dz * dt * 0.5);
  const k4 = derivatives(x + k3.dx * dt, y + k3.dy * dt, z + k3.dz * dt);
  state.x += (dt / 6.0) * (k1.dx + 2.0 * k2.dx + 2.0 * k3.dx + k4.dx);
  state.y += (dt / 6.0) * (k1.dy + 2.0 * k2.dy + 2.0 * k3.dy + k4.dy);
  state.z += (dt / 6.0) * (k1.dz + 2.0 * k2.dz + 2.0 * k3.dz + k4.dz);
}

function generateGeometry(THREE) {
  const positions = new Float32Array(CONFIG.points * 3);
  const lineDistances = new Float32Array(CONFIG.points);
  const state = { x: 0.1, y: 0.0, z: 0.0 };
  for (let i = 0; i < CONFIG.burnIn; i++) rk4Step(state);
  for (let i = 0; i < CONFIG.points; i++) {
    rk4Step(state);
    positions[i * 3] = state.x * CONFIG.scale;
    positions[i * 3 + 1] = state.z * CONFIG.scale;
    positions[i * 3 + 2] = state.y * CONFIG.scale;
    lineDistances[i] = i / CONFIG.points;
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
  async create(canvas) {
    const [THREE, { EffectComposer }, { RenderPass }, { UnrealBloomPass }] = await Promise.all([
      import('three'),
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'),
    ]);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0515, 0.006);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    const target = new THREE.Vector3(0, 4, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x07041a, 1); // stands in for the original's CSS radial gradient
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.5, 0.2);
    composer.addPass(bloomPass);

    const attractorGeo = generateGeometry(THREE);
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
    const ORBIT = (Math.PI * 2) / 75;

    return makeHandle({
      render(time) {
        lines.forEach((l) => { l.material.uniforms.time.value = time; });
        baseMaterial.uniforms.time.value = time;
        attractorGroup.rotation.y = Math.sin(time * 0.2) * 0.2;
        attractorGroup.position.y = Math.sin(time * 0.5) * 1.5;
        particles.rotation.y = time * 0.02;
        particles.rotation.z = time * 0.01;
        camera.position.set(80 * Math.sin(time * ORBIT), 15, 80 * Math.cos(time * ORBIT));
        camera.lookAt(target);
        composer.render();
      },
      resize(w, h) {
        // 120k additively-blended line segments saturate to white on a small canvas;
        // scale line gain with width so thumbnails and tiles keep the fullscreen look.
        const f = Math.min(1, w / 1600);
        lines.forEach((l, i) => { l.material.uniforms.gain.value = GAINS[i] * f; });
        pMat.opacity = 0.4 * f;
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
