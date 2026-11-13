'use strict';
// Biggr: two sums, no answers. Pick the bigger one, 10 pairs against the clock.
// Borrows storage, sound, confetti, openLevels and helpers from shared/core.js (but not boot()).
// Pairs come from gen.js, seeded by the level key: 'E12' for Easy level 12, 'DE2026-11-11' for that day's Easy daily.
const PENALTY = 3000, PER_RIGHT = 10, PER_SEC = 5, REVEAL = 650;
const stars = (wrong) => (wrong === 0 ? 3 : wrong <= 2 ? 2 : 1);
// The time bonus scales with how many were right, so mashing fast doesn't beat thinking.
const bonus = (secs, right) => Math.round((secs * PER_SEC * right) / PAIRS);
const score = (r) => { const right = r.marks.filter(Boolean).length; return right * PER_RIGHT + (r.marks.length === PAIRS ? bonus(Math.ceil(r.left / 1000), right) : 0); };

// ---------- state ----------
// R = the round on screen: { key, pack, n?, date?, pairs, marks: [right?], left: ms, hold (revealing), over }
let R = null, raf = 0, last = 0;
const today = () => ymd(new Date());
const save = () => { if (R && !R.over) store.saves[R.key] = { marks: R.marks, left: R.left }; persist(); };

function screen(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  if (id === 'home') { home(); toMenu(); }
}

function home() {
  const t = today(), recs = store.daily[t] || {}, st = streak();
  $('#daily-meta').innerHTML = todayLine(st);
  $('#daily-btns').replaceChildren(...Object.keys(TIERS).map((k, i) => {
    const b = document.createElement('button'), r = recs[k];
    b.className = `daily-btn tier-${k}${r ? ' done' : ''}`;
    b.style.setProperty('--i', i);
    b.innerHTML = `<b>${tierName(k)}</b><small>${r ? '✓ ' + T('{n} pts', { n: r.s }) : store.saves['D' + k + t] ? T('Resume') : T('{n}s', { n: TIME[k] })}</small>`;
    b.onclick = () => start(k, null, t);
    return b;
  }));
  $('#pack-btns').replaceChildren(...Object.keys(TIERS).map((k) => {
    const pp = store.packs[k], done = Object.keys(pp.stars).length, b = document.createElement('button');
    b.className = `pack-btn tier-${k}`;
    b.innerHTML = `<span class="pack-name">${tierName(k)}</span><span class="pack-bar"><i style="width:${(done / PACK_SIZE) * 100}%"></i></span><span class="pack-count">${done}/${PACK_SIZE}</span>`;
    const next = firstUnsolved(pp);
    b.onclick = () => (next ? start(k, next) : openLevels(k));
    return b;
  }));
}

// Same name and signature as core.js's start(), which this replaces, so core's openLevels() lands here.
function start(pack, n, date = null) {
  const key = date ? 'D' + pack + date : pack + n;
  // A finished daily shows its result over the menu.
  if (date && store.daily[date]?.[pack]) { toMenu(false); screen('home'); return showEnd(store.daily[date][pack], { pack, date }); }
  const sv = store.saves[key];
  R = { key, pack, n, date, pairs: generate(hash(key), pack), marks: sv?.marks || [], left: sv?.left ?? TIME[pack] * 1000, hold: false, over: false };
  $('#g-title').textContent = date ? T('Daily · {tier}', { tier: tierName(pack) }) : `${tierName(pack)} · ${n}`;
  $('#g-sub').textContent = date ? shortDate(date) : '';
  $('#game').className = `screen tier-${pack}`;
  $('#btn-result').hidden = true;
  screen('game');
  toGame(levelHash(pack, n));
  track('start', mode(date, TIERS[pack]));
  if (R.marks.length === PAIRS || R.left <= 0) return finish(); // left mid-reveal of the last answer
  deal();
  hud();
  last = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

// The clock runs only while the round is on screen, no dialog covers it, and no answer is being revealed.
function frame(now) {
  const dt = now - last;
  last = now;
  if (!R || R.over) return;
  if (!R.hold && !document.hidden && !$('#game').hidden && !document.querySelector('dialog[open]')) {
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
  $('#fuse').style.width = (R.left / (TIME[R.pack] * 1000)) * 100 + '%';
  $('#game').classList.toggle('hurry', secs <= 5);
  $('#progress').textContent = T('{n} / {total}', { n: Math.min(R.marks.length + 1, PAIRS), total: PAIRS });
  $('#score').textContent = T('{n} pts', { n: R.marks.filter(Boolean).length * PER_RIGHT });
}

// ---------- pairs ----------
const sides = () => [$('#side-l'), $('#side-r')];
function deal() {
  const p = R.pairs[R.marks.length];
  sides().forEach((el, i) => {
    const text = p[i * 2];
    el.className = 'side';
    el.querySelector('.expr').textContent = text;
    el.querySelector('.val').textContent = '';
    el.style.setProperty('--len', text.length);
    el.setAttribute('aria-label', T(i ? '{sum} (right arrow)' : '{sum} (left arrow)', { sum: text }));
    flash(el, 'pop');
  });
}

// side: 0 = left, 1 = right
function answer(side) {
  if (!R || R.over || R.hold || $('#game').hidden) return;
  const [lt, lv, rt, rv] = R.pairs[R.marks.length], right = (lv > rv) === (side === 0);
  R.marks.push(right);
  R.hold = true;
  sides().forEach((el, i) => {
    el.querySelector('.val').textContent = '= ' + (i ? rv : lv);
    el.classList.add((i ? rv > lv : lv > rv) ? 'big' : 'small');
    if (i === side) el.classList.add('picked', right ? 'right' : 'wrong');
  });
  if (right) sfx.good(R.marks.filter(Boolean).length % 8);
  else {
    sfx.bad();
    R.left = Math.max(0, R.left - PENALTY);
    flash($('#clock'), 'shake');
    const m = document.createElement('span');
    m.className = 'minus';
    m.textContent = T('−{n}s', { n: PENALTY / 1000 });
    $('.bar-end').append(m);
    setTimeout(() => m.remove(), 900);
  }
  hud();
  save();
  const r = R;
  setTimeout(() => {
    if (R !== r || r.over) return;
    r.hold = false;
    last = performance.now();
    if (r.marks.length === PAIRS || r.left <= 0) return finish();
    deal();
    hud();
  }, REVEAL);
}

// ---------- end ----------
function finish() {
  const st = streak();
  R.over = true;
  cancelAnimationFrame(raf);
  delete store.saves[R.key];
  const full = R.marks.length === PAIRS, wrong = R.marks.filter((m) => !m).length;
  const rec = { s: score(R), m: R.marks.map(Number).join(''), t: full ? Math.ceil(R.left / 1000) : 0 };
  if (R.date) (store.daily[R.date] ??= {})[R.pack] = rec;
  else if (full) {
    const pp = store.packs[R.pack];
    pp.stars[R.n] = Math.max(pp.stars[R.n] || 0, stars(wrong));
    pp.unlocked = Math.max(pp.unlocked, Math.min(R.n + 1, PACK_SIZE));
  }
  persist();
  bump(st);
  $('#game').classList.add('done');
  if (full) { sfx.win(); confetti(); }
  track(full ? 'finish' : 'timeout', mode(R.date, TIERS[R.pack]));
  const r = R;
  setTimeout(() => showEnd(rec, r), full ? 700 : 300);
}

function showEnd(rec, { pack, n, date }) {
  const right = [...rec.m].filter((c) => c === '1').length, full = rec.m.length === PAIRS;
  if (date || !full) { $('#end-stars').innerHTML = ''; $('#end-stars').removeAttribute('aria-label'); }
  else starRow($('#end-stars'), stars(PAIRS - right));
  $('#end-title').textContent = T(!full ? "Time's up!" : right === PAIRS ? 'Flawless!' : right >= 8 ? 'Sharp!' : 'Done!');
  $('#end-score').innerHTML = `${rec.s}<small>${T('points')}</small>`;
  $('#end-stats').innerHTML = T('<b>{n}/{total}</b> right', { n: right, total: PAIRS }) + ' · ' +
    (full ? T('<b>{n}s</b> left (+{bonus})', { n: rec.t, bonus: bonus(rec.t, right) }) : T('{n} unanswered', { n: PAIRS - rec.m.length }));
  const next = $('#end-next');
  next.hidden = !date && full && n === PACK_SIZE;
  if (date) { next.querySelector('b').textContent = T('Share result'); next.onclick = () => share(rec, pack, date); }
  else if (!full) { next.querySelector('b').textContent = T('Try again'); next.onclick = () => { $('#dlg-end').close(); start(pack, n); }; }
  else { next.querySelector('b').textContent = T('Level {n}  →', { n: n + 1 }); next.onclick = () => { $('#dlg-end').close(); start(pack, n + 1); }; }
  $('#btn-result').hidden = false;
  $('#dlg-end').showModal();
}

async function share(rec, pack, date) {
  track('share', mode(date, TIERS[pack]));
  const text = `${T('{game} daily', { game: game.name })} · ${date} · ${tierName(pack)}\n${[...rec.m.padEnd(PAIRS, '.')].map((c) => (c === '1' ? '🟩' : c === '0' ? '🟥' : '⬜')).join('')}\n` +
    T('{n} points', { n: rec.s }) + ' · ' + (rec.t ? T('{n}s left', { n: rec.t }) : '⏰ ' + T('out of time')) + (location.protocol.startsWith('http') ? '\n' + location.origin + location.pathname + '#' + levelHash(pack) : '');
  try {
    if (navigator.share) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); copied($('#end-next b')); }
  } catch {}
}

// ---------- wiring ----------
game = { name: T('Biggr'), storeKey: 'biggr', glyphs: ['>', '<', '+', '×'] };
try { store = JSON.parse(localStorage.getItem(game.storeKey)) || {}; } catch { store = {}; }
store = { packs: {}, daily: {}, saves: {}, muted: false, seenHelp: false, ...store };
for (const k in TIERS) store.packs[k] ??= { unlocked: 1, stars: {} };

$('#btn-levels').onclick = () => openLevels();
$('#btn-help').onclick = () => { track('help', ''); $('#dlg-help').showModal(); };
const goHome = () => { save(); cancelAnimationFrame(raf); R = null; screen('home'); };
$('#btn-back').onclick = goHome;
sides().forEach((el, i) => (el.onclick = () => answer(i)));
// Giving up runs the clock out: the round ends as if time were up.
$('#btn-giveup').onclick = () => { if (R && !R.over && confirm(T('Give up? The round ends now, scored as it stands.'))) { R.left = 0; hud(); finish(); } };
$('#btn-result').onclick = () => $('#dlg-end').showModal();
$('#end-home').onclick = () => { $('#dlg-end').close(); R = null; screen('home'); };
$('#dlg-help').addEventListener('close', () => { store.seenHelp = true; persist(); });
for (const b of document.querySelectorAll('.js-sound')) b.onclick = () => { store.muted = !store.muted; persist(); syncSound(true); sfx.tap(); };
document.addEventListener('visibilitychange', () => document.hidden && save());
document.addEventListener('keydown', (e) => {
  if (!R || $('#game').hidden || document.querySelector('dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'ArrowLeft') answer(0);
  else if (e.key === 'ArrowRight') answer(1);
  else if (e.key === 'Escape') $('#btn-back').click();
  else return;
  e.preventDefault();
});

// Paper version: the 10 pairs as lines with a gap for < or >. No clock on paper.
printable(() => R && {
  rules: [
    T('Each line has <b>two sums</b>. Work them out in your head, no answers given.'),
    T('Write <b>&lt;</b> or <b>&gt;</b> in the gap so the line is true: the open side faces the <b>bigger</b> sum.'),
  ],
  body: `<ol class="p-pairs">${R.pairs.map(([lt, , rt]) => `<li><span>${esc(lt)}</span><i></i><span>${esc(rt)}</span></li>`).join('')}</ol>`,
});
syncSound();
router((h) => openLevel(h, start), goHome);
if (!store.seenHelp) $('#dlg-help').showModal();
