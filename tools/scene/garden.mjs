// The garden behind the table: lawn, a river across the upper third, trees and bushes at the sides, pale sky.
// Units are centimetres, the camera stands on the lawn looking toward -z.
import { deg, clamp, sphere, limb, noise, rng, trace, paint, finish, toRGBA, U } from './lib.mjs';
import { RAMPS } from './palette.mjs';

const W = 960, H = 360, X0 = (W - 480) / 2;
const EYE = [0, 330, 0], DOWN = 20 * deg, FOV = 46 * deg;
const RIVER = [-4300, -2050], WATER = -28;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function ray(i, j) {
  const k = Math.tan(FOV / 2) / (H / 2), u = (i - W / 2) * k, v = (H / 2 - j) * k;
  const s = Math.sin(DOWN), c = Math.cos(DOWN);
  const dx = u, dy = -s + v * c, dz = -c - v * s, l = Math.hypot(dx, dy, dz);
  return [...EYE, dx / l, dy / l, dz / l];
}

// Foliage is a core plus many small clumps on its surface, so each clump catches its own light.
const R = rng(7);
function canopy(cx, cy, cz, rx, ry, n) {
  const s = [[cx, cy, cz, Math.min(rx, ry) * 0.8]];
  for (let k = 0; k < n; k++) {
    const a = R() * Math.PI * 2, b = Math.acos(1 - 2 * R() * 0.85), r = Math.min(rx, ry) * (0.28 + R() * 0.14);
    s.push([cx + Math.sin(b) * Math.cos(a) * rx * 0.8, cy + Math.cos(b) * ry * 0.8, cz + Math.sin(b) * Math.sin(a) * rx * 0.8, r]);
  }
  const bound = Math.max(rx, ry) * 1.3;
  return (x, y, z, rough) => {
    const b = sphere(x - cx, y - cy, z - cz, bound);
    if (b > 20) return b;
    let d = 1e9;
    for (const [px, py, pz, r] of s) d = Math.min(d, sphere(x - px, y - py, z - pz, r));
    return d - rough * (noise(x * 0.03, y * 0.03, z * 0.03) - 0.5);
  };
}
const trees = [
  { trunk: [[-760, 0, -1350], [-780, 330, -1360]], leaves: canopy(-800, 470, -1350, 330, 260, 46) },
  { trunk: [[840, 0, -1650], [830, 360, -1640]], leaves: canopy(860, 500, -1650, 340, 260, 46) },
  { trunk: [[-2600, 0, -4800], [-2600, 260, -4800]], leaves: canopy(-2600, 380, -4800, 230, 200, 24) },
  { trunk: [[2900, 0, -5000], [2900, 220, -5000]], leaves: canopy(2900, 330, -5000, 200, 170, 20) },
  { trunk: [[-1450, 0, -1500], [-1470, 340, -1510]], leaves: canopy(-1490, 480, -1500, 340, 270, 46) },
  { trunk: [[1500, 0, -1750], [1490, 320, -1740]], leaves: canopy(1520, 460, -1750, 320, 250, 46) },
];
const bushes = [canopy(-560, 50, -900, 150, 90, 22), canopy(600, 50, -1150, 160, 95, 22), canopy(-1050, 40, -1950, 120, 70, 16), canopy(1150, 40, -2000, 110, 65, 14), canopy(-1400, 50, -800, 150, 90, 22), canopy(1450, 50, -950, 150, 90, 22)];
const far = Array.from({ length: 36 }, (_, k) => canopy(-9500 + k * 540 + R() * 200, 120 + R() * 180, -5900 - R() * 900, 230 + R() * 140, 200 + R() * 160, 10));

const nearBank = x => RIVER[1] - 180 * Math.sin(x * 0.0011 + 1) - 90 * Math.sin(x * 0.0029);
const farBank = x => RIVER[0] + 150 * Math.sin(x * 0.0009 + 3);
const ground = (x, z) => -60 * ss(nearBank(x) + 80, nearBank(x) - 60, z) * ss(farBank(x) - 120, farBank(x) + 60, z) + 4 * noise(x * 0.004, z * 0.004);

function field(x, y, z) {
  let out = U([(y - ground(x, z)) * 0.7, z < farBank(x) ? 'farGrass' : y < -6 ? 'bank' : 'grass'], [y - WATER, 'water']);
  for (const t of trees) out = U(out, [limb(x, y, z, t.trunk[0], t.trunk[1], 30, 18), 'trunk'], [t.leaves(x, y, z, 40), 'leaf']);
  for (const b of bushes) out = U(out, [b(x, y, z, 24), 'leaf']);
  let d = 1e9;
  for (const f of far) d = Math.min(d, f(x, y, z, 30));
  return U(out, [d, 'farTree']);
}

function tone(p, v) {
  const n = noise(p.x * 0.0025, p.z * 0.004) - 0.5;
  if (p.mat === 'grass') return 0.72 + 0.35 * (v - 0.8) + 0.1 * n - 0.14 * ss(nearBank(p.x) + 60, nearBank(p.x), p.z);
  if (p.mat === 'farGrass') { p.mat = 'grass'; return 0.8 + 0.35 * (v - 0.8); }
  if (p.mat === 'farTree') { p.mat = 'far'; return -0.55 * p.nx + 0.72 * p.ny + 0.42 * p.nz > 0.25 ? 0.72 : 0.5; }
  if (p.mat === 'water') return 0.6 + 0.3 * ss(-3300, -2300, p.z) - 0.3 * ss(-3900, -4250, p.z);
  if (p.mat === 'leaf') return 0.12 + v + 0.1 * n;
  return v;
}

function stamp(img, x, y, rows, map) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    const k = (y + j) * W + x + i;
    if (ch !== '.' && x + i >= 0 && x + i < W && y + j >= 0 && y + j < H) img[k] = { ...map[ch], t: 0 };
  }));
}
// Grass tufts grow larger toward the camera. a is a dark blade, b a sunlit one.
const TUFTS = [['.a.', 'aba'], ['.a..a', 'a.ab.', 'abab.'], ['..a...a', '.ab.a.b', 'a.bab.a', '.abbab.']];
const FLOWER = ['.f.', 'fcf', '.s.'];
const STONE = ['.lll.', 'lmmmd', '.dddd'];
const REED = ['..b.', '.ab.', 'a.ab', 'aab.'];
const shade = (c) => ({ mat: 'grass', c });

function draw() {
  const px = trace({ field, w: W, h: H, ray, far: 9000, eps: 0.6, ao: 30, shadowFar: 700, steps: 500 });
  const img = paint(px, W, H, RAMPS, { tone, dither: { grass: 0.06 } });
  img.forEach((p, k) => {
    if (p) return;
    const j = Math.floor(k / W);
    img[k] = { mat: 'sky', c: j < 10 ? 1 : 2, t: Infinity };
  });
  finish(img, W, H, { depthBreak: 0.12, relative: true, outlineMats: ['leaf', 'trunk'] });
  const r = rng(11), at = (x, y) => img[y * W + x], lawn = (x, y) => at(x, y)?.mat === 'grass';
  // A darker line of water along the near bank.
  for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) if (lawn(x, y) && at(x, y - 1)?.mat === 'water') at(x, y - 1).c = 1;
  // Tufts gather in loose clusters and thin out toward the open lawn in the middle.
  for (let n = 0; n < 2600 * W / 480; n++) {
    const x = Math.floor(r() * W), y = Math.floor(r() * H), side = Math.abs(x / W - 0.5);
    const want = noise(x * 0.03, y * 0.05) * (0.35 + ss(0.08, 0.3, side)) * ss(90, 140, y);
    if (!lawn(x, y) || r() > want - 0.18) continue;
    stamp(img, x, y, TUFTS[y < 170 ? 0 : y < 270 ? 1 : 2], { a: shade(1 + Math.floor(r() * 2)), b: shade(4) });
  }
  for (const x of [8, 26, 52, 70, 404, 430, 452, 470, -180, -150, 610, 650].map(x => x + X0)) {
    const y = [...Array(H).keys()].find(j => lawn(x, j) && at(x, j - 1)?.mat === 'water');
    if (y) stamp(img, x, y - 2, REED, { a: shade(1), b: shade(3) });
  }
  // Small clusters of flowers and stones at the sides of the lawn.
  for (const [cx, cy, k] of [[60, 230, 5], [110, 300, 4], [30, 330, 3], [420, 250, 5], [380, 320, 4], [455, 300, 3], [150, 180, 3], [340, 170, 3], [-120, 260, 4], [-60, 320, 3], [580, 280, 4], [640, 220, 3]].map(([x, y, k]) => [x + X0, y, k])) {
    for (let n = 0; n < k; n++) {
      const x = Math.round(cx + (r() - 0.5) * 22), y = Math.round(cy + (r() - 0.5) * 12);
      if (lawn(x, y)) stamp(img, x, y, FLOWER, { f: { mat: 'flower', c: [2, 3, 4, 4][Math.floor(r() * 4)] }, c: { mat: 'flower', c: 1 }, s: shade(1) });
    }
  }
  for (const [x, y] of [[90, 330], [97, 334], [392, 290], [24, 262], [-90, 300], [600, 330]].map(([x, y]) => [x + X0, y])) if (lawn(x, y)) stamp(img, x, y, STONE, { l: { mat: 'stone', c: 3 }, m: { mat: 'stone', c: 2 }, d: { mat: 'stone', c: 1 } });
  const glint = rng(5);
  for (let n = 0; n < 60; n++) {
    const x = Math.floor(glint() * W), y = Math.floor(H * 0.1 + glint() * H * 0.3), l = 2 + Math.floor(glint() * 6);
    if (img[y * W + x]?.mat === 'water' && img[y * W + x + l]?.mat === 'water') stamp(img, x, y, ['w'.repeat(l)], { w: { mat: 'water', c: 4 } });
  }
  return { w: W, h: H, rgba: toRGBA(img, RAMPS) };
}

export const bg = { name: 'bg', draw };

// A lawn tile for the top-down play view: the same tufts on flat grass, wrapping at every edge.
function tile() {
  const T = 240, img = Array.from({ length: T * T }, () => shade(3)), r = rng(23);
  const thick = (x, y) => 0.5 + 0.25 * Math.sin(2 * Math.PI * (x + 2 * y) / T) + 0.25 * Math.sin(2 * Math.PI * (3 * x - y) / T + 1);
  for (let n = 0; n < 600; n++) {
    const x = Math.floor(r() * T), y = Math.floor(r() * T), a = shade(1 + Math.floor(r() * 2));
    if (r() > thick(x, y) - 0.25) continue;
    TUFTS[1].forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') img[((y + j) % T) * T + (x + i) % T] = ch === 'a' ? a : shade(4); }));
  }
  return { w: T, h: T, rgba: toRGBA(img, RAMPS) };
}
export const lawn = { name: 'lawn', draw: tile };
