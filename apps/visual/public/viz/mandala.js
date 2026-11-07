// "Manifold Mandala" by Liam Egan (shubniggurath)
// https://codepen.io/editor/shubniggurath/pen/01a10e01-ac64-7d4c-a9d3-f08a20497a99
// Source lives in ./mandala/ (wtc-gl). This wrapper only adapts it to the viz contract.
import { makeHandle } from '../shader.js';

export default {
  title: 'Manifold Mandala',
  credit:
    'Liam Egan — https://codepen.io/editor/shubniggurath/pen/01a10e01-ac64-7d4c-a9d3-f08a20497a99',
  dpr: 0.75, // float MRT + outline/AO post pass is bandwidth-bound; the original ran at dpr 2
  tags: ['wtc-gl', 'instancing', 'MRT', 'post-processing', 'SSAO'],
  about: `A tunnel of procedural rings, each an **instanced** module repeated N times around
a circle by the vertex shader (see \`mandala/ring.vert.js\`). The scene renders colour+depth
and normals into two float targets at once (multiple render targets), and a post pass
(\`mandala/post.frag.js\`) adds tinted outlines, screen-space ambient occlusion and depth fog
into a pastel sky. Rings regrow with new shapes over time and the palette ("world") cycles.
The largest viz here; read \`mandala/scene.js\` top to bottom for a full small engine.`,
  params: {
    speed: {
      type: 'float',
      default: 1,
      min: 0,
      max: 4,
      step: 0.05,
      group: 'Motion',
      doc: 'Scene clock multiplier.',
    },
    spin: {
      type: 'float',
      default: 1,
      min: -3,
      max: 3,
      step: 0.05,
      group: 'Motion',
      doc: 'Per-ring rotation rate multiplier.',
    },
    swirl: {
      type: 'float',
      default: 0.035,
      min: 0,
      max: 0.2,
      step: 0.001,
      group: 'Motion',
      doc: 'Vortex twist amplitude (winds and unwinds over time).',
    },
    roll: {
      type: 'float',
      default: 0.015,
      min: -0.1,
      max: 0.1,
      step: 0.001,
      group: 'Motion',
      doc: 'Camera roll rate.',
    },
    orbitSpeed: {
      type: 'float',
      default: 1,
      min: 0,
      max: 4,
      step: 0.05,
      group: 'Motion',
      doc: 'Auto-orbit speed.',
    },
    worldEvery: {
      type: 'float',
      default: 45,
      min: 2,
      max: 120,
      step: 1,
      group: 'Life',
      doc: 'Seconds between palette changes.',
    },
    regrowEvery: {
      type: 'float',
      default: 2.2,
      min: 0.1,
      max: 10,
      step: 0.1,
      group: 'Life',
      doc: 'Seconds between single-ring re-rolls.',
    },
    world: {
      type: 'select',
      default: 'cycle',
      options: [
        'cycle',
        'lemon',
        'sea',
        'lilac',
        'ember',
        'sorbet',
        'teal',
        'rose',
        'sky',
        'moss',
        'slate',
      ],
      group: 'Look',
      doc: 'Palette. "cycle" advances every worldEvery seconds.',
    },
    night: {
      type: 'bool',
      default: false,
      group: 'Look',
      doc: "The original's dark mode (post-pass tint).",
    },
    fov: {
      type: 'float',
      default: 85,
      min: 30,
      max: 140,
      step: 1,
      group: 'Look',
      doc: 'Camera field of view in degrees.',
    },
    fog: {
      type: 'float',
      default: 40,
      min: 0,
      max: 100,
      step: 1,
      group: 'Post',
      doc: 'Fog strength.',
    },
    fogDist: {
      type: 'float',
      default: 15,
      min: 0,
      max: 40,
      step: 0.5,
      group: 'Post',
      doc: 'Fog starts this far in front of the mandala.',
    },
    lines: {
      type: 'float',
      default: 0.5,
      min: 0,
      max: 2,
      step: 0.05,
      group: 'Post',
      doc: 'Outline strength.',
    },
    ao: {
      type: 'float',
      default: 1,
      min: 0,
      max: 3,
      step: 0.05,
      group: 'Post',
      doc: 'Screen-space ambient occlusion strength.',
    },
  },
  presets: {
    Default: {},
    Night: { night: true, lines: 1, fog: 60 },
    Frantic: { speed: 2.5, spin: 3, regrowEvery: 0.3, worldEvery: 6 },
    Blueprint: { world: 'sea', lines: 2, ao: 0, fog: 10, fov: 110 },
  },
  notes: [
    {
      title: 'Pre-roll',
      find: 'if (last === null)',
      body: 'Rings unfold from nothing, so the first frame runs 2 s of updates. Thumbnails are a single frame and would otherwise be empty.',
    },
    {
      title: 'Fixed-step feel',
      find: 'Math.min(0.1, Math.max(0, t - last))',
      body: 'Clamp dt so a paused tab or a seek does not explode the simulation.',
    },
  ],
  async create(canvas, p) {
    const { createMandala } = await import('./mandala/scene.js');
    const m = createMandala(canvas, p);
    let last = null;
    return makeHandle({
      render(t) {
        // rings unfold from nothing, so pre-roll 2 s on the first frame (snapshots are one frame)
        if (last === null) for (let k = 0; k < 120; k++) m.update(1 / 60);
        else m.update(Math.min(0.1, Math.max(0, t - last)));
        last = t;
        m.draw();
      },
      resize: (w, h) => m.resize(w, h),
      dispose: () => m.dispose(),
    });
  },
};
