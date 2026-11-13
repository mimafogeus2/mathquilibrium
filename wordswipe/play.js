'use strict';
// play.html: plays the made-up round in the link (#r=<packLink({ s, y, n })>). Nothing here touches the daily, streaks or scores.
let round = null;
const intro = () => { cancelAnimationFrame(raf); R = null; screen('intro'); };

async function load() {
  try {
    round = await unpackLink(new URLSearchParams(location.hash.slice(1)).get('r') || '');
    if (roundProblems(round).length) throw new Error('not a round');
  } catch {
    round = null;
    document.title = game.name;
    cancelAnimationFrame(raf);
    R = null;
    return screen('broken');
  }
  document.title = `${round.s} · ${game.name}`;
  $('#intro-subject').textContent = round.s;
  intro();
}

$('#btn-play').onclick = () => play('C', round);
$('#btn-back').onclick = intro;
$('#btn-help').onclick = () => $('#dlg-help').showModal();
// a new link pasted into this tab: read it afresh
addEventListener('hashchange', load);
load();
