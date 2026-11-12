'use strict';
const sym = (v) => (v === '-' ? '−' : String(v));
const KEYS = { '+': '+', '-': '-', '*': '×', x: '×', X: '×', '/': '÷', ':': '÷', '=': '=', '^': '^', '%': '%', '.': '.', ',': '.', '<': '<', '>': '>' };
const NAMES = {
  '+': 'plus', '-': 'minus', '×': 'times', '÷': 'divided by', '^': 'power', '%': 'remainder', '.': 'decimal point',
  '=': 'equals', '<': 'less than', '>': 'greater than',
};
const FIRST_TIP = 'Tap a blank tile, then pick an operator. Every row and column must be <b>true</b>. Where lines cross, <b>one symbol</b> has to work both ways.';
const OP_TIPS = { // shown on the level where an operator first appears
  '×': 'New: <b>×</b> — it happens before + and −.',
  '÷': 'New: <b>÷</b> — division has to come out exact.',
  '^': 'New: <b>^</b> power — 2 ^ 3 = 8, worked out before × and +.',
  '.': 'New: <b>.</b> decimal point — 3 . 5 is 3.5, so 7 ÷ 2 = 3 . 5',
  '%': 'New: <b>%</b> remainder — 7 % 3 = 1.',
  '<': 'New: <b>&lt;</b> and <b>&gt;</b> — some lines are inequalities, like 3 + 4 &lt; 9.',
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

// ---------- game ----------
const editable = (c) => c.op && !c.given && !G.hinted.has(c.key);
const valOf = (c) => (c.op && !c.given ? G.fills.get(c.key) : c.val);

// Shell hook: build pack level / daily G.key; returns true if the save was restored.
function startLevel(G, save) {
  const { pack, n, date, key } = G;
  const diff = date ? PACKS[pack].daily : packDifficulty(pack, n);
  const p = generate(hash(key), levelConfig(diff));
  const s = saveFits(p, save) ? save : {};
  Object.assign(G, { p, fills: new Map(s.fills), hinted: new Set(s.hinted), sel: null, states: [] });

  $('#g-sub').textContent = [...p.ops, ...p.rels].map(sym).join(' ');
  if (date) $('#tip').textContent = `Today's ${TIERS[pack].toLowerCase()} puzzle. A new one tomorrow.`;
  else if (n === 1) $('#tip').innerHTML = FIRST_TIP;
  else {
    const used = new Set(p.cells.filter((c) => c.op).map((c) => c.val));
    const syms = (o) => (o === '<' ? '<>' : o); // one tip covers both inequalities
    const fresh = Object.keys(OP_TIPS).filter((o) => [...syms(o)].some((x) => used.has(x)) && firstUse(pack, syms(o), n) === n);
    $('#tip').innerHTML = fresh.map((o) => OP_TIPS[o]).join('<br>');
  }

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
  const key = pal.children[0].getBoundingClientRect().width, gap = parseFloat(cs.columnGap) || 0;
  const avail = Math.min(
    pal.parentElement.clientWidth - parseFloat(host.paddingLeft) - parseFloat(host.paddingRight),
    parseFloat(cs.maxWidth) || Infinity,
  );
  const fit = Math.max(1, Math.floor((avail + gap) / (key + gap)));
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
  e.setAttribute('aria-label', 'Clear tile');
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
  const verdicts = sound ? states.map((s, e) => (s !== 'open' && s !== prev[e] && !G.sel?.eqs.includes(e) ? `${lineText(e)}: ${s === 'ok' ? 'true' : 'false'}.` : '')).filter(Boolean) : []; // the selected tile's lines are read below anyway
  const blanks = p.cells.filter((c) => editable(c) && !G.fills.has(c.key)).length;
  $('#board').setAttribute('aria-label', `Puzzle board, ${blanks} blank${blanks === 1 ? '' : 's'} left`);
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
  follow();
}

// ---------- zoom ----------
// Pinch the board up to ~60px tiles (never below the fitted size); drag to pan once it overflows.
const zoomer = $('.zoom');
let zoom = 1, pinch = null;
function setZoom(z) { zoom = z; $('#board').style.setProperty('--zoom', z); }
const touchMid = (t) => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];
const touchDist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
zoomer.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 2) return;
  const [mx, my] = touchMid(e.touches), r = zoomer.getBoundingClientRect(), tile = $('#board').firstChild.offsetWidth / zoom;
  // the board point under the fingers, so it stays under them while zooming
  pinch = { d: touchDist(e.touches), z: zoom, max: Math.max(1, 60 / tile), x: zoomer.scrollLeft + mx - r.left, y: zoomer.scrollTop + my - r.top };
}, { passive: true });
zoomer.addEventListener('touchmove', (e) => {
  if (!pinch || e.touches.length !== 2) return;
  e.preventDefault();
  const z = Math.min(pinch.max, Math.max(1, pinch.z * touchDist(e.touches) / pinch.d)), k = z / pinch.z;
  const [mx, my] = touchMid(e.touches), r = zoomer.getBoundingClientRect();
  setZoom(z);
  zoomer.scrollLeft = pinch.x * k - (mx - r.left); // ponytail: ignores padding/gaps, close enough under a finger
  zoomer.scrollTop = pinch.y * k - (my - r.top);
}, { passive: false });
zoomer.addEventListener('touchend', (e) => { if (e.touches.length < 2) pinch = null; });

// Glide the selected tile into view (with a tile of margin) when it's off the zoomed board's visible part.
function follow() {
  const el = G.sel?.el;
  if (!el || pinch) return;
  const a = zoomer.getBoundingClientRect(), b = el.getBoundingClientRect(), m = Math.min(b.width, a.width / 4);
  const off = (lo, hi, min, max) => (lo < min + m ? lo - min - m : hi > max - m ? Math.min(hi - max + m, lo - min - m) : 0);
  const left = off(b.left, b.right, a.left, a.right), top = off(b.top, b.bottom, a.top, a.bottom);
  if (left || top) zoomer.scrollBy({ left, top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

// ---------- spoken board ----------
// A line read as words: "4 plus blank equals 7". The selected blank is "this blank".
const isAcross = (e) => G.p.cells[G.p.eqs[e][0]].r === G.p.cells[G.p.eqs[e][1]].r;
function lineText(e, here = null) {
  const words = G.p.eqs[e].map((i) => {
    const c = G.p.cells[i], v = valOf(c);
    if (c === here) return v ? `this tile, ${NAMES[v]}` : 'this blank';
    return v === undefined ? 'blank' : c.op ? NAMES[v] : sym(v);
  });
  return `${isAcross(e) ? 'Across' : 'Down'}: ${words.join(' ')}`;
}
const VERDICT = { open: 'not finished', ok: 'true', bad: 'false' };
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
    G.fills.set(cell.key, op);
    sfx.place();
    flash(cell.el, 'pop');
    const next = nextInEquation(G.p, cell, G.eq, (c) => editable(c) && !G.fills.has(c.key));
    G.eq = next ? next.eq : null;
    G.sel = next ? next.cell : nextEmpty(cell) || cell;
  } else {
    if (!G.fills.delete(cell.key)) return;
    sfx.erase();
  }
  refresh(true);
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
  sfx.hint();
  flash(c.el, 'pop');
  G.sel = nextEmpty(c);
  G.eq = null;
  refresh(true);
  saveGame();
}

function reset() {
  if (!playing() || G.fills.size === G.hinted.size) return;
  if (!confirm('Restart this level? Your tiles are cleared; the clock keeps running.')) return;
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
  else return false;
  return true;
}

// ---------- print ----------
// The grid with its blanks empty, the operators in play listed above it.
printable(() => {
  const { p } = G, all = [...p.ops, ...p.rels];
  const cell = (c) => `<div class="${c.op ? (c.given ? 'p-given' : 'p-blank') : 'p-num'}${String(c.val).length > 2 ? ' long' : ''}" style="grid-area: ${c.r + 1} / ${c.c + 1}">${c.op && !c.given ? '' : esc(sym(c.val))}</div>`;
  return {
    rules: [
      'Write an operator in every empty box so <b>each row and column is a true equation</b>.',
      'Boxes where lines cross are <b>shared</b>: one symbol has to work both ways.',
      'Usual math order: <b>× ÷</b> before <b>+ −</b>. Division must come out exact.',
      ...['^', '.', '%', '<'].filter((o) => all.includes(o)).map((o) => OP_TIPS[o].replace('New: ', '')),
    ],
    body: `<p class="p-ops">Use: ${all.map((o) => `<b>${esc(sym(o))}</b>`).join('')}</p>` +
      `<div class="p-grid" style="--cols: ${p.cols}; --rows: ${p.rows}">${p.cells.map(cell).join('')}</div>`,
  };
});

mini($('#logo'), ['.5.8.', '4+3=7', '.1.1.', '.=.+.', '.6.7.']);
mini($('#help-grid'), ['.2...', '3+5=8', '.4...', '.=...', '.6...'], ['1,1', '1,3']);
// ponytail: storage key keeps the old name so existing saves survive the rename.
boot({ name: 'Mathquilibrium', storeKey: 'crossum2', glyphs: ['+', '−', '×', '÷', '='], start: startLevel, save: (G) => ({ fills: [...G.fills], hinted: [...G.hinted] }), key: onKey,
  reveal: () => { for (const c of G.p.cells) if (c.op && !c.given) G.fills.set(c.key, c.val); refresh(false); } });
