'use strict';
// Quadflip: pick a piece from the tray, stamp it on the board, its four tiles flip. Every piece once, every tile blank.
const FIRST_TIP = 'Pick a <b>piece</b>, tap the board to <b>flip</b> the tiles under it. Use <b>every piece</b> once to clear the board.';

// A board of N×N two-sided tiles into `el`. Returns the cells (for the ghost) and tiles (for the flip).
function drawBoard(el, N) {
  el.style.setProperty('--n', N);
  const cells = [], tiles = [];
  el.replaceChildren(...Array.from({ length: N * N }, (_, i) => {
    const c = document.createElement('div'), t = document.createElement('i');
    c.className = 'cell';
    t.className = 't';
    c.style.setProperty('--d', (Math.floor(i / N) + (i % N)) * 40 + 'ms');
    t.append(document.createElement('b')); // edge strips, for thickness
    c.append(t);
    cells.push(c);
    tiles.push(t);
    return c;
  }));
  return { cells, tiles };
}
const paint = (view, board) => view.tiles.forEach((t, i) => t.classList.toggle('on', !!(board >> i & 1)));

// A piece as a little SVG, cells one unit each, centered in a 4×4 box.
function pieceSvg(s) {
  const [h, w] = dims(s);
  return `<svg viewBox="-.1 -.1 4.2 4.2" aria-hidden="true"><g transform="translate(${(4 - w) / 2} ${(4 - h) / 2})">` +
    SHAPES[s].map(([r, c]) => `<rect x="${c + .06}" y="${r + .06}" width=".88" height=".88" rx=".14"/>`).join('') + '</g></svg>';
}

// Where each used piece sits: its outline, one colour per piece, inset a little more per piece so overlaps stay apart.
// In board units (one per cell, cell edges mid-gap), traced clockwise; each corner moves `d` along both inward normals.
const MARKS = ['--pink', '--sun', '--ink', '--orange', '--muted', '--red', '--teal-text'];
function outline(s, pos, N, d) {
  const has = new Set(SHAPES[s].map(String)), next = new Map();
  for (const [r, c] of SHAPES[s]) for (const [dr, dc, x0, y0, x1, y1] of [[-1, 0, 0, 0, 1, 0], [0, 1, 1, 0, 1, 1], [1, 0, 1, 1, 0, 1], [0, -1, 0, 1, 0, 0]])
    if (!has.has([r + dr, c + dc] + '')) next.set([c + x0, r + y0] + '', [c + x1, r + y1]);
  const pts = [];
  for (let p = next.values().next().value; !pts.length || p + '' !== pts[0] + ''; p = next.get(p + '')) pts.push(p);
  const x0 = pos % N, y0 = Math.floor(pos / N), corners = [];
  pts.forEach(([x, y], i) => {
    const [px, py] = pts.at(i - 1), [nx, ny] = pts[(i + 1) % pts.length];
    const a = [x - px, y - py], b = [nx - x, ny - y]; // edge in, edge out; inward normal of (dx, dy) is (-dy, dx)
    if (a + '' !== b + '') corners.push(`${x0 + x + d * (-a[1] - b[1])} ${y0 + y + d * (a[0] + b[0])}`);
  });
  return 'M' + corners.join('L') + 'Z';
}

// ---------- state ----------
// G.placed[k] = where piece k is stamped (top-left of its box), or -1. G.order = stamps the player can undo, oldest first.
// G.hinted = pieces a hint put down: correct, and locked.
const current = () => G.p.pieces.reduce((b, s, k) => G.placed[k] < 0 ? b : b ^ flip(G.p.N, s, G.placed[k]), G.p.board);
const nextFree = (from = 0) => {
  const K = G.p.pieces.length;
  for (let j = 0; j < K; j++) { const k = (from + j) % K; if (G.placed[k] < 0) return k; }
  return -1;
};

function startLevel(G, save) {
  const p = generate(hash(G.key), G.pack), K = p.pieces.length, N = p.N;
  const okPos = (k, v) => v === -1 || placements(N, p.pieces[k]).some((q) => q.pos === v);
  const fits = Array.isArray(save.placed) && save.placed.length === K && save.placed.every((v, k) => okPos(k, v)) &&
    Array.isArray(save.order) && save.order.every((k) => save.placed[k] >= 0) &&
    Array.isArray(save.hinted) && save.hinted.every((k) => save.placed[k] >= 0 && !save.order.includes(k));
  const s = fits ? save : {};
  Object.assign(G, {
    p, placed: s.placed ? [...s.placed] : Array(K).fill(-1), order: s.order ? [...s.order] : [], hinted: new Set(s.hinted),
    sel: 0, at: null, kbd: false,
  });
  G.sel = Math.max(0, nextFree());

  $('#g-sub').textContent = `${N}×${N} · ${K} pieces`;
  delete $('#tip').dataset.warn;
  $('#tip').innerHTML = G.date ? `Today's ${TIERS[G.pack].toLowerCase()} puzzle. A new one tomorrow.` : G.n === 1 ? FIRST_TIP : '';
  const b = $('#board');
  b.classList.remove('solved');
  G.view = drawBoard(b, N);
  b.insertAdjacentHTML('beforeend', `<svg class="marks" viewBox="0 0 ${N} ${N}" aria-hidden="true"></svg>`);
  $('#tray').style.setProperty('--k', K);
  $('#tray').replaceChildren(...p.pieces.map((sh, k) => {
    const t = document.createElement('button');
    t.className = 'piece';
    t.style.setProperty('--c', `var(${MARKS[k]})`);
    t.innerHTML = pieceSvg(sh);
    t.onclick = () => pickPiece(k);
    return t;
  }));
  refresh();
  return fits || !Object.keys(save).length;
}

// Where the selected piece would land with its box centered on board point (x, y), in cell units; clamped onto the board.
function landing(x, y) {
  const [h, w] = dims(G.p.pieces[G.sel]), N = G.p.N;
  const clamp = (v, max) => Math.max(0, Math.min(max, v));
  return clamp(Math.round(y - h / 2), N - h) * N + clamp(Math.round(x - w / 2), N - w);
}

function refresh() {
  const { p, view } = G, N = p.N, board = current(), free = G.placed.filter((v) => v < 0).length;
  paint(view, board);
  const ghost = !G.done && G.at !== null && G.placed[G.sel] < 0 ? flip(N, p.pieces[G.sel], G.at) : 0;
  view.cells.forEach((c, i) => c.classList.toggle('ghost', !!(ghost >> i & 1)));
  $('#board .marks').innerHTML = G.placed.map((v, k) => v < 0 ? '' : ((d) => `<g style="--c: var(${MARKS[k]})"><path class="halo" d="${d}"/><path d="${d}"/></g>`)(outline(p.pieces[k], v, N, .1 + k * .045))).join('');
  $('#tray').querySelectorAll('.piece').forEach((t, k) => {
    t.classList.toggle('used', G.placed[k] >= 0);
    t.classList.toggle('hinted', G.hinted.has(k));
    t.setAttribute('aria-pressed', String(k === G.sel && !G.done));
    t.disabled = G.done || G.hinted.has(k);
    t.setAttribute('aria-label', `Piece ${k + 1}` + (G.hinted.has(k) ? ', placed by a hint' : G.placed[k] >= 0 ? ', used: tap to lift it' : ''));
  });
  const dark = board.toString(2).split('1').length - 1;
  $('#board').setAttribute('aria-label', `Quadflip board, ${N} by ${N}. ${dark} dark tiles, ${free} of ${p.pieces.length} pieces left`);
  if (G.kbd && !G.done) $('#sr').textContent = G.placed[G.sel] >= 0 ? `Piece ${G.sel + 1} is used.`
    : `Piece ${G.sel + 1} at row ${Math.floor((G.at ?? 0) / N) + 1}, column ${((G.at ?? 0) % N) + 1}. ${dark} dark tiles, ${free} pieces left.`;
  $('#btn-undo').disabled = !G.order.length || G.done;
  if (!G.done && !free && !board) win();
}

// ---------- moves ----------
function pickPiece(k) {
  if (!playing() || G.hinted.has(k)) return;
  if (G.placed[k] >= 0) { lift(k); return; } // a used piece comes back off the board, ready to place again
  G.sel = k;
  sfx.tap();
  refresh();
}

function stamp(pos) {
  const k = G.sel;
  if (!playing() || G.placed[k] >= 0) return;
  G.placed[k] = pos;
  G.order.push(k);
  sfx.place();
  SHAPES[G.p.pieces[k]].forEach(([r, c]) => flash(G.view.tiles[pos + r * G.p.N + c], 'pop'));
  const nf = nextFree(k + 1);
  if (nf >= 0) G.sel = nf;
  else if (current()) { sfx.bad(); flash($('#board'), 'shake'); $('#tip').innerHTML = 'Not clear yet. <b>Tap a used piece</b> to lift it, or undo.'; $('#tip').dataset.warn = 1; }
  G.at = G.kbd ? G.at : null;
  refresh();
  saveGame();
}

function lift(k) {
  if (G.placed[k] < 0 || G.hinted.has(k)) return;
  G.placed[k] = -1;
  G.order = G.order.filter((j) => j !== k);
  G.sel = k;
  if ($('#tip').dataset.warn) { $('#tip').innerHTML = ''; delete $('#tip').dataset.warn; }
  sfx.erase();
  refresh();
  saveGame();
}

function undo() {
  if (!playing() || !G.order.length) return;
  lift(G.order[G.order.length - 1]);
}

// A hint stamps one piece where the answer has it. Twins are interchangeable, so match by shape and spot.
function hint() {
  if (!playing()) return;
  const { pieces, sol } = G.p, K = pieces.length;
  const right = new Set(); // pieces already on a spot the answer uses for their shape
  const missing = []; // answer slots nobody fills yet
  const keys = [...Array(K).keys()].sort((a, b) => G.hinted.has(b) - G.hinted.has(a)); // hints match first: never moved
  for (let i = 0; i < K; i++) {
    const k = keys.find((j) => !right.has(j) && pieces[j] === pieces[i] && G.placed[j] === sol[i]);
    if (k === undefined) missing.push(i); else right.add(k);
  }
  if (!missing.length) return;
  const i = missing.find((m) => pieces[m] === pieces[G.sel]) ?? missing[0];
  const sameShape = [...Array(K).keys()].filter((j) => pieces[j] === pieces[i] && !right.has(j));
  const k = sameShape.find((j) => G.placed[j] < 0) ?? sameShape[0]; // a free twin, else move a misplaced one
  G.placed[k] = sol[i];
  G.order = G.order.filter((j) => j !== k);
  G.hinted.add(k);
  if (G.sel === k || G.placed[G.sel] >= 0) G.sel = Math.max(0, nextFree());
  sfx.hint();
  refresh();
  SHAPES[pieces[k]].forEach(([r, c]) => flash(G.view.tiles[sol[i] + r * G.p.N + c], 'pop'));
  saveGame();
}

function reset() {
  if (!playing() || !G.order.length) return;
  if (!confirm('Restart this level? Your pieces come back off the board; the clock keeps running.')) return;
  for (const k of G.order) G.placed[k] = -1;
  G.order = [];
  G.sel = Math.max(0, nextFree());
  sfx.erase();
  refresh();
  saveGame();
}

// ---------- input ----------
// Hover (mouse) or press-and-drag (touch) shows where the piece lands; letting go on the board stamps it.
const point = (e) => {
  const r = $('#board').getBoundingClientRect(), N = G.p.N;
  return { x: ((e.clientX - r.left) / r.width) * N, y: ((e.clientY - r.top) / r.height) * N, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
};
let pressed = false;
$('#board').addEventListener('pointerdown', (e) => {
  if (!playing() || e.button > 0 || G.placed[G.sel] >= 0) return;
  e.preventDefault();
  $('#board').setPointerCapture(e.pointerId);
  pressed = true;
  G.kbd = false;
  const { x, y } = point(e);
  G.at = landing(x, y);
  refresh();
});
$('#board').addEventListener('pointermove', (e) => {
  if (!playing() || G.placed[G.sel] >= 0) return;
  if (!pressed && e.pointerType !== 'mouse') return;
  const { x, y, inside } = point(e), at = inside ? landing(x, y) : null;
  if (at !== G.at) { G.at = at; G.kbd = false; refresh(); }
});
$('#board').addEventListener('pointerup', (e) => {
  if (!pressed) return;
  pressed = false;
  const { x, y, inside } = point(e);
  if (inside && playing()) stamp(landing(x, y)); // released off the board: cancelled
  else { G.at = null; refresh(); }
});
$('#board').addEventListener('pointercancel', () => { pressed = false; G.at = null; refresh(); });
$('#board').addEventListener('pointerleave', (e) => { if (!pressed && e.pointerType === 'mouse' && G) { G.at = null; refresh(); } });
// Keyboard focus on the board shows the piece and starts describing it (a mouse click focuses it too, but quietly).
$('#board').addEventListener('focus', () => { if (playing() && $('#board').matches(':focus-visible')) { G.kbd = true; G.at ??= 0; refresh(); } });

function onKey(e) {
  const N = G.p.N, K = G.p.pieces.length;
  const moves = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
  if (moves[e.key]) {
    const [h, w] = dims(G.p.pieces[G.sel]), at = G.at ?? 0;
    const r = Math.max(0, Math.min(N - h, Math.floor(at / N) + moves[e.key][0]));
    const c = Math.max(0, Math.min(N - w, (at % N) + moves[e.key][1]));
    G.at = r * N + c;
    G.kbd = true;
    sfx.tap();
    refresh();
  } else if (/^[1-9]$/.test(e.key) && +e.key <= K) {
    G.kbd = true;
    pickPiece(+e.key - 1);
    reclamp();
  } else if ((e.key === ' ' || e.key === 'Enter') && document.activeElement?.tagName !== 'BUTTON') {
    G.kbd = true;
    G.at ??= 0;
    reclamp();
    stamp(G.at);
  } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'z' || e.key === 'Z' || e.key === 'u' || e.key === 'U') { G.kbd = true; undo(); }
  else return false;
  return true;
}
// a new piece may be bigger than the last: keep the cursor's spot on the board
function reclamp() {
  if (G.at === null) return;
  const N = G.p.N;
  G.at = landing((G.at % N) + dims(G.p.pieces[G.sel])[1] / 2, Math.floor(G.at / N) + dims(G.p.pieces[G.sel])[0] / 2);
  refresh();
}

$('#btn-undo').onclick = undo;
$('#btn-hint').onclick = hint;
$('#btn-reset').onclick = reset;

for (const [id, key] of [['#logo', 'logo'], ['#help-board', 'help']]) {
  const p = generate(hash(key), 'E');
  paint(drawBoard($(id), p.N), p.board);
}
boot({ name: 'Quadflip', storeKey: 'quadflip', winDelay: 1600, glyphs: ['■', '▚'], start: startLevel,
  save: (G) => ({ placed: G.placed, order: G.order, hinted: [...G.hinted] }), key: onKey,
  reveal: () => { G.placed = [...G.p.sol]; G.order = []; G.hinted = new Set(); refresh(); } });
