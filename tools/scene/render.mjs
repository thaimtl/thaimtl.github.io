// node tools/scene/render.mjs [name ...]  regenerates img/scene-*.png and img/scene.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { trace, paint, finish, toRGBA, cropBox, crop, ortho, writePNG } from './lib.mjs';
import { RAMPS } from './palette.mjs';
import elder from './elder.mjs';
import kid from './kid.mjs';
import { props } from './props.mjs';
import { table, board } from './wood.mjs';
import { bg, lawn } from './garden.mjs';

const sprites = [bg, lawn, elder, kid, ...props, table, board];
const img = new URL('../../img/', import.meta.url);
const only = process.argv.slice(2);
const jsonPath = new URL('scene.json', img);
const sizes = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, 'utf8')) : {};

for (const s of sprites) {
  if (only.length && !only.includes(s.name)) continue;
  const t0 = Date.now();
  let w, h, rgba, anchor;
  if (s.draw) ({ w, h, rgba } = s.draw());
  else {
    const [cw, ch, cx, cy] = s.canvas;
    const px = trace({ field: s.field, w: cw, h: ch, ray: s.ray || ortho(s.scale, s.look, cx, cy), ...s.trace });
    const full = paint(px, cw, ch, RAMPS, { tone: s.tone, ...s.paint });
    const b = cropBox(full, cw, ch, cx, s.crop);
    ({ w, h } = b);
    rgba = toRGBA(finish(crop(full, cw, ch, b), w, h, s.finish), RAMPS);
    anchor = cy - b.y;
  }
  writePNG(new URL(`scene-${s.name}.png`, img), rgba, w, h);
  // a prop's anchor row is where its table point lands, q its perspective scale there
  sizes[s.name] = s.q ? { w, h, anchor, q: +s.q.toFixed(4) } : { w, h };
  console.log(`${s.name}: ${w}x${h}${anchor === undefined ? '' : `, anchor row ${anchor}`} in ${Date.now() - t0}ms`);
}
writeFileSync(jsonPath, JSON.stringify(Object.fromEntries(sprites.map(s => [s.name, sizes[s.name]])), null, 2) + '\n');
