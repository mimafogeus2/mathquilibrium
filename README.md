# Games by Miki

Small daily logic games. The root page is a portal; each game lives at its own URL.

**Play:** https://mimafogeus2.github.io/mathquilibrium/

| Game | Path | |
|---|---|---|
| Mathquilibrium | `mathquilibrium/` | A crossword where the numbers are given and you fill in the math. Every row and column must be a true equation. |
| Coronet | `coronet/` | Queens in the round: N rings of N arcs, N colors. One queen per ring, slice and color. Easy 5, Medium 6, Hard 7. |
| WordSwipe | `wordswipe/` | A subject and 24 words against a 60-second fuse: swipe right if the word fits, left if not. One daily round plus unlimited, from a pool of 2,538 rounds. |
| Orderly | `orderly/` | A subject and 10 cards: drag them into order (oldest→newest, mildest→hottest…). Check joins runs of cards in the right order into groups that move as one. One daily (Easy Mon–Tue, Medium Wed–Fri, Hard Sat–Sun; Hebrew follows the Sunday–Saturday week) plus 2,030 levels. |
| Biggr | `biggr/` | Two sums side by side, no answers: pick the bigger one. 10 pairs against the clock (45/70/90s), wrong picks cost 3s, leftover seconds score. Three dailies plus 1,000 seeded levels per difficulty. |
| Quadflip | `quadflip/` | A board of two-sided tiles and a tray of tetrominoes: stamp each piece once, flipping the four tiles under it, until every tile is blank. One answer, and no smaller set of pieces works. Easy 3×3 with 3–4 pieces, Hard 4×4 with 4–5. |
| Alien Chess | `alienchess/` | Chess puzzles on 4×4 to 6×6 boards with pieces dealt fresh each level, their moves drawn on cards. Take the enemy king (or every piece) against a computer that defends its best; each puzzle is a forced win in 2 (Easy) or 3 moves from one first move. Stars for speed. Three dailies plus 1,000 random levels per difficulty. |
| Balancing Act | `balancingact/` | A hanging contraption of beams (arm lengths written on them) and a store of whole weights from 1 to 10: hang every item on a plate until every beam is level. Each plate's target follows from the arms and the store's total; the store splits into them one way only. Medium adds balloons (−1 to −10) tied to plates, Hard loose balloons and up to 8 plates. Stars for moves: three within one of the fewest. Three dailies plus 1,000 random levels per difficulty. |
| Small Fry | `smallfry/` | A side-view tank of fish: each looks straight ahead and swims for the first thing it sees and wants (a bigger fish eats a smaller one, and lunges at one swimming into its look); the fry wants the exit or bait; patrollers swim back and forth on a rail whenever anything moves. Place every item in hand (mirrors, flat mirrors on rock faces, bait) where some fish is looking; after each one the fish act. Every answer uses the whole hand and every fish has a job. Levels are built as stories: the simplest escape, then complications that each break it and cost one more item (see `smallfry/gen.js`). Three dailies plus 1,000 levels per difficulty, pregenerated (`smallfry/build-levels.js` → `smallfry/levels.js`). |
| Lexiconga | `lexiconga/` | A start word and a box of 10 words: type a word that starts with the chain's last letter and ends with the first letter of a box word, and the computer adds that word. Link all 10 into one long word. Connectors get longer with the tier (at least 3/3/4 letters, Impossible 5; Hebrew one less) and the box words rarer; the levels are graded by their easiest route's scarcest link. Unlimited undo, one hint (a star), stars for speed. English and Hebrew, each with its own word lists (`lexiconga/build-words.js`, credits in `lexiconga/CREDITS.md`). Three dailies, and a random practice level per difficulty (no packs or counters: a random game without `#pack-btns` practises from its New puzzle row, see `renderHome()` in core.js). |

Mathquilibrium and Coronet have Easy, Medium and Hard packs of 1,000 seeded levels plus three dailies (Quadflip: Easy and Hard, two dailies), with streaks, sharing, hints, pause, synthesized sound, light/dark themes, touch and keyboard. Coronet deals its levels at random (each with its own link, `#easy-k3f`) instead of unlocking them in order.

## Impossible Mode

Hidden: hover the bottom-right corner of the front page or a game's menu (on touch, tap it twice) and the page peels back over fire. Clicking it turns Impossible Mode on (localStorage `impossible`, never in the URL) until the peel is clicked again. Every game then offers one Impossible daily instead of its regular ones, with its own progress and streak (`<storeKey>-impossible`), no hints, and pentagrams for stars:

| Game | Impossible daily |
|---|---|
| Mathquilibrium | 13×13, no operators given, plus `√` (root: `3 √ 8 = 2`), `↑` (max) and `↓` (min) |
| Coronet | 9 rings, every color at least 3 arcs |
| Quadflip | 4×4 with 6 pieces |
| Alien Chess | a forced win in 4 on 6×6, built in a background worker (`shared/pregen.js`) as any Impossible page opens |
| Balancing Act | 7–9 plates, tied and loose balloons together |
| Biggr | the two sums 1–2 apart (squares, powers, bigger products); a wrong pick costs 5s |
| Orderly | a Hard level and only 3 checks: miss with the third and the day is lost |
| Small Fry | a 12×12 tank, four or five complications, 6–7 items |
| Lexiconga | 8+ letter box words, connectors of 5+ letters (Hebrew 4+), mostly rare links |
| WordSwipe | a Reversed light that may switch every 2–3 words; while it's on, answer the other way round |

In the code: `theme.js` (the peel, the fire, `data-impossible`), `core.js` (`IMP`, `goImpossible()`, `offDailies()`, `impossibleIntro()`), `core.css` (the scorched stock), and tier `I` in each `gen.js`.

## Layout

- `shared/common.js` — seeded RNG, hash, tiers and pack size (no DOM; tests `require()` it)
- `shared/core.js`, `shared/core.css` — the shell: home menu, dailies, levels, timer, pause, win, share, sound, confetti
- Tutorials: each game's menu has a **Tutorial** link (and `#tutorial`) that plays a tiny fixed puzzle with a coach line under the bar, one step at a time, ringing what to touch next. Nothing is saved. `coach(steps)` in core.js runs it; a `boot()` game passes `tutorial: [[html, done(), target], …]` and builds its tutorial puzzle in `start` when `G.tut` is set (Orderly, WordSwipe and Biggr call `tutorialLink()`, `coach()` and `coachEnd()` themselves)
- `shared/theme.js` — runs in `<head>` before paint: the light/dark theme and Settings (the sliders icon beside the theme button, or beside the back arrow on a game's home): high contrast and reduce motion (both follow the system until changed), text & tile size, and progress export/import/reset. Sound is one setting for all games, on the speaker icon. A new game adds its `storeKey` to `GAMES` there, or export and reset miss it
- Text & tile size zooms the whole page (CSS `zoom`), so styles write viewport units as `calc(100 * var(--vw))` / `var(--dvh)` (not `vw`/`dvh`), container units as `100cqw * var(--cq, 1)` (WebKit zooms those twice), and divide pointer distances by `pageScale()` (core.js). Width breakpoints that should follow the text size are `@container` queries (see the hub page); `@media` sees the window, not the zoomed page
- `orderly/levels.js` — the level pool, one `difficulty|Subject|top|bottom|Name=Value;...` line each, cards in the right order
- `wordswipe/rounds.js` — the round pool, one `Subject|fits,...|doesn't,...` line each; `wordswipe/game.js` uses core.js helpers but not `boot()`
- `wordswipe/editor.html` — make your own round and share it; `wordswipe/play.html#r=…` plays a shared one (nothing saved, no streaks). The round travels in the link: `shared/link.js` gzips JSON into base64url, `wordswipe/custom.js` checks it
- `orderly/special.js`, `wordswipe/special.js` — special days: `YYYY-MM-DD|Occasion|puzzle line` replaces that date's daily with a themed one. Each date is used once ever: a small day gets one line, a big holiday one per year, and small days sharing a date take turns by year
- `orderly/editor.html` — make a level (draft kept in localStorage); its link opens `orderly/play.html#l=…`, a play-only page that records nothing. `orderly/custom.js` checks a level's shape; `shared/link.js` packs any JSON into a URL hash (gzip + base64url)
- `print.html` — today's printable dailies as an A5 zine (the front page's printer icon): each game's page loads in a hidden frame and hands over its print sheets (`printable()` / `paper()` in core.js); each puzzle gets the smallest of a quarter, half or whole page it fits at a readable size, answers at the back. Two pages per A4 sheet, printed one side, folded and stapled
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

Generator checks (all 3,000 levels of each game): `node mathquilibrium/test.js && node coronet/test.js && node wordswipe/test.js && node orderly/test.js && node biggr/test.js && node quadflip/test.js && node alienchess/test.js && node balancingact/test.js && node smallfry/test.js && node lexiconga/test.js` (Alien Chess checks 150 levels a difficulty by default: `node alienchess/test.js 1000` for all; Small Fry checks 40 levels and 10 dailies per difficulty: `node smallfry/test.js all` for all)

Small Fry's levels are pregenerated, since proving one has a single answer takes seconds on Hard: `node smallfry/build-levels.js [packs] [days] [impossible days] [workers]` (defaults 1000, 365, 60, 6) writes `smallfry/levels.js` from seeded keys, so a rerun with bigger numbers adds levels and keeps the existing ones. Each level is saved to `smallfry/levels-cache.txt` (git-ignored) as it's made, so a stopped run resumes where it left off. A daily past the built range falls back to a pack level picked by the date.

Lexiconga's word lists are built from downloaded sources (see the top of `lexiconga/build-words.js`): `node lexiconga/build-words.js <scowl final/> <en_50k.txt> <he_full.txt>` rewrites the typing lists, which may grow; `--gen` also rewrites `gen-words.js`, which every level is dealt from, so it changes every level and daily.

Hebrew: `node build.js --check && node wordswipe/test.js he && node orderly/test.js he`
