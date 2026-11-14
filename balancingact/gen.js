// Balancing Act puzzle engine. A hanging contraption of beams; each beam end holds a plate or another beam.
// A beam balances when (mass on the left) × (left arm) = (mass on the right) × (right arm). Beams and strings weigh nothing.
// Masses are whole numbers. A balloon is a negative mass.
// The beams fix every plate's share of the total, and the store holds exactly the total: so each plate's target is set,
// and a puzzle is unique when the store splits into those targets one way only (identical items are interchangeable).
// Uses rng/int/pick from shared/common.js (a global).

// Per difficulty: plates, beam levels, longest arm, store size, items per plate (the generator's, never shown),
// fixed balloons (tied to a plate from the start) and loose ones (in the store), and whether every beam is uneven.
const TIER = {
  E: { plates: [3, 3], depth: [2, 2], arm: 4, items: [4, 5], per: 2, fixed: [0, 0], loose: [0, 0], uneven: false },
  M: { plates: [4, 5], depth: [2, 3], arm: 6, items: [6, 8], per: 3, fixed: [1, 2], loose: [0, 0], uneven: false },
  H: { plates: [5, 8], depth: [3, 4], arm: 8, items: [8, 12], per: 4, fixed: [0, 0], loose: [1, 2], uneven: true },
};
const LO = 1, HI = 10; // item sizes

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const sum = (xs) => xs.reduce((s, x) => s + x, 0);

// A random tree with n plates and depth (beam levels) at most d: a plate is a number (its index, left to right), a beam is { a, b, l, r }.
function shape(rand, n, d, next = { i: 0 }) {
  if (n === 1) return next.i++;
  const cap = 2 ** (d - 1), lo = Math.max(1, n - cap), hi = Math.min(n - 1, cap);
  const k = int(rand, lo, hi);
  return { a: 0, b: 0, l: shape(rand, k, d - 1, next), r: shape(rand, n - k, d - 1, next) };
}
const depth = (t) => (typeof t === 'number' ? 0 : 1 + Math.max(depth(t.l), depth(t.r)));
const beams = (t) => (typeof t === 'number' ? [] : [t, ...beams(t.l), ...beams(t.r)]);

// Pick every beam's arms, bottom up, and return the smallest whole plate masses that balance them all: [[plate, mass]].
// Arms are chosen among those that keep the masses small (cap), so a level's numbers stay in range.
function arms(rand, t, T, cap) {
  if (typeof t === 'number') return [[t, 1]];
  const L = arms(rand, t.l, T, cap), R = arms(rand, t.r, T, cap);
  if (!L || !R) return null;
  const tl = sum(L.map((x) => x[1])), tr = sum(R.map((x) => x[1])), opts = [];
  for (let a = 1; a <= T.arm; a++) for (let b = 1; b <= T.arm; b++) {
    if (T.uneven && a === b) continue;
    const m = (tl * a * tr * b) / gcd(tl * a, tr * b), kl = m / (tl * a), kr = m / (tr * b);
    const v = [...L.map(([p, x]) => [p, x * kl]), ...R.map(([p, x]) => [p, x * kr])], g = v.reduce((s, x) => gcd(s, x[1]), 0);
    const out = v.map(([p, x]) => [p, x / g]);
    if (Math.max(...out.map((x) => x[1])) <= cap) opts.push([a, b, out]);
  }
  if (!opts.length) return null;
  const [a, b, out] = pick(rand, opts);
  t.a = a;
  t.b = b;
  return out;
}

// k item sizes in [LO, HI] adding up to s, or null
function split(rand, s, k) {
  if (s < LO * k || s > HI * k) return null;
  const out = [];
  for (let left = k; left > 1; left--) {
    const v = int(rand, Math.max(LO, s - HI * (left - 1)), Math.min(HI, s - LO * (left - 1)));
    out.push(v);
    s -= v;
  }
  return [...out, s];
}

// How many ways the loose items (signed sizes) fill the plates' needs exactly (need[p] = what the loose items on plate p must add up to),
// identical items being interchangeable. Stops counting at `stop`. Balloons go first; then weights, largest first, never overfilling a plate.
function count(need, items, stop = 2) {
  // negatives first (most negative first), then positives largest first
  const groups = [...items.reduce((m, v) => m.set(v, (m.get(v) || 0) + 1), new Map())].sort((x, y) => (x[0] < 0 && y[0] < 0 ? x[0] - y[0] : x[0] < 0 ? -1 : y[0] < 0 ? 1 : y[0] - x[0]));
  const rem = [...need], P = rem.length;
  let found = 0;
  function group(g) {
    if (found >= stop) return;
    if (g === groups.length) { if (rem.every((x) => x === 0)) found++; return; }
    const [v, c] = groups[g];
    // c copies of v over plates p.. : each plate takes some
    (function plate(p, left) {
      if (found >= stop) return;
      if (p === P - 1) {
        rem[p] -= v * left;
        if (v < 0 || rem[p] >= 0) group(g + 1);
        rem[p] += v * left;
        return;
      }
      for (let x = 0; x <= left; x++) {
        if (v > 0 && rem[p] - v * x < 0) break;
        rem[p] -= v * x;
        plate(p + 1, left - x);
        rem[p] += v * x;
      }
    })(0, c);
  }
  group(0);
  return found;
}

// { tree, plates: P, fixed: [{ plate, v }] (balloons tied on, v > 0 is how hard each lifts), items: [{ v, plate }] (the store, v < 0 a balloon;
// plate = where the answer puts it), target: [net mass per plate] }. Items are sorted: weights small to large, then balloons.
function generate(seed, tier) {
  const T = TIER[tier], rand = rng(seed);
  for (;;) {
    const P = int(rand, T.plates[0], T.plates[1]), tree = shape(rand, P, T.depth[1]);
    if (depth(tree) < T.depth[0]) continue;
    const base = arms(rand, tree, T, Math.floor((T.per * HI) / 2));
    if (!base || beams(tree).every((b) => b.a === b.b)) continue;
    const unit = base.sort((x, y) => x[0] - y[0]).map((x) => x[1]);
    // scale the smallest masses up: every plate between one smallest item and a full plate
    const cs = [];
    for (let c = 1; c * Math.max(...unit) <= T.per * HI; c++) if (c * Math.min(...unit) >= LO) cs.push(c);
    if (!cs.length) continue;
    const c = pick(rand, cs), target = unit.map((x) => x * c);
    for (let tries = 0; tries < 40; tries++) {
      const r = deal(rand, T, target);
      if (r && count(r.need, r.items.map((x) => x.v)) === 1) {
        const items = r.items.sort((x, y) => (x.v < 0) - (y.v < 0) || Math.abs(x.v) - Math.abs(y.v) || x.plate - y.plate);
        return { tree, plates: P, fixed: r.fixed, items, target };
      }
    }
  }
}

// One way to fill the targets: how many items each plate gets, balloons placed, sizes split. Or null.
function deal(rand, T, target) {
  const P = target.length, n = int(rand, Math.max(T.items[0], P + 1), Math.min(T.items[1], P * T.per));
  if (n < T.items[0]) return null;
  // items per plate: one each, then the rest at random (at most T.per)
  const k = Array(P).fill(1);
  for (let left = n - P; left > 0;) { const p = int(rand, 0, P - 1); if (k[p] < T.per) { k[p]++; left--; } }
  const ps = [...Array(P).keys()], fixed = [], items = [], need = [...target];
  const fx = int(rand, T.fixed[0], T.fixed[1]), lx = int(rand, T.loose[0], T.loose[1]);
  // fixed balloons: on distinct plates; the plate's weights make up for them
  for (let i = 0; i < fx; i++) {
    const p = ps.splice(int(rand, 0, ps.length - 1), 1)[0], v = int(rand, LO, HI);
    fixed.push({ plate: p, v });
    need[p] += v;
  }
  // loose balloons: on distinct plates with room for a weight beside them
  const room = ps.filter((p) => k[p] >= 2);
  if (room.length < lx) return null;
  const lifts = Array(P).fill(0);
  for (let i = 0; i < lx; i++) {
    const p = room.splice(int(rand, 0, room.length - 1), 1)[0], v = int(rand, LO, HI);
    items.push({ v: -v, plate: p });
    lifts[p] = v;
  }
  for (let p = 0; p < P; p++) {
    const ws = split(rand, need[p] + lifts[p], k[p] - (lifts[p] ? 1 : 0));
    if (!ws) return null;
    for (const v of ws) items.push({ v, plate: p });
  }
  return { fixed: fixed.sort((x, y) => x.plate - y.plate), items, need };
}

// Net mass per plate for a placement (at[i] = item i's plate, or -1 in the store), fixed balloons included
function masses(p, at) {
  const m = Array(p.plates).fill(0);
  for (const f of p.fixed) m[f.plate] -= f.v;
  p.items.forEach((it, i) => { if (at[i] >= 0) m[at[i]] += it.v; });
  return m;
}
// Every beam's turn (right side down positive; 0 is level) and the mass under each subtree: [{ beam, torque, left, right }]
function torques(tree, m) {
  const out = [];
  (function walk(t) {
    if (typeof t === 'number') return m[t];
    const l = walk(t.l), r = walk(t.r);
    out.push({ beam: t, torque: r * t.b - l * t.a, left: l, right: r });
    return l + r;
  })(tree);
  return out;
}
const balanced = (p, at) => at.every((x) => x >= 0) && torques(p.tree, masses(p, at)).every((x) => x.torque === 0);

if (typeof module === 'object') module.exports = { TIER, LO, HI, shape, depth, beams, count, generate, masses, torques, balanced };
