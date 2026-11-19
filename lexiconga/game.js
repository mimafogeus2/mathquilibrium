'use strict';
// Lexiconga: link the box's ten words into one long word. You type a connector from the chain's last letter to the first letter of a
// word in the box; the computer adds that word. Rules, solver and levels: gen.js (Lex). Words: words.js (WORDS), gen-words.js (GEN_WORDS).

const HE = LANG === 'he';
Lex.init(WORDS, GEN_WORDS, HE ? 'he' : 'en');
// Seconds for three and two stars, per difficulty; the hint takes one off (never below one)
const STAR_TIME = { E: [120, 240], M: [180, 360], H: [300, 600], I: [480, 900] };
const KEYS = HE ? ['קראטוןםפ', 'שדגכעיחלךף', 'זסבהנמצתץ'] : ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
// A Hebrew page takes a physical keyboard by key position (the standard Israeli layout), whatever layout the system has on
const HE_CODE = { KeyE: 'ק', KeyR: 'ר', KeyT: 'א', KeyY: 'ט', KeyU: 'ו', KeyI: 'ן', KeyO: 'ם', KeyP: 'פ', KeyA: 'ש', KeyS: 'ד', KeyD: 'ג', KeyF: 'כ',
  KeyG: 'ע', KeyH: 'י', KeyJ: 'ח', KeyK: 'ל', KeyL: 'ך', Semicolon: 'ף', KeyZ: 'ז', KeyX: 'ס', KeyC: 'ב', KeyV: 'ה', KeyB: 'נ', KeyN: 'מ', KeyM: 'צ', Comma: 'ת', Period: 'ץ' };
const TUTORIAL = HE ? { tier: 'E', start: 'חתול', words: ['נמר', 'שמש', 'ענן'].map(Lex.norm) } : { tier: 'E', start: 'cat', words: ['rain', 'nest', 'egg'] };
// the tutorial's lines, filled in per language
// It names every word to type: rain, then a detour to egg that Undo takes back, then nest and egg.
const TUT = HE ? { start: 'חתול', x: 'ל', y: 'נ', w: 'נמר', note: ' (בסוף מילה היא נכתבת ן)', try: 'לימון', next: 'ר', try2: 'רגע', w2: 'ענן', w3: 'שמש', try3: 'ראש', next3: 'ש', try4: 'שבוע' }
  : { start: 'cat', x: 'T', y: 'R', w: 'rain', note: '', try: 'tour', next: 'N', try2: 'nice', w2: 'egg', w3: 'nest', try3: 'noon', next3: 'T', try4: 'tree' };
const only = (w) => (m) => m.word === Lex.norm(w); // the tutorial takes the word it names, nothing else
const written = (w) => (HE ? Lex.finalForm(w) : w); // a word as written on its own
const seed = (G) => hash('lexiconga ' + G.key);

// ---------- state ----------
// G.lv: the level. G.conns: the player's words so far, in order; G.picks: the box word (index) each brought in. Everything else follows:
// the chain is start, conns[0], words[picks[0]], conns[1], ... G.typed: what's typed after the joint letter. G.busy: the computer's turn.
const mask = () => G.picks.reduce((m, i) => m & ~(1 << i), (1 << G.lv.words.length) - 1);
const chainWords = () => [G.lv.start, ...G.conns.flatMap((c, k) => (k < G.picks.length ? [c, G.lv.words[G.picks[k]]] : [c]))];
const cur = () => chainWords().at(-1).at(-1);
const used = () => new Set(G.conns);

function startLevel(G, save) {
  G.lv = G.tut ? TUTORIAL : Lex.level(G.pack, seed(G));
  G.conns = []; G.picks = []; G.typed = ''; G.busy = false; G.shown = 0;
  let restored = false;
  for (const c of save.conns || []) {
    const r = Lex.check(G.lv, mask(), cur(), used(), c);
    if (r.err) break;
    G.conns.push(r.word); G.picks.push(r.i);
    restored = true;
  }
  if (save.hints) G.hinted.add(0);
  $('#final').hidden = true;
  $('#strip').hidden = $('#mini').hidden = false;
  $('#board').classList.remove('solved');
  $('#box').innerHTML = G.lv.words.map((w, i) => `<span class="w" role="listitem" data-i="${i}">${written(w)}</span>`).join('');
  $('#btn-hint').hidden = IMP || !!G.tut;
  $('#g-sub').textContent = G.tut ? '' : T('★★★ in {t}', { t: fmt(STAR_TIME[G.pack][0]) });
  tip();
  render(true);
  return restored;
}

// ---------- drawing ----------
// The chain as letters: { ch, p: typed by the player, j: a joint (a word's last letter, shared with the next), t: still being typed }.
// Hebrew writes every letter in its regular form but the very last one shown, which takes its final form.
function letters() {
  const out = [];
  const ws = chainWords(), open = !!mask(); // the last word's last letter is a joint while there's more to link
  ws.forEach((w, k) => {
    [...w].forEach((ch, i) => { if (k === 0 || i > 0) out.push({ ch, p: k % 2 === 1, j: i === w.length - 1 && (k < ws.length - 1 || open) }); });
  });
  for (const ch of G.typed) out.push({ ch: Lex.norm(ch), p: true, t: true });
  if (HE && out.length) out.at(-1).ch = Lex.finalForm(out.at(-1).ch);
  return out;
}
const span = (l, i, fresh) => `<span class="${[l.p ? 'p' : '', l.j ? 'j' : '', l.t ? 't' : '', fresh ? 'in' : ''].join(' ').trim()}"${fresh ? ` style="--d:${fresh - 1}"` : ''}>${l.ch}</span>`;

// instant: no typing-in for letters already there (a fresh board, a restore, an undo)
function render(instant) {
  const ls = letters(), from = instant ? ls.length : G.shown;
  const typing = !G.busy && !G.done && !!mask();
  $('#strip .track').innerHTML = ls.map((l, i) => span(l, i, i >= from && !l.t ? i - from + 1 : 0)).join('') + (typing ? '<span class="caret"></span>' : '');
  $('#mini .mini-line').innerHTML = ls.map((l) => span(l)).join('');
  G.shown = ls.length;
  for (const el of document.querySelectorAll('#box .w')) el.classList.toggle('used', G.picks.includes(+el.dataset.i));
  $('#btn-undo').disabled = G.done || G.busy || !G.conns.length;
  $('#btn-hint').disabled = G.done || G.busy || G.hinted.size > 0;
  for (const b of document.querySelectorAll('#keys button')) b.disabled = !typing;
  requestAnimationFrame(follow);
}

// The strip shows the chain's end: the last word, a bit of the one before, and room to type. The minimap keeps its letters a fixed
// small size until the whole chain no longer fits its width, then shrinks to fit; a frame marks what the strip shows.
function follow() {
  const strip = $('#strip'), track = $('#strip .track'), W = strip.clientWidth, rtl = getComputedStyle(strip).direction === 'rtl';
  const room = !G.done && mask() ? W * 0.28 : 0, shift = Math.max(0, track.scrollWidth + room - W);
  track.style.transform = `translateX(${rtl ? shift : -shift}px)`;
  const mini = $('#mini'), line = $('#mini .mini-line'), MW = mini.clientWidth;
  line.style.fontSize = '';
  const full = line.scrollWidth;
  if (full > MW) line.style.fontSize = (parseFloat(getComputedStyle(line).fontSize) * MW) / full + 'px';
  const k = line.scrollWidth / Math.max(1, track.scrollWidth), f = $('#mini .mini-frame');
  f.style.width = Math.min(W, track.scrollWidth) * k + 'px';
  f.style.insetInlineStart = shift * k + 'px';
}
addEventListener('resize', () => G?.lv && !$('#game').hidden && follow());

function tip(html) {
  const el = $('#tip');
  if (html) { el.innerHTML = html; return; }
  if (G.done) { el.innerHTML = ''; return; }
  const x = cur().toUpperCase();
  el.innerHTML = Lex.deadEnd(G.lv, mask(), cur(), used())
    ? T('<b>Dead end:</b> no word links {x} to anything left. Undo and try another way.', { x: `<b>${x}</b>` })
    : T('A word from <b>{x}</b> to the first letter of a word in the box.', { x });
}
const say = (s) => { $('#sr').textContent = s; };

// ---------- playing ----------
function type(ch) {
  if (!playing() || G.busy || !mask()) return;
  if (G.typed.length >= 20) return;
  // the joint letter is already there: typing it again rattles it instead
  // ponytail: so a word that starts with a doubled letter (eel, llama) can't be typed; a second press could let it through if that matters
  if (!G.typed && Lex.norm(ch) === cur()) { sfx.tap(); flash([...document.querySelectorAll('#strip .j')].at(-1), 'rattle'); return; }
  G.typed += ch;
  sfx.tap();
  render();
}
function erase() {
  if (!playing() || G.busy || !G.typed) return;
  G.typed = G.typed.slice(0, -1);
  render();
}
const REASON = {
  short: (r) => T('Too short: at least {n} letters here.', { n: r.n }),
  mine: () => T("That's a word from the box: links are your own words."),
  used: () => T('Already in the chain.'),
  word: (r, w) => T('<b>{w}</b> isn\'t in the word list.', { w: esc(written(w)) }),
  end: (r) => T('Nothing left in the box starts with <b>{y}</b>.', { y: r.y.toUpperCase() }),
};
function enter() {
  if (!playing() || G.busy || !mask() || !G.typed) return;
  const w = cur() + Lex.norm(G.typed), r = Lex.check(G.lv, mask(), cur(), used(), w);
  if (r.err || (G.tut && !coachAllows({ word: w }))) {
    if (r.err) { sfx.bad(); tip(REASON[r.err](r, w)); flash($('#strip'), 'shake'); }
    return;
  }
  G.conns.push(r.word);
  G.typed = '';
  G.busy = true;
  sfx.place();
  render();
  // the computer's turn, a beat later: its word types in, the box crosses it out
  setTimeout(() => {
    G.picks.push(r.i);
    G.busy = false;
    sfx.good(G.picks.length);
    say(T('{w} added.', { w: written(G.lv.words[r.i]) }));
    if (!mask()) return finish();
    tip();
    render();
    saveGame();
    coachCheck();
  }, 380);
}
function undo() {
  if (!playing() || G.busy || !G.conns.length) return;
  G.conns.pop(); G.picks.pop();
  G.typed = '';
  G.undid = G.tut && G.picks.length >= 1; // the tutorial's Undo step
  sfx.erase();
  tip();
  render(true);
}
// The one hint: back out to the last position that can still be finished, then type in a common word that keeps it finishable
function hint() {
  if (!playing() || G.busy || IMP || G.hinted.size) return;
  while (G.conns.length && !Lex.solvable(G.lv, mask(), cur(), used())) { G.conns.pop(); G.picks.pop(); }
  const r = Lex.route(G.lv, mask(), cur(), used());
  if (!r) return;
  G.hinted.add(0);
  G.typed = r.steps[0].conn.slice(1);
  sfx.hint();
  track('hint');
  tip(T('Press <b>Enter</b> to add it.'));
  render(true);
}

// ---------- the end ----------
// The last word: the clock stops, the strip whips back past the start, then the whole chain types in, wrapped, as big as fits.
function finish() {
  G.done = true;
  clearInterval(timer);
  $('#game').classList.add('done');
  render();
  tip();
  playFinal(() => win());
}
function playFinal(then, quick) {
  const strip = $('#strip'), track = $('#strip .track'), rtl = getComputedStyle(strip).direction === 'rtl';
  const out = () => {
    strip.hidden = $('#mini').hidden = true;
    const el = $('#final'), ls = letters();
    el.hidden = false;
    el.innerHTML = `<div class="final-text">${ls.map((l, i) => span(l, i, quick ? 0 : 1 + i)).join('')}</div><p class="final-n">${esc(T('One word, {n} letters', { n: ls.length }))}</p>`;
    // the biggest size the chain fits at, wrapped: halve the range until it does
    const text = el.querySelector('.final-text');
    let lo = 10, hi = 72;
    while (hi - lo > 1) { const mid = (lo + hi) / 2; text.style.fontSize = mid + 'px'; if (text.scrollHeight > el.clientHeight - 40 || text.scrollWidth > text.clientWidth) hi = mid; else lo = mid; }
    text.style.fontSize = lo + 'px';
    text.style.setProperty('--step', Math.min(60, 2000 / ls.length) + 'ms');
    const skip = () => { text.classList.add('now'); };
    el.onclick = skip;
    setTimeout(then, quick ? 0 : Math.min(60, 2000 / ls.length) * ls.length + 400);
  };
  if (quick || document.documentElement.hasAttribute('data-calm')) return out();
  track.style.transition = 'transform .45s cubic-bezier(.6, 0, .4, 1)';
  track.style.transform = `translateX(${rtl ? -strip.clientWidth : strip.clientWidth}px)`;
  setTimeout(() => { track.style.transition = ''; out(); }, 480);
}
// Given up, or a solved daily seen again: the answer's chain, written out whole
function reveal(G) {
  G.conns = []; G.picks = []; G.typed = '';
  for (const a of G.lv.answer) { G.conns.push(a.conn); G.picks.push(G.lv.words.indexOf(a.word)); }
  G.done = true;
  render(true);
  tip();
  playFinal(() => {}, true);
}

// ---------- input ----------
// Letters are taken ahead of the shell's own keys (P pauses, there): a capture listener on window runs before core.js's on document
addEventListener('keydown', (e) => {
  if (!G || $('#game').hidden || document.querySelector('dialog[open], :popover-open') || e.ctrlKey || e.metaKey || e.altKey) return;
  let ch = null;
  if (HE) ch = HE_CODE[e.code] || (/^[א-ת]$/.test(e.key) ? e.key : null);
  else if (/^[a-z]$/i.test(e.key)) ch = e.key.toLowerCase();
  if (ch) type(ch);
  else if (e.key === 'Backspace') erase();
  else if (e.key === 'Enter') enter();
  else return;
  e.preventDefault();
  e.stopImmediatePropagation();
}, true);
{
  const key = (label, act, cls = '') => `<button type="button" class="${cls}" data-k="${act}"${cls ? ` aria-label="${label}"` : ''}>${cls === 'wide del' ? '<svg viewBox="0 0 24 24"><path d="M9 6h11v12H9l-6-6zM12 9l5 6M17 9l-5 6"/></svg>' : label}</button>`;
  const rows = KEYS.map((r, i) => `<div class="row">${i === 2 ? key(T('Enter'), 'enter', 'wide') : ''}${[...r].map((c) => key(c, c)).join('')}${i === 2 ? key(T('Delete'), 'del', 'wide del') : ''}</div>`);
  $('#keys').innerHTML = rows.join('');
  // pointerdown, not click: typing fast on a phone shouldn't wait for the click (or lose a double tap to zoom)
  $('#keys').addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    e.preventDefault();
    const k = b.dataset.k;
    if (k === 'enter') enter(); else if (k === 'del') erase(); else type(k);
    b.classList.add('down');
    setTimeout(() => b.classList.remove('down'), 120);
  });
}
$('#btn-undo').onclick = undo;
$('#btn-hint').onclick = hint;

// ---------- paper ----------
// The start word, the box, and ten lines to write the links on. Answer: one way through.
printable(() => ({
  rules: [
    T('Link the box into one long word: each word you write starts with the chain\'s last letter and ends with the first letter of a box word, which comes next.'),
    T('Your words can\'t be box words, and each is used once.'),
  ],
  top: `<p class="p-start">${esc(written(G.lv.start))}</p><div class="p-words-box">${G.lv.words.map((w) => `<span>${esc(written(w))}</span>`).join('')}</div>`,
  body: `<ol class="p-lines">${G.lv.words.map(() => '<li><i></i><span>→</span><i></i></li>').join('')}</ol>`,
  answer: `<ol class="p-lines">${G.lv.answer.map((a) => `<li><b>${esc(written(a.conn))}</b><span>→</span><b>${esc(written(a.word))}</b></li>`).join('')}</ol>`,
}), (k, date) => { G = { pack: k, key: 'D' + k + date }; G.lv = Lex.level(k, seed(G)); });

// Home logo: a little chain, joints in the brand ink
$('#logo').innerHTML = `<p class="logo-chain">${HE ? 'שמ<b>ש</b>ול<b>ח</b>תו<b>ל</b>ימון' : 'ca<b>t</b>ang<b>o</b>rang<b>e</b>gg'}</p>`;

boot({ name: T('Lexiconga'),
  // the tutorial level's own words: TUTORIAL (above)
  tutorial: [
    [T('Your word starts where <b>{start}</b> ends: the <b>{x}</b> is already there. End it on <b>{y}</b>, the first letter of <b>{w}</b>{note}: type <b>{try}</b>, then Enter.', TUT), () => G.picks.length >= 1, '#keys', only(TUT.try)],
    [T('The computer added <b>{w}</b> and crossed it out. Now from <b>{next}</b>: type <b>{try2}</b>, which ends on the first letter of <b>{w2}</b>.', TUT), () => G.picks.length >= 2, '#keys', only(TUT.try2)],
    [T('Changed your mind? <b>Undo</b> takes back your word and the one it brought in.'), () => G.undid, '#btn-undo', () => false],
    [T('This time, head for <b>{w3}</b>: type <b>{try3}</b>.', TUT), () => G.conns.includes(Lex.norm(TUT.try3)), '#keys', only(TUT.try3)],
    [T('Last one, from <b>{next3}</b> to <b>{w2}</b>: type <b>{try4}</b>. In a real level the words are yours to find, and the <b>hint</b> types one for you, for a star.', TUT), null, '#keys', only(TUT.try4)],
  ],
  storeKey: 'lexiconga' + LSUF, random: true, glyphs: HE ? ['א', 'ש', 'ל'] : ['a', 'x', 'e'], start: startLevel,
  save: (G) => ({ conns: G.conns, hints: G.hinted.size }), key: () => false, reveal,
  extra: () => '🔤 ' + T('One word, {n} letters', { n: letters().length }), // the whole chain's length, for the share
  stars: (G) => { const [a, b] = STAR_TIME[G.pack]; return Math.max(1, (G.elapsed <= a ? 3 : G.elapsed <= b ? 2 : 1) - G.hinted.size); } });
game.impossible = { stars: game.stars };
