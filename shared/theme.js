'use strict';
// Paper stock: light (cream) or dark (blue). Auto follows the system; .js-theme buttons cycle auto → light → dark.
// Loaded in <head>, before the body paints, so the page never flashes the wrong stock. Shared across games (same origin).
(() => {
  const root = document.documentElement, mq = matchMedia('(prefers-color-scheme: dark)');
  const ICONS = {
    auto: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
    light: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
    dark: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>',
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
      apply();
    });
    apply();
  });
})();
