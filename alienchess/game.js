'use strict';
// Alien Chess: your pieces (bottom) against the computer's (top), each type's moves on its card. You move, it replies.
// Rules and the puzzle generator in gen.js; this is the board, the cards and the turn-taking.

// Names, in LOOKS order: nonsense on purpose, so each language just spells them its own way
const NAME = [T('Bloorp'), T('Zib'), T('Gromf'), T('Quizzle'), T('Thrubb'), T('Yeep'), T('Vonk'), T('Splorg'), T('Snee'), T('Mibbix'), T('Durfle'), T('Oomba')];
// Art on a 40×48 piece: a shared pedestal and collar (they're still chess pieces), then each alien on top.
// .d = detail in the outline ink, .l = a line, .w = paper.
const BASE = '<path d="M8 45h24l-2-5H10zM14 40l2-11h8l2 11z"/><path d="M12 29h16v-3.5H12z"/>';
const ART = [
  '<path d="M9 26c-2-6 0-10 3-13 2-7 14-7 16 0 3 3 5 7 3 13z"/><circle class="w" cx="20" cy="15" r="4.6"/><circle class="d" cx="20.8" cy="15.6" r="2.1"/>',
  '<path class="l" d="M17 12L13 4M23 12l4-8"/><circle cx="13" cy="3.6" r="2"/><circle cx="27" cy="3.6" r="2"/><path d="M17 26l1-4h4l1 4z"/><circle cx="20" cy="16" r="6.5"/><circle class="d" cx="17.5" cy="15" r="1.2"/><circle class="d" cx="22.5" cy="15" r="1.2"/><circle class="d" cx="20" cy="18.6" r="1.2"/>',
  '<path d="M16 26l1-6h6l1 6z"/><path d="M13 16a7 7 0 0 1 14 0z"/><ellipse cx="20" cy="18" rx="14" ry="4"/><circle class="d" cx="11" cy="18" r="1.1"/><circle class="d" cx="20" cy="19.2" r="1.1"/><circle class="d" cx="29" cy="18" r="1.1"/>',
  '<path class="l" d="M13 16c0 5-3 6-3 10M17 16c0 5 1 6 0 10M23 16c0 5-1 6 0 10M27 16c0 5 3 6 3 10"/><path d="M10 17a10 12 0 0 1 20 0z"/><circle class="d" cx="16.5" cy="12" r="1.6"/><circle class="d" cx="23.5" cy="12" r="1.6"/>',
  '<path d="M12 26l-4-11 6 4zM28 26l4-11-6 4z"/><path d="M20 1l6 10-2 15h-8l-2-15z"/><path class="d" d="M20 4l-1 21h-1l-1.6-14z" opacity=".35"/>',
  '<path class="l" d="M16 20L11 8M20 19V5M24 20l5-12"/><path d="M11 26a9 8 0 0 1 18 0z"/><circle class="w" cx="11" cy="7" r="3"/><circle class="w" cx="20" cy="4" r="3"/><circle class="w" cx="29" cy="7" r="3"/><circle class="d" cx="11.5" cy="7.5" r="1.3"/><circle class="d" cx="20" cy="4.6" r="1.3"/><circle class="d" cx="28.5" cy="7.5" r="1.3"/>',
  '<path class="l" d="M20 2.5v4M8 14h4M28 14h4M11 5l3 3M29 5l-3 3M11 23l3-3M29 23l-3-3"/><circle cx="20" cy="15" r="8"/><path class="d" d="M16 17q4 3 8 0z"/><circle class="d" cx="17" cy="13" r="1.3"/><circle class="d" cx="23" cy="13" r="1.3"/>',
  '<path class="w" d="M11 26V9h18v17z"/><path d="M14 23c-3-3-1-8 3-8 1-3 5-3 6 0 4 0 6 5 3 8z"/><path class="l" d="M20 15v8"/><path d="M10 9h20V5.5H10z"/>',
  '<path d="M13 17C8 13 8 7 11 3c0 5 2 8 5 10zM27 17c5-4 5-10 2-14 0 5-2 8-5 10z"/><path d="M11 26c0-8 3-13 9-13s9 5 9 13z"/><path class="d" d="M14.5 18.5l4 1.2-4 .8zM25.5 18.5l-4 1.2 4 .8z"/>',
  '<path d="M17 26l1-4h4l1 4z"/><circle cx="20" cy="14" r="7.5"/><ellipse class="l" cx="20" cy="14" rx="14" ry="3.6" transform="rotate(-16 20 14)"/>',
  '<path class="l" d="M15 13L9 26M20 14v12M25 13l6 13"/><path d="M11 11a9 6.5 0 0 1 18 0z"/><path d="M10 11h20l-3 4H13z"/><path class="w" d="M14 6.5h12v2.6H14z"/><circle class="d" cx="20" cy="7.8" r="1.1"/>',
  '<path class="l" d="M20 10V5"/><circle cx="20" cy="4" r="2.2"/><path d="M12 26V10h16v16z"/><path class="w" d="M14.5 14h11v5h-11z"/><circle class="d" cx="17.5" cy="16.5" r="1.3"/><circle class="d" cx="22.5" cy="16.5" r="1.3"/><path class="l" d="M16 22.5h8"/>',
];
const CROWN = '<path class="crown" d="M1 12L0 3l4.5 3.5L8 0l3.5 6.5L16 3l-1 9z"/>';
const pieceSvg = (type, side) => `<svg class="pc ${side > 0 ? 'you' : 'foe'}" viewBox="0 -2 40 50" aria-hidden="true">${BASE}${ART[type.look]}${type.king ? CROWN : ''}</svg>`;
// Seconds for three and two stars, per difficulty
const STAR_TIME = { E: [30, 90], M: [60, 180], H: [120, 300] };

// A type's moves as a little diagram, from your side (up = forward): the piece in the middle, a line per slide
// (an arrow when it runs past the diagram's edge), and a mark per square it reaches: ● moves or takes, ○ only moves, × only takes.
function diagram(rules) {
  const reach = (r) => (r.k === 'leap' ? Math.max(...r.v.flat().map(Math.abs)) : Math.min(r.n, 3));
  const R = Math.max(2, ...rules.map(reach)), D = 2 * R + 1, marks = new Map();
  let lines = '';
  const at = (dr, dc) => [(R + dc) * 10 + 5, (R + dr) * 10 + 5];
  const mark = (dr, dc, m) => { const k = dr + ',' + dc, o = marks.get(k) || {}; if (m !== 'cap') o.move = 1; if (m !== 'move') o.cap = 1; marks.set(k, o); };
  for (const r of rules) for (const [dr, dc] of r.v) {
    if (r.k === 'leap') { mark(dr, dc, r.m); continue; }
    const n = Math.min(r.n, R);
    for (let s = 1; s <= n; s++) mark(dr * s, dc * s, r.m);
    const [x0, y0] = at(0, 0), [x1, y1] = at(dr * n, dc * n);
    lines += `<path d="M${x0} ${y0}L${x1} ${y1}"/>`;
    if (r.n > R) { // runs on: an arrowhead past the last square
      const [x2, y2] = at(dr * (n + 0.4), dc * (n + 0.4)), a = Math.atan2(y2 - y1, x2 - x1), h = 3.2;
      lines += `<path d="M${x1} ${y1}L${x2} ${y2}M${x2 - h * Math.cos(a - 0.6)} ${y2 - h * Math.sin(a - 0.6)}L${x2} ${y2}L${x2 - h * Math.cos(a + 0.6)} ${y2 - h * Math.sin(a + 0.6)}"/>`;
    }
  }
  let sq = '';
  for (let r = 0; r < D; r++) for (let c = 0; c < D; c++) sq += `<rect class="${(r + c) % 2 ? 'dk' : ''}" x="${c * 10}" y="${r * 10}" width="10" height="10"/>`;
  const dots = [...marks].map(([k, o]) => {
    const [x, y] = at(...k.split(',').map(Number));
    return o.move && o.cap ? `<circle class="any" cx="${x}" cy="${y}" r="2.6"/>` : o.move ? `<circle class="mv" cx="${x}" cy="${y}" r="2.4"/>`
      : `<path class="cp" d="M${x - 2.4} ${y - 2.4}l4.8 4.8m0-4.8l-4.8 4.8"/>`;
  }).join('');
  const [cx, cy] = at(0, 0);
  return `<svg class="diagram" viewBox="-1 -1 ${D * 10 + 2} ${D * 10 + 2}" aria-hidden="true"><g class="sqs">${sq}</g><g class="lines">${lines}</g><rect class="me" x="${cx - 4}" y="${cy - 4}" width="8" height="8" rx="2"/>${dots}</svg>`;
}
const card = (t, i) => `<div class="card${t.king ? ' king' : ''}" data-t="${i}"><div class="card-head">${pieceSvg(t, 1)}${pieceSvg(t, -1)}<b>${esc(NAME[t.look])}</b>${t.king ? `<small>${T('King')}</small>` : ''}</div>${diagram(t.rules)}</div>`;

// ---------- state ----------
// G.b = the board now; G.log = every move so far, yours and its in turn; G.units[i] = the piece element on square i.
// G.busy while the computer thinks; G.out when it has beaten you (undo or restart to go on).
const sqName = (i) => 'abcdefgh'[i % G.p.N] + (G.p.N - Math.floor(i / G.p.N));
const replay = (log) => log.reduce((b, m) => play(b, m), G.p.board);

function startLevel(G, save) {
  const p = generate(hash(G.key), G.pack);
  // a save is the move list: it must replay legally, you and the computer in turn (null: a pass, only with no move), with the game still on
  let ok = Array.isArray(save.log), b = p.board;
  if (ok) for (const [k, m] of save.log.entries()) {
    const side = k % 2 ? -1 : 1, legal = moves(p, b, side);
    if (lost(p, b, 1) || lost(p, b, -1) || (m === null ? legal.length : !Array.isArray(m) || !legal.some((x) => x[0] === m[0] && x[1] === m[1]))) { ok = false; break; }
    b = play(b, m);
  }
  if (ok && lost(p, b, -1)) ok = false;
  const log = ok ? save.log.slice(0, save.log.length & ~1) : []; // it replies again to a move saved mid-thought
  Object.assign(G, { p, log, b: null, sel: null, cur: p.N * (p.N - 1), kbd: false, busy: false, out: null, tok: null, note: null });
  G.b = replay(log);

  $('#g-sub').textContent = `${p.N}×${p.N} · ` + T(p.K === 1 ? 'Win in 1 move' : 'Win in {k} moves', { k: p.K });
  $('#cards').innerHTML = p.types.map(card).join('');
  const b0 = $('#board');
  b0.classList.remove('solved', 'lost');
  b0.style.setProperty('--n', p.N);
  b0.replaceChildren(...Array.from({ length: p.N * p.N }, (_, i) => {
    const s = document.createElement('div');
    s.className = 'sq' + ((Math.floor(i / p.N) + (i % p.N)) % 2 ? ' dk' : '');
    s.dataset.i = i;
    s.style.setProperty('--d', (Math.floor(i / p.N) + (i % p.N)) * 30 + 'ms');
    return s;
  }));
  drawUnits();
  checkOut();
  refresh();
  youPass(); // saved just as you were stuck
  return ok || !Object.keys(save).length;
}

// The goal, under the board
const goal = () => T(G.p.king[1] ? 'Take the enemy <b>king</b>, or every enemy piece.' : 'Take <b>every</b> enemy piece.');
function tipText() {
  const t = $('#tip');
  delete t.dataset.warn;
  if (G.out) { t.dataset.warn = 1; t.innerHTML = G.out; }
  else if (G.busy) t.innerHTML = T('Thinking…');
  else if (G.note) t.innerHTML = G.note;
  else t.innerHTML = (G.date && !G.log.length ? T(`Today's ${TIERS[G.pack].toLowerCase()} puzzle. A new one tomorrow.`) + ' ' : '') + goal();
}

// Every piece as its own element, so a move can slide it across
function drawUnits() {
  for (const u of $('#board').querySelectorAll('.unit')) u.remove();
  G.units = G.b.map((x, i) => (x ? addUnit(x, i) : null));
}
function addUnit(x, i) {
  const u = document.createElement('div');
  u.className = 'unit';
  u.innerHTML = pieceSvg(G.p.types[Math.abs(x) - 1], x);
  place(u, i);
  $('#board').append(u);
  return u;
}
const place = (u, i) => { u.style.setProperty('--r', Math.floor(i / G.p.N)); u.style.setProperty('--c', i % G.p.N); };

function refresh() {
  const { p, b } = G, mine = G.sel === null ? [] : moves(p, b, 1).filter((m) => m[0] === G.sel).map((m) => m[1]);
  const last = G.log.at(-1) || [];
  $('#board').querySelectorAll('.sq').forEach((s, i) => {
    s.classList.toggle('sel', i === G.sel);
    s.classList.toggle('to', mine.includes(i) && !b[i]);
    s.classList.toggle('take', mine.includes(i) && !!b[i]);
    s.classList.toggle('last', last.includes(i));
    s.classList.toggle('cur', G.kbd && i === G.cur && !G.done);
  });
  const t = G.sel === null ? -1 : Math.abs(b[G.sel]) - 1;
  $('#cards').querySelectorAll('.card').forEach((c, i) => c.classList.toggle('on', i === t));
  const count = (side) => b.filter((x) => x * side > 0).length;
  $('#board').setAttribute('aria-label', T('Alien Chess board, {n} by {n}. You have {a} pieces, the computer {b}.', { n: p.N, a: count(1), b: count(-1) }));
  $('#btn-undo').disabled = !G.log.length || G.done;
  $('#btn-reset').disabled = !G.log.length || G.done;
  tipText();
}

// A move on the board: the piece slides, a taken piece pops off
function apply(m) {
  G.log.push(m);
  if (!m) return; // a pass
  const [f, t] = m, u = G.units[f], gone = G.units[t];
  if (gone) { gone.classList.add('gone'); setTimeout(() => gone.remove(), 400); }
  G.units[t] = u;
  G.units[f] = null;
  place(u, t);
  u.style.zIndex = 3;
  setTimeout(() => (u.style.zIndex = ''), 350);
  G.b = play(G.b, m);
}
const say = (side, [f, t], took) => T(side > 0 ? 'You: {piece} {from} to {to}.' : 'Computer: {piece} {from} to {to}.', { piece: NAME[G.p.types[Math.abs(G.b[t]) - 1].look], from: sqName(f), to: sqName(t) }) + (took ? ' ' + T('Takes a piece.') : '');

// Over without a win: your king or last piece gone, or neither side can move
function checkOut() {
  const { p, b } = G;
  G.out = lost(p, b, 1) ? T(p.king[0] && b.some((x) => x > 0) ? 'Your <b>king</b> fell.' : 'You lost <b>every piece</b>.') + ' ' + T('Undo, or restart.')
    : !moves(p, b, 1).length && !moves(p, b, -1).length ? T('Nobody can move.') + ' ' + T('Undo, or restart.') : null;
  $('#board').classList.toggle('lost', !!G.out);
  return !!G.out;
}

// ---------- moves ----------
function onSquare(i) {
  if (!playing() || G.busy || G.out) return;
  if (G.sel !== null && moves(G.p, G.b, 1).some((m) => m[0] === G.sel && m[1] === i)) return yourMove([G.sel, i]);
  G.sel = G.b[i] > 0 && G.sel !== i ? i : null;
  if (G.sel !== null) sfx.tap();
  refresh();
}

function yourMove(m) {
  const took = !!G.b[m[1]];
  apply(m);
  G.sel = null;
  took ? sfx.good(2) : sfx.place();
  $('#sr').textContent = say(1, m, took);
  G.note = null;
  if (lost(G.p, G.b, -1)) { refresh(); win(); return; }
  theirTurn();
}

// The computer replies after a beat. A side with no legal move passes; you pass for yourself too, and it moves again.
function theirTurn() {
  G.busy = true;
  refresh();
  const tok = (G.tok = {}), live = () => G.tok === tok && !G.done;
  // a beat to show "Thinking…", then the search (up to ~0.8s on Hard), then whatever is left of a 650ms pause
  setTimeout(() => {
    if (!live()) return;
    const t0 = performance.now(), r = reply(G.p, G.b);
    setTimeout(() => {
      if (!live()) return;
      G.busy = false;
      const took = !!(r && G.b[r[1]]);
      apply(r);
      if (r) took ? sfx.erase() : sfx.tap();
      $('#sr').textContent += ' ' + (r ? say(-1, r, took) : T("The computer can't move, and passes."));
      G.note = r ? null : T("It can't move, so it passes: <b>your turn</b> again.");
      if (checkOut()) { sfx.bad(); flash($('#board'), 'shake'); $('#sr').textContent += ' ' + G.out.replace(/<[^>]+>/g, ''); }
      else if (youPass()) return;
      refresh();
      saveGame();
    }, Math.max(0, 590 - (performance.now() - t0)));
  }, 60);
}
// Stuck (but it isn't): you pass, and it moves again
function youPass() {
  if (G.out || moves(G.p, G.b, 1).length) return false;
  apply(null);
  G.note = T("You can't move, so you pass.");
  $('#sr').textContent += ' ' + G.note.replace(/<[^>]+>/g, '');
  theirTurn();
  return true;
}

// Back to before your last move (and its reply)
function undo() {
  if (!playing() || !G.log.length) return;
  G.tok = null;
  G.busy = false;
  let n = (G.log.length - 1) & ~1; // your last turn; if you passed then, the move before
  while (n >= 2 && G.log[n] === null) n -= 2;
  G.log = G.log.slice(0, n);
  back();
}
function reset() {
  if (!playing() || !G.log.length) return;
  G.tok = null;
  G.busy = false;
  G.log = [];
  back();
}
function back() {
  G.b = replay(G.log);
  G.sel = null;
  G.note = null;
  drawUnits();
  checkOut();
  sfx.erase();
  refresh();
  saveGame();
}

// Gave up: the board goes back to the start and the winning line plays itself out, the computer replying as ever
function reveal() {
  const tok = (G.tok = {});
  G.busy = false;
  G.log = [];
  G.b = G.p.board.slice();
  G.sel = null;
  G.out = null;
  $('#board').classList.remove('lost');
  drawUnits();
  refresh();
  let k = G.p.K;
  const step = (you) => setTimeout(() => {
    if (G.tok !== tok) return;
    const m = you ? winning(G.p, G.b, k)[0] : reply(G.p, G.b);
    if (!m && you) return;
    apply(m); // the computer may pass
    if (m) sfx.place();
    refresh();
    if (!you) k--;
    if (!lost(G.p, G.b, -1)) step(!you);
    else $('#board').classList.add('solved');
  }, 800);
  step(true);
}

// ---------- input ----------
$('#board').addEventListener('click', (e) => {
  const s = e.target.closest('.sq');
  if (!s) return;
  G.kbd = false;
  onSquare(+s.dataset.i);
});
$('#board').addEventListener('focus', () => { if (playing() && $('#board').matches(':focus-visible')) { G.kbd = true; refresh(); } });
$('#cards').addEventListener('click', (e) => { // a card shows where its pieces stand
  const c = e.target.closest('.card');
  if (!c) return;
  const t = +c.dataset.t;
  G.units.forEach((u, i) => u && Math.abs(G.b[i]) - 1 === t && flash(u, 'pop'));
});

function onKey(e) {
  const N = G.p.N, moves4 = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
  if (moves4[e.key]) {
    const r = Math.max(0, Math.min(N - 1, Math.floor(G.cur / N) + moves4[e.key][0]));
    const c = Math.max(0, Math.min(N - 1, (G.cur % N) + moves4[e.key][1]));
    G.cur = r * N + c;
    G.kbd = true;
    const x = G.b[G.cur];
    $('#sr').textContent = sqName(G.cur) + ': ' + (x ? T(x > 0 ? 'your {piece}' : 'enemy {piece}', { piece: NAME[G.p.types[Math.abs(x) - 1].look] }) : T('empty'));
    refresh();
  } else if ((e.key === ' ' || e.key === 'Enter') && document.activeElement?.tagName !== 'BUTTON') { G.kbd = true; onSquare(G.cur); }
  else if (e.key === 'Backspace' || e.key === 'z' || e.key === 'Z' || e.key === 'u' || e.key === 'U') undo();
  else return false;
  return true;
}

$('#btn-undo').onclick = undo;
$('#btn-reset').onclick = reset;

// Home logo: a crowned Bloorp; help: a sample card
$('#logo').innerHTML = pieceSvg({ look: 0, king: true }, -1);
$('#help-card').innerHTML = card({ look: 1, king: false, rules: [{ k: 'slide', v: [[-1, -1], [-1, 1]], n: 9, m: 'any' }, { k: 'leap', v: [[-2, 0], [2, 0]], m: 'move' }, { k: 'slide', v: [[0, -1], [0, 1]], n: 1, m: 'cap' }] });

boot({ name: T('Alien Chess'), storeKey: 'alienchess', random: true, winDelay: 1300, glyphs: ['♞', '♛', '★'], start: startLevel,
  save: (G) => ({ log: G.log }), key: onKey, reveal,
  stars: (G) => { const [a, b] = STAR_TIME[G.pack]; return G.elapsed <= a ? 3 : G.elapsed <= b ? 2 : 1; } });
