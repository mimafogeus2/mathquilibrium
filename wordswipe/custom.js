'use strict';
// A made-up WordSwipe round (editor.html makes them, play.html plays them from a link): { s: subject, y: [fits], n: [doesn't] },
// the same fields as a line of rounds.js. No DOM, so test.js can require() it.
const LIMITS = { total: 24, side: 6, word: 20, subject: 48 };
const wordKey = (w) => w.trim().toLocaleLowerCase();

// What's wrong with one word of list `side` ('y' or 'n'): 'long', 'dup' (twice in its list), 'both' (in both lists), or ''.
function wordIssue(r, side, w) {
  const k = wordKey(w), other = side === 'y' ? r.n : r.y;
  if (w.length > LIMITS.word) return 'long';
  if (other.some((o) => wordKey(o) === k)) return 'both';
  if (r[side].filter((o) => wordKey(o) === k).length > 1) return 'dup';
  return '';
}

// Everything that keeps round r from being played, as codes (none: playable):
// 'shape' (not a round at all: a broken link), 'subject', 'few' / 'many' (words in all), 'side' (a list under LIMITS.side), 'words'.
function roundProblems(r) {
  const words = (a) => Array.isArray(a) && a.every((w) => typeof w === 'string' && w.trim() === w && w);
  if (!r || typeof r !== 'object' || typeof r.s !== 'string' || !words(r.y) || !words(r.n)) return ['shape'];
  const out = [], total = r.y.length + r.n.length;
  if (!r.s.trim() || r.s.length > LIMITS.subject) out.push('subject');
  if (total < LIMITS.total) out.push('few');
  if (total > LIMITS.total) out.push('many');
  if (r.y.length < LIMITS.side || r.n.length < LIMITS.side) out.push('side');
  if (['y', 'n'].some((side) => r[side].some((w) => wordIssue(r, side, w)))) out.push('words');
  return out;
}

if (typeof module === 'object') module.exports = { LIMITS, wordIssue, roundProblems };
