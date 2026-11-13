'use strict';
// The level editor: a subject, the two ends of the order, and 10 cards (custom.js has the shape and limits).
// The draft is kept in localStorage as you type; Test it / Share / Copy link pack it into a play.html link (shared/link.js).
const N = CUSTOM.cards, DRAFT = 'orderly-editor' + (LANG === 'en' ? '' : '-' + LANG);
const PRESETS = [['Earliest', 'Latest'], ['First', 'Last'], ['Smallest', 'Largest'], ['Fewest', 'Most'], ['Shortest', 'Longest'], ['Lowest', 'Highest'], ['Slowest', 'Fastest']];
const pair = (t, b) => T('{top} → {bottom}', { top: t, bottom: b }); // a preset's chip
const GRIP = '<svg viewBox="0 0 24 24"><path d="M5 9h14M5 15h14"/></svg>';
const UP = '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>', DOWN = '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';

const blank = () => ({ s: '', t: T('Earliest'), b: T('Latest'), c: Array.from({ length: N }, () => ['', '']) });
let D;
try { D = JSON.parse(localStorage.getItem(DRAFT)); } catch {}
const str = (x) => typeof x === 'string';
if (!(D && str(D.s) && str(D.t) && str(D.b) && Array.isArray(D.c) && D.c.length === N && D.c.every((c) => Array.isArray(c) && str(c[0]) && str(c[1])))) D = blank();
const keep = () => { try { localStorage.setItem(DRAFT, JSON.stringify(D)); } catch {} };

let cur = 0, tried = false; // cur = the card the preview shows; tried = Test/Share was pressed, so every problem shows, not just the touched ones
const touched = new Set();

// ---------- the form ----------
const list = $('#e-list'), rows = [];
for (let i = 0; i < N; i++) {
  const li = document.createElement('li');
  li.className = 'e-row';
  li.innerHTML = `<span class="e-grip" aria-hidden="true">${GRIP}</span><span class="e-n" aria-hidden="true"></span>
    <span class="e-fields"><input class="e-name" maxlength="${CUSTOM.name}" autocomplete="off"><input class="e-val" maxlength="${CUSTOM.value}" autocomplete="off"></span>
    <span class="e-move"><button type="button" class="icon e-up">${UP}</button><button type="button" class="icon e-down">${DOWN}</button></span>`;
  const [name, val] = li.querySelectorAll('input'), [up, down] = li.querySelectorAll('button');
  li.querySelector('.e-n').textContent = i + 1;
  name.placeholder = T('Card {n}', { n: i + 1 });
  val.placeholder = T('Value');
  name.setAttribute('aria-label', T('Card {n} name', { n: i + 1 }));
  val.setAttribute('aria-label', T('Card {n} value', { n: i + 1 }));
  up.setAttribute('aria-label', T('Move card {n} up', { n: i + 1 }));
  down.setAttribute('aria-label', T('Move card {n} down', { n: i + 1 }));
  up.disabled = i === 0;
  down.disabled = i === N - 1;
  name.oninput = () => { D.c[i][0] = name.value; changed(); };
  val.oninput = () => { D.c[i][1] = val.value; changed(); };
  name.onfocus = val.onfocus = () => { cur = i; preview(); };
  name.onblur = () => { touched.add(name); check(); };
  val.onblur = () => { touched.add(val); check(); };
  // focus follows the card (onto its other arrow at the ends, where this one is disabled)
  up.onclick = () => { move(i, i - 1); (i > 1 ? rows[i - 1].up : rows[0].down).focus(); };
  down.onclick = () => { move(i, i + 1); (i < N - 2 ? rows[i + 1].down : rows[N - 1].up).focus(); };
  rows.push({ li, name, val, up, down });
  list.append(li);
}
const fields = { s: $('#e-subject'), t: $('#e-top'), b: $('#e-bottom') };
for (const [k, el] of Object.entries(fields)) {
  el.oninput = () => { D[k] = el.value; changed(); };
  el.onblur = () => { touched.add(el); check(); };
}
fields.s.maxLength = CUSTOM.subject;
fields.t.maxLength = fields.b.maxLength = CUSTOM.label;
$('#e-presets').replaceChildren(...PRESETS.map(([t, b]) => {
  const c = document.createElement('button');
  c.type = 'button';
  c.className = 'chip';
  c.textContent = pair(T(t), T(b));
  c.onclick = () => { D.t = T(t); D.b = T(b); fill(); changed(); };
  return c;
}));
$('#e-swap').onclick = () => { [D.t, D.b] = [D.b, D.t]; fill(); changed(); };

// D → the inputs (on load, after a reorder, a preset or Start over)
function fill() {
  for (const k in fields) fields[k].value = D[k];
  rows.forEach((r, i) => { r.name.value = D.c[i][0]; r.val.value = D.c[i][1]; });
}
function changed() {
  keep();
  $('#e-lbl-top').textContent = '▲ ' + (D.t.trim() || '…');
  $('#e-lbl-bottom').textContent = '▼ ' + (D.b.trim() || '…');
  for (const c of $('#e-presets').children) c.setAttribute('aria-pressed', String(c.textContent === pair(D.t, D.b)));
  preview();
  check();
}
function preview() {
  const [name, val] = D.c[cur].map((x) => x.trim());
  for (const el of document.querySelectorAll('.e-preview .name')) { el.textContent = name || T('Card {n}', { n: cur + 1 }); el.classList.toggle('empty', !name); }
  $('.e-preview .val').textContent = val || '?';
}
// Card i moves to j; the others close up behind it.
function move(i, j) {
  if (j < 0 || j >= N || i === j) return;
  D.c.splice(j, 0, ...D.c.splice(i, 1));
  cur = j;
  fill();
  changed();
}

// ---------- validation ----------
// Every problem as [input, message, duplicate?]; Test/Share stop at the first. Lengths are capped by maxlength, so they can't be over.
function problems() {
  const out = [], v = (el) => el.value.trim();
  if (!v(fields.s)) out.push([fields.s, T('Give the level a subject.')]);
  if (!v(fields.t)) out.push([fields.t, T('Name the top of the order.')]);
  if (!v(fields.b)) out.push([fields.b, T('Name the bottom of the order.')]);
  const seen = {};
  rows.forEach((r, i) => {
    const name = v(r.name).toLowerCase();
    if (!name) out.push([r.name, T('Card {n} needs a name.', { n: i + 1 })]);
    else if (name in seen) out.push([r.name, T('Cards {a} and {b} have the same name.', { a: seen[name] + 1, b: i + 1 }), true]);
    else seen[name] = i;
    if (!v(r.val)) out.push([r.val, T('Card {n} needs a value.', { n: i + 1 })]);
  });
  return out;
}
// Marks the problems worth showing (a touched field, a duplicate, or all after a Test/Share) and says the first; true if there are none.
function check() {
  const all = problems(), shown = all.filter(([el, , dup]) => tried || dup || touched.has(el));
  for (const el of document.querySelectorAll('.e-form input')) el.removeAttribute('aria-invalid');
  for (const [el] of shown) el.setAttribute('aria-invalid', 'true');
  $('#e-msg').textContent = shown.length ? shown[0][1] + (shown.length > 1 ? ' ' + T('(+{n} more)', { n: shown.length - 1 }) : '') : '';
  $('#e-msg').classList.toggle('bad', !!shown.length);
  return !all.length;
}

// ---------- test & share ----------
// The link to play.html carrying the level (#t= for Test it: its way out leads back here), or null with the first problem focused.
async function link(test) {
  tried = true;
  if (!check()) { problems()[0][0].focus(); flash($('#e-msg'), 'shake'); return null; }
  const o = { s: D.s.trim(), t: D.t.trim(), b: D.b.trim(), c: D.c.map((c) => c.map((x) => x.trim())) };
  return new URL('play.html#' + (test ? 't=' : 'l=') + await packLink(o), location.href).href;
}
$('#e-form').onsubmit = async (e) => {
  e.preventDefault();
  const url = await link(true);
  if (url) { track('make', 'test'); location.href = url; }
};
$('#e-share').onclick = async () => {
  const url = await link();
  if (!url) return;
  track('make', 'share');
  if (!navigator.share) return copyLink(url, $('#e-share'));
  try { await navigator.share({ title: `${T('Orderly')}: ${D.s.trim()}`, url }); } catch (e) { if (e.name !== 'AbortError') copyLink(url, $('#e-share')); }
};
$('#e-copy').onclick = async () => {
  const url = await link();
  if (url) { track('make', 'copy'); copyLink(url, $('#e-copy')); }
};
$('#e-clear').onclick = () => {
  if (!confirm(T('Clear every field and start over?'))) return;
  D = blank();
  cur = 0;
  tried = false;
  touched.clear();
  fill();
  changed();
};

// ---------- drag to reorder ----------
// By the grip only, so the rest of the row (and the page) still scrolls on touch. The held row follows the pointer; the rows it passes
// slide over by one; on release the card moves for real. Same idea as the game's card drag, on a plain list.
list.addEventListener('pointerdown', (e) => {
  const grip = e.target.closest('.e-grip');
  if (!grip || e.button) return;
  e.preventDefault();
  const li = grip.closest('li'), from = rows.findIndex((r) => r.li === li), y0 = e.clientY;
  const pitch = li.offsetHeight + parseFloat(getComputedStyle(list).rowGap || 0);
  let to = from;
  grip.setPointerCapture(e.pointerId);
  li.classList.add('held');
  const moveTo = (ev) => {
    const dy = ev.clientY - y0;
    to = Math.max(0, Math.min(N - 1, from + Math.round(dy / pitch)));
    rows.forEach((r, i) => {
      r.li.style.translate = i === from ? `0 ${dy}px` : `0 ${i > from && i <= to ? -pitch : i < from && i >= to ? pitch : 0}px`;
    });
  };
  const up = () => {
    grip.removeEventListener('pointermove', moveTo);
    li.classList.remove('held');
    list.classList.add('settling'); // no slide back: the rows swap contents in place
    rows.forEach((r) => { r.li.style.translate = ''; });
    move(from, to);
    requestAnimationFrame(() => list.classList.remove('settling'));
  };
  grip.addEventListener('pointermove', moveTo);
  grip.addEventListener('pointerup', up, { once: true });
  grip.addEventListener('pointercancel', up, { once: true });
});

fill();
changed();
