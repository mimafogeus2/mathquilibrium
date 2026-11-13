// node wordswipe/test.js — every round (and special day) well-formed, subjects unique, daily/unlimited cover the whole pool.
const assert = require('assert');
// `node wordswipe/test.js he` checks a translation's content instead (he/wordswipe/), against the same rules
const dir = process.argv[2] ? `${__dirname}/../${process.argv[2]}/wordswipe` : __dirname;
const ROUNDS = require(dir + '/rounds.js');
globalThis.ROUNDS = ROUNDS;
Object.assign(globalThis, require('../shared/common.js'));

const subjects = new Set();
const CHECK = (line, at) => {
  const f = line.split('|');
  assert.strictEqual(f.length, 3, at);
  const [subject, yes, no] = [f[0], f[1].split(','), f[2].split(',')];
  assert(subject && subject.length <= 48, at);
  assert(!subjects.has(subject.toLowerCase()), 'duplicate subject ' + at);
  subjects.add(subject.toLowerCase());
  assert.strictEqual(yes.length + no.length, 24, at);
  assert(yes.length >= 9 && yes.length <= 15, at);
  const words = [...yes, ...no].map((w) => w.toLowerCase());
  assert.strictEqual(new Set(words).size, 24, 'repeated word ' + at);
  for (const w of words) assert(w && w.length <= 20 && w === w.trim(), `bad word "${w}" ${at}`);
};
ROUNDS.forEach((line, i) => CHECK(line, `round ${i}: ${line}`));

// special days: real dates, each used once, in order, with an occasion
const SPECIAL = require(dir + '/special.js'), dates = SPECIAL.map((l) => l.slice(0, 10));
SPECIAL.forEach((l, i) => {
  const d = dates[i], sp = special(SPECIAL, d);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(d + 'T12:00Z').toISOString().startsWith(d), 'bad date ' + l);
  assert(i === 0 || dates[i - 1] < d, 'special days out of order or repeated ' + l);
  assert(sp.occasion.trim() && !sp.occasion.includes('|'), 'no occasion ' + l);
  CHECK(sp.line, 'special ' + l);
});

// the same index helpers the page uses (game.js needs a DOM, so they're mirrored here)
const src = require('fs').readFileSync(__dirname + '/game.js', 'utf8');
eval(src.match(/const DAY0[^]*?const unlimitedIndex.*\n/)[0].replace(/const /g, 'globalThis.'));
eval(src.match(/const parse = .*\n/)[0].replace('const ', 'globalThis.'));
const N = ROUNDS.length, days = new Set(), unl = new Set();
for (let d = 0; d < N; d++) days.add(dailyIndex(new Date(DAY0 + d * 864e5 + 12 * 36e5).toISOString().slice(0, 10)));
for (let n = 0; n < N; n++) unl.add(unlimitedIndex(n));
assert.strictEqual(days.size, N, 'dailies repeat before the pool runs out');
assert.strictEqual(unl.size, N, 'unlimited repeats before the pool runs out');
console.log('ok', N, 'rounds,', SPECIAL.length, 'special days; today is', ROUNDS[dailyIndex(new Date().toISOString().slice(0, 10))].split('|')[0]);

// made-up rounds (editor.html -> play.html#r=...): a round survives the link, and a broken link is caught, never played
const { packLink, unpackLink } = require('../shared/link.js');
const { roundProblems, wordIssue } = require('./custom.js');
(async () => {
  const r = parse(ROUNDS[0]), round = { s: r.s + ' — “quotes”, <b>tags</b> & עברית', y: r.y, n: r.n };
  const code = await packLink(round);
  assert(/^[\w-]+$/.test(code), 'link not base64url: ' + code);
  assert.deepStrictEqual(await unpackLink(code), round);
  assert.deepStrictEqual(roundProblems(round), []);
  for (const bad of [null, '', 'not a link!', 'AAAA', code.slice(0, -6), code.slice(4), await packLink('hi')]) {
    assert(roundProblems(await unpackLink(bad)).includes('shape'), `malformed link accepted: ${bad}`);
  }
  for (const [bad, problem] of [[{ ...round, y: [...round.y, 'Extra'] }, 'many'], [{ ...round, n: round.n.slice(1) }, 'few'], [{ ...round, s: ' ' }, 'subject'],
    [{ ...round, y: round.y.slice(0, 5), n: [...round.n, ...round.y.slice(5)] }, 'side'], [{ ...round, y: [...round.y.slice(1), round.n[0].toUpperCase()] }, 'words'],
    [{ ...round, y: [{ toString: () => 'x' }] }, 'shape'], [{ ...round, n: 'a,b' }, 'shape']]) assert(roundProblems(bad).includes(problem), problem);
  assert.strictEqual(wordIssue({ y: ['Cat', 'cat '.trim()], n: [] }, 'y', 'Cat'), 'dup');
  assert.strictEqual(wordIssue({ y: ['x'.repeat(21)], n: [] }, 'y', 'x'.repeat(21)), 'long');
  console.log('ok custom round links');
})().catch((e) => { console.error(e); process.exit(1); });
