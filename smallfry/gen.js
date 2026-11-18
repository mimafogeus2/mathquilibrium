// Small Fry engine: the tank, who sees what, how fish swim, and the search that proves a level has one answer. No DOM:
// game.js (as the global Fry), build-levels.js and test.js all use it. The generator uses rng/int/pick from shared/common.js (a global).
//
// The tank is W×W cells, its border all rock. A cell is rock '#', water '.', or the exit 'X' (a gap in the border).
// Fish: { p: cell, d: facing (0 up, 1 right, 2 down, 3 left), s: size (the fry is 1), f: fast, w: patroller }. fish[0] is the fry.
// Mirrors: diagonal ones ('/' '\') sit on water cells; flat ones are bolted to a rock face, kept per water cell as a bitmask
// of the directions it has one toward (a look heading into that face turns right round).
// Items the player places: '/' '\' (on a water cell), 'F' (a flat mirror, on a rock face), 'B' (bait, on a water cell).
// A spot is a cell for '/', '\' and 'B', and cell * 4 + direction for 'F'.

const Fry = (() => {
const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];
const TURN = { '/': [1, 0, 3, 2], '\\': [3, 2, 1, 0] };
// W: the tank with its rock border; water: how much of the inside the cave opens up; rooms, turn: how roomy and winding it is.
// items: hand size; beats: complications added to the escape; preds: fish besides the fry, at least. fixed, fast, patrol: whether
// bolted mirrors, fast fish and patrollers can be complications. tries: complications tried per beat; open: extra pockets tried.
// budget: positions a search may visit. minStates: positions the finished level's search must reach (room to go wrong).
// escape: item kinds the first escape may use (default: types). distinct: no two complications of the same kind.
// order: the share of levels where the order of the answer must matter (default all). A type listed twice is tried first
// twice as often.
const TIER = {
  E: { W: 9, water: .45, rooms: .18, turn: .33, items: [3, 3], beats: [2, 2], preds: [1, 2], types: '//\\\\F', fixed: 0, fast: 0, patrol: 0, tries: 60, open: 5, budget: 3e4, minStates: 20, distinct: true, order: .5, escape: '/\\' },
  M: { W: 10, water: .5, rooms: .2, turn: .3, items: [3, 5], beats: [2, 3], preds: [2, 4], types: '/\\FB', fixed: 1, fast: 0, patrol: 1, tries: 40, open: 6, budget: 1e5, minStates: 60 },
  H: { W: 12, water: .52, rooms: .25, turn: .3, items: [5, 6], beats: [3, 4], preds: [3, 5], types: '/\\FB', fixed: 1, fast: .3, patrol: 1, tries: 50, open: 8, budget: 2e5, minStates: 300 },
  I: { W: 14, water: .55, rooms: .25, turn: .3, items: [6, 7], beats: [4, 5], preds: [4, 6], types: '/\\FB', fixed: 1, fast: .4, patrol: 1, tries: 60, open: 10, budget: 3e5, minStates: 800 },
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
// way it swims; and one that sees a smaller fish swimming into its look this tick goes for it at the same moment. Then any fish
// that met a bigger one is eaten: they end in the same cell, a fast fish's path crosses it, or the two swim through each other
// head on. The fry swimming into the exit gets away; into bait, eats it.
// Returns { moved: [i], eaten: [i], paths: [[cells, from the start]], turns: [[facing at the start, then on leaving each cell]],
// won, lost }. S changes in place.
function tick(L, S) {
  const occ = occupancy(L, S), plan = [], moving = new Set(), looks = [];
  const go = (i, v, t) => {
    const f = S.fish[i], k = Math.min(f.f ? 2 : 1, t + 1);
    plan.push({ i, old: f.p, from: f.d, cells: v.sc.slice(0, k), dirs: v.sd.slice(0, k), d: v.sd[k - 1] });
    moving.add(i);
  };
  for (let i = 0; i < S.fish.length; i++) {
    if (!S.fish[i].a || S.fish[i].w) continue;
    looks[i] = look(L, S, i, occ);
    if (looks[i].t >= 0) go(i, looks[i], looks[i].t);
  }
  // Patrollers (w) want nothing and chase nothing: whenever anything else swims, each swims one cell along its axis, turning
  // back at rock (and at the exit). They still eat what they run into, and get eaten.
  if (plan.length) for (let i = 0; i < S.fish.length; i++) {
    const f = S.fish[i];
    if (!f.a || !f.w) continue;
    const step = (d) => f.p + DR[d] * L.W + DC[d], open = (c) => L.grid[c] === '.';
    const d = open(step(f.d)) ? f.d : open(step(f.d ^ 2)) ? f.d ^ 2 : -1;
    if (d >= 0) { plan.push({ i, old: f.p, from: f.d, cells: [step(d)], dirs: [d], d }); moving.add(i); }
  }
  // A fish sees a smaller one swimming into its look as it starts to swim, and goes for it in the same tick: the first cell
  // of its look that a smaller fish is entering is its target. Whoever sets off that way can set off a bigger fish in turn.
  for (let more = plan.length > 0; more;) {
    more = false;
    for (let i = 0; i < S.fish.length; i++) {
      if (!S.fish[i].a || moving.has(i) || S.fish[i].w) continue;
      const v = looks[i], t = v.sc.findIndex((c) => plan.some((m) => S.fish[m.i].s < S.fish[i].s && m.cells.includes(c)));
      if (t >= 0) { go(i, v, t); more = true; }
    }
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
    const key = fz(S, 1) + ',' + fz(S, 2) + ',' + S.nb;
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
    if (!S.fish[i].a || S.fish[i].w) continue; // a patroller looks at nothing
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
// Positions are remembered by a 64-bit fingerprint (two 32-bit Zobrist hashes): each placement and each fish's cell and facing
// has its own random-looking code, XORed together, so a position's key costs a few XORs instead of sorting and joining text.
// stop(ms): called on every win with its sorted item types; returning true ends the search there.
const mix = (n) => { n = Math.imul(n ^ (n >>> 16), 0x7feb352d); n = Math.imul(n ^ (n >>> 15), 0x846ca68b); return (n ^ (n >>> 16)) >>> 0; };
const TYPE_ID = { '/': 1, '\\': 2, F: 3, B: 4 };
// the fish part of a fingerprint: where each fish is and which way it faces (or that it's gone)
function fz(S, salt) { let h = salt; for (let i = 0; i < S.fish.length; i++) { const f = S.fish[i]; h ^= mix((i * 4099 + (f.a ? f.p * 4 + f.d : 9999)) * 2 + salt); } return h; }
function search(L, left, max, budget, S0 = initial(L), keep = 2, stop = null) {
  const seen = new Set(), wins = new Map(), placed = [], movers = new Set();
  let states = 0, over = false, halt = false, z1 = 0, z2 = 0;
  (function dfs(S) {
    const key = (z1 ^ fz(S, 1)) + ',' + (z2 ^ fz(S, 2)) + ',' + S.nb;
    if (seen.has(key)) return;
    seen.add(key);
    if (++states > budget) { over = true; return; }
    for (const type in left) {
      if (!left[type]) continue;
      for (const at of spots(L, S, type)) {
        // mirrors don't move while fish swim: place on the shared board and take it off after, copying only fish (and bait)
        const T = { fish: S.fish.map((f) => ({ ...f })), mir: S.mir, flat: S.flat, bait: S.nb || type === 'B' ? S.bait.slice() : S.bait, nb: S.nb, out: S.out };
        const code = TYPE_ID[type] * 100003 + at;
        place(T, type, at);
        left[type]--;
        placed.push(type + '@' + at);
        z1 ^= mix(code * 2 + 1); z2 ^= mix(code * 2 + 2);
        const r = run(L, T, 500, movers);
        if (r === 'win') {
          const ms = placed.map((p) => p[0]).sort().join(''), ans = [...placed].sort().join(' ');
          if (!wins.has(ms)) wins.set(ms, new Map());
          if (wins.get(ms).size < keep && !wins.get(ms).has(ans)) wins.get(ms).set(ans, [...placed]);
          if (stop && stop(ms)) halt = true;
        } else if (r === 'stop' && placed.length < max) dfs(T);
        z1 ^= mix(code * 2 + 1); z2 ^= mix(code * 2 + 2);
        if (type === 'F') S.flat[at >> 2] &= ~(1 << (at & 3)); else if (type !== 'B') S.mir[at] = '';
        left[type]++;
        placed.pop();
        if (over || halt) return;
      }
    }
  })(S0);
  return { wins, movers, states, over };
}
// A cheap look before the full proof: within a small budget, does the exact hand win ('win'), does a smaller part of it win
// ('spare', and the candidate is out), or neither ('none')? Most dead-end candidates are dropped here for a fraction of the cost.
function probe(L, items, budget) {
  const target = [...items].sort().join('');
  let res = 'none';
  search(L, count(items), items.length, budget, initial(L), 1, (ms) => { res = ms === target ? 'win' : 'spare'; return true; });
  return res;
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
// A level is built as a story, beat by beat, so every part has a job:
// 1. Carve a cave out of solid rock (W×W, corridors and pockets), cut an exit, put the fry in it, and find its simplest way out
//    with the fewest items (the escape: one or two mirrors).
// 2. Add a complication: a guard watching the fry's route, a fish parked in the way, a patroller crossing it, a bigger fish set
//    near a smaller one, rock in the way, a bolted mirror. It's kept only if the current answer no longer works and the hand
//    plus one more item (any kind the tier allows) wins again, with no smaller hand winning. So whatever it added either takes
//    part in the new answer or is what rules out the easier one.
// 3. Repeat for the tier's beats, preferring complications that leave more to try (more spots in view), not just longer ones.
// 4. Open a few extra pockets where that keeps the level sound and gives more room to go wrong, then drop anything that turned
//    idle along the way: a fish that never swims in any answer and whose removal lets no smaller hand win, a bolted mirror no
//    answer needs.
// Several answers are fine; each must use the whole hand. Budgets bound every search: a candidate that needs more is dropped.
const SAFE = 3;
function cave(r, t) {
  const W = t.W, g = Array(W * W).fill('#'), inner = (c) => c % W > 0 && c % W < W - 1 && c >= W && c < W * (W - 1);
  let c = W * int(r, 2, W - 3) + int(r, 2, W - 3), open = 0, d = int(r, 0, 3);
  const want = Math.round((W - 2) * (W - 2) * t.water);
  for (let n = 0; open < want && n < 5000; n++) {
    if (g[c] === '#') { g[c] = '.'; open++; }
    // pockets: now and then a 2×2 room
    if (r() < t.rooms) for (const k of [c + 1, c + W, c + W + 1]) if (inner(k) && g[k] === '#') { g[k] = '.'; open++; }
    if (r() < t.turn) d = int(r, 0, 3);
    const n2 = c + DR[d] * W + DC[d];
    if (inner(n2)) c = n2; else d = int(r, 0, 3);
  }
  const gaps = [];
  for (let i = 1; i < W - 1; i++) for (const [e, n] of [[i, i + W], [W * (W - 1) + i, W * (W - 2) + i], [i * W, i * W + 1], [i * W + W - 1, i * W + W - 2]]) if (g[n] === '.') gaps.push(e);
  if (!gaps.length) return null;
  g[pick(r, gaps)] = 'X';
  return g.join('');
}
// What playing seq does: the result, every cell each fish passes through, and who swam
function trace(L, seq) {
  const S = initial(L), cells = L.fish.map(() => []), movers = new Set();
  let res = 'stop';
  for (const [type, at] of seq) {
    if (res !== 'stop' || !canPlace(L, S, type, at)) return { res: 'bad', cells, movers };
    place(S, type, at);
    for (let n = 0; n < 500; n++) {
      const t = tick(L, S);
      t.moved.forEach((i, k) => { movers.add(i); cells[i].push(...t.paths[k].slice(1)); });
      if (t.lost) { res = 'lose'; break; }
      if (t.won) { res = 'win'; break; }
      if (!t.moved.length) break;
    }
  }
  return { res, cells, movers };
}
// A level's verdict for a hand: its answers (working orders, up to a few), whether a smaller hand wins, the positions searched
function verdict(L, items, budget) {
  const s = search(L, count(items), items.length, budget, initial(L), 4), ms = [...items].sort().join('');
  return { orders: [...(s.wins.get(ms)?.values() || [])].map((o) => o.map((p) => [p[0], +p.slice(2)])), spare: [...s.wins.keys()].some((k) => within(k, ms)), over: s.over, states: s.states };
}
const sound = (v) => !v.over && !v.spare && v.orders.length > 0;
const still = (L) => !tick(L, initial(L)).moved.length; // nobody sees what they want before anything is placed
const withFish = (L, f) => ({ ...L, fish: [...L.fish, f] });

// One complication on L, around the fry's route (cells it swims through in the current answer). Returns a new L, or null.
function complicate(r, L, t, route, avoid = new Set(), fishOnly = false) {
  const W = L.W, g = L.grid, water = [...g].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
  const free = (c) => g[c] === '.' && !L.fish.some((f) => f.p === c) && !L.mir.some((m) => m[0] === c);
  const used = new Set(L.fish.map((f) => f.s)), sizes = [2, 3, 4, 5, 6, 7].filter((s) => !used.has(s));
  if (!sizes.length) return null;
  const size = pick(r, sizes), fast = t.fast && r() < t.fast;
  const kinds = ['guard', 'guard', 'block', 'rock', 'hunter', 'hunter', ...(t.patrol ? ['patrol'] : []), ...(t.fixed ? ['fixed'] : [])];
  const kind = pick(r, kinds.filter((k) => !avoid.has(k) && (!fishOnly || !['rock', 'fixed'].includes(k)))), pc = pick(r, route.length ? route : water);
  if (!kind) return null;
  if (kind === 'guard') { // a fish a few cells off the route, looking at it
    const d = int(r, 0, 3), k = int(r, 1, 4);
    let c = pc;
    for (let i = 0; i < k; i++) { const n = c - DR[d] * W - DC[d]; if (g[n] !== '.') return null; c = n; }
    return free(c) ? { ...withFish(L, { p: c, d, s: size, f: fast }), kind, note: `a ${size} watching the fry's route` } : null;
  }
  if (kind === 'block') return free(pc) && pc !== L.fish[0].p ? { ...withFish(L, { p: pc, d: int(r, 0, 3), s: size, f: false }), kind, note: `a ${size} parked on the fry's route` } : null;
  if (kind === 'patrol') { // a patroller on a line through the route, a little way off it
    const d = int(r, 0, 3), k = int(r, 1, 3);
    let c = pc;
    for (let i = 0; i < k; i++) { const n = c - DR[d] * W - DC[d]; if (g[n] !== '.') break; c = n; }
    return free(c) && c !== pc ? { ...withFish(L, { p: c, d, s: size, f: false, w: true }), kind, note: `a ${size} patrolling across the fry's route` } : null;
  }
  if (kind === 'hunter') { // a bigger fish looking at an existing one from a few cells off
    const prey = pick(r, L.fish.slice(1));
    if (!prey) return null;
    const big = sizes.filter((s) => s > prey.s);
    if (!big.length) return null;
    const d = int(r, 0, 3);
    let c = prey.p;
    for (let i = int(r, 2, 4); i > 0; i--) { const n = c - DR[d] * W - DC[d]; if (g[n] !== '.') return null; c = n; }
    // facing away: the player has to turn its look onto the prey
    const hs = pick(r, big);
    return free(c) ? { ...withFish(L, { p: c, d: int(r, 0, 3), s: hs, f: fast }), kind, note: `a ${hs} near the ${prey.s}, looking elsewhere` } : null;
  }
  if (kind === 'rock') { // rock on the route: a detour
    if (!free(pc) || pc === L.fish[0].p) return null;
    const ng = g.slice(0, pc) + '#' + g.slice(pc + 1);
    return { ...L, grid: ng, kind, note: 'rock across the fry\'s route' };
  }
  if (kind === 'fixed') return free(pc) ? { ...L, mir: [...L.mir, [pc, r() < .5 ? '/' : '\\']], kind, note: 'a bolted mirror on the fry\'s route' } : null;
  return null;
}

// drop parts that no answer uses: fish that never swim and rule nothing out, bolted mirrors no answer needs
function prune(L, budget) {
  let v = verdict(L, L.items, budget);
  if (!sound(v)) return null;
  for (let i = L.fish.length - 1; i >= 1; i--) {
    if (v.orders.every((o) => trace(L, o).movers.has(i))) continue; // swims in every answer
    const M = { ...L, fish: L.fish.filter((_, j) => j !== i) };
    if (!still(M)) continue; // it shields the fry from the start
    const vm = verdict(M, L.items, budget);
    if (vm.over) return null; // can't tell within the budget: drop the level rather than keep a fish that may be idle
    if (vm.spare || !vm.orders.length) continue; // without it a smaller hand wins (or nothing does): it's doing its job
    // it doesn't swim in every answer, and removing it changes nothing: take it out
    L = { ...M, sol: vm.orders[0] };
    v = vm;
  }
  for (let i = L.mir.length - 1; i >= 0; i--) {
    const M = { ...L, mir: L.mir.filter((_, j) => j !== i) };
    if (!still(M)) continue;
    const vm = verdict(M, L.items, budget);
    if (vm.over) return null;
    if (!vm.spare && vm.orders.length) { L = { ...M, sol: vm.orders[0] }; v = vm; }
  }
  return { L, v };
}

function generate(seed, tier, stats = {}) {
  const r = rng(seed), t = TIER[tier];
  for (let attempt = 0; ; attempt++) {
    stats.tries = attempt + 1;
    const grid = cave(r, t);
    if (!grid) continue;
    const water = [...grid].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
    let L = { W: t.W, grid, fish: [{ p: pick(r, water), d: int(r, 0, 3), s: 1, f: false }], mir: [], flat: [], items: [], sol: [] };
    if (!still(L)) continue;
    // the escape: the smallest hand that wins
    const left = {};
    for (const ty of t.escape || t.types) left[ty] = 2;
    const s0 = search(L, left, 2, t.budget, initial(L), 1);
    if (s0.over || !s0.wins.size) continue;
    const ms = [...s0.wins.keys()].sort((a, b) => a.length - b.length)[0];
    if ([...s0.wins.keys()].some((k) => within(k, ms))) continue;
    L.items = [...ms];
    L.sol = [...s0.wins.get(ms).values()][0].map((p) => [p[0], +p.slice(2)]);
    const story = [`escape with ${ms}`];
    // beats. Each step on the stack is a level and its story so far; when no complication fits, back up a step and try another
    // there (a few times) before giving up on the cave.
    // plan the hand: pick its size, then as many complications as the escape leaves room for (each adds one item)
    const beats = Math.min(t.beats[1], Math.max(t.beats[0], int(r, t.items[0], t.items[1]) - L.items.length)), stack = [{ L, story, kinds: new Set() }];
    if (L.items.length + beats < t.items[0] || L.items.length + beats > t.items[1]) continue;
    for (let backs = 0; stack.length <= beats;) {
      const cur = stack[stack.length - 1], route = trace(cur.L, cur.L.sol).cells[0];
      let next = null;
      for (let k = 0; k < t.tries && !next; k++) {
        // enough fish by the end: when the fish still missing match the steps left, only fish-adding complications
        const fishOnly = t.preds[0] - (cur.L.fish.length - 1) >= beats - (stack.length - 1);
        const M = complicate(r, cur.L, t, route, t.distinct ? cur.kinds : undefined, fishOnly);
        if (!M || !still(M) || trace(M, cur.L.sol).res === 'win') continue; // it has to break the current answer
        // a type listed twice in t.types comes up first more often; each is tried once
        for (const ty of [...new Set([...t.types].sort(() => r() - .5))]) {
          const items = [...M.items, ty].sort();
          stats.probes = (stats.probes || 0) + 1;
          if (probe(M, items, t.probe || 4000) !== 'win') continue;
          const v = verdict(M, items, t.budget);
          stats.verdicts = (stats.verdicts || 0) + 1;
          if (sound(v)) stats.sound = (stats.sound || 0) + 1; else if (v.over) stats.overs = (stats.overs || 0) + 1;
          stats.states = (stats.states || 0) + v.states;
          if (!sound(v)) continue;
          const { note, kind, ...rest } = M;
          next = { L: { ...rest, items, sol: v.orders[0] }, story: [...cur.story, `${note}: the old answer fails; now it takes one more ${ty}`], kinds: new Set([...cur.kinds, kind]) };
          break;
        }
      }
      if (next) stack.push(next);
      else if (stack.length > 1 && backs++ < 4) stack.pop();
      else break;
    }
    const ok = stack.length > beats;
    ({ L } = stack[stack.length - 1]);
    story.splice(0, story.length, ...stack[stack.length - 1].story);
    const rej = (why) => { (stats.rej ??= {})[why] = (stats.rej[why] || 0) + 1; };
    if (!ok) { rej('beats'); continue; }
    if (L.items.length < t.items[0] || L.items.length > t.items[1]) { rej('hand size'); continue; }
    // extra room: open rock next to water where that keeps the level sound
    for (let k = 0; k < t.open; k++) {
      const W = L.W, cand = [...L.grid].map((ch, i) => i).filter((i) => L.grid[i] === '#' && i % W > 0 && i % W < W - 1 && i >= W && i < W * (W - 1) &&
        [1, -1, W, -W].some((dd) => L.grid[i + dd] === '.'));
      if (!cand.length) break;
      const c = pick(r, cand), M = { ...L, grid: L.grid.slice(0, c) + '.' + L.grid.slice(c + 1) };
      if (!still(M)) continue;
      const v = verdict(M, M.items, t.budget);
      if (sound(v)) L = { ...M, sol: v.orders[0] };
    }
    const p = prune(L, t.budget);
    if (!p) { rej('prune'); continue; }
    if (p.L.fish.length - 1 < t.preds[0]) { rej('too few fish'); continue; }
    if (p.v.states < t.minStates) { rej('too little room'); continue; }
    if (r() < (t.order ?? 1) && !orderMatters(p.L, p.L.sol, r)) { rej('order'); continue; }
    stats.answers = p.v.orders.length;
    if (p.L.fish.length !== L.fish.length || p.L.mir.length !== L.mir.length) story.push('pruned what no answer needed');
    stats.story = story;
    stats.states = p.v.states;
    return p.L;
  }
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
// Medium on: the order has to matter somewhere (some order of the answer fails), or "fish act after each item" never comes up.
function orderMatters(L, sol, r) {
  for (let k = 0; k < 12; k++) {
    const o = [...sol];
    for (let i = o.length - 1; i > 0; i--) { const j = int(r, 0, i); [o[i], o[j]] = [o[j], o[i]]; }
    if (replay(L, o) !== 'win') return true;
  }
  return false;
}

// ---------- storing ----------
// One level per line: W|grid|fish|mirrors|items|answer. fish: cell.facing.size, then 'f' for a fast one, 'p' for a patroller
// (facing: the way it's heading); mirrors: cell then / or \;
// answer: type@spot in a working order. levels.js holds the lines build-levels.js wrote.
const line = (L) => [L.W, L.grid, L.fish.map((f) => `${f.p}.${f.d}.${f.s}${f.f ? 'f' : ''}${f.w ? 'p' : ''}`).join(','), L.mir.map(([c, m]) => c + m).join(','),
  L.items.join(''), L.sol.map(([t, at]) => t + '@' + at).join(',')].join('|');
function parse(s) {
  const [W, grid, fish, mir, items, sol] = s.split('|');
  return { W: +W, grid, fish: fish.split(',').map((x) => { const [p, d, z] = x.split('.'); return { p: +p, d: +d, s: parseInt(z), f: z.includes('f'), w: z.includes('p') }; }),
    mir: mir ? mir.split(',').map((x) => [parseInt(x), x.slice(-1)]) : [], flat: [], items: [...items], sol: sol.split(',').map((x) => [x[0], +x.slice(2)]) };
}

return { DR, DC, TURN, TIER, initial, clone, look, tick, run, spots, canPlace, place, search, solve, verdict, trace, within, generate, replay, line, parse, occupancy, fishKey };
})();
if (typeof module === 'object') module.exports = Fry;
