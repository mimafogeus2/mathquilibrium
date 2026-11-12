# Puzzle Shelf

Small daily logic games. The root page is a portal; each game lives at its own URL.

**Play:** https://mimafogeus2.github.io/mathquilibrium/

| Game | Path | |
|---|---|---|
| Mathquilibrium | `mathquilibrium/` | A crossword where the numbers are given and you fill in the math. Every row and column must be a true equation. |
| Coronet | `coronet/` | Queens in the round: N rings of N arcs, N colors. One queen per ring, slice and color. Easy 5, Medium 6, Hard 7. |
| WordSwipe | `wordswipe/` | A subject and 24 words against a 60-second fuse: swipe right if the word fits, left if not. One daily round plus unlimited, from 5,000 hand-written rounds. |
| Orderly | `orderly/` | A subject and 10 cards: drag them into order (oldest→newest, mildest→hottest…). Check joins runs of cards in the right order into groups that move as one. One daily plus 2,030 levels. |
| Biggr | `biggr/` | Two sums side by side, no answers: pick the bigger one. 10 pairs against the clock (45/70/90s), wrong picks cost 3s, leftover seconds score. Three dailies plus 1,000 seeded levels per difficulty. |

Mathquilibrium and Coronet have Easy, Medium and Hard packs of 1,000 seeded levels plus three dailies, with streaks, sharing, hints, pause, synthesized sound, light/dark themes, touch and keyboard.

## Layout

- `shared/common.js` — seeded RNG, hash, tiers and pack size (no DOM; tests `require()` it)
- `shared/core.js`, `shared/core.css` — the shell: home menu, dailies, levels, timer, pause, win, share, sound, confetti
- `orderly/levels.js` — the level pool, one `difficulty|Subject|top|bottom|Name=Value;...` line each, cards in the right order
- `wordswipe/rounds.js` — the round pool, one `Subject|fits,...|doesn't,...` line each; `wordswipe/game.js` uses core.js helpers but not `boot()`
- `orderly/special.js`, `wordswipe/special.js` — special days: `YYYY-MM-DD|Occasion|puzzle line` replaces that date's daily with a themed one. Each date is used once ever: a small day gets one line, a big holiday one per year, and small days sharing a date take turns by year
- `<game>/gen.js` — the generator; `<game>/game.js` — the board, calling `boot({ ... })`

## Run locally

No build step. Serve the folder:

```sh
python3 -m http.server
```

Generator checks (all 3,000 levels of each game): `node mathquilibrium/test.js && node coronet/test.js && node wordswipe/test.js && node orderly/test.js && node biggr/test.js`
