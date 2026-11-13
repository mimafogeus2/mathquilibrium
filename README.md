# Games by Miki

Small daily logic games. The root page is a portal; each game lives at its own URL.

**Play:** https://mimafogeus2.github.io/mathquilibrium/

| Game | Path | |
|---|---|---|
| Mathquilibrium | `mathquilibrium/` | A crossword where the numbers are given and you fill in the math. Every row and column must be a true equation. |
| Coronet | `coronet/` | Queens in the round: N rings of N arcs, N colors. One queen per ring, slice and color. Easy 5, Medium 6, Hard 7. |
| WordSwipe | `wordswipe/` | A subject and 24 words against a 60-second fuse: swipe right if the word fits, left if not. One daily round plus unlimited, from 5,000 hand-written rounds. |
| Orderly | `orderly/` | A subject and 10 cards: drag them into order (oldest→newest, mildest→hottest…). Check joins runs of cards in the right order into groups that move as one. One daily (Easy Mon–Tue, Medium Wed–Fri, Hard Sat–Sun; Hebrew follows the Sunday–Saturday week) plus 2,030 levels. |
| Biggr | `biggr/` | Two sums side by side, no answers: pick the bigger one. 10 pairs against the clock (45/70/90s), wrong picks cost 3s, leftover seconds score. Three dailies plus 1,000 seeded levels per difficulty. |
| Quadflip | `quadflip/` | A board of two-sided tiles and a tray of tetrominoes: stamp each piece once, flipping the four tiles under it, until every tile is blank. One answer, and no smaller set of pieces works. Easy 3×3 with 3–4 pieces, Hard 4×4 with 4–5. |
| Alien Chess | `alienchess/` | Chess puzzles on 4×4 to 6×6 boards with pieces dealt fresh each level, their moves drawn on cards. Take the enemy king (or every piece) against a computer that defends its best; each puzzle is a forced win in 2 (Easy) or 3 moves from one first move. Stars for speed. Three dailies plus 1,000 random levels per difficulty. |

Mathquilibrium and Coronet have Easy, Medium and Hard packs of 1,000 seeded levels plus three dailies (Quadflip: Easy and Hard, two dailies), with streaks, sharing, hints, pause, synthesized sound, light/dark themes, touch and keyboard. Coronet deals its levels at random (each with its own link, `#easy-k3f`) instead of unlocking them in order.

## Layout

- `shared/common.js` — seeded RNG, hash, tiers and pack size (no DOM; tests `require()` it)
- `shared/core.js`, `shared/core.css` — the shell: home menu, dailies, levels, timer, pause, win, share, sound, confetti
- `orderly/levels.js` — the level pool, one `difficulty|Subject|top|bottom|Name=Value;...` line each, cards in the right order
- `wordswipe/rounds.js` — the round pool, one `Subject|fits,...|doesn't,...` line each; `wordswipe/game.js` uses core.js helpers but not `boot()`
- `orderly/special.js`, `wordswipe/special.js` — special days: `YYYY-MM-DD|Occasion|puzzle line` replaces that date's daily with a themed one. Each date is used once ever: a small day gets one line, a big holiday one per year, and small days sharing a date take turns by year
- `orderly/editor.html` — make a level (draft kept in localStorage); its link opens `orderly/play.html#l=…`, a play-only page that records nothing. `orderly/custom.js` checks a level's shape; `shared/link.js` packs any JSON into a URL hash (gzip + base64url)
- `<game>/gen.js` — the generator; `<game>/game.js` — the board, calling `boot({ ... })`

## Translations

Hebrew lives at `/he/` (`/he/orderly/`…), right to left. The English pages are the source; the translated ones are generated:

- `i18n/he.js` — the Hebrew text: strings the scripts look up with `T('…')` (grouped by script), and `[English, Hebrew]` replacements for each page's HTML
- `node build.js` writes `he/index.html` and `he/<game>/index.html` (committed, so Pages needs no build step). Each page gets its strings inlined, `lang="he" dir="rtl"`, the Hebrew fonts, and paths back to the shared English scripts and styles. It fails if a replacement no longer matches the English, a `T('…')` string has no translation, or English is left on a page — so after changing a page or a string, run it and fill in what it reports
- `he/orderly/levels.js`, `he/orderly/special.js`, `he/wordswipe/rounds.js`, `he/wordswipe/special.js` — the Hebrew puzzles, written for Israeli players (same formats as the English ones). A file here replaces the English one of the same name; every other file is shared
- Layout uses logical CSS (`inset-inline-start`, `padding-inline`, `text-align: start`), so one stylesheet serves both directions. Math (boards, sums, the swipe buttons) stays left to right: see `direction: ltr` in the game styles
- Word games keep separate progress per language (`orderly-he`, `wordswipe-he`); the math games share theirs
- Share images: `he/og.png` and `he/<game>/og.png`, rendered from `shared/og.html?g=<game>&lang=he` (see the comment at its top); `build.js` points a Hebrew page at its image when one exists

## Run locally

No build step for the English pages (Hebrew: `node build.js`, see above). Serve the folder:

```sh
python3 -m http.server
```

Generator checks (all 3,000 levels of each game): `node mathquilibrium/test.js && node coronet/test.js && node wordswipe/test.js && node orderly/test.js && node biggr/test.js && node quadflip/test.js && node alienchess/test.js` (Alien Chess checks 150 levels a difficulty by default: `node alienchess/test.js 1000` for all)

Hebrew: `node build.js --check && node wordswipe/test.js he && node orderly/test.js he`
