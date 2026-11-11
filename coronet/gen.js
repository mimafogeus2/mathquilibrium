// Coronet puzzle engine. N rings around a hub, each cut into N arcs; N colored regions.
// Place N queens: one per ring, one per angle (spoke), one per color. Every puzzle has exactly one solution.
// Cell index = ring * N + spoke, ring 0 innermost. Uses rng/pick from shared/common.js (a global).

const SIZES = { E: 6, M: 8, H: 10 };

// Arcs touch along rings (wrapping all the way round) and across neighboring rings.
function neighbors(N, i) {
  const r = Math.floor(i / N), s = i % N, out = [r * N + (s + 1) % N, r * N + (s + N - 1) % N];
  if (r > 0) out.push(i - N);
  if (r < N - 1) out.push(i + N);
  return out;
}

// Up to `limit` solutions (arrays of cell indexes, sorted by ring). Exact cover: each step branches on
// the ring, spoke or region with the fewest open cells.
function solve(N, region, limit = 2) {
  const units = [];
  for (let k = 0; k < 3 * N; k++) units.push([]);
  for (let i = 0; i < N * N; i++) {
    units[Math.floor(i / N)].push(i);
    units[N + (i % N)].push(i);
    units[2 * N + region[i]].push(i);
  }
  const used = new Uint8Array(3 * N), picked = [], sols = [];
  const ring = (i) => Math.floor(i / N), spoke = (i) => N + (i % N), color = (i) => 2 * N + region[i];
  const open = (i) => !used[ring(i)] && !used[spoke(i)] && !used[color(i)];
  const mark = (i, v) => { used[ring(i)] = used[spoke(i)] = used[color(i)] = v; };
  (function dfs() {
    if (sols.length >= limit) return;
    let best = -1, bc = Infinity;
    for (let u = 0; u < 3 * N; u++) {
      if (used[u]) continue;
      let c = 0;
      for (const i of units[u]) if (open(i)) c++;
      if (!c) return;
      if (c < bc) { bc = c; best = u; }
    }
    if (best < 0) { sols.push(picked.slice().sort((a, b) => a - b)); return; }
    for (const i of units[best]) {
      if (!open(i)) continue;
      mark(i, 1);
      picked.push(i);
      dfs();
      picked.pop();
      mark(i, 0);
    }
  })();
  return sols;
}

// Is region g still in one piece without cell `skip`?
function connectedWithout(N, region, g, skip) {
  const cells = [];
  for (let i = 0; i < N * N; i++) if (region[i] === g && i !== skip) cells.push(i);
  if (!cells.length) return false;
  const seen = new Set([cells[0]]), q = [cells[0]];
  while (q.length) for (const j of neighbors(N, q.pop())) if (j !== skip && region[j] === g && !seen.has(j)) { seen.add(j); q.push(j); }
  return seen.size === cells.length;
}

function generate(seed, N) {
  for (let s = seed; ; s++) {
    const p = tryGenerate(s, N);
    if (p) return p;
  }
}

function tryGenerate(seed, N) {
  const rand = rng(seed), cells = N * N;
  const shuffled = () => {
    const a = [...Array(N).keys()];
    for (let i = N - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  // 1. the answer: ring r -> spoke perm[r]
  const queens = shuffled().map((s, r) => r * N + s);
  // 2. regions grow out from the queens; picking the region first keeps their sizes comparable
  const region = new Array(cells).fill(-1);
  queens.forEach((c, g) => (region[c] = g));
  for (let left = cells - N; left > 0; ) {
    const g = Math.floor(rand() * N);
    const front = [];
    for (let i = 0; i < cells; i++) if (region[i] === g) for (const j of neighbors(N, i)) if (region[j] < 0) front.push(j);
    if (!front.length) continue;
    region[pick(rand, front)] = g;
    left--;
  }
  // 3. while another answer exists, hand one of its non-queen cells to a neighboring region: that answer
  //    now has two queens in one color. The real queens never move, so the answer stays valid.
  const isQueen = new Set(queens);
  const movesFrom = (from) => from.flatMap((c) => isQueen.has(c) || !connectedWithout(N, region, region[c], c) ? []
    : neighbors(N, c).filter((j) => region[j] !== region[c]).map((j) => [c, region[j]]));
  for (let it = 0; it < 300; it++) {
    const sols = solve(N, region, 2);
    if (sols.length === 1) {
      const color = shuffled(); // otherwise color k would always hold ring k's queen
      return { N, region: region.map((g) => color[g]), queens };
    }
    const alt = sols.find((s) => s.some((c) => !isQueen.has(c)));
    // if every such cell holds its region together, nudge a random border cell instead and look again
    let moves = movesFrom(alt);
    if (!moves.length) moves = movesFrom([...Array(cells).keys()]);
    if (!moves.length) return null;
    const [c, g] = pick(rand, moves);
    region[c] = g;
  }
  return null;
}

// What a queen on cell i rules out: its ring, its spoke and its color.
const sees = (N, region, i, j) => i !== j &&
  (Math.floor(i / N) === Math.floor(j / N) || i % N === j % N || region[i] === region[j]);

if (typeof module === 'object') module.exports = { SIZES, neighbors, solve, generate, sees };
