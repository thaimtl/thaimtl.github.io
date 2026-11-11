// The grandfather, sitting cross-legged behind the table, facing the camera, looking down at the board.
// His right hand rests forward at table height, his left hand on his knee. Units are centimetres, the ground is y = 0, he faces +z.
import { deg, clamp, ellipsoid, limb, sphere, box, smin, smax, frame, noise, U, S } from './lib.mjs';

const torso = frame([0, 12, -2], 0, -10 * deg);
const nape = torso.world(0, 41, 2);
const head = frame([nape[0], nape[1] + 17.5, nape[2] + 6], 2 * deg, -8 * deg, -1.5 * deg);
// The head is drawn a little larger than life so the face reads at this size.
const HS = 1.1, local = (x, y, z) => head(x, y, z).map(v => v / HS);
const earF = frame([7.8, -0.9, -1], 20 * deg, 0, 0);
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function skull(x, y, z) {
  const ax = Math.abs(x);
  let d = smin(ellipsoid(x, y - 1.6, z + 0.9, 7.4, 9.2, 9.8), ellipsoid(x, y + 3.9, z - 2.3, 5.7, 6.8, 6.4), 3);
  d = smin(d, ellipsoid(x, y - 1.4, z - 7, 5.4, 1.5, 1.9), 1.6);
  d = smin(d, ellipsoid(ax - 3.8, y + 1.8, z - 5.3, 2.2, 1.6, 1.8), 1.2);
  d = smax(d, -sphere(ax - 2.8, y + 0.2, z - 8.1, 1.25), 0.8);
  return smin(d, limb(x, y, z, [0, 0.6, 8.3], [0, -2.9, 10.3], 0.8, 1.3), 0.8);
}

function headPart(x, y, z) {
  const ax = Math.abs(x);
  const [ex, ey, ez] = earF(ax, y, z);
  const ear = smax(ellipsoid(ex, ey, ez, 0.8, 3.4, 2.2), -sphere(ex - 0.9, ey, ez - 0.5, 1.4), 0.4);
  const skin = smin(skull(x, y, z), ear, 0.6);
  // Thin hair swept back from a high, receding hairline, cut short above the ears.
  const strands = 0.12 * Math.sin(x * 2.6 + 1.5 * noise(z * 0.4, x * 0.4)) + 0.3 * noise(x * 0.6, y * 0.6, z * 0.6);
  let hair = smax(ellipsoid(x, y - 1.8, z + 1.1, 8.5, 10, 10.6) - strands, z - 5.2 + 0.12 * ax * ax, 0.6);
  hair = smax(hair, ax > 5.2 && z > -3.4 ? 3.2 - y : -9, 0.6);
  const cheekLine = -2.4 + 3 * ss(4.2, 6.4, ax);
  let beard = smax(smax(ellipsoid(x, y + 4.2, z - 2.2, 6.6, 7.6, 7.3), y - cheekLine, 0.5), -z - 1.5, 0.5);
  beard = smin(beard, ellipsoid(x, y + 10, z - 5, 3.4, 2.4, 2.6), 1.6) - 0.25 * noise(x * 0.9, y * 0.9, z * 0.9);
  const tache = limb(ax, y, z, [3.2, -4.6, 7.8], [0.4, -3.7, 9.4], 0.6, 0.9);
  const brow = limb(ax, y, z, [1.2, 1.9, 8.8], [4.6, 1.5, 7.4], 0.7, 0.5);
  return U([skin, 'skin'], [hair, 'white'], [smin(beard, tache, 0.6), 'white'], [brow, 'white']);
}

// A hand in its own frame: wrist at the origin, fingers along +z, back of the hand up (+y), thumb toward `side`.
function flatHand(x, y, z, side) {
  let d = box(x, y, z - 4, 3.5, 1.1, 4, 1);
  for (const k of [-2.5, -0.85, 0.85, 2.5]) d = smin(d, limb(x, y, z, [k, 0.1, 7.2], [k * 1.03, -0.9, 11.4 - Math.abs(k) * 0.55], 0.82, 0.72), 0.5);
  return smin(d, limb(x, y, z, [3.6 * side, -0.4, 1.4], [4.8 * side, -0.9, 6.4], 1.15, 0.9), 0.9);
}

// A loose sleeve over the upper arm and most of the forearm, then the bare wrist and hand.
function arm(x, y, z, s, e, w, handD) {
  const cuff = e.map((v, i) => v + (w[i] - v) * 0.45);
  const sleeve = smin(limb(x, y, z, s, e, 5.2, 4.8), limb(x, y, z, e, cuff, 4.8, 4.4), 2.4);
  const forearm = limb(x, y, z, e, w, 3.2, 2.5);
  return U([sleeve, 'shirt'], S(1.4, [forearm, 'skin'], [handD, 'skin']));
}

const R = { s: torso.world(-14.5, 34, 1), e: [-21, 25, 10], w: [-12, 33.5, 27] };
const L = { s: torso.world(14.5, 34, 1), e: [21, 22, 8], w: [15, 15, 24] };
const rHand = frame(R.w, -28 * deg, 6 * deg);
const lHand = frame(L.w, 20 * deg, -4 * deg);

function body(x, y, z) {
  const [tx, ty, tz] = torso(x, y, z);
  // Loose cloth hangs in soft vertical folds from the chest.
  const folds = 0.5 * Math.abs(Math.sin(tx * 0.45 + 1.5 * noise(tx * 0.1, ty * 0.08))) * ss(34, 14, ty);
  let shirt = smin(ellipsoid(tx, ty - 31, tz - 3.5, 15, 13, 10), ellipsoid(tx, ty - 16, tz - 3.5, 15.5, 13, 11.5), 6);
  shirt = smin(shirt, limb(Math.abs(tx), ty, tz, [4, 41, 1], [14, 35, 1.6], 5), 7) - folds;
  const pelvis = smin(ellipsoid(x, y - 12, z + 1, 17.5, 10.5, 13.5), ellipsoid(x, y - 7, z - 14, 22, 5.5, 11), 6);
  const neck = limb(x, y, z, nape, head.world(0, -5 * HS, -HS), 5.4, 4.6);
  const collar = limb(Math.abs(tx), ty, tz, [5.8, 44.2, 3], [1.2, 38, 9.6], 1, 0.8);
  const legs = Math.min(
    limb(Math.abs(x), y, z, [9, 9, 0], [28, 9, 19], 7.4, 5.8),
    limb(x, y, z, [28, 8, 21], [-17, 5.6, 29], 5.6, 4.2),
    limb(x, y, z, [-28, 7.5, 20], [17, 5, 25], 5.6, 4.2));
  const feet = Math.min(ellipsoid(x + 21, y - 4.5, z - 30, 4.6, 3.2, 3.6), ellipsoid(x - 21, y - 4, z - 26, 4.6, 3.2, 3.6));
  return U(
    S(3, [shirt, 'shirt'], [neck, 'skin']),
    [collar, 'shirt'],
    S(3, [pelvis, 'trousers'], [legs, 'trousers']),
    [feet, 'skin'],
    arm(x, y, z, R.s, R.e, R.w, flatHand(...rHand(x, y, z), 1)),
    arm(x, y, z, L.s, L.e, L.w, flatHand(...lHand(x, y, z), -1)),
  );
}

function field(x, y, z) {
  const bound = sphere(x, y - 45, z - 10, 60);
  if (bound > 4) return [bound, 'skin'];
  const h = headPart(...local(x, y, z));
  h[0] *= HS;
  const b = body(x, y, z);
  return b[0] < h[0] ? b : h;
}

// Eyes are painted into the shadow under the brows, lines across the forehead, creases between the fingers of the resting hand.
// Combed strands in the hair, and the shirt opens in a shallow V at the throat.
function tone(p, v) {
  if (p.mat === 'white' && p.y > 60) {
    const [x, y, z] = local(p.x, p.y, p.z);
    if (y > 2.5 && Math.sin(x * 2.4 + 1.2 * Math.sin(z * 0.5)) > 0.75) return v - 0.22;
    return v;
  }
  if (p.mat === 'shirt') {
    const [tx, ty, tz] = torso(p.x, p.y, p.z);
    if (tz > 2 && ty > 37 && Math.abs(tx) < (ty - 37) * 0.55) p.mat = 'skin';
    return v;
  }
  if (p.mat !== 'skin') return v;
  const [x, y, z] = local(p.x, p.y, p.z);
  if (z > 6.5 && Math.abs(Math.abs(x) - 2.8) < 1.1 && Math.abs(y + 0.45) < 0.4) p.mat = 'eye';
  if (z > 4 && Math.abs(x) < 3 && [4.6, 6].some(k => Math.abs(y - k - 0.03 * x * x) < 0.28)) return v - 0.25;
  const [hx, hy, hz] = rHand(p.x, p.y, p.z);
  if (hy > 0 && hz > 6.6 && hz < 11 && [-1.7, 0, 1.7].some(k => Math.abs(hx - k) < 0.3)) return v - 0.35;
  return v - 0.05;
}

export default { name: 'elder', scale: 2, field, tone, look: [0, 0, 0], canvas: [240, 240, 120, 200] };
