'use strict';
const SVGNS = 'http://www.w3.org/2000/svg';
const R = 96; // outer radius in viewBox units (viewBox is -100..100)
const FIRST_TIP = T('Tap an arc to mark it <b>×</b>, again for a <b>queen</b>. One queen per <b>ring</b>, <b>slice</b> and <b>color</b>.');
// a crown in a 26-unit box around the origin; pieces are scaled to fit their arc
const CROWN = '<g class="crown"><path d="M-9 4.5-10.5-6.5-4.5-1.5 0-10 4.5-1.5 10.5-6.5 9 4.5ZM-9 7h18v3h-18Z"/>' +
  '<circle cx="-10.5" cy="-6.5" r="1.8"/><circle cy="-10" r="1.8"/><circle cx="10.5" cy="-6.5" r="1.8"/></g>';
const CROSS = '<path class="x" d="M-4-4l8 8M4-4l-8 8"/>';

const svg = (tag, attrs = {}) => {
  const el = document.createElementNS(SVGNS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
};
// Board geometry for N rings: hub radius, ring width, and the polar point of (ring, slice) at a fraction.
function geo(N) {
  const hub = 30 - 1.6 * N, w = (R - hub) / N;
  const pt = (rad, a) => [rad * Math.sin(a), -rad * Math.cos(a)]; // a = 0 at 12 o'clock, clockwise
  return { N, hub, w, pt, ang: (s) => (s * 2 * Math.PI) / N, rad: (r) => hub + r * w };
}

// Draws a board into an <svg>: cells, region walls, a layer per cell for marks/queens, the hub.
function drawBoard(el, p, { mini = false } = {}) {
  const g = geo(p.N), { N, pt, ang, rad } = g, f = (n) => +n.toFixed(2);
  el.replaceChildren();
  el.setAttribute('viewBox', '-100 -100 200 200');
  el.append(svg('circle', { class: 'lip', r: R + 1, cy: 3 }), svg('circle', { class: 'stock-back', r: R }));
  const cellsG = svg('g', { class: 'cells' }), wallsG = svg('path', { class: 'walls' }), piecesG = svg('g', { class: 'pieces' });
  const els = [], pieces = [];
  let walls = '', seams = '';
  for (let i = 0; i < N * N; i++) {
    const r = Math.floor(i / N), s = i % N, a0 = ang(s), a1 = ang(s + 1), ri = rad(r), ro = rad(r + 1);
    const [x0, y0] = pt(ro, a0), [x1, y1] = pt(ro, a1), [x2, y2] = pt(ri, a1), [x3, y3] = pt(ri, a0);
    const d = `M${f(x0)} ${f(y0)}A${f(ro)} ${f(ro)} 0 0 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${f(ri)} ${f(ri)} 0 0 0 ${f(x3)} ${f(y3)}Z`;
    const c = svg('path', { d, class: 'c rg' + p.region[i] });
    c.style.setProperty('--d', r * 45 + s * 8 + 'ms');
    c.style.setProperty('--ring', r);
    cellsG.append(c);
    els.push(c);
    // walls: between this cell and the next slice, and between this ring and the next one out
    const next = r * N + (s + 1) % N;
    // seams: the same edges inside a region, drawn thin
    const side = `M${f(x2)} ${f(y2)}L${f(x1)} ${f(y1)}`, arc = `M${f(x0)} ${f(y0)}A${f(ro)} ${f(ro)} 0 0 1 ${f(x1)} ${f(y1)}`;
    if (p.region[next] !== p.region[i]) walls += side; else seams += side;
    if (r < N - 1) { if (p.region[i + N] !== p.region[i]) walls += arc; else seams += arc; }
    const [cx, cy] = pt((ri + ro) / 2, (a0 + a1) / 2), size = Math.min(g.w, ((ri + ro) / 2) * (a1 - a0));
    // the stamp filter sits on each piece (only a changed piece re-renders it), outside the scale so its noise stays in board units
    const pc = svg('g', { class: 'pc', transform: `translate(${f(cx)} ${f(cy)})` });
    pc.append(svg('g', { transform: `scale(${f(size / 22)})` }));
    // each arc's stamp lands a little crooked and off-centre; seeded by the cell so it never jitters on redraw
    const rand = rng(i * 7919 + N);
    pc.style.setProperty('--rot', (rand() * 2 - 1) * 12 + 'deg');
    pc.style.setProperty('--tx', (rand() * 2 - 1) * 3 + 'px');
    pc.style.setProperty('--ty', (rand() * 2 - 1) * 3 + 'px');
    piecesG.append(pc);
    pieces.push(pc);
  }
  wallsG.setAttribute('d', walls);
  // a paper-coloured halo under each seam, so the thin line reads against any ink
  const seamsG = [svg('path', { class: 'seams halo', d: seams }), svg('path', { class: 'seams', d: seams })];
  const hub = svg('g', { class: 'hub' });
  // the seal: a stamped crown that lands in the hub when the board is solved (CSS shows it)
  const seal = svg('g', { class: 'seal', transform: `scale(${f(g.hub / 19)})` });
  seal.innerHTML = `<g class="seal-ink">${CROWN}</g>`;
  hub.append(svg('circle', { r: g.hub }), seal, svg('text', { y: g.hub * 0.05, 'font-size': g.hub * 0.9 }));
  el.append(cellsG, ...seamsG, wallsG, svg('circle', { class: 'rim', r: R }), svg('circle', { class: 'rim', r: g.hub }), piecesG, hub);
  const cursor = svg('path', { class: 'cursor' });
  el.append(cursor);
  if (mini) for (const q of p.queens) setPiece(pieces[q], 'q');
  return { g, els, pieces, hubText: hub.lastChild, cursor, piecesG };
}

function setPiece(pc, kind) {
  if (pc.dataset.k === kind) return false;
  pc.dataset.k = kind; // q queen, m manual mark, a auto mark
  pc.firstChild.innerHTML = kind === 'q' ? CROWN : kind ? CROSS : '';
  return true;
}

// ---------- state ----------
const N_ = () => G.p.N;
const auto = (i) => [...G.queens].some((q) => sees(N_(), G.p.region, q, i));
const shown = (i) => (G.queens.has(i) ? 'q' : G.marks.has(i) ? 'm' : auto(i) ? 'a' : '');

function startLevel(G, save) {
  const N = SIZES[G.pack];
  const p = generate(hash(G.key), N);
  const ok = (a) => Array.isArray(a) && a.every((i) => Number.isInteger(i) && i >= 0 && i < N * N);
  const fits = ok(save.queens) && ok(save.marks) && ok(save.hinted) && save.hinted.every((i) => p.queens.includes(i));
  const s = fits ? save : {};
  Object.assign(G, { p, queens: new Set(s.queens), marks: new Set(s.marks), hinted: new Set(s.hinted), sel: 0, kbd: false, conflicts: new Set(), history: [] });

  $('#g-sub').textContent = T('{n} queens', { n: N });
  $('#tip').innerHTML = G.date ? T(`Today's ${TIERS[G.pack].toLowerCase()} puzzle. A new one tomorrow.`) : !Object.values(store.packs).some((pp) => Object.keys(pp.stars).length) ? FIRST_TIP : '';
  const b = $('#board');
  b.classList.remove('solved');
  G.view = drawBoard(b, p);
  refresh(false);
  return fits || !Object.keys(save).length;
}

function refresh(sound, placed = null) {
  const { p, view } = G, N = p.N;
  const conflicts = new Set([...G.queens].filter((q) => [...G.queens].some((o) => sees(N, p.region, q, o))));
  const fresh = [...conflicts].filter((q) => !G.conflicts.has(q));
  G.conflicts = conflicts;
  for (let i = 0; i < N * N; i++) {
    const k = shown(i), pc = view.pieces[i];
    if (setPiece(pc, k) && k === 'q' && sound) flash(pc.firstChild.firstChild, 'pop');
    pc.classList.toggle('bad', conflicts.has(i));
    pc.classList.toggle('hinted', G.hinted.has(i));
  }
  if (sound) {
    if (fresh.length) { sfx.bad(); fresh.forEach((q) => flash(view.pieces[q].firstChild.firstChild, 'shake')); }
    else if (placed !== null) { sfx.good(G.queens.size - 1); if (!conflicts.has(placed)) shimmer(Math.floor(placed / N)); }
  }
  const left = N - G.queens.size;
  view.hubText.textContent = left || ''; // at zero the hub clears for the seal
  // keyboard cursor: outline the selected arc
  view.cursor.setAttribute('d', G.kbd && !G.done ? view.els[G.sel].getAttribute('d') : '');
  $('#board').setAttribute('aria-label', T('Coronet board, {n} rings. {left} of {n} queens left', { n: N, left }));
  // screen readers hear the arc under the keyboard cursor, and what just changed there
  if (G.kbd && !G.done) $('#sr').textContent = describe(G.sel, left, conflicts);
  if (!G.done && G.queens.size === N && !conflicts.size) win();
  $('#btn-undo').disabled = !G.history.length || G.done;
}

// A ring that just got its queen: one slow glint runs round it, under the pieces. Removes itself when done.
function shimmer(r) {
  const { g, piecesG } = G.view, c = svg('circle', { class: 'shimmer', r: g.rad(r + 0.5), 'stroke-width': g.w, pathLength: 100 });
  c.addEventListener('animationend', () => c.remove());
  piecesG.before(c);
}

// Region names follow the inks in style.css (--r0 … --r6), so a sighted helper and a screen reader agree.
const REGION = ['pink', 'yellow', 'blue', 'lime', 'orange', 'teal', 'violet'];
function describe(i, left, conflicts) {
  const N = N_(), k = shown(i);
  const what = k === 'q' ? T(G.hinted.has(i) ? 'queen, from a hint' : 'queen') + (conflicts.has(i) ? T(', clashes with another queen') : '')
    : T(k === 'm' ? 'marked' : k === 'a' ? 'ruled out' : 'empty');
  return T('Ring {r} of {n} from the centre, slice {s}, {color}: {what}. {left} queens left.',
    { r: Math.floor(i / N) + 1, n: N, s: (i % N) + 1, color: T(REGION[G.p.region[i]]), what, left });
}
// Keyboard focus on the board shows the cursor and starts describing it (a mouse click focuses it too, but quietly).
$('#board').addEventListener('focus', () => { if (playing() && $('#board').matches(':focus-visible')) { G.kbd = true; refresh(false); } });

// ---------- undo ----------
// A snapshot of queens + marks; act() records one only if fn actually changed something.
// ponytail: history lives in memory only, a reload starts it fresh.
const snap = () => JSON.stringify([[...G.queens], [...G.marks]]);
function act(fn, before = snap()) {
  fn();
  if (snap() !== before) { G.history.push(before); refresh(false); }
}
function undo() {
  if (!playing() || !G.history.length) return;
  const [q, m] = JSON.parse(G.history.pop());
  G.queens = new Set([...q, ...G.hinted]);
  G.marks = new Set(m);
  sfx.erase();
  refresh(false);
  saveGame();
}

// Tap cycle on what the arc shows: empty -> × -> queen -> empty. toQueen skips the × step.
function cycle(i, toQueen = false) {
  if (!playing() || G.hinted.has(i)) return;
  const k = shown(i);
  G.history.push(snap());
  if (k === 'q') { G.queens.delete(i); sfx.erase(); refresh(true); }
  else if (k || toQueen) { G.marks.delete(i); G.queens.add(i); sfx.place(); refresh(true, i); }
  else { G.marks.add(i); sfx.tap(); refresh(false); }
  saveGame();
}

function setMark(i, on) {
  if (G.queens.has(i) || G.marks.has(i) === on || (on && auto(i))) return;
  on ? G.marks.add(i) : G.marks.delete(i);
  sfx.tap();
  refresh(false);
}

function hint() {
  if (!playing()) return;
  const N = N_(), missing = G.p.queens.filter((q) => !G.queens.has(q));
  const q = missing.find((m) => Math.floor(m / N) === Math.floor(G.sel / N)) ?? missing[Math.floor(Math.random() * missing.length)];
  if (q === undefined) return;
  for (const o of [...G.queens]) if (sees(N, G.p.region, q, o)) G.queens.delete(o); // they're wrong: the answer is unique
  G.marks.delete(q);
  G.queens.add(q);
  G.hinted.add(q);
  G.history = []; // a hint is final: undoing past it could bring back the queens it removed
  sfx.hint();
  track('hint');
  refresh(false);
  flash(G.view.pieces[q].firstChild.firstChild, 'pop');
  saveGame();
}

function reset() {
  if (!playing() || (G.queens.size === G.hinted.size && !G.marks.size)) return;
  if (!confirm(T('Restart this level? Your queens and marks are cleared; the clock keeps running.'))) return;
  act(() => { G.queens = new Set(G.hinted); G.marks.clear(); });
  sfx.erase();
  saveGame();
}

// ---------- input ----------
// The arc under a pointer, by polar position (exact even where arcs are thin), or -1.
function hit(e) {
  const b = $('#board'), { g } = G.view;
  const { x, y } = new DOMPoint(e.clientX, e.clientY).matrixTransform(b.getScreenCTM().inverse());
  const d = Math.hypot(x, y);
  if (d < g.hub || d > R + 3) return -1;
  const r = Math.min(g.N - 1, Math.floor((d - g.hub) / g.w));
  const a = (Math.atan2(x, -y) + 2 * Math.PI) % (2 * Math.PI);
  return r * g.N + (Math.floor((a * g.N) / (2 * Math.PI)) % g.N);
}

// Tap cycles an arc. Dragging from an empty arc marks every empty arc it crosses; from a × it clears them.
let drag = null;
$('#board').addEventListener('pointerdown', (e) => {
  if (!playing() || e.button > 0) return;
  const i = hit(e);
  if (i < 0) return;
  e.preventDefault();
  $('#board').setPointerCapture(e.pointerId);
  G.sel = i; G.kbd = false;
  drag = { from: i, last: i, mode: null, before: snap() };
});
$('#board').addEventListener('pointermove', (e) => {
  if (!drag || !playing()) return;
  const i = hit(e);
  if (i < 0 || i === drag.last) return;
  if (drag.mode === null) {
    const k = shown(drag.from);
    drag.mode = k === '' ? 'mark' : k === 'm' ? 'clear' : 'none';
    if (drag.mode !== 'none') setMark(drag.from, drag.mode === 'mark');
  }
  if (drag.mode !== 'none') setMark(i, drag.mode === 'mark');
  drag.last = i;
});
const endDrag = (e) => {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (e.type === 'pointerup' && d.mode === null) cycle(d.from);
  else if (d.mode) { act(() => {}, d.before); saveGame(); }
};
$('#board').addEventListener('pointerup', endDrag);
$('#board').addEventListener('pointercancel', endDrag);

function onKey(e) {
  const N = N_(), r = Math.floor(G.sel / N), s = G.sel % N;
  const moves = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [1, 0], ArrowDown: [-1, 0] };
  if (moves[e.key]) {
    const [dr, ds] = moves[e.key];
    G.sel = Math.max(0, Math.min(N - 1, r + dr)) * N + (s + ds + N) % N;
    G.kbd = true;
    sfx.tap();
    refresh(false);
  } else if (e.key === ' ' || e.key === 'Enter') { G.kbd = true; cycle(G.sel); }
  else if (e.key === 'q' || e.key === 'Q') {
    G.kbd = true;
    if (shown(G.sel) !== 'q') cycle(G.sel, true);
  } else if (e.key === 'x' || e.key === 'X' || e.key === 'm' || e.key === 'M') {
    G.kbd = true;
    if (!G.queens.has(G.sel)) { act(() => setMark(G.sel, !G.marks.has(G.sel))); saveGame(); }
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    G.kbd = true;
    if (G.queens.has(G.sel)) cycle(G.sel);
    else { act(() => setMark(G.sel, false)); saveGame(); }
  } else if (e.key === 'u' || e.key === 'U' || e.key === 'z' || e.key === 'Z') undo();
  else return false;
  return true;
}

$('#btn-undo').onclick = undo;
$('#btn-hint').onclick = hint;
$('#btn-reset').onclick = reset;

// ---------- print ----------
// Paper version: the empty board in greys and textures (light enough to draw on), region fills in style.css.
const PRINT_DEFS = '<defs>' +
  '<pattern id="p-hatch" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#fff"/><path d="M-1 1l2-2M0 4l4-4M3 5l2-2" stroke="#999" stroke-width=".5"/></pattern>' +
  '<pattern id="p-back" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#fff"/><path d="M-1 3l2 2M0 0l4 4M3-1l2 2" stroke="#999" stroke-width=".5"/></pattern>' +
  '<pattern id="p-dots" width="3.5" height="3.5" patternUnits="userSpaceOnUse"><rect width="3.5" height="3.5" fill="#fff"/><circle cx="1.75" cy="1.75" r=".6" fill="#888"/></pattern>' +
  '<pattern id="p-grid" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#fff"/><path d="M0 0h4M0 0v4" stroke="#aaa" stroke-width=".5"/></pattern>' +
  '<pattern id="p-greydots" width="3.5" height="3.5" patternUnits="userSpaceOnUse"><rect width="3.5" height="3.5" fill="#e4e4e4"/><circle cx="1.75" cy="1.75" r=".6" fill="#fff"/></pattern>' +
  '</defs>';
printable(() => {
  const el = svg('svg', { class: 'p-ring', 'aria-hidden': 'true' });
  drawBoard(el, G.p);
  el.insertAdjacentHTML('afterbegin', PRINT_DEFS);
  const solved = svg('svg', { class: 'p-ring', 'aria-hidden': 'true' });
  drawBoard(solved, G.p, { mini: true });
  solved.insertAdjacentHTML('afterbegin', PRINT_DEFS); // its own copy: the zine (print.html) prints answers apart from their boards
  return {
    rules: [
      T('Place <b>{n} queens</b>: one in every <b>ring</b>, every <b>slice</b> and every <b>shade</b>.', { n: G.p.N }),
      T('Draw a <b>crown</b> or <b>Q</b> for a queen, and an <b>×</b> on arcs that can\'t hold one.'),
      T('Each queen rules out the rest of its ring, its slice and its shade.'),
    ],
    body: el.outerHTML,
    answer: solved.outerHTML,
  };
}, (k, date) => { G = { p: generate(hash('D' + k + date), SIZES[k]) }; });

drawBoard($('#logo'), generate(hash('logo'), 5), { mini: true });
drawBoard($('#help-board'), generate(hash('help'), 4), { mini: true });
boot({ name: T('Coronet'), storeKey: 'coronet', random: true, winDelay: 3000, glyphs: ['♛'], start: startLevel, save: (G) => ({ queens: [...G.queens], marks: [...G.marks], hinted: [...G.hinted] }), key: onKey,
  reveal: () => { G.queens = new Set(G.p.queens); G.marks.clear(); refresh(false); } });
