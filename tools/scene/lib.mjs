import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const mix = (a, b, t) => a + (b - a) * t;
export const len = (x, y, z = 0) => Math.sqrt(x * x + y * y + z * z);
export const deg = Math.PI / 180;

// One light for every sprite: from the upper left, a little toward the camera.
export const LIGHT = (() => { const l = len(-0.55, 0.72, 0.42); return [-0.55 / l, 0.72 / l, 0.42 / l]; })();
const PITCH = 30 * deg;

// Signed distance primitives. Points are already in the shape's local frame.
export const sphere = (x, y, z, r) => len(x, y, z) - r;
export const ellipsoid = (x, y, z, a, b, c) => {
  const k0 = len(x / a, y / b, z / c), k1 = len(x / (a * a), y / (b * b), z / (c * c));
  return k1 === 0 ? -Math.min(a, b, c) : (k0 * (k0 - 1)) / k1;
};
export function limb(x, y, z, a, b, ra, rb = ra) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], px = x - a[0], py = y - a[1], pz = z - a[2];
  const h = clamp((px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz));
  return len(px - bx * h, py - by * h, pz - bz * h) - mix(ra, rb, h);
}
export function box(x, y, z, bx, by, bz, r = 0) {
  const qx = Math.abs(x) - bx + r, qy = Math.abs(y) - by + r, qz = Math.abs(z) - bz + r;
  return len(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}
export function cylinder(x, y, z, r, h, round = 0) {
  const dx = len(x, z) - r + round, dy = Math.abs(y) - h + round;
  return len(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - round;
}

export const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
export const smax = (a, b, k) => -smin(-a, -b, k);

// Material-carrying shapes are [distance, material]. U is a hard union, S a smooth one.
export const U = (...ps) => ps.reduce((a, b) => (b[0] < a[0] ? b : a));
export const S = (k, ...ps) => ps.reduce((a, b) => [smin(a[0], b[0], k), b[0] < a[0] ? b[1] : a[1]]);

// Moves a world point into a frame at o, turned by yaw (about y), then pitch (about x), then roll (about z).
export function frame(o, yaw = 0, pitch = 0, roll = 0) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  const f = (x, y, z) => {
    x -= o[0]; y -= o[1]; z -= o[2];
    const x1 = cy * x - sy * z, z1 = sy * x + cy * z;
    const y1 = cp * y - sp * z1, z2 = sp * y + cp * z1;
    return [cr * x1 + sr * y1, -sr * x1 + cr * y1, z2];
  };
  f.world = (x, y, z) => {
    const x1 = cr * x - sr * y, y1 = sr * x + cr * y;
    const y0 = cp * y1 + sp * z, z1 = -sp * y1 + cp * z;
    return [cy * x1 + sy * z1 + o[0], y0 + o[1], -sy * x1 + cy * z1 + o[2]];
  };
  return f;
}

const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
export function noise(x, y, z = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const v = (a, b, c) => hash(ix + a, iy + b, iz + c);
  return mix(mix(mix(v(0, 0, 0), v(1, 0, 0), ux), mix(v(0, 1, 0), v(1, 1, 0), ux), uy),
    mix(mix(v(0, 0, 1), v(1, 0, 1), ux), mix(v(0, 1, 1), v(1, 1, 1), ux), uy), uz);
}
export const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16 - 0.5);

const normal = (f, x, y, z, e = 0.04) => {
  const a = f(x + e, y - e, z - e)[0], b = f(x - e, y - e, z + e)[0], c = f(x - e, y + e, z - e)[0], d = f(x + e, y + e, z + e)[0];
  const nx = a - b - c + d, ny = -a - b + c + d, nz = -a + b - c + d, l = len(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
};

function march(f, ox, oy, oz, dx, dy, dz, far, eps, steps = 400) {
  let t = 0;
  for (let i = 0; i < steps && t < far; i++) {
    const d = f(ox + dx * t, oy + dy * t, oz + dz * t)[0];
    if (d < eps) return t;
    t += d * 0.8;
  }
  return -1;
}

// Casts one ray per pixel and returns what each pixel sees: material, light, depth, position.
export function trace({ field, w, h, ray, far = 400, eps = 0.02, ao = 1, shadowFar = 120, steps = 400 }) {
  const out = new Array(w * h).fill(null);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const [ox, oy, oz, dx, dy, dz] = ray(i + 0.5, j + 0.5);
    const t = march(field, ox, oy, oz, dx, dy, dz, far, eps, steps);
    if (t < 0) continue;
    const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
    const [nx, ny, nz] = normal(field, x, y, z, eps * 2);
    let occ = 0, wgt = 1;
    for (let k = 1; k <= 5; k++) { const s = 0.5 * k * ao; occ += ((s - field(x + nx * s, y + ny * s, z + nz * s)[0]) * wgt) / ao; wgt *= 0.6; }
    const lit = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
    const sun = lit > 0 && march(field, x + nx * eps * 8, y + ny * eps * 8, z + nz * eps * 8, ...LIGHT, shadowFar, eps, steps) < 0;
    out[j * w + i] = { mat: field(x, y, z)[1], x, y, z, nx, ny, nz, t, lit: sun ? lit : 0, ao: clamp(1 - occ * 0.35) };
  }
  return out;
}

// Orthographic camera tilted down by PITCH, looking toward -z. World point `look` lands on pixel (cx, cy).
export function ortho(scale, look, cx, cy) {
  const s = Math.sin(PITCH), c = Math.cos(PITCH);
  return (i, j) => {
    const u = (i - cx) / scale, v = (cy - j) / scale;
    return [look[0] + u, look[1] + v * c + s * 200, look[2] - v * s + c * 200, 0, -s, -c];
  };
}

export const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// Turns traced pixels into palette colours. Ramps run dark to light, ramp[0] is the outline.
export function paint(px, w, h, ramps, { bands = [0.36, 0.6, 0.84], dither = {}, tone } = {}) {
  const img = new Array(w * h).fill(null);
  for (let k = 0; k < px.length; k++) {
    const p = px[k];
    if (!p) continue;
    let v = p.ao * (0.3 + 0.7 * p.lit);
    if (tone) v = tone(p, v);
    const ramp = ramps[p.mat];
    if (!ramp) throw new Error('no ramp for ' + p.mat);
    if (dither[p.mat]) v += BAYER[(k % w & 3) + ((Math.floor(k / w) & 3) << 2)] * dither[p.mat];
    let b = 1;
    for (const t of bands) if (v > t) b++;
    img[k] = { mat: p.mat, c: Math.min(b, ramp.length - 1), t: p.t };
  }
  return img;
}

const DETAILS = ['eye'];

// Pixel-art clean-up: fill notches, cut spurs, merge lone pixels, then outline silhouettes and depth breaks,
// and where a material in `edgeMats` meets another material.
export function finish(img, w, h, { depthBreak = 4, relative = false, outlineMats, edgeMats = [], openBottom = false } = {}) {
  const at = (i, j) => (i < 0 || j < 0 || i >= w ? null : j >= h ? (openBottom ? img[(h - 1) * w + i] : null) : img[j * w + i]);
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const p = at(i, j), n = N4.map(([a, b]) => at(i + a, j + b));
    const solid = n.filter(Boolean);
    if (!p && solid.length >= 3) img[j * w + i] = { ...solid[0] };
    else if (p && solid.length <= 1) img[j * w + i] = null;
  }
  for (let pass = 0; pass < 2; pass++) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const p = at(i, j);
    if (!p) continue;
    const n = N4.map(([a, b]) => at(i + a, j + b)).filter(q => q && q.mat === p.mat);
    if (n.length >= 3 && !n.some(q => q.c === p.c)) {
      const count = {};
      for (const q of n) count[q.c] = (count[q.c] || 0) + 1;
      p.c = +Object.keys(count).sort((a, b) => count[b] - count[a])[0];
    }
  }
  // Specks of one material, three pixels or fewer, take the colour around them, unless they are painted details.
  const seen = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) {
    if (seen[k] || !img[k] || DETAILS.includes(img[k].mat)) continue;
    const blob = [k], mat = img[k].mat;
    seen[k] = 1;
    for (let b = 0; b < blob.length && blob.length < 5; b++) for (const [a, c] of N4) {
      const i = (blob[b] % w) + a, j = Math.floor(blob[b] / w) + c, q = at(i, j);
      if (q && q.mat === mat && !seen[j * w + i]) { seen[j * w + i] = 1; blob.push(j * w + i); }
    }
    if (blob.length > 3) continue;
    const around = blob.flatMap(b => N4.map(([a, c]) => at((b % w) + a, Math.floor(b / w) + c))).filter(q => q && q.mat !== mat);
    if (around.length < blob.length * 3) continue;
    for (const b of blob) Object.assign(img[b], { mat: around[0].mat, c: around[0].c });
  }
  const edge = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const p = at(i, j);
    if (!p || (outlineMats && !outlineMats.includes(p.mat))) continue;
    const mine = edgeMats.includes(p.mat);
    if (N4.some(([a, b]) => { const q = at(i + a, j + b); return !q || q.t - p.t > depthBreak * (relative ? p.t : 1) || (mine && q.mat !== p.mat && q.mat !== 'pith'); })) edge.push(p);
  }
  for (const p of edge) p.c = 0;
  return img;
}

export function toRGBA(img, ramps) {
  const rgba = Buffer.alloc(img.length * 4);
  img.forEach((p, k) => { if (p) { rgba.set(hex(ramps[p.mat][p.c]), k * 4); rgba[k * 4 + 3] = 255; } });
  return rgba;
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = buf => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length), td = Buffer.concat([Buffer.from(type), data]);
  out.writeUInt32BE(data.length, 0); td.copy(out, 4); out.writeUInt32BE(crc32(td), 8 + data.length);
  return out;
};
export function writePNG(file, rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let j = 0; j < h; j++) rgba.copy(raw, j * (w * 4 + 1) + 1, j * w * 4, (j + 1) * w * 4);
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}

// Crops a traced sprite to its pixels, keeping `anchor` (a column) at the horizontal centre. Returns the crop box.
export function cropBox(img, w, h, cx, { margin = 1, bottom } = {}) {
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  img.forEach((p, k) => { if (p) { const i = k % w, j = (k / w) | 0; x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); } });
  const half = Math.ceil(Math.max(cx - x0, x1 + 1 - cx)) + margin;
  return { x: Math.round(cx) - half, y: y0 - margin, w: half * 2, h: (bottom ?? y1 + 1 + margin) - (y0 - margin) };
}
export function crop(img, w, h, b) {
  const out = new Array(b.w * b.h).fill(null);
  for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) {
    const si = i + b.x, sj = j + b.y;
    if (si >= 0 && sj >= 0 && si < w && sj < h) out[j * b.w + i] = img[sj * w + si];
  }
  return out;
}
