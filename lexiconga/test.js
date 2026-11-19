// node lexiconga/test.js [n] — the rules on a hand-made level, the tutorials, then n levels (default 100) and 10 dailies per
// difficulty in both languages: each is dealt the same twice, its ten words are distinct, and its answer, typed in, links them all.
const assert = require('assert'), fs = require('fs'), path = require('path');
Object.assign(globalThis, require('../shared/common.js'));
const Lex = require('./gen.js');
const load = (f, name) => (0, eval)(fs.readFileSync(path.join(__dirname, '..', f), 'utf8') + ';' + name);
const N = +process.argv[2] || 100;

// Plays an answer through check(): every connector fits and brings in its word; all ten are in at the end
function play(lv, answer) {
  let mask = (1 << lv.words.length) - 1, cur = lv.start.at(-1);
  const used = new Set();
  for (const { conn, word } of answer) {
    const r = Lex.check(lv, mask, cur, used, conn);
    assert(!r.err, `${lv.start}: ${conn} rejected (${r.err})`);
    assert.strictEqual(lv.words[r.i], word, `${conn} brought in ${lv.words[r.i]}, not ${word}`);
    used.add(r.word);
    mask &= ~(1 << r.i);
    cur = word.at(-1);
  }
  assert.strictEqual(mask, 0);
}

for (const lang of ['en', 'he']) {
  const dir = lang === 'he' ? 'he/lexiconga/' : 'lexiconga/';
  Lex.init(load(dir + 'words.js', 'WORDS'), load(dir + 'gen-words.js', 'GEN_WORDS'), lang);

  if (lang === 'en') {
    // the rules, on a level of three
    const lv = { tier: 'E', start: 'cat', words: ['rain', 'nest', 'egg'] }, all = 7;
    assert.strictEqual(Lex.check(lv, all, 't', new Set(), 'door').err, 'start');
    assert.strictEqual(Lex.check(lv, all, 't', new Set(), 'tr').err, 'short');
    assert.strictEqual(Lex.check(lv, all, 't', new Set(), 'tqxzr').err, 'word');
    assert.strictEqual(Lex.check(lv, all, 't', new Set(['tour']), 'tour').err, 'used');
    assert.strictEqual(Lex.check(lv, all, 't', new Set(), 'tank').err, 'end'); // nothing in the box starts with k
    assert.strictEqual(Lex.check({ ...lv, words: ['rain', 'nest', 'tie'] }, all, 't', new Set(), 'tie').err, 'mine');
    assert.strictEqual(Lex.check(lv, all, 't', new Set(), 'TOUR').i, 0); // case doesn't matter
    // two box words on one letter: the computer takes the first that leaves the rest finishable
    const two = { tier: 'E', start: 'cat', words: ['nose', 'nut'] };
    assert.strictEqual(Lex.check(two, 3, 't', new Set(), 'tin').i, 0);
    assert(Lex.solvable(lv, all, 't', new Set()));
    assert(!Lex.deadEnd(lv, all, 't', new Set()));
    // the minimum length rises with the tier
    assert.strictEqual(Lex.check({ ...lv, tier: 'I' }, all, 't', new Set(), 'tour').err, 'short');
    assert(!Lex.check({ ...lv, tier: 'H' }, all, 't', new Set(), 'tour').err);
  } else {
    // final letters are their regular forms: לימון ends on נ and brings in נמר
    const lv = { tier: 'E', start: 'חתול', words: ['נמר', 'שמש', 'ענן'].map(Lex.norm) };
    assert.strictEqual(Lex.check(lv, 7, 'ל', new Set(), 'לימון').i, 0);
    assert.strictEqual(Lex.finalForm('שלומ'), 'שלום');
  }

  // the tutorials: their suggested words are in the list and lead on
  const tut = lang === 'he' ? { tier: 'E', start: 'חתול', words: ['נמר', 'שמש', 'ענן'].map(Lex.norm), first: 'לימון' } : { tier: 'E', start: 'cat', words: ['rain', 'nest', 'egg'], first: 'tour' };
  assert(!Lex.check(tut, 7, tut.start.at(-1), new Set(), tut.first).err, `${lang} tutorial: ${tut.first}`);
  play(tut, Lex.route(tut, 7, tut.start.at(-1)).steps.map((s) => ({ conn: s.conn, word: tut.words[s.i] })));

  for (const tier of ['E', 'M', 'H', 'I']) {
    const t0 = Date.now(), keys = [...Array.from({ length: tier === 'I' ? 0 : N }, (_, i) => tier + (i + 1)), ...Array.from({ length: 10 }, (_, i) => `D${tier}2026-12-${String(i + 1).padStart(2, '0')}`)];
    let len = 0;
    for (const key of keys) {
      const s = hash('lexiconga ' + key), lv = Lex.level(tier, s);
      assert.deepStrictEqual(Lex.level(tier, s).words, lv.words, `${key} deals the same twice`);
      assert.strictEqual(new Set([lv.start, ...lv.words]).size, 11, `${key}: eleven different words`);
      play(lv, lv.answer);
      len += [lv.start, ...lv.words, ...lv.answer.map((a) => a.conn)].join('').length - 20;
    }
    console.log(`${lang} ${tier}: ${keys.length} levels ok, ${Math.round((Date.now() - t0) / keys.length)}ms each, chains of ${Math.round(len / keys.length)} letters`);
  }
}
console.log('all good');
