'use strict';
// A custom level, as the editor makes it and a share link carries it: { s: subject, t: top label, b: bottom label, c: [[name, value] ×10] },
// cards in the right order. No DOM, so test.js can require() it.
const CUSTOM = { cards: 10, subject: 80, label: 24, name: 30, value: 24 }; // name/value: the same limits test.js holds the real levels to

// The level as game.js plays it, or null if anything is off (a link from somewhere else, or edited by hand).
function customLevel(o) {
  const ok = (x, max) => typeof x === 'string' && x.trim() !== '' && x.length <= max;
  if (!o || !ok(o.s, CUSTOM.subject) || !ok(o.t, CUSTOM.label) || !ok(o.b, CUSTOM.label) || !Array.isArray(o.c) || o.c.length !== CUSTOM.cards) return null;
  if (!o.c.every((c) => Array.isArray(c) && ok(c[0], CUSTOM.name) && ok(c[1], CUSTOM.value))) return null;
  if (new Set(o.c.map((c) => c[0].trim().toLowerCase())).size !== CUSTOM.cards) return null;
  return { d: 0, topic: '', custom: true, subject: o.s, top: o.t, bottom: o.b, items: o.c.map(([name, val]) => ({ name, val })) };
}

if (typeof module === 'object') module.exports = { CUSTOM, customLevel };
