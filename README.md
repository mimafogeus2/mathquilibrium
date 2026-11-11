# Puzzle Shelf

Small daily logic games. The root page is a portal; each game lives at its own URL.

**Play:** https://mimafogeus2.github.io/mathquilibrium/

| Game | Path | |
|---|---|---|
| Mathquilibrium | `mathquilibrium/` | A crossword where the numbers are given and you fill in the math. Every row and column must be a true equation. |
| Coronet | `coronet/` | Queens in the round: N rings of N arcs, N colors. One queen per ring, slice and color. Easy 6, Medium 8, Hard 10. |

Every game has Easy, Medium and Hard packs of 1,000 seeded levels plus three dailies (the same for everyone), with streaks, sharing, hints, pause, synthesized sound, light/dark themes, touch and keyboard.

## Layout

- `shared/common.js` — seeded RNG, hash, tiers and pack size (no DOM; tests `require()` it)
- `shared/core.js`, `shared/core.css` — the shell: home menu, dailies, levels, timer, pause, win, share, sound, confetti
- `<game>/gen.js` — the generator; `<game>/game.js` — the board, calling `boot({ ... })`

## Run locally

No build step. Serve the folder:

```sh
python3 -m http.server
```

Generator checks (all 3,000 levels of each game): `node mathquilibrium/test.js && node coronet/test.js`
