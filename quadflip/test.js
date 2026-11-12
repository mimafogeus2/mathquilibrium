// node quadflip/test.js — every level and a day's dailies: the answer clears the board, it's the only way,
// no smaller set of pieces clears it (so no stamp is spare or cancels a twin), deterministic.
const assert = require('assert');
Object.assign(globalThis, require('../shared/common.js'));
const { SHAPES, TIER, seedOf, placements, flip, count, valid, generate } = require('./gen.js');

// the counter, on boards small enough to check by hand
const O = 2, T = 3; // O and a T in a 3×3
assert.strictEqual(placements(3, O).length, 4);
assert.strictEqual(placements(3, 0).length, 0); // an I doesn't fit 3×3
const m = flip(3, O, 0) ^ flip(3, T, 3); // overlapping stamps
assert.deepStrictEqual(count(3, [O, T], m), { full: 1, partial: 0 });
assert.deepStrictEqual(count(3, [O, T], flip(3, O, 0)), { full: 0, partial: 1 }); // the T is spare
assert.deepStrictEqual(count(3, [O, O, T], flip(3, T, 3)), { full: 4, partial: 1 }); // two Os on one spot cancel
assert(!valid(3, [O, O, T], flip(3, T, 3)));
assert(SHAPES.every((s) => new Set(s.map(String)).size === 4));

const keys = [];
for (const k in TIER) for (let n = 1; n <= PACK_SIZE; n++) keys.push(k + n);
for (const k in TIER) keys.push('D' + k + '2026-11-12');

const t0 = Date.now(), slowest = {};
for (const key of keys) {
  const tier = key.replace(/^D/, '')[0], t = Date.now();
  const p = generate(seedOf(key), tier);
  slowest[tier] = Math.max(slowest[tier] || 0, Date.now() - t);
  const { N, K } = TIER[tier];
  assert.strictEqual(p.N, N);
  assert(p.pieces.length >= K[0] && p.pieces.length <= K[1], key + ' piece count');
  assert.strictEqual(p.pieces.reduce((b, s, i) => b ^ flip(N, s, p.sol[i]), p.board), 0, key + ' answer leaves tiles');
  assert(valid(N, p.pieces, p.board), key + ' not unique, or a subset works');
}
assert.deepStrictEqual(generate(seedOf('H1'), 'H'), generate(seedOf('H1'), 'H')); // same seed, same puzzle
assert.strictEqual(seedOf('DH2026-11-12'), hash('DM2026-11-12')); // Hard plays the old Medium puzzles
console.log('ok', keys.length, 'puzzles', Date.now() - t0, 'ms, slowest per tier', slowest);
