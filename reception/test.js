// node reception/test.js [all] — the rules on tiny hand-made boards, the search against a brute force on small levels, then
// levels: each is won by its answer, no smaller set of its hand wins, its answers are few, and it's deterministic.
// Easy, Medium and Hard are generated (40 levels and 10 dailies each, or all with `all`); Impossible's dailies come from levels.js.
const assert = require('assert');
Object.assign(globalThis, require('../shared/common.js'));
const R = require('./gen.js');
const { prep, coverage, met, solve, generate, line, parse, TIER, isAnt, ROT, neighbours } = R;
const all = process.argv[2] === 'all';

// ---------- rules ----------
const lv = (rows, req, hand, sol = []) => ({ N: rows.length, ground: rows.join(''), req: req.join(''), hand, sol });
const cov = (L, place, noLos) => [...coverage(prep(L), place, noLos).cov];
// a mast of grade 3 on a low roof in the middle of 5×5: 3, 2 next to it, 1 two steps off, nothing beyond
{
  const L = lv(['.....', '.....', '..a..', '.....', '.....'], ['00000', '00000', '00000', '00000', '00000'], ['M3']);
  assert.deepStrictEqual(cov(L, [[12, 0]]), [0, 0, 1, 0, 0, 0, 1, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 1, 0, 0, 0, 1, 0, 0]);
}
// a high roof adds 2 range at the far value: the mast's 1s reach 4 steps
{
  const L = lv(['.......', '.......', '.......', '...c...', '.......', '.......', '.......'], Array(7).fill('0000000'), ['M2']);
  const c = cov(L, [[24, 0]]);
  assert.strictEqual(c[24], 2);
  assert.strictEqual(c[3], 1); // 3 up
  assert.strictEqual(c[0], 0); // 6 steps
}
// line of sight: a taller building blocks what's behind it, but gets signal itself; one as tall doesn't
{
  const L = lv(['a2..', '....', '....', '....'], Array(4).fill('0000'), ['D2']);
  assert.deepStrictEqual(cov(L, [[0, 1]]).slice(0, 4), [2, 2, 0, 0]);
  assert.deepStrictEqual(cov(L, [[0, 1]], true).slice(0, 4), [2, 2, 2, 2]); // without blocking
  const L2 = lv(['b2..', '....', '....', '....'], Array(4).fill('0000'), ['D2']);
  assert.deepStrictEqual(cov(L2, [[0, 1]]).slice(0, 4), [2, 2, 2, 2]);
  // a lifter next to it raises it over the block
  const L3 = lv(['a2..', 'a...', '....', '....'], Array(4).fill('0000'), ['D2', 'l']);
  assert.deepStrictEqual(cov(L3, [[0, 1], [4, 0]]).slice(0, 4), [2, 2, 2, 2]);
}
// panel: a wedge, 1 then 3 then 5 wide; a splitter fires it both ways; a booster adds 1 everywhere it reaches
{
  const L = lv(['.......', '.......', '.......', 'a..a...', '.......', '.......', '.......'], Array(7).fill('0000000'), ['P2', 's']);
  const c = cov(L, [[21, 1], null]);
  assert.deepStrictEqual([c[21], c[22], c[23], c[24]], [2, 2, 2, 1]); // own, f1 2, f2 2, f3 1
  assert.strictEqual(c[15], 0); // f1 is one wide
  assert.strictEqual(c[16], 2); // f2 is three wide
  const L2 = lv(['.......', '.......', '.......', '...a...', '...a...', '.......', '.......'], Array(7).fill('0000000'), ['P2', 's']);
  const t = cov(L2, [[24, 1], [31, 0]]);
  assert.strictEqual(t[23], 2); // fires west too
  const L3 = lv(['.......', '.......', '.......', '...a...', '...a...', '.......', '.......'], Array(7).fill('0000000'), ['P2', 'b']);
  assert.strictEqual(cov(L3, [[24, 1], [31, 0]])[25], 3);
}
// ring: nothing on its roof or next to it; the squares 2 away
{
  const L = lv(['.....', '.....', '..a..', '.....', '.....'], Array(5).fill('00000'), ['O1']);
  const c = cov(L, [[12, 0]]);
  assert.deepStrictEqual([c[12], c[7], c[6], c[2], c[0]], [0, 0, 0, 1, 1]);
}
// amplifiers: on only when their own square has enough already; a chain wakes one after another; two can't wake each other
{
  const pad = ['.....', '.....', '.....', '.....'], z = Array(5).fill('00000');
  const L = lv(['aaa..', ...pad], z, ['C2', 'C2^2', 'C2^2']);
  assert.deepStrictEqual(coverage(prep(L), [[0, 0], [1, 0], [2, 0]]).on, [true, true, true]);
  assert.deepStrictEqual(coverage(prep(L), [null, [1, 0], [2, 0]]).on, [false, false, false]);
  const L2 = lv(['aaa..', ...pad], z, ['C1', 'C2^2', 'C2^2']);
  assert.deepStrictEqual(coverage(prep(L2), [[0, 0], [1, 0], [2, 0]]).on, [true, false, false]); // 1 isn't 2
}

// ---------- the search, against every placement tried one by one ----------
function brute(L) {
  const P = prep(L), K = P.hand.length, opts = P.hand.map((pc) => [null, ...P.roofs.flatMap((c) => (ROT.includes(pc.k) ? [0, 1, 2, 3] : [0]).map((d) => [c, d]))]);
  let partial = false;
  const fulls = new Set(), place = [];
  (function go(i) {
    if (i === K) {
      const cells = place.filter(Boolean).map((p) => p[0]);
      if (new Set(cells).size !== cells.length || !met(P, coverage(P, place).cov)) return;
      if (place.some((p) => !p)) partial = true;
      // a modifier next to no antenna does nothing: the same as leaving it out
      else if (place.some((p, j) => !isAnt(P.hand[j].k) && !neighbours(P.N, p[0]).some((m) => place.some((q, a) => q && q[0] === m && isAnt(P.hand[a].k))))) partial = true;
      else fulls.add(place.map((p, j) => P.hand[j].code + '@' + p).sort().join(' '));
      return;
    }
    for (const o of opts[i]) { place[i] = o; go(i + 1); }
    place[i] = undefined;
  })(0);
  return { partial, full: fulls.size };
}
{
  let checked = 0;
  const kinds = { partial: 0, many: 0, one: 0 };
  for (let s = 0; checked < 60; s++) {
    const r = rng(s), T = TIER.E, N = 5, { ground } = R.city(r, N, T), hand = R.dealHand(r, { ...T, ants: 'MCXPDO', mods: 'bels', nMod: [0, 1] }, int(r, 2, 3));
    const roofs = [...Array(ground.length).keys()].filter((c) => R.height(ground[c])).sort(() => r() - 0.5).slice(0, 5);
    if (roofs.length < hand.length) continue;
    const g = [...ground].map((ch, c) => (roofs.includes(c) ? 'abc'[ch - 1] : ch)).join('');
    // the requirement: what a random placement of the hand covers, mostly in full, so there's an answer to find
    const P0 = prep({ N, ground: g, req: '0'.repeat(N * N), hand, sol: [] }), sol = roofs.slice(0, hand.length).map((c) => [c, int(r, 0, 3) * (R.ROT.includes(hand[0][0]) ? 1 : 0)]);
    sol.forEach((p, i) => { if (!R.ROT.includes(hand[i][0])) p[1] = 0; });
    const req = [...coverage(P0, sol).cov].map((v) => (r() < 0.8 ? v : int(r, 0, v))).join('').replace(/\d/g, (d) => Math.min(9, d));
    const L = { N, ground: g, req, hand, sol: [] }, b = brute(L), f = solve(prep(L), { stopPartial: false });
    assert.strictEqual(f.partial, b.partial, 'partial ' + s);
    if (!b.partial) assert.strictEqual(f.full, b.full, 'full ' + s);
    kinds[b.partial ? 'partial' : b.full > 1 ? 'many' : 'one']++;
    checked++;
  }
  assert(kinds.partial && kinds.many && kinds.one, 'brute force saw ' + JSON.stringify(kinds));
}

// ---------- levels ----------
function check(key, tier, L) {
  const P = prep(L), T = TIER[tier];
  assert(L.N >= T.N[0] && L.N <= T.N[1], key + ' size');
  assert(L.hand.length >= T.K[0] && L.hand.length <= T.K[1], key + ' hand');
  const c = coverage(P, L.sol);
  assert(met(P, c.cov), key + ' answer falls short');
  assert(c.on.every((on, i) => on || !isAnt(P.hand[i].k)), key + ' an amplifier stays off');
  const res = solve(P, { cap: T.cap });
  assert(!res.partial, key + ' a smaller hand wins');
  assert(res.full >= 1 && res.full <= T.cap, key + ' answers: ' + res.full);
  if (T.los) { const free = solve(P, { cap: res.full, noLos: true }); assert(free.partial || free.full > res.full, key + ' blocking never matters'); }
  assert.strictEqual(line(parse(line(L))), line(L));
}
const t0 = Date.now();
let n = 0;
for (const t of 'EMH') {
  for (let i = 1; i <= (all ? PACK_SIZE : 40); i++) { check(t + i, t, generate(hash(t + i), t)); n++; }
  for (let i = 0; i < 10; i++) { const k = 'D' + t + '2026-12-' + String(i + 1).padStart(2, '0'); check(k, t, generate(hash(k), t)); n++; }
}
assert.strictEqual(line(generate(hash('E1'), 'E')), line(generate(hash('E1'), 'E'))); // same seed, same level
let levels;
try { levels = require('./levels.js'); } catch {}
if (levels) {
  levels.DAILY.I.forEach((l, i) => (all || i < 20) && (check('DI' + i, 'I', parse(l)), n++));
}
console.log('ok', n, 'levels', Date.now() - t0, 'ms');
