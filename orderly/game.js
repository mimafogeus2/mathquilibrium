'use strict';
// Orderly: a subject and 10 cards; drag them into order. Check joins runs of cards already in the right order into groups that move as one.
// Borrows storage, sound, confetti and helpers from shared/core.js (but not its level-pack shell: no boot()).
// Levels come from levels.js: LEVELS[i] = "difficulty|Subject|top label|bottom label|Name=Value;..." in the right order.
const N = 10, DIFF = ['', 'Easy', 'Medium', 'Hard'];
const stars = (checks) => (checks <= 2 ? 3 : checks <= 4 ? 2 : 1);

// The daily walks the pool by day number; the multiplier is coprime with the pool size, so no repeats until it's all been used.
const DAY0 = Date.UTC(2026, 0, 1);
const dailyIndex = (date) => ((Math.round((Date.parse(date) - DAY0) / 864e5) * 1237 + 811) % LEVELS.length + LEVELS.length) % LEVELS.length;
// On a special day (special.js) its themed level replaces the pool's.
const dailyLine = (date) => special(SPECIAL, date)?.line ?? LEVELS[dailyIndex(date)];

function parse(line) {
  const [d, subject, top, bottom, items] = line.split('|');
  return { d: +d, subject, top, bottom, items: items.split(';').map((s) => { const [name, val] = s.split('='); return { name, val }; }) };
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
// P = the puzzle on screen: { key, date?, n?, lv, order, links, rows: ['0110…' per check, 1 = grouped], moved, done }
// links[c] = a check found card c directly above card c + 1. Linked cards always move together, so links never break.
let P = null;
const today = () => ymd(new Date());
const nextLevel = () => { let n = 1; while (store.stars[n]) n++; return Math.min(n, LEVELS.length); };
const save = () => { if (P && !P.done) store.saves[P.key] = { order: P.order, links: P.links, rows: P.rows, moved: P.moved }; persist(); };
// The order split into units: runs of linked cards (groups) and lone cards, top to bottom.
const units = () => P.order.reduce((u, c, p) => (p && P.links[c - 1] && P.order[p - 1] === c - 1 ? u.at(-1).push(c) : u.push([c]), u), []);

function screen(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  if (id === 'home') home();
}

function home() {
  const t = today(), sp = special(SPECIAL, t), rec = store.daily[t]?.r, st = streak(), next = nextLevel(), solved = Object.keys(store.stars).length;
  $('#daily-meta').textContent = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + (st ? `  ·  🔥 ${st}` : '');
  $('#btn-daily').classList.toggle('done', !!rec);
  $('#btn-daily small').textContent = rec ? `✓ ${checksText(rec.c)} · see result` : store.saves['D' + t] ? 'Resume' : sp ? sp.occasion : parse(LEVELS[dailyIndex(t)]).subject;
  $('#lv-meta').textContent = `${solved} / ${LEVELS.length}`;
  $('#btn-next b').textContent = `Level ${next}`;
  $('#btn-next small').textContent = store.saves['L' + next] ? 'Resume' : DIFF[parse(LEVELS[next - 1]).d];
}
const checksText = (c) => `${c} check${c > 1 ? 's' : ''}`;

function play(key) {
  const date = key[0] === 'D' ? key.slice(1) : null, n = date ? null : +key.slice(1);
  const lv = parse(date ? dailyLine(date) : LEVELS[n - 1]), sp = date && special(SPECIAL, date), rec = date && store.daily[date]?.r, sv = store.saves[key];
  P = rec ? { key, date, lv, order: [...Array(N).keys()], links: Array(N).fill(true), rows: rec.rows, done: true }
    : { key, date, n, lv, order: sv?.order || deal(hash(key)), links: sv?.links || Array(N).fill(false), rows: sv?.rows || [], moved: sv?.moved ?? true, done: false };
  $('#g-title').textContent = date ? 'Daily' : `Level ${n}`;
  $('#g-sub').textContent = (date ? new Date(date + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' : '') + (sp ? sp.occasion : DIFF[lv.d]);
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
  screen('game');
  layout();
  if (P.done) showResult(false);
  else { $('#play').hidden = false; $('#result').hidden = true; status(); }
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
    el.setAttribute('aria-label', `${P.lv.items[i].name}, ${pos} of ${N}${ok ? `, grouped: ${P.lv.items[i].val}` : ''}`);
    el.tabIndex = P.done ? -1 : 0;
  }
  // DOM order = visual order, so Tab walks top to bottom. Not mid-drag: re-inserting the held card drops its pointer capture.
  if (dom) $('#list').append(...P.order.map((i) => cards[i]));
}
const cardEls = () => [...$('#list').children].sort((a, b) => a.dataset.i - b.dataset.i);

function status() {
  const r = P.rows.at(-1), grouped = r ? [...r].filter((c) => c === '1').length : 0;
  $('#status').textContent = !r ? 'Drag the cards into order, then check.' : `${grouped} of ${N} grouped · ${checksText(P.rows.length)} so far`;
  $('#btn-check').disabled = !P.moved;
}

// Rebuild the order with `unit` inserted at index j among the other units.
const place = (rest, unit, j) => { P.order = [...rest.slice(0, j), unit, ...rest.slice(j)].flat(); P.moved = true; };

// Grabbing any card picks up its whole unit; it slides to wherever its top card lands nearest the pointer.
function drag(e) {
  const el = e.target.closest('.card');
  if (!el || P.done || e.button) return;
  e.preventDefault();
  const all = units(), unit = all.find((u) => u.includes(+el.dataset.i)), rest = all.filter((u) => u !== unit);
  const cards = cardEls(), els = unit.map((c) => cards[c]), start = P.order.indexOf(unit[0]), y0 = e.clientY;
  const pitch = el.offsetHeight + parseFloat(getComputedStyle($('#list')).rowGap || 0);
  // tops[j] = where the unit's top card sits if inserted at index j
  const tops = rest.reduce((t, u) => [...t, t.at(-1) + u.length], [0]);
  el.setPointerCapture(e.pointerId);
  els.forEach((c) => c.classList.add('held'));
  const moveTo = (ev) => {
    const dy = ev.clientY - y0, want = start + dy / pitch;
    const j = tops.reduce((b, t, k) => (Math.abs(t - want) < Math.abs(tops[b] - want) ? k : b), 0);
    if (tops[j] !== P.order.indexOf(unit[0])) { place(rest, unit, j); layout(false); sfx.tap(); }
    els.forEach((c) => c.style.setProperty('--dy', dy - (tops[j] - start) * pitch + 'px'));
  };
  const up = () => {
    el.removeEventListener('pointermove', moveTo);
    els.forEach((c) => { c.classList.remove('held'); c.style.setProperty('--dy', '0px'); });
    layout();
    if (P.order.indexOf(unit[0]) !== start) { sfx.place(); status(); save(); }
  };
  el.addEventListener('pointermove', moveTo);
  el.addEventListener('pointerup', up, { once: true });
  el.addEventListener('pointercancel', up, { once: true });
}

function check() {
  if (!P || P.done || !P.moved) return;
  const was = new Set(units().filter((u) => u.length > 1).flat());
  P.order.forEach((c, p) => { if (P.order[p + 1] === c + 1) P.links[c] = true; });
  const row = P.order.map((c, p) => (P.order[p + 1] === c + 1 || P.order[p - 1] === c - 1 ? '1' : '0')).join('');
  P.rows.push(row);
  P.moved = false;
  layout();
  if (P.order.every((c, p) => c === p)) return win();
  const fresh = units().filter((u) => u.length > 1).flat().filter((c) => !was.has(c));
  if (fresh.length) sfx.good([...row].filter((c) => c === '1').length);
  else { sfx.bad(); flash($('#list'), 'shake'); }
  const cards = cardEls();
  fresh.forEach((c) => flash(cards[c], 'pop'));
  status();
  save();
}

function win() {
  P.done = true;
  delete store.saves[P.key];
  const rec = { c: P.rows.length, rows: P.rows };
  if (P.date) (store.daily[P.date] ??= {}).r = rec;
  else store.stars[P.n] = Math.max(store.stars[P.n] || 0, stars(rec.c));
  persist();
  layout();
  sfx.win();
  confetti();
  showResult(true);
}

// Give up: the cards snap into the right order, nothing is recorded, and the save is dropped.
function giveUp() {
  if (!P || P.done || !confirm("Give up and see the right order? This puzzle won't count as solved.")) return;
  P.done = true;
  delete store.saves[P.key];
  persist();
  P.order = [...Array(N).keys()];
  P.links.fill(true);
  layout();
  sfx.erase();
  $('#play').hidden = true;
  $('#result').hidden = false;
  $('#res-stars').innerHTML = '';
  $('#res-text').textContent = "Here's the right order.";
  $('#res-next').hidden = true;
}

function showResult(fresh) {
  const c = P.rows.length, s = stars(c);
  $('#play').hidden = true;
  $('#result').hidden = false;
  $('#res-stars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < s ? 'on' : ''}" style="--i:${fresh ? i : -3}">★</span>`).join('');
  $('#res-text').innerHTML = `Solved in <b>${checksText(c)}</b>` + (P.date && streak() ? ` · 🔥 ${streak()}-day streak` : '');
  const last = !P.date && P.n === LEVELS.length;
  $('#res-next').hidden = last;
  $('#res-next b').textContent = P.date ? 'Share result' : `Level ${P.n + 1}  →`;
  $('#res-next').onclick = P.date ? () => share() : () => play('L' + (P.n + 1));
  $('#result').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

async function share() {
  const r = store.daily[P.date].r;
  const sp = special(SPECIAL, P.date), text = `Orderly daily · ${P.date}${sp ? ' · ' + sp.occasion : ''}\n${P.lv.subject}\n${r.rows.map((row) => [...row].map((c) => (c === '1' ? '🟩' : '⬜')).join('')).join('\n')}\n` +
    `${checksText(r.c)} ${'⭐'.repeat(stars(r.c))}` + (location.protocol.startsWith('http') ? '\n' + location.origin + location.pathname : '');
  try {
    if (navigator.share) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); $('#res-next b').textContent = 'Copied ✓'; }
  } catch {}
}

// PAGE (50, from core.js) levels per page, opening on the page with the next unsolved level.
function openLevels(page) {
  const next = nextLevel(), grid = $('#level-grid'), lastPage = Math.floor((LEVELS.length - 1) / PAGE);
  page ??= Math.floor((next - 1) / PAGE);
  const from = page * PAGE + 1, to = Math.min(from + PAGE - 1, LEVELS.length);
  $('#pg-label').textContent = `${from}–${to}`;
  $('#pg-prev').disabled = page === 0;
  $('#pg-next').disabled = page >= lastPage;
  $('#pg-prev').onclick = () => openLevels(page - 1);
  $('#pg-next').onclick = () => openLevels(page + 1);
  grid.replaceChildren();
  for (let n = from; n <= to; n++) {
    const b = document.createElement('button'), s = store.stars[n] || 0;
    b.className = 'lvl' + (n === next && !s ? ' current' : '');
    b.disabled = n > next;
    b.innerHTML = `<span>${n}</span><small>${b.disabled ? '🔒' : s ? '★'.repeat(s) + '☆'.repeat(3 - s) : ''}</small>`;
    b.setAttribute('aria-label', `Level ${n}${b.disabled ? ', locked' : s ? `, ${s} stars` : ''}`);
    b.onclick = () => { $('#dlg-levels').close(); play('L' + n); };
    grid.append(b);
  }
  if (!$('#dlg-levels').open) $('#dlg-levels').showModal();
  grid.querySelector('.current')?.scrollIntoView({ block: 'center' });
}

// ---------- wiring ----------
game = { name: 'Orderly', storeKey: 'orderly', glyphs: ['↑', '↓'] };
try { store = JSON.parse(localStorage.getItem(game.storeKey)) || {}; } catch { store = {}; }
store = { daily: {}, stars: {}, saves: {}, muted: false, seenHelp: false, ...store };

$('#btn-daily').onclick = () => play('D' + today());
$('#btn-next').onclick = () => play('L' + nextLevel());
$('#btn-levels').onclick = () => openLevels();
$('#btn-help').onclick = () => $('#dlg-help').showModal();
$('#btn-back').onclick = () => { save(); P = null; screen('home'); };
$('#btn-check').onclick = check;
$('#btn-giveup').onclick = giveUp;
$('#res-home').onclick = () => { P = null; screen('home'); };
$('#list').addEventListener('pointerdown', drag);
$('#dlg-help').addEventListener('close', () => { store.seenHelp = true; persist(); });
for (const b of document.querySelectorAll('.js-sound')) b.onclick = () => { store.muted = !store.muted; persist(); syncSound(); sfx.tap(); };
document.addEventListener('visibilitychange', () => document.hidden && save());
document.addEventListener('keydown', (e) => {
  if (!P || $('#game').hidden || document.querySelector('dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
  const el = document.activeElement?.closest?.('.card');
  if (el && !P.done && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    const all = units(), k = all.findIndex((u) => u.includes(+el.dataset.i)), to = k + (e.key === 'ArrowUp' ? -1 : 1);
    if (to >= 0 && to < all.length) { place(all.filter((_, x) => x !== k), all[k], to); layout(); el.focus(); sfx.place(); status(); save(); }
  } else if (e.key === 'Escape') $('#btn-back').click();
  else return;
  e.preventDefault();
});

syncSound();
screen('home');
if (!store.seenHelp) $('#dlg-help').showModal();
