// Alien Chess engine. An N×N board, cells r*N+c, row 0 at the top (the computer's side). A cell holds 0 (empty),
// t+1 (your piece of type t) or -(t+1) (the computer's). Each level deals new piece types: a look from LOOKS, and
// moves made of rules { k: 'leap' | 'slide', v: [[dr, dc]], n: reach (slides), m: 'any' | 'move' | 'cap' }.
// Vectors are yours (dr < 0 = forward, up the board); the computer's pieces use them upside down.
// You win by taking the enemy king (if it has one) or every enemy piece, and only so. A side with no legal move passes.
// Every puzzle: you move first and can force a win in exactly `K` moves against any defence (and not in fewer).
// Uses rng/int/pick/hash from shared/common.js (globals).

// The looks: art in game.js, names translated there. Moves are dealt per level; a look is only its costume.
const LOOKS = ['Bloorp', 'Zib', 'Gromf', 'Quizzle', 'Thrubb', 'Yeep', 'Vonk', 'Splorg', 'Snee', 'Mibbix', 'Durfle', 'Oomba'];

const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]], DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]], ALL = [...ORTHO, ...DIAG];
const sym8 = (a, b) => [...new Set([[a, b], [b, a]].flatMap(([x, y]) => [[x, y], [-x, y], [x, -y], [-x, -y]]).map(String))].map((s) => s.split(',').map(Number));
// The building blocks. A piece gets one or two; a 'split' one moves one way and takes another.
const RULES = [
  { k: 'slide', v: ALL, n: 1 }, { k: 'slide', v: ORTHO, n: 1 }, { k: 'slide', v: DIAG, n: 1 },
  { k: 'slide', v: ORTHO, n: 9 }, { k: 'slide', v: DIAG, n: 9 }, { k: 'slide', v: ORTHO, n: 2 }, { k: 'slide', v: DIAG, n: 2 }, { k: 'slide', v: ALL, n: 2 },
  { k: 'leap', v: sym8(1, 2) }, { k: 'leap', v: sym8(1, 3) }, { k: 'leap', v: sym8(2, 3) },
  { k: 'leap', v: sym8(0, 2) }, { k: 'leap', v: sym8(2, 2) }, { k: 'leap', v: [...sym8(0, 2), ...sym8(2, 2)] },
  { k: 'slide', v: [[-1, -1], [-1, 0], [-1, 1]], n: 1 }, { k: 'slide', v: [[-1, 0]], n: 9 }, { k: 'slide', v: [[0, -1], [0, 1]], n: 9 },
  { k: 'leap', v: [[-2, -1], [-2, 1]] }, { k: 'leap', v: [[-1, -2], [-1, 2], [-2, 0]] }, { k: 'slide', v: [[-1, -1], [-1, 1], [1, 0]], n: 9 },
  { k: 'leap', v: [[-3, 0], [0, -3], [0, 3], [3, 0]] }, { k: 'slide', v: [[-1, 0], [1, 1], [1, -1]], n: 1 },
];
const TIER = {
  E: { N: 4, K: 2, types: [2, 2], units: [2, 3] },
  M: { N: 5, K: 3, types: [2, 3], units: [2, 3] },
  H: { N: 6, K: 3, types: [3, 3], units: [3, 4] },
};

// A piece type's moves: one or two rules; sometimes it moves with one and only takes with the other.
function dealType(rand) {
  const a = pick(rand, RULES), roll = rand();
  if (roll < 0.25) { const b = pick(rand, RULES.filter((r) => r !== a)); return [{ ...a, m: 'move' }, { ...b, m: 'cap' }]; }
  if (roll < 0.55) { const b = pick(rand, RULES.filter((r) => r !== a)); return [{ ...a, m: 'any' }, { ...b, m: 'any' }]; }
  return [{ ...a, m: 'any' }];
}

// Every legal move of `side` (1 = you, -1 = the computer) as [from, to].
function moves(p, b, side) {
  const N = p.N, out = [];
  for (let i = 0; i < b.length; i++) {
    if (b[i] * side <= 0) continue;
    const r0 = (i / N) | 0, c0 = i % N, tos = []; // tos: this piece's targets so far, as two rules can reach the same square
    for (const rule of p.types[Math.abs(b[i]) - 1].rules) {
      const steps = rule.k === 'leap' ? 1 : Math.min(rule.n, N);
      for (const [dr, dc] of rule.v) for (let s = 1; s <= steps; s++) {
        const r = r0 + dr * s * side, c = c0 + dc * s, j = r * N + c;
        if (r < 0 || r >= N || c < 0 || c >= N || b[j] * side > 0) break; // off the board, or your own piece
        if ((b[j] ? rule.m !== 'move' : rule.m !== 'cap') && !tos.includes(j)) { tos.push(j); out.push([i, j]); }
        if (b[j]) break; // a slide stops at the first piece
      }
    }
  }
  return out;
}
// A move, or null: a pass (by a side with no legal move)
const play = (b, m) => { if (!m) return b; const [f, t] = m, n = b.slice(); n[t] = n[f]; n[f] = 0; return n; };
// Has `side` lost on this board? Its king (if its army has one) is gone, or every piece is.
function lost(p, b, side) {
  let any = false, king = false;
  for (const x of b) if (x * side > 0) { any = true; if (p.types[Math.abs(x) - 1].king) king = true; }
  return !any || (p.king[side > 0 ? 0 : 1] && !king);
}

// Can `side` (to move; 1 = you, -1 = the computer) force a win within k of its moves? memo: board+k+side -> bool.
function wins(p, b, k, memo = new Map(), side = 1) {
  const key = b.join() + '/' + k + side;
  if (memo.has(key)) return memo.get(key);
  let ok = false;
  for (const m of moves(p, b, side)) {
    if (forces(p, play(b, m), k, memo, side)) { ok = true; break; }
  }
  memo.set(key, ok);
  return ok;
}
// Your moves that still force a win in k (used by the generator, the reveal, and the test).
const winning = (p, b, k, memo = new Map()) => moves(p, b, 1).filter((m) => forces(p, play(b, m), k, memo));
// After `side`'s move to `a`: is it won (the other king or army gone), or won within k-1 more moves whatever the reply?
// A side with no move passes. ponytail: the attacker never passes here (no move = no win), so a puzzle never needs you to.
function forces(p, a, k, memo, side = 1) {
  if (lost(p, a, -side)) return true;
  if (k === 1) return false;
  const replies = moves(p, a, -side);
  if (!replies.length) return wins(p, a, k - 1, memo, side);
  return replies.every((r) => { const c = play(a, r); return !lost(p, c, side) && wins(p, c, k - 1, memo, side); });
}

// The computer's reply. First it holds out: never a move that lets you force a win sooner than you otherwise could
// (searched 3 of your moves deep), so on the puzzle's line it always finds the toughest defence. Then it attacks:
// it takes your king (or last piece) at once if it can, else prefers a move that forces that within 2 more of its moves
// whatever you do. Then it keeps the most pieces. Deterministic: ties go to the first move in board order.
function reply(p, b) {
  const ms = moves(p, b, -1);
  if (!ms.length) return null;
  const memo = new Map();
  let best = null, bestScore = -Infinity;
  for (const m of ms) {
    const a = play(b, m);
    let score;
    if (lost(p, a, 1)) score = 1e6;
    else {
      let d = 1; // how soon you could force a win from here: later is better. ponytail: 3 deep, plenty for these boards
      while (d <= 3 && !wins(p, a, d, memo)) d++;
      let e = 0; // how soon it forces a win itself (in 1 or 2 more of its moves): sooner is better
      if (d > 3) e = forces(p, a, 2, memo, -1) ? 2 : forces(p, a, 3, memo, -1) ? 1 : 0;
      score = d * 1000 + e * 100 + a.reduce((s, x) => s - Math.sign(x), 0);
    }
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

// { N, K, types: [{ look, rules, king }], king: [you have one, it has one], board }
function generate(seed, tier) {
  const { N, K, types: tn, units } = TIER[tier], rand = rng(seed);
  for (;;) {
    const nt = int(rand, tn[0], tn[1]), looks = [...LOOKS.keys()];
    const types = Array.from({ length: nt }, () => ({ look: looks.splice(Math.floor(rand() * looks.length), 1)[0], rules: dealType(rand), king: false }));
    if (new Set(types.map((t) => JSON.stringify(t.rules))).size < nt) continue; // two types that move alike: confusing
    const hasKing = rand() < 0.6;
    if (hasKing) types[0].king = true;
    const p = { N, K, types, king: [hasKing, hasKing] };
    // armies: the king type once each (if any), the rest from the other types. Yours starts in the bottom half, its in the top.
    const b = Array(N * N).fill(0), half = (lo) => [...Array(N * N).keys()].filter((i) => (Math.floor(i / N) >= N / 2) === lo && !b[i]);
    for (const side of [1, -1]) {
      const n = int(rand, units[0], units[1]);
      for (let u = 0; u < n; u++) {
        const t = hasKing ? (u === 0 ? 0 : int(rand, 1, nt - 1)) : int(rand, 0, nt - 1);
        const free = half(side > 0);
        b[pick(rand, free)] = side * (t + 1);
      }
    }
    // every type on the board, and a real puzzle: a win in exactly K, from one first move only
    if (types.some((_, t) => !b.includes(t + 1) && !b.includes(-t - 1))) continue;
    const memo = new Map();
    if (wins(p, b, K - 1, memo)) continue;
    const w = winning(p, b, K, memo);
    if (w.length === 1) return { ...p, board: b, first: w[0] };
  }
}

if (typeof module === 'object') module.exports = { LOOKS, RULES, TIER, moves, play, lost, wins, winning, reply, generate };
