// Checks the rules engine in site.js and the piece each card stands for. Usage: node tools/check-game.mjs [site.js]
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

  // every spacer names one of the visitor's Black pieces where it starts, its card's seal wears that piece's Black character, and each kind stands for one card
  const html = readFileSync(join(dirname(path), 'index.html'), 'utf8'), board = start(), used = new Set();
  const black = { K: 'jiang', A: 'shi-b', E: 'xiang-b', H: 'ma-b', R: 'ju-b', C: 'pao-b', P: 'zu' };
  const beats = [...html.matchAll(/<section class="beat"([^>]*)>(.*?)<\/section>\s*<section\b[^>]*id="([^"]+)"/gs)];
  if (beats.length !== html.match(/<section class="beat"/g).length) throw new Error('a spacer is not followed by a card with an id');
  for (const [, attrs, seal, card] of beats) {
    const t = /data-piece="(\w)"/.exec(attrs)?.[1], sq = /data-sq="(\w+)"/.exec(attrs)?.[1], p = board.get(sq);
    if (!t || !sq) throw new Error(`#${card}: its spacer needs data-piece and data-sq`);
    if (p?.side !== 'b' || p.t !== t) throw new Error(`#${card}: ${sq} holds ${p ? p.side + p.t : 'nothing'} in the opening, not Black's ${t}`);
    if (used.has(t)) throw new Error(`#${card}: ${t} already stands for another card`);
    used.add(t);
    const glyph = /<use href="#g-([\w-]+)"/.exec(seal)?.[1], face = new RegExp(`<span class="p" data-sq="${sq}"[^>]*>.*?<use href="#g-([\\w-]+)"`).exec(html)?.[1];
    if (/pc--red/.test(seal) || glyph !== black[t] || face !== glyph) throw new Error(`#${card}: the seal shows #g-${glyph}, the stone on ${sq} #g-${face}, Black's ${t} is #g-${black[t]}`);
    console.log(`#${card.padEnd(8)} ${t} ${sq.padEnd(3)} #g-${glyph}`);
  }
  if (used.size !== 7) throw new Error(`${used.size} of the 7 kinds stand for a card`);
  console.log(`index.html: ${beats.length} cards, one Black piece of each kind, seals match the stones`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
