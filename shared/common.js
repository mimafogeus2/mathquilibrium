// Shared by every game: seeded RNG and the pack layout. No DOM, so node tests can require() it.

const TIERS = { E: 'Easy', M: 'Medium', H: 'Hard' };
const PACK_SIZE = 1000;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
const int = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];

// A game's special day ("YYYY-MM-DD|Occasion|puzzle line", from its special.js): { occasion, line }, or undefined.
function special(list, date) {
  const s = list.find((l) => l.startsWith(date + '|'));
  if (s) { const i = s.indexOf('|', 11); return { occasion: s.slice(11, i), line: s.slice(i + 1) }; }
}

if (typeof module === 'object') module.exports = { TIERS, PACK_SIZE, rng, hash, int, pick, special };
