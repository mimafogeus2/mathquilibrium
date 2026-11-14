// node balancingact/test.js — every level and a day's dailies: sizes in range, the answer balances every beam, it's the only way, deterministic.
const assert = require('assert');
Object.assign(globalThis, require('../shared/common.js'));
const { TIER, LO, HI, depth, beams, count, generate, balanced } = require('./gen.js');

// the counter, by hand
assert.strictEqual(count([6, 4], [6, 4]), 1);
assert.strictEqual(count([6, 4], [2, 4, 4]), 1); // 2+4 | 4: the 4s are twins
assert.strictEqual(count([6, 6], [6, 2, 4]), 2); // 6 | 2+4, or the other way round
assert.strictEqual(count([4, 6], [-2, 6, 6]), 1); // a balloon: 6-2 | 6
assert.strictEqual(count([4, 4], [-2, 6, 4]), 2); // 6-2 | 4, either plate
assert.strictEqual(count([3, 5], [-2, 6, 4]), 0);

const keys = [];
for (const k in TIER) for (let n = 1; n <= PACK_SIZE; n++) keys.push(k + n);
for (const k in TIER) keys.push('D' + k + '2026-11-14');

const t0 = Date.now(), slowest = {};
for (const key of keys) {
  const tier = key.replace(/^D/, '')[0], T = TIER[tier], t = Date.now();
  const p = generate(hash(key), tier);
  slowest[tier] = Math.max(slowest[tier] || 0, Date.now() - t);
  const loose = p.items.filter((x) => x.v < 0).length;
  assert(p.plates >= T.plates[0] && p.plates <= T.plates[1], key + ' plates');
  assert(depth(p.tree) >= T.depth[0] && depth(p.tree) <= T.depth[1], key + ' depth');
  assert(p.items.length >= T.items[0] && p.items.length <= T.items[1], key + ' store size');
  assert(p.fixed.length >= T.fixed[0] && p.fixed.length <= T.fixed[1], key + ' fixed balloons');
  assert(loose >= T.loose[0] && loose <= T.loose[1], key + ' loose balloons');
  assert(p.items.every((x) => Math.abs(x.v) >= LO && Math.abs(x.v) <= HI) && p.fixed.every((x) => x.v >= LO && x.v <= HI), key + ' sizes');
  const bs = beams(p.tree);
  assert(bs.every((b) => b.a >= 1 && b.b >= 1 && b.a <= T.arm && b.b <= T.arm), key + ' arms');
  assert(T.uneven ? bs.every((b) => b.a !== b.b) : bs.some((b) => b.a !== b.b), key + ' uneven');
  assert(p.target.every((x) => x > 0), key + ' a plate floats');
  const at = p.items.map((x) => x.plate);
  assert(balanced(p, at), key + ' answer unbalanced');
  const need = p.target.map((x, i) => x + p.fixed.filter((f) => f.plate === i).reduce((s, f) => s + f.v, 0));
  assert.strictEqual(count(need, p.items.map((x) => x.v)), 1, key + ' not unique');
}
assert.deepStrictEqual(generate(hash('H1'), 'H'), generate(hash('H1'), 'H')); // same seed, same puzzle
console.log('ok', keys.length, 'puzzles', Date.now() - t0, 'ms, slowest per tier', slowest);
