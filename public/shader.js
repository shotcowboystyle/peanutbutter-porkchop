// Shared runtime: a RAF loop with its own pausable clock, and a fullscreen-quad
// WebGL runner used by every pure-fragment-shader viz.

export function makeHandle({ render, resize, dispose }) {
  let raf = 0, t0 = 0, acc = 0, running = false;
  const now = () => performance.now() / 1000;
  const tick = () => { raf = requestAnimationFrame(tick); render(acc + now() - t0); };
  return {
    start() { if (running) return; running = true; t0 = now(); raf = requestAnimationFrame(tick); },
    stop() { if (!running) return; running = false; acc += now() - t0; cancelAnimationFrame(raf); },
    frame(t) { render(t); },
    resize(w, h) { resize?.(w, h); },
    destroy() { this.stop(); dispose?.(); },
    get time() { return running ? acc + now() - t0 : acc; },
  };
}

export function shaderViz({ title, credit, frag, webgl2 = false, dpr, uniforms }) {
  return {
    title, credit, dpr,
    create(canvas) {
      const gl = canvas.getContext(webgl2 ? 'webgl2' : 'webgl', { antialias: false, alpha: false, depth: false });
      if (!gl) throw new Error(`${title}: ${webgl2 ? 'WebGL2' : 'WebGL'} unavailable`);
      const vert = webgl2
        ? '#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'
        : 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
      const prog = gl.createProgram();
      for (const [type, src] of [[gl.VERTEX_SHADER, vert], [gl.FRAGMENT_SHADER, frag]]) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`${title}: ${gl.getShaderInfoLog(s)}`);
        gl.attachShader(prog, s);
      }
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`${title}: ${gl.getProgramInfoLog(prog)}`);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const a = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
      const locs = new Map();
      const u = (n) => { if (!locs.has(n)) locs.set(n, gl.getUniformLocation(prog, n)); return locs.get(n); };
      return makeHandle({
        render(t) { uniforms(gl, u, t, canvas.width, canvas.height); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); },
        resize(w, h) { gl.viewport(0, 0, w, h); },
        dispose() { gl.getExtension('WEBGL_lose_context')?.loseContext(); },
      });
    },
  };
}
