'use strict';
// Lexiconga's rules, solver and level generator. No DOM: node tests require() it.
// A level: a start word and 10 collection words. The player types a connector: it starts with the chain's last letter and ends with the
// first letter of a collection word still left; the computer then adds that word (the first such, in collection order, that leaves the
// rest solvable). Done when all 10 are in. Words are compared normalized: Hebrew final letters as regular ones (ך→כ).
const Lex = (() => {
  const FIN = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' }, TO_FIN = { 'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ' };
  const norm = (w) => w.toLowerCase().replace(/[ךםןףץ]/g, (c) => FIN[c]);
  const finalForm = (w) => w.slice(0, -1) + (TO_FIN[w.slice(-1)] || w.slice(-1)); // a word as written: its last letter in final form
  // Connectors' least length, by tier. Hebrew words are shorter (no written vowels): one less.
  const MIN = { en: { E: 3, M: 3, H: 4, I: 5 }, he: { E: 2, M: 2, H: 3, I: 4 } };
  // Where collection words are dealt from in GEN_WORDS (frequency ranks [from, to)) and how long they are. The first 100 are mostly
  // little words (that, what) and stay out.
  const DEAL = {
    en: { E: [100, 2500, 3, 5], M: [100, 6000, 4, 7], H: [800, 12000, 6, 10], I: [3000, 20000, 8, 14] },
    he: { E: [100, 1500, 3, 4], M: [100, 4000, 3, 6], H: [500, 8000, 4, 7], I: [2000, 12000, 5, 9] },
  };
  // The easiest way through, scored by its scarcest link: how many common connectors (GEN_WORDS, long enough) fit that link's two letters.
  // A tier wants that bottleneck in [lo, hi], and at least `rare` links on that best route with fewer than 6. Hebrew's common list is
  // smaller (nouns only), so its counts run lower.
  const GRADE = {
    en: { E: [10, Infinity, 0], M: [5, 12, 0], H: [2, 5, 1], I: [0, 2, 3] },
    he: { E: [8, Infinity, 0], M: [5, 9, 0], H: [2, 5, 1], I: [1, 2, 3] },
  };

  let lang, all, gen, rankOf;
  const idx = {}; // per tier: { all: Map 'xy' -> count of typable words, gen: Map 'xy' -> common words, most frequent first }
  function init(words, genWords, language) {
    lang = language;
    all = new Set(words.split(' '));
    gen = genWords.split(' ');
    rankOf = new Map(gen.map((w, i) => [w, i]));
    for (const k in idx) delete idx[k];
  }
  function index(tier) {
    if (idx[tier]) return idx[tier];
    const min = MIN[lang][tier], a = new Map(), g = new Map();
    for (const w of all) if (w.length >= min) { const k = w[0] + w.at(-1); a.set(k, (a.get(k) || 0) + 1); }
    for (const w of gen) if (w.length >= min) { const k = w[0] + w.at(-1); if (!g.has(k)) g.set(k, []); g.get(k).push(w); }
    return (idx[tier] = { all: a, gen: g });
  }

  // ---------- solving ----------
  // A position: the level, which collection words are left (bitmask over lv.words), the chain's last letter, and the connectors used.
  // links(x, y): typable connectors from x to y not yet used (collection words don't count).
  function solver(lv, used = new Set()) {
    const I = index(lv.tier), taken = new Set([lv.start, ...lv.words, ...used]), memo = new Map();
    const pairUsed = new Map();
    for (const w of taken) if (w.length >= MIN[lang][lv.tier] && all.has(w)) { const k = w[0] + w.at(-1); pairUsed.set(k, (pairUsed.get(k) || 0) + 1); }
    const links = (x, y) => (I.all.get(x + y) || 0) - (pairUsed.get(x + y) || 0);
    // ponytail: a connector used later down the same route isn't counted against the link; only matters for a link with one or two words
    const solvable = (mask, cur) => {
      if (!mask) return true;
      const key = mask * 64 + cur.charCodeAt(0) % 64;
      if (memo.has(key)) return memo.get(key);
      memo.set(key, false);
      const firsts = new Set(lv.words.filter((_, i) => mask & (1 << i)).map((w) => w[0]));
      const ok = [...firsts].some((y) => links(cur, y) > 0 && pick(mask, y) >= 0 && solvable(mask & ~(1 << pick(mask, y)), lv.words[pick(mask, y)].at(-1)));
      memo.set(key, ok);
      return ok;
    };
    // The computer's word for letter y: the first left starting with y that leaves the rest solvable, else the first left (a dead end)
    const pick = (mask, y) => {
      let first = -1;
      for (let i = 0; i < lv.words.length; i++) if (mask & (1 << i) && lv.words[i][0] === y) {
        if (first < 0) first = i;
        if (solvable(mask & ~(1 << i), lv.words[i].at(-1))) return i;
      }
      return first;
    };
    return { solvable, pick, links };
  }

  // The easiest route from a position: the letter order that keeps the scarcest link's count of common connectors highest.
  // Returns { score, steps: [{ y, i, conn }] } (i: the collection word the computer adds), or null if there's no way through.
  function route(lv, mask, cur, used = new Set()) {
    const S = solver(lv, used), I = index(lv.tier), memo = new Map();
    const out1 = new Map(); // common connectors a link loses to this level's own words and the ones used
    for (const w of new Set([...used, lv.start, ...lv.words])) if (rankOf.has(w) && w.length >= MIN[lang][lv.tier]) out1.set(w[0] + w.at(-1), (out1.get(w[0] + w.at(-1)) || 0) + 1);
    const common = (x, y) => (I.gen.get(x + y)?.length || 0) - (out1.get(x + y) || 0);
    const best = (mask, cur) => {
      if (!mask) return { score: Infinity, steps: [] };
      const key = mask * 64 + cur.charCodeAt(0) % 64;
      if (memo.has(key)) return memo.get(key);
      let out = null;
      for (const y of new Set(lv.words.filter((_, i) => mask & (1 << i)).map((w) => w[0]))) {
        if (S.links(cur, y) <= 0) continue;
        const i = S.pick(mask, y), rest = mask & ~(1 << i);
        if (!S.solvable(rest, lv.words[i].at(-1))) continue;
        const r = best(rest, lv.words[i].at(-1)), score = Math.min(common(cur, y), r.score);
        if (!out || score > out.score) out = { score, steps: [{ x: cur, y, i }, ...r.steps] };
      }
      memo.set(key, out);
      return out;
    };
    const r = best(mask, cur);
    if (!r) return null;
    // a connector for each step: the most common one free (not used, not in the level, not taken by an earlier step), else any typable
    const taken = new Set([...used, lv.start, ...lv.words]), min = MIN[lang][lv.tier];
    for (const s of r.steps) {
      s.conn = (I.gen.get(s.x + s.y) || []).find((w) => !taken.has(w)) || [...all].find((w) => w.length >= min && w[0] === s.x && w.at(-1) === s.y && !taken.has(w));
      s.rare = common(s.x, s.y) < 6;
      taken.add(s.conn);
    }
    return r;
  }

  // ---------- dealing ----------
  // level(tier, seed): { tier, start, words, answer: [{ conn, word }] }. Draws collections from the tier's slice of GEN_WORDS until one
  // grades into the tier. Deterministic for a seed (and a given GEN_WORDS, which is why that list is frozen).
  function level(tier, seed) {
    const rand = rng(seed), [from, to, lo, hi] = DEAL[lang][tier], [gLo, gHi, rare] = GRADE[lang][tier];
    const pool = gen.slice(from, to).filter((w) => w.length >= lo && w.length <= hi);
    for (let tries = 0; ; tries++) {
      const words = [], firsts = new Set();
      const start = pick(rand, pool);
      while (words.length < 10) {
        const w = pick(rand, pool);
        if (w === start || words.includes(w)) continue;
        // Easy: ten different first letters; Medium: one shared at most
        if (firsts.has(w[0]) && (tier === 'E' || (tier === 'M' && words.length - firsts.size >= 1)) && tries < 5000) continue;
        words.push(w);
        firsts.add(w[0]);
      }
      const lv = { tier, start, words }, r = route(lv, 1023, start.at(-1));
      if (!r || r.steps.some((s) => !s.conn)) continue; // no way through, or one rare link needed twice with one word for it
      // past a few thousand tries, take any solvable one rather than hang (never seen in the tests)
      const fits = r.score >= gLo && r.score <= gHi && r.steps.filter((s) => s.rare).length >= rare;
      if (!fits && tries < 3000) continue;
      lv.answer = r.steps.map((s) => ({ conn: s.conn, word: words[s.i] }));
      lv.score = r.score;
      return lv;
    }
  }

  // ---------- playing ----------
  // A word typed at a position (mask, cur, used: a Set of connectors so far): the reason it doesn't fit, or { i }: the word the computer adds.
  function check(lv, mask, cur, used, typed) {
    const w = norm(typed);
    if (w[0] !== cur) return { err: 'start' };
    if (w.length < MIN[lang][lv.tier]) return { err: 'short', n: MIN[lang][lv.tier] };
    if (w === lv.start || lv.words.includes(w)) return { err: 'mine' };
    if (used.has(w)) return { err: 'used' };
    if (!all.has(w)) return { err: 'word' };
    const S = solver(lv, new Set([...used, w])), i = S.pick(mask, w.at(-1));
    if (i < 0) return { err: 'end', y: w.at(-1) };
    return { i, word: w };
  }
  // No typable connector reaches any word left
  const deadEnd = (lv, mask, cur, used) => {
    const S = solver(lv, used);
    return !lv.words.some((w, i) => mask & (1 << i) && S.links(cur, w[0]) > 0);
  };
  const solvable = (lv, mask, cur, used) => solver(lv, used).solvable(mask, cur);

  return { init, level, route, check, deadEnd, solvable, norm, finalForm, MIN };
})();

if (typeof module === 'object') module.exports = Lex;
