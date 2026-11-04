// __TITLE__ — <credit / source link>. Canvas 2D, no shader.
import { makeHandle } from '../shader.js';

export default {
  title: '__TITLE__',
  credit: 'you — https://example.com',
  dpr: 1,
  tags: ['canvas 2d', 'template'],
  about: `One paragraph on what this is and the single idea that makes it work.`,
  params: {
    speed: { type: 'float', default: 1, min: 0, max: 4, step: 0.01, group: 'Motion', doc: 'Rotation rate.' },
    arms:  { type: 'int', default: 12, min: 1, max: 64, step: 1, group: 'Shape', doc: 'Number of arms.' },
    bg:    { type: 'color', default: [0.03, 0.03, 0.05], group: 'Colour', doc: 'Background.' },
    ink:   { type: 'color', default: [1, 1, 1], group: 'Colour', doc: 'Stroke colour.' },
  },
  presets: { 'Default': {}, 'Dense': { arms: 48 } },
  notes: [
    { title: 'Read live params each frame', find: 'const { speed, arms', body: 'The studio mutates `p` in place; reading it per frame is all the plumbing you need.' },
  ],
  create(canvas, p) {
    const ctx = canvas.getContext('2d');
    const css = (c, a = 1) => `rgba(${c.map((x) => Math.round(x * 255)).join(',')},${a})`;
    return makeHandle({
      render(t) {
        const { speed, arms, bg, ink } = p;
        const w = canvas.width, h = canvas.height, r = Math.min(w, h) * 0.45;
        ctx.fillStyle = css(bg);
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = css(ink, 0.6);
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < arms; i++) {
          const a = (i / arms) * Math.PI * 2 + t * speed;
          ctx.moveTo(w / 2, h / 2);
          ctx.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
        }
        ctx.stroke();
      },
    });
  },
};
