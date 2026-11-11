// node biggr/test.js — every level and today's dailies: 10 pairs, distinct sums, true values, deterministic.
const assert = require('assert');
Object.assign(globalThis, require('../shared/common.js'));
const { PAIRS, GAP, generate } = require('./gen.js');

const evalText = (t) => Function(`return ${t.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')}`)();
const keys = [];
for (const k in GAP) for (let n = 1; n <= PACK_SIZE; n++) keys.push(k + n);
for (const k in GAP) keys.push('D' + k + '2026-11-11');

let left = 0;
for (const key of keys) {
  const tier = key.replace(/^D/, '')[0], p = generate(hash(key), tier);
  assert.strictEqual(p.length, PAIRS, key);
  assert.deepStrictEqual(p, generate(hash(key), tier), 'not deterministic ' + key);
  for (const [lt, lv, rt, rv] of p) {
    assert.strictEqual(evalText(lt), lv, `${key}: ${lt}`);
    assert.strictEqual(evalText(rt), rv, `${key}: ${rt}`);
    const d = Math.abs(lv - rv);
    assert(d > 0 && d <= GAP[tier] && lv >= 0 && rv >= 0, `${key}: ${lt} vs ${rt}`);
    if (lv > rv) left++;
  }
}
const share = left / (keys.length * PAIRS);
assert(share > 0.45 && share < 0.55, 'bigger side is lopsided: ' + share);
console.log('ok', keys.length, 'levels; e.g. H1:', generate(hash('H1'), 'H').slice(0, 2).map(([a, , b]) => `${a} vs ${b}`).join(', '));
