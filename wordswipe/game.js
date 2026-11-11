'use strict';
// WordSwipe: a subject, 24 words, a 60-second fuse. Right = fits, left = doesn't.
// Borrows storage, sound, confetti and helpers from shared/core.js (but not its level-pack shell: no boot()).
// Rounds come from rounds.js: ROUNDS[i] = "Subject|yes,yes,...|no,no,...".
const TIME = 60000, PENALTY = 3000, PER_RIGHT = 10, PER_SEC = 5;

// Which round: the daily walks the pool by day number, unlimited by a counter; the multipliers are
// coprime with the pool size, so neither repeats until all rounds have been played.
const DAY0 = Date.UTC(2026, 0, 1);
const dailyIndex = (date) => ((Math.round((Date.parse(date) - DAY0) / 864e5) * 1237 + 4021) % ROUNDS.length + ROUNDS.length) % ROUNDS.length;
const unlimitedIndex = (n) => (n * 2903 + 1777) % ROUNDS.length;
// On a special day (special.js) its themed round replaces the pool's.
const dailyLine = (date) => special(SPECIAL, date)?.line ?? ROUNDS[dailyIndex(date)];

function deal(line, seed) {
  const [subject, yes, no] = line.split('|');
  const cards = [...yes.split(',').map((w) => ({ w, yes: true })), ...no.split(',').map((w) => ({ w, yes: false }))];
  const rand = rng(seed);
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return { subject, cards };
}

const score = (r) => r.marks.filter(Boolean).length * PER_RIGHT + (r.marks.length === r.cards.length ? Math.ceil(r.left / 1000) * PER_SEC : 0);

// ---------- state ----------
// R = the round being played: { key, date?, n?, subject, cards, marks: [right?], left: ms, over }
let R = null, raf = 0, last = 0;
const today = () => ymd(new Date());
const save = () => { if (R && !R.over) store.cur = R; persist(); };

function screen(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  if (id === 'home') home();
}

function home() {
  const t = today(), sp = special(SPECIAL, t), rec = store.daily[t]?.r, st = streak();
  $('#daily-meta').textContent = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + (st ? `  ·  🔥 ${st}` : '');
  $('#btn-daily').classList.toggle('done', !!rec);
  $('#btn-daily small').textContent = rec ? `✓ ${rec.s} points · see result` : store.cur?.key === 'D' + t ? 'Resume' : sp ? sp.occasion : '24 words · 60 seconds';
  $('#btn-unlimited small').textContent = `Round ${store.n + 1}` + (store.best ? ` · best ${store.best}` : '') +
    (store.cur?.key === 'U' + store.n ? ' · resume' : '');
}

function play(key) {
  const date = key[0] === 'D' ? key.slice(1) : null, n = date ? null : +key.slice(1);
  if (date && store.daily[date]?.r) return showEnd(store.daily[date].r, true);
  R = store.cur?.key === key ? store.cur
    : { key, date, n, ...deal(date ? dailyLine(date) : ROUNDS[unlimitedIndex(n)], hash(key)), marks: [], left: TIME, over: false };
  $('#g-title').textContent = date ? 'Daily' : `Round ${n + 1}`;
  const sp = date && special(SPECIAL, date);
  $('#g-sub').textContent = date ? new Date(date + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + (sp ? ' · ' + sp.occasion : '') : '';
  $('#subject').textContent = R.subject;
  screen('game');
  $('#stack').replaceChildren();
  refill();
  hud();
  last = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

// The fuse burns only while the round is on screen and no dialog covers it.
function frame(now) {
  const dt = now - last;
  last = now;
  if (!R || R.over) return;
  if (!document.hidden && !$('#game').hidden && !document.querySelector('dialog[open]')) {
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
  $('#progress').textContent = `${Math.min(R.marks.length + 1, 24)} / 24`;
  $('#score').textContent = `${R.marks.filter(Boolean).length * PER_RIGHT} pts`;
}

// ---------- cards ----------
// The stack shows the current card and two behind it.
function refill() {
  const st = $('#stack');
  for (let i = R.marks.length + st.querySelectorAll('.card:not(.gone)').length; i < Math.min(R.marks.length + 3, R.cards.length); i++) {
    const c = document.createElement('div');
    c.className = 'card';
    c.textContent = R.cards[i].w;
    c.style.setProperty('--len', R.cards[i].w.length);
    st.prepend(c);
  }
  st.querySelectorAll('.card:not(.gone)').forEach((c, i, all) => c.style.setProperty('--depth', all.length - 1 - i));
  const top = topCard();
  if (top) { top.setAttribute('role', 'img'); top.setAttribute('aria-label', `${top.textContent}: does it fit ${R.subject}?`); }
}
const topCard = () => [...$('#stack').querySelectorAll('.card:not(.gone)')].pop();

function answer(saidYes) {
  if (!R || R.over || $('#game').hidden) return;
  const card = R.cards[R.marks.length], el = topCard(), right = card.yes === saidYes;
  R.marks.push(right);
  el.classList.add('gone', right ? 'right' : 'wrong');
  el.style.setProperty('--dir', saidYes ? 1 : -1);
  el.addEventListener('animationend', () => el.remove(), { once: true });
  setTimeout(() => el.remove(), 600); // reduced motion: no animationend
  if (right) sfx.good(R.marks.filter(Boolean).length % 8);
  else {
    sfx.bad();
    R.left = Math.max(0, R.left - PENALTY);
    flash($('#clock'), 'shake');
    penalty();
  }
  hud();
  if (R.marks.length === R.cards.length || R.left <= 0) return finish();
  refill();
  save();
}

function penalty() {
  const p = document.createElement('span');
  p.className = 'minus';
  p.textContent = `−${PENALTY / 1000}s`;
  $('.bar-end').append(p);
  setTimeout(() => p.remove(), 900);
}

// Drag the top card; past a third of the card width (or a quick flick) it counts.
function drag(e) {
  const el = e.target.closest('.card');
  if (!el || el !== topCard() || R.over) return;
  const x0 = e.clientX, t0 = performance.now();
  let dx = 0;
  el.setPointerCapture(e.pointerId);
  el.classList.add('held');
  const move = (ev) => {
    dx = ev.clientX - x0;
    el.style.setProperty('--dx', dx + 'px');
    el.style.setProperty('--lean', Math.max(-1, Math.min(1, dx / 120)));
  };
  const up = () => {
    el.removeEventListener('pointermove', move);
    el.classList.remove('held');
    const fast = Math.abs(dx) / (performance.now() - t0) > 0.6 && Math.abs(dx) > 30;
    if (Math.abs(dx) > el.offsetWidth / 3 || fast) answer(dx > 0);
    else { el.style.setProperty('--dx', '0px'); el.style.setProperty('--lean', 0); }
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up, { once: true });
  el.addEventListener('pointercancel', up, { once: true });
}

// ---------- end ----------
function finish() {
  R.over = true;
  cancelAnimationFrame(raf);
  delete store.cur;
  const rec = { s: score(R), m: R.marks.map(Number).join(''), t: R.marks.length === 24 ? Math.ceil(R.left / 1000) : 0, subject: R.subject,
    misses: R.cards.map((c, i) => (R.marks[i] === false ? (c.yes ? '+' : '-') + c.w : null)).filter(Boolean) };
  if (R.date) (store.daily[R.date] ??= {}).r = rec;
  else { store.n = R.n + 1; store.best = Math.max(store.best, rec.s); }
  persist();
  if (rec.t) { sfx.win(); confetti(); }
  setTimeout(() => showEnd(rec, !!R.date), rec.t ? 700 : 300);
}

function showEnd(rec, daily) {
  const right = [...rec.m].filter((c) => c === '1').length, done = rec.m.length === 24;
  $('#end-title').textContent = !done ? "Time's up!" : right === 24 ? 'Flawless!' : right >= 20 ? 'Sharp!' : 'Done!';
  $('#end-score').innerHTML = `${rec.s}<small>points</small>`;
  $('#end-stats').innerHTML = `<b>${right}/24</b> right · ` + (done ? `<b>${rec.t}s</b> left (+${rec.t * PER_SEC})` : `${24 - rec.m.length} unanswered`);
  $('#end-misses').innerHTML = rec.misses.length
    ? `<p class="muted small">${esc(rec.subject)} — you missed:</p>` +
      rec.misses.map((w) => `<span class="${w[0] === '+' ? 'yes' : 'no'}">${w[0] === '+' ? '✓' : '✗'} ${esc(w.slice(1))}</span>`).join('')
    : '';
  $('#end-next b').textContent = daily ? 'Share result' : `Round ${store.n + 1}  →`;
  $('#end-next').onclick = daily ? () => shareDaily(rec) : () => { $('#dlg-end').close(); play('U' + store.n); };
  $('#dlg-end').showModal();
}
const esc = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

async function shareDaily(rec) {
  const date = today(), grid = [...rec.m.padEnd(24, '.')].map((c) => (c === '1' ? '🟩' : c === '0' ? '🟥' : '⬜'));
  const sp = special(SPECIAL, date), text = `WordSwipe daily · ${date}${sp ? ' · ' + sp.occasion : ''}\n${[0, 6, 12, 18].map((i) => grid.slice(i, i + 6).join('')).join('\n')}\n` +
    `${rec.s} points${rec.t ? ` · ${rec.t}s left` : ' · ⏰ out of time'}` +
    (location.protocol.startsWith('http') ? '\n' + location.origin + location.pathname : '');
  try {
    if (navigator.share) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); $('#end-next b').textContent = 'Copied ✓'; }
  } catch {}
}

// ---------- wiring ----------
game = { name: 'WordSwipe', storeKey: 'wordswipe', glyphs: ['✓', '✗'] };
try { store = JSON.parse(localStorage.getItem(game.storeKey)) || {}; } catch { store = {}; }
store = { daily: {}, n: 0, best: 0, muted: false, seenHelp: false, ...store };

$('#btn-daily').onclick = () => play('D' + today());
$('#btn-unlimited').onclick = () => play('U' + store.n);
$('#btn-help').onclick = () => $('#dlg-help').showModal();
$('#btn-back').onclick = () => { save(); cancelAnimationFrame(raf); R = null; screen('home'); };
$('#btn-yes').onclick = () => answer(true);
$('#btn-no').onclick = () => answer(false);
$('#stack').addEventListener('pointerdown', drag);
// Giving up runs the clock out: the round ends as if time were up.
$('#btn-giveup').onclick = () => { if (R && !R.over && confirm('Give up? The round ends now, scored as it stands.')) { R.left = 0; hud(); finish(); } };
$('#end-home').onclick = () => { $('#dlg-end').close(); screen('home'); };
$('#dlg-help').addEventListener('close', () => { store.seenHelp = true; persist(); });
for (const b of document.querySelectorAll('.js-sound')) b.onclick = () => { store.muted = !store.muted; persist(); syncSound(); sfx.tap(); };
document.addEventListener('visibilitychange', () => document.hidden && save());
document.addEventListener('keydown', (e) => {
  if (!R || $('#game').hidden || document.querySelector('dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'ArrowRight') answer(true);
  else if (e.key === 'ArrowLeft') answer(false);
  else if (e.key === 'Escape') $('#btn-back').click();
  else return;
  e.preventDefault();
});

syncSound();
screen('home');
if (!store.seenHelp) $('#dlg-help').showModal();
