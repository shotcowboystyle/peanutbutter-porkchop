// __TITLE__ — <credit / source link>. three.js scene (ESM from the CDN import map).
import { makeHandle } from '../shader.js';

export default {
  title: '__TITLE__',
  credit: 'you — https://example.com',
  dpr: 1,
  tags: ['three.js', 'template'],
  about: `One paragraph on what this is and the single idea that makes it work.`,
  params: {
    speed: {
      type: 'float',
      default: 1,
      min: 0,
      max: 4,
      step: 0.01,
      group: 'Motion',
      doc: 'Rotation rate.',
    },
    color: { type: 'color', default: [0.5, 0.8, 1], group: 'Look', doc: 'Material colour.' },
    count: {
      type: 'int',
      default: 8,
      min: 1,
      max: 64,
      step: 1,
      live: false,
      group: 'Geometry',
      doc: 'Mesh count. Rebuilds the scene.',
    },
  },
  presets: { Default: {}, Swarm: { count: 48, speed: 2 } },
  notes: [
    {
      title: 'Rebuild params',
      find: 'for (let i = 0; i < p.count',
      body: '`count` is `live: false`: read once here; the studio recreates the viz when it changes.',
    },
    {
      title: 'Dispose everything',
      find: 'dispose()',
      body: 'Geometry, material, renderer, then forceContextLoss(). The site keeps one live context at a time.',
    },
  ],
  async create(canvas, p) {
    const THREE = await import('three');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 12;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(1);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(3, 5, 4);
    scene.add(light);

    const geometry = new THREE.TorusKnotGeometry(0.6, 0.2, 96, 16);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(...p.color),
      roughness: 0.4,
      metalness: 0.3,
    });
    const meshes = [];
    for (let i = 0; i < p.count; i++) {
      const m = new THREE.Mesh(geometry, material);
      const a = (i / p.count) * Math.PI * 2;
      m.position.set(Math.cos(a) * 4, Math.sin(a) * 4, 0);
      scene.add(m);
      meshes.push(m);
    }

    return makeHandle({
      render(t) {
        material.color.setRGB(...p.color);
        meshes.forEach((m, i) => {
          m.rotation.x = t * p.speed + i;
          m.rotation.y = t * p.speed * 0.7;
        });
        scene.rotation.z = t * p.speed * 0.1;
        renderer.render(scene, camera);
      },
      resize(w, h) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      },
      dispose() {
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      },
    });
  },
};
