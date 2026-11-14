'use strict';
// Paper stock: light (cream) or dark (blue). Auto follows the system; .js-theme buttons cycle auto → light → dark.
// Settings: high contrast, reduce motion, text & tile size (see the bottom), set on <html> here too.
// Loaded in <head>, before the body paints, so the page never flashes the wrong stock. Shared across games (same origin).
(() => {
  const root = document.documentElement, mq = matchMedia('(prefers-color-scheme: dark)');
  const T = (s) => (typeof I18N === 'object' && I18N[s]) || s; // core.js's T() isn't loaded yet
  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const put = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
  const ICONS = {
    auto: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
    light: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
    // the stars sit in the moon's bite; core.css scales them in when the moon rises
    dark: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/><path class="star" style="--i:0" d="M17 3v3M15.5 4.5h3"/><path class="star" style="--i:1" d="M20.6 9.2h.01"/><path class="star" style="--i:2" d="M14.6 8.4h.01"/></svg>',
  };
  const pref = () => get('theme') || 'auto';
  function apply() {
    const p = pref(), dark = p === 'dark' || (p === 'auto' && mq.matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1d2a55' : '#f3ede1');
    const label = T(`Theme: ${p}`);
    for (const b of document.querySelectorAll('.js-theme')) {
      b.innerHTML = ICONS[p];
      b.setAttribute('aria-label', label);
      b.title = label;
    }
  }
  mq.addEventListener('change', apply);
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    for (const b of document.querySelectorAll('.js-theme')) b.addEventListener('click', () => {
      const next = { auto: 'light', light: 'dark', dark: 'auto' }[pref()];
      put('theme', next === 'auto' ? null : next);
      // the old icon sets like a sun as the new one rises, and the new stock wipes out from the button like a fresh sheet laid over
      const old = b.querySelector('svg:not(.set)'), swap = () => {
        apply();
        b.firstElementChild.classList.add('rise');
        if (old) { old.classList.remove('rise'); old.classList.add('set'); b.prepend(old); old.addEventListener('animationend', () => old.remove(), { once: true }); setTimeout(() => old.remove(), 600); }
      };
      if (!document.startViewTransition || root.hasAttribute('data-calm')) return swap();
      const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      root.classList.add('paper-swap');
      const vt = document.startViewTransition(swap);
      vt.ready.then(() => root.animate({ clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${far}px at ${x}px ${y}px)`] },
        { duration: 450, easing: 'cubic-bezier(.2, .8, .2, 1)', pseudoElement: '::view-transition-new(root)' })).catch(() => {});
      vt.finished.finally(() => root.classList.remove('paper-swap'));
    });
    apply();

    // .js-fav: browsers don't let pages add bookmarks, so the star shows how to on this device
    // ponytail: UA sniffing for the hint only; a wrong guess just shows the desktop shortcut
    const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const hint = ios ? T('Tap Share, then Add to Home Screen')
      : matchMedia('(pointer: coarse)').matches ? T('Open the browser menu and tap ☆ or Add to Home screen')
      : /Mac/.test(ua) ? T('Press ⌘D to bookmark this page') : T('Press Ctrl+D to bookmark this page');
    for (const b of document.querySelectorAll('.js-fav')) {
      const tip = Object.assign(document.createElement('div'), { className: 'fav-tip', textContent: hint, popover: 'auto', id: 'fav-tip' });
      b.after(tip);
      b.setAttribute('popovertarget', 'fav-tip');
      b.title = b.getAttribute('aria-label');
      b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>';
    }
    settings();
  });

  // ---------- settings ----------
  // High contrast (data-contrast: plain paper, no grain, speckle or misregistration, darker greys) and reduce motion (data-calm)
  // follow the system until set here; a choice that matches the system is forgotten, so it follows the system again.
  // Text & tile size zooms the whole page (--scale; core.css divides it back out of viewport units: --vw, --dvh).
  const SYS = { contrast: matchMedia('(prefers-contrast: more)'), motion: matchMedia('(prefers-reduced-motion: reduce)') };
  const ATTR = { contrast: 'data-contrast', motion: 'data-calm' };
  const SIZES = { 1: 'Normal', 1.15: 'Large', 1.3: 'Larger' };
  const isOn = (k) => (get(k) ?? String(SYS[k].matches)) === 'true';
  // WebKit applies a zoom to container query units (cqw, cqi…) a second time, Chromium doesn't: --cq undoes it where needed,
  // so styles write them as 100cqw * var(--cq). Measured, not sniffed: a 100px container zoomed 2×, is its 50cqw 50px or 100px?
  let cqTwice;
  const zoomsCqTwice = () => cqTwice ??= (() => {
    const t = document.createElement('div');
    t.style.cssText = 'container-type: inline-size; width: 100px; zoom: 2; position: absolute; visibility: hidden';
    t.innerHTML = '<div style="width: 50cqw"></div>';
    root.append(t);
    const w = parseFloat(getComputedStyle(t.firstChild).width);
    t.remove();
    return w > 75;
  })();
  function prefs() {
    for (const k in ATTR) root.toggleAttribute(ATTR[k], isOn(k));
    const s = SIZES[get('size')] ? +get('size') : 1;
    root.style.setProperty('--scale', s);
    root.style.setProperty('--cq', s !== 1 && zoomsCqTwice() ? 1 / s : 1);
  }
  let sync = () => {}; // the open Settings' switches, set by settings()
  for (const k in SYS) SYS[k].addEventListener('change', () => { prefs(); sync(); });
  prefs();
  // reduced motion also skips the page-to-page cross-fade (core.css's @view-transition can't see data-calm)
  for (const ev of ['pageswap', 'pagereveal']) addEventListener(ev, (e) => root.hasAttribute('data-calm') && e.viewTransition?.skipTransition());

  // Progress lives in this browser's localStorage, one key per game (plus editor drafts: orderly-editor, wordswipe-draft).
  // ponytail: a new game adds its storeKey here, or export and reset miss it
  const GAMES = /^(crossum2|coronet|wordswipe|orderly|biggr|quadflip|alienchess|balancingact)(-|$)/;
  const PREFS = ['theme', 'contrast', 'motion', 'size', 'muted'];
  const keys = () => { try { return Object.keys(localStorage).filter((k) => GAMES.test(k) || PREFS.includes(k)); } catch { return []; } };
  const progress = () => keys().filter((k) => GAMES.test(k));

  function settings() {
    if (!document.querySelector('.js-theme')) return;
    const dlg = document.createElement('dialog');
    dlg.id = 'dlg-settings';
    const sw = (k, title, sub) => `<label class="set-row"><span><b>${T(title)}</b><small>${T(sub)}</small></span><input type="checkbox" class="switch" role="switch" data-k="${k}"></label>`;
    dlg.innerHTML = `<h2>${T('Settings')}</h2>
      <div class="set-list">
        ${sw('contrast', 'High contrast', 'Plain paper: no grain or misprints, darker text')}
        ${sw('motion', 'Reduce motion', 'No confetti, flips or sliding')}
        <div class="set-row col"><b id="set-size">${T('Text & tile size')}</b>
          <div class="seg" role="radiogroup" aria-labelledby="set-size">${Object.entries(SIZES).map(([v, n]) =>
            `<label><input type="radio" name="size" value="${v}">${T(n)}</label>`).join('')}</div></div>
        <div class="set-row col"><span><b>${T('Your progress')}</b><small>${T('Kept in this browser only. Export it to keep a copy or move it to another device.')}</small></span>
          <div class="row"><button class="btn ghost" id="set-export"><b>${T('Export')}</b></button><button class="btn ghost" id="set-import"><b>${T('Import')}</b></button></div>
          <button class="give-up" id="set-reset">${T('Reset all progress')}</button></div>
      </div>
      <input type="file" accept=".json,application/json" hidden>
      <form method="dialog"><button class="btn primary center"><b>${T('Done')}</b></button></form>`;
    document.body.append(dlg);
    const $ = (s) => dlg.querySelector(s);

    sync = () => {
      for (const c of dlg.querySelectorAll('.switch')) c.checked = isOn(c.dataset.k);
      for (const r of dlg.querySelectorAll('[name=size]')) r.checked = +r.value === (+get('size') || 1);
    };
    for (const c of dlg.querySelectorAll('.switch')) c.onchange = () => { put(c.dataset.k, c.checked === SYS[c.dataset.k].matches ? null : String(c.checked)); prefs(); };
    for (const r of dlg.querySelectorAll('[name=size]')) r.onchange = () => { put('size', r.value === '1' ? null : r.value); prefs(); dispatchEvent(new Event('resize')); };

    // The page's own game still holds the old progress and saves it on the way out (pagehide), which would undo the change:
    // nothing more is written from this page. ponytail: another open game tab can still write back its own copy
    const reload = () => { Storage.prototype.setItem = () => {}; location.reload(); };
    $('#set-export').onclick = () => {
      const data = Object.fromEntries(keys().map((k) => [k, get(k)]));
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([JSON.stringify({ app: 'games-by-miki', v: 1, data })], { type: 'application/json' })),
        download: `games-by-miki-${new Date().toISOString().slice(0, 10)}.json`,
      });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    const file = $('input[type=file]');
    $('#set-import').onclick = () => file.click();
    file.onchange = async () => {
      const f = file.files[0];
      file.value = '';
      if (!f) return;
      let d;
      try { d = JSON.parse(await f.text()); } catch {}
      const data = d?.app === 'games-by-miki' && d.data && typeof d.data === 'object' ? d.data : null;
      const ok = data && Object.entries(data).filter(([k, v]) => (GAMES.test(k) || PREFS.includes(k)) && typeof v === 'string');
      if (!ok?.length) return alert(T("That file isn't a Games by Miki export."));
      if (!confirm(T('Replace the progress in this browser with the one in this file?'))) return;
      for (const k of progress()) put(k);
      for (const [k, v] of ok) put(k, v);
      reload();
    };
    $('#set-reset').onclick = () => {
      if (!confirm(T("Erase all progress, streaks and saved games, in every game? This can't be undone. (Export first to keep a copy.)"))) return;
      for (const k of progress()) put(k);
      reload();
    };

    const ICON = '<svg viewBox="0 0 24 24"><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/></svg>';
    for (const t of document.querySelectorAll('.js-theme')) {
      const b = Object.assign(document.createElement('button'), { className: 'icon js-settings', innerHTML: ICON, title: T('Settings') });
      b.setAttribute('aria-label', T('Settings'));
      b.onclick = () => { sync(); dlg.showModal(); };
      // beside the theme button; on a game's home, beside the back arrow instead (core.css), clear of the logo the right-hand icons crowd
      const back = t.closest('.corner')?.parentElement.querySelector(':scope > .corner-start');
      if (back) { b.classList.add('corner-start'); back.after(b); } else t.after(b);
    }
  }
})();
