'use strict';
// Small Fry: get the fry out of the tank. Pick an item from the tray and put it where a fish is looking; after each one the fish
// act (each swims for what it sees and wants), then you place the next. Rules and levels: gen.js (the global Fry), levels.js.

const CELL = 10, CROP = 5, SVGNS = 'http://www.w3.org/2000/svg';
const TICK_MS = 280, FAST_MS = 70;
const DR = Fry.DR, DC = Fry.DC;
const ITEM = { '/': T('mirror'), '\\': T('mirror'), F: T('flat mirror'), B: T('bait') };
const skey = (t, at) => t + '@' + at;

// ---------- drawing ----------
// One SVG in cell units ×10: water, rock, the exit, bolted and placed items, the looks (dotted), the fish, and the spots the
// picked item can go (when one is picked).
const cx = (c, W) => (c % W + .5) * CELL, cy = (c, W) => (Math.floor(c / W) + .5) * CELL;
// A fish facing right, its middle at (0, 0), about a cell long at scale 1: body, tail, fin, eye
const FISH = '<path class="tail" d="M-2.6 0L-4.9-2.6Q-4.3 0-4.9 2.6Z"/><path class="body" d="M-3 0C-1.6-3 2-3.4 4.4-.6Q4.9 0 4.4.6C2 3.4-1.6 3-3 0Z"/>' +
  '<path class="fin" d="M-.4-2.1Q.6-3.6 1.8-2.4"/><circle class="eye" cx="2.4" cy="-.7" r=".75"/><circle class="pupil" cx="2.65" cy="-.7" r=".35"/>';
const SPEED = '<path class="speed" d="M-6.2-1.6h-2M-6.6 0h-2.6M-6.2 1.6h-2"/>';
const scaleOf = (s) => (s === 1 ? 0.66 : 0.84 + (s - 2) * 0.05);
const ORIENT = ['rotate(-90)', '', 'rotate(90)', 'scale(-1 1)'];
const bait = (x, y) => `<g class="bait" transform="translate(${x} ${y})"><path d="M-2.6 1.2Q-1.6-1.6 0 .2T2.6-.6"/><circle cx="2.7" cy="-.7" r=".6"/></g>`;
function itemSvg(t, c, W, cls = '') {
  if (t === 'B') return `<g class="${cls}">${bait(cx(c, W), cy(c, W))}</g>`;
  if (t === 'F') {
    const cell = c >> 2, d = c & 3, x = cx(cell, W) + DC[d] * 4.4, y = cy(cell, W) + DR[d] * 4.4, h = d % 2 ? 0 : 1;
    return `<line class="mirror flat ${cls}" x1="${x - h * 4}" y1="${y - (1 - h) * 4}" x2="${x + h * 4}" y2="${y + (1 - h) * 4}"/>`;
  }
  const x = (c % W) * CELL, y = Math.floor(c / W) * CELL, [a, b] = t === '/' ? [[1.6, 8.4], [8.4, 1.6]] : [[1.6, 1.6], [8.4, 8.4]];
  return `<g class="${cls}"><line class="mirror" x1="${x + a[0]}" y1="${y + a[1]}" x2="${x + b[0]}" y2="${y + b[1]}"/>` +
    (cls.includes('fixed') ? `<circle class="bolt" cx="${x + a[0]}" cy="${y + a[1]}" r=".8"/><circle class="bolt" cx="${x + b[0]}" cy="${y + b[1]}" r=".8"/>` : '') + '</g>';
}
// an item in the tray
const trayIcon = (t) => ({ '/': '<line class="mirror" x1="1.6" y1="8.4" x2="8.4" y2="1.6"/>', '\\': '<line class="mirror" x1="1.6" y1="1.6" x2="8.4" y2="8.4"/>',
  F: '<path class="rockbit" d="M0 7.4h10V10H0z"/><line class="mirror flat" x1="1.4" y1="6.6" x2="8.6" y2="6.6"/>', B: bait(5, 5) })[t];
// a placed item's order, a small tag by it
function orderTag(t, at, n, W) {
  const c = t === 'F' ? at >> 2 : at, d = t === 'F' ? at & 3 : -1;
  const x = cx(c, W) + (d < 0 ? 3.2 : -DC[d] * 2.2), y = cy(c, W) + (d < 0 ? 3.4 : -DR[d] * 2.2);
  return `<g class="tag"><circle cx="${x}" cy="${y}" r="1.9"/><text x="${x}" y="${y + .75}">${n}</text></g>`;
}

// The tank: everything that doesn't move. Rock cells merge into one mass; a rock with water above gets a sandy top.
function tankSvg(L) {
  const W = L.W, g = L.grid, S = CELL * W;
  let rock = '', sand = '', exit = '';
  for (let c = 0; c < W * W; c++) {
    const x = (c % W) * CELL, y = Math.floor(c / W) * CELL;
    if (g[c] === '#') {
      rock += `M${x - .3} ${y - .3}h10.6v10.6h-10.6z`;
      if (c >= W && g[c - W] === '.') sand += `M${x - .2} ${y}h10.4v1.6q-5.2 1.2-10.4 0z`;
    } else if (g[c] === 'X') {
      const d = c < W ? 0 : c >= W * (W - 1) ? 2 : c % W === 0 ? 3 : 1, mx = x + 5, my = y + 5;
      exit = `<g class="exit"><rect x="${x}" y="${y}" width="10" height="10"/><circle cx="${mx - DC[d] * 3}" cy="${my - DR[d] * 3}" r="6"/>` +
        `<path transform="translate(${mx - DC[d] * 2.4} ${my - DR[d] * 2.4}) rotate(${[0, 90, 180, 270][d]})" d="M-2.4 1.4L0-1.2L2.4 1.4"/></g>`;
    }
  }
  return `<defs><linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="w0"/><stop offset="1" class="w1"/></linearGradient>` +
    `<clipPath id="tank"><rect x="${CROP}" y="${CROP}" width="${S - 2 * CROP}" height="${S - 2 * CROP}" rx="5"/></clipPath></defs>` +
    `<g clip-path="url(#tank)"><rect class="water" width="${S}" height="${S}" fill="url(#water)"/>${exit}<path class="rock" d="${rock}"/><path class="sand" d="${sand}"/></g>`;
}

// ---------- state ----------
// G.L: the level. G.states[i]: the tank after the first i placements, once the fish stopped (G.S is the live one). G.placed:
// [type, spot] in order. G.lock: placements a hint made (and everything before them), which undo can't take back.
// G.sel: the picked item type. G.busy: fish are moving. G.fail: 'eaten' | 'loop' | 'stuck' | null. G.moved: fish moved since the
// last placement. G.mistakes: for the stars. G.preview: a spot shown as if placed (hover, or a first tap on touch).
const TUTORIAL = Fry.parse('7|' + ['###X###', '#.....#', '#.0...#', '#.....#', '#.....#', '#..2..#', '#######'].join('') + '|16.1.1,38.1.2||/|/@17');
const levelOf = (G) => {
  if (G.tut) return TUTORIAL;
  if (G.date) {
    const i = Math.round((Date.parse(G.date) - Date.parse(DAILY.from)) / 864e5), l = DAILY[G.pack]?.[i];
    if (l) return Fry.parse(l);
    // past the dailies built: a pack level picked by the date (build-levels.js makes more)
    const pack = LEVELS[G.pack] || LEVELS.H;
    return Fry.parse(pack[hash(G.key) % pack.length]);
  }
  return Fry.parse(LEVELS[G.pack][G.n - 1]);
};
const left = () => { const c = {}; for (const t of G.L.items) c[t] = (c[t] || 0) + 1; for (const [t] of G.placed) c[t]--; return c; };
const itemsLeft = () => G.L.items.length - G.placed.length;

function startLevel(G, save) {
  const L = levelOf(G), S0 = Fry.initial(L);
  runId++; // a swim still going on the last level stops
  Object.assign(G, { L, S: Fry.clone(S0), states: [S0], placed: [], lock: 0, sel: null, busy: false, fail: null, moved: false, mistakes: 0, preview: null, kspot: -1 });
  let ok = true;
  if (Array.isArray(save.placed)) {
    // replay the saved placements: the fish do what they did
    for (const p of save.placed) {
      if (!Array.isArray(p) || !(p[0] in ITEM) || !Fry.canPlace(L, G.S, p[0], p[1]) || G.fail || left()[p[0]] <= 0) { ok = false; break; }
      Fry.place(G.S, p[0], p[1]);
      G.placed.push([p[0], p[1]]);
      const r = Fry.run(L, G.S);
      if (r === 'lose') G.fail = 'eaten'; else if (r === 'loop') G.fail = 'loop'; else if (r === 'win') { ok = false; break; }
      else if (!itemsLeft()) G.fail = 'stuck';
      G.states.push(Fry.clone(G.S));
    }
    if (!ok) { G.S = Fry.clone(S0); G.states = [S0]; G.placed = []; G.fail = null; }
    else {
      G.mistakes = +save.mistakes || 0;
      G.lock = Math.min(+save.lock || 0, G.placed.length);
      G.hinted = new Set(Array.from({ length: +save.hints || 0 }, (_, i) => i));
      G.moved = !!G.fail;
    }
  }
  G.sel = G.tut ? null : firstLeft();
  const b = $('#board');
  b.classList.remove('solved', 'failed');
  b.innerHTML = `<svg class="tank" viewBox="${CROP} ${CROP} ${L.W * CELL - 2 * CROP} ${L.W * CELL - 2 * CROP}" xmlns="${SVGNS}" aria-hidden="true">${tankSvg(L)}<g class="items"></g><g class="looks"></g><g class="spots"></g><g class="fishes"></g></svg>`;
  G.fishEls = L.fish.map((f) => {
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', `fish${f.s === 1 ? ' fry' : ' pred s' + f.s}${f.f ? ' fast' : ''}`);
    g.innerHTML = `<g class="o"><g transform="scale(${scaleOf(f.s)})">${FISH}${f.f ? SPEED : ''}</g></g>` + (f.s > 1 ? `<text class="size" x="-1" y="1.1">${f.s}</text>` : '');
    b.querySelector('.fishes').append(g);
    return g;
  });
  $('#tray').replaceChildren(...L.items.map((t, i) => {
    const s = document.createElement('button');
    s.className = 'slot';
    s.dataset.type = t;
    s.innerHTML = `<svg viewBox="0 0 10 10" aria-hidden="true">${trayIcon(t)}</svg>`;
    return s;
  }));
  $('#btn-hint').hidden = IMP || !!G.tut;
  tip(G.fail ? failText() : G.date ? T('Today\'s puzzle. A new one tomorrow.') : !G.tut && G.pack === 'E' && G.n === 1 ? FIRST_TIP : '');
  draw();
  return ok;
}
const FIRST_TIP = T('Rays show where each fish looks. Put a <b>mirror</b> where the fry looks, to show it the <b>exit</b>.');
const firstLeft = () => { const c = left(); return G.L.items.find((t) => c[t] > 0) ?? null; };
function tip(html, warn = false) {
  $('#tip').innerHTML = html;
  $('#tip').toggleAttribute('data-warn', warn);
}
const failText = () => ({ eaten: T('<b>Eaten!</b> Undo and try another way.'), loop: T('<b>Going in circles.</b> Undo and try another way.'),
  stuck: T('<b>Stuck:</b> every item is placed, and the fry is still in. Undo and try another way.') })[G.fail];

// The board as it stands: items, looks (or the preview's), spots for the picked item, fish where they are
function draw() {
  const { L } = G, W = L.W, svg = $('#board .tank'), S = G.S;
  let items = '';
  for (const [c, m] of L.mir) items += itemSvg(m, c, W, 'fixed');
  G.placed.forEach(([t, at], i) => { if (t !== 'B' || S.bait[at]) items += itemSvg(t, at, W, i < G.lock ? 'placed locked' : 'placed') + orderTag(t, at, i + 1, W); }); // eaten bait is gone
  if (G.preview !== null && G.sel) items += itemSvg(G.sel, G.preview, W, 'ghost');
  svg.querySelector('.items').innerHTML = items;
  // looks: from the tank as it is, or as it would be with the preview placed
  const V = G.preview !== null && G.sel ? Fry.clone(S) : S;
  if (V !== S) Fry.place(V, G.sel, G.preview);
  const occ = Fry.occupancy(L, V);
  svg.querySelector('.looks').innerHTML = G.done && S.out ? '' : V.fish.map((f, i) => {
    if (!f.a) return '';
    const pts = [], v = Fry.look(L, V, i, occ, pts), wants = v.t >= 0;
    if (pts.length < 2) return '';
    const d = 'M' + pts.map(([x, y]) => `${(x * CELL).toFixed(1)} ${(y * CELL).toFixed(1)}`).join('L');
    return `<path class="look${f.s === 1 ? ' fry' : ''}${wants ? ' wants' : ''}" d="${d}"/>`;
  }).join('');
  // spots
  let spots = '';
  if (G.sel && !G.busy && !G.fail && !G.done) {
    G.spotList = Fry.spots(L, S, G.sel);
    for (const at of G.spotList) {
      const k = G.spotList[G.kspot] === at ? ' kbd' : '';
      if (G.sel === 'F') {
        const c = at >> 2, d = at & 3, x = cx(c, W) + DC[d] * 4.4, y = cy(c, W) + DR[d] * 4.4, h = d % 2 ? 0 : 1;
        spots += `<g class="spot face${k}" data-spot="${at}"><rect class="hit" x="${x - (h ? 5 : 3)}" y="${y - (h ? 3 : 5)}" width="${h ? 10 : 6}" height="${h ? 6 : 10}"/>` +
          `<line x1="${x - h * 3.6}" y1="${y - (1 - h) * 3.6}" x2="${x + h * 3.6}" y2="${y + (1 - h) * 3.6}"/></g>`;
      } else spots += `<g class="spot${k}" data-spot="${at}"><rect class="hit" x="${(at % W) * CELL}" y="${Math.floor(at / W) * CELL}" width="10" height="10"/><circle cx="${cx(at, W)}" cy="${cy(at, W)}" r="1.3"/></g>`;
    }
  } else G.spotList = [];
  svg.querySelector('.spots').innerHTML = spots;
  S.fish.forEach((f, i) => placeFish(i, f));
  refresh();
}
function placeFish(i, f) {
  const el = G.fishEls[i], W = G.L.W;
  el.style.transform = `translate(${cx(f.p, W)}px, ${cy(f.p, W)}px)`;
  el.querySelector('.o').setAttribute('transform', ORIENT[f.d]);
  el.classList.toggle('gone', !f.a);
}

function refresh() {
  const c = left();
  $('#tray').querySelectorAll('.slot').forEach((s, i) => {
    // of a type's slots, the first ones are the ones still in hand
    const t = s.dataset.type, before = G.L.items.slice(0, i).filter((x) => x === t).length, used = before >= c[t];
    s.classList.toggle('used', used);
    s.setAttribute('aria-pressed', String(!used && before === 0 && t === G.sel && !G.done && !G.fail));
    s.disabled = G.done || used || G.busy || !!G.fail;
    s.setAttribute('aria-label', (used ? T('{item}, placed', { item: ITEM[t] }) : ITEM[t]) + (t === '/' || t === '\\' ? ' ' + t : ''));
  });
  $('#tray').classList.toggle('busy', G.busy);
  $('#btn-undo').disabled = G.done || G.placed.length <= G.lock;
  $('#btn-reset').disabled = G.done || G.placed.length <= G.lock;
  $('#btn-hint').disabled = G.done || G.busy;
  $('#btn-fast').hidden = !G.busy;
  $('#btn-fast').setAttribute('aria-pressed', String(!!G.ff));
  $('#board').classList.toggle('busy', G.busy);
  $('#board').classList.toggle('failed', !!G.fail);
  $('#board').classList.toggle('aiming', !!G.sel && !G.busy && !G.fail && !G.done);
  $('#g-sub').textContent = G.tut ? '' : T('{n} of {k} placed', { n: G.placed.length, k: G.L.items.length });
  const alive = G.S.fish.filter((f, i) => i && f.a).length;
  $('#board').setAttribute('aria-label', T('Small Fry tank, {w} by {w}. {p} predators. {n} items left.', { w: G.L.W - 2, p: alive, n: itemsLeft() }));
}

// ---------- moves ----------
function choose(t) {
  if (!playing() || G.busy || G.fail || !t || !(left()[t] > 0) || !coachAllows({ pick: t })) return;
  G.sel = t;
  G.preview = null;
  G.kspot = -1;
  sfx.tap();
  draw();
}

function placeAt(at) {
  const t = G.sel;
  if (!playing() || G.busy || G.fail || !t || !(left()[t] > 0) || !Fry.canPlace(G.L, G.S, t, at)) return;
  if (!coachAllows({ t, at })) { G.preview = null; draw(); return; }
  Fry.place(G.S, t, at);
  G.placed.push([t, at]);
  G.preview = null;
  G.kspot = -1;
  G.moved = false;
  sfx.place();
  $('#sr').textContent = T('{item} placed.', { item: ITEM[t] });
  if (!(left()[t] > 0)) G.sel = firstLeft();
  tip('');
  swim();
}

// The fish act: tick after tick, each one shown swimming, until nobody sees anything they want
let runId = 0; // the swim in progress: anything that ends it (undo, another level) moves this on
const wait = (ms) => new Promise((done) => {
  let t = 0;
  const step = () => { if (!G.paused && !document.hidden) t += 40; if (t >= ms) done(); else setTimeout(step, 40); };
  setTimeout(step, 40);
});
async function swim() {
  const run = ++runId, seen = new Set(), L = G.L;
  G.busy = true;
  draw();
  for (;;) {
    const key = Fry.fishKey(G.S) + '/' + G.S.nb;
    if (seen.has(key)) return settle('loop');
    seen.add(key);
    const t = Fry.tick(L, G.S);
    if (!t.moved.length) return settle('stop');
    G.moved = true;
    const ms = G.ff ? FAST_MS : TICK_MS, calm = document.documentElement.hasAttribute('data-calm');
    t.moved.forEach((i, k) => {
      const el = G.fishEls[i], f = G.S.fish[i];
      el.querySelector('.o').setAttribute('transform', ORIENT[f.d]);
      if (!calm) el.animate(t.paths[k].map((c) => ({ transform: `translate(${cx(c, L.W)}px, ${cy(c, L.W)}px)` })), { duration: ms, easing: 'linear' });
      el.style.transform = `translate(${cx(f.p, L.W)}px, ${cy(f.p, L.W)}px)`;
    });
    for (const i of t.eaten) { G.fishEls[i].classList.add('gone'); }
    if (t.eaten.length && !t.lost) sfx.erase();
    $('#board .looks').innerHTML = '';
    await wait(ms);
    if (run !== runId) return; // undone, or another level started
    if (t.lost) return settle('lose');
    if (t.won) return settle('win');
    draw();
  }
}
function settle(res) {
  G.busy = false;
  G.states.push(Fry.clone(G.S));
  if (res === 'win') { draw(); $('#board').classList.add('solved'); win(); return; }
  if (res === 'lose') fail('eaten');
  else if (res === 'loop') fail('loop');
  else if (!itemsLeft()) fail('stuck');
  else { draw(); saveGame(); }
}
function fail(kind) {
  G.fail = kind;
  if (!G.tut) G.mistakes++;
  sfx.bad();
  tip(failText(), true);
  draw();
  flash($('#btn-undo'), 'psst');
  saveGame();
}

// Back to the tank after the first k placements. A fish move undone (no failure counted for it) costs a mistake.
function rewind(k) {
  if (G.moved && !G.fail && !G.tut) G.mistakes++;
  runId++;
  G.busy = false;
  G.S = Fry.clone(G.states[k]);
  G.states.length = k + 1;
  G.placed.length = k;
  G.fail = null;
  G.moved = false;
  G.preview = null;
  G.kspot = -1;
  G.sel = G.sel && left()[G.sel] > 0 ? G.sel : firstLeft();
  for (const el of G.fishEls) el.getAnimations().forEach((a) => a.cancel());
  tip('');
}
function undo() {
  if (!playing() || !coachAllows({ undo: true })) return;
  if (G.busy) rewind(G.placed.length - 1); // mid-swim: back before the placement that set them off
  else if (G.placed.length > G.lock) rewind(G.placed.length - 1);
  else return;
  sfx.erase();
  draw();
  saveGame();
}
async function reset() {
  if (!playing() || G.placed.length <= G.lock || !coachAllows({ reset: true })) return;
  if (!(await ask(T('Restart this level? Every item you placed comes back to the tray.')))) return;
  rewind(G.lock);
  sfx.erase();
  draw();
  saveGame();
}

// A hint: back to the last point where everything placed is part of the answer (and the rest can still follow), then one more
// item from the answer, placed and locked. Each costs a star.
function hint() {
  if (!playing() || G.busy || IMP || !coachAllows({ hint: true })) return;
  const { L } = G, ans = new Set(L.sol.map(([t, at]) => skey(t, at)));
  for (let k = G.placed.length; k >= G.lock; k--) {
    const pre = G.placed.slice(0, k);
    if (!pre.every(([t, at]) => ans.has(skey(t, at)))) continue;
    const rest = L.sol.filter(([t, at]) => !pre.some((p) => skey(...p) === skey(t, at)));
    const order = rest.length ? finish(pre, rest) : null;
    if (!order) continue;
    G.moved = false; // backing up for a hint costs the hint's star, not a mistake too
    if (k < G.placed.length || G.fail) rewind(k);
    G.hinted.add(G.hinted.size);
    G.lock = k + 1;
    G.sel = order[0][0];
    sfx.hint();
    track('hint');
    placeAt(order[0][1]);
    return;
  }
}
// an order of `rest` that wins after `pre` (all orders tried: at most 6! = 720 replays)
function finish(pre, rest) {
  const perm = (a) => (a.length < 2 ? [a] : a.flatMap((x, i) => perm([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
  return perm(rest).find((o) => Fry.replay(G.L, [...pre, ...o]) === 'win');
}

// ---------- input ----------
$('#tray').addEventListener('click', (e) => { const s = e.target.closest('.slot'); if (s) { G.kspot = -1; choose(s.dataset.type); } });
// Mouse: hovering a spot previews the looks with the item there; a click places it. Touch: the first tap previews, the second places.
$('#board').addEventListener('pointerover', (e) => {
  const s = e.target.closest('[data-spot]');
  if (e.pointerType !== 'mouse' || !s || !playing() || G.busy) return;
  if (G.preview !== +s.dataset.spot) { G.preview = +s.dataset.spot; draw(); }
});
$('#board').addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && G?.preview != null) { G.preview = null; draw(); } });
$('#board').addEventListener('click', (e) => {
  const s = e.target.closest('[data-spot]');
  if (!s || !playing() || G.busy) return;
  const at = +s.dataset.spot;
  if (G.preview === at || G.lastPointer === 'mouse') placeAt(at);
  else { G.preview = at; sfx.tap(); draw(); }
});
$('#board').addEventListener('pointerdown', (e) => { if (G) G.lastPointer = e.pointerType; });

// Keyboard: 1–9 pick an item from the tray, arrows step through the spots it can go, Enter or Space places it, U / Z / Backspace undo
function onKey(e) {
  const slots = [...$('#tray').querySelectorAll('.slot')];
  if (/^[1-9]$/.test(e.key) && +e.key <= slots.length) { G.kspot = -1; choose(slots[+e.key - 1].dataset.type); return true; }
  if (/^Arrow/.test(e.key) && G.spotList.length) {
    const n = G.spotList.length, d = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
    G.kspot = G.kspot < 0 ? (d > 0 ? 0 : n - 1) : (G.kspot + d + n) % n;
    G.preview = G.spotList[G.kspot];
    sfx.tap();
    draw();
    const at = G.preview, W = G.L.W, c = G.sel === 'F' ? at >> 2 : at;
    $('#sr').textContent = T('Row {r}, column {c}', { r: Math.floor(c / W), c: c % W });
    return true;
  }
  if ((e.key === 'Enter' || e.key === ' ') && G.kspot >= 0 && document.activeElement?.tagName !== 'BUTTON') { placeAt(G.spotList[G.kspot]); return true; }
  if (/^(u|U|z|Z|Backspace|Delete)$/.test(e.key)) { undo(); return true; }
  if (e.key === 'f' || e.key === 'F') { $('#btn-fast').click(); return true; }
  return false;
}

$('#btn-undo').onclick = undo;
$('#btn-reset').onclick = reset;
$('#btn-hint').onclick = hint;
$('#btn-fast').onclick = () => { if (G) { G.ff = !G.ff; refresh(); } };

// ---------- the menu's fish ----------
{
  const fish = (cls, s, x, y, t = '') => `<g class="fish ${cls}" transform="translate(${x} ${y})${t}"><g transform="scale(${scaleOf(s) * 2.2})">${FISH}</g></g>`;
  $('#logo').innerHTML = `<svg viewBox="0 0 96 64" aria-hidden="true"><path class="look fry wants" d="M30 40H70"/>${fish('pred s4', 4, 66, 22, ' scale(-1 1)')}${fish('fry', 1, 26, 40)}</svg>`;
}

// Tutorial: the fry looks right, at rock; a / on the ringed cell turns its look up to the exit overhead.
const tutSpot = () => $('#board .spot[data-spot="17"]') || $('#board .tank');
boot({ name: T('Small Fry'), storeKey: 'smallfry', glyphs: ['🐟', '◆'], start: startLevel, ownIntro: false,
  tutorial: [
    [T('Each fish looks only straight ahead: the dotted lines show where. The fry (orange) is looking at rock. Pick the <b>mirror</b> below.'),
      () => G.sel === '/', () => $('#tray .slot'), (m) => m.pick === '/'],
    [T('Items go only where a fish is looking. Tap the ringed spot (once to see how the looks bend, again to place it): the fry will see the <b>exit</b> and swim for it.'),
      null, tutSpot, (m) => m.at === 17 || m.pick === '/'],
  ],
  save: (G) => ({ placed: G.placed, mistakes: G.mistakes, hints: G.hinted.size, lock: G.lock }), key: onKey,
  stars: (G) => Math.max(1, (G.mistakes === 0 ? 3 : G.mistakes <= 2 ? 2 : 1) - G.hinted.size),
  reveal: () => {
    runId++;
    G.busy = false;
    G.fail = null;
    G.S = Fry.initial(G.L);
    G.placed = [];
    for (const [t, at] of G.L.sol) { Fry.place(G.S, t, at); G.placed.push([t, at]); Fry.run(G.L, G.S); }
    G.lock = G.placed.length;
    G.sel = null;
    G.preview = null;
    draw();
  } });
game.impossible = { stars: game.stars };
