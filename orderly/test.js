// node orderly/test.js — every level (and special day) well-formed, subjects unique, deals scrambled, the daily covers the whole pool.
const assert = require('assert');
// `node orderly/test.js he` checks a translation's content instead (he/orderly/), against the same rules
const dir = process.argv[2] ? `${__dirname}/../${process.argv[2]}/orderly` : __dirname;
const LEVELS = require(dir + '/levels.js');
globalThis.LEVELS = LEVELS;
globalThis.LANG = process.argv[2] || 'en';
Object.assign(globalThis, require('../shared/common.js'));

// the pure helpers the page uses (game.js needs a DOM, so they're lifted out of the source)
const src = require('fs').readFileSync(__dirname + '/game.js', 'utf8');
for (const re of [/const N = [^\n]*\n/, /const TOPICS = [^\n]*\n/, /const DAY0[^]*?\n\n/, /function parse[^]*?\n}\n/, /function deal[^]*?\n}\n/, /const code = [^\n]*\n/, /const fromCode = [^\n]*\n/])
  (0, eval)(src.match(re)[0].replace(/^const /gm, 'var '));

const subjects = new Set();
const CHECK = (line, at) => {
  const f = line.split('|');
  assert.strictEqual(f.length, 6, at);
  const L = parse(line);
  assert([1, 2, 3].includes(L.d), at);
  assert(L.topic in TOPICS, 'unknown topic ' + at);
  assert(L.subject && L.top && L.bottom, at);
  assert(!subjects.has(L.subject.toLowerCase()), 'duplicate subject ' + at);
  subjects.add(L.subject.toLowerCase());
  assert.strictEqual(L.items.length, N, at);
  assert.strictEqual(new Set(L.items.map((it) => it.name.toLowerCase())).size, N, 'repeated card ' + at);
  for (const it of L.items) assert(it.name && it.val && it.name.length <= 30 && it.val.length <= 24, `bad card ${it.name}=${it.val} ${at}`);
};
LEVELS.forEach((line, i) => {
  const at = `level ${i + 1}: ${line}`;
  CHECK(line, at);
  const o = deal(hash('L' + (i + 1)));
  assert.deepStrictEqual([...o].sort((a, b) => a - b), [...Array(N).keys()], at);
  assert(o.filter((v, p) => v === p).length <= 1, 'deal starts too solved ' + at);
});

// every topic has puzzles at every difficulty, so any ticked topic can deal one
for (const t in TOPICS) for (const d of [1, 2, 3]) assert(LEVELS.some((l) => parse(l).topic === t && parse(l).d === d), `no ${DIFF[d]} ${t} puzzles`);

// special days: real dates, each used once, in order, with an occasion
const SPECIAL = require(dir + '/special.js'), dates = SPECIAL.map((l) => l.slice(0, 10));
SPECIAL.forEach((l, i) => {
  const d = dates[i], sp = special(SPECIAL, d);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(d + 'T12:00Z').toISOString().startsWith(d), 'bad date ' + l);
  assert(i === 0 || dates[i - 1] < d, 'special days out of order or repeated ' + l);
  assert(sp.occasion.trim() && !sp.occasion.includes('|'), 'no occasion ' + l);
  CHECK(sp.line, 'special ' + l);
});

// share codes: 3 chars, distinct, and each leads back to its level
const codes = LEVELS.map((_, i) => code(i + 1));
assert(codes.every((c, i) => /^[0-9a-z]{3}$/.test(c) && fromCode(c) === i + 1) && new Set(codes).size === LEVELS.length && !codes.includes('daily'), 'bad share codes');

// the daily follows the weekly curve, and each difficulty's days cover its whole pool before repeating
const seen = { 1: new Set(), 2: new Set(), 3: new Set() }, count = { 1: 0, 2: 0, 3: 0 };
for (let day = 0; day < LEVELS.length * 7; day++) {
  const date = new Date(DAY0 + day * 864e5 + 12 * 36e5), want = (LANG === 'he' ? [1, 1, 2, 2, 2, 3, 3] : [3, 1, 1, 2, 2, 2, 3])[date.getUTCDay()], i = dailyIndex(date.toISOString().slice(0, 10));
  assert.strictEqual(parse(LEVELS[i]).d, want, 'wrong daily difficulty on ' + date);
  if (count[want]++ < pool(want).length) seen[want].add(i);
}
for (const d of [1, 2, 3]) assert.strictEqual(seen[d].size, pool(d).length, `${DIFF[d]} dailies repeat before the pool runs out`);
console.log('ok', LEVELS.length, 'levels,', SPECIAL.length, 'special days; today is', parse(LEVELS[dailyIndex(new Date().toISOString().slice(0, 10))]).subject);
