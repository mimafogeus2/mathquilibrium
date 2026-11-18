'use strict';
// Small Fry: get the fry out of the tank. Pick an item from the tray and put it where a fish is looking; after each one the fish
// act (each swims for what it sees and wants), then you place the next. Rules and levels: gen.js (the global Fry), levels.js.

const CELL = 10, CROP = 5, SVGNS = 'http://www.w3.org/2000/svg';
const TICK_MS = 280, FAST_MS = 70, HINTS = 3;
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
  const tail = `<g class="tailg"><path d="${p.tail}"/></g>`; // it beats in CSS: slow at rest, fast while swimming
  return `<g transform="scale(${p.sc})">` +
    (fast ? `<path class="pl yellow speed" d="M${p.joint - 6.4}-2.4h-3.4M${p.joint - 7.4} 0h-4.6M${p.joint - 6.4} 2.4h-3.4"/>` : '') +
    // a bare-paper margin round the whole fish, so it lifts off the halftone behind it
    `<g class="halo">${tail}<path d="${p.body}"/><path d="${p.fins}"/>${p.extra ? '<circle cx="10.6" cy="-8.4" r="1.5"/>' : ''}</g>` +
    `<g class="pl ${p.a}">${tail}<path d="${p.body}"/><path d="${p.fins}"/></g>` +
    `<g class="pl ${p.b} over">${p.over(p, tail)}</g>` +
    `<g class="paper">${p.paper}<circle cx="${ex}" cy="${ey}" r="${er}"/></g>` + (p.extra || '') +
    `<circle class="pl blue pupil" cx="${ex + er * .3}" cy="${ey}" r="${er * .55}"/>` +
    // the lid, in the body's ink, drops from the top: shut for a blink, half down in a hunter's squint
    `<rect class="pl ${p.a} lid" x="${ex - er - .1}" y="${ey - er - .1}" width="${2 * er + .2}" height="${2 * er + .2}" rx="${er}"/></g>`;
}
// A fish's pose: { a: rotation in degrees, fx: 1 or -1, which way it faces in the side view }. Heading right is a 0 fx 1, left a 0
// fx -1 (upright both ways); up and down are a quarter turn from whichever side it faced. So turning round left↔right turns the
// body toward you (fx passes through 0) instead of rolling it upside down, and a turn between sideways and up or down banks.
const poseFor = (d, fx = 1) => (d === 1 ? { a: 0, fx: 1 } : d === 3 ? { a: 0, fx: -1 } : { a: (d === 0 ? -90 : 90) * fx, fx });
const orient = (p) => `rotate(${p.a.toFixed(1)}deg) scale(${p.fx.toFixed(3)}, 1)`;
const ease = (k) => k * k * (3 - 2 * k);
const mix = (p, q, k) => ({ a: p.a + (q.a - p.a) * k, fx: p.fx + (q.fx - p.fx) * ease(k) });

// Items. A mirror is a bare paper plate edged in blue with a couple of glare strokes; a bolted one is tinted and riveted. A flat
// mirror is the same plate on brackets against the rock; bait a pink worm.
const plate = (len) => `<rect class="glass" x="${-len / 2}" y="-.9" width="${len}" height="1.8" rx=".5"/>` +
  `<path class="pl blue glare" d="M${-len / 2 + 1.6}-.1l.9-.5M${-len / 2 + 2.8}.3l1.2-.8M${len / 2 - 2.6}.1l.8-.5"/>`;
// The bait wriggles: its body ripples through a few curves (the same path shape each time, so it morphs smoothly), head following
const WORM = ['M-3.2.6C-2.2-.6-.8 1.1.6 0S2.6-.9 3.2.2', 'M-3.2.3C-2.1 1-.7-.6.7.3S2.5.6 3.2-.1', 'M-3.2.1C-2.2-.9-.9.9.7.4S2.5-.6 3.2.4'];
const HEAD = [[3.3, .2], [3.3, -.1], [3.3, .4]];
const worm = () => {
  const spline = 'calcMode="spline" keyTimes="0;.33;.67;1" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" dur="2.6s" repeatCount="indefinite"';
  const live = calm() ? ['', '', ''] : [`<animate attributeName="d" values="${[...WORM, WORM[0]].join(';')}" ${spline}/>`,
    `<animate attributeName="cx" values="${[...HEAD, HEAD[0]].map((h) => h[0]).join(';')}" ${spline}/>`, `<animate attributeName="cy" values="${[...HEAD, HEAD[0]].map((h) => h[1]).join(';')}" ${spline}/>`];
  return `<g class="pl pink bait"><path d="${WORM[0]}">${live[0]}</path><circle cx="${HEAD[0][0]}" cy="${HEAD[0][1]}" r=".8">${live[1]}${live[2]}</circle></g>`;
};
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
  : t === 'B' ? `<g transform="translate(4.6 5) scale(1.1)">${worm()}</g>` : `<g transform="translate(5 5) rotate(${t === '/' ? -45 : 45})">${plate(11)}</g>`);
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

// The view: just the cave and half a cell of rock round it (the exit, in the border, shows half), so the tank fills the screen
function viewOf(L) {
  const W = L.W, cells = [...L.grid].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
  const cols = cells.map((c) => c % W), rows = cells.map((c) => Math.floor(c / W));
  const x = Math.min(...cols) * CELL - CROP, y = Math.min(...rows) * CELL - CROP;
  return { x, y, w: (Math.max(...cols) + 1) * CELL + CROP - x, h: (Math.max(...rows) + 1) * CELL + CROP - y };
}
// The tank, printed risograph style in four spot inks on the page's own paper. The water is the paper, screened with blue
// halftone dots that grow toward the floor; light falls through as paper-white bands. Rock is solid blue with gentle strata;
// ledges are pale-blue sand banks. Kelp is teal, starfish pink, shells yellow, and daylight comes in through the exit as a yellow
// burst. Each ink sits a hair out of register. Nothing decorative is in open water, where it could pass for an item.
const star = (x, y, r) => 'M' + Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? r * .42 : r; return `${(x + Math.cos(a) * k).toFixed(2)} ${(y + Math.sin(a) * k).toFixed(2)}`; }).join('L') + 'Z';
function tankSvg(L, vb = viewOf(L)) {
  const W = L.W, g = L.grid, S = CELL * W, R = 3.2, seed = h32([...g].reduce((a, ch, i) => a + (ch === '#' ? i * 31 : 0), W));
  const rock = (c, dr, dc) => { const r = Math.floor(c / W) + dr, q = (c % W) + dc; return r < 0 || q < 0 || r >= W || q >= W || g[r * W + q] === '#'; };
  let rocks = '', fill = '', sand = '', kelp = '', pink = '', yellow = '', bubbles = '', exit = '', burst = '';
  for (let c = 0; c < W * W; c++) {
    const x = (c % W) * CELL, y = Math.floor(c / W) * CELL, hh = h32(c + seed);
    if (g[c] === '#') {
      // round a corner where both its sides face water; reach a hair into rock neighbours so the mass has no seams
      const up = rock(c, -1, 0), dn = rock(c, 1, 0), lf = rock(c, 0, -1), rt = rock(c, 0, 1);
      const x0 = x - (lf ? .3 : 0), x1 = x + 10 + (rt ? .3 : 0), y0 = y - (up ? .3 : 0), y1 = y + 10 + (dn ? .3 : 0);
      const tl = !up && !lf ? R : 0, tr = !up && !rt ? R : 0, br = !dn && !rt ? R : 0, bl = !dn && !lf ? R : 0;
      rocks += `M${x0 + tl} ${y0}H${x1 - tr}${tr ? `A${tr} ${tr} 0 0 1 ${x1} ${y0 + tr}` : ''}V${y1 - br}${br ? `A${br} ${br} 0 0 1 ${x1 - br} ${y1}` : ''}` +
        `H${x0 + bl}${bl ? `A${bl} ${bl} 0 0 1 ${x0} ${y1 - bl}` : ''}V${y0 + tl}${tl ? `A${tl} ${tl} 0 0 1 ${x0 + tl} ${y0}` : ''}Z`;
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
      // the gap is open to daylight: bare paper through the rock, a soft yellow glow screened into the water just inside it
      // (it fades out from the gap), and a small arrow drifting out
      const d = c < W ? 0 : c >= W * (W - 1) ? 2 : c % W === 0 ? 3 : 1, mx = x + 5, my = y + 5, rot = [0, 90, 180, 270][d];
      exit = `<rect class="paper" x="${x}" y="${y}" width="10" height="10"/>` +
        `<g transform="translate(${mx - DC[d] * 1.2} ${my - DR[d] * 1.2}) rotate(${rot})"><g class="way-out"><path d="M0 2.6V-1.8M-1.9 .2L0-1.9L1.9 .2"/></g></g>`;
      burst = `<circle cx="${mx}" cy="${my}" r="16" fill="url(#ht-sun)" mask="url(#glowfade)"/>`;
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

  // strata: gentle wavy layers through the rock, in a deeper blue, clipped to it
  let strata = '';
  for (let y = 4 + (seed % 3); y < S; y += 6.5) {
    strata += `M0 ${y.toFixed(1)}`;
    for (let x = 0; x < S; x += 10) strata += `q5 ${(((h32(seed + y * 7 + x) % 3) - 1) * 1.1).toFixed(1)} 10 0`;
  }
  const shafts = [.18, .46, .74].map((f, i) => `<path d="M${vb.x + vb.w * f} ${vb.y}h${vb.w * (.06 + i * .02)}l${vb.w * .16} ${vb.h}h-${vb.w * (.1 + i * .02)}Z"/>`).join('');
  // halftone screens: the water's dots grow with depth, band by band
  const dots = (id, r, ink, step = 1.6) => `<pattern id="${id}" width="${step}" height="${step}" patternUnits="userSpaceOnUse" patternTransform="rotate(15)"><circle cx="${step / 2}" cy="${step / 2}" r="${r}" class="ink-${ink}"/></pattern>`;
  const BANDS = 7, deep = Array.from({ length: BANDS }, (_, i) => `<rect y="${(S * i) / BANDS}" width="${S}" height="${S / BANDS + .2}" fill="url(#ht${i})"/>`).join('');
  return `<defs>${Array.from({ length: BANDS }, (_, i) => dots('ht' + i, .06 + i * .032, 'water', 1.7)).join('')}${dots('ht-teal', .38, 'teal', 1.6)}${dots('ht-pink', .34, 'pink', 1.3)}${dots('ht-sun', .55, 'yellow', 1.4)}` +
    `<clipPath id="tank"><rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}"/></clipPath>` +
    `<radialGradient id="glowg"><stop offset=".25" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<mask id="glowfade" maskContentUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5" fill="url(#glowg)"/></mask><filter id="wobble" filterUnits="userSpaceOnUse" x="${vb.x - 4}" y="${vb.y - 4}" width="${vb.w + 8}" height="${vb.h + 8}">` +
    `<feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="${seed % 97}"/><feDisplacementMap in="SourceGraphic" scale="1.6" xChannelSelector="R" yChannelSelector="G"/></filter>` +
    `<clipPath id="rockclip"><path d="${rocks}${fill}"/></clipPath></defs>` +
    `<g clip-path="url(#tank)"><rect class="sea" width="${S}" height="${S}"/>` +
    `<g class="pl blue water">${deep}</g><g class="shafts">${shafts}</g>` +
    `<g class="pl yellow burst">${burst}</g>` +
    `<g class="pl blue bubbles">${bubbles}</g><g class="pl teal kelp">${kelp}</g>` +
    `<path class="pl blue rock" filter="url(#wobble)" d="${rocks}${fill}"/><path class="strata" clip-path="url(#rockclip)" d="${strata}"/>${exit}` +
    `<path class="sand" filter="url(#wobble)" d="${sand}"/><path class="ripple" d="${ripple}"/><g class="pl pink">${pink}</g><g class="pl yellow">${yellow}</g></g>`;
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
  const vb = viewOf(L);
  $('#game').dataset.tier = G.tut ? 'T' : G.pack; // each difficulty has its own water (style.css)
  b.style.setProperty('--ar', (vb.w / vb.h).toFixed(4));
  b.innerHTML = `<svg class="tank" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" xmlns="${SVGNS}" aria-hidden="true">${tankSvg(L, vb)}<g class="rails">${railsSvg(L)}</g><g class="items"></g><g class="looks"></g><g class="spots"></g><g class="fishes" clip-path="url(#tank)"></g><g class="fx" clip-path="url(#tank)"></g></svg>`;
  G.fishEls = L.fish.map((f) => {
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', `fish ${speciesOf(f.s).name}${f.s === 1 ? ' fry' : ' pred'}${f.f ? ' fast' : ''}`);
    // the size, on a small tag above it: who eats whom
    g.innerHTML = `<g class="bob"><g class="o">${fishArt(f.s, f.f)}</g></g>` + (f.s > 1 ? `<g class="size"><circle cy="-5.6" r="1.75"/><text y="-4.9">${f.s}</text></g>` : '');
    g.style.setProperty('--ph', `-${(h32(f.p * 13 + f.s) % 300) / 100}s`); // each on its own beat
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
  // moods: a fish that sees what it wants is hunting (or, the fry, eager); the fry is scared when a bigger fish's look passes
  // right beside it
  const near = new Set(), fry = V.fish[0], mood = V.fish.map(() => '');
  svg.querySelector('.looks').innerHTML = G.done && S.out ? '' : V.fish.map((f, i) => {
    if (!f.a || f.w) return ''; // a patroller looks at nothing
    const pts = [], v = Fry.look(L, V, i, occ, pts), wants = v.t >= 0;
    if (wants) mood[i] = i ? 'hunting' : 'eager';
    if (i && fry.a && v.sc.some((c) => [1, -1, W, -W].includes(c - fry.p))) near.add(i);
    if (pts.length < 2) return '';
    if (V.mir[f.p]) { const r = restOf(f); pts[0] = [r.x / CELL, r.y / CELL]; } // from the corner it rests in, not the plate
    const d = 'M' + pts.map(([x, y]) => `${(x * CELL).toFixed(1)} ${(y * CELL).toFixed(1)}`).join('L');
    const cls = `${speciesOf(f.s).name}${wants ? ' wants' : ''}`;
    return `<path class="gaze ${cls}" d="${d}"/><path class="look ${cls}" d="${d}"/>`; // a soft band, and the line itself
  }).join('');
  if (near.size && !mood[0]) mood[0] = 'scared';
  G.fishEls.forEach((el, i) => { for (const m of ['hunting', 'eager', 'scared']) el.classList.toggle(m, mood[i] === m && !G.busy); });
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
      } else spots += `<g class="spot${k}" data-spot="${at}"><rect class="hit" x="${(at % W) * CELL}" y="${Math.floor(at / W) * CELL}" width="10" height="10"/><circle class="ring" cx="${cx(at, W)}" cy="${cy(at, W)}" r="1.5"/><circle class="pip" cx="${cx(at, W)}" cy="${cy(at, W)}" r=".55"/></g>`;
    }
  } else G.spotList = [];
  svg.querySelector('.spots').innerHTML = spots;
  S.fish.forEach((f, i) => placeFish(i, f));
  refresh();
}
// Where a fish rests: its cell's middle; or, on a cell with a diagonal mirror, in the corner on the mirror's shiny side (the
// middle is the plate itself), facing straight on the way it left the mirror. Never mid-turn. fx: which side it faced before.
function restOf(f, fx = 1) {
  const W = G.L.W, m = G.S.mir[f.p], x = cx(f.p, W), y = cy(f.p, W), pose = poseFor(f.d, fx);
  if (!m || f.w) return { x, y, ...pose }; // a patroller swims straight through mirrors
  const din = Fry.TURN[m][f.d ^ 2] ^ 2; // the way it came in: back along the mirror
  return { x: x - DC[din] * 2.5 + DC[f.d] * 2.5, y: y - DR[din] * 2.5 + DR[f.d] * 2.5, ...pose };
}
// a point th degrees round the quarter turn from din to dout in cell c: an arc about the corner between the two edges
function arcAt(c, din, dout, th, W) {
  const x = cx(c, W), y = cy(c, W), ix = DC[din], iy = DR[din], ox = DC[dout], oy = DR[dout], r = (th * Math.PI) / 180;
  const kx = x - ix * 5 + ox * 5, ky = y - iy * 5 + oy * 5;
  return { x: kx + 5 * (ix * Math.sin(r) - ox * Math.cos(r)), y: ky + 5 * (iy * Math.sin(r) - oy * Math.cos(r)) };
}
function placeFish(i, f) {
  const el = G.fishEls[i];
  if (i === 0 && G.S.out) return; // the fry is swimming out of the tank: its own animation finishes it
  const p = restOf(f, el.pose?.fx ?? 1);
  el.pose = { a: p.a, fx: p.fx };
  el.style.transform = `translate(${p.x}px, ${p.y}px)`;
  el.querySelector('.o').style.transform = orient(el.pose);
  el.classList.toggle('gone', !f.a);
}

// One fish's swim through a tick, as points { x, y, a, fx, t }: its pose there, and t how far along in cells (0 at the start, 1 a
// cell on), so every fish crosses cells on the same clock. It swims edge to edge; at a mirror it curves round the corner on the
// shiny side (an arc about that corner, never touching the plate), and if it stops on a mirror cell it ends in that corner,
// facing straight on; at a flat mirror it swims up short of the rock and turns round. cells: where it starts, then each cell it
// enters; dirs: its facing at the start, then on leaving each cell. pose0: its pose now. straight: a patroller (ignores mirrors).
function swimPath(cells, dirs, W, pose0, straight = false) {
  const pts = [], C = (c) => [cx(c, W), cy(c, W)];
  let pose = pose0;
  const at = ([x, y], t, p = pose) => { pose = p; pts.push({ x, y, ...p, t }); };
  // heading d into a flat mirror on (x, y)'s far face: nose up to it, turn round (toward you if sideways), swim back to the middle
  const uturn = ([x, y], d, t0) => {
    const from = poseFor(d, pose.fx), to = poseFor(d ^ 2, d % 2 ? -from.fx : from.fx);
    at([x + DC[d] * 2.6, y + DR[d] * 2.6], t0 + .15, from);
    const mid = d % 2 ? { a: 0, fx: 0 } : { a: 0, fx: from.fx }; // sideways: face you; up or down: swing through level
    at([x + DC[d] * 2.2 + (d % 2 ? 0 : 1.4 * from.fx), y + DR[d] * 2.2 + (d % 2 ? -.6 : 0)], t0 + .3, mid);
    at([x, y], t0 + .45, to);
  };
  const travel = (from, to) => { const d = to - from; return d === -W ? 0 : d === 1 ? 1 : d === W ? 2 : 3; };
  if (!straight && G.S.mir[cells[0]]) { // resting in a mirror's corner: on out over the edge it faces
    const r0 = restOf({ p: cells[0], d: dirs[0] }, pose.fx);
    at([r0.x, r0.y], 0, { a: r0.a, fx: r0.fx });
  } else {
    at(C(cells[0]), 0, poseFor(dirs[0], pose.fx));
    if (travel(cells[0], cells[1]) !== dirs[0]) uturn(C(cells[0]), dirs[0], 0); // a flat mirror on its own cell's rock
  }
  for (let i = 1; i < cells.length; i++) {
    const din = travel(cells[i - 1], cells[i]), dout = dirs[i], [x, y] = C(cells[i]), last = i === cells.length - 1;
    at([x - DC[din] * 5, y - DR[din] * 5], i - .5, poseFor(din, pose.fx)); // the edge it comes in over
    if (dout === din || straight) { if (last) at([x, y], i); continue; }
    if (dout === (din ^ 2)) { uturn([x, y], din, i - .5); if (last) at([x, y], i); continue; } // a flat mirror on this cell's far face
    const p0 = pose, p1 = poseFor(dout, pose.fx);
    if (last) { // stopping here: bank toward the corner and settle facing straight on the way out
      at(Object.values(arcAt(cells[i], din, dout, 35, W)), i - .25, mix(p0, p1, .5));
      const r = restOf({ p: cells[i], d: dout }, p1.fx);
      at([r.x, r.y], i, p1);
    } else for (const th of [22.5, 45, 67.5, 90]) at(Object.values(arcAt(cells[i], din, dout, th, W)), i - .5 + th / 90, mix(p0, p1, th / 90));
  }
  return pts;
}
// Play a swim path on fish element el over ms. Offsets come from cell progress, so all fish keep step: a fish crosses a cell in a
// tick, a fast one in half a tick (then waits). One setting off from rest eases in. The size tag rides along upright.
function animateSwim(el, pts, ms, fast, start) {
  const k = (p) => Math.min(1, p.t / (fast ? 2 : 1)), last = pts[pts.length - 1];
  const frames = (f) => [...pts.map((p) => ({ ...f(p), offset: k(p) })), ...(k(last) < 1 ? [{ ...f(last), offset: 1 }] : [])];
  const easing = start ? 'cubic-bezier(.5, 0, .9, 1)' : 'linear';
  el.animate(frames((p) => ({ transform: `translate(${p.x}px, ${p.y}px)` })), { duration: ms, easing });
  el.querySelector('.o').animate(frames((p) => ({ transform: orient(p) })), { duration: ms, easing });
  el.pose = { a: last.a, fx: last.fx };
}
// the fry, at the exit: on out through the gap and off the tank, speeding up
function swimOut(el, ms) {
  const W = G.L.W, c = G.L.grid.indexOf('X'), d = c < W ? 0 : c >= W * (W - 1) ? 2 : c % W === 0 ? 3 : 1;
  const x = cx(c, W), y = cy(c, W), to = `translate(${x + DC[d] * 18}px, ${y + DR[d] * 18}px)`;
  el.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: to }], { duration: ms * 2, delay: ms, easing: 'ease-in', fill: 'forwards' });
  el.querySelector('.o').style.transform = orient(poseFor(d, el.pose?.fx ?? 1));
  setTimeout(() => { el.style.transform = to; }, ms * 3);
}
// ---------- sound ----------
// Underwater sounds, synthesized (no files), quiet, and off with the site's mute: a soft plip as fish swim, a gulp, bubbles
// when the fry gets out. A context of its own, made on first use (after a tap, as browsers require).
const water = (() => {
  let ctx;
  const tone = (freq, { dur = .12, type = 'sine', vol = .06, at = 0, slide } = {}) => {
    if (muted()) return;
    try {
      ctx ??= new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state !== 'running') ctx.resume();
      const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      f.type = 'lowpass'; f.frequency.value = 1800; // muffled, as under water
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .015); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(f).connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + .05);
    } catch {}
  };
  return {
    plip: () => tone(520 + Math.random() * 120, { dur: .07, vol: .018, slide: 760 }),
    gulp: () => { tone(260, { dur: .16, type: 'triangle', vol: .09, slide: 90 }); tone(1200, { dur: .05, vol: .03, at: .12, slide: 600 }); },
    bubbles: () => [0, 1, 2, 3, 4].forEach((k) => tone(600 + k * 180 + Math.random() * 80, { dur: .06, vol: .035, at: k * .07, slide: 1100 + k * 200 })),
  };
})();

// ---------- moments ----------
// Small printed bursts on the fx layer, each removed when it's done: ink splashing from a gulp, bubbles and light where the fry
// gets out, a ripple where an item lands.
function fx(html, ms) {
  const g = document.createElementNS(SVGNS, 'g');
  g.innerHTML = html;
  $('#board .fx')?.append(g);
  setTimeout(() => g.remove(), ms);
  return g;
}
function splash(x, y, species) {
  if (calm()) return;
  const g = fx(Array.from({ length: 9 }, (_, k) => `<circle class="drop ${species}" cx="${x}" cy="${y}" r="${(.5 + (k % 3) * .3).toFixed(1)}"/>`).join(''), 900);
  [...g.children].forEach((d, k) => {
    const a = (k / 9) * Math.PI * 2 + Math.random() * .5, r = 4 + Math.random() * 4;
    d.animate([{ transform: 'translate(0, 0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r + 2}px)`, opacity: 0 }], { duration: 650 + Math.random() * 200, easing: 'cubic-bezier(.2, .8, .3, 1)', fill: 'forwards' });
  });
}
function escapeBurst(x, y) {
  if (calm()) return;
  const g = fx(`<circle class="flash" cx="${x}" cy="${y}" r="3"/>` + Array.from({ length: 10 }, (_, k) => `<circle class="bub" cx="${x + (k % 5 - 2) * 1.6}" cy="${y}" r="${(.5 + (k % 4) * .25).toFixed(2)}"/>`).join(''), 1600);
  g.firstChild.animate([{ r: 3, opacity: .9 }, { r: 16, opacity: 0 }], { duration: 700, easing: 'ease-out', fill: 'forwards' });
  [...g.children].slice(1).forEach((b, k) => b.animate([{ transform: 'translate(0, 0)', opacity: 0 }, { opacity: 1, offset: .15 },
    { transform: `translate(${(Math.random() - .5) * 6}px, ${-8 - Math.random() * 12}px)`, opacity: 0 }], { duration: 900 + k * 60, delay: k * 40, easing: 'ease-out', fill: 'both' }));
}
function ripple(x, y) {
  if (calm()) return;
  const g = fx(`<circle class="rip" cx="${x}" cy="${y}" r="2"/>`, 700);
  g.firstChild.animate([{ r: 2, opacity: .8 }, { r: 7, opacity: 0 }], { duration: 600, easing: 'ease-out', fill: 'forwards' });
}
// the eater's lunge: a quick stretch forward and back
const chomp = (el) => el.querySelector('.bob')?.animate([{ scale: '1' }, { scale: '1.22' }, { scale: '1' }], { duration: 260, easing: 'ease-out' });

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
  // three hints a level: the chip counts down what's left
  $('#btn-hint').disabled = G.done || G.busy || G.hinted.size >= HINTS;
  $('#btn-hint .left').textContent = HINTS - G.hinted.size;
  $('#btn-hint').setAttribute('aria-label', T('Hint ({n} left)', { n: HINTS - G.hinted.size }));
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
  { const W = G.L.W, c = t === 'F' ? at >> 2 : at; ripple(cx(c, W) + (t === 'F' ? DC[at & 3] * 4 : 0), cy(c, W) + (t === 'F' ? DR[at & 3] * 4 : 0)); }
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
    water.plip();
    const ms = G.ff ? FAST_MS : TICK_MS, calm = document.documentElement.hasAttribute('data-calm');
    G.fishEls.forEach((el, i) => { const m = t.moved.includes(i); el.classList.toggle('swimming', m); el.dataset.was = el.dataset.now || ''; el.dataset.now = m ? '1' : ''; });
    t.moved.forEach((i, k) => {
      const el = G.fishEls[i], f = G.S.fish[i];
      if (!calm) animateSwim(el, swimPath(t.paths[k], t.turns[k], L.W, el.pose ?? poseFor(t.turns[k][0]), f.w), ms, f.f, !el.dataset.was);
      if (i === 0 && t.won) {
        swimOut(el, calm ? 0 : ms);
        const c = L.grid.indexOf('X');
        setTimeout(() => { escapeBurst(cx(c, L.W), cy(c, L.W)); water.bubbles(); }, ms * 1.1);
      }
      placeFish(i, f);
    });
    // whoever ate lunges
    for (const j of t.eaten) {
      const eater = t.moved.filter((i) => G.S.fish[i].s > G.S.fish[j].s).sort((a, b) => G.S.fish[b].s - G.S.fish[a].s).find((i) => G.S.fish[i].p === G.S.fish[j].p || t.paths[t.moved.indexOf(i)].includes(G.S.fish[j].p));
      if (eater !== undefined && !calm) setTimeout(() => chomp(G.fishEls[eater]), ms * .8);
      const prey = G.S.fish[j], p = restOf(prey);
      setTimeout(() => { splash(p.x, p.y, speciesOf(prey.s).name); water.gulp(); }, ms * .8);
    }
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
  for (const el of G.fishEls) { el.classList.remove('swimming'); el.dataset.now = ''; }
  G.states.push(Fry.clone(G.S));
  if (res === 'win') { draw(); $('#board').classList.add('solved'); win(); return; }
  if (res === 'lose') fail('eaten');
  else if (res === 'loop') fail('loop');
  else if (!itemsLeft()) fail('stuck');
  else { draw(); saveGame(); }
}
function fail(kind) {
  G.fail = kind;
  if (!calm()) flash($('#board'), 'shake');
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
  for (const el of G.fishEls) el.getAnimations({ subtree: true }).forEach((a) => !(a instanceof CSSAnimation) && a.cancel()); // the swims, not the idle beat
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
  if (G.hinted.size >= HINTS) return;
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
