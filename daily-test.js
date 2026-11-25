// node daily-test.js — the front page's daily fact (facts.js, he/facts.js) doesn't repeat.
'use strict';
const assert = require('assert'), fs = require('fs');
const facts = (f) => { const ctx = {}; new Function('ctx', fs.readFileSync(f, 'utf8').replace('var FACTS', 'ctx.FACTS')) (ctx); return ctx.FACTS; };
const en = facts('facts.js'), he = facts('he/facts.js');

assert.strictEqual(en.length, 1000);
assert.strictEqual(he.length, en.length, 'the Hebrew facts must match the English ones, one for one');
assert.strictEqual(new Set(en).size, en.length, 'a fact is listed twice');

const day0 = Date.parse('2026-11-25') / 864e5, seen = new Set();
for (let d = day0; d < day0 + en.length; d++) { const i = (d * 337 + 41) % en.length; assert(!seen.has(i), 'a fact repeats on day ' + d); seen.add(i); }
console.log('ok: ' + en.length + ' facts');
