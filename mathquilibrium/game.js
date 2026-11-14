'use strict';
const sym = (v) => (v === '-' ? '−' : String(v));
const KEYS = { '+': '+', '-': '-', '*': '×', x: '×', X: '×', '/': '÷', ':': '÷', '=': '=', '^': '^', '%': '%', '.': '.', ',': '.', '<': '<', '>': '>' };
const NAMES = Object.fromEntries(Object.entries({
  '+': 'plus', '-': 'minus', '×': 'times', '÷': 'divided by', '^': 'power', '%': 'remainder', '.': 'decimal point',
  '=': 'equals', '<': 'less than', '>': 'greater than',
}).map(([k, v]) => [k, T(v)]));
const FIRST_TIP = T('Tap a blank tile, then pick an operator. Every row and column must be <b>true</b>. Where lines cross, <b>one symbol</b> has to work both ways.');
const OP_TIPS = { // shown on the level where an operator first appears: [example line, text]
  '×': [[2, '+', 3, '×', 4, '=', 14], T('Times. It happens before + and −.')],
  '÷': [[8, '÷', 2, '=', 4], T('Divided by. Division has to come out exact.')],
  '^': [[2, '^', 3, '=', 8], T('Power. Worked out before × and +.')],
  '.': [[7, '÷', 2, '=', 3, '.', 5], T('Decimal point: 3 . 5 is 3.5.')],
  '%': [[7, '%', 3, '=', 1], T('Remainder: what\'s left over after dividing.')],
  '<': [[3, '+', 4, '<', 9], T('Less than and greater than: some lines are <b>inequalities</b>.')],
};
const ICON_ERASE = '<svg viewBox="0 0 24 24"><path d="M9 5h11v14H9l-6-7 6-7zM12 9l5 6M17 9l-5 6"/></svg>';

// ---------- mini boards (logo & help) ----------
function mini(el, rows, blanks = '') {
  el.style.setProperty('--cols', rows[0].length);
  el.style.setProperty('--rows', rows.length);
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === '.') return;
    const d = document.createElement('div');
    const isOp = '+-×÷='.includes(ch);
    d.className = 'cell ' + (isOp ? (blanks.includes(r + ',' + c) ? 'op slot' : 'op filled') : 'num');
    if (!blanks.includes(r + ',' + c)) d.textContent = sym(ch);
    d.style.gridArea = `${r + 1} / ${c + 1}`;
    d.style.setProperty('--d', (r + c) * 50 + 'ms');
    el.append(d);
  }));
}

const syms = (o) => (o === '<' ? '<>' : o); // one intro covers both inequalities

// Intro modal for unseen intro ids: 'first' (how to play) and/or operators, each with its key and an example line.
function intro(ids) {
  const ops = ids.filter((k) => k !== 'first').map(syms);
  const h = (v) => sym(v).replace('<', '&lt;').replace('>', '&gt;'), body = $('#intro-body');
  body.replaceChildren();
  $('#intro-title').textContent = T(ids[0] === 'first' ? 'Fill in the math' : ops.length > 1 ? 'New operators' : 'New operator');
  if (ids[0] === 'first') {
    const sec = document.createElement('section'), b = document.createElement('div');
    b.className = 'board mini';
    mini(b, ['.2...', '3+5=8', '.4...', '.=...', '.6...']);
    sec.append(b);
    sec.insertAdjacentHTML('beforeend', `<p>${FIRST_TIP}</p>`);
    body.append(sec);
  }
  for (const o of ops) {
    const [line, text] = OP_TIPS[o[0]], sec = document.createElement('section');
    const keys = [...o].map((x) => `<span class="key${'=<>'.includes(x) ? ' eq' : ''}">${h(x)}</span>`).join('');
    const cells = line.map((v, c) => `<div class="cell ${typeof v === 'number' ? 'num' : o.includes(v) ? 'op filled' : 'op given'}" style="grid-area:1/${c + 1};--d:${c * 50}ms">${h(v)}</div>`).join('');
    sec.innerHTML = `<div class="intro-keys" aria-hidden="true">${keys}</div><div class="board mini" style="--cols:${line.length};--rows:1" role="img" aria-label="${line.map((v) => NAMES[v] || v).join(' ')}">${cells}</div><p>${text}</p>`;
    body.append(sec);
  }
  // first visit: How to play opens at boot too; show this after it instead of on top (skip if the level changed meanwhile)
  const g = G, show = () => {
    if (G !== g) return;
    $('#dlg-intro').showModal();
    store.intros = [...new Set([...(store.intros || []), ...ids])];
    persist();
  };
  if (store.seenHelp) show();
  else $('#dlg-help').addEventListener('close', show, { once: true });
}

// ---------- game ----------
const editable = (c) => c.op && !c.given && !G.hinted.has(c.key);
const valOf = (c) => (c.op && !c.given ? G.fills.get(c.key) : c.val);

// Shell hook: build pack level / daily G.key; returns true if the save was restored.
function startLevel(G, save) {
  const { pack, n, date, key } = G;
  const diff = date ? PACKS[pack].daily : packDifficulty(pack, n);
  const p = generate(hash(key), levelConfig(diff));
  const s = saveFits(p, save) ? save : {};
  Object.assign(G, { p, fills: new Map(s.fills), hinted: new Set(s.hinted), sel: null, states: [], history: [] });

  $('#g-sub').textContent = [...p.ops, ...p.rels].map(sym).join(' ');
  $('#tip').textContent = date ? T(`Today's ${TIERS[pack].toLowerCase()} puzzle. A new one tomorrow.`) : '';
  // intros (how to play, then each operator) show once ever, on the first level that uses them
  const used = new Set(p.cells.filter((c) => c.op).map((c) => c.val)), seen = store.intros || [];
  const todo = ['first', ...Object.keys(OP_TIPS).filter((o) => [...syms(o)].some((x) => used.has(x)))].filter((k) => !seen.includes(k));
  if (todo.length) intro(todo);
  buildBoard();
  buildPalette();
  balancePalette();
  G.sel = nextEmpty(null);
  refresh(false);
  return s === save;
}

function buildBoard() {
  const b = $('#board');
  b.replaceChildren();
  b.className = 'board';
  b.style.setProperty('--cols', G.p.cols);
  b.style.setProperty('--rows', G.p.rows);
  setZoom(1);
  for (const cell of G.p.cells) {
    const edit = cell.op && !cell.given;
    const el = document.createElement(edit ? 'button' : 'div');
    el.className = `cell ${cell.op ? 'op' : 'num'}${cell.given ? ' given' : ''}${String(cell.val).length > 2 ? ' long' : ''}`;
    el.style.gridArea = `${cell.r + 1} / ${cell.c + 1}`;
    el.style.setProperty('--d', (cell.r + cell.c) * 28 + 'ms');
    el.setAttribute('aria-hidden', 'true'); // the board reads out lines instead of loose tiles
    if (edit) el.tabIndex = -1;
    if (!edit) el.textContent = sym(cell.val);
    cell.el = el;
    b.append(el);
  }
  G.states = G.p.eqs.map(() => 'open');
}

// Wrap keys into evenly filled rows (7 keys, room for 6 -> 4 + 3, not 6 + 1)
// by capping the palette width at the balanced row length.
function balancePalette() {
  const pal = $('#palette'), n = pal.children.length;
  if (!n || $('#game').hidden) return;
  pal.style.maxWidth = '';
  const cs = getComputedStyle(pal), host = getComputedStyle(pal.parentElement);
  // computed width is in CSS px like clientWidth; getBoundingClientRect is post-zoom and would undercount
  const key = parseFloat(getComputedStyle(pal.children[0]).width), gap = parseFloat(cs.columnGap) || 0;
  const avail = Math.min(
    pal.parentElement.clientWidth - parseFloat(host.paddingLeft) - parseFloat(host.paddingRight),
    parseFloat(cs.maxWidth) || Infinity,
  );
  const fit = Math.max(1, Math.floor((avail + gap + 1) / (key + gap))); // +1: subpixel slack, else 5.999 -> 5
  const perRow = Math.ceil(n / Math.ceil(n / fit));
  pal.style.maxWidth = perRow * key + (perRow - 1) * gap + 1 + 'px'; // +1 absorbs subpixel rounding
}
addEventListener('resize', balancePalette);

function buildPalette() {
  const pal = $('#palette');
  pal.replaceChildren();
  for (const op of [...G.p.ops, ...G.p.rels]) {
    const k = document.createElement('button');
    k.className = 'key' + (G.p.rels.includes(op) ? ' eq' : '');
    k.textContent = sym(op);
    k.dataset.op = op;
    k.setAttribute('aria-label', NAMES[op]);
    k.onclick = () => place(op);
    pal.append(k);
  }
  const e = document.createElement('button');
  e.className = 'key erase';
  e.innerHTML = ICON_ERASE;
  e.setAttribute('aria-label', T('Clear tile'));
  e.onclick = () => place(null);
  pal.append(e);
}

function refresh(sound) {
  const { p } = G, prev = G.states;
  const states = p.eqs.map((eq) => {
    const v = eq.map((i) => valOf(p.cells[i]));
    return v.includes(undefined) ? 'open' : checkEquation(v) ? 'ok' : 'bad';
  });
  G.states = states;
  if (sound) {
    const fresh = (s) => states.some((x, i) => x === s && prev[i] !== s);
    if (fresh('bad')) sfx.bad();
    else if (fresh('ok')) sfx.good(states.filter((s) => s === 'ok').length - 1);
  }
  // screen readers: lines that just got a verdict, then the selected blank's lines
  const verdicts = sound ? states.map((s, e) => (s !== 'open' && s !== prev[e] && !G.sel?.eqs.includes(e) ? `${lineText(e)}: ${VERDICT[s]}.` : '')).filter(Boolean) : []; // the selected tile's lines are read below anyway
  const blanks = p.cells.filter((c) => editable(c) && !G.fills.has(c.key)).length;
  $('#board').setAttribute('aria-label', T(blanks === 1 ? 'Puzzle board, 1 blank left' : 'Puzzle board, {n} blanks left', { n: blanks }));
  if (!G.done) $('#sr').textContent = [...verdicts, G.sel ? describe(G.sel) : ''].join(' ');
  const selEqs = G.sel ? G.sel.eqs : [];
  for (const cell of p.cells) {
    const st = cell.eqs.map((e) => states[e]), el = cell.el;
    el.classList.toggle('ok', st.every((s) => s === 'ok'));
    el.classList.toggle('bad', st.includes('bad'));
    el.classList.toggle('hl', !G.done && cell.eqs.some((e) => selEqs.includes(e)));
    el.classList.toggle('sel', !G.done && cell === G.sel);
    if (cell.op && !cell.given) {
      const v = G.fills.get(cell.key);
      el.textContent = v ? sym(v) : '';
      el.classList.toggle('filled', !!v);
      el.classList.toggle('hinted', G.hinted.has(cell.key));
    }
    if (sound && cell.eqs.some((e) => states[e] === 'bad' && prev[e] !== 'bad')) flash(el, 'shake');
  }
  if (!G.done && states.every((s) => s === 'ok')) win();
  $('#btn-undo').disabled = !G.history.length || G.done;
  follow();
}

// ---------- zoom ----------
// Pinch the board up to ~60px tiles (never below the fitted size); drag to pan once it overflows.
const zoomer = $('.zoom');
let zoom = 1, pinch = null;
function setZoom(z) { zoom = z; $('#board').style.setProperty('--zoom', z); edges(); }
// Fade the board's edges that have more to scroll to (style.css masks with these).
function edges() {
  const z = zoomer, fade = (more) => (more ? 0 : 1);
  z.style.setProperty('--l', fade(z.scrollLeft > 1));
  z.style.setProperty('--r', fade(z.scrollLeft < z.scrollWidth - z.clientWidth - 1));
  z.style.setProperty('--t', fade(z.scrollTop > 1));
  z.style.setProperty('--b', fade(z.scrollTop < z.scrollHeight - z.clientHeight - 1));
}
zoomer.addEventListener('scroll', edges, { passive: true });
// pageScale(): touches and getBoundingClientRect are in zoomed px (text & tile size), scrolling in the page's own
const touchMid = (t) => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];
const touchDist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
zoomer.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 2) return;
  const [mx, my] = touchMid(e.touches), r = zoomer.getBoundingClientRect(), tile = $('#board').firstChild.offsetWidth / zoom;
  // the board point under the fingers, so it stays under them while zooming
  pinch = { d: touchDist(e.touches), z: zoom, max: Math.max(1, 60 / tile), x: zoomer.scrollLeft + (mx - r.left) / pageScale(), y: zoomer.scrollTop + (my - r.top) / pageScale() };
}, { passive: true });
zoomer.addEventListener('touchmove', (e) => {
  if (e.touches.length < 2) return;
  e.preventDefault(); // any two-finger move here is ours, never the page's
  if (!pinch) return;
  const z = Math.min(pinch.max, Math.max(1, pinch.z * touchDist(e.touches) / pinch.d)), k = z / pinch.z;
  const [mx, my] = touchMid(e.touches), r = zoomer.getBoundingClientRect();
  setZoom(z);
  zoomer.scrollLeft = pinch.x * k - (mx - r.left) / pageScale(); // ponytail: ignores padding/gaps, close enough under a finger
  zoomer.scrollTop = pinch.y * k - (my - r.top) / pageScale();
}, { passive: false });
zoomer.addEventListener('touchend', (e) => { if (e.touches.length < 2) pinch = null; });
// iOS Safari zooms the page off its own gesture events (touch-action alone doesn't stop it); touch events still drive ours.
for (const t of ['gesturestart', 'gesturechange']) zoomer.addEventListener(t, (e) => e.preventDefault(), { passive: false });

// Glide the selected tile into view (with a tile of margin) when it's off the zoomed board's visible part.
function follow() {
  const el = G.sel?.el;
  if (!el || pinch) return;
  const a = zoomer.getBoundingClientRect(), b = el.getBoundingClientRect(), m = Math.min(b.width, a.width / 4);
  const off = (lo, hi, min, max) => (lo < min + m ? lo - min - m : hi > max - m ? Math.min(hi - max + m, lo - min - m) : 0);
  const left = off(b.left, b.right, a.left, a.right), top = off(b.top, b.bottom, a.top, a.bottom);
  if (left || top) zoomer.scrollBy({ left: left / pageScale(), top: top / pageScale(), behavior: document.documentElement.hasAttribute('data-calm') ? 'auto' : 'smooth' });
}

// ---------- spoken board ----------
// A line read as words: "4 plus blank equals 7". The selected blank is "this blank".
const isAcross = (e) => G.p.cells[G.p.eqs[e][0]].r === G.p.cells[G.p.eqs[e][1]].r;
function lineText(e, here = null) {
  const words = G.p.eqs[e].map((i) => {
    const c = G.p.cells[i], v = valOf(c);
    if (c === here) return v ? T('this tile, {op}', { op: NAMES[v] }) : T('this blank');
    return v === undefined ? T('blank') : c.op ? NAMES[v] : sym(v);
  });
  return `${T(isAcross(e) ? 'Across' : 'Down')}: ${words.join(' ')}`;
}
const VERDICT = { open: T('not finished'), ok: T('true'), bad: T('false') };
const describe = (cell) => cell.eqs.map((e) => `${lineText(e, cell)}, ${VERDICT[G.states[e]]}.`).join(' ');
// Focusing the board reads the selected blank again (a live region only speaks when its text changes).
$('#board').addEventListener('focus', () => { if (playing()) { $('#sr').textContent = ''; requestAnimationFrame(() => refresh(false)); } });

function nextEmpty(from) {
  const cells = G.p.cells.filter((c) => editable(c));
  const start = from ? cells.findIndex((c) => c.i > from.i) : 0;
  for (let k = 0; k < cells.length; k++) {
    const c = cells[(Math.max(start, 0) + k) % cells.length];
    if (!G.fills.has(c.key)) return c;
  }
  return null;
}

function place(op) {
  if (!playing()) return;
  if (!G.sel || !editable(G.sel)) G.sel = nextEmpty(null);
  const cell = G.sel;
  if (!cell) return;
  if (op) {
    if (G.fills.get(cell.key) !== op) remember();
    G.fills.set(cell.key, op);
    sfx.place();
    flash(cell.el, 'pop');
    const next = nextInEquation(G.p, cell, G.eq, (c) => editable(c) && !G.fills.has(c.key));
    G.eq = next ? next.eq : null;
    G.sel = next ? next.cell : nextEmpty(cell) || cell;
  } else {
    if (!G.fills.has(cell.key)) return;
    remember();
    G.fills.delete(cell.key);
    sfx.erase();
  }
  refresh(true);
  saveGame();
}

// ---------- undo ----------
// A snapshot of the fills and the selected tile, taken before each change.
// ponytail: history lives in memory only, a reload starts it fresh.
const remember = () => G.history.push([[...G.fills], G.sel]);
function undo() {
  if (!playing() || !G.history.length) return;
  const [fills, sel] = G.history.pop();
  G.fills = new Map(fills);
  G.sel = sel;
  G.eq = null;
  sfx.erase();
  refresh(false);
  saveGame();
}

function move(dr, dc) {
  const s = G.sel;
  if (!s || !playing()) return;
  let best = null, bs = Infinity;
  for (const c of G.p.cells) {
    if (!editable(c) || c === s) continue;
    const along = (c.r - s.r) * dr + (c.c - s.c) * dc;
    if (along <= 0) continue;
    const score = along + 2 * (Math.abs(c.r - s.r) * Math.abs(dc) + Math.abs(c.c - s.c) * Math.abs(dr));
    if (score < bs) { bs = score; best = c; }
  }
  if (best) { G.sel = best; G.eq = null; sfx.tap(); refresh(false); }
}

function hint() {
  if (!playing()) return;
  const wrong = G.p.cells.filter((c) => editable(c) && G.fills.get(c.key) !== c.val);
  const c = wrong.includes(G.sel) ? G.sel : wrong[Math.floor(Math.random() * wrong.length)];
  if (!c) return;
  G.fills.set(c.key, c.val);
  G.hinted.add(c.key);
  G.history = []; // a hint is final: undoing past it could bring back the wrong tile it replaced
  sfx.hint();
  track('hint');
  flash(c.el, 'pop');
  G.sel = nextEmpty(c);
  G.eq = null;
  refresh(true);
  saveGame();
}

function reset() {
  if (!playing() || G.fills.size === G.hinted.size) return;
  if (!confirm(T('Restart this level? Your tiles are cleared; the clock keeps running.'))) return;
  remember();
  for (const k of [...G.fills.keys()]) if (!G.hinted.has(k)) G.fills.delete(k);
  sfx.erase();
  G.sel = nextEmpty(null);
  G.eq = null;
  refresh(false);
  saveGame();
}

// ---------- wiring ----------
// Tiles get small on big boards, so a tap anywhere near a blank selects the nearest one.
$('.board-wrap').addEventListener('click', (e) => {
  if (!playing()) return;
  const direct = G.p.cells.find((c) => c.el === e.target.closest('.cell'));
  let best = direct && editable(direct) ? direct : null, bd = best ? 0 : Infinity;
  if (!best && e.detail) {
    for (const c of G.p.cells) {
      if (!editable(c)) continue;
      const r = c.el.getBoundingClientRect();
      const d = Math.hypot(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2) / Math.max(r.width, 1);
      if (d < bd) { bd = d; best = c; }
    }
  }
  if (best && bd < 1.6 && best !== G.sel) { G.sel = best; G.eq = null; sfx.tap(); refresh(false); }
});
$('#btn-undo').onclick = undo;
$('#btn-hint').onclick = hint;
$('#btn-reset').onclick = reset;

function onKey(e) {
  const op = KEYS[e.key];
  const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (op && [...G.p.ops, ...G.p.rels].includes(op)) {
    place(op);
    const k = $(`.key[data-op="${op}"]`);
    if (k) { k.classList.add('press'); setTimeout(() => k.classList.remove('press'), 100); }
  } else if (e.key === 'Backspace' || e.key === 'Delete') place(null);
  else if (arrows[e.key]) move(...arrows[e.key]);
  else if (e.key === 'z' || e.key === 'Z' || e.key === 'u' || e.key === 'U') undo();
  else return false;
  return true;
}

// ---------- print ----------
// The grid with its blanks empty, the operators in play listed above it.
printable(() => {
  const { p } = G, all = [...p.ops, ...p.rels];
  const cell = (c, solved) => `<div class="${c.op ? (c.given ? 'p-given' : 'p-blank') : 'p-num'}${String(c.val).length > 2 ? ' long' : ''}" style="grid-area: ${c.r + 1} / ${c.c + 1}">${c.op && !c.given && !solved ? '' : esc(sym(c.val))}</div>`;
  const grid = (solved) => `<div class="p-grid" style="--cols: ${p.cols}; --rows: ${p.rows}">${p.cells.map((c) => cell(c, solved)).join('')}</div>`;
  return {
    rules: [
      T('Write an operator in every empty box so <b>each row and column is a true equation</b>. Equations read <b>left to right</b> or <b>top to bottom</b> only.'),
      T('Boxes where lines cross are <b>shared</b>: one symbol has to work both ways.'),
      T('Usual math order: <b>× ÷</b> before <b>+ −</b>. Division must come out exact.'),
      ...['^', '.', '%', '<'].filter((o) => all.includes(o)).map((o) => `${[...syms(o)].map((x) => `<b dir="ltr">${esc(x)}</b>`).join(' ')} ${OP_TIPS[o][1]}`),
    ],
    body: `<p class="p-ops">${T('Use:')} ${all.map((o) => `<b>${esc(sym(o))}</b>`).join('')}</p>` +
      grid(false),
    answer: grid(true),
  };
}, (k, date) => { G = { p: generate(hash('D' + k + date), levelConfig(PACKS[k].daily)) }; });

mini($('#logo'), ['.5.8.', '4+3=7', '.1.1.', '.=.+.', '.6.7.']);
mini($('#help-grid'), ['.2...', '3+5=8', '.4...', '.=...', '.6...'], ['1,1', '1,3']);
// ponytail: storage key keeps the old name so existing saves survive the rename.
boot({ name: T('Mathquilibrium'), storeKey: 'crossum2', glyphs: ['+', '−', '×', '÷', '='], start: startLevel, save: (G) => ({ fills: [...G.fills], hinted: [...G.hinted] }), key: onKey,
  reveal: () => { for (const c of G.p.cells) if (c.op && !c.given) G.fills.set(c.key, c.val); refresh(false); } });
