// Replays the stage game with the rules engine in site.js. Usage: node tools/check-game.mjs [site.js]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const path = process.argv[2] || 'site.js', src = readFileSync(path, 'utf8');
const block = (a, b) => { const m = new RegExp(`/\\*${a}\\*/([\\s\\S]*?)/\\*${b}\\*/`).exec(src); if (!m) throw new Error(`${path} has no /*${a}*/ ... /*${b}*/ block`); return m[1]; };

try {
  const { start, legal, moves } = new Function(`${block('rules', 'rules end')}\nreturn { start, legal, moves };`)();
  const custom = o => new Map(Object.entries(o).map(([s, v]) => [s, { side: v[0], t: v[1] }]));
  const illegal = [
    ['soldier sideways before the river', start(), 'a4-b4'],
    ['soldier backward after the river', custom({ e1: 'rK', d10: 'bK', c6: 'rP' }), 'c6-c5'],
    ['hobbled horse', start(), 'b1-d2'],
    ['elephant across the river', custom({ e1: 'rK', d10: 'bK', c5: 'rE' }), 'c5-e7'],
    ['elephant with a blocked eye', custom({ e1: 'rK', d10: 'bK', c1: 'rE', d2: 'bP' }), 'c1-e3'],
    ['cannon capture with no screen', start(), 'h3-h8'],
    ['cannon capture over two screens', custom({ e1: 'rK', d10: 'bK', b3: 'rC', b5: 'rP', b6: 'bP', b8: 'bC' }), 'b3-b8'],
    ['general leaving the palace', custom({ d1: 'rK', f10: 'bK' }), 'd1-c1'],
    ['advisor leaving the palace', custom({ e1: 'rK', f10: 'bK', d1: 'rA' }), 'd1-c2'],
    ['chariot through a piece', start(), 'a1-a5'],
    ['generals facing', custom({ d1: 'rK', e10: 'bK', c5: 'rP' }), 'd1-e1'],
    ['leaving the general in check', custom({ e1: 'rK', d10: 'bK', e2: 'rR', e9: 'bR' }), 'e2-d2'],
  ];
  const fine = [['soldier forward', 'a4-a5'], ['horse with a free leg', 'b1-c3'], ['cannon over a screen', 'h3-h10'], ['elephant', 'c1-e3'], ['advisor', 'd1-e2']];
  for (const [label, b, mv] of illegal) if (legal(b, ...mv.split('-'))) throw new Error(`self-test: ${label} (${mv}) should be illegal`);
  for (const [label, mv] of fine) if (!legal(start(), ...mv.split('-'))) throw new Error(`self-test: ${label} (${mv}) should be legal`);
  if (moves(start(), 'b1').join() !== 'a3,c3') throw new Error('self-test: the horse on b1 should reach a3 and c3');
  console.log(`self-test: ${illegal.length} illegal and ${fine.length + 1} legal cases pass`);

  const b = start();
  let turn = 'r', n = 0;
  for (const [beat, ...mvs] of JSON.parse(block('game', 'end'))) {
    for (const mv of mvs.slice(0, 2)) {
      if (!mv) continue;
      const [from, to] = mv.split('-'), p = b.get(from);
      if (!p || p.side !== turn || !legal(b, from, to)) throw new Error(`${beat}: ${turn === 'r' ? 'Red' : 'Black'} ${mv} is illegal`);
      const taken = b.get(to);
      b.delete(from);
      b.set(to, p);
      console.log(`${beat.padEnd(4)} ${turn === 'r' ? 'Red  ' : 'Black'} ${p.t}${mv}${taken ? ` takes ${taken.t}` : ''}`);
      turn = turn === 'r' ? 'b' : 'r';
      n++;
    }
  }
  console.log(`${path}: all ${n} moves are legal`);

  // each card's seal must be the piece Red moves in the beat directly above it
  const html = readFileSync(join(dirname(path), 'index.html'), 'utf8'), seals = new Map(), glyph = { K: 'shuai', A: 'shi', E: 'xiang', H: 'ma', R: 'ju', C: 'pao', P: 'bing' };
  for (const [, beat, seal] of html.matchAll(/<section class="beat" data-beat="(\w+)"[^>]*>(.*?)<\/section>\s*<section\b/gs)) seals.set(beat, seal);
  const pos = start();
  for (const [beat, red, black] of JSON.parse(block('game', 'end'))) {
    const [from, to] = red.split('-'), t = pos.get(from).t, seal = seals.get(beat) ?? '';
    const [, got] = /<svg class="seal[^"]*" data-t="(\w)"/.exec(seal) ?? [];
    if (got !== t || !seal.includes(`href="#g-${glyph[t]}"`)) throw new Error(`${beat}: the seal on the card below should be data-t="${t}" with #g-${glyph[t]}, for Red's ${red}`);
    for (const [a, b] of [[from, to], ...(black ? [black.split('-')] : [])]) { pos.set(b, pos.get(a)); pos.delete(a); }
  }
  console.log(`index.html: all ${seals.size} seals match the piece Red moves above them`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
