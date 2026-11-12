'use strict';
// The shell every game shares: storage, sound, home menu, dailies & packs, timer, pause, levels, win, share.
// A game page loads common.js, core.js, then its own scripts, and calls boot(game) with:
//   name, storeKey, glyphs (confetti)
//   start(G, save) -> builds the board for G.key into #board; returns true if it restored `save`
//   save(G)        -> what to persist besides elapsed
//   key(e)         -> handle a keydown during play; return true if used
//   reveal(G)      -> show the answer on the board (after giving up)
// Games read and extend the shared G: { pack, n, date, key, elapsed, hinted: Set, done, paused }.
const $ = (s) => document.querySelector(s);
const ICON_ON = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zM17 9l5 6M22 9l-5 6"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

let game, store, G = null, timer = null;
const persist = () => { try { localStorage.setItem(game.storeKey, JSON.stringify(store)); } catch {} };

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
// The Today header: "Thu 12 Nov · 4-day streak"
const todayLine = (st) => new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) + (st ? ` · ${st}-day streak` : '');
function streak() {
  const d = new Date();
  const any = () => Object.keys(store.daily[ymd(d)] || {}).length > 0; // any difficulty counts
  if (!any()) d.setDate(d.getDate() - 1);
  let n = 0;
  for (; any(); d.setDate(d.getDate() - 1)) n++;
  return n;
}

// ---------- sound (synthesized, no assets) ----------
const sfx = (() => {
  let ctx;
  function tone(freq, { dur = 0.12, type = 'sine', vol = 0.15, at = 0, slide } = {}) {
    if (store.muted) return;
    try {
      ctx ??= new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch {}
  }
  const note = (semi) => 523.25 * 2 ** (semi / 12);
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  return {
    tap: () => tone(880, { dur: 0.04, type: 'triangle', vol: 0.05 }),
    place: () => { tone(440, { dur: 0.09, type: 'triangle', vol: 0.14, slide: 620 }); tone(1240, { dur: 0.05, vol: 0.03, at: 0.02 }); },
    erase: () => tone(360, { dur: 0.1, type: 'triangle', vol: 0.1, slide: 180 }),
    good: (n) => { const s = SCALE[Math.min(n, SCALE.length - 1)]; [0, 4, 7].forEach((d, i) => tone(note(s + d), { dur: 0.3, vol: 0.09, at: i * 0.05 })); },
    bad: () => { tone(196, { dur: 0.22, type: 'square', vol: 0.035, slide: 140 }); tone(185, { dur: 0.22, type: 'square', vol: 0.035, slide: 130 }); },
    hint: () => [12, 19, 24].forEach((s, i) => tone(note(s), { dur: 0.18, vol: 0.06, at: i * 0.07, type: 'triangle' })),
    win: () => [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((s, i) =>
      tone(note(s), { dur: i === 8 ? 0.9 : 0.22, vol: 0.1, at: i * 0.085, type: i % 2 ? 'triangle' : 'sine' })),
  };
})();

function syncSound() {
  for (const b of document.querySelectorAll('.js-sound')) {
    b.innerHTML = store.muted ? ICON_OFF : ICON_ON;
    b.setAttribute('aria-pressed', String(!store.muted));
  }
}

function flash(el, cls) {
  el.classList.remove('pop', 'shake');
  void el.getBoundingClientRect();
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

// ---------- screens ----------
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  if (id === 'home') renderHome();
}

function renderHome() {
  const t = ymd(new Date()), recs = store.daily[t] || {}, st = streak();
  $('#daily-meta').textContent = todayLine(st);
  $('#daily-btns').replaceChildren(...Object.entries(TIERS).map(([k, name], i) => {
    const b = document.createElement('button'), r = recs[k];
    b.className = `daily-btn tier-${k}${r ? ' done' : ''}`;
    b.style.setProperty('--i', i);
    b.innerHTML = `<b>${name}</b><small>${r ? '✓ ' + fmt(r.t) : store.saves['D' + k + t] ? 'Resume' : 'Play'}</small>`;
    b.onclick = () => start(k, null, t);
    return b;
  }));
  $('#pack-btns').replaceChildren(...Object.entries(TIERS).map(([k, name]) => {
    const pp = store.packs[k], done = Object.keys(pp.stars).length;
    const b = document.createElement('button');
    b.className = `pack-btn tier-${k}`;
    b.innerHTML = `<span class="pack-name">${name}</span>
      <span class="pack-bar"><i style="width:${(done / PACK_SIZE) * 100}%"></i></span>
      <span class="pack-count">${done}/${PACK_SIZE}</span>`;
    const next = firstUnsolved(pp);
    b.onclick = () => (next ? start(k, next) : openLevels(k));
    return b;
  }));
}

// ---------- play ----------
// start(pack, n) plays pack level n; start(pack, null, date) plays that day's daily of that difficulty.
function start(pack, n, date = null) {
  const key = date ? 'D' + pack + date : pack + n, save = store.saves[key] || {};
  G = { pack, n, date, key, elapsed: 0, hinted: new Set(), done: false, paused: false };
  $('#g-title').textContent = date ? `Daily · ${TIERS[pack]}` : `${TIERS[pack]} · ${n}`;
  show('game');
  if (game.start(G, save)) G.elapsed = save.elapsed || 0;
  setPaused(false);
  $('#timer').textContent = fmt(G.elapsed);
  clearInterval(timer);
  timer = setInterval(tick, 1000);
}

const playing = () => G && !G.done && !G.paused;

// Pause stops the clock and hides the board, so it can't be studied for free.
function setPaused(v) {
  if (!G || (v && G.done)) return;
  const changed = G.paused !== v;
  G.paused = v;
  $('#game').classList.toggle('paused', v);
  $('#pause-cover').hidden = !v;
  $('#btn-pause').innerHTML = v ? ICON_PLAY : ICON_PAUSE;
  $('#btn-pause').setAttribute('aria-label', v ? 'Resume' : 'Pause');
  if (changed && v) { saveGame(); sfx.erase(); } else if (changed) sfx.tap();
}

function saveGame() {
  if (G.done) return;
  store.saves[G.key] = { ...game.save(G), elapsed: G.elapsed };
  persist();
}

function tick() {
  if (!G || G.done || G.paused || document.hidden || $('#game').hidden || document.querySelector('dialog[open]')) return;
  G.elapsed++;
  $('#timer').textContent = fmt(G.elapsed);
  if (G.elapsed % 5 === 0) saveGame();
}

function win() {
  G.done = true;
  clearInterval(timer);
  delete store.saves[G.key];
  const h = G.hinted.size, stars = h === 0 ? 3 : h <= 2 ? 2 : 1;
  if (G.date) ((store.daily[G.date] ??= {})[G.pack] ??= { t: G.elapsed, h });
  else {
    const pp = store.packs[G.pack];
    pp.stars[G.n] = Math.max(pp.stars[G.n] || 0, stars);
    pp.unlocked = Math.max(pp.unlocked, Math.min(G.n + 1, PACK_SIZE));
  }
  persist();
  $('#board').classList.add('solved');
  sfx.win();
  confetti();

  const g = G;
  setTimeout(() => {
    if (G !== g) return;
    $('#win-stars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : ''}" style="--i:${i}">★</span>`).join('');
    $('#win-stars').setAttribute('aria-label', `${stars} of 3 stars`);
    $('#win-title').textContent = ['Brilliant!', 'Solved!', 'Nicely done!', 'Sharp!'][Math.floor(Math.random() * 4)];
    const st = streak();
    $('#win-stats').innerHTML = `<b>${fmt(g.elapsed)}</b> · ${h ? `${h} hint${h > 1 ? 's' : ''}` : 'no hints'}` +
      (g.date && st ? ` · ${st}-day streak` : '');
    const last = !g.date && g.n === PACK_SIZE;
    if (last) $('#win-title').textContent = `${TIERS[g.pack]} pack complete!`;
    $('#win-next').hidden = last;
    $('#win-next b').textContent = g.date ? 'Share result' : `Level ${g.n + 1}  →`;
    $('#dlg-win').showModal();
  }, game.winDelay ?? 1100);
}

// Give up: the answer is shown, nothing is recorded (no stars, no daily), and the save is dropped.
function giveUp() {
  if (!playing() || !confirm("Give up and see the answer? This puzzle won't count as solved.")) return;
  G.done = true;
  clearInterval(timer);
  delete store.saves[G.key];
  persist();
  game.reveal(G);
  sfx.erase();
}

async function share() {
  const r = store.daily[G.date][G.pack];
  const text = `${game.name} daily · ${G.date} · ${TIERS[G.pack]}\n⏱ ${fmt(r.t)}  ${r.h ? '💡'.repeat(r.h) : '⭐ no hints'}` +
    (location.protocol.startsWith('http') ? '\n' + location.origin + location.pathname : '');
  try {
    if (navigator.share) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); $('#win-next b').textContent = 'Copied ✓'; }
  } catch {}
}

// Cut paper in the page's inks, overprinted (multiply on cream, screen on blue stock).
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = $('#fx'), ctx = cv.getContext('2d'), dpr = devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const css = getComputedStyle(document.documentElement);
  const colors = ['--brand', '--brand', '--sun', '--teal', '--ink'].map((v) => css.getPropertyValue(v).trim());
  ctx.globalCompositeOperation = css.getPropertyValue('--blend').trim() || 'multiply';
  const glyphs = game.glyphs;
  const parts = Array.from({ length: 120 }, (_, i) => ({
    x: W / 2 + (Math.random() - 0.5) * 80, y: H * 0.42,
    vx: (Math.random() - 0.5) * 15, vy: -Math.random() * 14 - 5,
    s: 7 + Math.random() * 8, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3, f: Math.random() * 6,
    c: colors[i % colors.length], g: i % 4 === 0 ? glyphs[i % glyphs.length] : null,
  }));
  const t0 = performance.now();
  (function frame(now) {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.34; p.vx *= 0.982; p.vy *= 0.992; p.x += p.vx; p.y += p.vy; p.a += p.va; p.f += 0.12;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.scale(1, Math.cos(p.f)); // paper flutters: its face turns toward and away from you
      ctx.fillStyle = p.c;
      ctx.globalAlpha = 0.9;
      if (p.g) { ctx.font = `600 ${p.s * 2.4}px Fraunces, Georgia, serif`; ctx.fillText(p.g, 0, 0); }
      else ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s / 1.5);
      ctx.restore();
    }
    if (now - t0 < 3500) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, W, H);
  })(t0);
}

// 50 levels per page; opens on the page holding the first unsolved level.
const PAGE = 50;
const firstUnsolved = (pp) => Array.from({ length: pp.unlocked }, (_, i) => i + 1).find((n) => !pp.stars[n]);
function openLevels(pack = store.lastPack || 'E', page) {
  store.lastPack = pack;
  $('#pack-tabs').replaceChildren(...Object.entries(TIERS).map(([k, name]) => {
    const t = document.createElement('button');
    t.className = `tab tier-${k}`;
    t.textContent = name;
    t.setAttribute('aria-selected', String(k === pack));
    t.onclick = () => openLevels(k);
    return t;
  }));
  const pp = store.packs[pack], grid = $('#level-grid');
  const lastPage = Math.floor((pp.unlocked - 1) / PAGE);
  page ??= Math.floor(((firstUnsolved(pp) || pp.unlocked) - 1) / PAGE);
  const from = page * PAGE + 1, to = Math.min(from + PAGE - 1, PACK_SIZE);
  $('#pg-label').textContent = `${from}–${to}`;
  $('#pg-prev').disabled = page === 0;
  $('#pg-next').disabled = page >= lastPage;
  $('#pg-prev').onclick = () => openLevels(pack, page - 1);
  $('#pg-next').onclick = () => openLevels(pack, page + 1);
  grid.className = `level-grid tier-${pack}`;
  grid.replaceChildren();
  for (let n = from; n <= to; n++) {
    const b = document.createElement('button'), s = pp.stars[n] || 0;
    b.className = 'lvl' + (n === pp.unlocked && !s ? ' current' : '');
    b.disabled = n > pp.unlocked;
    b.innerHTML = `<span>${n}</span><small>${b.disabled ? '' : s ? '★'.repeat(s) + '☆'.repeat(3 - s) : ''}</small>`;
    b.setAttribute('aria-label', `Level ${n}${b.disabled ? ', locked' : s ? `, ${s} stars` : ''}`);
    b.onclick = () => { $('#dlg-levels').close(); start(pack, n); };
    grid.append(b);
  }
  if (!$('#dlg-levels').open) $('#dlg-levels').showModal();
  grid.querySelector('.current')?.scrollIntoView({ block: 'center' });
}

// ---------- print ----------
// Paper version of the puzzle on screen, unsolved. build() returns { top?: html (above the rules), rules: [html], body: html }.
// It fills #print right before printing (the #btn-print button or Ctrl+P); in print, core.css shows only #print, on one A4 page.
// From the menu nothing is filled, so the page prints as it looks.
function printable(build) {
  const out = document.createElement('section');
  out.id = 'print';
  document.body.append(out);
  addEventListener('beforeprint', () => {
    const s = !$('#game').hidden && build();
    out.innerHTML = s ? `<header class="p-head"><h1>${esc(game.name)}</h1><p>${esc([$('#g-title').textContent, $('#g-sub').textContent].filter(Boolean).join(' · '))}</p></header>${s.top || ''}` +
      `<ol class="rules">${s.rules.map((r) => `<li>${r}</li>`).join('')}</ol>${s.body}` : '';
    document.body.classList.toggle('printing', !!s);
  });
  $('#btn-print').onclick = () => print();
}

// ---------- boot ----------
function boot(g) {
  game = g;
  try { store = JSON.parse(localStorage.getItem(g.storeKey)) || {}; } catch { store = {}; }
  store = { packs: {}, daily: {}, saves: {}, muted: false, seenHelp: false, ...store };
  for (const k in TIERS) store.packs[k] ??= { unlocked: 1, stars: {} };

  $('#btn-levels').onclick = () => openLevels();
  $('#btn-help').onclick = () => $('#dlg-help').showModal();
  $('#btn-back').onclick = () => { if (G && !G.done) saveGame(); clearInterval(timer); show('home'); };
  $('#btn-pause').onclick = () => setPaused(!G.paused);
  $('#btn-resume').onclick = () => setPaused(false);
  $('#btn-giveup').onclick = giveUp;
  $('#win-home').onclick = () => { $('#dlg-win').close(); show('home'); };
  $('#win-next').onclick = () => {
    if (G.date) share(); else { $('#dlg-win').close(); start(G.pack, G.n + 1); }
  };
  $('#dlg-help').addEventListener('close', () => { store.seenHelp = true; persist(); });
  for (const b of document.querySelectorAll('.js-sound')) b.onclick = () => { store.muted = !store.muted; persist(); syncSound(); sfx.tap(); };

  document.addEventListener('keydown', (e) => {
    if (!G || $('#game').hidden || document.querySelector('dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'p' || e.key === 'P') { setPaused(!G.paused); return e.preventDefault(); }
    if (e.key === 'Escape') return $('#btn-back').click();
    if (G.paused) return;
    if (game.key(e)) e.preventDefault();
  });

  syncSound();
  show('home');
  if (!store.seenHelp) $('#dlg-help').showModal();
}
