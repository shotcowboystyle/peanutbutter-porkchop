// "Trippy Triangles" by soju22 — https://codepen.io/soju22/pen/daKapP
// three r100 + TweenMax + randomColor in the original; here: three ESM,
// a hand-rolled yoyo ease, fixed pastel light colours, no OrbitControls.
import { makeHandle } from '../shader.js';

const nbObjects = 25, objectMinRadius = 1, objectRadiusCoef = 1.5, objectThickness = 0.5, objectDepth = 0.5;
const animationDuration = 9, animationDelay = 0.1;
const LIGHTS = [0xffb3ba, 0xbaffc9, 0xbae1ff, 0xffffba, 0xe0baff, 0xffd8b3];

// TweenMax Power1.easeInOut + repeat:-1 + yoyo
const quadInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
function yoyo(t, delay) {
  const p = Math.max(0, t - delay) % (animationDuration * 2);
  const x = p < animationDuration ? p / animationDuration : 2 - p / animationDuration;
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
  async create(canvas) {
    const THREE = await import('three');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);
    camera.position.z = 75;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.useLegacyLights = true; // original look is r100's non-physical lighting
    renderer.setPixelRatio(1);

    scene.add(new THREE.AmbientLight(0xeeeeee));
    const positions = [[0, 100, 0], [0, -100, 0], [100, 0, 0], [-100, 0, 0], [0, 0, 100], [0, 0, -100]];
    positions.forEach((p, i) => {
      const light = new THREE.PointLight(LIGHTS[i], 0.5, 200);
      light.position.set(...p);
      scene.add(light);
    });

    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.9 });
    const meshes = [];
    for (let i = 0; i < nbObjects; i++) {
      const mesh = new THREE.Mesh(triangleGeometry(THREE, objectMinRadius + objectRadiusCoef * i, objectThickness, objectDepth), material);
      scene.add(mesh);
      meshes.push(mesh);
    }

    return makeHandle({
      render(t) {
        meshes.forEach((m, i) => { m.rotation.y = m.rotation.z = Math.PI * 2 * yoyo(t, i * animationDelay); });
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
