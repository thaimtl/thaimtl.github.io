// Things on the table: a plate of clementines and a tea set on a tray. Centimetres, table top y = 0, +z toward the boy.
// Each is drawn twice through the page's own camera, once for the opening shot and once for the beat shots.
import { deg, ellipsoid, limb, sphere, box, cylinder, smin, smax, frame, U, S } from './lib.mjs';

const torus = (x, y, z, R, r) => Math.sqrt((Math.sqrt(x * x + z * z) - R) ** 2 + y * y) - r;
const bowl = (x, y, z, r0, r1, h) => {
  const r = r0 + (r1 - r0) * Math.min(Math.max(y / h, 0), 1);
  return cylinder(x, y - h / 2, z, r, h / 2, 0.3) + (r - r1);
};

// A clementine is a little flattened. Three whole ones and one peeled into nine segments.
const R = 1.5, PLATE = 0.6;
const clementine = (x, y, z) => ellipsoid(x, y - R * 0.86, z, R, R * 0.86, R);
const whole = [[-2.1, -0.8], [0.6, -2.2], [-1, 1.9]];
const peeled = frame([2, PLATE, 0.8], 25 * deg), SEG = (2 * Math.PI) / 9;
function plateField(x, y, z) {
  const plate = smin(cylinder(x, y - PLATE / 2, z, 4.6, PLATE / 2, 0.25), torus(x, y - PLATE - 0.15, z, 4.25, 0.4), 0.5);
  let skin = 1e9;
  for (const [cx, cz] of whole) skin = Math.min(skin, clementine(x - cx, y - PLATE, z - cz));
  const [sx, sz] = whole[1], top = PLATE + R * 1.72;
  const stem = limb(x - sx, y - top, z - sz, [0, 0, 0], [0.1, 0.45, 0], 0.2);
  const leaf = ellipsoid(x - sx - 0.9, y - top - 0.3, z - sz + 0.3, 1.1, 0.16, 0.5);
  const [px, py, pz] = peeled(x, y, z), r = Math.hypot(px, pz), t = ((Math.atan2(pz, px) % SEG) + SEG) % SEG;
  const flesh = smax(ellipsoid(px, py - 1.05, pz, 1.45, 1.05, 1.45), 0.12 - Math.min(t, SEG - t) * r, 0.06);
  return U([plate, 'white'], [skin, 'orange'], [flesh, 'flesh'], [Math.min(stem, leaf), 'leafy']);
}

// A clay teapot and two small cups of pale tea on a wooden tray.
const FLOOR = 0.9, pot = frame([-1.3, FLOOR, -1.1], -15 * deg);
function teaField(x, y, z) {
  const tray = smax(box(x, y - 0.7, z, 4.5, 0.7, 3.3, 0.4), -box(x, y - FLOOR - 0.7, z, 3.9, 0.7, 2.7, 0.3), 0.2);
  const [px, py, pz] = pot(x, y, z);
  let body = ellipsoid(px, py - 2.1, pz, 2.6, 2.1, 2.6);
  body = smin(body, cylinder(px, py - 4.1, pz, 1.4, 0.3, 0.2), 0.4);
  body = smin(body, sphere(px, py - 4.7, pz, 0.5), 0.3);
  const spout = limb(px, py, pz, [2, 1.8, 0], [4, 3.4, 0], 0.7, 0.35);
  const handle = smax(torus(px + 3, pz, py - 2.3, 1.1, 0.3), px + 2.2, 0.2);
  const cup = (cx, cz) => smax(bowl(x - cx, y - FLOOR, z - cz, 0.8, 1.25, 1.5), -bowl(x - cx, y - FLOOR - 0.35, z - cz, 0.6, 1.05, 1.5), 0.15);
  const cups = Math.min(cup(-0.5, 1.8), cup(2.4, 1.3));
  const tea = Math.min(cylinder(x + 0.5, y - FLOOR - 1.2, z - 1.8, 0.95, 0.05), cylinder(x - 2.4, y - FLOOR - 1.2, z - 1.3, 0.95, 0.05));
  return U([tray, 'tanDark'], S(0.3, [body, 'clay'], [spout, 'clay'], [handle, 'clay']), [cups, 'white'], [tea, 'tea']);
}

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

// Table points the props stand on, in board cells. css/stage.css places them at the same points.
const AT = { fruit: [-2, 0.6], tea: [10, 0.7] };
const prop = (name, field, finish) => Object.entries(SHOTS).map(([shot, cam]) => {
  const canvas = [90, 80, 45, 56];
  return { name: shot === 'open' ? name : `${name}-z`, field, finish, canvas, ...lens(cam, AT[name], canvas[2], canvas[3]) };
});
export const props = [...prop('fruit', plateField, { depthBreak: 1 }), ...prop('tea', teaField)];
