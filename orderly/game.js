'use strict';
// Orderly: a subject and 10 cards; drag them into order. Check joins runs of cards already in the right order into groups that move as one.
// Borrows storage, sound, confetti and helpers from shared/core.js (but not its level-pack shell: no boot()).
// Levels come from levels.js: LEVELS[i] = "difficulty|topic|Subject|top label|bottom label|Name=Value;..." in the right order.
const HINTS = 3, DIFF = ['', 'Easy', 'Medium', 'Hard'];
let N = 10; // cards in play: the tutorial has 4
const TOPICS = { history: 'History', science: 'Science', nature: 'Nature', places: 'Places', screen: 'Film & TV', music: 'Music', words: 'Books & Art', sport: 'Sport & Games', food: 'Food & Drink', tech: 'Tech & Inventions' };
// play.html (a shared custom level, or the editor's Test it) has no #home: it only plays, and never writes progress (custom.js).
const SOLO = !document.getElementById('home');
const pmode = () => (P.lv.custom ? 'custom' : mode(P.date, DIFF[P.lv.d])); // the analytics label of the puzzle on screen
const stars = (checks) => (IMP ? Math.max(1, 4 - checks) : checks <= 2 ? 3 : checks <= 4 ? 2 : 1);
// Impossible Mode's daily: a Hard level (its own walk through them, no special days), and only BUDGET checks; miss with the last and it's lost
const BUDGET = 3;
const impIndex = (date) => { const p = pool(3), day = Math.round((Date.parse(date) - DAY0) / 864e5); return p[(((day * 5 + 11) % p.length) + p.length) % p.length]; };

// The daily's difficulty climbs through the (UTC) week: Easy Mon–Tue, Medium Wed–Fri, Hard Sat–Sun (Hebrew: the Israeli week, Sun–Sat).
// Each difficulty's days walk a fixed shuffle of that difficulty's levels, so no repeats until its pool has all been used.
const DAY0 = Date.UTC(2025, 11, LANG === 'he' ? 28 : 29); // the first day of a week: Sunday or Monday
const WEEK = [1, 1, 2, 2, 2, 3, 3]; // from the week's first day
const POOLS = {};
function pool(d) {
  if (POOLS[d]) return POOLS[d];
  const p = LEVELS.flatMap((l, i) => (+l[0] === d ? [i] : [])), rand = rng(d);
  for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  return (POOLS[d] = p);
}
function dailyIndex(date) {
  const day = Math.round((Date.parse(date) - DAY0) / 864e5), k = ((day % 7) + 7) % 7, d = WEEK[k], p = pool(d);
  const n = Math.floor(day / 7) * WEEK.filter((x) => x === d).length + WEEK.slice(0, k).filter((x) => x === d).length;
  return p[((n % p.length) + p.length) % p.length];
}
// On a special day (special.js) its themed level replaces the pool's.
const dailyLine = (date) => (IMP ? LEVELS[impIndex(date)] : special(SPECIAL, date)?.line ?? LEVELS[dailyIndex(date)]);

// The tutorial: 5 inventions (card i belongs at i), dealt so the lesson goes in a fixed order: drag the light bulb under the telephone,
// check (they group), drag that group under the printing press, drag the smartphone to the bottom, check again. P.tut: nothing is
// saved or recorded. Every move asks coachAllows() (core.js) first: a drag is { unit } on pickup and { unit, order } on the drop
// (keyboard moves only { unit }), Check { check }, Hint { hint }; each step lets through only its own move.
const TUTORIAL = () => ({ d: 1, subject: T('Inventions'), top: T('Oldest'), bottom: T('Newest'),
  items: [[T('Printing press'), 1440], [T('Telephone'), 1876], [T('Light bulb'), 1879], [T('Airplane'), 1903], [T('Smartphone'), 2007]].map(([name, val]) => ({ name, val })) });
const TUT_DEAL = [1, 4, 2, 0, 3];
const under = (o, a, b) => o.indexOf(b) === o.indexOf(a) + 1; // card b sits right under card a
const cardOf = (i) => cardEls()[i];
// drag card (or its group) `c` until ok(order): ring it, then (while it's held) the card it goes next to
const tutDrag = (c, next, ok) => [() => ok(P.order), () => ($('.card.held') ? cardOf(next) : cardOf(c)), (m) => m.unit?.[0] === c && (!m.order || ok(m.order))];
const TUT_STEPS = [
  [T('Put the cards in order: <b>oldest</b> at the top, <b>newest</b> at the bottom. The <b>light bulb</b> came just after the <b>telephone</b>: drag it up to sit right under it.'),
    ...tutDrag(2, 1, (o) => under(o, 1, 2))],
  [T('Press <b>Check</b>: cards that sit right next to each other turn green and show their value. Every check counts: solve a puzzle in <b>2 checks</b> for three stars, <b>4</b> for two.'),
    () => P.rows.length, '#btn-check', (m) => m.check],
  [T('The telephone and the light bulb are joined into a <b>group</b> now, and it moves as one. Both came after the <b>printing press</b>: drag the group to sit right under it.'),
    ...tutDrag(1, 0, (o) => under(o, 0, 1))],
  [T('The <b>smartphone</b> is the newest of them all: drag it to the bottom.'), ...tutDrag(4, 3, (o) => o.at(-1) === 4)],
  [T('All in order. <b>Check</b> again to finish.'), null, '#btn-check', (m) => m.check],
];

function parse(line) {
  const [d, topic, subject, top, bottom, items] = line.split('|');
  return { d: +d, topic, subject, top, bottom, items: items.split(';').map((s) => { const [name, val] = s.split('='); return { name, val }; }) };
}

// order[pos] = index of the card at pos; card i belongs at pos i. Deal so at most one card starts in place.
function deal(seed) {
  const rand = rng(seed), o = [...Array(N).keys()];
  do {
    for (let i = N - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  } while (o.filter((v, i) => v === i).length > 1);
  return o;
}

// ---------- state ----------
// P = the puzzle on screen: { key, date?, n?, lv, order, links, rows: ['0110…' per check, 1 = grouped], moved, hints, done }
// links[c] = a check found card c directly above card c + 1. Linked cards always move together, so links never break.
let P = null;
const today = () => ymd(new Date());
// A random unsolved puzzle (any puzzle once all are solved), never today's daily, of difficulty d if given (and then only from the topics not in store.off). store.cur is the one in play, resumed until solved or given up.
function playRandom(fresh, d) {
  if (fresh || !store.saves['L' + store.cur]) {
    delete store.saves['L' + store.cur];
    const skip = dailyIndex(today()) + 1, all = LEVELS.map((_, i) => i + 1).filter((n) => { const L = parse(LEVELS[n - 1]); return n !== skip && (!d || (L.d === d && !store.off.includes(L.topic))); }), open = all.filter((n) => !store.stars[n]);
    store.cur = pick(Math.random, open.length ? open : all);
  }
  play('L' + store.cur);
}
// Share links: #daily, or a 3-char code per level. n * 9973 mod 36^3 is a bijection (9973 is coprime with 36^3), so codes don't follow level order.
const code = (n) => ((n * 9973) % 46656).toString(36).padStart(3, '0');
const fromCode = (c) => LEVELS.findIndex((_, i) => code(i + 1) === c) + 1; // 0 = no such level
// Open whatever the URL names (#daily or a level code); anything else is home.
function route(h) {
  const n = fromCode(h);
  if (h === 'daily') play('D' + today());
  else if (h === 'tutorial') play('T');
  else if (n) { if (store.cur !== n) { store.cur = n; persist(); } play('L' + n); }
  else return false;
  return true;
}
const save = () => { if (SOLO || P?.tut) return; if (P && !P.done) store.saves[P.key] = { order: P.order, links: P.links, rows: P.rows, moved: P.moved, hints: P.hints }; persist(); };
// The order split into units: runs of linked cards (groups) and lone cards, top to bottom.
const units = () => P.order.reduce((u, c, p) => (p && P.links[c - 1] && P.order[p - 1] === c - 1 ? u.at(-1).push(c) : u.push([c]), u), []);

function screen(id) {
  if (id !== 'game') coach(null);
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  if (id === 'home') { home(); toMenu(); }
}

function home() {
  const t = today(), sp = !IMP && special(SPECIAL, t), rec = store.daily[t]?.r, st = streak(), solved = Object.keys(store.stars).length;
  $('#daily-meta').innerHTML = todayLine(st);
  $('#btn-daily').classList.toggle('done', !!rec);
  rollIn($('#btn-daily'), 'r');
  $('#btn-daily small').textContent = rec ? `${rec.lost ? '💀' : '✓ ' + checksText(rec.c)} · ${T('see result')}` : store.saves['D' + t] ? T('Resume') : sp ? sp.occasion : parse(LEVELS[dailyIndex(t)]).subject;
  $('#lv-meta').textContent = T('{n} / {total} solved', { n: solved, total: LEVELS.length });
  // A random puzzle in progress: the main button resumes it. The difficulty row always deals a new one.
  const cur = store.saves['L' + store.cur];
  $('#btn-random b').textContent = T(cur ? 'Resume puzzle' : 'Random puzzle');
  $('#btn-random small').textContent = cur ? parse(LEVELS[store.cur - 1]).subject : T('From the whole collection');
}
const checksText = (c) => (c === 1 ? T('1 check') : T('{n} checks', { n: c }));

// play(key) plays a daily (D2026-01-01) or level (L12); play('C…', lv) plays a custom level.
function play(key, custom) {
  const tut = key === 'T';
  if (tut) custom = TUTORIAL();
  N = custom ? custom.items.length : 10;
  const date = key[0] === 'D' ? key.slice(1) : null, n = date || custom ? null : +key.slice(1);
  const lv = custom || parse(date ? dailyLine(date) : LEVELS[n - 1]), sp = date && !IMP && special(SPECIAL, date), rec = date && store.daily[date]?.r, sv = store.saves[key];
  P = rec ? { key, date, lv, order: [...Array(N).keys()], links: Array(N).fill(true), rows: rec.rows, hints: rec.h || 0, lost: rec.lost, done: true }
    : { key, date, n, lv, tut, order: tut ? [...TUT_DEAL] : sv?.order || deal(hash(key)), links: sv?.links || Array(N).fill(false), rows: sv?.rows || [], moved: tut ? false : sv?.moved ?? true, hints: sv?.hints || 0, done: false };
  if (!custom || tut) toGame(tut ? 'tutorial' : date ? 'daily' : code(n));
  track(tut ? 'tutorial' : 'start', pmode());
  $('#g-title').textContent = tut ? T('Tutorial') : T(date ? 'Daily' : custom ? 'Custom level' : 'Random');
  $('#g-sub').textContent = (date ? shortDate(date) + ' · ' : '') + (sp ? sp.occasion : custom ? '' : IMP ? T('Impossible') : T(DIFF[lv.d]));
  $('#list').style.setProperty('--k', N);
  $('#subject').textContent = lv.subject;
  $('#lbl-top').textContent = '▲ ' + lv.top;
  $('#lbl-bottom').textContent = '▼ ' + lv.bottom;
  $('#list').replaceChildren(...lv.items.map((it, i) => {
    const li = document.createElement('li');
    li.className = 'card';
    li.tabIndex = 0;
    li.dataset.i = i;
    li.innerHTML = '<svg class="grip" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h14M5 15h14"/></svg><span class="name"></span><span class="val"></span>';
    li.querySelector('.name').textContent = it.name;
    li.querySelector('.val').textContent = it.val;
    return li;
  }));
  $('#game').classList.toggle('custom', !!lv.custom); // a custom level's cards have no notes: no tip, no tap (style.css)
  screen('game');
  coach(tut && TUT_STEPS, { onEnd: () => { P = null; screen('home'); } });
  layout();
  if (P.done) showResult(false);
  else {
    $('#play').hidden = false; $('#result').hidden = true; status();
    if (!tut) impossibleIntro([T('Today\'s puzzle is a <b>Hard</b> one, and you get only <b>3 checks</b>.'),
      T('Checks still join the cards that sit right into groups.'),
      T('If the third check isn\'t all right, the puzzle <b>burns</b>: the order is shown and today\'s Impossible is lost.'),
      T('Right on the first check: three pentagrams. Second: two. Third: one.')], () => {});
  }
}

// Cards sit at --pos; the CSS turns that into a translateY, so moving one is just changing a number.
function layout(dom = true) {
  const cards = cardEls();
  let pos = 0;
  for (const u of units()) for (const [k, i] of u.entries()) {
    const el = cards[i], ok = u.length > 1;
    el.style.setProperty('--pos', pos++);
    el.classList.toggle('ok', ok);
    el.classList.toggle('link', k < u.length - 1);
    el.classList.toggle('linked', k > 0);
    el.setAttribute('aria-label', T(ok ? '{name}, {pos} of {n}, grouped: {val}' : '{name}, {pos} of {n}', { name: P.lv.items[i].name, pos, n: N, val: P.lv.items[i].val }));
    el.tabIndex = 0; // done: still focusable, Enter opens its note
  }
  // DOM order = visual order, so Tab walks top to bottom. Not mid-drag: re-inserting the held card drops its pointer capture.
  if (dom) $('#list').append(...P.order.map((i) => cards[i]));
}
const cardEls = () => [...$('#list').children].sort((a, b) => a.dataset.i - b.dataset.i);

function status() {
  const r = P.rows.at(-1), grouped = r ? [...r].filter((c) => c === '1').length : 0;
  $('#status').textContent = !r ? T('Drag the cards into order, then check.') : T('{n} of {total} grouped · {checks} so far', { n: grouped, total: N, checks: checksText(P.rows.length) });
  $('#btn-check').disabled = !P.moved;
  if (IMP) $('#btn-check b').textContent = T('Check') + ' ' + '●'.repeat(BUDGET - P.rows.length) + '○'.repeat(P.rows.length);
  $('#btn-hint b').textContent = T('Hint ({n} left)', { n: HINTS - P.hints });
  $('#btn-hint').disabled = P.hints >= HINTS || P.links.slice(0, N - 1).every(Boolean);
}

// Rebuild the order with `unit` inserted at index j among the other units.
const place = (rest, unit, j) => { P.order = [...rest.slice(0, j), unit, ...rest.slice(j)].flat(); P.moved = true; };

// Grabbing any card picks up its whole unit; it slides to wherever its top card lands nearest the pointer.
function drag(e) {
  const el = e.target.closest('.card');
  if (!el || P.done || e.button) return;
  e.preventDefault();
  const all = units(), unit = all.find((u) => u.includes(+el.dataset.i)), rest = all.filter((u) => u !== unit);
  if (!coachAllows({ unit })) return;
  const before = [...P.order], wasMoved = P.moved;
  const cards = cardEls(), els = unit.map((c) => cards[c]), start = P.order.indexOf(unit[0]), y0 = e.clientY, sc = pageScale();
  const pitch = el.offsetHeight + parseFloat(getComputedStyle($('#list')).rowGap || 0);
  // tops[j] = where the unit's top card sits if inserted at index j
  const tops = rest.reduce((t, u) => [...t, t.at(-1) + u.length], [0]);
  el.setPointerCapture(e.pointerId);
  els.forEach((c) => c.classList.add('held'));
  if (P.tut) coachRing(coached.steps[coached.at][2]); // now the card it goes next to
  const moveTo = (ev) => {
    const dy = (ev.clientY - y0) / sc, want = start + dy / pitch;
    const j = tops.reduce((b, t, k) => (Math.abs(t - want) < Math.abs(tops[b] - want) ? k : b), 0);
    if (tops[j] !== P.order.indexOf(unit[0])) { place(rest, unit, j); layout(false); sfx.tap(); }
    els.forEach((c) => c.style.setProperty('--dy', dy - (tops[j] - start) * pitch + 'px'));
  };
  const up = () => {
    el.removeEventListener('pointermove', moveTo);
    els.forEach((c) => { c.classList.remove('held'); c.style.setProperty('--dy', '0px'); });
    if (P.order.indexOf(unit[0]) !== start && !coachAllows({ unit, order: P.order })) { P.order = before; P.moved = wasMoved; }
    layout();
    if (P.order.indexOf(unit[0]) !== start) { sfx.place(); status(); save(); }
  };
  el.addEventListener('pointermove', moveTo);
  el.addEventListener('pointerup', up, { once: true });
  el.addEventListener('pointercancel', up, { once: true });
}

function check() {
  if (!P || P.done || !P.moved || !coachAllows({ check: true })) return;
  const was = new Set(units().filter((u) => u.length > 1).flat());
  P.order.forEach((c, p) => { if (P.order[p + 1] === c + 1) P.links[c] = true; });
  const row = P.order.map((c, p) => (P.order[p + 1] === c + 1 || P.order[p - 1] === c - 1 ? '1' : '0')).join('');
  P.rows.push(row);
  P.moved = false;
  layout();
  if (P.order.every((c, p) => c === p)) return win();
  if (IMP && P.date && P.rows.length >= BUDGET) return lose();
  const fresh = units().filter((u) => u.length > 1).flat().filter((c) => !was.has(c));
  if (fresh.length) sfx.good([...row].filter((c) => c === '1').length);
  else { sfx.bad(); flash($('#list'), 'shake'); }
  const cards = cardEls();
  fresh.forEach((c) => flash(cards[c], 'pop'));
  status();
  save();
}

// Hint: pick two cards that belong next to each other but aren't joined, slide the lower one's unit up under the upper one's, and join them.
// Prefers a pair that isn't already adjacent, so a hint is never wasted on a pair the player got right.
function hint() {
  if (!P || P.done || P.hints >= HINTS || !coachAllows({ hint: true })) return;
  const open = [...Array(N - 1).keys()].filter((c) => !P.links[c]), apart = open.filter((c) => P.order[P.order.indexOf(c) + 1] !== c + 1);
  if (!open.length) return;
  const c = pick(Math.random, apart.length ? apart : open), all = units(), lower = all.find((u) => u[0] === c + 1), rest = all.filter((u) => u !== lower);
  place(rest, lower, rest.findIndex((u) => u.at(-1) === c) + 1);
  P.links[c] = true;
  P.hints++;
  $('#list').classList.add('hinting');
  layout(false); // keep DOM order until the slide ends: re-inserting a card mid-transition kills its animation
  setTimeout(() => { $('#list').classList.remove('hinting'); if (P && !P.done && !$('.card.held')) layout(); }, 600);
  const cards = cardEls();
  flash(cards[c], 'pop'); flash(cards[c + 1], 'pop');
  sfx.hint();
  track('hint', pmode());
  status();
  save();
}

function win() {
  const st = streak(), sp = P.date && special(SPECIAL, P.date);
  P.done = true;
  if (P.tut) { layout(); sfx.win(); confetti(); $('#play').hidden = true; return coachEnd(); }
  if (!SOLO) {
    delete store.saves[P.key];
    const rec = { c: P.rows.length, rows: P.rows, h: P.hints };
    if (P.date) (store.daily[P.date] ??= {}).r = rec;
    else store.stars[P.n] = Math.max(store.stars[P.n] || 0, stars(rec.c));
    persist();
    bump(st, P.date && 'r');
  }
  layout();
  sfx.win();
  confetti(sp ? sp.occasion.split(' ', 1) : undefined); // a special day throws its own emoji
  track('finish', pmode());
  showResult(true);
}

// Out of checks (Impossible): the day is recorded as lost, no retry, and the right order shown with the result.
function lose() {
  P.done = P.lost = true;
  delete store.saves[P.key];
  (store.daily[P.date] ??= {}).r = { c: P.rows.length, rows: P.rows, h: 0, lost: true };
  persist();
  P.order = [...Array(N).keys()];
  P.links.fill(true);
  layout();
  sfx.bad();
  flash($('#list'), 'shake');
  track('lost', pmode());
  showResult(true);
}

// Give up: the cards snap into the right order, nothing is recorded, and the save is dropped.
async function giveUp() {
  if (!P || P.done || !(await ask(T("Give up and see the right order? This puzzle won't count as solved."))) || P.done) return;
  P.done = true;
  if (!SOLO) { delete store.saves[P.key]; persist(); }
  track('giveup', pmode());
  P.order = [...Array(N).keys()];
  P.links.fill(true);
  layout();
  sfx.erase();
  $('#play').hidden = true;
  $('#result').hidden = false;
  $('#res-note').textContent = T("Here's the right order.");
  $('#res-tip').textContent = TOUCH ? T('Tap a card to learn about it.') : T('Click a card to learn about it.');
  $('#btn-result').hidden = true;
}

// The win dialog: opened a beat after a win (fresh), or only filled in for a solved daily seen again. Closing it leaves the cards on view,
// with See result under them to bring it back.
function showResult(fresh) {
  const c = P.rows.length, s = P.lost ? 0 : stars(c), p = P;
  $('#play').hidden = true;
  $('#result').hidden = false;
  $('#res-note').textContent = '';
  $('#res-tip').textContent = TOUCH ? T('Tap a card to learn about it.') : T('Click a card to learn about it.');
  learnButton($('#dlg-win'), T('Learn about these cards')).hidden = !!P.lv.custom; // a custom level has no notes
  $('#btn-result').hidden = false;
  starRow($('#res-stars'), s, fresh);
  $('#win-title').textContent = P.lost ? T('Burned!') : T(['Brilliant!', 'Solved!', 'Nicely done!', 'Sharp!'][Math.floor(Math.random() * 4)]);
  stamp($('#dlg-win'), { date: P.date, label: P.date ? '' : P.n ? T(DIFF[P.lv.d]) : T('Custom level'), value: P.lost ? '💀' : checksText(c), fresh });
  $('#res-text').innerHTML = (P.lost ? T("Out of checks. Here's the right order.") : T('Solved in <b>{checks}</b>', { checks: checksText(c) })) + (P.hints ? ` · ${hintsText(P.hints)}` : '') + (P.date ? streakText(streak()) : '');
  $('#res-next').hidden = SOLO;
  $('#res-next b').textContent = T(P.date ? (navigator.share ? 'Share result' : 'Copy result') : 'Another puzzle  →');
  $('#res-next').onclick = P.date ? () => share() : () => { $('#dlg-win').close(); playRandom(true, P.lv.d); };
  winDaily(P);
  if (fresh) setTimeout(() => P === p && !$('#game').hidden && $('#dlg-win').showModal(), 1200); // same delay as the core games (core.js)
}

async function share() {
  track('share', pmode());
  const r = store.daily[P.date].r;
  const sp = !IMP && special(SPECIAL, P.date), text = `${T('{game} daily', { game: game.name })} · ${P.date}${sp ? ' · ' + sp.occasion : ''}${IMP ? ' · 🔥 ' + T('Impossible') : ''}\n${P.lv.subject}\n${r.rows.map((row) => [...row].map((c) => (c === '1' ? '🟩' : '⬜')).join('')).join('\n')}\n` +
    `${checksText(r.c)} ${r.lost ? '💀' : (IMP ? '⛧' : '⭐').repeat(stars(r.c))}${r.h ? ' ' + '💡'.repeat(r.h) : ''}` + (location.protocol.startsWith('http') ? '\n' + location.origin + location.pathname + (IMP ? '' : '#daily') : '');
  if (navigator.share) try { return await navigator.share({ text }); } catch (e) { if (e.name === 'AbortError') return; }
  copyLink(text, $('#res-next'));
}

// The link to the puzzle on screen: a random one's own code, or the daily (which is a different puzzle tomorrow).
async function shareLink() {
  track('share-link', pmode());
  const url = location.href;
  try {
    if (navigator.share) await navigator.share({ title: game.name, url });
    else { await navigator.clipboard.writeText(url); flash($('#btn-link'), 'pop'); }
  } catch {}
}

// ---------- wiring ----------
// Each language has its own levels, so its own progress (math games share theirs: the puzzles are the same)
game = { name: T('Orderly'), storeKey: LANG === 'en' ? 'orderly' : 'orderly-' + LANG, glyphs: ['↑', '↓'] };
if (!SOLO) goImpossible(game);
try { store = JSON.parse(localStorage.getItem(game.storeKey)) || {}; } catch { store = {}; }
store = { daily: {}, stars: {}, saves: {}, off: [], seenHelp: false, ...store };

// play.html shares the store (help seen) but may sit open beside a game tab: it re-reads before writing, so it never writes back a stale copy.
const remember = (patch) => {
  if (SOLO) try { store = { ...store, ...JSON.parse(localStorage.getItem(game.storeKey)) }; } catch {}
  Object.assign(store, patch);
  persist();
};
$('#btn-check').onclick = check;
$('#btn-result').onclick = () => $('#dlg-win').showModal();
$('#btn-giveup').onclick = giveUp;
$('#btn-hint').onclick = hint;
$('#list').addEventListener('pointerdown', drag);
// The puzzle over: a tap on a card opens its note (wordNote(), core.js)
const note = (el) => P.lv.custom || wordNote(P.lv.subject, P.lv.items[el.dataset.i].name);
$('#list').addEventListener('click', (e) => { const el = e.target.closest('.card'); if (el && P?.done) note(el); });
$('#dlg-help').addEventListener('close', () => remember({ seenHelp: true }));
document.addEventListener('visibilitychange', () => document.hidden && save());
document.addEventListener('keydown', (e) => {
  if (!P || $('#game').hidden || document.querySelector('dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
  const el = document.activeElement?.closest?.('.card');
  if (el && !P.done && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    const all = units(), k = all.findIndex((u) => u.includes(+el.dataset.i)), to = k + (e.key === 'ArrowUp' ? -1 : 1);
    if (to >= 0 && to < all.length && coachAllows({ unit: all[k] })) { place(all.filter((_, x) => x !== k), all[k], to); layout(); el.focus(); sfx.place(); status(); save(); }
  } else if (e.key === 'Escape') $('#btn-back').click();
  else if (e.key === 'Enter' && el && P.done) note(el);
  else if (e.key === 'Enter' && !document.activeElement?.matches?.('button, a, input')) check(); // focused controls handle their own Enter
  else return;
  e.preventDefault();
});

if (SOLO) {
  // play.html: the level in the link. #l=… is a shared level; #t=… is the editor's Test it, whose way out leads back to the editor.
  const open = async () => {
    const test = location.hash.startsWith('#t='), lv = customLevel(await unpackLink(location.hash.slice(3)));
    if (!lv) return screen('broken');
    if (test) {
      $('#btn-back').setAttribute('aria-label', T('Back to editing'));
      $('#res-home b').textContent = T('Back to editing');
    }
    $('#res-make').hidden = test;
    const out = () => { location.href = test ? 'editor.html' : './'; };
    $('#btn-back').onclick = $('#res-home').onclick = out;
    play('C' + JSON.stringify(lv.items), lv); // the same level always deals the same way
  };
  addEventListener('hashchange', open);
  open();
} else {
  $('#btn-daily').onclick = () => play('D' + today());
  if (IMP) { // the regular daily, disabled, above the Impossible one
    const off = Object.assign(document.createElement('button'), { className: 'btn daily', disabled: true, innerHTML: `<b>${esc(T("Today's puzzle"))}</b>` });
    $('#btn-daily').before(off);
    $('#btn-daily b').textContent = T('Impossible');
  }
  $('#btn-random').onclick = () => playRandom();
  // Easy / Medium / Hard ask which topics first; the choice is kept (as store.off, the unticked ones) for next time and for "Another puzzle".
  $('#t-list').replaceChildren(...Object.entries(TOPICS).map(([k, name]) => {
    const l = document.createElement('label');
    l.innerHTML = `<input type="checkbox" value="${k}"> ${T(name)}`;
    return l;
  }));
  const boxes = [...document.querySelectorAll('#t-list input')], dlgTopics = $('#dlg-topics');
  const syncGo = () => { $('#t-go').disabled = !boxes.some((b) => b.checked); };
  const tickAll = (on) => { for (const b of boxes) b.checked = on; syncGo(); };
  $('#t-list').onchange = syncGo;
  $('#t-all').onclick = () => tickAll(true);
  $('#t-none').onclick = () => tickAll(false);
  for (const b of document.querySelectorAll('#new-row button')) b.onclick = () => {
    dlgTopics.dataset.d = b.dataset.d;
    $('#t-title').textContent = T(DIFF[b.dataset.d] + ' puzzle');
    for (const x of boxes) x.checked = !store.off.includes(x.value);
    syncGo();
    dlgTopics.returnValue = '';
    dlgTopics.showModal();
  };
  dlgTopics.addEventListener('close', () => {
    if (dlgTopics.returnValue !== 'go') return;
    store.off = boxes.filter((b) => !b.checked).map((b) => b.value);
    persist();
    playRandom(true, +dlgTopics.dataset.d);
  });
  $('#btn-link').onclick = shareLink;
  $('#btn-help').onclick = () => { track('help', ''); $('#dlg-help').showModal(); };
  tutorialLink(() => play('T'));
  const goHome = () => { save(); P = null; screen('home'); };
  $('#btn-back').onclick = goHome;
  $('#res-home').onclick = () => { $('#dlg-win').close(); P = null; screen('home'); };
  router(route, goHome);
}

// Paper version: the cards as cut-out strips, in the dealt order (never the player's progress or the answer).
// Bound in the zine they stay on the page: numbered where they are.
printable((bound) => P && {
  top: `<p class="subject"><b>${esc(P.lv.subject)}</b></p>`,
  rules: bound ? [T('Number the cards <b>1 to {n}</b>, from <b>{top}</b> to <b>{bottom}</b>.', { n: P.lv.items.length, top: esc(P.lv.top), bottom: esc(P.lv.bottom) })] : [
    T('<b>Cut out</b> the {n} cards along the dashed lines.', { n: P.lv.items.length }),
    T('<b>Sort them on the table</b>, from <b>{top}</b> at the top to <b>{bottom}</b> at the bottom.', { top: esc(P.lv.top), bottom: esc(P.lv.bottom) }),
    T('Happy with the order? Number the cards <b>1 to {n}</b> on their lines, top to bottom.', { n: P.lv.items.length }),
  ],
  body: `<ul class="p-strips${bound ? ' bound' : ''}">${deal(hash(P.key)).map((i) => `<li><i></i>${esc(P.lv.items[i].name)}</li>`).join('')}</ul>`,
  answer: `<ol class="p-order">${P.lv.items.map((it) => `<li><b>${esc(it.name)}</b> <span>${esc(it.val)}</span></li>`).join('')}</ol>`,
}, (_, date) => { P = { key: 'D' + date, lv: parse(dailyLine(date)) }; });
nudge(() => P && !P.done && !$('#game').hidden);
if (!store.seenHelp && !IMP && !P?.tut) $('#dlg-help').showModal();
