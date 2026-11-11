// Tileable 64x64 wood: planks for the table top, a lighter single slab for the board face.
import { noise, toRGBA } from './lib.mjs';
import { RAMPS } from './palette.mjs';

const N = 64, TAU = Math.PI * 2;
// Noise along x that wraps every 64 pixels, so the tile has no seams.
const loop = (x, seed, f) => noise(Math.cos((TAU * x) / N) * f + 5, Math.sin((TAU * x) / N) * f + 5, seed) - 0.5;

// Long grain lines that wander gently across the tile. `rows` are their resting heights.
const grain = (x, y, rows, seed, sway) => rows.some((r, k) => Math.abs(y - r - sway * loop(x, seed + k * 1.7, 0.7)) < 0.5);

function texture(ramp, shade) {
  const img = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) img.push({ mat: ramp, c: shade(x, y) });
  return { w: N, h: N, rgba: toRGBA(img, RAMPS) };
}

// Four long planks running left to right, each with a dark seam under it.
export const table = {
  name: 'table',
  draw: () => texture('wood', (x, y) => {
    const plank = y >> 4, py = y & 15;
    if (py === 15) return 1;
    return grain(x, py, [4, 10], plank * 3, 4) ? 2 : 3;
  }),
};

export const board = {
  name: 'board',
  draw: () => texture('board', (x, y) => (grain(x, y, [5, 19, 30, 44, 57], 4, 6) ? 2 : 3)),
};
