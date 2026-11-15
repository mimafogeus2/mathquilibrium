'use strict';
// WordSwipe: a subject, 24 words, a 60-second fuse. Right = fits, left = doesn't.
// Borrows storage, sound, confetti and helpers from shared/core.js (but not its level-pack shell: no boot()).
// Rounds come from rounds.js: ROUNDS[i] = "Subject|yes,yes,...|no,no,...", or are made up ({ s, y, n }, see custom.js):
// editor.html tests one and play.html plays one from a link, as key 'C', which nothing saves or counts.
const TIME = 60000, PENALTY = 3000, PER_RIGHT = 10, PER_SEC = 5;

// Which round: the daily walks the pool by day number, unlimited by a counter; the multipliers are
// coprime with the pool size, so neither repeats until all rounds have been played.
const DAY0 = Date.UTC(2026, 0, 1);
const dailyIndex = (date) => ((Math.round((Date.parse(date) - DAY0) / 864e5) * 1237 + 4021) % ROUNDS.length + ROUNDS.length) % ROUNDS.length;
const unlimitedIndex = (n) => (n * 2903 + 1777) % ROUNDS.length;
// On a special day (special.js) its themed round replaces the pool's.
const dailyLine = (date) => (IMP ? ROUNDS[(dailyIndex(date) + 1013) % ROUNDS.length] : special(SPECIAL, date)?.line ?? ROUNDS[dailyIndex(date)]);
// Impossible Mode's daily: a Reversed light (#rev) that rerolls every 2–3 answers, 50/50; while it's on, every answer is the other way round.
// Seeded by the day, so everyone gets the same flips on the same cards. It starts off. A wrong swipe costs 5s, not 3.
function reversals(seed) {
  const rand = rng(seed), out = [];
  for (let on = false; out.length < 24; on = rand() < 0.5) out.push(...Array(2 + (rand() < 0.5)).fill(on));
  return out.slice(0, 24);
}
const flipped = () => IMP && !!R?.flip?.[R.marks.length];
const penaltyMs = () => (IMP ? 5000 : PENALTY);
function light(sound) {
  const el = $('#rev');
  if (!el) return;
  const on = flipped();
  if (sound && on !== el.classList.contains('on')) sfx.toggle(on);
  el.classList.toggle('on', on);
  el.setAttribute('aria-label', T(on ? 'Reversed: on' : 'Reversed: off'));
}

// The tutorial (key 'T'): five words in a fixed order, no fuse, nothing saved; coach() (core.js) talks it through.
// Only the right answer goes through: answer() asks coachAllows(saidYes) first.
const TUTORIAL = () => ({ subject: T('Fruit'), cards: [[T('Apple'), true], [T('Carrot'), false], [T('Banana'), true], [T('Bread'), false], [T('Mango'), true]].map(([w, yes]) => ({ w, yes })) });
const rightAnswer = (y) => y === R.cards[R.marks.length].yes;
const TUT_STEPS = () => [
  [T('Does <b>{word}</b> fit <b>{subject}</b>? It does: swipe it <b>right</b>, or tap ✓.', { word: T('Apple'), subject: T('Fruit') }), () => R?.marks.length >= 1, '#btn-yes', rightAnswer],
  [T('<b>{word}</b> doesn\'t fit: swipe it <b>left</b>, or tap ✗.', { word: T('Carrot') }), () => R?.marks.length >= 2, '#btn-no', rightAnswer],
  [T('A real round is 24 words against a 60-second fuse. Each right answer scores 10 points, and every second left at the end 5 more, so a wrong one, which burns <b>3 seconds</b>, costs you points too. Finish these three.'), null, null, rightAnswer],
];

const parse = (line) => { const [s, y, n] = line.split('|'); return { s, y: y.split(','), n: n.split(',') }; };
function deal({ s: subject, y, n }, seed) {
  const cards = [...y.map((w) => ({ w, yes: true })), ...n.map((w) => ({ w, yes: false }))];
  const rand = rng(seed);
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return { subject, cards };
}

const score = (r) => r.marks.filter(Boolean).length * PER_RIGHT + (r.marks.length === r.cards.length ? Math.ceil(r.left / 1000) * PER_SEC : 0);

// ---------- state ----------
// R = the round being played: { key, date?, n?, subject, cards, marks: [right?], left: ms, over }
let R = null, raf = 0, last = 0;
const today = () => ymd(new Date());
const save = () => { if (R && !R.over && R.key !== 'C' && R.key !== 'T') { store.cur = R; persist(); } };

function screen(id) {
  if (id !== 'game') coach(null);
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  if (id === 'home') { home(); toMenu(); }
}

function home() {
  const t = today(), sp = !IMP && special(SPECIAL, t), rec = store.daily[t]?.r, st = streak();
  $('#daily-meta').innerHTML = todayLine(st);
  $('#btn-daily').classList.toggle('done', !!rec);
  rollIn($('#btn-daily'), 'r');
  $('#btn-daily small').textContent = rec ? `✓ ${T('{n} points', { n: rec.s })} · ${T('see result')}` : store.cur?.key === 'D' + t ? T('Resume') : sp ? sp.occasion : T('24 words · 60 seconds');
  $('#btn-unlimited small').textContent = T('Round {n}', { n: store.n + 1 }) + (store.best ? ' · ' + T('best {n}', { n: store.best }) : '') +
    (store.cur?.key === 'U' + store.n ? ' · ' + T('resume') : '');
}

// play(key): 'D<date>' the daily, 'U<n>' unlimited round n; play('C', round) a made-up round.
function play(key, round) {
  const tut = key === 'T', custom = key === 'C' || tut, date = key[0] === 'D' ? key.slice(1) : null, n = date || custom ? null : +key.slice(1);
  // A finished daily shows its result over the menu.
  if (date && store.daily[date]?.r) { toMenu(false); screen('home'); return showEnd(store.daily[date].r, true); }
  R = tut ? { key, ...TUTORIAL(), marks: [], left: TIME, over: false }
    : store.cur?.key === key ? store.cur
    : custom ? { key, round, ...deal(round, Math.random() * 2 ** 32), marks: [], left: TIME, over: false }
    : { key, date, n, ...deal(parse(date ? dailyLine(date) : ROUNDS[unlimitedIndex(n)]), hash(key)), marks: [], left: TIME, over: false, flip: IMP ? reversals(hash('R' + key)) : null };
  $('#g-title').textContent = tut ? T('Tutorial') : custom ? T('Custom round') : date ? T('Daily') : T('Round {n}', { n: n + 1 });
  const sp = date && !IMP && special(SPECIAL, date);
  $('#g-sub').textContent = date ? shortDate(date) + (sp ? ' · ' + sp.occasion : '') : '';
  $('#subject').textContent = R.subject;
  screen('game');
  $('#game').classList.remove('done');
  $('#btn-result').hidden = true;
  if (!custom || tut) toGame(tut ? 'tutorial' : date ? 'daily' : `round-${n + 1}`); // a custom round's page keeps its own hash (play.html: the round)
  track(tut ? 'tutorial' : 'start', custom ? 'custom' : mode(date));
  coach(tut && TUT_STEPS(), { onEnd: goHome });
  $('#stack').replaceChildren();
  refill();
  hud();
  last = performance.now();
  cancelAnimationFrame(raf);
  if (!tut) raf = requestAnimationFrame(frame); // the tutorial has no fuse
  light(false);
  if (IMP && date) impossibleIntro([T('A <b>Reversed</b> light sits under the subject. Every few words it may switch on or off.'),
    T('While it\'s <b>on</b>, answer the other way round: swipe <b>left</b> if the word fits, <b>right</b> if it doesn\'t.'),
    T('A wrong swipe costs <b>5 seconds</b>.')], () => {}); // the fuse waits while it's open
}

// The fuse burns only while the round is on screen and no dialog covers it.
function frame(now) {
  const dt = now - last;
  last = now;
  if (!R || R.over) return;
  if (!document.hidden && !$('#game').hidden && !document.querySelector('dialog[open], :popover-open')) {
    const before = Math.ceil(R.left / 1000);
    R.left -= Math.min(dt, 250);
    const after = Math.ceil(R.left / 1000);
    if (after < before && after <= 5 && after > 0) sfx.tap();
    if (R.left <= 0) { R.left = 0; hud(); return finish(); }
    hud();
  }
  raf = requestAnimationFrame(frame);
}

function hud() {
  const secs = Math.ceil(R.left / 1000);
  $('#clock').textContent = secs;
  $('#fuse').style.width = (R.left / TIME) * 100 + '%';
  $('#game').classList.toggle('hurry', secs <= 10);
  $('#progress').textContent = T('{n} / {total}', { n: Math.min(R.marks.length + 1, R.cards.length), total: R.cards.length });
  $('#score').textContent = T('{n} pts', { n: R.marks.filter(Boolean).length * PER_RIGHT });
}

// ---------- cards ----------
// The stack shows the current card and two behind it.
function refill() {
  const st = $('#stack');
  for (let i = R.marks.length + st.querySelectorAll('.card:not(.gone)').length; i < Math.min(R.marks.length + 3, R.cards.length); i++) {
    const c = document.createElement('div');
    c.className = 'card';
    c.textContent = R.cards[i].w;
    c.dataset.yes = T('YES');
    c.dataset.no = T('NOPE');
    c.style.setProperty('--len', R.cards[i].w.length);
    st.prepend(c);
  }
  st.querySelectorAll('.card:not(.gone)').forEach((c, i, all) => c.style.setProperty('--depth', all.length - 1 - i));
  const top = topCard();
  if (top && R.marks.length) top.classList.add('up'); // not the first card: it was dealt, not uncovered
  if (top) { top.setAttribute('role', 'img'); top.setAttribute('aria-label', T('{word}: does it fit {subject}?', { word: top.textContent, subject: R.subject })); }
}
const topCard = () => [...$('#stack').querySelectorAll('.card:not(.gone)')].pop();

function answer(saidYes) {
  if (!R || R.over || $('#game').hidden || !coachAllows(saidYes)) return false;
  const card = R.cards[R.marks.length], el = topCard(), right = card.yes === (flipped() ? !saidYes : saidYes);
  R.marks.push(right);
  el.classList.add('gone', right ? 'right' : 'wrong');
  el.style.setProperty('--dir', saidYes ? 1 : -1);
  el.addEventListener('animationend', () => el.remove(), { once: true });
  setTimeout(() => el.remove(), 600); // reduced motion: no animationend
  if (right) sfx.good(R.marks.filter(Boolean).length % 8);
  else {
    sfx.bad();
    R.left = Math.max(0, R.left - penaltyMs());
    flash($('#clock'), 'shake');
    penalty();
  }
  hud();
  if (R.marks.length === R.cards.length || R.left <= 0) { finish(); return true; }
  refill();
  light(true);
  save();
  return true;
}

function penalty() {
  const p = document.createElement('span');
  p.className = 'minus';
  p.textContent = T('−{n}s', { n: penaltyMs() / 1000 });
  $('.bar-end').append(p);
  setTimeout(() => p.remove(), 900);
}

// Drag the top card; past a third of the card width (or a quick flick) it counts.
function drag(e) {
  const el = e.target.closest('.card');
  if (!el || el !== topCard() || R.over) return;
  const x0 = e.clientX, t0 = performance.now(), sc = pageScale();
  let dx = 0;
  el.setPointerCapture(e.pointerId);
  el.classList.add('held');
  const move = (ev) => {
    dx = (ev.clientX - x0) / sc; // in the page's px, like --dx and offsetWidth
    el.style.setProperty('--dx', dx + 'px');
    el.style.setProperty('--lean', Math.max(-1, Math.min(1, dx / 120)));
  };
  const up = () => {
    el.removeEventListener('pointermove', move);
    el.classList.remove('held');
    const fast = Math.abs(dx) / (performance.now() - t0) > 0.6 && Math.abs(dx) > 30;
    // not far enough, or the tutorial turned it down: back to the middle
    if (!((Math.abs(dx) > el.offsetWidth / 3 || fast) && answer(dx > 0))) { el.style.setProperty('--dx', '0px'); el.style.setProperty('--lean', 0); }
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up, { once: true });
  el.addEventListener('pointercancel', up, { once: true });
}

// ---------- end ----------
function finish() {
  if (R.key === 'T') { R.over = true; $('#game').classList.add('done'); sfx.win(); confetti(); return coachEnd(); }
  const custom = R.key === 'C', st = custom ? 0 : streak(), sp = R.date && !IMP && special(SPECIAL, R.date);
  R.over = true;
  cancelAnimationFrame(raf);
  const rec = { s: score(R), m: R.marks.map(Number).join(''), t: R.marks.length === 24 ? Math.ceil(R.left / 1000) : 0, subject: R.subject,
    misses: R.cards.map((c, i) => (R.marks[i] === false ? (c.yes ? '+' : '-') + c.w : null)).filter(Boolean) };
  if (!custom) {
    delete store.cur;
    if (R.date) (store.daily[R.date] ??= {}).r = rec;
    else { store.n = Math.max(store.n, R.n + 1); store.best = Math.max(store.best, rec.s); }
    persist();
    bump(st, R.date && 'r');
  }
  $('#game').classList.add('done');
  if (rec.t) { sfx.win(); confetti(sp ? sp.occasion.split(' ', 1) : undefined); } // a special day throws its own emoji
  track(R.marks.length === 24 ? 'finish' : 'timeout', custom ? 'custom' : mode(R.date));
  setTimeout(() => { if (R) results(); showEnd(rec, !!R?.date); }, rec.t ? 700 : 300); // after the last card has flown
}

// Behind the result: every word, ✓ if it fits, ✗ if not, inked by how you answered it (unanswered ones stay blank).
function results() {
  const HOW = { skip: T('unanswered'), right: T('right'), wrong: T('wrong') };
  $('#stack').innerHTML = `<ul class="results">${R.cards.map((c, i) => {
    const how = R.marks[i] === undefined ? 'skip' : R.marks[i] ? 'right' : 'wrong';
    return `<li class="${how}" aria-label="${esc(c.w)}: ${c.yes ? T('fits') : T("doesn't fit")}, ${HOW[how]}"><i>${c.yes ? '✓' : '✗'}</i>${esc(c.w)}</li>`;
  }).join('')}</ul>`;
}

function showEnd(rec, daily) {
  const right = [...rec.m].filter((c) => c === '1').length, done = rec.m.length === 24;
  $('#end-title').textContent = T(!done ? "Time's up!" : right === 24 ? 'Flawless!' : right >= 20 ? 'Sharp!' : 'Done!');
  $('#end-score').innerHTML = `${rec.s}<small>${T('points')}</small>`;
  const round = !daily && R?.key === 'C' && R.round;
  stamp($('#dlg-end'), { date: daily && today(), label: daily ? '' : round || !R ? T('Custom round') : T('Round {n}', { n: R.n + 1 }), value: T('{n} pts', { n: rec.s }) });
  $('#end-stats').innerHTML = T('<b>{n}/{total}</b> right', { n: right, total: 24 }) + ' · ' +
    (done ? T('<b>{n}s</b> left (+{bonus})', { n: rec.t, bonus: rec.t * PER_SEC }) : T('{n} unanswered', { n: 24 - rec.m.length }));
  $('#end-misses').innerHTML = rec.misses.length
    ? `<p class="muted small">${T('{subject} — you missed:', { subject: esc(rec.subject) })}</p>` +
      rec.misses.map((w) => `<span class="${w[0] === '+' ? 'yes' : 'no'}">${w[0] === '+' ? '✓' : '✗'} ${esc(w.slice(1))}</span>`).join('')
    : '';
  $('#end-next b').textContent = daily ? T(navigator.share ? 'Share result' : 'Copy result') : round ? T('Play again') : T('Round {n}  →', { n: store.n + 1 });
  $('#end-next').onclick = daily ? () => shareDaily(rec) : () => { $('#dlg-end').close(); round ? play('C', round) : play('U' + store.n); };
  $('#btn-result').hidden = false;
  winDaily({ date: daily && today() }, $('#dlg-end'));
  $('#dlg-end').showModal();
}

async function shareDaily(rec) {
  track('share', 'daily');
  const date = today(), grid = [...rec.m.padEnd(24, '.')].map((c) => (c === '1' ? '🟩' : c === '0' ? '🟥' : '⬜'));
  const sp = !IMP && special(SPECIAL, date), text = `${T('{game} daily', { game: game.name })} · ${date}${sp ? ' · ' + sp.occasion : ''}${IMP ? ' · 🔥 ' + T('Impossible') : ''}\n${[0, 6, 12, 18].map((i) => grid.slice(i, i + 6).join('')).join('\n')}\n` +
    T('{n} points', { n: rec.s }) + ' · ' + (rec.t ? T('{n}s left', { n: rec.t }) : '⏰ ' + T('out of time')) +
    (location.protocol.startsWith('http') ? '\n' + location.origin + location.pathname + (IMP ? '' : '#daily') : '');
  if (navigator.share) try { return await navigator.share({ text }); } catch (e) { if (e.name === 'AbortError') return; }
  copyLink(text, $('#end-next'));
}

// ---------- wiring ----------
// Each language has its own rounds, so its own progress
game = { name: T('WordSwipe'), storeKey: LANG === 'en' ? 'wordswipe' : 'wordswipe-' + LANG, glyphs: ['✓', '✗'] };
goImpossible(game);
if (IMP) $('.subject').insertAdjacentHTML('afterend', `<div id="rev" class="rev" role="img"><i></i><span>${esc(T('Reversed'))}</span></div>`);
try { store = JSON.parse(localStorage.getItem(game.storeKey)) || {}; } catch { store = {}; }
store = { daily: {}, n: 0, best: 0, seenHelp: false, ...store };

// Leave the round: the menu here; editor.html and play.html set their own.
const goHome = () => { save(); cancelAnimationFrame(raf); R = null; screen('home'); };
$('#btn-back').onclick = goHome;
$('#btn-yes').onclick = () => answer(true);
$('#btn-no').onclick = () => answer(false);
$('#stack').addEventListener('pointerdown', drag);
// Giving up runs the clock out: the round ends as if time were up.
$('#btn-giveup').onclick = () => { if (R && !R.over && confirm(T('Give up? The round ends now, scored as it stands.'))) { R.left = 0; hud(); finish(); } };
$('#btn-result').onclick = () => $('#dlg-end').showModal();
$('#dlg-help')?.addEventListener('close', () => { store.seenHelp = true; persist(); });
document.addEventListener('visibilitychange', () => document.hidden && save());
document.addEventListener('keydown', (e) => {
  if (!R || $('#game').hidden || document.querySelector('dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'ArrowRight') answer(true);
  else if (e.key === 'ArrowLeft') answer(false);
  else if (e.key === 'Escape') $('#btn-back').click();
  else return;
  e.preventDefault();
});

// Paper version: the 24 words in three columns of 8, each with a fits / doesn't box. No clock on paper.
printable(() => R && {
  top: `<p class="subject"><small>${T('Does it fit?')}</small><b>${esc(R.subject)}</b></p>`,
  rules: [
    T('Each of these <b>24 words</b> either fits the subject above or it doesn\'t.'),
    T('Tick <b>✓</b> if the word fits, <b>✗</b> if it doesn\'t. One box per word.'),
  ],
  body: words(false),
  answer: words(true),
}, (_, date) => { R = deal(parse(dailyLine(date)), hash('D' + date)); });
function words(solved) {
  const box = (mark) => `<span class="p-box">${solved ? mark : ''}</span>`;
  return `<div class="p-words">${[0, 8, 16].map((i) => `<ul><li class="p-key"><b>✓</b><b>✗</b></li>${R.cards.slice(i, i + 8).map((c) =>
    `<li>${box(c.yes ? '✓' : '')}${box(c.yes ? '' : '✗')}${esc(c.w)}</li>`).join('')}</ul>`).join('')}</div>`;
}
// The rest is the game's own page (index.html), with its menu: editor.html and play.html have no #home.
if ($('#home')) {
  $('#btn-help').onclick = () => { track('help', ''); $('#dlg-help').showModal(); };
  $('#btn-daily').onclick = () => play('D' + today());
  if (IMP) { // the regular daily, disabled, above the Impossible one
    const off = Object.assign(document.createElement('button'), { className: 'btn daily', disabled: true, innerHTML: `<b>${esc(T("Today's round"))}</b>` });
    $('#btn-daily').before(off);
    $('#btn-daily b').textContent = T('Impossible');
  }
  $('#btn-unlimited').onclick = () => play('U' + store.n);
  tutorialLink(() => play('T'));
  $('#end-home').onclick = () => { $('#dlg-end').close(); screen('home'); };
  // #daily is today's round; #round-7 is unlimited round 7, open once reached (so Forward can replay the last one).
  router((h) => {
    const n = h === 'daily' ? -1 : /^round-\d+$/.test(h) ? +h.slice(6) - 1 : NaN;
    if (h === 'tutorial') play('T');
    else if (n === -1) play('D' + today());
    else if (n >= 0 && n <= store.n) play('U' + n);
    else return false;
    return true;
  }, goHome);
  if (!store.seenHelp && !IMP && !R) $('#dlg-help').showModal();
}
