// node build-notes.js — the notes a player sees on tapping a word on WordSwipe's or Orderly's result (shared/core.js: note()).
// They live beside each game as notes/<n>.json, n = hash(subject) % SHARDS: { subject: { word: note } }, so a page fetches only the shard
// of the round it shows. The notes are written in batches (by Sonnet subagents, one batch each):
//   node build-notes.js batches <dir> — writes <dir>/<source>-<k>.txt: the rounds and levels that still lack a note, one puzzle line each
//   node build-notes.js check <in.txt> <out.jsonl> — checks a batch's answer: one JSON line per puzzle, {"s": subject, "n": {word: note}}
//   node build-notes.js merge <dir> — adds every <dir>/*.jsonl answer to the shards, then says what's still missing
'use strict';
const fs = require('fs'), path = require('path');
const { hash, special } = require('./shared/common.js');
const SHARDS = 64, MAX = 240;
// A note shorter than MIN says too little ("Leopards have spots."), and a batch whose notes average under AVG has gone thin; Hebrew runs shorter
const MIN = { en: 40, he: 30 }, AVG = { en: 75, he: 60 };
// source: [folder, puzzles per batch, puzzle lines → [subject, words]]
const ws = (l) => { const [s, y, n] = l.split('|'); return [s, [...y.split(','), ...n.split(',')]]; };
const or = (l) => { const f = l.split('|'); return [f[2], f[5].split(';').map((x) => x.split('=')[0])]; };
const SOURCES = { 'ws-en': ['wordswipe', 20, ws, 'rounds.js'], 'ws-he': ['he/wordswipe', 20, ws, 'rounds.js'], 'or-en': ['orderly', 50, or, 'levels.js'], 'or-he': ['he/orderly', 50, or, 'levels.js'] };
const puzzles = (src) => {
  const [dir, , words, file] = SOURCES[src], lines = [...require(`./${dir}/${file}`), ...require(`./${dir}/special.js`).map((l) => special([l], l.slice(0, 10)).line)];
  return lines.map((line) => ({ line, s: words(line)[0], w: words(line)[1] }));
};
const shardFile = (dir, s) => path.join(__dirname, dir, 'notes', (hash(s) % SHARDS) + '.json');
const readJSON = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);

// The problems with a batch's answer: [] when every puzzle has a note for each of its words, none too long.
function check(lines, out, lang) {
  const got = new Map(), errs = [], lens = [];
  fs.readFileSync(out, 'utf8').split('\n').filter((l) => l.trim()).forEach((l, i) => { try { const o = JSON.parse(l); got.set(o.s, o.n); } catch { errs.push(`line ${i + 1}: not JSON`); } });
  for (const { s, w } of lines) {
    const n = got.get(s), at = lens.length;
    if (!n) { errs.push(`no line for "${s}"`); continue; }
    for (const x of w) {
      if (typeof n[x] !== 'string' || !n[x].trim()) { errs.push(`"${s}": no note for "${x}"`); continue; }
      lens.push(n[x].length);
      if (n[x].length > MAX) errs.push(`"${s}": "${x}" is over ${MAX} characters`);
      if (n[x].length < MIN[lang]) errs.push(`"${s}": "${x}" says too little (under ${MIN[lang]} characters): give a real fact`);
    }
    const avg = lens.slice(at).reduce((a, l) => a + l, 0) / (lens.length - at || 1);
    if (avg < AVG[lang]) errs.push(`"${s}": its notes average ${Math.round(avg)} characters, too thin: aim for 90–160, every round as rich as the first`);
    for (const x in n) if (!w.includes(x)) errs.push(`"${s}": "${x}" isn't one of its words (spell them exactly as given)`);
  }
  return errs;
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'batches') {
  fs.mkdirSync(a, { recursive: true });
  for (const src in SOURCES) {
    const [dir, size] = SOURCES[src], todo = puzzles(src).filter(({ s, w }) => { const n = readJSON(shardFile(dir, s), {})[s]; return !n || w.some((x) => !n[x]); });
    for (let k = 0; k * size < todo.length; k++) fs.writeFileSync(path.join(a, `${src}-${String(k).padStart(3, '0')}.txt`), todo.slice(k * size, (k + 1) * size).map((p) => p.line).join('\n') + '\n');
    console.log(src, todo.length, 'puzzles to write,', Math.ceil(todo.length / size), 'batches');
  }
} else if (cmd === 'check') {
  const src = path.basename(a).slice(0, 5), lines = fs.readFileSync(a, 'utf8').split('\n').filter(Boolean).map((l) => { const [s, w] = SOURCES[src][2](l); return { s, w }; });
  const errs = check(lines, b, src.slice(3));
  console.log(errs.length ? errs.slice(0, 40).join('\n') + (errs.length > 40 ? `\n…and ${errs.length - 40} more` : '') : 'ok');
  process.exit(errs.length ? 1 : 0);
} else if (cmd === 'merge') {
  for (const src in SOURCES) {
    const [dir] = SOURCES[src], all = puzzles(src), shards = {};
    const shard = (s) => { const f = shardFile(dir, s); return (shards[f] ??= readJSON(f, {})); };
    for (const f of fs.readdirSync(a).filter((f) => f.startsWith(src) && f.endsWith('.jsonl')))
      for (const l of fs.readFileSync(path.join(a, f), 'utf8').split('\n')) {
        let o; try { o = JSON.parse(l); } catch { continue; }
        const p = all.find((p) => p.s === o.s);
        if (p) for (const w of p.w) if (typeof o.n?.[w] === 'string' && o.n[w].trim().length >= MIN[src.slice(3)] && o.n[w].length <= MAX) (shard(p.s)[p.s] ??= {})[w] = o.n[w].trim();
      }
    for (const f in shards) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(shards[f]) + '\n'); }
    const missing = all.reduce((m, { s, w }) => m + w.filter((x) => !readJSON(shardFile(dir, s), {})[s]?.[x]).length, 0);
    console.log(src, missing ? missing + ' words still without a note' : 'every word has a note');
  }
} else console.log('usage: node build-notes.js batches <dir> | check <in.txt> <out.jsonl> | merge <dir>');
