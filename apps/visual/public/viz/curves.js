// "trippy curves" by gmihalios — https://codepen.io/gmihalios/pen/yNENOZ
// Canvas 2D. Original UI controls removed: rotate on, fill off, 666 curves.
import { makeHandle } from '../shader.js';

export default {
  title: 'Trippy Curves',
  credit: 'gmihalios — https://codepen.io/gmihalios/pen/yNENOZ',
  dpr: 1,
  tags: ['canvas 2d', 'quadratic curves', 'no shader'],
  about: `The one viz here with **no GPU shader at all**: plain Canvas 2D. Hundreds of
quadratic curves fan out from the centre; their control points sit on a circle whose radius
breathes, and their end points rotate at a different rate. Low-alpha strokes stacked on top
of each other make the glow. It is a useful contrast to the shader vizes: the same ideas
(polar coordinates, a slowly changing phase) in imperative code.`,
  params: {
    speed: {
      type: 'float',
      default: 1,
      min: 0,
      max: 5,
      step: 0.05,
      group: 'Motion',
      doc: 'Rotation rate of the end points.',
    },
    grow: {
      type: 'float',
      default: 0.2,
      min: 0,
      max: 3,
      step: 0.05,
      group: 'Motion',
      doc: 'Pixels per frame the control radius moves.',
    },
    rMin: {
      type: 'float',
      default: 250,
      min: 10,
      max: 800,
      step: 5,
      group: 'Shape',
      doc: 'Smallest control-point radius.',
    },
    rMax: {
      type: 'float',
      default: 700,
      min: 50,
      max: 1500,
      step: 5,
      group: 'Shape',
      doc: 'Largest control-point radius.',
    },
    reach: {
      type: 'float',
      default: 400,
      min: 50,
      max: 1500,
      step: 5,
      group: 'Shape',
      doc: 'Radius of the end points.',
    },
    winding: {
      type: 'float',
      default: 80,
      min: 1,
      max: 300,
      step: 1,
      group: 'Shape',
      doc: 'How many times the end points wind around per full fan.',
    },
    alpha: {
      type: 'float',
      default: 0.2,
      min: 0.02,
      max: 1,
      step: 0.01,
      group: 'Colour',
      doc: 'Stroke alpha. Lower = softer glow.',
    },
    stroke: { type: 'color', default: [1, 1, 1], group: 'Colour', doc: 'Stroke colour.' },
    bg: {
      type: 'color',
      default: [0, 70 / 255, 100 / 255],
      group: 'Colour',
      doc: 'Background fill.',
    },
    curvesNum: {
      type: 'int',
      default: 666,
      min: 10,
      max: 3000,
      step: 1,
      live: false,
      group: 'Quality',
      doc: 'Curve count. Rebuilds the viz.',
    },
    groups: {
      type: 'int',
      default: 32,
      min: 1,
      max: 128,
      step: 1,
      live: false,
      group: 'Quality',
      doc: 'Curves are batched into this many strokes for speed. 1 = one stroke, flat glow; curvesNum = original (slow).',
    },
  },
  presets: {
    Default: {},
    Ink: { stroke: [0.05, 0.05, 0.1], bg: [0.95, 0.93, 0.88], alpha: 0.08, curvesNum: 1200 },
    Spiral: { winding: 3, reach: 900, rMin: 50, rMax: 300, grow: 1 },
  },
  notes: [
    {
      title: 'One quadratic curve per spoke',
      find: 'ctx.quadraticCurveTo(',
      body: 'Start at the centre, control point on the breathing circle (radius r), end point on a second circle with a different angular rate (winding).',
    },
    {
      title: 'Batched strokes',
      find: 'for (let g = 0; g < groups; g++)',
      body: 'Stroking each curve separately was ~10x slower. Interleaving them into `groups` paths keeps the alpha stacking of neighbours.',
    },
    {
      title: 'The phase',
      find: 'x += (Math.PI / 2880) * speed;',
      body: 'A tiny phase increment per frame is the entire animation.',
    },
  ],
  create(canvas, p) {
    const ctx = canvas.getContext('2d');
    const { curvesNum, groups } = p;
    let r = p.rMin;
    let vr = 1;
    let x = 0,
      y = 0;
    const rgb = (c, a = 1) =>
      `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

    return makeHandle({
      render() {
        const w = canvas.width,
          h = canvas.height;
        const { speed, grow, rMin, rMax, reach, winding, alpha, stroke, bg } = p;
        ctx.fillStyle = rgb(bg);
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = rgb(stroke, alpha);
        // ponytail: original strokes each of the 666 curves separately (measured ~10x slower).
        // Curves are batched into `groups` interleaved strokes so angular neighbours still stack alpha;
        // only every groups-th curve shares a stroke. Raise groups if the glow looks too flat.
        for (let g = 0; g < groups; g++) {
          ctx.beginPath();
          for (let i = g; i < curvesNum; i += groups) {
            ctx.moveTo(w / 2, h / 2);
            ctx.quadraticCurveTo(
              w / 2 + r * Math.sin((i * 2 * Math.PI) / curvesNum),
              h / 2 + r * Math.cos((i * 2 * Math.PI) / curvesNum),
              w / 2 + reach * Math.sin((i * winding * Math.PI) / curvesNum + x),
              h / 2 + reach * Math.cos((i * winding * Math.PI) / curvesNum + y)
            );
          }
          ctx.stroke();
        }

        if (r > rMax) vr = -1;
        if (r < rMin) vr = 1;
        r += vr * grow;
        x += (Math.PI / 2880) * speed;
        y += (Math.PI / 2880) * speed;
      },
    });
  },
};
