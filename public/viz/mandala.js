// "Manifold Mandala" by Liam Egan (shubniggurath)
// https://codepen.io/editor/shubniggurath/pen/01a10e01-ac64-7d4c-a9d3-f08a20497a99
// Source lives in ./mandala/ (wtc-gl). This wrapper only adapts it to the viz contract.
import { makeHandle } from '../shader.js';

export default {
  title: 'Manifold Mandala',
  credit: 'Liam Egan — https://codepen.io/editor/shubniggurath/pen/01a10e01-ac64-7d4c-a9d3-f08a20497a99',
  dpr: 0.75, // float MRT + outline/AO post pass is bandwidth-bound; the original ran at dpr 2
  async create(canvas) {
    const { createMandala } = await import('./mandala/scene.js');
    const m = createMandala(canvas);
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
