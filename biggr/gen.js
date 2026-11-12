// Biggr level engine: 10 pairs of sums per level, generated from a seed. Uses rng/int/pick from shared/common.js (a global).
// A pair is [left text, left value, right text, right value]; the values always differ, by at most GAP[tier].

const PAIRS = 10;
const TIME = { E: 45, M: 70, H: 90 }; // seconds per level
const GAP = { E: 4, M: 5, H: 6 };

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
};

// ponytail: rejection sampling, a few dozen tries per pair at most; plenty fast for one level at a time.
function generate(seed, tier) {
  const r = rng(seed), pairs = [], seen = new Set();
  while (pairs.length < PAIRS) {
    const [lt, lv] = pick(r, SUMS[tier])(r), [rt, rv] = pick(r, SUMS[tier])(r), d = Math.abs(lv - rv);
    if (lv < 0 || rv < 0 || d === 0 || d > GAP[tier] || seen.has(lt) || seen.has(rt)) continue;
    seen.add(lt).add(rt);
    pairs.push([lt, lv, rt, rv]);
  }
  return pairs;
}

if (typeof module === 'object') module.exports = { PAIRS, TIME, GAP, generate };
