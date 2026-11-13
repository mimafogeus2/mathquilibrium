// node alienchess/test.js [count] — the move rules on hand-made boards, then levels 1..count of each difficulty (default 150;
// Hard takes ~0.2s a level) and a day's dailies: a win in exactly K from one first move only, which the solver
// then plays out against the computer's real replies. Deterministic.
const assert = require('assert');
Object.assign(globalThis, require('../shared/common.js'));
const { TIER, moves, play, lost, wins, winning, reply, generate } = require('./gen.js');

// a 4×4 board: a rook-like slider (type 0) and a forward-only, take-only knight hop (type 1)
const p = { N: 4, K: 1, king: [false, false], types: [
  { rules: [{ k: 'slide', v: [[-1, 0], [1, 0], [0, -1], [0, 1]], n: 9, m: 'any' }] },
  { rules: [{ k: 'leap', v: [[-2, -1], [-2, 1]], m: 'cap' }] },
] };
const B = (s) => s.replace(/\s/g, '').split('').map((ch) => ({ '.': 0, R: 1, N: 2, r: -1, n: -2 })[ch]);
const to = (b, side, from) => moves(p, b, side).filter((m) => m[0] === from).map((m) => m[1]).sort((a, b) => a - b);
let b = B('.r.. .... .R.. ....');
assert.deepStrictEqual(to(b, 1, 9), [1, 5, 8, 10, 11, 13]); // up stops on the enemy it takes
b = B('.... .... .R.. .R..');
assert.deepStrictEqual(to(b, 1, 9), [1, 5, 8, 10, 11]); // blocked by its own piece below
b = B('n.n. .... .N.. ....');
assert.deepStrictEqual(to(b, 1, 9), [0, 2]); // takes forward (up)…
b = B('.... .... .N.. ....');
assert.deepStrictEqual(to(b, 1, 9), []); // …and never just moves
b = B('.n.. .... N.N. ....');
assert.deepStrictEqual(to(b, -1, 1), [8, 10]); // the computer's forward is down the board
assert(lost(p, B('.... .R.. .... ....'), -1) && !lost(p, B('r... .R.. .... ....'), -1));
const pk = { ...p, king: [true, true], types: [{ ...p.types[0], king: true }, p.types[1]] };
assert(lost(pk, B('n... .R.. .... ....'), -1)); // its king is gone, though a piece is left
assert(wins(p, B('r... .... .... R...'), 1)); // take the last piece
assert(!wins(p, B('r... .... ..N. ....'), 1)); // the knight can't reach
// boxed in is not beaten: its piece can't move (a take-only knight, nothing to take), so it passes, and you still have to take it
assert(!wins(p, B('.... .n.. .... R...'), 1) && wins(p, B('.... .n.. .... R...'), 2));

const count = +process.argv[2] || 150, keys = [];
for (const k in TIER) for (let n = 1; n <= count; n++) keys.push(k + n);
for (const k in TIER) keys.push('D' + k + '2026-11-13');
const t0 = Date.now(), slowest = {};
for (const key of keys) {
  const tier = key.replace(/^D/, '')[0], t = Date.now();
  const q = generate(hash(key), tier);
  slowest[tier] = Math.max(slowest[tier] || 0, Date.now() - t);
  assert.strictEqual(q.K, TIER[tier].K);
  assert(q.types.every((_, i) => q.board.some((x) => Math.abs(x) === i + 1)), key + ' a type is missing from the board');
  assert(!wins(q, q.board, q.K - 1), key + ' wins too soon');
  assert.deepStrictEqual(winning(q, q.board, q.K), [q.first], key + ' not one first move');
  // play it out: the solver against the computer's replies; won within K of your moves
  let bd = q.board, k = q.K;
  for (;;) {
    bd = play(bd, winning(q, bd, k)[0]);
    if (lost(q, bd, -1)) break;
    bd = play(bd, reply(q, bd)); // null: it passes
    assert(!lost(q, bd, 1) && --k > 0, key + ' the line fails');
  }
}
assert.deepStrictEqual(generate(hash('H1'), 'H'), generate(hash('H1'), 'H'));
console.log('ok', keys.length, 'puzzles', Date.now() - t0, 'ms, slowest per tier', slowest);
