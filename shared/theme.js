'use strict';
// Paper stock: light (cream) or dark (blue). Auto follows the system; .js-theme buttons cycle auto → light → dark.
// Loaded in <head>, before the body paints, so the page never flashes the wrong stock. Shared across games (same origin).
(() => {
  const root = document.documentElement, mq = matchMedia('(prefers-color-scheme: dark)');
  const ICONS = {
    auto: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
    light: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
    // the stars sit in the moon's bite; core.css scales them in when the moon rises
    dark: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/><path class="star" style="--i:0" d="M17 3v3M15.5 4.5h3"/><path class="star" style="--i:1" d="M20.6 9.2h.01"/><path class="star" style="--i:2" d="M14.6 8.4h.01"/></svg>',
  };
  const pref = () => { try { return localStorage.getItem('theme') || 'auto'; } catch { return 'auto'; } };
  function apply() {
    const p = pref(), dark = p === 'dark' || (p === 'auto' && mq.matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1d2a55' : '#f3ede1');
    const label = (typeof I18N === 'object' && I18N[`Theme: ${p}`]) || `Theme: ${p}`; // core.js's T() isn't loaded yet
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
      try { next === 'auto' ? localStorage.removeItem('theme') : localStorage.setItem('theme', next); } catch {}
      // the old icon sets like a sun as the new one rises, and the new stock wipes out from the button like a fresh sheet laid over
      const old = b.querySelector('svg:not(.set)'), swap = () => {
        apply();
        b.firstElementChild.classList.add('rise');
        if (old) { old.classList.remove('rise'); old.classList.add('set'); b.prepend(old); old.addEventListener('animationend', () => old.remove(), { once: true }); setTimeout(() => old.remove(), 600); }
      };
      if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return swap();
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
    const T = (s) => (typeof I18N === 'object' && I18N[s]) || s;
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
  });
})();
