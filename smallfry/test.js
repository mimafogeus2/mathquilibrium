// node smallfry/test.js — the rules on tiny hand-made tanks, then levels from levels.js: each is won by its answer, and
// solve() finds that answer alone, with no smaller part of the hand winning. `node smallfry/test.js all` checks every level.
const assert = require('assert');
Object.assign(globalThis, require('../shared/common.js'));
const S = require('./gen.js');

// A tank from rows of text: # rock, . water, X exit; fish as digits (0 the fry, else its size); fish face `dirs` in order.
function tank(rows, dirs, extra = {}) {
  const W = rows[0].length, grid = [], fish = [];
  rows.join('').split('').forEach((ch, c) => {
    if (/\d/.test(ch)) { fish.push({ p: c, s: +ch || 1, f: !!extra.fast?.includes(+ch) }); grid.push('.'); } else grid.push(ch);
  });
  fish.sort((a, b) => a.s - b.s).forEach((f, i) => { f.d = dirs[i]; });
  return { W, grid: grid.join(''), fish, mir: extra.mir || [], flat: extra.flat || [], items: extra.items || [] };
}
const U = 0, R = 1, D = 2, L = 3;
const go = (T, seq) => S.replay(T, seq);

// the fry looks at a wall; a / where the exit is overhead turns its look up and out
let T = tank(['##X##', '#...#', '#0..#', '#####'], [R]);
assert.deepStrictEqual(S.spots(T, S.initial(T), '/'), [12, 13]);
assert.strictEqual(go(T, [['/', 12]]), 'win');
assert.strictEqual(go(T, [['\\', 12]]), 'stop'); // down: rock
assert.strictEqual(go(T, [['/', 13]]), 'stop'); // up: rock
assert.strictEqual(go(T, [['/', 7]]), 'bad'); // nobody looks there
// a flat mirror on the rock the fry stares at shows it what's behind: it turns round and takes the exit
T = tank(['#####', 'X0..#', '#####'], [R]);
assert.deepStrictEqual(S.spots(T, S.initial(T), 'F'), [8 * 4 + R]);
assert.strictEqual(go(T, [['F', 8 * 4 + R]]), 'win');
// a flat mirror beside a diagonal one: the look turns at the diagonal, comes back off the flat mirror, and turns at the diagonal
// again, back the way it came (here: down, right, back left, up, past the fry itself and out)
T = tank(['###X#', '#..0#', '#...#', '#####'], [D], { mir: [[13, '\\']] });
assert.deepStrictEqual(S.spots(T, S.initial(T), 'F'), [13 * 4 + R]);
assert.strictEqual(go(T, [['F', 13 * 4 + R]]), 'win');
// a predator sees the fry swimming into its look and sets off in the same tick: one cell away from the cell the fry is entering,
// it gets there with the fry; two away, a cell short, and the fry has gone by when it looks again
assert.strictEqual(S.run(tank(['#######', '#.0...X', '#..2..#', '#######'], [R, U]), S.initial(tank(['#######', '#.0...X', '#..2..#', '#######'], [R, U]))), 'lose');
assert.strictEqual(S.run(tank(['#######', '#.0...X', '#.....#', '#..2..#', '#######'], [R, U]), S.initial(tank(['#######', '#.0...X', '#.....#', '#..2..#', '#######'], [R, U]))), 'win');
// a predator that sees the fry eats it
T = tank(['######', '#0..2#', '######'], [R, L]);
assert.strictEqual(S.tick(T, S.initial(T)).moved.length, 1);
assert.strictEqual(S.run(T, S.initial(T)), 'lose');
// predators eat smaller predators; a bigger fish blocks the fry's look
T = tank(['#######', '#0.3.2#', '#######'], [R, L, R]);
{ const st = S.initial(T); assert.strictEqual(S.run(T, st), 'stop'); assert.deepStrictEqual(st.fish.map((f) => f.a), [true, false, true]); assert.strictEqual(st.fish[2].p, 12); }
// a fast predator swims two cells a tick
T = tank(['########', '#..0..2#', '########'], [R, L], { fast: [2] });
{ const st = S.initial(T); assert.deepStrictEqual(S.tick(T, st).paths, [[14, 13, 12]]); assert.strictEqual(S.run(T, st), 'lose'); }
// ...and eats the fry if it swims into any cell of that stride: here the predator goes for the 2 and the fry crosses its path
const cross = ['#######', '#..3..#', '#.....#', '#.0...X', '#..2..#', '#######'];
assert.strictEqual(S.run(tank(cross, [R, L, D], { fast: [3] }), S.initial(tank(cross, [R, L, D], { fast: [3] }))), 'lose');
assert.strictEqual(S.run(tank(cross, [R, L, D]), S.initial(tank(cross, [R, L, D]))), 'win'); // a slow one is a cell short
// bait: the fry swims to it and eats it, then looks on the way it swam; predators look right through bait
T = tank(['######', '#....#', '#0...#', '#..2.#', '######'], [R, U]);
assert.deepStrictEqual(S.spots(T, S.initial(T), 'B'), [9, 14, 15, 16]);
{ const st = S.initial(T); S.place(st, 'B', 15); assert.strictEqual(S.run(T, st), 'lose'); }
T = tank(['######', '#....X', '#0...#', '######'], [R], {});
{ const st = S.initial(T); S.place(st, 'B', 16); assert.strictEqual(S.run(T, st), 'stop'); assert.strictEqual(st.nb, 0); assert.strictEqual(st.fish[0].p, 16); }

// a patroller swims back and forth along its axis whenever anything else swims, turning at rock, and eats what it runs into
{
  const P = tank(['#######', '#..0..X', '#.....#', '#2....#', '#######'], [R, R]);
  P.fish[1].w = true; // the 2, heading right along the bottom row
  const st = S.initial(P);
  assert.deepStrictEqual(S.spots(P, st, '/'), [11, 12]); // only the fry looks: a patroller looks at nothing
  assert.strictEqual(S.run(P, st), 'win'); // the fry takes 3 ticks to get out; the patroller swims 3 cells meanwhile
  assert.strictEqual(st.fish[1].p, 25);
  const Q = tank(['#####', '#0..X', '#.#.#', '#..2#', '#####'], [R, U]);
  Q.fish[1].w = true; // the 2 patrols the right column, up into the fry's row as the fry swims through it
  assert.strictEqual(S.run(Q, S.initial(Q)), 'lose');
  assert.strictEqual(S.parse(S.line({ ...Q, items: ['/'], sol: [['/', 7]] })).fish[1].w, true); // stored with a p
}

// levels
if (process.argv[2] === 'rules') { console.log('rules ok'); process.exit(); }
const { LEVELS, DAILY } = require('./levels.js');
const all = process.argv[2] === 'all', t0 = Date.now(), lines = [];
for (const k in LEVELS) LEVELS[k].forEach((l, i) => (all || i < 40) && lines.push([k + (i + 1), k, l]));
for (const k in DAILY) if (k !== 'from') DAILY[k].forEach((l, i) => (all || i < 10) && lines.push(['D' + k + i, k, l]));
for (const [key, tier, line] of lines) {
  const lv = S.parse(line), t = S.TIER[tier];
  assert(lv.items.length >= t.items[0] && lv.items.length <= t.items[1], key + ' hand size');
  assert.strictEqual(S.replay(lv, lv.sol), 'win', key + ' answer');
  const v = S.verdict(lv, lv.items, Infinity);
  assert(!v.spare, key + ' a smaller hand wins');
  assert(v.orders.length >= 1, key + ' no answer');
  // every fish has a job: it swims in every answer found, or it shields the fry at the start, or without it a smaller hand wins
  lv.fish.forEach((f, i) => {
    if (!i || v.orders.every((o) => S.trace(lv, o).movers.has(i))) return;
    const M = { ...lv, fish: lv.fish.filter((_, j) => j !== i) };
    if (S.tick(M, S.initial(M)).moved.length) return;
    const vm = S.verdict(M, lv.items, Infinity);
    assert(vm.spare || !vm.orders.length, key + ' fish ' + i + ' has no job');
  });
  assert.strictEqual(S.line(lv), line, key + ' round trip');
}
assert.deepStrictEqual(S.line(S.generate(hash('E1'), 'E')), S.line(S.generate(hash('E1'), 'E'))); // same seed, same level
console.log('ok', lines.length, 'levels', Date.now() - t0, 'ms');
