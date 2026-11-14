'use strict';
// Balancing Act: a hanging contraption of beams and plates, and a store of weights (and, on Hard, balloons).
// Drag every item onto a plate (or tap it, then tap a plate) until every beam hangs level. Rules and generator in gen.js.

// A size as the player reads it: balloons lift, so they're negative (−2)
const num = (v) => (v < 0 ? '−' : '') + Math.abs(v);
const itemName = (v) => T(v < 0 ? 'balloon {n}' : 'weight {n}', { n: Math.abs(v) });

// ---------- drawing ----------
// The contraption as one SVG. Every beam's tilt lives in its own group (.tilt, rotated about the pivot), and each end's
// hanger in a counter-rotated one (.untilt), so strings always hang straight down. Plates are numbered left to right.
// MIN_ARM: the shortest an arm is drawn, so its length always has room beside the pivot.
const SLOT = 62, BEAM_DROP = 46, PLATE_DROP = 14, HANG = 50, CW = 24, CH = 18, TILT = 16, SWING = 18, MIN_ARM = 22;

// A weight: a squat bell with a handle, centered on (x, y).
const weight = (v, x, y) => `<g class="it wt"><path class="hd" d="M${x - 4} ${y - 7}a4 3.4 0 0 1 8 0"/><path d="M${x - 8} ${y - 7}h16q2.6 0 3.2 2.6l2.4 9.8q.6 3.6-3 3.6h-21.2q-3.6 0-3-3.6l2.4-9.8q.6-2.6 3.2-2.6z"/><text x="${x}" y="${y + 4.5}">${num(v)}</text></g>`;
// A balloon, its knot at (0, 0) and the rest above it: a rounded teardrop with a shine, its number (negative) on it
const balloon = (v) => `<g transform="scale(1.2)"><path class="bb" d="M0-2C-5-3.5-9.5-8.5-9.5-14.5C-9.5-20.5-5-24.5 0-24.5C5-24.5 9.5-20.5 9.5-14.5C9.5-8.5 5-3.5 0-2Z"/>` +
  `<path class="bk" d="M0-2.4L-2.2 1h4.4z"/><ellipse class="shine" cx="-4.6" cy="-18" rx="1.6" ry="3.2" transform="rotate(28 -4.6 -18)"/><text y="-10.5">${num(v)}</text></g>`;
// A tied-on balloon's bow, where its string meets the pan
const BOW = '<path class="bow" d="M0 0l-3.4-2v4zM0 0l3.4-2v4z"/>';
// For the store, the drag and paper: an item on its own, in a 28 × 25 box around (0, 0)
const token = (v) => (v < 0 ? `<g class="it bal"><g transform="translate(0 10) scale(.74)"><path class="tether" d="M0 0v4.5"/>${balloon(v)}</g></g>` : weight(v, 0, 0));

// Layout: plate i hangs at slot i; a beam's pivot sits between its two hang points, splitting the gap in its arms' ratio
// (so drawn arms are in proportion), but never closer than MIN_ARM to either end. Returns { W, H, svg } (svg: the inner markup).
function layout(p, { mini = false } = {}) {
  const P = p.plates, W = Math.max(P * SLOT, 300), S = W / P, pw = Math.min(S - 10, 62);
  let beamNo = 0, bottom = 0;
  // x of a subtree's hang point, in the page's coordinates. Hang points of a beam's two sides are at least a slot apart.
  const hx = (t) => {
    if (typeof t === 'number') return (t + 0.5) * S;
    const l = hx(t.l), r = hx(t.r);
    return Math.max(l + MIN_ARM, Math.min(r - MIN_ARM, l + ((r - l) * t.a) / (t.a + t.b)));
  };
  // a subtree hanging from local (0, 0), its hang point at page (x, y)
  function sub(t, y) {
    if (typeof t === 'number') {
      bottom = Math.max(bottom, y + PLATE_DROP + HANG + 26);
      return `<line class="str" x1="0" y1="0" x2="0" y2="${PLATE_DROP}"/><g class="plate" data-plate="${t}" transform="translate(0 ${PLATE_DROP})">` +
        `<rect class="hit" x="${-S / 2 + 1}" y="-4" width="${S - 2}" height="${HANG + 26}" rx="8"/>` +
        `<path class="str" d="M0 0L${-pw / 2} ${HANG}M0 0L${pw / 2} ${HANG}"/><circle class="ring" r="2.6"/>` +
        `<path class="pan" d="M${-pw / 2 - 2} ${HANG}h${pw + 4}q-3 7-${pw / 2 + 2} 7t-${pw / 2 + 2}-7z"/><g class="load"></g>` +
        `<text class="tot" y="${HANG + 21}"></text><text class="no" y="${HANG + 21}">${t + 1}</text></g>`;
    }
    const i = beamNo++, x = hx(t), la = hx(t.l) - x, lb = hx(t.r) - x;
    // an arm's end: a plate hangs its own string; a beam hangs BEAM_DROP lower
    const kid = (c, e) => `<g transform="translate(${e} 0)"><g class="untilt">` + (typeof c === 'number' ? sub(c, y)
      : `<line class="str" x1="0" y1="0" x2="0" y2="${BEAM_DROP}"/><g transform="translate(0 ${BEAM_DROP})">${sub(c, y + BEAM_DROP)}</g>`) + '</g></g>';
    // arm lengths above the beam, halfway along: nothing hangs there, and MIN_ARM keeps them clear of the pivot
    return `<g class="tilt" data-beam="${i}" data-reach="${Math.max(-la, lb)}">` +
      `<rect class="beam" x="${la - 3}" y="-3" width="${lb - la + 6}" height="6" rx="3"/>` +
      `<text class="arm" x="${la / 2}" y="-7">${t.a}</text><text class="arm" x="${lb / 2}" y="-7">${t.b}</text>` +
      kid(t.l, la) + kid(t.r, lb) + `<path class="pivot" d="M0 -4l-5 -8h10z"/></g>`;
  }
  const TOP = 8, HOOK = 30, x0 = hx(p.tree);
  const body = `<line class="ceil" x1="${x0 - 30}" y1="${TOP}" x2="${x0 + 30}" y2="${TOP}"/><line class="str" x1="${x0}" y1="${TOP}" x2="${x0}" y2="${TOP + HOOK}"/>` +
    `<g transform="translate(${x0} ${TOP + HOOK})">${sub(p.tree, TOP + HOOK)}</g>`;
  return { W, H: bottom + (mini ? 0 : 24), svg: body };
}

// A plate's load: weights stacked up from the pan two to a row; balloons tied to the pan, floating just above the weights.
// live: the balloons themselves are drawn by the float layer (floats below); here only where each one is tied (.tie, with its
// string's length and its sideways offset). Otherwise they're drawn at rest. box: paper, an empty box to write in (tied-on balloons stay).
const plateWidth = (p) => Math.min(Math.max(p.plates * SLOT, 300) / p.plates - 10, 62);
function load(p, plate, ids, { box = false, live = false } = {}) {
  const pw = plateWidth(p), cols = Math.max(1, Math.floor((pw + 2) / (CW + 2)));
  const bals = [...p.fixed.map((f, k) => ({ v: -f.v, fixed: true, key: 'f' + k, plate: f.plate })).filter((b) => b.plate === plate),
    ...ids.filter((i) => p.items[i].v < 0).map((i) => ({ v: p.items[i].v, i, key: String(i) }))];
  const ws = box ? [] : ids.filter((i) => p.items[i].v > 0), rows = Math.ceil(ws.length / cols);
  let out = box ? `<rect class="wbox" x="${-pw / 2 + 1}" y="${HANG - 44}" width="${pw - 2}" height="42" rx="3"/>` : '';
  out += ws.map((i, k) => {
    const r = Math.floor(k / cols), c = k % cols, n = Math.min(cols, ws.length - r * cols);
    return `<g data-item="${i}">${weight(p.items[i].v, (c - (n - 1) / 2) * (CW + 2), HANG - 1 - CH / 2 - r * (CH + 3))}</g>`;
  }).join('');
  out += bals.map((b, k) => {
    // tied along the pan, spread apart; on paper, in the box's corner, as if already written in
    const ax = box ? pw / 2 - 12 - k * 20 : (k - (bals.length - 1) / 2) * 16, ay = HANG - 1;
    const len = box ? 16 : 12 + rows * (CH + 3), dx = (k - (bals.length - 1) / 2) * 10;
    const bow = b.fixed ? `<g transform="translate(${ax} ${ay})">${BOW}</g>` : '';
    if (live) return `<circle class="tie" r=".5" cx="${ax}" cy="${ay}" data-tie="${b.key}" data-len="${len}" data-dx="${dx}" data-v="${b.v}"${b.fixed ? ' data-fixed=""' : ''}/>${bow}`;
    return `<g class="it bal${b.fixed ? ' fixed' : ''}"><path class="tether" d="M${ax} ${ay}L${ax + dx} ${ay - len}"/>` +
      `<g transform="translate(${ax + dx} ${ay - len})">${balloon(b.v)}</g></g>${bow}`;
  }).join('');
  return out;
}

// Draw p into svg el: at = item placements; level = every beam drawn level (paper, the logo), else each tilts by its imbalance.
// live: the board, its balloons floating on their own layer, on top.
function draw(el, p, at, { level = false, box = false, mini = false, live = false } = {}) {
  const { W, H, svg } = layout(p, { mini });
  el.setAttribute('viewBox', `0 0 ${W} ${H}`);
  el.innerHTML = (live ? '<g class="floats"></g>' : '') + svg; // under the contraption: a balloon never hides an arm's length
  paint(el, p, at, { level, box, live });
}
function paint(el, p, at, { level = false, box = false, live = false } = {}) {
  const m = masses(p, at);
  el.querySelectorAll('.plate').forEach((g) => {
    const k = +g.dataset.plate, ids = at.map((x, i) => (x === k ? i : -1)).filter((i) => i >= 0);
    g.querySelector('.load').innerHTML = load(p, k, ids, { box, live });
    const has = ids.length || p.fixed.some((f) => f.plate === k);
    g.querySelector('.tot').textContent = has && !box ? num(m[k]) : '';
    g.classList.toggle('empty', !has);
  });
  const ts = torques(p.tree, m), bs = beams(p.tree);
  el.querySelectorAll('.tilt').forEach((g) => {
    const t = ts.find((x) => x.beam === bs[+g.dataset.beam]), d = Math.abs(t.left) * t.beam.a + Math.abs(t.right) * t.beam.b;
    // at most TILT, and less on a long beam: its ends never swing more than SWING up or down, clear of the level below
    const max = Math.min(TILT, (Math.asin(Math.min(1, SWING / +g.dataset.reach)) * 180) / Math.PI);
    const deg = level || !d ? 0 : Math.max(-1, Math.min(1, t.torque / d)) * max;
    g.style.transform = `rotate(${deg}deg)`;
    for (const u of g.querySelectorAll(':scope > g > .untilt')) u.style.transform = `rotate(${-deg}deg)`;
    g.classList.toggle('level', !level && t.torque === 0 && t.left !== 0 && t.right !== 0);
  });
}

// ---------- floating balloons ----------
// Each balloon on the board is a little simulation: lift pulls it up, air drag slows it, a soft pull keeps it near its spot above
// the tie, and the string (fixed length) holds it. So when its plate swings down the string jerks it along; when the plate rises,
// the string goes slack and droops while the balloon drifts up again. It leans along a taut string. Reduce motion: always at rest.
const floats = new Map(); // tie key -> { el, plate, p: [x, y] | null, v: [x, y], seed }
const LIFT = 110, DRAG = 2.4, SIDE = 6;
let simAt = 0;
function syncFloats() {
  const rig = $('#board .rig'), layer = rig?.querySelector('.floats');
  if (!layer) return;
  const seen = new Set();
  for (const tie of rig.querySelectorAll('.tie')) {
    const key = tie.dataset.tie, plate = tie.closest('.plate').dataset.plate;
    let f = floats.get(key);
    if (f && f.plate !== plate) { f.el.remove(); f = null; }
    if (!f) {
      const el = document.createElementNS(SVGNS, 'g'), fixed = 'fixed' in tie.dataset;
      el.setAttribute('class', 'it bal float' + (fixed ? ' fixed' : ''));
      if (!fixed) { el.dataset.item = key; el.dataset.on = plate; }
      el.innerHTML = `<path class="tether"/><g>${balloon(+tie.dataset.v)}</g>`;
      layer.append(el);
      f = { el, plate, p: null, v: [0, 0], seed: Math.random() * 6 };
      floats.set(key, f);
    }
    Object.assign(f, { tie, len: +tie.dataset.len, dx: +tie.dataset.dx });
    f.el.classList.toggle('sel', !('fixed' in tie.dataset) && +key === G.sel);
    seen.add(key);
  }
  for (const [k, f] of floats) if (!seen.has(k)) { f.el.remove(); floats.delete(k); }
  if (floats.size && !simAt) simAt = requestAnimationFrame(sim);
}
function sim(now) {
  const rig = $('#board .rig');
  if (!floats.size || !rig?.isConnected) { simAt = 0; return; }
  const dt = Math.min(1 / 30, (now - (sim.last ?? now)) / 1000), calm = document.documentElement.hasAttribute('data-calm');
  sim.last = now;
  const inv = rig.getScreenCTM()?.inverse();
  for (const f of floats.values()) {
    const m = f.tie.getScreenCTM();
    if (!m || !inv) continue;
    const t = new DOMPoint(+f.tie.getAttribute('cx'), +f.tie.getAttribute('cy')).matrixTransform(m).matrixTransform(inv);
    const ax = t.x, ay = t.y, rx = ax + f.dx + (calm ? 0 : Math.sin(now / 1100 + f.seed) * 1.3), ry = ay - f.len;
    if (!f.p || calm) { f.p = [rx, ry]; f.v = [0, 0]; }
    else {
      // The balloon is what lifts its plate: a rising plate is being pulled up by it, so it rises with it, string taut.
      // Sideways it only partly follows, and catches up with a little swing.
      if (f.a) { f.p[0] += (ax - f.a[0]) * 0.7; f.p[1] += Math.min(0, ay - f.a[1]); }
      f.v[0] += (rx - f.p[0]) * SIDE * dt;
      f.v[1] -= LIFT * dt;
      const k = Math.exp(-DRAG * dt);
      f.v[0] *= k; f.v[1] *= k;
      f.p[0] += f.v[0] * dt; f.p[1] += f.v[1] * dt;
      // the string: never longer than its length; a pull outward is stopped
      const ex = f.p[0] - ax, ey = f.p[1] - ay, d = Math.hypot(ex, ey);
      if (d > f.len) {
        const nx = ex / d, ny = ey / d, out = f.v[0] * nx + f.v[1] * ny;
        f.p = [ax + nx * f.len, ay + ny * f.len];
        if (out > 0) { f.v[0] -= nx * out; f.v[1] -= ny * out; }
      }
    }
    f.a = [ax, ay];
    const ex = f.p[0] - ax, ey = f.p[1] - ay, d = Math.hypot(ex, ey) || 1, slack = Math.max(0, f.len - d);
    // taut: leans along the string; slack: rights itself
    const lean = (Math.atan2(ex, -ey) * 180) / Math.PI * Math.max(0, 1 - slack / 4) * 0.8;
    f.el.lastChild.setAttribute('transform', `translate(${f.p[0].toFixed(2)} ${f.p[1].toFixed(2)}) rotate(${lean.toFixed(1)})`);
    // a slack string droops under its own weight, between tie and knot
    const mx = (ax + f.p[0]) / 2, my = (ay + f.p[1]) / 2 + slack * 0.9;
    f.el.firstChild.setAttribute('d', slack < 0.3 ? `M${ax} ${ay}L${f.p[0]} ${f.p[1]}` : `M${ax} ${ay}Q${mx} ${my} ${f.p[0]} ${f.p[1]}`);
  }
  simAt = requestAnimationFrame(sim);
}

// ---------- state ----------
// G.at[i] = the plate item i is on, or -1 in the store. G.moves = every drop that changed where an item is (restart keeps them).
// G.sel = the item picked up (tap), or null.
const SVGNS = 'http://www.w3.org/2000/svg';
const FIRST_TIP = T('Drag every <b>item</b> onto a <b>plate</b> until every beam hangs <b>level</b>.');
const best = () => G.p.items.length;
const subText = () => T('{m} moves · ★★★ in {n}', { m: G.moves, n: best() + 1 });

function startLevel(G, save) {
  const p = generate(hash(G.key), G.pack), K = p.items.length;
  const fits = Array.isArray(save.at) && save.at.length === K && save.at.every((x) => Number.isInteger(x) && x >= -1 && x < p.plates) && Number.isInteger(save.moves) && save.moves >= 0;
  Object.assign(G, { p, at: fits ? [...save.at] : Array(K).fill(-1), moves: fits ? save.moves : 0, sel: null, kbd: false });
  delete $('#tip').dataset.warn;
  $('#tip').innerHTML = G.date ? T(`Today's ${TIERS[G.pack].toLowerCase()} puzzle. A new one tomorrow.`) : G.pack === 'E' && G.n && !Object.keys(store.packs.E.stars).length ? FIRST_TIP : '';
  const b = $('#board');
  b.classList.remove('solved');
  b.innerHTML = `<svg class="rig" xmlns="${SVGNS}" aria-hidden="true"></svg>`;
  floats.clear();
  draw(b.firstChild, p, G.at, { live: true });
  $('#tray').replaceChildren(...p.items.map((it, i) => {
    const t = document.createElement('button');
    t.className = 'slot';
    t.dataset.item = i;
    t.innerHTML = `<svg viewBox="-14 -12 28 25" aria-hidden="true">${token(it.v)}</svg>`;
    return t;
  }));
  refresh();
  return fits || !Object.keys(save).length;
}

function refresh() {
  const { p } = G, rig = $('#board .rig');
  paint(rig, p, G.at, { live: true });
  syncFloats();
  rig.classList.toggle('aiming', G.sel !== null && !G.done);
  rig.classList.toggle('kbd', G.kbd && !G.done);
  for (const g of rig.querySelectorAll('[data-item]')) g.classList.toggle('sel', +g.dataset.item === G.sel);
  $('#tray').querySelectorAll('.slot').forEach((t, i) => {
    t.classList.toggle('used', G.at[i] >= 0);
    t.setAttribute('aria-pressed', String(i === G.sel && !G.done));
    t.disabled = G.done;
    t.setAttribute('aria-label', G.at[i] >= 0 ? T('{item}, on plate {n}', { item: itemName(p.items[i].v), n: G.at[i] + 1 }) : itemName(p.items[i].v));
  });
  $('#tray').classList.toggle('aiming', G.sel !== null && G.at[G.sel] >= 0 && !G.done);
  $('#g-sub').textContent = subText();
  $('#btn-reset').disabled = G.done || G.at.every((x) => x < 0);
  const left = G.at.filter((x) => x < 0).length;
  $('#board').setAttribute('aria-label', T('Balancing Act: {p} plates, {left} of {k} items still in the store', { p: p.plates, left, k: p.items.length }));
}

// beams hanging level with something on both sides
const levelCount = () => torques(G.p.tree, masses(G.p, G.at)).filter((t) => t.torque === 0 && t.left && t.right).length;

// Item i to plate k (-1: back to the store). Counts as a move if it changes where the item is.
function moveItem(i, k) {
  if (!playing() || i === null) return;
  G.sel = null;
  if (G.at[i] === k) { refresh(); return; }
  const before = levelCount();
  G.at[i] = k;
  G.moves++;
  const after = levelCount();
  if (k < 0) sfx.erase(); else if (after > before) sfx.good(after); else sfx.place();
  $('#sr').textContent = k < 0 ? T('{item} back in the store.', { item: itemName(G.p.items[i].v) })
    : T('{item} on plate {n}: it now holds {t}.', { item: itemName(G.p.items[i].v), n: k + 1, t: num(masses(G.p, G.at)[k]) });
  delete $('#tip').dataset.warn;
  if ($('#tip').innerHTML === FIRST_TIP) $('#tip').innerHTML = '';
  if (G.at.every((x) => x >= 0)) {
    if (balanced(G.p, G.at)) { refresh(); $('#board').classList.add('solved'); win(); return; }
    $('#tip').innerHTML = T('Everything is hung, but not every beam is <b>level</b> yet.');
    $('#tip').dataset.warn = 1;
  }
  if (G.kbd && k >= 0) G.sel = G.at.findIndex((x) => x < 0) >= 0 ? G.at.findIndex((x) => x < 0) : null;
  refresh();
  saveGame();
}

function select(i) {
  if (!playing()) return;
  G.sel = G.sel === i ? null : i;
  if (G.sel !== null) sfx.tap();
  refresh();
}

function reset() {
  if (!playing() || G.at.every((x) => x < 0)) return;
  if (!confirm(T('Restart this level? Everything goes back to the store; your moves still count.'))) return;
  G.at.fill(-1);
  G.sel = null;
  delete $('#tip').dataset.warn;
  $('#tip').innerHTML = '';
  sfx.erase();
  refresh();
  saveGame();
}

// ---------- input ----------
// Press on an item: a short press picks it (then tap a plate, or the store); press and drag carries it to a plate or back to the store.
let drag = null;
const itemAt = (e) => { const t = e.target.closest('[data-item]'); return t && (t.closest('#board') || t.closest('#tray')) ? +t.dataset.item : null; };
function dropAt(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return undefined;
  const pl = el.closest('#board .plate, #board [data-on]'); // a floating balloon counts as its plate
  if (pl) return +(pl.dataset.plate ?? pl.dataset.on);
  if (el.closest('#tray')) return -1;
  return undefined;
}
function hover(k) {
  for (const g of document.querySelectorAll('#board .plate')) g.classList.toggle('over', +g.dataset.plate === k);
  $('#tray').classList.toggle('over', k === -1);
}
addEventListener('pointerdown', (e) => {
  if (!G || !playing() || e.button > 0) return;
  const i = itemAt(e);
  if (i === null || G.p.items[i] === undefined) return;
  if (e.target.closest('#tray') && G.at[i] >= 0) return; // its empty slot: a tap there returns the item (click below)
  e.preventDefault();
  drag = { i, x: e.clientX, y: e.clientY, on: false, id: e.pointerId };
});
addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.on && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
  if (!drag.on) {
    drag.on = true;
    G.sel = drag.i;
    G.kbd = false;
    refresh();
    drag.ghost = Object.assign(document.createElement('div'), { className: 'carry', innerHTML: `<svg viewBox="-14 -12 28 25" aria-hidden="true">${token(G.p.items[drag.i].v)}</svg>` });
    document.body.append(drag.ghost);
  }
  drag.ghost.style.translate = `${e.clientX / pageScale()}px ${e.clientY / pageScale()}px`;
  hover(dropAt(e.clientX, e.clientY));
});
function endDrag(e, cancel) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  hover(undefined);
  if (!d.on) { if (!cancel) { G.kbd = false; select(d.i); } return; }
  d.ghost.remove();
  const k = cancel ? undefined : dropAt(e.clientX, e.clientY);
  if (k === undefined) { G.sel = null; refresh(); } else moveItem(d.i, k);
}
addEventListener('pointerup', (e) => endDrag(e, false));
addEventListener('pointercancel', (e) => endDrag(e, true));

// Taps: a plate (with an item picked up) takes it; the store takes back an item picked up from a plate; a used slot returns its item.
$('#board').addEventListener('click', (e) => {
  if (!playing() || G.sel === null || e.target.closest('[data-item]')) return;
  const pl = e.target.closest('.plate');
  if (pl) moveItem(G.sel, +pl.dataset.plate);
});
$('#tray').addEventListener('click', (e) => {
  if (!playing()) return;
  const s = e.target.closest('.slot');
  if (s && G.at[+s.dataset.item] >= 0) { G.kbd = e.detail === 0; moveItem(+s.dataset.item, -1); return; }
  if (s && e.detail === 0) { G.kbd = true; select(+s.dataset.item); return; } // keyboard Enter on a slot
  if (!s && G.sel !== null && G.at[G.sel] >= 0) moveItem(G.sel, -1);
});

// Keyboard: arrows pick an item (the store's, then each plate's), 1–8 hang it on that plate, 0 sends it back to the store
function onKey(e) {
  const K = G.p.items.length;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    const order = [...Array(K).keys()].sort((a, b) => G.at[a] - G.at[b] || a - b), d = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
    const j = order.indexOf(G.sel);
    G.sel = order[j < 0 ? 0 : (j + d + K) % K];
    G.kbd = true;
    sfx.tap();
    $('#sr').textContent = G.at[G.sel] >= 0 ? T('{item}, on plate {n}', { item: itemName(G.p.items[G.sel].v), n: G.at[G.sel] + 1 }) : itemName(G.p.items[G.sel].v);
    refresh();
  } else if (/^[1-9]$/.test(e.key) && +e.key <= G.p.plates) {
    G.kbd = true;
    if (G.sel === null) { const f = G.at.findIndex((x) => x < 0); if (f < 0) return true; G.sel = f; }
    moveItem(G.sel, +e.key - 1);
  } else if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') { G.kbd = true; if (G.sel !== null) moveItem(G.sel, -1); }
  else return false;
  return true;
}

$('#btn-reset').onclick = reset;

// ---------- paper ----------
// The contraption hanging level, a box on every plate to write its items in, and the store to cross off. Answer: the plates filled.
const storeRow = (p) => `<div class="p-store">${p.items.map((it) => `<svg viewBox="-14 -12 28 25" aria-hidden="true">${token(it.v)}</svg>`).join('')}</div>`;
printable(() => {
  const p = G.p, rig = () => document.createElementNS(SVGNS, 'svg');
  const q = rig(), a = rig();
  q.setAttribute('class', 'rig p-rig');
  a.setAttribute('class', 'rig p-rig');
  draw(q, p, p.items.map(() => -1), { level: true, box: true, mini: true });
  draw(a, p, p.items.map((x) => x.plate), { level: true, mini: true });
  // the sheet's header reads the bar's subtitle: there, the puzzle's size instead of the moves so far
  if ($('#g-sub')) { $('#g-sub').textContent = T('{p} plates · {k} items', { p: p.plates, k: p.items.length }); addEventListener('afterprint', () => G?.p && refresh(), { once: true }); }
  return {
    rules: [
      T('Hang every item from the <b>store</b> on a plate, so that every beam is <b>level</b>. Write each plate\'s items in its box.'),
      T('A beam is level when <b>weight × arm</b> is the same on both sides. A side\'s weight is everything hanging under it.'),
      ...(p.items.some((x) => x.v < 0) || p.fixed.length ? [T('A <b>balloon</b> lifts: a −2 balloon cancels out a 2 weight.')] : []),
      T('Use every item exactly once. There\'s only one way.'),
    ],
    body: q.outerHTML + storeRow(p),
    answer: a.outerHTML,
  };
}, (k, date) => { G = { p: generate(hash('D' + k + date), k) }; });

// Home logo and help: a small Easy contraption, solved
for (const [id, key] of [['#logo', 'logo'], ['#help-rig', 'help']]) {
  const p = generate(hash(key), 'E'), el = document.createElementNS(SVGNS, 'svg');
  el.setAttribute('class', 'rig mini');
  draw(el, p, p.items.map((x) => x.plate), { level: true, mini: true });
  $(id).append(el);
}

boot({ name: T('Balancing Act'), storeKey: 'balancingact', random: true, winDelay: 1400, glyphs: ['⚖', '½'], start: startLevel,
  save: (G) => ({ at: G.at, moves: G.moves }), key: onKey,
  reveal: () => { G.at = G.p.items.map((x) => x.plate); G.sel = null; refresh(); $('#board').classList.add('solved'); },
  stars: (G) => { const extra = G.moves - best(); return extra <= 1 ? 3 : extra <= Math.ceil(best() / 2) ? 2 : 1; } });
