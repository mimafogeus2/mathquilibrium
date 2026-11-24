// Reception puzzle engine. A city on an N×N grid: open ground (street, park), buildings of height 1–3, and water.
// Some buildings have a free roof; every piece in the hand goes on one (one piece a roof). Antennae cover squares with
// whole-number signal, overlapping signal adds up, and every square must reach its requirement (req, 0 for water).
// Every level: the planted answer works, no smaller set of the hand works (so every piece in every answer earns its place),
// and the answers are few (TIER.cap). Uses rng/int/pick from shared/common.js (a global).
//
// Antennae (a letter and a grade, the peak value g; '^2' / '^3' after it makes an amplifier with that threshold, '^1' a repeater):
//   M mast    a diamond around the roof: g at the centre, falling 1 a step to 1, radius g-1 (+range)
//   P panel   a 90° wedge one way: 1 wide, then 3, 5…; g, g, then falling to 1, g+1 long (+range)   rotates
//   D dish    a straight line one way to the edge, g all along                                      rotates
//   C cell    its own square and the 8 around it, g (height adds no range; an extender does)
//   X plus    four arms 2 long (+range), g all along
//   O ring    the squares 2 steps away (Chebyshev; +range makes it thicker), g; nothing nearer, not even its own roof
// Range: a medium building adds 1, a high one 2, each extender or lifter next to it 1 more. The far squares it adds keep the
// pattern's far value (1 for a mast or panel).
// Line of sight: a building taller than the antenna's own (its roof height, plus lifters) blocks the squares behind it;
// the blocking building's own square still gets signal. Lines run through square centres (Bresenham).
// Amplifiers broadcast only when their own square already has signal >= the threshold, not counting themselves. A repeater is
// an amplifier with threshold 1: it wakes on any signal.
// Worked out to a fixed point: plain antennae first, then each amplifier that's met switches on, until none changes.
// Modifiers (b booster, e extender, l lifter, s splitter) sit on a roof and act on every antenna orthogonally next to them:
//   b: +1 to every square it covers. e: +1 range. l: one height higher (range and line of sight). s: panel or dish fires both ways.
// Everything only ever adds, so signal is monotone in the pieces: what the search's bounds rest on.

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W, as [dx, dy]
const ANT = 'MPDCXO', MOD = 'bels', ROT = 'PD';
const isAnt = (k) => ANT.includes(k);

// Per difficulty: board size, pieces, the requirement, which pieces, grades, how many are modifiers or amplifiers,
// heights, roofs per piece (most, fewest after tightening), hotspots at most, the most answers a level may have, and how many
// search steps a check may take before the city is given up for another (it keeps the slow tail short), and whether line of
// sight must matter (los).
// Each difficulty is the one above it before the playtest made everything a step easier: Medium was Easy, Hard was Medium, and
// Impossible (Impossible Mode's daily, the only one made ahead: build-levels.js) was Hard. Easy is new: 5×5, a mast or two.
// Medium also deals the odd panel or dish (a letter twice is twice as likely) and now and then a repeater (gate 1): a bridge to
// Hard's amplifiers.
const TIER = {
  E: { N: [5, 5], K: [2, 3], T: 1, ants: 'MC', mods: '', nMod: [0, 0], amp: 0, hi: 2, roofs: [2.2, 1.5], hot: 0, cap: 20, limit: 1e5 },
  M: { N: [6, 6], K: [3, 4], T: 1, ants: 'MMCCXXPD', mods: '', nMod: [0, 0], amp: 0.15, gate: 1, hi: 2, roofs: [2.2, 1.5], hot: 0, cap: 20, limit: 2e5 },
  H: { N: [8, 8], K: [5, 6], T: 2, ants: 'MCXPDO', mods: 'be', nMod: [0, 1], amp: 0.3, hi: 3, roofs: [2.2, 1.6], hot: 1, cap: 20, limit: 3e5 },
  I: { N: [9, 10], K: [6, 8], T: 2, ants: 'MCXPDO', mods: 'bels', nMod: [1, 2], amp: 0.7, hi: 3, roofs: [2.5, 1.7], hot: 3, cap: 6, limit: 2e6, los: true },
};
const GRADES = { M: [2, 3], P: [2, 3], D: [1, 2], C: [1, 3], X: [1, 2], O: [1, 2] };

// ---------- the level ----------
// ground: one char a square. '.' street, ',' park, '~' water, '1'–'3' a building, 'a'–'c' a building of height 1–3 with a free roof.
// req: one digit a square. hand: piece codes ('M3', 'P2^3', 'b'). sol: the planted answer, [cell, dir] per piece.
const height = (ch) => ('123'.includes(ch) ? +ch : 'abc'.includes(ch) ? ch.charCodeAt(0) - 96 : 0);
const isRoof = (ch) => 'abc'.includes(ch);
const parsePiece = (s) => ({ k: s[0], g: +s[1] || 0, amp: s.includes('^') ? +s.split('^')[1] : 0, code: s });

// The squares strictly between a and b on a straight line (Bresenham), both ends left out
function walk(N, a, b, fn) {
  let x0 = a % N, y0 = (a / N) | 0;
  const x1 = b % N, y1 = (b / N) | 0, dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
    if (x0 === x1 && y0 === y1) return;
    fn(y0 * N + x0);
  }
}

// Everything the engine needs about a level, worked out once: heights, roofs, and for every pair of squares the tallest
// building strictly between them (so a line of sight is one lookup).
function prep(L) {
  const N = L.N, NN = N * N, H = new Uint8Array(NN), req = new Uint8Array(NN), roofs = [];
  for (let c = 0; c < NN; c++) { H[c] = height(L.ground[c]); req[c] = +L.req[c]; if (isRoof(L.ground[c])) roofs.push(c); }
  const btw = new Uint8Array(NN * NN);
  for (let a = 0; a < NN; a++) for (let b = 0; b < NN; b++) { let m = 0; walk(N, a, b, (c) => { if (H[c] > m) m = H[c]; }); btw[a * NN + b] = m; }
  const need = [];
  for (let c = 0; c < NN; c++) if (req[c]) need.push(c);
  return { N, NN, H, req, roofs, btw, need, hand: L.hand.map(parsePiece), cache: new Map() };
}

// The squares an antenna covers: a flat list [cell, value, cell, value…] (Int16Array), cached.
// k, g: type and grade; at: its square; dir; ext, lift, boost: modifier counts next to it; split: a splitter next to it.
function pattern(P, k, g, at, dir, ext, lift, boost, split) {
  const key = ((((((at * 4 + dir) * 8 + ext) * 8 + lift) * 8 + boost) * 2 + (split ? 1 : 0)) * 8 + g) * 8 + ANT.indexOf(k);
  let out = P.cache.get(key);
  if (out) return out;
  const { N, NN, H, btw } = P, h = H[at] + lift, x0 = at % N, y0 = (at / N) | 0;
  const range = (k === 'C' ? 0 : H[at] - 1 + lift) + ext, val = new Uint8Array(NN);
  const put = (x, y, v) => {
    if (x < 0 || y < 0 || x >= N || y >= N || v <= 0) return;
    const c = y * N + x;
    if (c !== at && btw[at * NN + c] > h) return;
    if (v > val[c]) val[c] = v;
  };
  const R = N; // reach never passes the board
  if (k === 'M') for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const d = Math.abs(dx) + Math.abs(dy);
    if (d <= g - 1 + range) put(x0 + dx, y0 + dy, Math.max(1, g - d));
  }
  if (k === 'C') for (let dy = -1 - range; dy <= 1 + range; dy++) for (let dx = -1 - range; dx <= 1 + range; dx++) put(x0 + dx, y0 + dy, g);
  if (k === 'X') { put(x0, y0, g); for (const [ux, uy] of DIRS) for (let s = 1; s <= 2 + range; s++) put(x0 + ux * s, y0 + uy * s, g); }
  if (k === 'O') for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    if (d >= 2 && d <= 2 + range) put(x0 + dx, y0 + dy, g);
  }
  if (k === 'P' || k === 'D') for (const d of split ? [dir, (dir + 2) % 4] : [dir]) {
    const [fx, fy] = DIRS[d], [lx, ly] = [-fy, fx];
    put(x0, y0, g);
    const len = k === 'D' ? N : g + 1 + range;
    for (let f = 1; f <= len; f++) {
      if (k === 'D') { put(x0 + fx * f, y0 + fy * f, g); continue; }
      const v = Math.max(1, Math.min(g, g + 2 - f));
      for (let l = 1 - f; l <= f - 1; l++) put(x0 + fx * f + lx * l, y0 + fy * f + ly * l, v);
    }
  }
  const list = [];
  for (let c = 0; c < NN; c++) if (val[c]) list.push(c, val[c] + boost);
  out = Int16Array.from(list);
  P.cache.set(key, out);
  return out;
}

const neighbours = (N, c) => {
  const x = c % N, y = (c / N) | 0, out = [];
  if (y > 0) out.push(c - N);
  if (x < N - 1) out.push(c + 1);
  if (y < N - 1) out.push(c + N);
  if (x > 0) out.push(c - 1);
  return out;
};

// Signal everywhere for a placement: place[i] = [cell, dir] for hand piece i, or null (not placed).
// Returns { cov: Int16Array, on: [bool] per piece (antennae broadcasting; amplifiers that switched on), mods: per antenna its
// modifier counts }. noLos: ignore line of sight (a level check).
function coverage(P, place, noLos) {
  const { N, NN, hand } = P, cov = new Int16Array(NN), at = new Int16Array(NN).fill(-1), on = hand.map(() => false);
  place.forEach((p, i) => { if (p) at[p[0]] = i; });
  const pats = hand.map((pc, i) => {
    const p = place[i];
    if (!p || !isAnt(pc.k)) return null;
    let e = 0, l = 0, b = 0, s = false;
    for (const n of neighbours(N, p[0])) {
      const j = at[n];
      if (j < 0) continue;
      const m = hand[j].k;
      if (m === 'e') e++; else if (m === 'l') l++; else if (m === 'b') b++; else if (m === 's') s = true;
    }
    return noLos ? patternNoLos(P, pc.k, pc.g, p[0], p[1], e, l, b, s) : pattern(P, pc.k, pc.g, p[0], p[1], e, l, b, s);
  });
  const add = (pat) => { for (let j = 0; j < pat.length; j += 2) cov[pat[j]] += pat[j + 1]; };
  pats.forEach((pat, i) => { if (pat && !hand[i].amp) { add(pat); on[i] = true; } });
  for (let changed = true; changed;) {
    changed = false;
    pats.forEach((pat, i) => {
      if (pat && !on[i] && cov[place[i][0]] >= hand[i].amp) { add(pat); on[i] = changed = true; }
    });
  }
  return { cov, on };
}
// The same level with nothing blocking: a twin of P whose between-heights are all 0
function patternNoLos(P, ...a) {
  P.flat ??= { ...P, btw: new Uint8Array(P.btw.length), cache: new Map() };
  return pattern(P.flat, ...a);
}
const met = (P, cov) => P.need.every((c) => cov[c] >= P.req[c]);

// ---------- the search ----------
// Every way to place the hand (or part of it: skip) that meets every requirement. Returns { full, partial, witness }:
// full = answers using every piece (identical pieces counted once), partial = whether some smaller set of the hand works,
// witness = the first such smaller set's placement, or else the first full answer that isn't `except`.
// Stops early at the first partial (stopPartial) and once full passes cap.
// fixed[i] = [cell, dir]: piece i must be there. noSkip: only full answers (the hint's question). noLos: blocking off.
// Bounds: every antenna not yet placed is counted at its best anywhere (with every modifier in the hand next to it, and
// amplifiers on), every one placed at its best where it is: if some square can't reach its requirement even so, give up the branch.
function solve(P, { cap = Infinity, fixed = [], noSkip = false, stopPartial = true, except = null, noLos = false, limit = 5e6 } = {}) {
  const { N, NN, hand, roofs, need, req } = P, K = hand.length;
  const mods = hand.filter((p) => !isAnt(p.k)), allE = mods.filter((p) => p.k === 'e').length;
  const allL = mods.filter((p) => p.k === 'l').length, allB = mods.filter((p) => p.k === 'b').length, allS = mods.some((p) => p.k === 's');
  const pat = noLos ? patternNoLos : pattern;
  // antennae first (the biggest first: they shape the bounds most), then modifiers
  const ants = [...Array(K).keys()].filter((i) => isAnt(hand[i].k)), mds = [...Array(K).keys()].filter((i) => !isAnt(hand[i].k));
  const opts = {}, best = {}, size = {};
  for (const i of ants) {
    const pc = hand[i], dirs = ROT.includes(pc.k) ? [0, 1, 2, 3] : [0];
    opts[i] = fixed[i] ? [fixed[i]] : roofs.flatMap((c) => dirs.map((d) => [c, d]));
    const mx = new Int16Array(NN);
    for (const o of opts[i]) {
      const p = pat(P, pc.k, pc.g, o[0], o[1], allE, allL, allB, allS);
      o.pat = p;
      for (let j = 0; j < p.length; j += 2) if (p[j + 1] > mx[p[j]]) mx[p[j]] = p[j + 1];
    }
    best[i] = mx;
    size[i] = mx.reduce((s, v) => s + v, 0);
  }
  ants.sort((a, b) => size[b] - size[a] || a - b);
  const order = [...ants, ...mds];
  // identical pieces next to each other in `order` take roofs in increasing order (they're interchangeable)
  const twin = order.map((i, n) => n > 0 && hand[order[n - 1]].code === hand[i].code && !fixed[i] && !fixed[order[n - 1]]);
  const S = new Int16Array(NN);
  for (const i of ants) for (let c = 0; c < NN; c++) S[c] += best[i][c];
  const used = new Int16Array(NN).fill(-1), place = Array(K).fill(null), code = Array(K).fill(-1);
  let full = 0, partial = false, witness = null, nodes = 0;
  const ok = (cells) => { for (const c of cells) if (S[c] < req[c]) return false; return true; };
  const nz = {};
  for (const i of ants) { nz[i] = []; for (let c = 0; c < NN; c++) if (best[i][c] && req[c]) nz[i].push(c); }
  if (!ok(need)) return { full, partial, witness };
  const same = (a, b) => a.every((p, i) => (!p && !b[i]) || (p && b[i] && p[0] === b[i][0] && p[1] === b[i][1]));
  const stop = () => (stopPartial && partial) || full > cap || nodes > limit;

  function leaf(skipped) {
    const { cov } = coverage(P, place, noLos);
    if (!met(P, cov)) return;
    if (skipped) { if (!partial) witness = place.map((p) => p && [...p]); partial = true; }
    else { full++; if (!witness && !(except && same(place, except))) witness = place.map((p) => p && [...p]); }
  }
  function go(n, skipped) {
    if (stop()) return;
    nodes++;
    if (n === K) return leaf(skipped);
    const i = order[n], pc = hand[i], prev = twin[n] ? code[order[n - 1]] : -2;
    if (isAnt(pc.k)) {
      for (let c = 0; c < NN; c++) S[c] -= best[i][c];
      // twins: skipped ones first (code -1), then placed ones in increasing order
      if (!noSkip && !fixed[i] && prev <= -1 && ok(nz[i])) { code[i] = -1; go(n + 1, true); }
      for (const o of opts[i]) {
        const cd = o[0] * 4 + o[1];
        if (used[o[0]] >= 0 || (prev !== -2 && cd <= prev) || stop()) continue;
        const p = o.pat;
        for (let j = 0; j < p.length; j += 2) S[p[j]] += p[j + 1];
        if (ok(nz[i])) {
          used[o[0]] = i; place[i] = o; code[i] = cd;
          go(n + 1, skipped);
          used[o[0]] = -1; place[i] = null;
        }
        for (let j = 0; j < p.length; j += 2) S[p[j]] -= p[j + 1];
      }
      code[i] = -1;
      for (let c = 0; c < NN; c++) S[c] += best[i][c];
      return;
    }
    // a modifier: next to an antenna, or nowhere (anywhere else it does nothing, the same as leaving it out)
    if (!noSkip && !fixed[i] && prev <= -1) { code[i] = -1; go(n + 1, true); }
    const spots = fixed[i] ? [fixed[i][0]] : roofs.filter((c) => used[c] < 0 && neighbours(N, c).some((m) => used[m] >= 0 && isAnt(hand[used[m]].k)));
    for (const c of spots) {
      if (used[c] >= 0 || (prev !== -2 && c * 4 <= prev) || stop()) continue;
      used[c] = i; place[i] = [c, 0]; code[i] = c * 4;
      go(n + 1, skipped);
      used[c] = -1; place[i] = null;
    }
    code[i] = -1;
  }
  go(0, false);
  return { full, partial, witness, nodes, gaveUp: nodes > limit };
}

// ---------- making a level ----------
// The city: streets every few squares both ways, blocks of buildings between them; some blocks are parks, some squares
// alleys. Heights rise toward the middle. Returns heights (0 open) and a ground string without roofs.
function city(r, N, T) {
  const lines = (n) => {
    const s = new Set();
    for (let p = int(r, 0, 2); p < n; p += int(r, 3, 4)) s.add(p);
    return s;
  };
  const rows = lines(N), cols = lines(N), g = [], H = [];
  const park = new Set();
  for (let c = 0; c < N * N; c++) if (r() < 0.12) park.add(c);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const c = y * N + x;
    if (rows.has(y) || cols.has(x)) { g.push('.'); H.push(0); continue; }
    // a park takes the block around one random seed square
    const blk = (v, set) => { let a = v; while (a > 0 && !set.has(a - 1)) a--; return a; };
    const bx = blk(x, cols), by = blk(y, rows);
    if (park.has(by * N + bx)) { g.push(','); H.push(0); continue; }
    if (r() < 0.1) { g.push('.'); H.push(0); continue; }
    const mid = 1 - Math.hypot(x - (N - 1) / 2, y - (N - 1) / 2) / (N * 0.7);
    const v = r() + mid * 0.6;
    const h = T.hi === 2 ? (v > 0.85 ? 2 : 1) : v > 1.05 ? 3 : v > 0.65 ? 2 : 1;
    g.push(String(h));
    H.push(h);
  }
  return { ground: g.join(''), H };
}

// A hand for the tier: antennae (an amplifier or a chain of them in harder tiers; a repeater when the tier sets gate), then modifiers.
function dealHand(r, T, K) {
  const nMod = int(r, T.nMod[0], T.nMod[1]), nAnt = K - nMod, hand = [];
  let amps = T.chain ? T.chain : r() < T.amp ? (T.amp >= 1 ? int(r, 1, 2) : 1) : 0;
  for (let i = 0; i < nAnt; i++) {
    const k = pick(r, T.ants), [lo, hi] = GRADES[k];
    hand.push(`${k}${int(r, lo, hi)}` + (i >= 1 && amps-- > 0 ? '^' + (T.gate || int(r, 2, 3)) : ''));
  }
  for (let i = 0; i < nMod; i++) hand.push(pick(r, T.mods));
  return hand.sort();
}

const score = (P, cov) => { let s = 0; for (const c of P.need) s += Math.min(cov[c], P.req[c]); return s; };
const makeLevel = (N, ground, req, hand, sol) => ({ N, ground, req, hand, sol });

// Place the hand anywhere on buildings to cover as much as it can (a hill climb), on a level whose roofs are every building.
function plant(r, N, ground, req, hand) {
  const all = ground.replace(/[1-3]/g, (h) => 'abc'[h - 1]);
  const P = prep(makeLevel(N, all, req, hand, []));
  const K = hand.length, place = Array(K).fill(null), taken = new Set();
  const free = () => { let c; do c = pick(r, P.roofs); while (taken.has(c)); return c; };
  const ants = [...Array(K).keys()].filter((i) => isAnt(P.hand[i].k));
  const randomSpot = (i) => {
    if (isAnt(P.hand[i].k)) return [free(), ROT.includes(P.hand[i].k) ? int(r, 0, 3) : 0];
    const near = ants.filter((j) => place[j]).flatMap((j) => neighbours(N, place[j][0])).filter((c) => P.roofs.includes(c) && !taken.has(c));
    return [near.length ? pick(r, near) : free(), 0];
  };
  for (const i of [...ants, ...[...Array(K).keys()].filter((i) => !ants.includes(i))]) { place[i] = randomSpot(i); taken.add(place[i][0]); }
  let cur = score(P, coverage(P, place).cov);
  for (let it = 0; it < 60 * K; it++) {
    const i = int(r, 0, K - 1), old = place[i];
    taken.delete(old[0]);
    place[i] = r() < 0.3 && ROT.includes(P.hand[i].k) ? [old[0], int(r, 0, 3)] : randomSpot(i);
    taken.add(place[i][0]);
    const s = score(P, coverage(P, place).cov);
    if (s >= cur) cur = s;
    else { taken.delete(place[i][0]); place[i] = old; taken.add(old[0]); }
  }
  return { place, P };
}

// { N, ground, req, hand, sol } for seed and tier. Tries cities until one makes a good level:
// 1. deal a hand and plant it where it covers the most; squares it can't cover become water (too many: next city)
// 2. give the answer's roofs and some decoys free roofs
// 3. search: while a smaller set of the hand works, or too many answers do, tighten against the answer found: a square it
//    covers less than the planted one does becomes a hotspot (needs one more), or a decoy roof it uses goes; else next city.
function generate(seed, tier, stats = {}) {
  const r = rng(seed), T = TIER[tier];
  for (let attempt = 1; ; attempt++) {
    stats.attempts = attempt;
    const N = int(r, T.N[0], T.N[1]), K = int(r, T.K[0], T.K[1]);
    const { ground: g0 } = city(r, N, T), hand = dealHand(r, T, K);
    const why = (k) => { (stats.why ??= {})[k] = (stats.why[k] || 0) + 1; };
    if ([...g0].filter(height).length < Math.ceil(K * T.roofs[0])) { why('few'); continue; } // too few buildings for the hand and its decoys
    const scope = tier === 'E' ? 'all' : pick(r, ['all', 'all', 'open', 'bld']);
    const want = (ch) => (scope === 'all' || (scope === 'open' ? !height(ch) : !!height(ch)) ? T.T : 0);
    let req = [...g0].map(want);
    if (!req.some(Boolean)) { why('noreq'); continue; }
    const { place } = plant(r, N, g0, req.join(''), hand);
    // squares the planted hand can't reach become water; a building turned to water stops blocking, so look again
    let ground = [...g0], cov;
    for (let pass = 0; pass < 3; pass++) {
      const P = prep(makeLevel(N, ground.join('').replace(/[1-3]/g, (h) => 'abc'[h - 1]), req.join(''), hand, []));
      cov = coverage(P, place).cov;
      let changed = false;
      for (let c = 0; c < N * N; c++) if (req[c] && cov[c] < req[c] && !place.some((p) => p[0] === c)) { ground[c] = '~'; req[c] = 0; changed = true; }
      if (!changed) break;
    }
    const water = ground.filter((ch) => ch === '~').length;
    if ((water > N * N * (T.water ?? 0.15) && why('water') === undefined) || !met(prep(makeLevel(N, ground.join('').replace(/[1-3]/g, (h) => 'abc'[h - 1]), req.join(''), hand, [])), cov)) continue;
    // roofs: the answer's, then decoys (tall ones a little likelier: they look like the obvious spot)
    const sol = place.map((p) => [...p]), roofs = new Set(sol.map((p) => p[0]));
    const bld = [...ground.keys()].filter((c) => height(ground[c]) && !roofs.has(c)).sort(() => r() - 0.5).sort((a, b) => (height(ground[b]) - height(ground[a])) * (r() < 0.5 ? 1 : 0));
    const target = Math.round(K * T.roofs[0]), least = Math.ceil(K * T.roofs[1]);
    for (const c of bld) { if (roofs.size >= target) break; roofs.add(c); }
    const make = () => makeLevel(N, ground.map((ch, c) => (roofs.has(c) ? 'abc'[height(ch) - 1] : ch)).join(''), req.join(''), hand, sol);
    let hot = 0, L = make(), good = false;
    for (let tighten = 0; tighten < 12; tighten++) {
      const P = prep(L), res = solve(P, { cap: T.cap, except: sol, limit: T.limit });
      stats.nodes = (stats.nodes || 0) + res.nodes;
      if (res.gaveUp) { why('slow'); break; }
      if (!res.partial && res.full <= T.cap) {
        // Hard and up: tall buildings must matter. With nothing blocking, a smaller hand (or more answers) would have to work.
        if (T.los) { const free = solve(P, { cap: res.full, noLos: true, limit: T.limit }); if (free.gaveUp || (!free.partial && free.full <= res.full)) { why('los'); break; } }
        good = true;
        break;
      }
      // tighten against the witness
      const w = res.witness, wc = coverage(P, w).cov, pc = coverage(P, sol).cov;
      const spots = P.need.filter((c) => wc[c] < pc[c] && req[c] < pc[c] && req[c] + 1 <= T.T + 1 && req[c] === T.T);
      if (hot < T.hot && spots.length) { const c = pick(r, spots); req[c] = T.T + 1; hot++; L = make(); continue; }
      const decoy = w.find((p) => p && !sol.some((s) => s[0] === p[0]));
      if (decoy && roofs.size > least) { roofs.delete(decoy[0]); L = make(); continue; }
      why(res.partial ? 'partial' : 'many');
      break;
    }
    if (good) return { ...L, tier, scope };
  }
}

// One line a level, for levels.js: N|ground|req|hand|sol (cell.dir per piece, comma-separated)
const line = (L) => [L.N, L.ground, L.req, L.hand.join(','), L.sol.map(([c, d]) => c + '.' + d).join(',')].join('|');
function parse(s) {
  const [N, ground, req, hand, sol] = s.split('|');
  return { N: +N, ground, req, hand: hand.split(','), sol: sol.split(',').map((p) => p.split('.').map(Number)) };
}

if (typeof module === 'object') module.exports = { TIER, DIRS, walk, ANT, MOD, ROT, isAnt, height, isRoof, parsePiece, prep, pattern, patternNoLos, neighbours, coverage, met, solve, city, dealHand, generate, line, parse };
