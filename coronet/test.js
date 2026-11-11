// node coronet/test.js — every level and today's dailies: one solution, connected regions, deterministic.
const assert = require('assert');
Object.assign(globalThis, require('../shared/common.js'));
const { SIZES, neighbors, solve, generate, sees } = require('./gen.js');

// solver: when the colors are just the rings, any permutation works -> 3! answers
assert.strictEqual(solve(3, [0, 0, 0, 1, 1, 1, 2, 2, 2], 9).length, 6);
assert.deepStrictEqual(neighbors(4, 0).sort((a, b) => a - b), [1, 3, 4]); // wraps around the ring
assert(sees(4, Array(16).fill(0), 0, 15) && !sees(4, [...Array(16).keys()], 0, 5));

const keys = [];
for (const k in SIZES) for (let n = 1; n <= PACK_SIZE; n++) keys.push(k + n);
for (const k in SIZES) keys.push('D' + k + '2026-11-11');

const t0 = Date.now();
let slowest = 0;
for (const key of keys) {
  const N = SIZES[key.replace(/^D/, '')[0]], t = Date.now();
  const p = generate(hash(key), N);
  slowest = Math.max(slowest, Date.now() - t);
  const sols = solve(N, p.region, 2);
  assert.strictEqual(sols.length, 1, key + ' not unique');
  assert.deepStrictEqual(sols[0], p.queens, key + ' wrong answer');
  for (let g = 0; g < N; g++) {
    const cells = p.region.flatMap((x, i) => (x === g ? [i] : []));
    const seen = new Set([cells[0]]), q = [cells[0]];
    while (q.length) for (const j of neighbors(N, q.pop())) if (p.region[j] === g && !seen.has(j)) { seen.add(j); q.push(j); }
    assert.strictEqual(seen.size, cells.length, key + ' region split');
  }
  if (/^([EMH]1$|D)/.test(key)) {
    const sizes = Array.from({ length: N }, (_, g) => p.region.filter((x) => x === g).length);
    console.log(key.padEnd(14), `N=${N}`, 'region sizes', sizes.sort((a, b) => a - b).join(' '));
  }
}
assert.deepStrictEqual(generate(hash('E1'), 6), generate(hash('E1'), 6)); // same seed, same puzzle
console.log('ok', keys.length, 'puzzles', Date.now() - t0, 'ms, slowest', slowest, 'ms');
