// Biggr level engine: 10 pairs of sums per level, generated from a seed. Uses rng/int/pick from shared/common.js (a global).
// A pair is [left text, left value, right text, right value]; the values always differ, by at most GAP[tier].

const PAIRS = 10;
const TIME = { E: 45, M: 70, H: 90, I: 90 }; // seconds per level
const GAP = { E: 4, M: 5, H: 6, I: 2 }; // I: Impossible Mode's daily, where estimating can't tell them apart
const SUP = (n) => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);

// Each template makes [text, value]. Templates are mixed freely within a tier, so ranges overlap on purpose.
const SUMS = {
  E: [
    (r) => { const a = int(r, 2, 20), b = int(r, 2, 20); return [`${a} + ${b}`, a + b]; },
    (r) => { const a = int(r, 12, 40), b = int(r, 2, a - 3); return [`${a} − ${b}`, a - b]; },
  ],
  M: [
    (r) => { const a = int(r, 3, 12), b = int(r, 3, 12); return [`${a} × ${b}`, a * b]; },
    (r) => { const a = int(r, 12, 70), b = int(r, 12, 60); return [`${a} + ${b}`, a + b]; },
    (r) => { const a = int(r, 40, 150), b = int(r, 12, a - 12); return [`${a} − ${b}`, a - b]; },
    (r) => { const a = int(r, 3, 9), b = int(r, 3, 9), c = int(r, 2, 30); return [`${a} × ${b} + ${c}`, a * b + c]; },
  ],
  H: [
    (r) => { const a = int(r, 4, 12), b = int(r, 4, 12), c = int(r, 2, 9), d = int(r, 2, 9); return [`${a} × ${b} − ${c} × ${d}`, a * b - c * d]; },
    (r) => { const a = int(r, 11, 25), b = int(r, 3, 9), c = int(r, 3, 40); return [`${a} × ${b} − ${c}`, a * b - c]; },
    (r) => { const b = int(r, 3, 12), q = int(r, 6, 25), c = int(r, 3, 60); return [`${b * q} ÷ ${b} + ${c}`, q + c]; },
    (r) => { const a = int(r, 3, 15), b = int(r, 3, 15), c = int(r, 3, 9); return [`(${a} + ${b}) × ${c}`, (a + b) * c]; },
    (r) => { const a = int(r, 3, 9), b = int(r, 3, 9), c = int(r, 3, 9); return [`${a} × ${b} × ${c}`, a * b * c]; },
  ],
  // Impossible: squares, powers, division mixed in and bigger products, all landing around 150–450 so any two can be a pair
  I: [
    (r) => { const a = int(r, 12, 20), b = int(r, 2, 40); return [`${a}${SUP(2)} − ${b}`, a * a - b]; },
    (r) => { const a = int(r, 11, 19), b = int(r, 2, 40); return [`${a}${SUP(2)} + ${b}`, a * a + b]; },
    (r) => { const k = int(r, 7, 8), c = int(r, 3, 190); return [`2${SUP(k)} + ${c}`, 2 ** k + c]; },
    (r) => { const b = int(r, 3, 12), a = int(r, 8, 25), c = int(r, 6, 18); return [`${a * b} ÷ ${b} × ${c}`, a * c]; },
    (r) => { const a = int(r, 13, 29), b = int(r, 7, 19); return [`${a} × ${b}`, a * b]; },
    (r) => { const a = int(r, 6, 19), b = int(r, 6, 19), c = int(r, 5, 12); return [`(${a} + ${b}) × ${c}`, (a + b) * c]; },
    (r) => { const a = int(r, 14, 25), b = int(r, 11, 19), c = int(r, 2, 9), d = int(r, 3, 12); return [`${a} × ${b} − ${c} × ${d}`, a * b - c * d]; },
  ],
};

// ponytail: rejection sampling, a few dozen tries per pair at most; plenty fast for one level at a time.
function generate(seed, tier) {
  const r = rng(seed), pairs = [], seen = new Set();
  while (pairs.length < PAIRS) {
    const [lt, lv] = pick(r, SUMS[tier])(r), [rt, rv] = pick(r, SUMS[tier])(r), d = Math.abs(lv - rv);
    if (lv < 0 || rv < 0 || d === 0 || d > GAP[tier] || seen.has(lt) || seen.has(rt)) continue;
    if (tier === 'I' && lt.split(' ')[0] === rt.split(' ')[0]) continue; // 12² + 32 vs 12² + 33 gives itself away (other tiers keep their seeds' puzzles)
    seen.add(lt).add(rt);
    pairs.push([lt, lv, rt, rv]);
  }
  return pairs;
}

if (typeof module === 'object') module.exports = { PAIRS, TIME, GAP, generate };
