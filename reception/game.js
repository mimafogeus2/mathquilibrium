'use strict';
// Reception: put every piece in the tray on a free rooftop until every square of the city has the signal it needs.
// Rules and levels: gen.js; Hard and Impossible come pregenerated in levels.js (build-levels.js), Easy and Medium are made here.
const SVGNS = 'http://www.w3.org/2000/svg';
const LIVE = 'EMH'; // tiers generated in the page; Impossible's dailies are in levels.js

// ---------- the pieces ----------
const NAMES = { M: T('Mast'), P: T('Panel'), D: T('Dish'), C: T('Small cell'), X: T('Plus'), O: T('Ring'), b: T('Booster'), e: T('Extender'), l: T('Lifter'), s: T('Splitter') };
const DESC = {
  M: T('a diamond, strongest in the middle, one bar weaker each step out.'),
  P: T('a widening wedge one way, weaker toward its tip. Tap it to turn it.'),
  D: T('a straight beam one way, to the edge or a taller building. Tap it to turn it.'),
  C: T('its own square and the eight around it. Height adds no range.'),
  X: T('four arms, two squares long.'),
  O: T('the squares two steps away, all round. Nothing nearer, not even its own roof.'),
  b: T('one more bar everywhere the antennae next to it reach.'),
  e: T('one more square of range for the antennae next to it.'),
  l: T('the antennae next to it count as a storey taller: more range, and they see over one more storey.'),
  s: T('a panel or dish next to it fires both ways.'),
};
// one colour per tray slot, so each piece's ring on the board matches its slot
const MARKS = ['--pink', '--sun', '--teal', '--orange', '--red', '--ink', '--muted', '--pink-text', '--sun-text', '--teal-text'];
// a piece's drawing on its own, for the tray and How to play (ones that turn are shown side on)
const TALL = { M: 116, P: 102, D: 100, C: 94, X: 86, O: 96, b: 52, e: 100, l: 76, s: 48 };
const artSvg = (k) => { const s = Math.max(TALL[k] + 8, 66); return `<svg viewBox="${-s / 2} ${-TALL[k] - 4 - (s - TALL[k] - 8) / 2} ${s} ${s}" aria-hidden="true"><use href="#${ROT.includes(k) ? SYM[k] + '-e' : SYM[k]}" x="-50" y="-110" width="100" height="125"/></svg>`; };
const pieceName = (pc) => (isAnt(pc.k) ? `${NAMES[pc.k]} ${pc.g}` : NAMES[pc.k]);
const pieceTip = (pc) => `<b>${esc(pieceName(pc))}</b>: ${DESC[pc.k]}` + (pc.amp ? ' ' + T('An <b>amplifier</b>: it only broadcasts once its own square already has {n} bars.', { n: pc.amp }) : '');

// The tutorial: 4×4 on the waterfront, a mast that covers most of it, and an amplifier woken next to it for the corners.
const TUTORIAL = parse('4|' + ['1..2', '.aa.', '..1.', '~~~~'].join('') + '|' + '111111111111' + '0000|M3,C2^2|5.0,6.0');

const levelOf = (G) => {
  if (G.tut) return TUTORIAL;
  if (LIVE.includes(G.pack)) return generate(hash(G.key), G.pack);
  // Impossible: today's daily from levels.js; past the ones built, an earlier one picked by the date (build-levels.js makes more)
  const days = DAILY.I, i = Math.round((Date.parse(G.date) - Date.parse(DAILY.from)) / 864e5);
  return parse(days[i] ?? days[hash(G.key) % days.length]);
};

// What a level asks: the base requirement, the hotspots above it, and which squares need it (all, streets & parks, buildings).
function goal(L) {
  const req = [...L.req].map(Number), base = Math.min(...req.filter(Boolean)), N = L.N;
  const hot = req.map((v, c) => (v > base ? c : -1)).filter((c) => c >= 0);
  const open = [...L.ground].map((ch, c) => ch !== '~' && !height(ch) && c).filter((c) => c !== false);
  const bld = [...L.ground].map((ch, c) => !!height(ch) && c).filter((c) => c !== false);
  const scope = open.every((c) => req[c]) && bld.every((c) => req[c]) ? 'all' : open.every((c) => req[c]) ? 'open' : 'bld';
  return { base, hot, scope, N };
}
const goalText = (g) => T({ all: '{n}+ bars everywhere', open: '{n}+ bars on streets', bld: '{n}+ bars in buildings' }[g.scope], { n: g.base });

// ---------- state ----------
// G.L the level, G.P its engine view. G.place[i] = [cell, dir] or null. G.hist: moves to undo, [piece, where it was].
// G.locked: pieces a hint put down (fixed). G.hinted: one token per hint taken (core.js counts them). G.sel: the picked piece.
// G.dir: the way a picked piece that turns will face. G.at: the square under the pointer or keyboard cursor. G.flag: a piece a hint ringed.
const SAVE_OK = (L, P, s) => Array.isArray(s.place) && s.place.length === L.hand.length &&
  s.place.every((p) => p === null || (Array.isArray(p) && P.roofs.includes(p[0]) && p[1] >= 0 && p[1] <= 3)) &&
  new Set(s.place.filter(Boolean).map((p) => p[0])).size === s.place.filter(Boolean).length;

function startLevel(G, save) {
  const L = levelOf(G), P = prep(L), K = L.hand.length;
  const fits = SAVE_OK(L, P, save);
  Object.assign(G, {
    L, P, goal: goal(L), place: fits ? save.place.map((p) => p && [...p]) : Array(K).fill(null), hist: fits && Array.isArray(save.hist) ? save.hist : [],
    locked: new Set(fits ? save.locked || [] : []), hinted: new Set(fits ? save.hinted || [] : []), sel: 0, dir: 0, at: null, kbd: false, flag: -1,
  });
  G.sel = Math.max(0, nextFree());
  G.awake = coverage(P, G.place).on;
  G.woke = [];
  const N = L.N, b = $('#board');
  b.classList.remove('solved');
  b.style.setProperty('--n', N);
  G.drop = null;
  $('#game').dataset.tier = G.tut ? 'E' : G.pack;
  const city = citySvg(L, G.goal.hot);
  b.style.setProperty('--vt', f(city.reach));
  b.innerHTML = `<svg class="city" viewBox="-.3 ${-f(city.reach)} ${N + 0.6} ${f(N + city.reach + 0.4)}" xmlns="${SVGNS}" aria-hidden="true">` +
    `<defs><pattern id="hatch" width=".14" height=".14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".14" height=".14" class="hatch-bg"/><path d="M0 0v.14" class="hatch"/></pattern>` +
    `<pattern id="sh" width=".075" height=".075" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v.075" class="sh-line"/></pattern>` +
    `<filter id="halo" x="-30%" y="-15%" width="160%" height="130%"><feMorphology in="SourceAlpha" operator="dilate" radius="5" result="d"/><feFlood class="halo-ink"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `<radialGradient id="glow"><stop offset="0" class="glow-in"/><stop offset="1" class="glow-out"/></radialGradient></defs>` +
    `<g class="world"><g class="ground">${city.ground}</g><g class="gcov"></g>` +
    city.rows.map((r) => `<g class="row"><g class="blds">${r.b}</g><g class="rcov"></g><g class="sprites">${r.s}</g><g class="cables"></g><g class="pieces"></g></g>`).join('') +
    `<g class="over"></g><g class="fx"></g></g><rect class="cursor" width=".9" height=".9" rx=".14" hidden/></svg>`;
  $('#tray').replaceChildren(...L.hand.map((code, i) => {
    const pc = P.hand[i], t = document.createElement('button');
    t.className = 'piece' + (isAnt(pc.k) ? '' : ' mod');
    t.style.setProperty('--c', `var(${MARKS[i % MARKS.length]})`);
    t.innerHTML = artSvg(pc.k) + (pc.g ? `<b>${pc.g}</b>` : '') + (pc.amp ? `<i class="amp">≥${pc.amp}</i>` : '');
    t.onclick = () => pickPiece(i);
    return t;
  }));
  $('#slug').textContent = G.tut ? T('Tutorial') : $('#g-title').textContent;
  $('#g-sub').textContent = goalText(G.goal); // one short line: the board shows its own size
  $('#btn-hint').hidden = IMP || !!G.tut;
  tip(G.date ? T('Today\'s puzzle. A new one tomorrow.') : startTip());
  refresh();
  return fits || !Object.keys(save).length;
}
const startTip = () => (G.goal.hot.length ? T('Squares with a pin are <b>hotspots</b>: they need the number on the pin.') : !G.tut && G.pack === 'E' && G.n === 1 ? T('Pick a piece below, then a <b>yellow rooftop pad</b>. Every square needs signal, and every piece goes up.') : '');
const tip = (html, warn) => { $('#tip').innerHTML = html; $('#tip').toggleAttribute('data-warn', !!warn); };
const nextFree = (from = 0) => {
  const K = G.place.length;
  for (let j = 0; j < K; j++) { const k = (from + j) % K; if (!G.place[k]) return k; }
  return -1;
};
const pieceAt = (c) => G.place.findIndex((p) => p && p[0] === c);

// ---------- drawing ----------
// art.svg's symbols go into the page once, so <use href="#mast"> finds them and the page's CSS reaches inside them
fetch(new URL('art.svg', document.currentScript.src)).then((r) => r.text()).then((t) => document.body.insertAdjacentHTML('afterbegin', t.replace('<svg ', '<svg class="art" aria-hidden="true" '))).catch(() => {});
// The city is drawn from the front and above: every building stands on its own square at street level and rises, its roof
// lifted by its height over the square behind. Things that stand up (antennae, trees, roof gear) come from art.svg, coloured by style.css; walls, roads and water are drawn here.
const ART = '#', PK = 0.0128, SK = 0.0125; // art units to squares: pieces, small things
const WALL = [0, 0.22, 0.42, 0.62], IN = 0.05; // a building's front wall by height (its roof is that much higher); its inset in its square
const SYM = { M: 'mast', P: 'panel', D: 'dish', C: 'cell', X: 'plus', O: 'ring', b: 'booster', e: 'extender', l: 'lifter', s: 'splitter' };
// where each antenna's aviation light sits, in art units (west-facing ones are mirrored)
const TOP = { mast: [0, -114], 'panel-s': [0, -101], 'panel-n': [0, -101], 'panel-e': [11, -100], 'dish-s': [0, -99], 'dish-n': [0, -99], 'dish-e': [0, -99], cell: [8, -93], plus: [0, -74], ring: [0, -93] };
const h32 = (n) => { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return (n ^ (n >>> 16)) >>> 0; };
const rnd = (c, k) => h32(c * 7919 + k * 104729 + 17) / 4294967296; // a fixed die per square, so a level always looks the same
const f = (v) => +v.toFixed(3);
// a symbol's box, in art units: pieces are 100 wide, small things 40 (see art.svg)
const BOX = (id) => (id in TOP || 'mast booster extender lifter splitter'.includes(id) ? [-50, -110, 100, 125] : [-20, -40, 40, 44]);
const use = (id, x, y, k, cls = '', flip = false) => {
  const [bx, by, bw, bh] = BOX(id);
  return `<use href="${ART}${id}" class="${cls}" x="${bx}" y="${by}" width="${bw}" height="${bh}" transform="translate(${f(x)} ${f(y)}) scale(${flip ? -k : k} ${k})"/>`;
};
const symOf = (k, dir) => (ROT.includes(k) ? SYM[k] + '-' + 'nese'[dir] : SYM[k]);
const xy = (c, N) => [c % N, (c / N) | 0];

function citySvg(L, hot) {
  const N = L.N, g = L.ground, H = (c) => height(g[c]);
  const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? null : g[y * N + x]);
  const street = (ch) => ch === '.', land = (ch) => ch !== null && ch !== '~';
  const ground = [], glow = [], shadows = [], rows = Array.from({ length: N }, () => ({ b: [], s: [] }));
  const sprite = (y, at, svg) => rows[Math.min(N - 1, Math.floor(y))].s.push([at, svg]); // in its row, by how far forward it stands
  // the city's slab, and its cut front edge: earth under land, deeper blue under water
  ground.push(`<rect class="slab" x="-.06" y="-.06" width="${N + 0.12}" height="${N + 0.12}" rx=".18"/>`);
  for (let x = 0; x < N; x++) ground.push(`<rect class="edge${at(x, N - 1) === '~' ? ' wet' : ''}" x="${x - (x ? 0.01 : 0.06)}" y="${N}" width="${1.02 + (x === 0 || x === N - 1 ? 0.05 : 0)}" height=".3"/>`);
  ground.push(`<path class="edge-line" d="M-.06 ${N + 0.15}h${N + 0.12}"/>`);
  for (let c = 0; c < N * N; c++) {
    const [x, y] = xy(c, N), ch = g[c], nb = [at(x, y - 1), at(x + 1, y), at(x, y + 1), at(x - 1, y)];
    if (street(ch)) {
      // road to the edges it shares with road, a kerb and pavement where it meets anything else
      const k = nb.map((n) => (n === null || street(n) ? 0 : 0.11));
      ground.push(`<rect class="road" x="${f(x + k[3])}" y="${f(y + k[0])}" width="${f(1 - k[1] - k[3])}" height="${f(1 - k[0] - k[2])}" rx="${k.some(Boolean) ? 0.05 : 0}"/>`);
      const s = nb.map((n) => n !== null && street(n)), ways = s.filter(Boolean).length;
      if (ways >= 3) ground.push(`<circle class="manhole" cx="${f(x + 0.3 + rnd(c, 9) * 0.4)}" cy="${f(y + 0.3 + rnd(c, 11) * 0.4)}" r=".05"/>`);
else if (s[1] && s[3] && !s[0] && !s[2]) ground.push(`<path class="lane" d="M${x} ${y + 0.5}h1"/>`);
      else if (s[0] && s[2] && !s[1] && !s[3]) ground.push(`<path class="lane" d="M${x + 0.5} ${y}v1"/>`);
      // a street lamp on some pavements
      const side = [0, 1, 2, 3].find((d) => k[d]);
      if (side !== undefined && rnd(c, 1) < 0.3) {
        const lx = x + [0.5, 0.94, 0.5, 0.06][side] + (side % 2 ? 0 : 0.3), ly = y + [0.06, 0.5, 0.94, 0.5][side] + (side % 2 ? 0.25 : 0);
        sprite(y, ly, use('lamp', lx, ly, SK * 0.9, '', side === 1));
        glow.push(`<circle class="glow" cx="${f(lx + (side === 1 ? -0.1 : 0.1))}" cy="${f(ly)}" r=".5"/>`);
      }
    } else if (ch === ',') {
      const k = nb.map((n) => (n === ',' ? 0 : 0.04));
      ground.push(`<rect class="park" x="${f(x + k[3])}" y="${f(y + k[0])}" width="${f(1 - k[1] - k[3])}" height="${f(1 - k[0] - k[2])}" rx=".08"/>`);
      // paths from the middle to the street and the rest of the park, a little crooked
      const ways = nb.map((n, d) => (n === ',' || (n !== null && street(n)) ? d : -1)).filter((d) => d >= 0);
      const bend = (rnd(c, 2) - 0.5) * 0.25;
      for (const d of ways) {
        const ex = x + [0.5, 1, 0.5, 0][d], ey = y + [0, 0.5, 1, 0.5][d];
        ground.push(`<path class="path" d="M${x + 0.5} ${y + 0.5}Q${f(x + 0.5 + (d % 2 ? 0.2 * (d === 1 ? 1 : -1) : bend))} ${f(y + 0.5 + (d % 2 ? bend : 0.2 * (d === 2 ? 1 : -1)))} ${ex} ${ey}"/>`);
      }
      if (ways.length) ground.push(`<circle class="plaza" cx="${x + 0.5}" cy="${y + 0.5}" r=".12"/>`);
      for (let t = 0; t < 3; t++) ground.push(`<path class="tuft" d="M${f(x + 0.15 + rnd(c, 10 + t) * 0.7)} ${f(y + 0.2 + rnd(c, 20 + t) * 0.7)}l.03-.06.03.06"/>`);
      // trees in the quarters the paths leave free
      const spots = [[0.25, 0.42], [0.75, 0.42], [0.27, 0.92], [0.75, 0.9]].sort((a, b) => rnd(c, 30 + a[0] * 4 + a[1]) - rnd(c, 30 + b[0] * 4 + b[1]));
      const n = 2 + (rnd(c, 3) < 0.5 ? 1 : 0);
      for (let t = 0; t < n; t++) {
        if (hot.includes(c) && spots[t][1] > 0.8 && spots[t][0] < 0.5) continue; // the venue's corner
        const [tx, ty] = spots[t], kind = ['tree', 'tree', 'pine', 'bush'][(rnd(c, 40 + t) * 4) | 0], s = 0.8 + rnd(c, 50 + t) * 0.35;
        ground.push(`<ellipse class="tree-shadow" cx="${f(x + tx + 0.05)}" cy="${f(y + ty - 0.01)}" rx="${f(0.15 * s)}" ry="${f(0.06 * s)}"/>`);
        sprite(y, y + ty, use(kind, x + tx, y + ty, SK * s));
      }
    } else if (ch === '~') {
      const k = nb.map((n) => (n === '~' || n === null ? 0 : 0.03));
      ground.push(`<rect class="water" x="${f(x + k[3])}" y="${f(y + k[0])}" width="${f(1 - k[1] - k[3])}" height="${f(1 - k[0] - k[2])}"/>`);
      // a stone quay and a line of foam along the shore
      const sides = [`M${x} ${y}h1`, `M${x + 1} ${y}v1`, `M${x} ${y + 1}h1`, `M${x} ${y}v1`], foam = [`M${x} ${y + 0.11}h1`, `M${x + 0.89} ${y}v1`, `M${x} ${y + 0.89}h1`, `M${x + 0.11} ${y}v1`];
      nb.forEach((n, d) => { if (land(n)) ground.push(`<path class="quay" d="${sides[d]}"/><path class="foam" d="${foam[d]}"/>`); });
      for (let t = 0; t < 2; t++) {
        const rx = x + 0.18 + rnd(c, 60 + t) * 0.5, ry = y + 0.3 + t * 0.35 + rnd(c, 70 + t) * 0.12;
        ground.push(`<path class="ripple" d="M${f(rx)} ${f(ry)}q.07-.06 .14 0t.14 0"/>`);
      }
    }
  }
  // buildings, back row first: each one's shadow, front wall with its storeys of windows, and roof
  for (let c = 0; c < N * N; c++) {
    const h = H(c);
    if (!h) continue;
    const [x, y] = xy(c, N), W = WALL[h], s = h === 3 ? 3 + (rnd(c, 4) < 0.5 ? 0 : 1) : (rnd(c, 4) * 3) | 0, x0 = x + IN, w = 1 - 2 * IN;
    const yb = y + 1 - IN, yt = yb - W, y0 = y + IN - W; // the wall's foot (street level) and top; the roof's top edge
    const d = 0.08 + 0.1 * h;
    shadows.push(`<path class="shadow" d="M${f(x0 + w)} ${f(y0)}l${f(d)} ${f(d * 0.4)}V${f(yb + d * 0.4)}H${f(x0 + d)}L${f(x0)} ${f(yb)}z"/>`);
    let win = '';
    const band = W / h;
    for (let k = 0; k < h; k++) for (let j = 0; j < 3; j++) {
      const wy = yt + band * k + band * 0.24, wx = x0 + 0.12 + j * 0.25, door = k === h - 1 && j === 1 && h < 3;
      win += door ? `<rect class="door" x="${f(wx + 0.02)}" y="${f(wy)}" width=".13" height="${f(yb - wy)}" rx=".02"/>`
        : `<rect class="wn${rnd(c, 80 + k * 3 + j) < 0.38 ? ' lit' : ''}" x="${f(wx)}" y="${f(wy)}" width=".17" height="${f(band * 0.48)}" rx=".015"/>`;
    }
    rows[y].b.push(`<g class="bld h${h} s${s}" data-c="${c}"><g class="wall"><rect class="face" x="${f(x0)}" y="${f(yt - 0.02)}" width="${w}" height="${f(W + 0.02)}"/>${win}` +
      `<rect class="foot" x="${f(x0)}" y="${f(yb - 0.07)}" width="${w}" height=".07"/></g>` +
      `<rect class="top" x="${f(x0)}" y="${f(y0)}" width="${w}" height="${w}" rx=".05"/><rect class="deck" x="${f(x0 + 0.05)}" y="${f(y0 + 0.05)}" width="${f(w - 0.1)}" height="${f(w - 0.1)}" rx=".03"/>` +
      (isRoof(g[c]) ? `<rect class="roof" x="${f(x + 0.18)}" y="${f(y + 0.18 - W)}" width=".64" height=".64" rx=".1"/><path class="pad-mark" d="M${f(x + 0.38)} ${f(y + 0.5 - W)}h.24M${f(x + 0.5)} ${f(y + 0.38 - W)}v.24"/>` : '') + '</g>');
    if (!isRoof(g[c]) && !hot.includes(c)) {
      // roof gear: one or two things, never on a roof a piece can go on
      const kinds = ['ac', 'tank', 'skylight', 'vents', 'solar', 'planter'], n = rnd(c, 5) < 0.55 ? 2 : 1;
      const spots = rnd(c, 6) < 0.5 ? [[0.33, 0.48], [0.68, 0.8]] : [[0.66, 0.5], [0.32, 0.82]];
      for (let t = 0; t < n; t++) sprite(y, y + spots[t][1], use(kinds[(rnd(c, 90 + t) * kinds.length) | 0], x + spots[t][0], y + spots[t][1] - W, SK * (h === 3 && !t ? 0.95 : 0.8), '', rnd(c, 95 + t) < 0.5));
    }
  }
  // a hotspot's venue, in its square's corner: a bus stop or café on a street, a fountain in a park, a buoy on water, a clinic sign on a roof
  for (const c of hot) {
    const [x, y] = xy(c, N), ch = g[c];
    const id = ch === '~' ? 'v-buoy' : ch === ',' ? 'v-fountain' : H(c) ? 'v-clinic' : rnd(c, 7) < 0.5 ? 'v-bus' : 'v-cafe';
    sprite(y, y + 0.9, use(id, x + 0.26, y + 0.9 - WALL[H(c)], SK * 0.85, 'venue'));
  }
  // the sheet's top margin: room for the tallest roof in the back rows (a piece on it may stand up past the sheet, like a model on a map)
  let reach = 0.3;
  for (let c = 0; c < N * N; c++) reach = Math.max(reach, WALL[H(c)] + 0.12 - ((c / N) | 0));
  return { ground: ground.join('') + shadows.join('') + glow.join(''), rows: rows.map((r) => ({ b: r.b.join(''), s: r.s.sort((a, b) => a[0] - b[0]).map((t) => t[1]).join('') })), reach };
}

// What the modifiers next to each antenna do to it, and which modifiers touch nothing (their cable hangs loose)
function links(shown) {
  const { P } = G, N = P.N, out = [], badges = shown.map(() => ({})), idle = new Set();
  shown.forEach((p, m) => {
    if (!p || isAnt(P.hand[m].k)) return;
    let live = 0;
    for (const n of neighbours(N, p[0])) {
      const a = shown.findIndex((q, j) => q && q[0] === n && isAnt(P.hand[j].k));
      if (a < 0) continue;
      const k = P.hand[m].k, on = k !== 's' || ROT.includes(P.hand[a].k);
      out.push([p[0], n, on]);
      if (on) { live++; badges[a][k] = (badges[a][k] || 0) + 1; }
    }
    if (!live) idle.add(m);
  });
  return { out, badges, idle };
}
const BADGE = { b: (n) => '+' + n, e: (n) => '↔' + (n > 1 ? n : ''), l: (n) => '↑' + (n > 1 ? n : ''), s: () => '⇄' };

// A piece on its roof: a disc in its slot's colour, its hardware standing on it (turned its way), pips for its grade, an amplifier's tab.
function pieceSvg(i, p, cls = '', since = 0, badge = {}) {
  const pc = G.P.hand[i], N = G.L.N, [x, y] = xy(p[0], N), cx = x + 0.5, cy = y + 0.6 - WALL[G.P.H[p[0]]], id = symOf(pc.k, p[1]), flip = ROT.includes(pc.k) && p[1] === 3;
  const top = TOP[id];
  let s = `<g class="pc ${isAnt(pc.k) ? 'ant' : 'mod'} ${cls}" style="--c: var(${MARKS[i % MARKS.length]})" transform="translate(${f(cx)} ${f(cy)})">`;
  if (cls.includes('wake')) s += `<circle class="pulse" r=".3" style="animation-delay: -${since}ms"/>`;
  s += `<ellipse class="base" rx=".3" ry=".13"/>`;
  if (ROT.includes(pc.k)) s += `<path class="aim" transform="rotate(${p[1] * 90})" d="M-.07-.15 0-.24.07-.15"/>`;
  s += use(id, 0.022, -0.012, PK, 'misreg', flip) + use(id, 0, 0, PK, 'hw', flip);
  if (top) s += `<circle class="avl" cx="${f(top[0] * PK * (flip ? -1 : 1))}" cy="${f(top[1] * PK)}" r=".03"/>`;
  for (let j = 0; j < pc.g; j++) s += `<circle class="pip" cx="${f((j - (pc.g - 1) / 2) * 0.09)}" cy=".07" r=".032"/>`;
  if (pc.amp) s += `<g class="amp"><rect x=".14" y="-.04" width=".27" height=".17" rx=".05"/><text x=".275" y=".085">≥${pc.amp}</text></g>`;
  const b = Object.keys(badge);
  if (b.length) s += `<g class="fx-badge"><rect x="${f(-0.44 - 0.11 * (b.length - 1))}" y="-.22" width="${f(0.24 + 0.11 * (b.length - 1))}" height=".16" rx=".08"/><text x="${f(-0.32 - 0.055 * (b.length - 1))}" y="-.1">${b.map((k) => BADGE[k](badge[k])).join(' ')}</text></g>`;
  return s + '</g>';
}

function refresh() {
  const { L, P } = G, N = L.N, NN = N * N;
  // what the board would be with the picked piece on the square under the pointer (a preview)
  const free = (c) => P.roofs.includes(c) && pieceAt(c) < 0;
  const pv = !G.done && G.at !== null && free(G.at) && !G.place[G.sel] ? G.sel : -1;
  const shown = G.place.map((p, i) => (i === pv ? [G.at, ROT.includes(P.hand[i].k) ? G.dir : 0] : p));
  const now = coverage(P, shown), cov = now.cov, base = pv >= 0 ? coverage(P, G.place).cov : cov;
  const up = (c) => WALL[P.H[c]], row = (c) => (c / N) | 0; // a square's roof height over the street; its row
  const svg = $('#board svg'), cell = (c, cls, roof) => {
    const [x, y] = xy(c, N), i = roof ? IN + 0.03 : -0.01; // ground tints overlap a hair, so the wash has no seams
    return `<rect class="${cls}" x="${f(x + i)}" y="${f(y + i - up(c))}" width="${f(1 - 2 * i)}" height="${f(1 - 2 * i)}"${roof ? ' rx=".06"' : ''}/>`;
  };
  // signal: a tint per square, deeper per bar, on the ground or on the roof; the preview's gain lighter on top
  let gc = '', top = '';
  const rc = Array(N).fill(''), cb = Array(N).fill(''), pcs = Array(N).fill('');
  for (let c = 0; c < NN; c++) {
    const roof = !!P.H[c], spare = P.req[c] ? '' : ' spare'; // signal where none is needed prints faint
    let s = '';
    if (base[c]) s += cell(c, 'l' + Math.min(base[c], 4) + spare, roof);
    if (cov[c] > base[c]) s += cell(c, 'gain l' + Math.min(cov[c], 4) + spare, roof);
    if (roof) rc[row(c)] += s; else gc += s;
  }
  // the preview: where a taller building stops the piece (a grey signal shadow), and those buildings ringed
  if (pv >= 0) {
    const pc = P.hand[pv];
    if (isAnt(pc.k)) {
      const dir = shown[pv][1], los = pattern(P, pc.k, pc.g, G.at, dir, 0, 0, 0, false), all = patternNoLos(P, pc.k, pc.g, G.at, dir, 0, 0, 0, false), seen = new Set(), walls = new Set();
      for (let j = 0; j < los.length; j += 2) seen.add(los[j]);
      for (let j = 0; j < all.length; j += 2) {
        const t = all[j];
        if (seen.has(t)) continue;
        if (P.H[t]) rc[row(t)] += cell(t, 'blocked', true); else gc += cell(t, 'blocked', false);
        walk(N, G.at, t, (b) => { if (P.H[b] > P.H[G.at]) walls.add(b); });
      }
      for (const b of walls) rc[row(b)] += cell(b, 'blocker', true);
    }
    for (let c = 0; c < NN; c++) if (cov[c] > base[c] && P.req[c]) { const [x, y] = xy(c, N); top += `<text class="plus" x="${x + 0.3}" y="${f(y + 0.9 - up(c))}">+${cov[c] - base[c]}</text>`; }
  }
  svg.querySelector('.gcov').innerHTML = gc;
  // each square's reception as phone bars in its corner: filled for the bars it has, hollow red for the ones it still needs
  const all = shown.every(Boolean);
  for (let c = 0; c < NN; c++) {
    const need = P.req[c], short = need && cov[c] < need;
    if (!need || (!cov[c] && !(short && all))) continue; // only where the level asks for signal
    const [x] = xy(c, N), y = row(c) - up(c), n = Math.min(4, Math.max(need, cov[c]));
    let g = `<g class="bars${short ? ' short' : ''}" transform="translate(${f(x + 0.95 - n * 0.14)} ${f(y + 0.95)})"><rect class="pill" x="-.05" y="-.54" width="${f(n * 0.14 + 0.06)}" height=".59" rx=".09"/>`;
    for (let i = 0; i < n; i++) g += `<rect class="${i < cov[c] ? 'on' : 'off'}" x="${f(i * 0.14)}" y="${f(-0.17 - i * 0.1)}" width=".1" height="${f(0.17 + i * 0.1)}" rx=".025"/>`;
    top += g + '</g>';
  }
  for (const c of G.goal.hot) {
    const [x] = xy(c, N), y = row(c) - up(c), ok = cov[c] >= P.req[c];
    top += `<g class="pin${ok ? ' met' : ''}" transform="translate(${x + 0.27} ${f(y + 0.5)})"><path d="M0 0C-.06-.08-.17-.15-.17-.27a.17 .17 0 1 1 .34 0C.17-.15.06-.08 0 0z"/>` +
      `<text y="-.21">${P.req[c]}</text>${ok ? '<path class="tick" d="M.1-.42l.04.04.08-.08"/>' : ''}</g>`;
  }
  // a piece just put down sends a ring out over the city
  if (G.drop && performance.now() - G.drop.t < 900) {
    const [x, y] = xy(G.drop.c, N);
    top += `<circle class="ripple-out" cx="${x + 0.5}" cy="${f(y + 0.6 - up(G.drop.c))}" r=".3" style="animation-delay: -${Math.round(performance.now() - G.drop.t)}ms"/>`;
  }
  svg.querySelector('.over').innerHTML = top;
  // an amplifier that just switched on (for real, not in a preview) rings out once
  // (the pieces are redrawn on every hover: the pulse picks up where it was, by its start time)
  if (pv < 0) {
    const t = performance.now();
    now.on.forEach((on, i) => { if (on && P.hand[i].amp && !G.awake[i]) { G.woke[i] = t; sfx.toggle(true); } });
    G.awake = now.on;
  }
  const woke = G.place.map((_, i) => performance.now() - (G.woke[i] ?? -1e9) < 900 && Math.round(performance.now() - G.woke[i]));
  // modifiers' cables to the antennae they change: lit when they do something, slack and grey when a modifier touches nothing
  const lk = links(shown);
  for (const [a, b, on] of lk.out) {
    const [ax, ay] = xy(a, N), [bx, by] = xy(b, N), y1 = ay + 0.6 - up(a), y2 = by + 0.6 - up(b);
    cb[Math.max(ay, by)] += `<path class="cable${on ? ' live' : ''}" d="M${ax + 0.5} ${f(y1)}Q${(ax + bx) / 2 + 0.5} ${f((y1 + y2) / 2 + 0.12)} ${bx + 0.5} ${f(y2)}"/>`;
  }
  for (const m of lk.idle) { const [x, y] = xy(shown[m][0], N); cb[y] += `<path class="cable idle" d="M${x + 0.5} ${f(y + 0.6 - up(shown[m][0]))}q.12.1 .26.05"/>`; }
  // pieces, each in its row (so a building in front hides it), back to front within the row
  const order = shown.map((p, i) => i).filter((i) => shown[i]).sort((a, b) => shown[a][0] - shown[b][0]);
  for (const i of order) pcs[row(shown[i][0])] += pieceSvg(i, shown[i], [i === pv && 'ghost', !now.on[i] && isAnt(P.hand[i].k) && 'off', woke[i] !== false && 'wake', G.locked.has(i) && 'locked', i === G.flag && 'flag', lk.idle.has(i) && 'idle'].filter(Boolean).join(' '), woke[i] || 0, lk.badges[i]);
  svg.querySelectorAll('.row').forEach((r, y) => {
    r.querySelector('.rcov').innerHTML = rc[y];
    r.querySelector('.cables').innerHTML = cb[y];
    r.querySelector('.pieces').innerHTML = pcs[y];
  });
  const cur = svg.querySelector('.cursor');
  cur.hidden = !(G.kbd && G.at !== null && !G.done);
  if (G.at !== null) { cur.setAttribute('x', (G.at % N) + 0.05); cur.setAttribute('y', f(row(G.at) + 0.05 - up(G.at))); }
  // the tray
  const real = pv >= 0 ? coverage(P, G.place) : now;
  $('#tray').querySelectorAll('.piece').forEach((t, i) => {
    const pc = P.hand[i], placed = !!G.place[i];
    t.classList.toggle('used', placed);
    t.classList.toggle('hinted', G.locked.has(i));
    t.classList.toggle('off', placed && isAnt(pc.k) && !real.on[i]);
    t.setAttribute('aria-pressed', String(i === G.sel && !placed && !G.done));
    t.disabled = G.done || G.locked.has(i);
    t.setAttribute('aria-label', pieceName(pc) + (pc.amp ? ', ' + T('amplifier, needs {n}', { n: pc.amp }) : '') + (G.locked.has(i) ? ', ' + T('placed by a hint') : placed ? ', ' + T('on a roof: tap to take it back') : ''));
  });
  const left = P.need.filter((c) => real.cov[c] < P.req[c]).length, todo = G.place.filter((p) => !p).length;
  $('#board').setAttribute('aria-label', T('City, {n} by {n}. {short} squares short of signal, {left} pieces left', { n: N, short: left, left: todo }));
  if (G.kbd && !G.done && G.at !== null) $('#sr').textContent = describe(G.at, real.cov);
  $('#btn-undo').disabled = !G.hist.length || G.done;
  $('#btn-reset').disabled = G.done || G.place.every((p, i) => !p || G.locked.has(i));
  if (!G.done && !todo && met(P, real.cov)) { win(); celebrate(); }
}

// The win: fireworks over the three tallest roofs.
function celebrate() {
  if (document.documentElement.hasAttribute('data-calm')) return;
  const { L, P } = G, N = L.N, b = $('#board');
  const tall = [...Array(N * N).keys()].filter((c) => P.H[c]).sort((a, c) => P.H[c] - P.H[a] || rnd(a, 8) - rnd(c, 8)).slice(0, 3);
  const cols = ['var(--cov)', 'var(--sun)', 'var(--pink)'];
  let s = '';
  tall.forEach((c, n) => {
    const [x, y] = xy(c, N);
    s += `<g class="burst" style="--d: ${150 + n * 300}ms; --k: ${cols[n % 3]}" transform="translate(${x + 0.5} ${f(y - 0.8 - WALL[P.H[c]])})">`;
    for (let j = 0; j < 18; j++) { const a = (j / 18) * Math.PI * 2, d = 1.3 + (j % 3) * 0.3; s += `<circle r="${j % 2 ? 0.065 : 0.1}" style="--x: ${f(Math.cos(a) * d)}px; --y: ${f(Math.sin(a) * d)}px"/>`; }
    s += '</g>';
  });
  b.querySelector('.fx').innerHTML = s;
}
// What the keyboard cursor is on, for a screen reader
function describe(c, cov) {
  const { L, P } = G, N = L.N, ch = L.ground[c], j = pieceAt(c), h = height(ch);
  const what = ch === '~' ? T('water') : ch === ',' ? T('park') : h ? T('a building, {h} storeys', { h }) + (isRoof(ch) ? ', ' + T('free roof') : '') : T('street');
  return T('Row {r}, column {c}: {what}. Signal {v} of {need}.', { r: ((c / N) | 0) + 1, c: (c % N) + 1, what, v: cov[c], need: P.req[c] }) + (j >= 0 ? ' ' + pieceName(P.hand[j]) + '.' : '');
}

// ---------- moves ----------
const record = (i) => { G.hist.push([i, G.place[i] && [...G.place[i]]]); G.flag = -1; };
function pickPiece(i) {
  if (!playing() || G.locked.has(i) || !coachAllows(G.place[i] ? { lift: i } : { pick: i })) return;
  if (G.place[i]) { lift(i); return; } // a used piece comes back off its roof, ready to place again
  G.sel = i;
  sfx.tap();
  tip(pieceTip(G.P.hand[i]));
  refresh();
}
function put(c) {
  const i = G.sel;
  if (!playing() || G.place[i] || !G.P.roofs.includes(c) || pieceAt(c) >= 0) return;
  if (!coachAllows({ put: i, at: c })) { G.at = null; return refresh(); }
  record(i);
  G.place[i] = [c, ROT.includes(G.P.hand[i].k) ? G.dir : 0];
  G.drop = { c, t: performance.now() };
  sfx.place();
  const nf = nextFree(i + 1);
  if (nf >= 0) { G.sel = nf; tip(pieceTip(G.P.hand[nf])); }
  else if (!met(G.P, coverage(G.P, G.place).cov)) tip(T('Every piece is up, but some squares are short. <b>Turn</b> a piece, or tap its slot to take it back.'), true);
  if (!G.kbd) G.at = null;
  after();
}
function turn(i) {
  if (!playing() || G.locked.has(i) || !ROT.includes(G.P.hand[i].k) || !coachAllows({ turn: i })) return;
  record(i);
  G.place[i] = [G.place[i][0], (G.place[i][1] + 1) % 4];
  G.dir = G.place[i][1];
  sfx.tap();
  after();
}
function lift(i) {
  if (!G.place[i] || G.locked.has(i)) return;
  record(i);
  G.place[i] = null;
  G.sel = i;
  sfx.erase();
  tip(pieceTip(G.P.hand[i]));
  after();
}
function move(i, c) {
  if (!playing() || G.locked.has(i) || !G.P.roofs.includes(c) || pieceAt(c) >= 0) return;
  record(i);
  G.place[i] = [c, G.place[i][1]];
  G.drop = { c, t: performance.now() };
  sfx.place();
  after();
}
function undo() {
  if (!playing() || !coachAllows({ undo: true })) return;
  while (G.hist.length) {
    const [i, was] = G.hist.pop();
    if (G.locked.has(i)) continue; // a hint's piece stays
    G.place[i] = was;
    if (!was) G.sel = i;
    sfx.erase();
    break;
  }
  G.flag = -1;
  after();
}
function after() { refresh(); saveGame(); }

async function reset() {
  if (!playing() || !coachAllows({ reset: true })) return;
  if (!(await ask(T('Restart this level? Your pieces come back off the roofs; the clock keeps running.')))) return;
  G.place = G.place.map((p, i) => (G.locked.has(i) ? p : null));
  G.hist = [];
  G.flag = -1;
  G.sel = Math.max(0, nextFree());
  sfx.erase();
  after();
}

// A hint: if the pieces up so far can still be part of an answer, one more goes up where such an answer has it (and stays).
// If not, it rings a piece that can't stay where it is. Failing both (a slow search), it places one from an answer that keeps
// only the hint's own pieces, moving whatever's in the way.
function hint() {
  if (!playing() || !coachAllows({ hint: true })) return;
  const P = G.P, fixed = G.place.map((p) => p && [...p]), find = (f) => solve(P, { fixed: f, noSkip: true, cap: 0, stopPartial: false, limit: 4e5 });
  let w = find(fixed).witness;
  G.hinted.add('h' + G.hinted.size);
  track('hint');
  sfx.hint();
  if (w) return lockIn(w);
  const mine = [...G.hist.map((h) => h[0])].reverse().filter((i, n, a) => a.indexOf(i) === n && G.place[i] && !G.locked.has(i));
  for (const j of [...mine, ...G.place.map((_, j) => j)]) {
    if (!G.place[j] || G.locked.has(j)) continue;
    if (find(fixed.map((p, k) => (k === j ? null : p))).witness) {
      G.flag = j;
      tip(T('This <b>{name}</b> can\'t stay where it is.', { name: esc(pieceName(P.hand[j])) }), true);
      flash($('#board'), 'shake');
      return after();
    }
  }
  w = find(G.place.map((p, k) => (G.locked.has(k) ? p : null))).witness || G.L.sol;
  lockIn(w, true);
}
function lockIn(w, clear) {
  const K = G.place.length, same = (i) => G.place[i] && G.place[i][0] === w[i][0] && G.place[i][1] === w[i][1];
  const i = [G.sel, ...Array(K).keys()].find((k) => !G.locked.has(k) && !same(k) && (clear || !G.place[k]));
  if (i === undefined) return after();
  const there = pieceAt(w[i][0]);
  if (there >= 0 && there !== i) { G.place[there] = null; }
  G.place[i] = [...w[i]];
  G.locked.add(i);
  G.flag = -1;
  G.sel = Math.max(0, nextFree());
  tip(T('The hint put up the <b>{name}</b>. It stays there.', { name: esc(pieceName(G.P.hand[i])) }));
  after();
}

// ---------- input ----------
// Mouse: hover shows the picked piece on the roof under it; click puts it there. Touch: press and drag aims, letting go places.
// A placed piece: tap turns it (or takes it back, if it doesn't turn), press and hold takes it back, drag moves it.
const cellOf = (e) => {
  const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('.bld');
  if (hit && $('#board').contains(hit)) return +hit.dataset.c;
  const svg = $('#board svg'), p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse()), N = G.L.N;
  const x = Math.floor(p.x), y = Math.floor(p.y);
  return x >= 0 && y >= 0 && x < N && y < N ? y * N + x : null;
};
let press = null; // { piece, from, moved, timer } or { aim: true }
$('#board').addEventListener('pointerdown', (e) => {
  if (!playing() || e.button > 0) return;
  e.preventDefault();
  $('#board').setPointerCapture(e.pointerId);
  G.kbd = false;
  const c = cellOf(e), j = c === null ? -1 : pieceAt(c);
  if (j >= 0 && !G.locked.has(j)) {
    press = { piece: j, from: c, moved: false };
    press.timer = setTimeout(() => { if (press?.piece === j && !press.moved && coachAllows({ lift: j })) { press = null; lift(j); } }, 480);
  } else { press = { aim: true }; G.at = c; if (e.pointerType !== 'mouse') $('#board').classList.add('dragging'); refresh(); }
});
$('#board').addEventListener('pointermove', (e) => {
  if (!G || G.done) return;
  const c = cellOf(e);
  if (press?.piece >= 0) {
    if (c !== press.from) press.moved = true;
    if (press.moved) { G.at = c; $('#board').classList.add('dragging'); }
    return;
  }
  if (!press && e.pointerType !== 'mouse') return;
  if (c !== G.at) { G.at = c; G.kbd = false; refresh(); }
});
$('#board').addEventListener('pointerup', (e) => {
  const p = press;
  press = null;
  $('#board').classList.remove('dragging');
  if (!p) return;
  clearTimeout(p.timer);
  const c = cellOf(e);
  if (p.piece >= 0) {
    if (!p.moved) { if (ROT.includes(G.P.hand[p.piece].k)) turn(p.piece); else if (coachAllows({ lift: p.piece })) lift(p.piece); }
    else if (c === null) { if (coachAllows({ lift: p.piece })) lift(p.piece); }
    else if (coachAllows({ move: p.piece, at: c })) move(p.piece, c);
    G.at = e.pointerType === 'mouse' ? c : null;
    return refresh();
  }
  if (c !== null && playing()) put(c);
  else { G.at = null; refresh(); }
});
$('#board').addEventListener('pointercancel', () => { if (press) clearTimeout(press.timer); press = null; G.at = null; refresh(); });
$('#board').addEventListener('pointerleave', (e) => { if (!press && e.pointerType === 'mouse' && G?.L) { G.at = null; refresh(); } });
$('#board').addEventListener('focus', () => { if (playing() && $('#board').matches(':focus-visible')) { G.kbd = true; G.at ??= 0; refresh(); } });

function onKey(e) {
  const N = G.L.N, K = G.place.length, moves = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
  if (moves[e.key]) {
    const at = G.at ?? 0, r = Math.max(0, Math.min(N - 1, ((at / N) | 0) + moves[e.key][0])), c = Math.max(0, Math.min(N - 1, (at % N) + moves[e.key][1]));
    G.at = r * N + c;
    G.kbd = true;
    sfx.tap();
    refresh();
  } else if (/^[1-9]$/.test(e.key) && +e.key <= K) { G.kbd = true; G.at ??= 0; pickPiece(+e.key - 1); }
  else if ((e.key === ' ' || e.key === 'Enter') && document.activeElement?.tagName !== 'BUTTON') {
    G.kbd = true;
    G.at ??= 0;
    const j = pieceAt(G.at);
    if (j >= 0) turn(j); else put(G.at);
  } else if (e.key === 'r' || e.key === 'R') {
    G.kbd = true;
    const j = G.at === null ? -1 : pieceAt(G.at);
    if (j >= 0) turn(j); else { G.dir = (G.dir + 1) % 4; refresh(); }
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    G.kbd = true;
    const j = G.at === null ? -1 : pieceAt(G.at);
    if (j >= 0) { if (playing() && coachAllows({ lift: j })) lift(j); } else undo();
  } else if (e.key === 'u' || e.key === 'U' || e.key === 'z' || e.key === 'Z') { G.kbd = true; undo(); }
  else return false;
  return true;
}

$('#btn-undo').onclick = undo;
$('#btn-hint').onclick = hint;
$('#btn-reset').onclick = reset;

// How to play's legends: the antennae on one page, the modifiers (under their rule) on another
const legend = (ks) => ks.map((k) => `<li>${artSvg(k)}<span><b>${esc(NAMES[k])}</b>: ${DESC[k]}</span></li>`).join('');
$('#help-legend').innerHTML = legend(Object.keys(NAMES).filter(isAnt)) +
  `<li class="note">${T('An antenna\'s strongest signal, in bars, is the number on its tray slot and the dots at its foot on the roof.')}</li>`;
$('#help-mods').innerHTML = legend(Object.keys(NAMES).filter((k) => !isAnt(k)));
// The menu's logo: three bars, the last one inked
$('#logo').innerHTML = '<svg viewBox="0 0 60 44"><rect x="4" y="28" width="12" height="14" rx="2.5"/><rect x="24" y="16" width="12" height="26" rx="2.5"/><rect class="on" x="44" y="2" width="12" height="40" rx="2.5"/></svg>';

// Seconds for three and two stars, per difficulty; each hint takes one off. ponytail: first guesses, to tune in the playtest
const STAR_TIME = { E: [40, 100], M: [60, 150], H: [180, 420], I: [360, 900] };
const stars = (G) => { const [a, b] = STAR_TIME[G.pack] || STAR_TIME.E; return Math.max(1, (G.elapsed <= a ? 3 : G.elapsed <= b ? 2 : 1) - G.hinted.size); };

const tutRoof = (c) => () => {
  return $('#board svg').querySelectorAll('.bld .roof')[[...G.L.ground].filter((ch, k) => k < c && isRoof(ch)).length]; };
boot({ name: T('Reception'), storeKey: 'reception', glyphs: ['▂▄▆', '📶'], start: startLevel,
  tutorial: [
    [T('Every square needs <b>1 bar</b> of signal. The <b>mast</b> is picked: put it on the ringed rooftop.'),
      () => !!G.place[0], tutRoof(5), (m) => m.pick === 0 || (m.put === 0 && m.at === 5)],
    [T('The bars in each square\'s corner show its signal. Next to the mast there are <b>2</b>: enough to wake an <b>amplifier</b> (its tab says it needs 2). Put it on the other rooftop.'),
      null, tutRoof(6), (m) => m.pick === 1 || (m.put === 1 && m.at === 6)],
  ],
  save: (G) => ({ place: G.place, hist: G.hist, locked: [...G.locked], hinted: [...G.hinted] }), key: onKey,
  winDelay: () => (document.documentElement.hasAttribute('data-calm') ? 1200 : 2000), confetti: false,
  stars, reveal: () => { G.place = G.L.sol.map((p) => [...p]); G.hist = []; G.locked = new Set(); G.at = null; refresh(); } });
game.impossible = { stars };
