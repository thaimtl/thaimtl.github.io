// node tools/highlights/build.mjs [key ...]  turns tools/highlights/<key>.mjs pixel grids into img/hl-<key>.svg, plus an 8x PNG preview for checking.
// Each grid is 32 strings of 32 characters. '.' is transparent, every other character maps to a scene palette name through `legend`.
import { readdirSync, writeFileSync } from 'node:fs';
import { C } from '../scene/palette.mjs';
import { writePNG, hex } from '../scene/lib.mjs';

const dir = new URL('./', import.meta.url), img = new URL('../../img/', import.meta.url);
const keys = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(dir).filter(f => f.endsWith('.mjs') && f !== 'build.mjs').map(f => f.slice(0, -4));
const N = 32, Z = 8;

for (const key of keys) {
  const { grid, legend } = await import(new URL(`${key}.mjs`, dir));
  if (grid.length !== N || grid.some(r => r.length !== N)) throw new Error(`${key}: grid must be ${N} rows of ${N} characters`);
  const color = ch => { const c = C[legend[ch]]; if (!c) throw new Error(`${key}: '${ch}' maps to no palette colour`); return c; };
  // one path per colour, each row's runs as h-steps, so the file stays small and the edges stay crisp
  const paths = new Map();
  grid.forEach((row, y) => {
    for (let x = 0; x < N;) {
      const ch = row[x];
      let e = x + 1;
      while (e < N && row[e] === ch) e++;
      if (ch !== '.') { const c = color(ch); paths.set(c, (paths.get(c) || '') + `M${x} ${y}h${e - x}v1h-${e - x}z`); }
      x = e;
    }
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges">${[...paths].map(([c, d]) => `<path fill="${c}" d="${d}"/>`).join('')}</svg>\n`;
  writeFileSync(new URL(`hl-${key}.svg`, img), svg);
  // preview: each art pixel as an 8x8 block on a light grey checker, so transparency shows
  const W = N * Z, rgba = Buffer.alloc(W * W * 4);
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
    const ch = grid[j / Z | 0][i / Z | 0], o = (j * W + i) * 4;
    const [r, g, b] = ch === '.' ? ((i >> 4) + (j >> 4)) % 2 ? [236, 236, 236] : [250, 250, 250] : hex(color(ch));
    rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
  }
  const out = `${process.env.PREVIEW_DIR || '/tmp'}/hl-${key}-preview.png`;
  writePNG(out, rgba, W, W);
  console.log(`img/hl-${key}.svg  ${svg.length} bytes, preview ${out}`);
}
