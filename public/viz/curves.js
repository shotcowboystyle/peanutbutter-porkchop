// "trippy curves" by gmihalios — https://codepen.io/gmihalios/pen/yNENOZ
// Canvas 2D. Original UI controls removed: rotate on, fill off, 666 curves.
import { makeHandle } from '../shader.js';

export default {
  title: 'Trippy Curves',
  credit: 'gmihalios — https://codepen.io/gmihalios/pen/yNENOZ',
  dpr: 1,
  create(canvas) {
    const ctx = canvas.getContext('2d');
    const curvesNum = 666;
    const GROUPS = 32;
    let r = 250;
    let vr = 0.2;
    let x = 0, y = 0;

    return makeHandle({
      render() {
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = 'rgb(0,70,100)';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(255,255,255,.2)';
        // ponytail: original strokes each of the 666 curves separately (measured ~10x slower).
        // Curves are batched into GROUPS interleaved strokes so angular neighbours still stack alpha;
        // only every GROUPS-th curve shares a stroke. Raise GROUPS if the glow looks too flat.
        for (let g = 0; g < GROUPS; g++) {
          ctx.beginPath();
          for (let i = g; i < curvesNum; i += GROUPS) {
            ctx.moveTo(w / 2, h / 2);
            ctx.quadraticCurveTo(
              w / 2 + r * Math.sin(i * 2 * Math.PI / curvesNum),
              h / 2 + r * Math.cos(i * 2 * Math.PI / curvesNum),
              w / 2 + 400 * Math.sin(i * 80 * Math.PI / curvesNum + x),
              h / 2 + 400 * Math.cos(i * 80 * Math.PI / curvesNum + y),
            );
          }
          ctx.stroke();
        }

        if (r > 700 || r < 250) vr *= -1;
        r += vr;
        x += Math.PI / 2880;
        y += Math.PI / 2880;
      },
    });
  },
};
