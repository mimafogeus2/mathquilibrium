// node orderly/test.js — every level well-formed, subjects unique, deals scrambled, the daily covers the whole pool.
const assert = require('assert');
const LEVELS = require('./levels.js');
globalThis.LEVELS = LEVELS;
Object.assign(globalThis, require('../shared/common.js'));

// the pure helpers the page uses (game.js needs a DOM, so they're lifted out of the source)
const src = require('fs').readFileSync(__dirname + '/game.js', 'utf8');
for (const re of [/const N = [^\n]*\n/, /const DAY0[^]*?\n\n/, /function parse[^]*?\n}\n/, /function deal[^]*?\n}\n/])
  (0, eval)(src.match(re)[0].replace(/^const /gm, 'var '));

const subjects = new Set();
LEVELS.forEach((line, i) => {
  const at = `level ${i + 1}: ${line}`, f = line.split('|');
  assert.strictEqual(f.length, 5, at);
  const L = parse(line);
  assert([1, 2, 3].includes(L.d), at);
  assert(L.subject && L.top && L.bottom, at);
  assert(!subjects.has(L.subject.toLowerCase()), 'duplicate subject ' + at);
  subjects.add(L.subject.toLowerCase());
  assert.strictEqual(L.items.length, N, at);
  assert.strictEqual(new Set(L.items.map((it) => it.name.toLowerCase())).size, N, 'repeated card ' + at);
  for (const it of L.items) assert(it.name && it.val && it.name.length <= 30 && it.val.length <= 24, `bad card ${it.name}=${it.val} ${at}`);
  const o = deal(hash('L' + (i + 1)));
  assert.deepStrictEqual([...o].sort((a, b) => a - b), [...Array(N).keys()], at);
  assert(o.filter((v, p) => v === p).length <= 1, 'deal starts too solved ' + at);
});

const days = new Set();
for (let d = 0; d < LEVELS.length; d++) days.add(dailyIndex(new Date(DAY0 + d * 864e5 + 12 * 36e5).toISOString().slice(0, 10)));
assert.strictEqual(days.size, LEVELS.length, 'dailies repeat before the pool runs out');
console.log('ok', LEVELS.length, 'levels; today is', parse(LEVELS[dailyIndex(new Date().toISOString().slice(0, 10))]).subject);
