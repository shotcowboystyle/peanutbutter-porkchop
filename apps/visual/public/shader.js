// Shared runtime: a RAF loop with its own pausable clock, and a fullscreen-quad
// WebGL runner used by every pure-fragment-shader viz.

/**
 * One tunable of a viz. The studio builds a control from it; shaderViz uploads
 * it as a uniform of the same name (or a #define when `live` is false).
 * @typedef {Object} ParamDef
 * @property {'float'|'int'|'bool'|'color'|'select'} type  color = [r,g,b] in 0..1
 * @property {number|boolean|string|number[]} default
 * @property {number} [min]
 * @property {number} [max]
 * @property {number} [step]
 * @property {string[]} [options]  select only
 * @property {boolean} [live=true]  false: a compile-time constant; changing it recreates the viz
 * @property {string} [label]
 * @property {string} [group]
 * @property {string} [doc]  one or two sentences for the control's tooltip / learn panel
 */

/**
 * @typedef {Object} VizHandle
 * @property {() => void} start
 * @property {() => void} stop
 * @property {(t: number) => void} frame   render one frame at time t (seconds)
 * @property {(dt: number) => void} step   advance the clock by dt and render
 * @property {(w: number, h: number) => void} resize   canvas pixel size
 * @property {() => void} destroy
 * @property {number} time   current clock, settable (seek)
 * @property {number} rate   playback speed multiplier
 */

/**
 * @typedef {Object} Viz
 * @property {string} title
 * @property {string} credit
 * @property {number} [dpr]  device pixel ratio cap
 * @property {Record<string, ParamDef>} [params]
 * @property {Record<string, Record<string, any>>} [presets]  partial param overrides by name
 * @property {string} [about]  markdown
 * @property {string[]} [tags]
 * @property {{ title: string, lines?: [number, number], body: string }[]} [notes]  source walkthrough
 * @property {(canvas: HTMLCanvasElement, params: Record<string, any>) => VizHandle | Promise<VizHandle>} create
 */

/** Fresh params object holding every default of a viz. */
export function defaults(viz) {
  const out = {};
  for (const [k, d] of Object.entries(viz.params ?? {}))
    out[k] = Array.isArray(d.default) ? [...d.default] : d.default;
  return out;
}

export function makeHandle({ render, resize, dispose }) {
  let raf = 0,
    t0 = 0,
    acc = 0,
    running = false,
    rate = 1;
  const now = () => performance.now() / 1000;
  const elapsed = () => acc + (running ? (now() - t0) * rate : 0);
  const tick = () => {
    raf = requestAnimationFrame(tick);
    render(elapsed());
  };
  const h = {
    start() {
      if (running) return;
      running = true;
      t0 = now();
      raf = requestAnimationFrame(tick);
    },
    stop() {
      if (!running) return;
      acc = elapsed();
      running = false;
      cancelAnimationFrame(raf);
    },
    frame(t) {
      render(t);
    },
    step(dt) {
      h.time += dt;
      render(h.time);
    },
    resize(w, h) {
      resize?.(w, h);
    },
    destroy() {
      h.stop();
      dispose?.();
    },
    get time() {
      return elapsed();
    },
    set time(t) {
      acc = t;
      t0 = now();
    },
    get rate() {
      return rate;
    },
    set rate(r) {
      acc = elapsed();
      t0 = now();
      rate = r;
    },
  };
  return h;
}

// GLSL literal for a #define'd param
const literal = (d, v) => {
  if (d.type === 'float') return Number.isInteger(v) ? `${v}.0` : String(v);
  if (d.type === 'bool') return v ? 'true' : 'false';
  if (d.type === 'select') return String(d.options.indexOf(v));
  return String(v);
};

// `#version` must stay the first line, so compile-time params go right after it.
function withDefines(src, params, p) {
  const lines = Object.entries(params)
    .filter(([, d]) => d.live === false)
    .map(([k, d]) => `#define ${k} ${literal(d, p[k])}`);
  if (!lines.length) return { src, offset: 0, at: 0 };
  const v = src.startsWith('#version') ? src.indexOf('\n') + 1 : 0;
  return {
    src: src.slice(0, v) + lines.join('\n') + '\n' + src.slice(v),
    offset: lines.length,
    at: v ? 1 : 0,
  };
}

// "ERROR: 0:12: 'x' : undeclared identifier" -> { line: 12, msg }
function parseGlslLog(log, offset = 0, at = 0) {
  const out = [];
  for (const m of log.matchAll(/ERROR:\s*\d+:(\d+):\s*(.*)/g)) {
    const raw = Number(m[1]);
    out.push({ line: raw > at + offset ? raw - offset : raw, msg: m[2].trim() });
  }
  if (!out.length && log.trim()) out.push({ line: 0, msg: log.trim() });
  return out;
}

const GL_TYPES = {
  0x1406: 'float',
  0x8b50: 'vec2',
  0x8b51: 'vec3',
  0x8b52: 'vec4',
  0x1404: 'int',
  0x8b53: 'ivec2',
  0x8b54: 'ivec3',
  0x8b56: 'bool',
  0x8b5e: 'sampler2D',
  0x8b5b: 'mat3',
  0x8b5c: 'mat4',
};

const UPLOAD = {
  float: (gl, l, v) => gl.uniform1f(l, v),
  int: (gl, l, v) => gl.uniform1i(l, v),
  bool: (gl, l, v) => gl.uniform1i(l, v ? 1 : 0),
  color: (gl, l, v) => gl.uniform3f(l, v[0], v[1], v[2]),
  select: (gl, l, v, d) => gl.uniform1i(l, d.options.indexOf(v)),
};

/**
 * Fullscreen-quad fragment shader viz. Every `live` param is uploaded each frame
 * as a uniform of the same name; `live: false` params become #defines.
 * `uniforms(gl, u, t, w, h, p)` uploads whatever else the shader needs (time, resolution).
 */
export function shaderViz({
  title,
  credit,
  frag,
  webgl2 = false,
  dpr,
  uniforms,
  params = {},
  presets,
  about,
  tags,
  notes,
}) {
  // params the JS `uniforms` callback consumes itself (p.speed etc.) are not GLSL uniforms
  const jsUsed = new Set(
    [...(uniforms?.toString() ?? '').matchAll(/\bp\.(\w+)/g)].map((m) => m[1])
  );
  const live = Object.entries(params).filter(([k, d]) => d.live !== false && !jsUsed.has(k));
  return {
    title,
    credit,
    dpr,
    params,
    presets,
    about,
    tags,
    notes,
    frag,
    webgl2,
    shader: true,
    jsUsed,
    create(canvas, p = defaults({ params })) {
      const gl = canvas.getContext(webgl2 ? 'webgl2' : 'webgl', {
        antialias: false,
        alpha: false,
        depth: false,
      });
      if (!gl) throw new Error(`${title}: ${webgl2 ? 'WebGL2' : 'WebGL'} unavailable`);
      const vert = webgl2
        ? '#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'
        : 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW
      );

      let prog = null,
        source = frag;
      const locs = new Map();
      const u = (n) => {
        if (!locs.has(n)) locs.set(n, gl.getUniformLocation(prog, n));
        return locs.get(n);
      };

      function build(src) {
        const np = gl.createProgram();
        for (const [type, s] of [
          [gl.VERTEX_SHADER, vert],
          [gl.FRAGMENT_SHADER, src],
        ]) {
          const sh = gl.createShader(type);
          gl.shaderSource(sh, s);
          gl.compileShader(sh);
          if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(sh);
            gl.deleteShader(sh);
            gl.deleteProgram(np);
            throw new Error(log);
          }
          gl.attachShader(np, sh);
          gl.deleteShader(sh);
        }
        gl.linkProgram(np);
        if (!gl.getProgramParameter(np, gl.LINK_STATUS)) {
          const log = gl.getProgramInfoLog(np);
          gl.deleteProgram(np);
          throw new Error(log);
        }
        return np;
      }

      // Swap in a new fragment source. On failure the previous program keeps running.
      function recompile(src) {
        const d = withDefines(src, params, p);
        try {
          const np = build(d.src);
          if (prog) gl.deleteProgram(prog);
          prog = np;
          source = src;
          locs.clear();
          gl.useProgram(prog);
          const a = gl.getAttribLocation(prog, 'p');
          gl.enableVertexAttribArray(a);
          gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
          return { ok: true, errors: [], log: '' };
        } catch (e) {
          return { ok: false, errors: parseGlslLog(e.message, d.offset, d.at), log: e.message };
        }
      }

      const first = recompile(frag);
      if (!first.ok) throw new Error(`${title}: ${first.log}`);

      const h = makeHandle({
        render(t) {
          for (const [k, d] of live) {
            const l = u(k);
            if (l) UPLOAD[d.type](gl, l, p[k], d);
          }
          uniforms?.(gl, u, t, canvas.width, canvas.height, p);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        },
        resize(w, h) {
          gl.viewport(0, 0, w, h);
        },
        dispose() {
          gl.getExtension('WEBGL_lose_context')?.loseContext();
        },
      });
      h.recompile = recompile;
      h.gl = gl;
      Object.defineProperty(h, 'source', { get: () => source });
      Object.defineProperty(h, 'compiledSource', { get: () => withDefines(source, params, p).src });
      // what the GPU actually sees: every active uniform with its current value
      h.activeUniforms = () => {
        const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS),
          out = [];
        for (let i = 0; i < n; i++) {
          const info = gl.getActiveUniform(prog, i);
          const v = gl.getUniform(prog, gl.getUniformLocation(prog, info.name));
          out.push({
            name: info.name,
            type: GL_TYPES[info.type] ?? String(info.type),
            value: v?.length ? [...v] : v,
          });
        }
        return out;
      };
      h.unusedParams = () => live.filter(([k]) => !u(k)).map(([k]) => k);
      return h;
    },
  };
}
