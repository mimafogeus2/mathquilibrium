'use strict';
// editor.html: make a round ({ s, y, n }, see custom.js), test it in the swipe UI, share it as a play.html#r=... link.
// The draft is kept in localStorage as you type (per language, like the game's progress).
const DRAFT = game.storeKey + '-draft';
let draft = { s: '', y: [], n: [] };
try { const d = JSON.parse(localStorage.getItem(DRAFT)); if (d && roundProblems(d)[0] !== 'shape') draft = d; } catch {}
const saveDraft = () => { try { localStorage.setItem(DRAFT, JSON.stringify(draft)); } catch {} };

const ISSUE = { long: () => T('Too long for a card ({n} letters at most)', { n: LIMITS.word }), dup: () => T('Already in this list'), both: () => T('In both lists') };
const PROBLEM = {
  subject: () => T('Give the round a subject.'),
  few: (t) => T('{n} more to go: a round has 24 words.', { n: LIMITS.total - t }),
  many: (t) => T('{n} too many: a round has 24 words.', { n: t - LIMITS.total }),
  side: () => T('Each list needs at least {n} words.', { n: LIMITS.side }),
  words: () => T('Fix the words marked in red.'),
};

function render() {
  const total = draft.y.length + draft.n.length, problems = roundProblems(draft);
  for (const list of document.querySelectorAll('.ed-list')) {
    const side = list.dataset.side, other = side === 'y' ? T("Doesn't fit") : T('Fits');
    list.querySelector('.ed-n').textContent = draft[side].length;
    list.querySelector('.ed-words').replaceChildren(...draft[side].map((w, i) => {
      const chip = document.createElement('span'), move = document.createElement('button'), x = document.createElement('button');
      const issue = wordIssue(draft, side, w);
      chip.className = 'ed-word' + (issue ? ' bad' : '');
      move.textContent = w; // user text: never innerHTML
      move.title = issue ? ISSUE[issue]() : T('Move to “{list}”', { list: other });
      move.setAttribute('aria-label', (issue ? ISSUE[issue]() + ': ' : '') + T('{word}, move to “{list}”', { word: w, list: other }));
      move.onclick = () => { draft[side].splice(i, 1); draft[side === 'y' ? 'n' : 'y'].push(w); changed(); sfx.tap(); };
      x.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>';
      x.setAttribute('aria-label', T('Remove {word}', { word: w }));
      x.onclick = () => { draft[side].splice(i, 1); changed(); sfx.erase(); list.querySelector('.ed-add').focus(); };
      chip.append(move, x);
      return chip;
    }));
  }
  $('#ed-bar').style.width = Math.min(total / LIMITS.total, 1) * 100 + '%';
  $('#ed-bar').classList.toggle('over', total > LIMITS.total);
  $('#ed-problems').replaceChildren(...problems.map((p) => Object.assign(document.createElement('li'), { textContent: PROBLEM[p](total) })));
  if (!problems.length) $('#ed-problems').append(Object.assign(document.createElement('li'), { className: 'ok', textContent: T('Ready: test it or send it.') }));
  for (const b of ['#ed-test', '#ed-share', '#ed-copy']) $(b).disabled = problems.length > 0;
  if (!problems.length) makeLink();
}
const changed = () => { saveDraft(); render(); };

// Add what was typed or pasted: a comma or new line splits it into words.
function add(side, text) {
  const words = text.split(/[,\n]/).map((w) => w.trim().replace(/\s+/g, ' ')).filter(Boolean);
  if (!words.length) return;
  draft[side].push(...words);
  changed();
  sfx.place();
}
for (const list of document.querySelectorAll('.ed-list')) {
  const side = list.dataset.side, input = list.querySelector('.ed-add');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); add(side, input.value); input.value = ''; }
    // Backspace in an empty box takes back the last word
    else if (e.key === 'Backspace' && !input.value && draft[side].length) { draft[side].pop(); changed(); }
  });
  // a typed comma ends a word
  input.addEventListener('input', () => {
    const i = input.value.lastIndexOf(',');
    if (i >= 0) { add(side, input.value.slice(0, i)); input.value = input.value.slice(i + 1).trimStart(); }
  });
  // a pasted list (an input drops its line breaks, so split it here)
  input.addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text') || '';
    if (!/[,\n]/.test(text)) return;
    e.preventDefault();
    add(side, input.value + text);
    input.value = '';
  });
  input.addEventListener('blur', () => { add(side, input.value); input.value = ''; });
}
$('#ed-subject').value = draft.s;
$('#ed-subject').addEventListener('input', () => { draft.s = $('#ed-subject').value.trim(); changed(); });

$('#ed-clear').onclick = () => {
  if (!confirm(T('Start over? The subject and all the words are cleared.'))) return;
  draft = { s: '', y: [], n: [] };
  $('#ed-subject').value = '';
  changed();
};

// ---------- test ----------
const back = () => { $('#dlg-end').close(); cancelAnimationFrame(raf); R = null; screen('editor'); };
$('#ed-test').onclick = () => play('C', structuredClone(draft));
$('#btn-back').onclick = back;
$('#end-home').onclick = back;
$('#btn-edit').onclick = back;

// ---------- share ----------
// The link is made as the draft changes, not on click: Safari only lets a tap copy or share if it does so at once,
// with no await (the gzip) in between. A click before it's ready (a few ms after an edit) just misses.
let shareUrl = '';
async function makeLink() {
  const d = JSON.stringify(draft), url = new URL('play.html#r=' + (await packLink(draft)), location.href).href;
  if (d === JSON.stringify(draft)) shareUrl = url; // an older draft's link, finished late, doesn't win
}
$('#ed-copy').onclick = () => { if (!shareUrl) return; track('copy-link', 'custom'); copyLink(shareUrl, $('#ed-copy')); };
$('#ed-share').onclick = () => {
  if (!shareUrl) return;
  track('share', 'custom');
  if (!navigator.share) return copyLink(shareUrl, $('#ed-share'));
  navigator.share({ title: T('A WordSwipe round: {subject}', { subject: draft.s }), url: shareUrl })
    .catch((e) => { if (e.name !== 'AbortError') copyLink(shareUrl, $('#ed-share')); });
};

render();
