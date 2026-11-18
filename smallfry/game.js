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

// Fish, one species per size, facing right with the middle at (0, 0). Drawn in their own units, `sc` brings them to tank size
// (the fry about two thirds of a cell, a shark more than a cell). joint: where the tail swings from.
const SPECIES = {
  1: { name: 'fry', sc: .44, joint: -4.4, gill: [1, 2.4],  eye: [2.6, -1, 1.45],
    body: 'M-5 0C-4.6-3.8 1.6-5 5.6-1.6Q6.6 0 5.6 1.6C1.6 5-4.6 3.8-5 0Z',
    tail: 'M-4.4 0C-6.5-1.2-8.6-4.6-9.4-4C-8.4-1.4-8.4 1.4-9.4 4C-8.6 4.6-6.5 1.2-4.4 0Z',
    fins: 'M-1.8-3.6Q.4-5.8 2.2-3.8Z', marks: '<path class="shine" d="M-2.6 2Q1.2 3.4 4.2 1.3"/><path class="line rays" d="M-5.2 0L-8.4-2.6M-5.4 0H-8.8M-5.2 0L-8.4 2.6"/>' },
  2: { name: 'minnow', sc: .4, joint: -7.2, gill: [4.2, 1.7],  eye: [5.6, -.9, 1.05],
    body: 'M-8 0C-6.4-2.8 2.4-3.6 8.2-.8Q9 0 8.2.8C2.4 3.6-6.4 2.8-8 0Z',
    tail: 'M-7.2 0L-11.4-3.6Q-10.2-1.2-9.4 0Q-10.2 1.2-11.4 3.6Z',
    fins: 'M-1.5-2.8L.5-4.6L1.6-3ZM-.5 2.6L.6 4.2L1.8 2.8Z', marks: '<path class="shine" d="M-6 .3L6.8-.2"/>' },
  3: { name: 'perch', sc: .5, joint: -6.6, gill: [3.4, 3],  eye: [5.2, -1.2, 1.05],
    body: 'M-7.4 0C-6.6-4.6 1.8-6 7.8-1.4Q8.8 0 7.8 1.4C1.8 5.4-6.6 4.2-7.4 0Z',
    tail: 'M-6.6 0L-10.8-4.2Q-9.6 0-10.8 4.2Z',
    fins: 'M-3.6-3.9L-3-7L-1.8-4.6L-.9-7.4L.3-4.9L1.3-6.8L2.6-4.4ZM1.5 3.8L.6 6L3 4.2Z',
    marks: '<path class="band" d="M-3.2-4.2Q-2.4 0-3.2 4L-1.8 4.4Q-1 0-1.8-4.7ZM.6-4.8Q1.4 0 .6 4.5L2 4.2Q2.8 0 2-4.4ZM4-3.6Q4.6 0 4 3.4L5.1 2.8Q5.6 0 5.1-2.9Z"/>' },
  4: { name: 'pike', sc: .44, joint: -9.6, gill: [6.6, 1.7],  eye: [8.4, -1, .95],
    body: 'M-10.5 0C-8.6-2.6 3.4-3.4 10.4-1L12.8-.2L11.6.5L12.4 1C4 3.4-8.6 2.6-10.5 0Z',
    tail: 'M-9.6 0L-13.6-3.8L-12.4 0L-13.6 3.8Z',
    fins: 'M-6.5-2.3L-4.4-4.4L-3.4-2.6ZM-6.5 2.3L-4.4 4.2L-3.4 2.4Z',
    marks: '<g class="spot"><circle cx="-5" cy="-.6" r=".7"/><circle cx="-2" cy=".9" r=".6"/><circle cx="1" cy="-1" r=".7"/><circle cx="4" cy=".6" r=".55"/><circle cx="-7.5" cy=".6" r=".5"/></g><path class="line" d="M9.4.3L12.2.2"/>' },
  5: { name: 'grouper', sc: .56, joint: -7.6, gill: [3.4, 4],  eye: [5.8, -2.2, 1.2],
    body: 'M-8.4 0C-8.4-6.6 4.2-7.6 9.6-2.4Q10.2-.6 9 .2Q10.4 1.2 9.4 2.4C4.2 7.6-8.4 6.6-8.4 0Z',
    tail: 'M-7.6 0C-10.4-4.6-12.8-4.4-12.4 0C-12.8 4.4-10.4 4.6-7.6 0Z',
    fins: 'M-5-5C-3-8 3-8 4.6-5Z',
    marks: '<g class="dot"><circle cx="-3" cy="-2" r=".9"/><circle cx="0" cy="2" r=".8"/><circle cx="2.6" cy="-2.6" r=".7"/><circle cx="-5.6" cy="1.6" r=".7"/><circle cx="4.4" cy="1.6" r=".6"/></g><path class="line" d="M9.2.2Q7.4 1.6 6 .8"/>' },
  6: { name: 'shark', sc: .52, joint: -9.8, eye: [8.6, -1, .75],
    body: 'M-10.6.4C-7.4-3.8 5.6-4.8 11.6-1Q12.8 0 11.4.8C6 3.2-3.6 3.6-10.6 1Z',
    tail: 'M-9.8.6L-14.4-6.2Q-12.2 0-14.6 4.8Z',
    fins: 'M-1.6-3.6L1-8.8L3.2-3.9ZM2.6 2.4L1 6L4.8 2.8Z',
    marks: '<path class="belly" d="M-6 1.8C-1 3.4 6 3 10.6.9C6 1.6-1 2.2-6 1.8Z"/><path class="line" d="M5.2-1.6l-.4 2.2M6.2-1.7l-.4 2.2M7.2-1.6l-.4 2"/>' },
  7: { name: 'angler', sc: .62, joint: -6.8, gill: [1.2, 3.8],  eye: [3.6, -3, 1.3],
    body: 'M-7.4 0C-7.4-7 6-8.2 8.8-2L7-.6L8.6.2L7 1L8.6 1.8C6 7.6-7.4 7-7.4 0Z',
    tail: 'M-6.8 0L-11-3.4Q-10 0-11 3.4Z',
    fins: 'M-3.6 4.6L-2.4 7L-.6 4.8Z',
    marks: '<path class="teeth" d="M8.4-1.5L7.4-.9L8.2-.6ZM8.2 1.2L7.3 1.5L8.1 1.9Z"/><path class="lure" d="M4-5.4Q6.4-11 10.4-8.6"/><circle class="bulb" cx="10.6" cy="-8.4" r="1.3"/>' },
};
const speciesOf = (s) => SPECIES[Math.min(s, 7)];
function fishArt(s, fast) {
  const p = speciesOf(s), [ex, ey, er] = p.eye;
  const wag = calm() ? '' : `<animateTransform attributeName="transform" type="rotate" values="-9 ${p.joint} 0;9 ${p.joint} 0;-9 ${p.joint} 0" dur="${(.8 + s * .12).toFixed(2)}s" repeatCount="indefinite"/>`;
  return `<g transform="scale(${p.sc})">` +
    (fast ? `<path class="speed" d="M${p.joint - 6.4}-2.4h-3.4M${p.joint - 7.4} 0h-4.6M${p.joint - 6.4} 2.4h-3.4"/>` : '') +
    `<path class="reg" transform="translate(-.8 .9)" d="${p.body}"/>` +
    `<g class="ink" filter="url(#speck)"><g class="tail"><path d="${p.tail}"/>${wag}</g><path class="body" d="${p.body}"/><path class="fins" d="${p.fins}"/>${p.marks}</g>` +
    (p.gill ? `<path class="line gill" d="M${p.gill[0]}-${p.gill[1]}Q${p.gill[0] - 1.1} 0 ${p.gill[0]} ${p.gill[1]}"/>` : '') +
    `<circle class="eye" cx="${ex}" cy="${ey}" r="${er}"/><circle class="pupil" cx="${ex + er * .3}" cy="${ey}" r="${er * .55}"/>` +
    `<circle class="glint" cx="${ex + er * .05}" cy="${ey - er * .3}" r="${er * .24}"/></g>`;
}
// A fish's heading as an angle (0 right, 90 down). Heading left it's turned over, not swum upside down.
const ANG = [-90, 0, 90, 180];
const orient = (a) => `rotate(${a}deg)` + (Math.cos((a * Math.PI) / 180) < -.01 ? ' scaleY(-1)' : '');
const near = (from, to) => from + ((((to - from) % 360) + 540) % 360) - 180; // `to`, wound round to the nearest turn from `from`

// Items. A mirror is a bevelled silver plate across the cell (bolted ones show rivets); a flat mirror a plate on brackets against
// the rock face; bait a wriggling worm.
const plate = (len, cls = '') => `<rect class="glass${cls}" x="${-len / 2}" y="-.85" width="${len}" height="1.7" rx=".6"/><path class="glint" d="M${-len / 2 + .9}-.3H${len / 2 - .9}"/>`;
const worm = () => `<g class="bait"><path d="M-3.2 1.2C-2.2-1.4-.8 1.8.6-.2S2.6-1.6 3.2.2"/><circle cx="3.3" cy=".1" r=".75"/>` +
  (calm() ? '' : '<animateTransform attributeName="transform" type="rotate" values="-6;6;-6" dur="1.3s" repeatCount="indefinite"/>') + '</g>';
function itemSvg(t, c, W, cls = '') {
  if (t === 'B') return `<g class="item ${cls}" transform="translate(${cx(c, W)} ${cy(c, W)})">${worm()}</g>`;
  if (t === 'F') {
    const cell = c >> 2, d = c & 3, x = cx(cell, W) + DC[d] * 4.15, y = cy(cell, W) + DR[d] * 4.15;
    return `<g class="item flat ${cls}" transform="translate(${x} ${y}) rotate(${d % 2 ? 90 : 0})">` +
      `<path class="bracket" d="M-3.4 0V${d === 0 || d === 3 ? -1.6 : 1.6}M3.4 0V${d === 0 || d === 3 ? -1.6 : 1.6}"/>${plate(8.4)}</g>`;
  }
  return `<g class="item ${cls}" transform="translate(${cx(c, W)} ${cy(c, W)}) rotate(${t === '/' ? -45 : 45})">${plate(11)}` +
    (cls.includes('fixed') ? '<circle class="rivet" cx="-4.6" r=".55"/><circle class="rivet" cx="4.6" r=".55"/>' : '') + (cls.includes('ghost') ? '' : sparkle(c)) + '</g>';
}
// now and then a mirror catches the light: a four-point glint near one end, each on its own beat
const sparkle = (c) => calm() ? '' : `<path class="spark" transform="translate(3 -.5)" d="M0-1.5L.3-.3L1.5 0L.3.3L0 1.5L-.3.3L-1.5 0L-.3-.3Z" opacity="0">` +
  `<animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;.7;.8;.9;1" dur="${4 + (h32(c) % 5)}s" begin="${(h32(c * 7) % 40) / 10}s" repeatCount="indefinite"/></path>`;
// an item in the tray, in a 10 × 10 box
const trayIcon = (t) => (t === 'F' ? '<path class="rockbit" d="M0 7.2h10V10H0z"/><g transform="translate(5 6.3)">' + plate(8.4) + '</g>'
  : t === 'B' ? `<g transform="translate(5 5) scale(1.25)">${worm()}</g>` : `<g transform="translate(5 5) rotate(${t === '/' ? -45 : 45})">${plate(11)}</g>`);
// a placed item's order, a small tag by it
function orderTag(t, at, n, W) {
  const c = t === 'F' ? at >> 2 : at, d = t === 'F' ? at & 3 : -1;
  const x = cx(c, W) + (d < 0 ? 3.4 : -DC[d] * 1.6 + (d % 2 ? 0 : 3.2)), y = cy(c, W) + (d < 0 ? 3.4 : -DR[d] * 1.6 + (d % 2 ? 3.2 : 0));
  return `<g class="tag"><circle cx="${x}" cy="${y}" r="1.8"/><text x="${x}" y="${y + .7}">${n}</text></g>`;
}

// The tank, printed in a few inks: water deepening to halftone dots near the floor, a pale far range of rock and kelp behind,
// light falling through, rock as rounded speckled masses (pebbles, cracks, sandy ledges, halftone shade under overhangs), kelp,
// a starfish or shell on some ledges, bubbles rising off the floor, and daylight pouring in through the exit.
// Everything decorative sits in rock or behind the water, never where it could pass for an item.
const star = (x, y, r) => 'M' + Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? r * .42 : r; return `${(x + Math.cos(a) * k).toFixed(2)} ${(y + Math.sin(a) * k).toFixed(2)}`; }).join('L') + 'Z';
function tankSvg(L) {
  const W = L.W, g = L.grid, S = CELL * W, R = 3.2, seed = h32([...g].reduce((a, ch, i) => a + (ch === '#' ? i * 31 : 0), W));
  const rock = (c, dr, dc) => { const r = Math.floor(c / W) + dr, q = (c % W) + dc; return r < 0 || q < 0 || r >= W || q >= W || g[r * W + q] === '#'; };
  let rocks = '', fill = '', sand = '', pebbles = '', cracks = '', shade = '', kelp = '', life = '', bubbles = '', exit = '';
  for (let c = 0; c < W * W; c++) {
    const x = (c % W) * CELL, y = Math.floor(c / W) * CELL, hh = h32(c + seed);
    if (g[c] === '#') {
      // round a corner where both its sides face water; reach a hair into rock neighbours so the mass has no seams
      const up = rock(c, -1, 0), dn = rock(c, 1, 0), lf = rock(c, 0, -1), rt = rock(c, 0, 1);
      const x0 = x - (lf ? .3 : 0), x1 = x + 10 + (rt ? .3 : 0), y0 = y - (up ? .3 : 0), y1 = y + 10 + (dn ? .3 : 0);
      const tl = !up && !lf ? R : 0, tr = !up && !rt ? R : 0, br = !dn && !rt ? R : 0, bl = !dn && !lf ? R : 0;
      rocks += `M${x0 + tl} ${y0}H${x1 - tr}${tr ? `A${tr} ${tr} 0 0 1 ${x1} ${y0 + tr}` : ''}V${y1 - br}${br ? `A${br} ${br} 0 0 1 ${x1 - br} ${y1}` : ''}` +
        `H${x0 + bl}${bl ? `A${bl} ${bl} 0 0 1 ${x0} ${y1 - bl}` : ''}V${y0 + tl}${tl ? `A${tl} ${tl} 0 0 1 ${x0 + tl} ${y0}` : ''}Z`;
      if (hh % 3) pebbles += `<ellipse cx="${x + 2 + (hh % 6)}" cy="${y + 3 + ((hh >> 4) % 5)}" rx="${1 + ((hh >> 8) % 3) * .4}" ry="${.7 + ((hh >> 10) % 2) * .3}"/>`;
      if (hh % 5 === 1) cracks += `M${x + 1.5 + ((hh >> 3) % 4)} ${y + 5 + ((hh >> 7) % 3)}q2-1.2 3.4 0t3 .4`;
      if (!dn && g[c + W] === '.') shade += `M${x0 + bl} ${y + 6.4}H${x1 - br}V${y1 - br}${br ? `A${br} ${br} 0 0 1 ${x1 - br} ${y1}` : ''}H${x0 + bl}${bl ? `A${bl} ${bl} 0 0 1 ${x0} ${y1 - bl}` : ''}Z`;
      if (!up) {
        const a = x0 + tl * .6, b = x1 - tr * .6;
        sand += `M${a} ${y0 + .2}Q${(a + b) / 2} ${y0 - .9} ${b} ${y0 + .2}Q${b - .4} ${y0 + 1.9} ${(a + b) / 2} ${y0 + 1.6}T${a} ${y0 + .2}Z`;
        if (g[c - W] !== '.') continue;
        if (hh % 4 === 0) {
          const k = x + 3 + (hh >> 6) % 4, sway = calm() ? '' : `<animateTransform attributeName="transform" type="rotate" values="-5 ${k} ${y};6 ${k} ${y};-5 ${k} ${y}" dur="${3 + (hh % 3)}s" repeatCount="indefinite"/>`;
          kelp += `<g><path d="M${k} ${y}q-1.6-2.4 0-4.4t0-4.2M${k + 1.6} ${y}q1.2-1.8 0-3.4t.2-2.8"/>${sway}</g>`;
        } else if (hh % 9 === 1) life += `<path class="starfish" d="${star(x + 3 + (hh >> 5) % 4, y + .1, 1.5)}" transform="rotate(${(hh >> 9) % 60} ${x + 3 + (hh >> 5) % 4} ${y + .1})"/>`;
        else if (hh % 9 === 5) { const sx = x + 3 + (hh >> 5) % 4; life += `<g class="shell"><path d="M${sx - 1.5} ${y + .4}A1.5 1.5 0 0 1 ${sx + 1.5} ${y + .4}Z"/><path class="rib" d="M${sx} ${y + .4}V${y - 1.1}M${sx} ${y + .4}L${sx - 1} ${y - .7}M${sx} ${y + .4}L${sx + 1} ${y - .7}"/></g>`; }
        // now and then a few bubbles rise off a ledge
        if (hh % 11 === 7 && !calm()) for (let k = 0; k < 3; k++) {
          const bx = x + 4 + k * 1.3, dur = 3.4 + k * .9 + (hh % 3), r = .45 + k * .18;
          bubbles += `<circle cx="${bx}" r="${r}"><animate attributeName="cy" values="${y - 1};${y - 34}" dur="${dur}s" begin="${k * 1.1}s" repeatCount="indefinite"/>` +
            `<animate attributeName="cx" values="${bx};${bx + .8};${bx - .6};${bx}" dur="${dur}s" begin="${k * 1.1}s" repeatCount="indefinite"/>` +
            `<animate attributeName="opacity" values="0;.9;.9;0" keyTimes="0;.1;.8;1" dur="${dur}s" begin="${k * 1.1}s" repeatCount="indefinite"/></circle>`;
        }
      }
    } else if (g[c] === '.') {
      // a water corner tucked between rock gets a small fillet, so rock reads as one carved mass
      for (const [dr, dc, ox, oy, sw] of [[-1, -1, 0, 0, 0], [-1, 1, 10, 0, 1], [1, 1, 10, 10, 0], [1, -1, 0, 10, 1]])
        if (rock(c, dr, 0) && rock(c, 0, dc) && rock(c, dr, dc)) {
          const sx = x + ox, sy = y + oy, ix = -Math.sign(ox - 5) * 1.6, iy = -Math.sign(oy - 5) * 1.6;
          fill += `M${sx} ${sy}H${sx + ix}A1.6 1.6 0 0 ${sw} ${sx} ${sy + iy}Z`;
        }
    } else if (g[c] === 'X') {
      // daylight beyond the gap, falling in as a fan of beams
      const d = c < W ? 0 : c >= W * (W - 1) ? 2 : c % W === 0 ? 3 : 1, mx = x + 5, my = y + 5, rot = [0, 90, 180, 270][d];
      exit = `<g class="exit"><rect x="${x}" y="${y}" width="10" height="10" fill="url(#water)"/>` +
        `<g transform="translate(${mx + DC[d] * 5} ${my + DR[d] * 5}) rotate(${rot})"><path class="beam" d="M-3 0L-11 26H-5ZM-1 0L-2 30H3ZM2 0L9 27H14Z"/></g>` +
        `<circle cx="${mx + DC[d] * 4}" cy="${my + DR[d] * 4}" r="7" fill="url(#glow)"/>` +
        `<g transform="translate(${mx - DC[d] * 2.2} ${my - DR[d] * 2.2}) rotate(${rot})"><path class="chev" d="M-2.2 1.6L0-.6L2.2 1.6"/><path class="chev c2" d="M-2.2-.4L0-2.6L2.2-.4"/></g></g>`;
    }
  }
  // the far range: a soft ridge and a few spires, pale, behind everything
  let ridge = `M0 ${S}V${S * .7}`;
  for (let i = 0; i <= 8; i++) ridge += `Q${S * (i + .5) / 8} ${S * (.6 + ((h32(seed + i) % 100) / 100) * .14)} ${S * (i + 1) / 8} ${S * (.68 + ((h32(seed + i + 50) % 100) / 100) * .08)}`;
  ridge += `V${S}Z`;
  for (let i = 0; i < 3; i++) { const sx = S * (.15 + i * .32 + (h32(seed + 9 * i) % 10) / 100), top = S * (.38 + (h32(seed + 7 * i) % 20) / 100), w = 5 + (h32(seed + i) % 5); ridge += `M${sx - w} ${S}V${top + w}A${w} ${w} 0 0 1 ${sx + w} ${top + w}V${S}Z`; }
  const farKelp = [.08, .3, .55, .82].map((f, i) => { const kx = S * f, ky = S * (.74 + (i % 2) * .05); return `M${kx} ${S}V${ky}q-2-4 0-8t0-8`; }).join('');
  const shafts = [.18, .46, .74].map((f, i) => `<path class="shaft" d="M${S * f} 0h${S * (.07 + i * .02)}l${S * .16} ${S}h-${S * (.12 + i * .02)}Z"/>`).join('');
  return `<defs><linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="w0"/><stop offset="1" class="w1"/></linearGradient>` +
    `<linearGradient id="shaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="s0"/><stop offset="1" class="s1"/></linearGradient>` +
    `<radialGradient id="glow"><stop offset="0" class="g0"/><stop offset="1" class="g1"/></radialGradient>` +
    // halftone: a grid of dots, faded in toward the floor through a mask
    `<pattern id="dots" width="1.9" height="1.9" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx=".95" cy=".95" r=".42" class="ht"/></pattern>` +
    `<linearGradient id="deepfade" x1="0" y1="0" x2="0" y2="1"><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".9"/></linearGradient>` +
    `<mask id="deep"><rect width="${S}" height="${S}" fill="url(#deepfade)"/></mask>` +
    `<clipPath id="tank"><rect x="${CROP}" y="${CROP}" width="${S - 2 * CROP}" height="${S - 2 * CROP}" rx="5"/></clipPath></defs>` +
    `<g clip-path="url(#tank)"><rect class="water" width="${S}" height="${S}" fill="url(#water)"/>` +
    `<g class="far" filter="url(#speck)"><path d="${ridge}"/><path class="far-kelp" d="${farKelp}"/></g>` +
    `<rect class="deep" width="${S}" height="${S}" fill="url(#dots)" mask="url(#deep)"/><g fill="url(#shaft)">${shafts}</g>${exit}` +
    `<g class="bubbles">${bubbles}</g><g class="kelp">${kelp}</g><path class="rock-shadow" transform="translate(.7 .9)" d="${rocks}"/>` +
    `<g filter="url(#speck)"><path class="rock" d="${rocks}${fill}"/><path class="rock-shade" d="${shade}" fill="url(#dots)"/><g class="pebbles">${pebbles}</g>` +
    `<path class="cracks" d="${cracks}"/><path class="sand" d="${sand}"/>${life}</g></g>`;
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
  b.innerHTML = `<svg class="tank" viewBox="${CROP} ${CROP} ${L.W * CELL - 2 * CROP} ${L.W * CELL - 2 * CROP}" xmlns="${SVGNS}" aria-hidden="true">${tankSvg(L)}<g class="items"></g><g class="looks"></g><g class="spots"></g><g class="fishes"></g></svg>`;
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
    if (!f.a) return '';
    const pts = [], v = Fry.look(L, V, i, occ, pts), wants = v.t >= 0;
    if (pts.length < 2) return '';
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
// Where a fish rests: its cell's middle, or, on a cell with a diagonal mirror, halfway round its curve on the shiny side
// (the middle is the plate itself), heading along the curve.
function restOf(f) {
  const W = G.L.W, m = G.S.mir[f.p];
  if (!m) return { x: cx(f.p, W), y: cy(f.p, W), a: ANG[f.d] };
  const din = Fry.TURN[m][f.d ^ 2] ^ 2; // the way it came in: back along the mirror
  return arc(f.p, din, f.d, 45, W, ANG[din]);
}
// a point th degrees round the quarter turn from din to dout in cell c: an arc about the corner between the two edges
function arc(c, din, dout, th, W, a0) {
  const x = cx(c, W), y = cy(c, W), ix = DC[din], iy = DR[din], ox = DC[dout], oy = DR[dout], r = (th * Math.PI) / 180;
  const kx = x - ix * 5 + ox * 5, ky = y - iy * 5 + oy * 5, a1 = near(a0, ANG[dout]);
  return { x: kx + 5 * (ix * Math.sin(r) - ox * Math.cos(r)), y: ky + 5 * (iy * Math.sin(r) - oy * Math.cos(r)), a: a0 + ((a1 - a0) * th) / 90 };
}
function placeFish(i, f) {
  const el = G.fishEls[i], p = restOf(f);
  el.angle = near(el.angle ?? p.a, p.a);
  el.style.transform = `translate(${p.x}px, ${p.y}px)`;
  el.querySelector('.o').style.transform = orient(el.angle);
  el.classList.toggle('gone', !f.a);
}

// One fish's swim through a tick, as points { x, y, a } (a: heading). It swims edge to edge through cells; at a mirror it curves
// round the corner on the mirror's shiny side (an arc about that corner, so it never touches the plate), turning as it goes, and
// if it stops there it stops halfway round; at a flat mirror it swings round just short of the rock. cells: where it starts,
// then each cell it enters; dirs: its facing at the start, then on leaving each cell. a0: its heading now.
function swimPath(cells, dirs, W, a0) {
  const pts = [], V = (d) => [DC[d], DR[d]], C = (c) => [cx(c, W), cy(c, W)];
  let a = a0;
  const at = ([x, y]) => pts.push({ x, y, a });
  // heading d into a flat mirror at (x, y)'s face: nose up to it, swing round (over the top when going sideways), face back
  const uturn = ([x, y], d) => {
    const [vx, vy] = V(d), turn = d === 1 ? -180 : 180, m = ((a + turn / 2) * Math.PI) / 180;
    a = near(a, ANG[d]);
    at([x + vx * 2.6, y + vy * 2.6]);
    pts.push({ x: x + vx * 2 + Math.cos(m) * 1.6, y: y + vy * 2 + Math.sin(m) * 1.6, a: a + turn / 2 });
    a += turn;
    at([x, y]);
  };
  const turnRound = (c, din, dout, ths) => { const a0 = near(a, ANG[din]); for (const th of ths) pts.push(arc(c, din, dout, th, W, a0)); a = pts[pts.length - 1].a; };
  const travel = (from, to) => { const d = to - from; return d === -W ? 0 : d === 1 ? 1 : d === W ? 2 : 3; };
  const start = restOf({ p: cells[0], d: dirs[0] });
  if (G.S.mir[cells[0]]) { // resting halfway round a mirror: finish the curve
    a = near(a, start.a);
    pts.push({ ...start, a });
    turnRound(cells[0], Fry.TURN[G.S.mir[cells[0]]][dirs[0] ^ 2] ^ 2, dirs[0], [67.5, 90]);
  } else {
    a = near(a, ANG[dirs[0]]);
    at(C(cells[0]));
    if (travel(cells[0], cells[1]) !== dirs[0]) uturn(C(cells[0]), dirs[0]); // a flat mirror on its own cell's rock
  }
  for (let i = 1; i < cells.length; i++) {
    const din = travel(cells[i - 1], cells[i]), dout = dirs[i], [x, y] = C(cells[i]), [ix, iy] = V(din), last = i === cells.length - 1;
    a = near(a, ANG[din]);
    at([x - ix * 5, y - iy * 5]); // the edge it comes in over
    if (dout === din) { if (last) at([x, y]); continue; }
    if (dout === (din ^ 2)) { uturn([x, y], din); continue; } // a flat mirror on this cell's far face
    turnRound(cells[i], din, dout, last ? [22.5, 45] : [22.5, 45, 67.5, 90]);
  }
  return pts;
}
// play a swim path on fish element el over ms: the body turns along it, the size tag rides along upright
function animateSwim(el, pts, ms) {
  let len = 0;
  const off = pts.map((p, i) => (len += i ? Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0)), k = (i) => (len ? off[i] / len : i / (pts.length - 1));
  el.animate(pts.map((p, i) => ({ transform: `translate(${p.x}px, ${p.y}px)`, offset: k(i) })), { duration: ms, easing: 'linear' });
  el.querySelector('.o').animate(pts.map((p, i) => ({ transform: orient(p.a), offset: k(i) })), { duration: ms, easing: 'linear' });
  el.angle = pts[pts.length - 1].a;
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
      const el = G.fishEls[i];
      if (!calm) animateSwim(el, swimPath(t.paths[k], t.turns[k], L.W, el.angle), ms);
      placeFish(i, G.S.fish[i]);
    });
    for (const i of t.eaten) { G.fishEls[i].classList.add('gone'); }
    if (t.eaten.length && !t.lost) sfx.erase();
    $('#board .looks').innerHTML = '';
    await wait(ms);
    if (run !== runId) return; // undone, or another level started
    if (t.lost) return settle('lose');
    if (t.won) return settle('win');
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
