// Small Fry engine: the tank, who sees what, how fish swim, and the search that proves a level has one answer. No DOM:
// game.js (as the global Fry), build-levels.js and test.js all use it. The generator uses rng/int/pick from shared/common.js (a global).
//
// The tank is W×W cells, its border all rock. A cell is rock '#', water '.', or the exit 'X' (a gap in the border).
// Fish: { p: cell, d: facing (0 up, 1 right, 2 down, 3 left), s: size (the fry is 1), f: fast }. fish[0] is the fry.
// Mirrors: diagonal ones ('/' '\') sit on water cells; flat ones are bolted to a rock face, kept per water cell as a bitmask
// of the directions it has one toward (a look heading into that face turns right round).
// Items the player places: '/' '\' (on a water cell), 'F' (a flat mirror, on a rock face), 'B' (bait, on a water cell).
// A spot is a cell for '/', '\' and 'B', and cell * 4 + direction for 'F'.

const Fry = (() => {
const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];
const TURN = { '/': [1, 0, 3, 2], '\\': [3, 2, 1, 0] };
// W: the tank with its rock border. items: how many in hand. preds: predators. fixed: bolted-on diagonal mirrors.
// fast: chances at a fast predator. rock: rock runs grown inside. budget: positions the uniqueness search may visit.
// active: predators that must swim in some play (the rest, scenery, are taken out).
const TIER = {
  E: { W: 8, items: [2, 3], preds: [1, 2], types: '/\\', fixed: [0, 0], fast: 0, rock: [3, 6], budget: 2e4, active: 1 },
  M: { W: 10, items: [4, 5], preds: [2, 4], types: '/\\FB', fixed: [0, 2], fast: 0, rock: [6, 12], budget: 2e5, active: 1 },
  H: { W: 12, items: [5, 6], preds: [3, 5], types: '/\\FB', fixed: [1, 2], fast: 2, rock: [10, 18], budget: 3e4, active: 2 },
  I: { W: 14, items: [5, 6], preds: [4, 6], types: '/\\FB', fixed: [2, 3], fast: 3, rock: [14, 24], budget: 1e5, active: 2 },
};

// ---------- state ----------
// S = { fish: [{ p, d, s, f, a: alive }], mir: [cell -> '/' | '\' | ''], flat: Uint8Array (direction bits per cell),
//       bait: Uint8Array, nb: baits left, out: the fry got away }
function initial(L) {
  const n = L.W * L.W, S = { fish: L.fish.map((f) => ({ ...f, a: true })), mir: Array(n).fill(''), flat: new Uint8Array(n), bait: new Uint8Array(n), nb: 0, out: false };
  for (const [c, m] of L.mir) S.mir[c] = m;
  for (const k of L.flat) S.flat[k >> 2] |= 1 << (k & 3);
  return S;
}
const clone = (S) => ({ fish: S.fish.map((f) => ({ ...f })), mir: [...S.mir], flat: S.flat.slice(), bait: S.bait.slice(), nb: S.nb, out: S.out });
const fishKey = (S) => S.fish.map((f) => (f.a ? f.p * 4 + f.d : '')).join(',');

// ---------- sight ----------
// ponytail: shared scratch buffers, sized for the largest tank; one look at a time (no workers share a module instance)
const OCC = new Int8Array(400), SEEN = new Int32Array(1600);
let stamp = 0;
function occupancy(L, S, occ = OCC) {
  occ.fill(-1, 0, L.W * L.W);
  S.fish.forEach((f, i) => { if (f.a) occ[f.p] = i; });
  return occ;
}
// What fish i sees, looking ahead from its cell (mirrors bend the look; it never sees behind itself unless a mirror shows it).
// Returns { sc: cells the look passes, sd: the way it leaves each (the way a fish swimming in ends up facing), t: index in sc of
// what the fish wants (-1: nothing), end: the rock face it stops at (cell * 4 + direction, or -1), bounces: flat mirrors it turns
// on (cell * 4 + direction), hit: the fish it stops at (or -1) }.
// Bait is see-through, and so is the looker's own cell (a flat mirror shows what's behind it). Another fish stops the look;
// so does the exit, and a look that comes round on itself through a loop of mirrors.
function look(L, S, i, occ = occupancy(L, S), pts = null) {
  const f = S.fish[i], W = L.W, g = L.grid, sc = [], sd = [], bounces = [];
  let c = f.p, d = f.d;
  // pts (for drawing): the look's corners in cell units, from the fish's middle to where it stops
  const at = (c, d = -1) => pts?.push([c % W + .5 + (d < 0 ? 0 : DC[d] / 2), Math.floor(c / W) + .5 + (d < 0 ? 0 : DR[d] / 2)]);
  at(c);
  if (++stamp > 1e9) { SEEN.fill(0); stamp = 1; } // an Int32Array cell would wrap first
  for (;;) {
    const k = c * 4 + d;
    if (SEEN[k] === stamp) return { sc, sd, t: -1, end: -1, bounces, hit: -1 };
    SEEN[k] = stamp;
    const n = c + DR[d] * W + DC[d];
    if (g[n] === '#') {
      if (S.flat[c] >> d & 1) {
        // turned right round, the look crosses its own cell again: a diagonal mirror there turns it a second time
        at(c, d); bounces.push(k); d ^= 2;
        if (S.mir[c]) { at(c); d = TURN[S.mir[c]][d]; }
        if (sd.length) sd[sd.length - 1] = d;
        continue;
      }
      at(c, d);
      return { sc, sd, t: -1, end: k, bounces, hit: -1 };
    }
    c = n;
    if (pts && (S.mir[c] || occ[c] >= 0 || g[c] === 'X' || S.flat[c] || (f.s === 1 && S.bait[c]))) at(c);
    const o = occ[c];
    sc.push(c);
    if (o >= 0 && o !== i) { sd.push(d); return { sc, sd, t: S.fish[o].s < f.s ? sc.length - 1 : -1, end: -1, bounces, hit: o }; }
    if (g[c] === 'X') { sd.push(d); return { sc, sd, t: f.s === 1 ? sc.length - 1 : -1, end: -1, bounces, hit: -1 }; }
    if (f.s === 1 && S.bait[c]) { sd.push(d); return { sc, sd, t: sc.length - 1, end: -1, bounces, hit: -1 }; }
    if (S.mir[c]) d = TURN[S.mir[c]][d];
    sd.push(d);
  }
}

// ---------- time ----------
// One tick: every fish looks at once; each that sees what it wants swims one cell along its look (a fast one two), facing the
// way it swims. Then any fish that met a bigger one is eaten: they end in the same cell, a fast fish's path crosses it, or the
// two swim through each other head on. The fry swimming into the exit gets away; into bait, eats it.
// Returns { moved: [i], eaten: [i], paths: [[cells, from the start]], turns: [[facing at the start, then on leaving each cell]],
// won, lost }. S changes in place.
function tick(L, S) {
  const occ = occupancy(L, S), plan = [];
  for (let i = 0; i < S.fish.length; i++) {
    const f = S.fish[i];
    if (!f.a) continue;
    const v = look(L, S, i, occ);
    if (v.t < 0) continue;
    const k = Math.min(f.f ? 2 : 1, v.t + 1);
    plan.push({ i, old: f.p, from: f.d, cells: v.sc.slice(0, k), dirs: v.sd.slice(0, k), d: v.sd[k - 1] });
  }
  const out = { moved: plan.map((m) => m.i), eaten: [], paths: plan.map((m) => [m.old, ...m.cells]), turns: plan.map((m) => [m.from, ...m.dirs]), won: false, lost: false };
  if (!plan.length) return out;
  const old = S.fish.map((f) => f.p), cells = S.fish.map(() => []);
  for (const m of plan) { const f = S.fish[m.i]; f.p = m.cells[m.cells.length - 1]; f.d = m.d; cells[m.i] = m.cells; }
  const meet = (a, b) => S.fish[a].p === S.fish[b].p || cells[a].includes(S.fish[b].p) ||
    (cells[a].includes(old[b]) && (S.fish[b].p === old[a] || cells[b].includes(old[a])));
  S.fish.forEach((b, j) => {
    if (b.a && S.fish.some((a, i) => i !== j && a.a && a.s > b.s && meet(i, j))) out.eaten.push(j);
  });
  for (const j of out.eaten) S.fish[j].a = false;
  const fry = S.fish[0];
  if (!fry.a) out.lost = true;
  else if (L.grid[fry.p] === 'X') { out.won = true; S.out = true; fry.a = false; }
  else if (S.bait[fry.p]) { S.bait[fry.p] = 0; S.nb--; }
  return out;
}
// Ticks until nobody sees anything they want: 'win', 'lose', 'loop' (the same fish in the same places again) or 'stop'.
// Bait only ever gets eaten, so the count of what's left tells bait states within one run apart.
function run(L, S, cap = 500, movers = null) {
  const seen = new Set();
  for (let n = 0; n < cap; n++) {
    const key = fishKey(S) + '/' + S.nb;
    if (seen.has(key)) return 'loop';
    seen.add(key);
    const t = tick(L, S);
    if (movers) for (const i of t.moved) movers.add(i);
    if (t.lost) return 'lose';
    if (t.won) return 'win';
    if (!t.moved.length) return 'stop';
  }
  return 'loop';
}

// ---------- placing ----------
// Items go only where a fish is looking: a mirror or bait on a water cell its look passes, a flat mirror on the rock face it stares at.
function spots(L, S, type) {
  const occ = occupancy(L, S), out = new Set();
  for (let i = 0; i < S.fish.length; i++) {
    if (!S.fish[i].a) continue;
    const v = look(L, S, i, occ);
    if (type === 'F') { if (v.end >= 0 && L.grid[v.end >> 2] === '.') out.add(v.end); continue; }
    for (const c of v.sc) if (L.grid[c] === '.' && occ[c] < 0 && !S.mir[c] && !S.bait[c]) out.add(c);
  }
  return [...out].sort((a, b) => a - b);
}
const canPlace = (L, S, type, at) => spots(L, S, type).includes(at);
function place(S, type, at) {
  if (type === 'F') S.flat[at >> 2] |= 1 << (at & 3);
  else if (type === 'B') { S.bait[at] = 1; S.nb++; }
  else S.mir[at] = type;
}

// ---------- searching ----------
// Every way to win from S placing at most `max` items, taking types from `left` ({ type: how many }). Positions already seen
// (the same placements and the same fish, in any order) are skipped. Returns { wins: Map(sorted item types -> Map(answer key ->
// a working order)), movers: the fish that swam in any of it, states, over (gave up past `budget`) }. An answer key lists the
// placements sorted ('/@23 F@97 …').
function search(L, left, max, budget, S0 = initial(L)) {
  const seen = new Set(), wins = new Map(), placed = [], movers = new Set();
  let states = 0, over = false;
  (function dfs(S) {
    const key = [...placed].sort().join(' ') + '#' + fishKey(S);
    if (seen.has(key)) return;
    seen.add(key);
    if (++states > budget) { over = true; return; }
    for (const type in left) {
      if (!left[type]) continue;
      for (const at of spots(L, S, type)) {
        const T = clone(S);
        place(T, type, at);
        left[type]--;
        placed.push(type + '@' + at);
        const r = run(L, T, 500, movers);
        if (r === 'win') {
          const ms = placed.map((p) => p[0]).sort().join(''), ans = [...placed].sort().join(' ');
          if (!wins.has(ms)) wins.set(ms, new Map());
          if (wins.get(ms).size < 2 && !wins.get(ms).has(ans)) wins.get(ms).set(ans, [...placed]);
        } else if (r === 'stop' && placed.length < max) dfs(T);
        left[type]++;
        placed.pop();
        if (over) return;
      }
    }
  })(S0);
  return { wins, movers, states, over };
}
const count = (s) => { const c = {}; for (const x of s) c[x] = (c[x] || 0) + 1; return c; };
// a ⊂ b, as multisets of item types, and smaller
const within = (a, b) => { if (a.length >= b.length) return false; const c = count(b); for (const x of a) if (!c[x]--) return false; return true; };
// The level's verdict for items in hand: its answers (keys), and whether a smaller set of them already wins (spare).
function solve(L, items = L.items, budget = Infinity) {
  const s = search(L, count(items), items.length, budget), ms = [...items].sort().join('');
  return { answers: [...(s.wins.get(ms)?.keys() || [])], spare: [...s.wins.keys()].some((k) => within(k, ms)), movers: s.movers, over: s.over, states: s.states };
}

// ---------- generating ----------
// A random tank: a rock border with one exit gap, short rock runs inside, the fry and the predators placed and facing random
// ways, and (Medium on) a few bolted mirrors. Nobody may see what they want yet. A quick random play-through has to win first
// (cheap, and most tanks can't be won at all); then a full search finds every way to win with up to the most items, and the
// level takes the biggest hand of items that wins exactly one way, with no smaller part of it winning.
function tank(r, t) {
  const W = t.W, g = Array(W * W).fill('.');
  for (let i = 0; i < W; i++) g[i] = g[W * (W - 1) + i] = g[i * W] = g[i * W + W - 1] = '#';
  for (let k = int(r, t.rock[0], t.rock[1]); k > 0; k--) {
    let c = 1 + int(r, 0, W - 3) + W * (1 + int(r, 0, W - 3)), d = int(r, 0, 3);
    for (let j = int(r, 1, 3); j > 0; j--) {
      g[c] = '#';
      const n = c + DR[d] * W + DC[d];
      if (n % W === 0 || n % W === W - 1 || n < W || n >= W * (W - 1)) break;
      c = n;
      if (r() < 0.4) d = int(r, 0, 3);
    }
  }
  const gaps = []; // border cells (not corners) with water just inside
  for (let i = 1; i < W - 1; i++) for (const [c, n] of [[i, i + W], [W * (W - 1) + i, W * (W - 2) + i], [i * W, i * W + 1], [i * W + W - 1, i * W + W - 2]]) if (g[n] === '.') gaps.push(c);
  if (!gaps.length) return null;
  g[pick(r, gaps)] = 'X';
  return g.join('');
}

function candidate(r, tier) {
  const t = TIER[tier], W = t.W, grid = tank(r, t);
  if (!grid) return null;
  const water = [...grid].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
  const np = int(r, t.preds[0], t.preds[1]), cells = [];
  if (water.length < np + 8) return null;
  while (cells.length < np + 1) { const c = pick(r, water); if (!cells.includes(c)) cells.push(c); }
  const sizes = [2, 3, 4, 5, 6, 7].slice(0, np);
  for (let i = sizes.length - 1; i > 0; i--) { const j = int(r, 0, i); [sizes[i], sizes[j]] = [sizes[j], sizes[i]]; }
  const fast = new Set();
  for (let k = 0; k < t.fast; k++) if (r() < 0.6) fast.add(1 + int(r, 0, np - 1));
  const fish = cells.map((p, i) => ({ p, d: int(r, 0, 3), s: i ? sizes[i - 1] : 1, f: fast.has(i) }));
  const mir = [], free = water.filter((c) => !cells.includes(c));
  for (let k = int(r, t.fixed[0], t.fixed[1]); k > 0; k--) { const c = pick(r, free); if (!mir.some((m) => m[0] === c)) mir.push([c, r() < 0.5 ? '/' : '\\']); }
  const L = { W, grid, fish, mir, flat: [], items: [] }, S = initial(L);
  if (tick(L, clone(S)).moved.length) return null;
  // random play-throughs, until one wins: its moves, trimmed to the ones it needs, are the items in hand
  for (let tries = 0; tries < 8; tries++) {
    const P = clone(S), seq = [];
    for (let n = 0; n < t.items[1] + 4; n++) {
      const opts = [];
      for (const type of t.types) for (const at of spots(L, P, type)) opts.push([type, at]);
      if (!opts.length) break;
      const m = pick(r, opts);
      place(P, m[0], m[1]);
      seq.push(m);
      const res = run(L, P);
      if (res === 'win') return { L, seq: trim(L, seq) };
      if (res !== 'stop') break;
    }
  }
  return null;
}
// What a sequence of placements comes to from the start: 'win', 'lose', 'loop', 'stop', or 'bad' (a spot nobody was looking at)
function replay(L, seq) {
  const S = initial(L);
  let res = 'stop';
  for (const [type, at] of seq) {
    if (res !== 'stop' || !canPlace(L, S, type, at)) return 'bad';
    place(S, type, at);
    res = run(L, S);
  }
  return res;
}
// drop every placement the win doesn't need
function trim(L, seq) {
  for (let i = seq.length - 1; i >= 0; i--) { const s = seq.filter((_, j) => j !== i); if (replay(L, s) === 'win') seq = s; }
  return seq;
}

// Medium on: the order has to matter somewhere (some order of the answer fails), or "fish act after each item" never comes up.
function orderMatters(L, sol, r) {
  for (let k = 0; k < 12; k++) {
    const o = [...sol];
    for (let i = o.length - 1; i > 0; i--) { const j = int(r, 0, i); [o[i], o[j]] = [o[j], o[i]]; }
    if (replay(L, o) !== 'win') return true;
  }
  return false;
}

function generate(seed, tier, stats = {}) {
  const r = rng(seed), t = TIER[tier];
  for (;;) {
    stats.tries = (stats.tries || 0) + 1;
    const c = candidate(r, tier);
    if (!c || c.seq.length < t.items[0] || c.seq.length > t.items[1]) continue;
    const { seq } = c;
    if (tier !== 'E' && !orderMatters(c.L, seq, r)) continue;
    const items = seq.map((m) => m[0]).sort(), s = solve(c.L, items, t.budget);
    stats.states = (stats.states || 0) + s.states;
    if (s.over || s.spare || s.answers.length !== 1) continue;
    let L = { ...c.L, items, sol: seq };
    // scenery: predators that never swim, whatever you do with the hand. They go (unless one is all that keeps a predator from
    // seeing the fry at the start); if the level then has another answer, it's dropped.
    const keep = new Set([0, ...s.movers]);
    for (let i = L.fish.length - 1; i >= 1; i--) {
      if (keep.has(i)) continue;
      const M = { ...L, fish: L.fish.filter((_, j) => j !== i) };
      if (!tick(M, initial(M)).moved.length) L = M;
    }
    if ([...s.movers].filter((i) => i > 0).length < t.active) continue;
    if (L.fish.length !== c.L.fish.length) {
      const s2 = solve(L, items, t.budget);
      if (s2.over || s2.spare || s2.answers.length !== 1 || s2.answers[0] !== s.answers[0]) continue;
      if (tier !== 'E' && !orderMatters(L, seq, r)) continue;
    }
    return L;
  }
}

// ---------- storing ----------
// One level per line: W|grid|fish|mirrors|items|answer. fish: cell.facing.size, 'f' after a fast one; mirrors: cell then / or \;
// answer: type@spot in a working order. levels.js holds the lines build-levels.js wrote.
const line = (L) => [L.W, L.grid, L.fish.map((f) => `${f.p}.${f.d}.${f.s}${f.f ? 'f' : ''}`).join(','), L.mir.map(([c, m]) => c + m).join(','),
  L.items.join(''), L.sol.map(([t, at]) => t + '@' + at).join(',')].join('|');
function parse(s) {
  const [W, grid, fish, mir, items, sol] = s.split('|');
  return { W: +W, grid, fish: fish.split(',').map((x) => { const [p, d, z] = x.split('.'); return { p: +p, d: +d, s: parseInt(z), f: z.endsWith('f') }; }),
    mir: mir ? mir.split(',').map((x) => [parseInt(x), x.slice(-1)]) : [], flat: [], items: [...items], sol: sol.split(',').map((x) => [x[0], +x.slice(2)]) };
}

return { DR, DC, TURN, TIER, initial, clone, look, tick, run, spots, canPlace, place, search, solve, within, generate, candidate, replay, line, parse, occupancy, fishKey };
})();
if (typeof module === 'object') module.exports = Fry;
