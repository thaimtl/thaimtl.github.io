// The boy seen from just behind his neck, head bowed over the board. He faces -z, away from the camera.
// Units are centimetres, the base of his neck is the origin.
import { deg, clamp, PITCH, ellipsoid, limb, sphere, smin, smax, frame, U, S } from './lib.mjs';

const head = frame([0, 10.4, -3.2], 180 * deg, -14 * deg, 2 * deg);
const collarAt = frame([0, 0.2, -0.4], 0, 14 * deg, 0);
const earF = frame([7.7, -0.8, 0], -40 * deg, 0, 0);
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const torus = (x, y, z, R, r) => Math.sqrt((Math.sqrt(x * x + z * z) - R) ** 2 + y * y) - r;

// Short hair as locks that fan out from the crown in sectors, each sector staggered, each lock ending in a soft point.
// Returns how far a lock lifts off the scalp here, and how near to the middle of its sector the point is.
const CROWN = [0.6, 8.4, -2.8], SECTORS = 20, PU = 4.2;
const jitter = n => { const s = Math.sin(n * 91.7) * 43758.5; return s - Math.floor(s); };
function lock(x, y, z) {
  const dx = x - CROWN[0], dy = y - CROWN[1], dz = z - CROWN[2], r = Math.hypot(dx, dy, dz);
  const sv = ((Math.atan2(dx, -(dy * 0.6 + dz * 0.8)) / Math.PI + 1) * SECTORS) / 2, col = Math.floor(sv), fv = sv - col - 0.5;
  const ru = r / (PU * (0.8 + 0.4 * jitter(col + 7))) + jitter(col) + 2.4 * fv * fv, fu = ru - Math.floor(ru);
  const mid = 1 - 4 * fv * fv;
  return [fu ** 0.7 * mid * ss(3, 8, r), mid];
}

function headPart(x, y, z) {
  const ax = Math.abs(x);
  let skin = smin(ellipsoid(x, y - 1.6, z + 0.6, 7.1, 8.6, 8.8), ellipsoid(x, y + 3.6, z - 2.4, 5.4, 5.8, 5.8), 3);
  skin = smin(skin, ellipsoid(x, y - 0.4, z + 4, 6.2, 6.2, 5), 2);
  const [ex, ey, ez] = earF(ax, y, z);
  const ear = smax(ellipsoid(ex, ey, ez, 1, 3.1, 2.3), -sphere(ex - 1, ey + 0.3, ez - 0.6, 1.4), 0.4);
  const [lift, mid] = lock(x, y, z);
  // Hairline: high at the temples, low at the nape, where each clump ends in a short point.
  const hairline = smax(-5.6 + 0.2 * ax - 0.9 * mid + 11 * ss(-4, 7, z), ax > 5.2 && z > -3.6 ? 3.2 - 0.6 * ss(-3.6, 0, z) : -9, 0.8);
  const shell = smin(ellipsoid(x, y - 1.7, z + 0.6, 7.7, 9.3, 9.5), ellipsoid(x, y - 0.4, z + 4, 6.9, 6.9, 5.7), 2);
  const hair = smax(shell - 0.4 + 0.4 * lift, hairline - y, 0.4);
  return U(S(0.5, [skin, 'skin'], [ear, 'skin']), [hair, 'blackHair']);
}

function body(x, y, z) {
  const ax = Math.abs(x);
  let shirt = smin(ellipsoid(x, y + 14, z - 0.5, 14, 13, 8.6), ellipsoid(x, y + 5.6, z - 0.3, 12.6, 4.4, 5.8), 5);
  shirt = smin(shirt, sphere(ax - 12.6, y + 9.4, z + 0.6, 5), 4);
  const sleeve = limb(ax, y, z, [13, -8, 0], [15, -16, -5], 5.2, 4.8);
  const neck = limb(x, y, z, [0, 1.5, -1.6], [0, 9, -2], 4.5, 4.3);
  const collar = torus(...collarAt(x, y, z), 4.9, 0.55);
  return U(S(1.5, [shirt, 'white'], [sleeve, 'white']), [collar, 'rib'], [neck, 'skin']);
}

function field(x, y, z) {
  const [hx, hy, hz] = head(x, y, z);
  const h = headPart(hx, hy, hz);
  const b = body(x, y, z);
  return b[0] < h[0] ? b : h;
}

// Shallow folds from the collar out over the shoulders, placed by screen height v since only the shoulder tops show.
const fold = (x, y, z) => {
  const ax = Math.abs(x), v = y * Math.cos(PITCH) - z * Math.sin(PITCH);
  return [[-2.4, 0.32], [-4.2, 0.26]].reduce((f, [v0, k]) => f + Math.exp(-(((v - v0 + (ax - 4) * k) / 0.35) ** 2)), 0) * clamp((ax - 4) / 3) * clamp((14 - ax) / 3);
};

// Lifted locks catch more light than the hair tucked under them, and the ear's back sits in a crease against the head.
function tone(p, v) {
  if (p.mat === 'white') return v - 0.3 * fold(p.x, p.y, p.z);
  const [x, y, z] = head(p.x, p.y, p.z);
  if (p.mat === 'blackHair') return v + 0.22 * lock(x, y, z)[0] - 0.08;
  if (p.mat !== 'skin' || y < -4 || y > 3) return v;
  const [ex] = earF(Math.abs(x), y, z);
  return ex > -0.2 && ex < 0.5 && Math.abs(x) > 6.4 ? Math.min(v, 0.4) : v;
}

export default { name: 'kid', scale: 5.8, field, tone, look: [0, 0, 0], canvas: [320, 260, 160, 196], crop: { bottom: 236 }, finish: { openBottom: true } };
