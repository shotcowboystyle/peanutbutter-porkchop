// "Trippy Triangles" by soju22 — https://codepen.io/soju22/pen/daKapP
// three r100 + TweenMax + randomColor in the original; here: three ESM,
// a hand-rolled yoyo ease, fixed pastel light colours, no OrbitControls.
import { makeHandle } from '../shader.js';

const LIGHTS = [0xffb3ba, 0xbaffc9, 0xbae1ff, 0xffffba, 0xe0baff, 0xffd8b3];

// TweenMax Power1.easeInOut + repeat:-1 + yoyo
const quadInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
function yoyo(t, delay, duration) {
  const p = Math.max(0, t - delay) % (duration * 2);
  const x = p < duration ? p / duration : 2 - p / duration;
  return quadInOut(x);
}

function triangleGeometry(THREE, radius, thickness, depth) {
  const shape = new THREE.Shape();
  let r = radius + thickness;
  let y = Math.sin(-Math.PI / 6) * r;
  let x = Math.cos(Math.PI / 6) * r;
  shape.moveTo(0, r);
  shape.lineTo(-x, y);
  shape.lineTo(x, y);
  shape.lineTo(0, r);

  const hole = new THREE.Path();
  r = radius;
  y = Math.sin(-Math.PI / 6) * r;
  x = Math.cos(Math.PI / 6) * r;
  hole.moveTo(0, r);
  hole.lineTo(-x, y);
  hole.lineTo(x, y);
  hole.lineTo(0, r);
  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, { steps: 1, depth, bevelEnabled: false });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

export default {
  title: 'Trippy Triangles',
  credit: 'soju22 — https://codepen.io/soju22/pen/daKapP',
  dpr: 1, // original never set a pixel ratio; 6 point lights on MeshStandardMaterial is fragment-bound
  tags: ['three.js', 'geometry', 'PBR lighting', 'easing'],
  about: `Nested triangular frames (extruded shapes with a triangular hole) rotating with a
staggered **yoyo ease**. No custom shader: three.js's \`MeshStandardMaterial\` with six
coloured point lights does the shading. The trippiness is all timing: each frame starts its
ease a little later than the one inside it, so the stack twists like a spring.`,
  params: {
    duration:  { type: 'float', default: 9, min: 1, max: 30, step: 0.5, group: 'Motion', doc: 'Seconds for one half-turn ease.' },
    delay:     { type: 'float', default: 0.1, min: 0, max: 2, step: 0.01, group: 'Motion', doc: 'Stagger between consecutive frames. This is the twist.' },
    roughness: { type: 'float', default: 0.4, min: 0, max: 1, step: 0.01, group: 'Material', doc: 'PBR roughness. 0 = mirror.' },
    metalness: { type: 'float', default: 0.9, min: 0, max: 1, step: 0.01, group: 'Material', doc: 'PBR metalness. Metals have no diffuse colour, only reflections of the lights.' },
    light:     { type: 'float', default: 0.5, min: 0, max: 3, step: 0.05, group: 'Material', doc: 'Intensity of each coloured point light.' },
    cameraZ:   { type: 'float', default: 75, min: 10, max: 200, step: 1, group: 'Camera', doc: 'Camera distance.' },
    count:     { type: 'int', default: 25, min: 1, max: 60, step: 1, live: false, group: 'Geometry', doc: 'Number of nested frames (rebuilds geometry).' },
    spacing:   { type: 'float', default: 1.5, min: 0.5, max: 4, step: 0.1, live: false, group: 'Geometry', doc: 'Radius step between frames.' },
    thickness: { type: 'float', default: 0.5, min: 0.05, max: 3, step: 0.05, live: false, group: 'Geometry', doc: 'Frame bar width.' },
    depth:     { type: 'float', default: 0.5, min: 0.05, max: 5, step: 0.05, live: false, group: 'Geometry', doc: 'Extrusion depth.' },
  },
  presets: {
    'Default': {},
    'Spring': { delay: 0.6, duration: 4, count: 40, spacing: 1 },
    'Chunky matte': { thickness: 2, depth: 3, roughness: 0.9, metalness: 0.1, light: 1.5, count: 12 },
  },
  notes: [
    { title: 'Shape with a hole', find: 'shape.holes.push(hole);', body: 'A three.js Shape can carry inner Paths as holes; ExtrudeGeometry respects them, which is how a frame is built from one shape.' },
    { title: 'Yoyo easing', find: 'function yoyo(t, delay, duration)', body: 'Fold time into 0..1..0 with modulo, then ease it. This replaces the TweenMax dependency of the original in five lines.' },
    { title: 'Stagger', find: 'yoyo(t, i * delay, duration)', body: 'Frame i lags by i * delay. Identical motion, offset in time, reads as a twist.' },
  ],
  async create(canvas, p) {
    const THREE = await import('three');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.useLegacyLights = true; // original look is r100's non-physical lighting
    renderer.setPixelRatio(1);

    scene.add(new THREE.AmbientLight(0xeeeeee));
    const positions = [[0, 100, 0], [0, -100, 0], [100, 0, 0], [-100, 0, 0], [0, 0, 100], [0, 0, -100]];
    const lights = positions.map((pos, i) => {
      const light = new THREE.PointLight(LIGHTS[i], p.light, 200);
      light.position.set(...pos);
      scene.add(light);
      return light;
    });

    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: p.roughness, metalness: p.metalness });
    const meshes = [];
    for (let i = 0; i < p.count; i++) {
      const mesh = new THREE.Mesh(triangleGeometry(THREE, 1 + p.spacing * i, p.thickness, p.depth), material);
      scene.add(mesh);
      meshes.push(mesh);
    }

    return makeHandle({
      render(t) {
        material.roughness = p.roughness;
        material.metalness = p.metalness;
        lights.forEach((l) => { l.intensity = p.light; });
        camera.position.z = p.cameraZ;
        meshes.forEach((m, i) => { m.rotation.y = m.rotation.z = Math.PI * 2 * yoyo(t, i * p.delay, p.duration); });
        renderer.render(scene, camera);
      },
      resize(w, h) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      },
      dispose() {
        meshes.forEach((m) => m.geometry.dispose());
        material.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      },
    });
  },
};
