// Source panel: a textarea with a line gutter. Shader vizes are editable and recompile
// in place; other modules are shown read-only. Notes highlight line ranges.
import { noteRange } from './validate.js';

export function createSourcePanel(root) {
  root.innerHTML = `
    <div class="src-bar">
      <span class="file"></span>
      <span class="status"></span>
      <span class="spacer"></span>
      <button class="apply" title="Recompile (⌘↩)">Apply</button>
      <button class="revert" title="Back to the module's shader">Revert</button>
      <button class="copy" title="Copy source">Copy</button>
    </div>
    <div class="src-body"><div class="gutter"></div><textarea class="editor" spellcheck="false" wrap="off"></textarea></div>
    <div class="src-errors"></div>`;
  const $ = (s) => root.querySelector(s);
  const file = $('.file'),
    status = $('.status'),
    apply = $('.apply'),
    revert = $('.revert'),
    copy = $('.copy');
  const gutter = $('.gutter'),
    editor = $('.editor'),
    errors = $('.src-errors');

  let viz = null,
    handle = null,
    original = '',
    lineEls = [];

  function renderGutter() {
    const n = editor.value.split('\n').length;
    if (lineEls.length === n) return;
    gutter.replaceChildren(
      ...Array.from({ length: n }, (_, i) => {
        const d = document.createElement('div');
        d.textContent = i + 1;
        return d;
      })
    );
    lineEls = [...gutter.children];
  }
  editor.addEventListener('input', () => {
    renderGutter();
    status.textContent = 'modified';
    status.className = 'status';
  });
  editor.addEventListener('scroll', () => {
    gutter.scrollTop = editor.scrollTop;
  });
  editor.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      doApply();
    } else if (e.key === 'Tab' && !editor.readOnly) {
      e.preventDefault();
      const s = editor.selectionStart,
        t = editor.selectionEnd;
      editor.setRangeText('  ', s, t, 'end');
      editor.dispatchEvent(new Event('input'));
    }
  });

  function setErrors(list) {
    lineEls.forEach((el) => el.classList.remove('err'));
    errors.replaceChildren();
    for (const { line, msg } of list) {
      lineEls[line - 1]?.classList.add('err');
      const d = document.createElement('div');
      d.textContent = `${line ? `L${line}: ` : ''}${msg}`;
      d.addEventListener('click', () => scrollTo(line));
      errors.append(d);
    }
  }

  function scrollTo(line) {
    if (!line) return;
    const lh = parseFloat(getComputedStyle(editor).lineHeight) || 18;
    editor.scrollTop = Math.max(0, (line - 4) * lh);
  }

  function doApply() {
    if (!handle?.recompile) return;
    const r = handle.recompile(editor.value);
    setErrors(r.errors);
    status.textContent = r.ok
      ? 'compiled'
      : `${r.errors.length} error${r.errors.length === 1 ? '' : 's'}`;
    status.className = 'status ' + (r.ok ? 'ok' : 'err');
    api.onCompiled?.(r);
    return r;
  }
  apply.addEventListener('click', doApply);
  revert.addEventListener('click', () => {
    editor.value = original;
    renderGutter();
    doApply();
  });
  copy.addEventListener('click', () => navigator.clipboard?.writeText(editor.value));

  const api = {
    onCompiled: null,
    /** Show a viz. `handle` may be null while it is still loading. */
    async load(v, h) {
      viz = v;
      handle = h;
      const shader = !!v.shader;
      editor.readOnly = !shader;
      apply.disabled = revert.disabled = !shader;
      setErrors([]);
      if (shader) {
        original = v.frag;
        editor.value = h?.source ?? v.frag;
        file.textContent = `viz/${v.file} · fragment shader`;
        status.textContent = 'editable · ⌘↩ to recompile';
        status.className = 'status';
      } else {
        file.textContent = `viz/${v.file} · read-only`;
        status.textContent = '';
        status.className = 'status';
        editor.value = 'loading…';
        try {
          original = await (await fetch(`../viz/${v.file}`)).text();
        } catch (e) {
          original = `// could not fetch viz/${v.file}: ${e.message}`;
        }
        if (viz !== v) return;
        editor.value = original;
      }
      editor.scrollTop = 0;
      lineEls = [];
      renderGutter();
    },
    get text() {
      return editor.value;
    },
    /** Highlight a note's range and scroll to it. */
    highlight(note) {
      lineEls.forEach((el) => el.classList.remove('hi'));
      const r = note && noteRange(note, editor.value);
      if (!r) return false;
      for (let i = r[0]; i <= r[1]; i++) lineEls[i - 1]?.classList.add('hi');
      scrollTo(r[0]);
      return true;
    },
    apply: doApply,
    focus() {
      editor.focus();
    },
  };
  return api;
}
