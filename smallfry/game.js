'use strict';
// Small Fry: get the fry out of the tank. Pick an item from the tray and put it where a fish is looking; after each one the fish
// act (each swims for what it sees and wants), then you place the next. Rules and levels: gen.js (the global Fry), levels.js.

const CELL = 10, CROP = 5, SVGNS = 'http://www.w3.org/2000/svg';
const TICK_MS = 280, FAST_MS = 70;
const DR = Fry.DR, DC = Fry.DC;
const ITEM = { '/': T('mirror'), '\\': T('mirror'), F: T('flat mirror'), B: T('bait') };
const skey = (t, at) => t + '@' + at;

// ---------- drawing ----------
// One SVG in cell units ×10, printed like the rest of the site: flat inks with speckle (#speck) and a misregistered shadow.
// Layers: water and rock (tankSvg), items, looks, spots for the picked item, fish.
const cx = (c, W) => (c % W + .5) * CELL, cy = (c, W) => (Math.floor(c / W) + .5) * CELL;
const calm = () => document.documentElement.hasAttribute('data-calm');
// a cheap, steady hash for cell decoration (pebbles, kelp): the same tank always looks the same
const h32 = (n) => { n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d); n = Math.imul(n ^ (n >>> 12), 0x297a2d39); return (n ^ (n >>> 15)) >>> 0; };

// Fish, one species per size, facing right with the middle at (0, 0), printed riso style: a silhouette in one spot ink, a second
// ink overprinted out of register (where pink lands on yellow it reads orange, on blue purple), and paper knocked out for eyes,
// bellies and spots. sc brings each to tank size (the fry about two thirds of a cell, a shark more than a cell); joint: where the
// tail swings from. a, b: the two inks; over(p, tail): what the second ink prints; paper: what's left unprinted.
const SPECIES = {
  1: { name: 'fry', sc: .44, joint: -4.4, eye: [2.6, -1, 1.5], a: 'yellow', b: 'pink',
    body: 'M-5 0C-4.6-3.8 1.6-5 5.6-1.6Q6.6 0 5.6 1.6C1.6 5-4.6 3.8-5 0Z',
    tail: 'M-4.4 0C-6.5-1.2-8.6-4.6-9.4-4C-8.4-1.4-8.4 1.4-9.4 4C-8.6 4.6-6.5 1.2-4.4 0Z',
    fins: 'M-1.8-3.6Q.4-5.8 2.2-3.8Z',
    over: (p, tail) => `<path class="tint" d="${p.body}"/>${tail}<path d="${p.fins}"/>`, paper: '<path class="cut" d="M-2.6 2.1Q1.2 3.5 4.2 1.4"/>' },
  2: { name: 'minnow', sc: .42, joint: -7.2, eye: [5.6, -.9, 1.05], a: 'teal', b: 'yellow',
    body: 'M-8 0C-6.4-2.8 2.4-3.6 8.2-.8Q9 0 8.2.8C2.4 3.6-6.4 2.8-8 0Z',
    tail: 'M-7.2 0L-11.4-3.6Q-10.2-1.2-9.4 0Q-10.2 1.2-11.4 3.6Z',
    fins: 'M-1.5-2.8L.5-4.6L1.6-3ZM-.5 2.6L.6 4.2L1.8 2.8Z',
    over: (p, tail) => `<path class="tint" d="${p.body}"/>${tail}<path d="${p.fins}"/>`, paper: '<path class="cut" d="M-6 -.6L6.4-.9"/>' },
  3: { name: 'perch', sc: .5, joint: -6.6, eye: [5.2, -1.2, 1.1], a: 'yellow', b: 'blue',
    body: 'M-7.4 0C-6.6-4.6 1.8-6 7.8-1.4Q8.8 0 7.8 1.4C1.8 5.4-6.6 4.2-7.4 0Z',
    tail: 'M-6.6 0L-10.8-4.2Q-9.6 0-10.8 4.2Z',
    fins: 'M-3.6-3.9L-3-7L-1.8-4.6L-.9-7.4L.3-4.9L1.3-6.8L2.6-4.4ZM1.5 3.8L.6 6L3 4.2Z',
    over: (p) => `<path d="${p.fins}"/><path d="M-3.2-4.2Q-2.4 0-3.2 4L-1.8 4.4Q-1 0-1.8-4.7ZM.6-4.8Q1.4 0 .6 4.5L2 4.2Q2.8 0 2-4.4ZM4-3.6Q4.6 0 4 3.4L5.1 2.8Q5.6 0 5.1-2.9Z"/>`, paper: '' },
  4: { name: 'pike', sc: .46, joint: -9.6, eye: [8.4, -1, 1], a: 'pink', b: 'blue',
    body: 'M-10.5 0C-8.6-2.6 3.4-3.4 10.4-1L12.8-.2L11.6.5L12.4 1C4 3.4-8.6 2.6-10.5 0Z',
    tail: 'M-9.6 0L-13.6-3.8L-12.4 0L-13.6 3.8Z',
    fins: 'M-6.5-2.3L-4.4-4.4L-3.4-2.6ZM-6.5 2.3L-4.4 4.2L-3.4 2.4Z',
    over: (p, tail) => `${tail}<path d="${p.fins}"/><circle cx="-5" cy="-.6" r=".8"/><circle cx="-2" cy=".9" r=".7"/><circle cx="1" cy="-1" r=".8"/><circle cx="4" cy=".6" r=".65"/><circle cx="-7.5" cy=".6" r=".6"/><path class="stroke" d="M9.4.3L12.2.2"/>`, paper: '' },
  5: { name: 'grouper', sc: .56, joint: -7.6, eye: [5.8, -2.2, 1.25], a: 'pink', b: 'yellow',
    body: 'M-8.4 0C-8.4-6.6 4.2-7.6 9.6-2.4Q10.2-.6 9 .2Q10.4 1.2 9.4 2.4C4.2 7.6-8.4 6.6-8.4 0Z',
    tail: 'M-7.6 0C-10.4-4.6-12.8-4.4-12.4 0C-12.8 4.4-10.4 4.6-7.6 0Z',
    fins: 'M-5-5C-3-8 3-8 4.6-5Z',
    over: (p, tail) => `<path d="${p.body}"/>${tail}`, paper: '<circle cx="-3" cy="-2" r=".9"/><circle cx="0" cy="2" r=".8"/><circle cx="2.6" cy="-2.6" r=".7"/><circle cx="-5.6" cy="1.6" r=".7"/><circle cx="4.4" cy="1.6" r=".6"/><path class="cut" d="M9.2.2Q7.4 1.6 6 .8"/>' },
  6: { name: 'shark', sc: .52, joint: -9.8, eye: [8.6, -1, .8], a: 'teal', b: 'yellow',
    body: 'M-10.6.4C-7.4-3.8 5.6-4.8 11.6-1Q12.8 0 11.4.8C6 3.2-3.6 3.6-10.6 1Z',
    tail: 'M-9.8.6L-14.4-6.2Q-12.2 0-14.6 4.8Z',
    fins: 'M-1.6-3.6L1-8.8L3.2-3.9ZM2.6 2.4L1 6L4.8 2.8Z',
    over: (p, tail) => `${tail}<path d="${p.fins}"/>`, paper: '<path d="M-6 1.8C-1 3.4 6 3 10.6.9C6 1.6-1 2.2-6 1.8Z"/><path class="cut" d="M5.2-1.6l-.4 2.2M6.2-1.7l-.4 2.2M7.2-1.6l-.4 2"/>' },
  7: { name: 'angler', sc: .62, joint: -6.8, eye: [3.6, -3, 1.35], a: 'orange', b: 'pink',
    body: 'M-7.4 0C-7.4-7 6-8.2 8.8-2L7-.6L8.6.2L7 1L8.6 1.8C6 7.6-7.4 7-7.4 0Z',
    tail: 'M-6.8 0L-11-3.4Q-10 0-11 3.4Z',
    fins: 'M-3.6 4.6L-2.4 7L-.6 4.8Z',
    over: (p, tail) => `<path class="tint" d="${p.body}"/>${tail}<path class="stroke" d="M4-5.4Q6.4-11 10.4-8.6"/>`, paper: '<path d="M8.4-1.5L7.4-.9L8.2-.6ZM8.2 1.2L7.3 1.5L8.1 1.9Z"/>',
    extra: '<circle class="pl yellow" cx="10.6" cy="-8.4" r="1.5"/>' },
};
const speciesOf = (s) => SPECIES[Math.min(s, 7)];
function fishArt(s, fast) {
  const p = speciesOf(s), [ex, ey, er] = p.eye;
  const wag = calm() ? '' : `<animateTransform attributeName="transform" type="rotate" values="-9 ${p.joint} 0;9 ${p.joint} 0;-9 ${p.joint} 0" dur="${(.8 + s * .12).toFixed(2)}s" repeatCount="indefinite"/>`;
  const tail = `<g><path d="${p.tail}"/>${wag}</g>`;
  return `<g transform="scale(${p.sc})">` +
    (fast ? `<path class="pl yellow speed" d="M${p.joint - 6.4}-2.4h-3.4M${p.joint - 7.4} 0h-4.6M${p.joint - 6.4} 2.4h-3.4"/>` : '') +
    // a bare-paper margin round the whole fish, so it lifts off the halftone behind it
    `<g class="halo">${tail}<path d="${p.body}"/><path d="${p.fins}"/>${p.extra ? '<circle cx="10.6" cy="-8.4" r="1.5"/>' : ''}</g>` +
    `<g class="pl ${p.a}">${tail}<path d="${p.body}"/><path d="${p.fins}"/></g>` +
    `<g class="pl ${p.b} over">${p.over(p, tail)}</g>` +
    `<g class="paper">${p.paper}<circle cx="${ex}" cy="${ey}" r="${er}"/></g>` + (p.extra || '') +
    `<circle class="pl blue pupil" cx="${ex + er * .3}" cy="${ey}" r="${er * .55}"/></g>`;
}
// A fish's heading as an angle (0 right, 90 down). Heading left it's turned over, not swum upside down.
const ANG = [-90, 0, 90, 180];
const orient = (a) => `rotate(${a}deg)` + (Math.cos((a * Math.PI) / 180) < -.01 ? ' scaleY(-1)' : '');
const near = (from, to) => from + ((((to - from) % 360) + 540) % 360) - 180; // `to`, wound round to the nearest turn from `from`

// Items. A mirror is a bare paper plate edged in blue with a couple of glare strokes; a bolted one is tinted and riveted. A flat
// mirror is the same plate on brackets against the rock; bait a pink worm.
const plate = (len) => `<rect class="glass" x="${-len / 2}" y="-.9" width="${len}" height="1.8" rx=".5"/>` +
  `<path class="pl blue glare" d="M${-len / 2 + 1.6}-.1l.9-.5M${-len / 2 + 2.8}.3l1.2-.8M${len / 2 - 2.6}.1l.8-.5"/>`;
const worm = () => `<g class="pl pink bait"><path d="M-3.2 1.2C-2.2-1.4-.8 1.8.6-.2S2.6-1.6 3.2.2"/><circle cx="3.3" cy=".1" r=".8"/>` +
  (calm() ? '' : '<animateTransform attributeName="transform" type="rotate" values="-6;6;-6" dur="1.3s" repeatCount="indefinite"/>') + '</g>';
function itemSvg(t, c, W, cls = '') {
  if (t === 'B') return `<g class="item ${cls}" transform="translate(${cx(c, W)} ${cy(c, W)})">${worm()}</g>`;
  if (t === 'F') {
    const cell = c >> 2, d = c & 3, x = cx(cell, W) + DC[d] * 4.1, y = cy(cell, W) + DR[d] * 4.1, k = d === 0 || d === 3 ? -1.7 : 1.7;
    return `<g class="item flat ${cls}" transform="translate(${x} ${y}) rotate(${d % 2 ? 90 : 0})"><path class="pl blue bracket" d="M-3.4 0V${k}M3.4 0V${k}"/>${plate(8.4)}</g>`;
  }
  return `<g class="item ${cls}" transform="translate(${cx(c, W)} ${cy(c, W)}) rotate(${t === '/' ? -45 : 45})">${plate(11)}` +
    (cls.includes('fixed') ? '<circle class="pl blue" cx="-4.4" r=".55"/><circle class="pl blue" cx="4.4" r=".55"/>' : '') + (cls.includes('ghost') ? '' : sparkle(c)) + '</g>';
}
// now and then a mirror catches the light: a yellow four-point glint near one end, each on its own beat
const sparkle = (c) => calm() ? '' : `<path class="pl yellow spark" transform="translate(3 -.5)" d="M0-1.7L.35-.35L1.7 0L.35.35L0 1.7L-.35.35L-1.7 0L-.35-.35Z" opacity="0">` +
  `<animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;.7;.8;.9;1" dur="${4 + (h32(c) % 5)}s" begin="${(h32(c * 7) % 40) / 10}s" repeatCount="indefinite"/></path>`;
// an item in the tray, in a 10 × 10 box
const trayIcon = (t) => (t === 'F' ? '<path class="pl blue" d="M0 7.4h10V10H0z"/><g transform="translate(5 6.4)">' + plate(8.4) + '</g>'
  : t === 'B' ? `<g transform="translate(5 5) scale(1.25)">${worm()}</g>` : `<g transform="translate(5 5) rotate(${t === '/' ? -45 : 45})">${plate(11)}</g>`);
// A patroller's rail: a dashed track across the whole run of water along its axis, with a stop at each end
function railsSvg(L) {
  const W = L.W;
  return L.fish.filter((f) => f.w).map((f) => {
    const ax = f.d % 2 ? 1 : W, ends = [-ax, ax].map((step) => { let c = f.p; while (L.grid[c + step] === '.') c += step; return c; });
    const [a, b] = ends.map((c) => [cx(c, W), cy(c, W)]), h = f.d % 2 ? [0, 1.6] : [1.6, 0];
    return `<path class="rail ${speciesOf(f.s).name}" d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}"/><path class="rail-end ${speciesOf(f.s).name}" d="M${a[0] - h[0]} ${a[1] - h[1]}l${2 * h[0]} ${2 * h[1]}M${b[0] - h[0]} ${b[1] - h[1]}l${2 * h[0]} ${2 * h[1]}"/>`;
  }).join('');
}
// a placed item's order, a small tag by it
function orderTag(t, at, n, W) {
  const c = t === 'F' ? at >> 2 : at, d = t === 'F' ? at & 3 : -1;
  const x = cx(c, W) + (d < 0 ? 3.4 : -DC[d] * 1.6 + (d % 2 ? 0 : 3.2)), y = cy(c, W) + (d < 0 ? 3.4 : -DR[d] * 1.6 + (d % 2 ? 3.2 : 0));
  return `<g class="tag"><circle cx="${x}" cy="${y}" r="1.8"/><text x="${x}" y="${y + .7}">${n}</text></g>`;
}

// The tank, printed risograph style in four spot inks on the page's own paper. The water is the paper, screened with blue
// halftone dots that grow toward the floor; light falls through as paper-white bands. Behind, a far ridge in a teal screen.
// Rock is solid blue with grain, knocked-out pebbles and cracks, pink screened into the shade under overhangs (purple where they
// overprint); ledges are yellow sand. Kelp is teal, starfish pink, shells yellow, and daylight comes in through the exit as a
// yellow burst. Each ink sits a hair out of register. Nothing decorative is in open water, where it could pass for an item.
const star = (x, y, r) => 'M' + Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? r * .42 : r; return `${(x + Math.cos(a) * k).toFixed(2)} ${(y + Math.sin(a) * k).toFixed(2)}`; }).join('L') + 'Z';
function tankSvg(L) {
  const W = L.W, g = L.grid, S = CELL * W, R = 3.2, seed = h32([...g].reduce((a, ch, i) => a + (ch === '#' ? i * 31 : 0), W));
  const rock = (c, dr, dc) => { const r = Math.floor(c / W) + dr, q = (c % W) + dc; return r < 0 || q < 0 || r >= W || q >= W || g[r * W + q] === '#'; };
  let rocks = '', fill = '', sand = '', pebbles = '', cracks = '', shade = '', kelp = '', pink = '', yellow = '', bubbles = '', exit = '', burst = '';
  for (let c = 0; c < W * W; c++) {
    const x = (c % W) * CELL, y = Math.floor(c / W) * CELL, hh = h32(c + seed);
    if (g[c] === '#') {
      // round a corner where both its sides face water; reach a hair into rock neighbours so the mass has no seams
      const up = rock(c, -1, 0), dn = rock(c, 1, 0), lf = rock(c, 0, -1), rt = rock(c, 0, 1);
      const x0 = x - (lf ? .3 : 0), x1 = x + 10 + (rt ? .3 : 0), y0 = y - (up ? .3 : 0), y1 = y + 10 + (dn ? .3 : 0);
      const tl = !up && !lf ? R : 0, tr = !up && !rt ? R : 0, br = !dn && !rt ? R : 0, bl = !dn && !lf ? R : 0;
      rocks += `M${x0 + tl} ${y0}H${x1 - tr}${tr ? `A${tr} ${tr} 0 0 1 ${x1} ${y0 + tr}` : ''}V${y1 - br}${br ? `A${br} ${br} 0 0 1 ${x1 - br} ${y1}` : ''}` +
        `H${x0 + bl}${bl ? `A${bl} ${bl} 0 0 1 ${x0} ${y1 - bl}` : ''}V${y0 + tl}${tl ? `A${tl} ${tl} 0 0 1 ${x0 + tl} ${y0}` : ''}Z`;
      if (hh % 3 === 1) pebbles += `<ellipse cx="${x + 2 + (hh % 6)}" cy="${y + 3 + ((hh >> 4) % 5)}" rx="${.7 + ((hh >> 8) % 3) * .3}" ry="${.5 + ((hh >> 10) % 2) * .25}"/>`;
      if (hh % 5 === 1) cracks += `M${x + 1.5 + ((hh >> 3) % 4)} ${y + 5 + ((hh >> 7) % 3)}q2-1.2 3.4 0t3 .4`;
      if (!dn && g[c + W] === '.') shade += `M${x0 + bl} ${y + 5}H${x1 - br}V${y1 - br}${br ? `A${br} ${br} 0 0 1 ${x1 - br} ${y1}` : ''}H${x0 + bl}${bl ? `A${bl} ${bl} 0 0 1 ${x0} ${y1 - bl}` : ''}Z`;
      if (!up) {
        if (g[c - W] !== '.') continue;
        if (hh % 4 === 0) {
          const k = x + 3 + (hh >> 6) % 4, sway = calm() ? '' : `<animateTransform attributeName="transform" type="rotate" values="-5 ${k} ${y};6 ${k} ${y};-5 ${k} ${y}" dur="${3 + (hh % 3)}s" repeatCount="indefinite"/>`;
          kelp += `<g><path d="M${k} ${y}q-1.6-2.4 0-4.4t0-4.2M${k + 1.6} ${y}q1.2-1.8 0-3.4t.2-2.8"/>${sway}</g>`;
        } else if (hh % 9 === 1) { const sx = x + 3 + (hh >> 5) % 4; pink += `<path d="${star(sx, y + .1, 1.6)}" transform="rotate(${(hh >> 9) % 60} ${sx} ${y + .1})"/>`; }
        else if (hh % 9 === 5) { const sx = x + 3 + (hh >> 5) % 4; yellow += `<path d="M${sx - 1.6} ${y + .4}A1.6 1.6 0 0 1 ${sx + 1.6} ${y + .4}Z"/>`; }
        if (hh % 11 === 7 && !calm()) for (let k = 0; k < 3; k++) {
          const bx = x + 4 + k * 1.3, dur = 3.4 + k * .9 + (hh % 3), r = .5 + k * .2, bg = `begin="${k * 1.1}s" dur="${dur}s" repeatCount="indefinite"`;
          bubbles += `<circle cx="${bx}" r="${r}"><animate attributeName="cy" values="${y - 1};${y - 34}" ${bg}/><animate attributeName="cx" values="${bx};${bx + .8};${bx - .6};${bx}" ${bg}/>` +
            `<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.8;1" ${bg}/></circle>`;
        }
      }
    } else if (g[c] === '.') {
      for (const [dr, dc, ox, oy, sw] of [[-1, -1, 0, 0, 0], [-1, 1, 10, 0, 1], [1, 1, 10, 10, 0], [1, -1, 0, 10, 1]])
        if (rock(c, dr, 0) && rock(c, 0, dc) && rock(c, dr, dc)) {
          const sx = x + ox, sy = y + oy, ix = -Math.sign(ox - 5) * 1.6, iy = -Math.sign(oy - 5) * 1.6;
          fill += `M${sx} ${sy}H${sx + ix}A1.6 1.6 0 0 ${sw} ${sx} ${sy + iy}Z`;
        }
    } else if (g[c] === 'X') {
      // daylight: a yellow burst screened onto the water just inside the gap, and arrows pointing out
      const d = c < W ? 0 : c >= W * (W - 1) ? 2 : c % W === 0 ? 3 : 1, mx = x + 5, my = y + 5, rot = [0, 90, 180, 270][d];
      exit = `<rect class="paper" x="${x}" y="${y}" width="10" height="10"/>` +
        `<g transform="translate(${mx - DC[d] * 2.2} ${my - DR[d] * 2.2}) rotate(${rot})" class="pl blue chevs"><path class="chev" d="M-2.2 1.6L0-.6L2.2 1.6"/><path class="chev c2" d="M-2.2-.4L0-2.6L2.2-.4"/></g>`;
      burst = `<g transform="translate(${mx + DC[d] * 5} ${my + DR[d] * 5}) rotate(${rot})"><path d="${[-34, -18, -6, 6, 18, 34].map((a) => {
        const r1 = (a - 3) * Math.PI / 180, r2 = (a + 3) * Math.PI / 180, l = 22;
        return `M0 0L${(Math.sin(r1) * l).toFixed(1)} ${(Math.cos(r1) * l).toFixed(1)}L${(Math.sin(r2) * l).toFixed(1)} ${(Math.cos(r2) * l).toFixed(1)}Z`; }).join('')}" fill="url(#ht-sun)"/>` +
        `<circle r="6" class="pl yellow"/></g>`;
    }
  }
  // Sand: one strip per ledge (a run of rock tops under water), so a long ledge reads as one bank. Its surface rolls gently;
  // against a rock wall rising at an end it heaps up, at an open corner it tapers down round the curve. A dotted ripple runs along it.
  let ripple = '';
  const smooth = (pts) => 'M' + pts[0].join(' ') + pts.slice(1).map((p, i) => { const q = pts[i]; return `Q${q[0]} ${q[1]} ${((q[0] + p[0]) / 2).toFixed(2)} ${((q[1] + p[1]) / 2).toFixed(2)}`; }).join('') + `L${pts[pts.length - 1].join(' ')}`;
  for (let r = 1; r < W; r++) for (let q = 0; q < W; q++) {
    const c = r * W + q, top = (k) => k % W >= 0 && g[k] === '#' && g[k - W] === '.';
    if (!top(c) || (q > 0 && top(c - 1))) continue;
    let e = q;
    while (e + 1 < W && top(r * W + e + 1)) e++;
    const y = r * CELL, a = q * CELL, b = (e + 1) * CELL, hh = h32(c + seed);
    const wallL = rock(c, 0, -1), wallR = rock(r * W + e, 0, 1); // rock rising beside the ledge: sand heaps against it
    const pts = [];
    pts.push(wallL ? [a, y - 2.2] : [a + 1.1, y + 1.3]);
    pts.push(wallL ? [a + 1.6, y - 1.1] : [a + 2.4, y - .3]);
    for (let x = a + 4.5, k = 0; x < b - 4; x += 4.5, k++) pts.push([x, y - .7 + ((h32(hh + k) % 9) - 4) * .07]);
    pts.push(wallR ? [b - 1.6, y - 1.1] : [b - 2.4, y - .3]);
    pts.push(wallR ? [b, y - 2.2] : [b - 1.1, y + 1.3]);
    const under = [[wallR ? b : b - 2, y + 1.9], [(a + b) / 2, y + 2.3], [wallL ? a : a + 2, y + 1.9]];
    sand += smooth(pts) + under.map((p) => 'L' + p.join(' ')).join('') + 'Z';
    if (b - a > 7) ripple += `M${a + 2.6} ${y + .7}H${b - 2.6}`;
  }

  let ridge = `M0 ${S}V${S * .7}`;
  for (let i = 0; i <= 8; i++) ridge += `Q${S * (i + .5) / 8} ${S * (.6 + ((h32(seed + i) % 100) / 100) * .14)} ${S * (i + 1) / 8} ${S * (.68 + ((h32(seed + i + 50) % 100) / 100) * .08)}`;
  ridge += `V${S}Z`;
  for (let i = 0; i < 3; i++) { const sx = S * (.15 + i * .32 + (h32(seed + 9 * i) % 10) / 100), top = S * (.38 + (h32(seed + 7 * i) % 20) / 100), w = 5 + (h32(seed + i) % 5); ridge += `M${sx - w} ${S}V${top + w}A${w} ${w} 0 0 1 ${sx + w} ${top + w}V${S}Z`; }
  const farKelp = [.08, .3, .55, .82].map((f, i) => { const kx = S * f, ky = S * (.74 + (i % 2) * .05); return `M${kx} ${S}V${ky}q-2-4 0-8t0-8`; }).join('');
  const shafts = [.18, .46, .74].map((f, i) => `<path d="M${S * f} 0h${S * (.06 + i * .02)}l${S * .16} ${S}h-${S * (.1 + i * .02)}Z"/>`).join('');
  // halftone screens: the water's dots grow with depth, band by band
  const dots = (id, r, ink, step = 1.6) => `<pattern id="${id}" width="${step}" height="${step}" patternUnits="userSpaceOnUse" patternTransform="rotate(15)"><circle cx="${step / 2}" cy="${step / 2}" r="${r}" class="ink-${ink}"/></pattern>`;
  const BANDS = 7, deep = Array.from({ length: BANDS }, (_, i) => `<rect y="${(S * i) / BANDS}" width="${S}" height="${S / BANDS + .2}" fill="url(#ht${i})"/>`).join('');
  return `<defs>${Array.from({ length: BANDS }, (_, i) => dots('ht' + i, .08 + i * .045, 'blue', 1.7)).join('')}${dots('ht-teal', .38, 'teal', 1.6)}${dots('ht-pink', .34, 'pink', 1.3)}${dots('ht-sun', .55, 'yellow', 1.4)}` +
    `<clipPath id="tank"><rect x="${CROP}" y="${CROP}" width="${S - 2 * CROP}" height="${S - 2 * CROP}" rx="5"/></clipPath></defs>` +
    `<g clip-path="url(#tank)"><rect class="paper" width="${S}" height="${S}"/>` +
    `<g class="pl teal far"><path d="${ridge}" fill="url(#ht-teal)"/><path class="far-kelp" d="${farKelp}"/></g>` +
    `<g class="pl blue water">${deep}</g><g class="shafts">${shafts}</g>` +
    `<g class="pl yellow burst">${burst}</g>${exit}` +
    `<g class="pl blue bubbles">${bubbles}</g><g class="pl teal kelp">${kelp}</g>` +
    `<path class="pl blue rock" d="${rocks}${fill}"/><path class="pl pink" d="${shade}" fill="url(#ht-pink)"/>` +
    `<g class="paper cuts"><g>${pebbles}</g><path class="crack" d="${cracks}"/></g>` +
    `<path class="sand" d="${sand}"/><path class="ripple" d="${ripple}"/><g class="pl pink">${pink}</g><g class="pl yellow">${yellow}</g></g>`;
}

// ---------- state ----------
// G.L: the level. G.states[i]: the tank after the first i placements, once the fish stopped (G.S is the live one). G.placed:
// [type, spot] in order. G.lock: placements a hint made (and everything before them), which undo can't take back.
// G.sel: the picked item type. G.busy: fish are moving. G.fail: 'eaten' | 'loop' | 'stuck' | null. G.moved: fish moved since the
// last placement. G.mistakes: for the stars. G.preview: a spot shown as if placed (hover, or a first tap on touch).
const TUTORIAL = Fry.parse('7|' + ['###X###', '#.....#', '#.0...#', '#.....#', '#.....#', '#..2..#', '#######'].join('') + '|16.1.1,38.1.2||/|/@17');
const levelOf = (G) => {
  if (G.tut) return TUTORIAL;
  if (G.date) {
    const i = Math.round((Date.parse(G.date) - Date.parse(DAILY.from)) / 864e5), l = DAILY[G.pack]?.[i];
    if (l) return Fry.parse(l);
    // past the dailies built: a pack level picked by the date (build-levels.js makes more)
    const pack = LEVELS[G.pack] || LEVELS.H;
    return Fry.parse(pack[hash(G.key) % pack.length]);
  }
  return Fry.parse(LEVELS[G.pack][G.n - 1]);
};
const left = () => { const c = {}; for (const t of G.L.items) c[t] = (c[t] || 0) + 1; for (const [t] of G.placed) c[t]--; return c; };
const itemsLeft = () => G.L.items.length - G.placed.length;

function startLevel(G, save) {
  const L = levelOf(G), S0 = Fry.initial(L);
  runId++; // a swim still going on the last level stops
  Object.assign(G, { L, S: Fry.clone(S0), states: [S0], placed: [], lock: 0, sel: null, busy: false, fail: null, moved: false, mistakes: 0, preview: null, kspot: -1 });
  let ok = true;
  if (Array.isArray(save.placed)) {
    // replay the saved placements: the fish do what they did
    for (const p of save.placed) {
      if (!Array.isArray(p) || !(p[0] in ITEM) || !Fry.canPlace(L, G.S, p[0], p[1]) || G.fail || left()[p[0]] <= 0) { ok = false; break; }
      Fry.place(G.S, p[0], p[1]);
      G.placed.push([p[0], p[1]]);
      const r = Fry.run(L, G.S);
      if (r === 'lose') G.fail = 'eaten'; else if (r === 'loop') G.fail = 'loop'; else if (r === 'win') { ok = false; break; }
      else if (!itemsLeft()) G.fail = 'stuck';
      G.states.push(Fry.clone(G.S));
    }
    if (!ok) { G.S = Fry.clone(S0); G.states = [S0]; G.placed = []; G.fail = null; }
    else {
      G.mistakes = +save.mistakes || 0;
      G.lock = Math.min(+save.lock || 0, G.placed.length);
      G.hinted = new Set(Array.from({ length: +save.hints || 0 }, (_, i) => i));
      G.moved = !!G.fail;
    }
  }
  G.sel = G.tut ? null : firstLeft();
  const b = $('#board');
  b.classList.remove('solved', 'failed');
  b.innerHTML = `<svg class="tank" viewBox="${CROP} ${CROP} ${L.W * CELL - 2 * CROP} ${L.W * CELL - 2 * CROP}" xmlns="${SVGNS}" aria-hidden="true">${tankSvg(L)}<g class="rails">${railsSvg(L)}</g><g class="items"></g><g class="looks"></g><g class="spots"></g><g class="fishes" clip-path="url(#tank)"></g></svg>`;
  G.fishEls = L.fish.map((f) => {
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', `fish ${speciesOf(f.s).name}${f.s === 1 ? ' fry' : ' pred'}${f.f ? ' fast' : ''}`);
    // the size, on a small tag above it: who eats whom
    g.innerHTML = `<g class="o">${fishArt(f.s, f.f)}</g>` + (f.s > 1 ? `<g class="size"><circle cy="-5.6" r="1.75"/><text y="-4.9">${f.s}</text></g>` : '');
    b.querySelector('.fishes').append(g);
    return g;
  });
  $('#tray').replaceChildren(...L.items.map((t, i) => {
    const s = document.createElement('button');
    s.className = 'slot';
    s.dataset.type = t;
    s.innerHTML = `<svg viewBox="0 0 10 10" aria-hidden="true">${trayIcon(t)}</svg>`;
    return s;
  }));
  $('#btn-hint').hidden = IMP || !!G.tut;
  tip(G.fail ? failText() : G.date ? T('Today\'s puzzle. A new one tomorrow.') : !G.tut && G.pack === 'E' && G.n === 1 ? FIRST_TIP : '');
  draw();
  return ok;
}
const FIRST_TIP = T('Rays show where each fish looks. Put a <b>mirror</b> where the fry looks, to show it the <b>exit</b>.');
const firstLeft = () => { const c = left(); return G.L.items.find((t) => c[t] > 0) ?? null; };
function tip(html, warn = false) {
  $('#tip').innerHTML = html;
  $('#tip').toggleAttribute('data-warn', warn);
}
const failText = () => ({ eaten: T('<b>Eaten!</b> Undo and try another way.'), loop: T('<b>Going in circles.</b> Undo and try another way.'),
  stuck: T('<b>Stuck:</b> every item is placed, and the fry is still in. Undo and try another way.') })[G.fail];

// The board as it stands: items, looks (or the preview's), spots for the picked item, fish where they are
function draw() {
  const { L } = G, W = L.W, svg = $('#board .tank'), S = G.S;
  let items = '';
  for (const [c, m] of L.mir) items += itemSvg(m, c, W, 'fixed');
  G.placed.forEach(([t, at], i) => { if (t !== 'B' || S.bait[at]) items += itemSvg(t, at, W, i < G.lock ? 'placed locked' : 'placed') + orderTag(t, at, i + 1, W); }); // eaten bait is gone
  if (G.preview !== null && G.sel) items += itemSvg(G.sel, G.preview, W, 'ghost');
  svg.querySelector('.items').innerHTML = items;
  // looks: from the tank as it is, or as it would be with the preview placed
  const V = G.preview !== null && G.sel ? Fry.clone(S) : S;
  if (V !== S) Fry.place(V, G.sel, G.preview);
  const occ = Fry.occupancy(L, V);
  svg.querySelector('.looks').innerHTML = G.done && S.out ? '' : V.fish.map((f, i) => {
    if (!f.a || f.w) return ''; // a patroller looks at nothing
    const pts = [], v = Fry.look(L, V, i, occ, pts), wants = v.t >= 0;
    if (pts.length < 2) return '';
    if (V.mir[f.p]) { const r = restOf(f); pts[0] = [r.x / CELL, r.y / CELL]; } // from the corner it rests in, not the plate
    const d = 'M' + pts.map(([x, y]) => `${(x * CELL).toFixed(1)} ${(y * CELL).toFixed(1)}`).join('L');
    return `<path class="look${f.s === 1 ? ' fry' : ''}${wants ? ' wants' : ''}" d="${d}"/>`;
  }).join('');
  // spots
  let spots = '';
  if (G.sel && !G.busy && !G.fail && !G.done) {
    G.spotList = Fry.spots(L, S, G.sel);
    for (const at of G.spotList) {
      const k = G.spotList[G.kspot] === at ? ' kbd' : '';
      if (G.sel === 'F') {
        const c = at >> 2, d = at & 3, x = cx(c, W) + DC[d] * 4.4, y = cy(c, W) + DR[d] * 4.4, h = d % 2 ? 0 : 1;
        spots += `<g class="spot face${k}" data-spot="${at}"><rect class="hit" x="${x - (h ? 5 : 3)}" y="${y - (h ? 3 : 5)}" width="${h ? 10 : 6}" height="${h ? 6 : 10}"/>` +
          `<line x1="${x - h * 3.6}" y1="${y - (1 - h) * 3.6}" x2="${x + h * 3.6}" y2="${y + (1 - h) * 3.6}"/></g>`;
      } else spots += `<g class="spot${k}" data-spot="${at}"><rect class="hit" x="${(at % W) * CELL}" y="${Math.floor(at / W) * CELL}" width="10" height="10"/><circle cx="${cx(at, W)}" cy="${cy(at, W)}" r="1.6"/></g>`;
    }
  } else G.spotList = [];
  svg.querySelector('.spots').innerHTML = spots;
  S.fish.forEach((f, i) => placeFish(i, f));
  refresh();
}
// Where a fish rests: its cell's middle; or, on a cell with a diagonal mirror, in the corner on the mirror's shiny side (the
// middle is the plate itself), facing straight on the way it left the mirror. Never mid-turn.
function restOf(f) {
  const W = G.L.W, m = G.S.mir[f.p], x = cx(f.p, W), y = cy(f.p, W);
  if (!m || f.w) return { x, y, a: ANG[f.d] }; // a patroller swims straight through mirrors
  const din = Fry.TURN[m][f.d ^ 2] ^ 2; // the way it came in: back along the mirror
  return { x: x - DC[din] * 2.5 + DC[f.d] * 2.5, y: y - DR[din] * 2.5 + DR[f.d] * 2.5, a: ANG[f.d] };
}
// a point th degrees round the quarter turn from din to dout in cell c: an arc about the corner between the two edges
function arc(c, din, dout, th, W, a0) {
  const x = cx(c, W), y = cy(c, W), ix = DC[din], iy = DR[din], ox = DC[dout], oy = DR[dout], r = (th * Math.PI) / 180;
  const kx = x - ix * 5 + ox * 5, ky = y - iy * 5 + oy * 5, a1 = near(a0, ANG[dout]);
  return { x: kx + 5 * (ix * Math.sin(r) - ox * Math.cos(r)), y: ky + 5 * (iy * Math.sin(r) - oy * Math.cos(r)), a: a0 + ((a1 - a0) * th) / 90 };
}
function placeFish(i, f) {
  const el = G.fishEls[i];
  if (i === 0 && G.S.out) return; // the fry is swimming out of the tank: its own animation finishes it
  const p = restOf(f);
  el.angle = near(el.angle ?? p.a, p.a);
  el.style.transform = `translate(${p.x}px, ${p.y}px)`;
  el.querySelector('.o').style.transform = orient(el.angle);
  el.classList.toggle('gone', !f.a);
}

// One fish's swim through a tick, as points { x, y, a, t }: a its heading, t how far along in cells (0 at the start, 1 a cell on),
// so every fish crosses cells on the same clock. It swims edge to edge; at a mirror it curves round the corner on the shiny side
// (an arc about that corner, never touching the plate), and if it stops on a mirror cell it ends in that corner, facing straight
// on; at a flat mirror it swings round just short of the rock. cells: where it starts, then each cell it enters; dirs: its
// facing at the start, then on leaving each cell. a0: its heading now. straight: a patroller, which ignores mirrors.
function swimPath(cells, dirs, W, a0, straight = false) {
  const pts = [], C = (c) => [cx(c, W), cy(c, W)];
  let a = a0;
  const at = ([x, y], t) => pts.push({ x, y, a, t });
  // heading d into a flat mirror on (x, y)'s far face: nose up to it, swing round (over the top when going sideways), face back
  const uturn = ([x, y], d, t0) => {
    const turn = d === 1 ? -180 : 180;
    a = near(a, ANG[d]);
    at([x + DC[d] * 2.6, y + DR[d] * 2.6], t0 + .15);
    const m = ((a + turn / 2) * Math.PI) / 180;
    pts.push({ x: x + DC[d] * 2 + Math.cos(m) * 1.6, y: y + DR[d] * 2 + Math.sin(m) * 1.6, a: a + turn / 2, t: t0 + .3 });
    a += turn;
    at([x, y], t0 + .45);
  };
  const travel = (from, to) => { const d = to - from; return d === -W ? 0 : d === 1 ? 1 : d === W ? 2 : 3; };
  const mir0 = !straight && G.S.mir[cells[0]];
  if (mir0) { // resting in a mirror's corner: on out over the edge it faces
    const r0 = restOf({ p: cells[0], d: dirs[0] });
    a = near(a, r0.a);
    pts.push({ ...r0, a, t: 0 });
  } else {
    a = near(a, ANG[dirs[0]]);
    at(C(cells[0]), 0);
    if (travel(cells[0], cells[1]) !== dirs[0]) uturn(C(cells[0]), dirs[0], 0); // a flat mirror on its own cell's rock
  }
  for (let i = 1; i < cells.length; i++) {
    const din = travel(cells[i - 1], cells[i]), dout = dirs[i], [x, y] = C(cells[i]), last = i === cells.length - 1;
    a = near(a, ANG[din]);
    at([x - DC[din] * 5, y - DR[din] * 5], i - .5); // the edge it comes in over
    if (dout === din || straight) { if (last) at([x, y], i); continue; }
    if (dout === (din ^ 2)) { uturn([x, y], din, i - .5); if (last) at([x, y], i); continue; } // a flat mirror on this cell's far face
    const a0q = a;
    if (last) { // stopping here: round toward the corner and settle facing straight on the way out
      pts.push({ ...arc(cells[i], din, dout, 35, W, a0q), t: i - .25 });
      a = near(a0q, ANG[dout]);
      const r = restOf({ p: cells[i], d: dout });
      at([r.x, r.y], i);
    } else {
      for (const th of [22.5, 45, 67.5, 90]) pts.push({ ...arc(cells[i], din, dout, th, W, a0q), t: i - .5 + th / 90 });
      a = pts[pts.length - 1].a;
    }
  }
  return pts;
}
// play a swim path on fish element el over ms. Offsets come from cell progress, so all fish keep step: a fish crosses a cell in
// a tick, a fast one in half a tick (then waits). The body turns along the path; the size tag rides along upright.
function animateSwim(el, pts, ms, fast) {
  const k = (p) => Math.min(1, p.t / (fast ? 2 : 1)), last = pts[pts.length - 1];
  const frames = (f) => [...pts.map((p) => ({ ...f(p), offset: k(p) })), ...(k(last) < 1 ? [{ ...f(last), offset: 1 }] : [])];
  el.animate(frames((p) => ({ transform: `translate(${p.x}px, ${p.y}px)` })), { duration: ms, easing: 'linear' });
  el.querySelector('.o').animate(frames((p) => ({ transform: orient(p.a) })), { duration: ms, easing: 'linear' });
  el.angle = last.a;
}
// the fry, at the exit: on out through the gap and off the tank
function swimOut(el, ms) {
  const W = G.L.W, c = G.L.grid.indexOf('X'), d = c < W ? 0 : c >= W * (W - 1) ? 2 : c % W === 0 ? 3 : 1;
  const x = cx(c, W), y = cy(c, W), a = near(el.angle, ANG[d]), to = `translate(${x + DC[d] * 18}px, ${y + DR[d] * 18}px)`;
  el.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: to }], { duration: ms * 2, delay: ms, easing: 'ease-in', fill: 'forwards' });
  el.querySelector('.o').style.transform = orient(a);
  setTimeout(() => { el.style.transform = to; }, ms * 3);
}

function refresh() {
  const c = left();
  $('#tray').querySelectorAll('.slot').forEach((s, i) => {
    // of a type's slots, the first ones are the ones still in hand
    const t = s.dataset.type, before = G.L.items.slice(0, i).filter((x) => x === t).length, used = before >= c[t];
    s.classList.toggle('used', used);
    s.setAttribute('aria-pressed', String(!used && before === 0 && t === G.sel && !G.done && !G.fail));
    s.disabled = G.done || used || G.busy || !!G.fail;
    s.setAttribute('aria-label', (used ? T('{item}, placed', { item: ITEM[t] }) : ITEM[t]) + (t === '/' || t === '\\' ? ' ' + t : ''));
  });
  $('#tray').classList.toggle('busy', G.busy);
  $('#btn-undo').disabled = G.done || G.placed.length <= G.lock;
  $('#btn-reset').disabled = G.done || G.placed.length <= G.lock;
  $('#btn-hint').disabled = G.done || G.busy;
  $('#btn-fast').hidden = !G.busy;
  $('#btn-fast').setAttribute('aria-pressed', String(!!G.ff));
  $('#board').classList.toggle('busy', G.busy);
  $('#board').classList.toggle('failed', !!G.fail);
  $('#board').classList.toggle('aiming', !!G.sel && !G.busy && !G.fail && !G.done);
  $('#g-sub').textContent = G.tut ? '' : T('{n} of {k} placed', { n: G.placed.length, k: G.L.items.length });
  const alive = G.S.fish.filter((f, i) => i && f.a).length;
  $('#board').setAttribute('aria-label', T('Small Fry tank, {w} by {w}. {p} predators. {n} items left.', { w: G.L.W - 2, p: alive, n: itemsLeft() }));
}

// ---------- moves ----------
function choose(t) {
  if (!playing() || G.busy || G.fail || !t || !(left()[t] > 0) || !coachAllows({ pick: t })) return;
  G.sel = t;
  G.preview = null;
  G.kspot = -1;
  sfx.tap();
  draw();
}

function placeAt(at) {
  const t = G.sel;
  if (!playing() || G.busy || G.fail || !t || !(left()[t] > 0) || !Fry.canPlace(G.L, G.S, t, at)) return;
  if (!coachAllows({ t, at })) { G.preview = null; draw(); return; }
  Fry.place(G.S, t, at);
  G.placed.push([t, at]);
  G.preview = null;
  G.kspot = -1;
  G.moved = false;
  sfx.place();
  $('#sr').textContent = T('{item} placed.', { item: ITEM[t] });
  if (!(left()[t] > 0)) G.sel = firstLeft();
  tip('');
  swim();
}

// The fish act: tick after tick, each one shown swimming, until nobody sees anything they want
let runId = 0; // the swim in progress: anything that ends it (undo, another level) moves this on
const wait = (ms) => new Promise((done) => {
  let t = 0;
  const step = () => { if (!G.paused && !document.hidden) t += 40; if (t >= ms) done(); else setTimeout(step, 40); };
  setTimeout(step, 40);
});
async function swim() {
  const run = ++runId, seen = new Set(), L = G.L;
  G.busy = true;
  draw();
  for (;;) {
    const key = Fry.fishKey(G.S) + '/' + G.S.nb;
    if (seen.has(key)) return settle('loop');
    seen.add(key);
    const t = Fry.tick(L, G.S);
    if (!t.moved.length) return settle('stop');
    G.moved = true;
    const ms = G.ff ? FAST_MS : TICK_MS, calm = document.documentElement.hasAttribute('data-calm');
    t.moved.forEach((i, k) => {
      const el = G.fishEls[i], f = G.S.fish[i];
      if (!calm) animateSwim(el, swimPath(t.paths[k], t.turns[k], L.W, el.angle, f.w), ms, f.f);
      if (i === 0 && t.won) swimOut(el, calm ? 0 : ms);
      placeFish(i, f);
    });
    for (const i of t.eaten) { G.fishEls[i].classList.add('gone'); }
    if (t.eaten.length && !t.lost) sfx.erase();
    $('#board .looks').innerHTML = '';
    await wait(ms);
    if (run !== runId) return; // undone, or another level started
    if (t.lost) return settle('lose');
    if (t.won) { await wait(ms * 2); return run === runId && settle('win'); } // let it swim off first
    draw();
  }
}
function settle(res) {
  G.busy = false;
  G.states.push(Fry.clone(G.S));
  if (res === 'win') { draw(); $('#board').classList.add('solved'); win(); return; }
  if (res === 'lose') fail('eaten');
  else if (res === 'loop') fail('loop');
  else if (!itemsLeft()) fail('stuck');
  else { draw(); saveGame(); }
}
function fail(kind) {
  G.fail = kind;
  if (!G.tut) G.mistakes++;
  sfx.bad();
  tip(failText(), true);
  draw();
  flash($('#btn-undo'), 'psst');
  saveGame();
}

// Back to the tank after the first k placements. A fish move undone (no failure counted for it) costs a mistake.
function rewind(k) {
  if (G.moved && !G.fail && !G.tut) G.mistakes++;
  runId++;
  G.busy = false;
  G.S = Fry.clone(G.states[k]);
  G.states.length = k + 1;
  G.placed.length = k;
  G.fail = null;
  G.moved = false;
  G.preview = null;
  G.kspot = -1;
  G.sel = G.sel && left()[G.sel] > 0 ? G.sel : firstLeft();
  for (const el of G.fishEls) el.getAnimations().forEach((a) => a.cancel());
  tip('');
}
function undo() {
  if (!playing() || !coachAllows({ undo: true })) return;
  if (G.busy) rewind(G.placed.length - 1); // mid-swim: back before the placement that set them off
  else if (G.placed.length > G.lock) rewind(G.placed.length - 1);
  else return;
  sfx.erase();
  draw();
  saveGame();
}
async function reset() {
  if (!playing() || G.placed.length <= G.lock || !coachAllows({ reset: true })) return;
  if (!(await ask(T('Restart this level? Every item you placed comes back to the tray.')))) return;
  rewind(G.lock);
  sfx.erase();
  draw();
  saveGame();
}

// A hint: back to the last point where everything placed is part of the answer (and the rest can still follow), then one more
// item from the answer, placed and locked. Each costs a star.
function hint() {
  if (!playing() || G.busy || IMP || !coachAllows({ hint: true })) return;
  const { L } = G, ans = new Set(L.sol.map(([t, at]) => skey(t, at)));
  for (let k = G.placed.length; k >= G.lock; k--) {
    const pre = G.placed.slice(0, k);
    if (!pre.every(([t, at]) => ans.has(skey(t, at)))) continue;
    const rest = L.sol.filter(([t, at]) => !pre.some((p) => skey(...p) === skey(t, at)));
    const order = rest.length ? finish(pre, rest) : null;
    if (!order) continue;
    G.moved = false; // backing up for a hint costs the hint's star, not a mistake too
    if (k < G.placed.length || G.fail) rewind(k);
    G.hinted.add(G.hinted.size);
    G.lock = k + 1;
    G.sel = order[0][0];
    sfx.hint();
    track('hint');
    placeAt(order[0][1]);
    return;
  }
}
// an order of `rest` that wins after `pre` (all orders tried: at most 6! = 720 replays)
function finish(pre, rest) {
  const perm = (a) => (a.length < 2 ? [a] : a.flatMap((x, i) => perm([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
  return perm(rest).find((o) => Fry.replay(G.L, [...pre, ...o]) === 'win');
}

// ---------- input ----------
$('#tray').addEventListener('click', (e) => { const s = e.target.closest('.slot'); if (s) { G.kspot = -1; choose(s.dataset.type); } });
// Mouse: hovering a spot previews the looks with the item there; a click places it. Touch: the first tap previews, the second places.
$('#board').addEventListener('pointerover', (e) => {
  const s = e.target.closest('[data-spot]');
  if (e.pointerType !== 'mouse' || !s || !playing() || G.busy) return;
  if (G.preview !== +s.dataset.spot) { G.preview = +s.dataset.spot; draw(); }
});
$('#board').addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && G?.preview != null) { G.preview = null; draw(); } });
$('#board').addEventListener('click', (e) => {
  const s = e.target.closest('[data-spot]');
  if (!s || !playing() || G.busy) return;
  const at = +s.dataset.spot;
  if (G.preview === at || G.lastPointer === 'mouse') placeAt(at);
  else { G.preview = at; sfx.tap(); draw(); }
});
$('#board').addEventListener('pointerdown', (e) => { if (G) G.lastPointer = e.pointerType; });

// Keyboard: 1–9 pick an item from the tray, arrows step through the spots it can go, Enter or Space places it, U / Z / Backspace undo
function onKey(e) {
  const slots = [...$('#tray').querySelectorAll('.slot')];
  if (/^[1-9]$/.test(e.key) && +e.key <= slots.length) { G.kspot = -1; choose(slots[+e.key - 1].dataset.type); return true; }
  if (/^Arrow/.test(e.key) && G.spotList.length) {
    const n = G.spotList.length, d = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
    G.kspot = G.kspot < 0 ? (d > 0 ? 0 : n - 1) : (G.kspot + d + n) % n;
    G.preview = G.spotList[G.kspot];
    sfx.tap();
    draw();
    const at = G.preview, W = G.L.W, c = G.sel === 'F' ? at >> 2 : at;
    $('#sr').textContent = T('Row {r}, column {c}', { r: Math.floor(c / W), c: c % W });
    return true;
  }
  if ((e.key === 'Enter' || e.key === ' ') && G.kspot >= 0 && document.activeElement?.tagName !== 'BUTTON') { placeAt(G.spotList[G.kspot]); return true; }
  if (/^(u|U|z|Z|Backspace|Delete)$/.test(e.key)) { undo(); return true; }
  if (e.key === 'f' || e.key === 'F') { $('#btn-fast').click(); return true; }
  return false;
}

$('#btn-undo').onclick = undo;
$('#btn-reset').onclick = reset;
$('#btn-hint').onclick = hint;
$('#btn-fast').onclick = () => { if (G) { G.ff = !G.ff; refresh(); } };

// ---------- the menu's fish ----------
// The fry's look bends up off a mirror, past a grouper that never sees it
{
  const fish = (cls, s, x, y, k, t = '') => `<g class="fish ${cls}" transform="translate(${x} ${y})${t} scale(${k})">${fishArt(s, false)}</g>`;
  $('#logo').innerHTML = `<svg viewBox="0 0 120 72" aria-hidden="true"><path class="look fry wants" d="M38 42H80V4"/>` +
    `<g class="item" transform="translate(80 42) rotate(-45) scale(2)">${plate(11)}</g>` +
    `${fish('grouper pred', 5, 98, 58, 3.4, ' scale(-1 1)')}${fish('fry', 1, 22, 42, 4)}</svg>`;
}

// Tutorial: the fry looks right, at rock; a / on the ringed cell turns its look up to the exit overhead.
const tutSpot = () => $('#board .spot[data-spot="17"]') || $('#board .tank');
boot({ name: T('Small Fry'), storeKey: 'smallfry', glyphs: ['🐟', '◆'], start: startLevel, ownIntro: false,
  tutorial: [
    [T('Each fish looks only straight ahead: the dotted lines show where. The fry (orange) is looking at rock. Pick the <b>mirror</b> below.'),
      () => G.sel === '/', () => $('#tray .slot'), (m) => m.pick === '/'],
    [T('Items go only where a fish is looking. Tap the ringed spot (once to see how the looks bend, again to place it): the fry will see the <b>exit</b> and swim for it.'),
      null, tutSpot, (m) => m.at === 17 || m.pick === '/'],
  ],
  save: (G) => ({ placed: G.placed, mistakes: G.mistakes, hints: G.hinted.size, lock: G.lock }), key: onKey,
  stars: (G) => Math.max(1, (G.mistakes === 0 ? 3 : G.mistakes <= 2 ? 2 : 1) - G.hinted.size),
  reveal: () => {
    runId++;
    G.busy = false;
    G.fail = null;
    G.S = Fry.initial(G.L);
    G.placed = [];
    for (const [t, at] of G.L.sol) { Fry.place(G.S, t, at); G.placed.push([t, at]); Fry.run(G.L, G.S); }
    G.lock = G.placed.length;
    G.sel = null;
    G.preview = null;
    draw();
  } });
game.impossible = { stars: game.stars };
