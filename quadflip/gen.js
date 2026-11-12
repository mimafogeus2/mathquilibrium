// Quadflip puzzle engine. An N×N board of two-sided tiles and K tetrominoes (fixed orientation).
// Each piece is stamped once; it flips the four tiles under it. Flip every tile back to its light side.
// Boards are bitmasks (bit r*N+c set = dark). A placement is the top-left cell of the piece's bounding box.
// Every puzzle: exactly one way to place the pieces, and no proper subset of them clears the board
// (so no piece is spare, and no two identical stamps cancel out). Uses rng/int from shared/common.js (a global).

// The 19 fixed tetrominoes as [row, col] cells. I-pieces don't fit a 3×3 board.
const SHAPES = [
  [[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [1, 0], [2, 0], [3, 0]], // I
  [[0, 0], [0, 1], [1, 0], [1, 1]], // O
  [[0, 0], [0, 1], [0, 2], [1, 1]], [[0, 1], [1, 0], [1, 1], [1, 2]], [[0, 0], [1, 0], [1, 1], [2, 0]], [[0, 1], [1, 0], [1, 1], [2, 1]], // T
  [[0, 1], [0, 2], [1, 0], [1, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]], // S
  [[0, 0], [0, 1], [1, 1], [1, 2]], [[0, 1], [1, 0], [1, 1], [2, 0]], // Z
  [[0, 0], [1, 0], [1, 1], [1, 2]], [[0, 0], [0, 1], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2], [1, 2]], [[0, 1], [1, 1], [2, 0], [2, 1]], // J
  [[0, 2], [1, 0], [1, 1], [1, 2]], [[0, 0], [1, 0], [2, 0], [2, 1]], [[0, 0], [0, 1], [0, 2], [1, 0]], [[0, 0], [0, 1], [1, 1], [2, 1]], // L
];
const dims = (s) => [Math.max(...SHAPES[s].map((c) => c[0])) + 1, Math.max(...SHAPES[s].map((c) => c[1])) + 1];

// Board size and how many pieces, per difficulty.
const TIER = { E: { N: 3, K: [3, 4] }, M: { N: 4, K: [4, 5] }, H: { N: 5, K: [6, 7] } };

// Every placement of shape s on an N board: [{ pos, mask }].
function placements(N, s) {
  const [h, w] = dims(s), out = [];
  for (let r = 0; r + h <= N; r++) for (let c = 0; c + w <= N; c++)
    out.push({ pos: r * N + c, mask: SHAPES[s].reduce((m, [dr, dc]) => m | (1 << ((r + dr) * N + c + dc)), 0) });
  return out;
}
const flip = (N, s, pos) => placements(N, s).find((p) => p.pos === pos).mask;

// Ways to clear `board` with these pieces: full = using every piece (ordered, so identical pieces count k! times),
// partial = using a proper subset. Meet in the middle: every skip-or-stamp combo of each half, joined on XOR.
function count(N, pieces, board) {
  const opts = pieces.map((s) => placements(N, s).map((p) => p.mask));
  // each combo of pieces [from, to) as [mask, every piece used?]
  const combos = (from, to) => {
    let out = [[0, true]];
    for (let k = from; k < to; k++) out = out.flatMap(([b, all]) => [[b, false], ...opts[k].map((m) => [b ^ m, all])]);
    return out;
  };
  const mid = pieces.length >> 1, right = new Map(); // mask -> [all used, some skipped]
  for (const [b, all] of combos(mid, pieces.length)) {
    const e = right.get(b) || right.set(b, [0, 0]).get(b);
    e[all ? 0 : 1]++;
  }
  let full = 0, partial = 0;
  for (const [b, all] of combos(0, mid)) {
    const e = right.get(board ^ b);
    if (!e) continue;
    if (all) { full += e[0]; partial += e[1]; } else partial += e[0] + e[1];
  }
  return { full, partial };
}

// Identical pieces can swap places: that many orderings of the one real solution.
const swaps = (pieces) => {
  const seen = {};
  return pieces.reduce((n, s) => n * (seen[s] = (seen[s] || 0) + 1), 1);
};
const valid = (N, pieces, board) => {
  const { full, partial } = count(N, pieces, board);
  return partial === 0 && full === swaps(pieces);
};

// { N, pieces: [shape], sol: [pos] (same order), board }. Pieces are sorted by shape so twins sit together.
function generate(seed, tier) {
  const { N, K } = TIER[tier], rand = rng(seed);
  const fits = SHAPES.map((_, s) => s).filter((s) => placements(N, s).length);
  const k = int(rand, K[0], K[1]); // chosen once: rerolling it per try would let the easier count win almost every time
  for (;;) {
    const pieces = Array.from({ length: k }, () => fits[Math.floor(rand() * fits.length)]).sort((a, b) => a - b);
    const sol = pieces.map((s) => { const ps = placements(N, s); return ps[Math.floor(rand() * ps.length)].pos; });
    const board = pieces.reduce((b, s, i) => b ^ flip(N, s, sol[i]), 0);
    if (valid(N, pieces, board)) return { N, pieces, sol, board };
  }
}

if (typeof module === 'object') module.exports = { SHAPES, TIER, dims, placements, flip, count, swaps, valid, generate };
