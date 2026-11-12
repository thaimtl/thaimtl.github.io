// Things on the table: clementines, a teapot and two cups. Centimetres, table top y = 0, +z toward the viewer.
// Each is drawn twice through the page's own camera, once for the opening shot and once for the beat shots.
import { deg, ellipsoid, limb, sphere, box, cylinder, smin, smax, frame, U, S } from './lib.mjs';

const torus = (x, y, z, R, r) => Math.sqrt((Math.sqrt(x * x + z * z) - R) ** 2 + y * y) - r;
const bowl = (x, y, z, r0, r1, h) => {
  const r = r0 + (r1 - r0) * Math.min(Math.max(y / h, 0), 1);
  return cylinder(x, y - h / 2, z, r, h / 2, 0.3) + (r - r1);
};

// A clementine is a little flattened. Peeled, it splits into nine segments.
const R = 1.5, SEG = (2 * Math.PI) / 9;
const clementine = (x, y, z) => ellipsoid(x, y - R * 0.86, z, R, R * 0.86, R);
const stemLeaf = (x, y, z, leaf = true) => {
  const top = R * 1.72, stem = limb(x, y - top, z, [0, 0, 0], [0.1, 0.45, 0], 0.2);
  return leaf ? Math.min(stem, ellipsoid(x - 0.9, y - top - 0.3, z + 0.3, 1.1, 0.16, 0.5)) : stem;
};
// Distance to the vertical wedge of half-angle span/2 around the direction `dir` (in x, z).
function pie(x, z, span, dir) {
  const u = Math.abs(Math.cos(dir) * z - Math.sin(dir) * x), v = Math.cos(dir) * x + Math.sin(dir) * z;
  const cs = Math.sin(span / 2), cc = Math.cos(span / 2), h = Math.max(u * cs + v * cc, 0);
  return Math.hypot(u - cs * h, v - cc * h) * Math.sign(cc * u - cs * v);
}
const peeled = (x, y, z) => {
  const r = Math.hypot(x, z), t = ((Math.atan2(z, x) % SEG) + SEG) % SEG;
  return smax(ellipsoid(x, y, z, 1.45, 1.05, 1.45), 0.1 - Math.min(t, SEG - t) * r, 0.06);
};
// What is left of a peeled one: the segments within `span` of the direction `dir`, the eaten ones gone.
function eaten(x, y, z, span, dir) {
  const ball = peeled(x, y - 1.05, z), cut = pie(x, z, span, dir);
  return cut > ball ? [cut, 'pulp'] : [ball, 'flesh'];
}
// A loose segment lying on its side: a crescent of flesh.
const segment = (x, y, z) => smax(ellipsoid(x, y - 0.4, z, 0.85, 0.42, 0.7), -ellipsoid(x, y - 0.4, z - 0.55, 0.75, 0.6, 0.5), 0.1);
// Peel opened flat like a flower, curling up at the petals, its pale pith showing in the middle.
function peelStar(x, y, z) {
  const r = Math.hypot(x, z), th = Math.atan2(z, x);
  const rim = 1.9 * (0.4 + 0.6 * Math.abs(Math.cos(2.5 * th)) ** 0.8), h = 0.1 + 0.35 * (r / 1.9) ** 2;
  return [smax(Math.abs(y - h) * 0.8 - 0.12, r - rim, 0.12), y < h - 0.05 || r > rim * 0.35 ? 'orange' : 'pith'];
}
const smallPeel = (x, y, z) => { const [d, m] = peelStar(x / 0.6, y / 0.6, z / 0.6); return [d * 0.6, m]; };

// His plate: two whole clementines, one with its leaf, one half eaten, and its peel.
const PLATE = 0.6, star = frame([-1.3, PLATE, 1.9], 15 * deg);
function fruitField(x, y, z) {
  const plate = smin(cylinder(x, y - PLATE / 2, z, 4.6, PLATE / 2, 0.25), torus(x, y - PLATE - 0.15, z, 4.25, 0.4), 0.5);
  const yp = y - PLATE;
  const skin = Math.min(clementine(x + 2.5, yp, z + 0.9), clementine(x - 0.8, yp, z + 2.8));
  const stem = stemLeaf(x + 2.5, yp, z + 0.9);
  return U([plate, 'white'], [skin, 'orange'], [stem, 'leafy'], eaten(x - 2.2, yp, z - 1.7, 180 * deg, -40 * deg), peelStar(...star(x, y, z)));
}

// The viewer's saucer, smaller, with a teal band: one whole, one nearly finished, two loose segments and a small peel.
const SAU = 0.5, segA = frame([0.5, SAU, 2.6], 0), segB = frame([2.4, SAU, 1.6], 60 * deg), twist = frame([-1.7, SAU, 1.8], 30 * deg);
function fruitNearField(x, y, z) {
  const r = Math.hypot(x, z);
  const saucer = smin(cylinder(x, y - SAU / 2, z, 3.6, SAU / 2, 0.2), torus(x, y - SAU - 0.1, z, 3.35, 0.25), 0.4);
  const yp = y - SAU;
  const skin = clementine(x + 1.2, yp, z + 1), stem = stemLeaf(x + 1.2, yp, z + 1, false);
  const bits = Math.min(segment(...segA(x, y, z)), segment(...segB(x, y, z)));
  return U([saucer, r > 3.15 ? 'glaze' : 'white'], [skin, 'orange'], [stem, 'leafy'], [bits, 'flesh'],
    eaten(x - 1.2, yp, z + 0.3, 160 * deg, -70 * deg), smallPeel(...twist(x, y, z)));
}

// The clay teapot on its wooden tray, in the middle of the table.
const FLOOR = 0.9, pot = frame([0, FLOOR, 0], 120 * deg);
function potField(x, y, z) {
  const tray = smax(box(x, y - 0.7, z, 3.1, 0.7, 3, 0.4), -box(x, y - FLOOR - 0.7, z, 2.5, 0.7, 2.4, 0.3), 0.2);
  const [px, py, pz] = pot(x, y, z);
  let body = ellipsoid(px, py - 2.1, pz, 2.6, 2.1, 2.6);
  body = smin(body, cylinder(px, py - 4.1, pz, 1.4, 0.3, 0.2), 0.4);
  body = smin(body, sphere(px, py - 4.7, pz, 0.5), 0.3);
  const spout = limb(px, py, pz, [2, 1.8, 0], [4, 3.4, 0], 0.7, 0.35);
  const handle = smax(torus(px + 3, pz, py - 2.3, 1.1, 0.3), px + 2.2, 0.2);
  return U([tray, 'tanDark'], S(0.3, [body, 'clay'], [spout, 'clay'], [handle, 'clay']));
}

// A small white cup of pale tea. `level` is the tea's height in the cup.
const cupField = level => (x, y, z) => {
  const cup = smax(bowl(x, y, z, 0.8, 1.25, 1.5), -bowl(x, y - 0.35, z, 0.6, 1.05, 1.5), 0.15);
  const tea = cylinder(x, y - level, z, 0.7 + 0.3 * (level - 0.35) / 1.5, 0.05);
  return U([cup, 'white'], [tea, 'tea']);
};

// The page camera (site.css, site.js): K cells from the focus F, tilted T. One board cell is 4 cm.
// A sprite pixel is 1/22 of a cell at the focus, which is one art pixel in the opening shot.
const CM = 4, PPC = 22, F = [4, 4.5];
const SHOTS = { open: { K: 16, T: 50 }, beat: { K: 22, T: 45 } };
// Rays through the page camera for a sprite whose anchor pixel (cx, cy) sits on table point `at`.
function lens({ K, T }, at, cx, cy) {
  const s = Math.sin(T * deg), c = Math.cos(T * deg), X = at[0] - F[0], Y = at[1] - F[1], q = K / (K - Y * s);
  const eye = [-X * CM, K * c * CM, (K * s - Y) * CM];
  const ray = (i, j) => {
    const u = X * q + (i - cx) / PPC, v = Y * c * q + (j - cy) / PPC;
    const dx = u, dy = -v * s - K * c, dz = v * c - K * s, l = Math.hypot(dx, dy, dz);
    return [...eye, dx / l, dy / l, dz / l];
  };
  return { ray, q };
}

// Table points the props stand on, in board cells. The page places each sprite's anchor at the same point.
// His plate and cup flank the far rank, the pot stands at the river, and the viewer's plate and cup sit in front of the board.
export const AT = { fruit: [-2, 0.9], 'fruit-near': [1.3, 11.2], pot: [9.75, 4.5], cup: [9.7, 0.9], 'cup-near': [6.9, 11] };
const prop = (name, field, canvas, finish = { depthBreak: 1, edgeMats: ['orange', 'flesh'] }) => Object.entries(SHOTS).map(([shot, cam]) =>
  ({ name: shot === 'open' ? name : `${name}-z`, field, finish, canvas, ...lens(cam, AT[name], canvas[2], canvas[3]) }));
export const props = [
  ...prop('fruit', fruitField, [64, 48, 32, 30]),
  ...prop('fruit-near', fruitNearField, [120, 110, 60, 64]),
  ...prop('pot', potField, [72, 64, 36, 44], {}),
  ...prop('cup', cupField(1.2), [28, 28, 14, 18]),
  ...prop('cup-near', cupField(0.7), [56, 56, 28, 34]),
];
