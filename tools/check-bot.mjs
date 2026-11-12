// Tests bot.js against the rules engine in site.js. Usage: node tools/check-bot.mjs
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const site = read('site.js');
const rules = /\/\*rules\*\/([\s\S]*?)\/\*rules end\*\//.exec(site)?.[1];
if (!rules) throw new Error('site.js has no /*rules*/ ... /*rules end*/ block');
const page = new Function(`${rules}\nreturn { start, legal, moves, exposed };`)();
const API = '\nreturn { reply, load, legalMoves, make, unmake, moveStr, outcome, think, deepen, rand, board, BOOK, TTF, KILL, HIST, START, MATE };';
const bot = new Function(read('bot.js') + API)();
// the same engine with transposition table cutoffs turned off, as a reference for search results
const noTT = new Function(read('bot.js').replace('if (hit && ply && TTD[slot] >= depth)', 'if (false)') + API)();
const fresh = B => { B.TTF.fill(0); B.KILL.fill(0); B.HIST.fill(0); };

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
};

// page-engine helpers on Map positions
const other = s => (s === 'r' ? 'b' : 'r');
const custom = o => new Map(Object.entries(o).map(([s, v]) => [s, { side: v[0], t: v[1] }]));
const pageMoves = (b, side) => [...b].filter(([, p]) => p.side === side).flatMap(([s]) => page.moves(b, s).map(t => `${s}-${t}`));
const pageLegal = (b, side, mv) => { const [f, t] = String(mv).split('-'); return b.get(f)?.side === side && page.legal(b, f, t); };
const play = (b, mv) => { const [f, t] = mv.split('-'), next = new Map(b); next.set(t, next.get(f)); next.delete(f); return next; };
const keyOf = (b, side) => [...b].map(([s, p]) => s + p.side + p.t).sort().join() + side;
const sameSet = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
const botMoves = (pieces, side) => { bot.load(pieces, side); return bot.legalMoves().map(bot.moveStr); };
// a win leaves the other side without a legal move, a mate also leaves it in check
const wins = (b, side, mv) => !pageMoves(play(b, mv), other(side)).length;
const mates = (b, side, mv) => wins(b, side, mv) && page.exposed(play(b, mv), other(side));
const winInTwo = (b, side, mv) => {
  const next = play(b, mv), replies = pageMoves(next, other(side));
  return replies.length > 0 && replies.every(r => { const after = play(next, r); return pageMoves(after, side).some(m => wins(after, side, m)); });
};

// a. perft
bot.load(bot.START, 'r');
const perft = d => (d === 1 ? bot.legalMoves().length : bot.legalMoves().reduce((t, m) => (bot.make(m), (t += perft(d - 1)), bot.unmake(m), t), 0));
[44, 1920, 79666, 3290240].forEach((want, i) => {
  const t = Date.now(), got = perft(i + 1);
  check(`perft ${i + 1} = ${want}`, got === want, `got ${got} in ${Date.now() - t} ms`);
});

// b. differential against the page engine over seeded random playouts that favour captures
{
  const rng = bot.rand(7);
  let positions = 0, fewest = 32, bad = '';
  for (let g = 0; positions < 400 && !bad; g++) {
    let b = page.start(), side = 'r';
    bot.load(bot.START, 'r');
    for (let ply = 0; ply < 250; ply++) {
      const mine = bot.legalMoves().map(bot.moveStr), theirs = pageMoves(b, side);
      positions++;
      fewest = Math.min(fewest, b.size);
      if (!sameSet(mine, theirs)) { bad = `game ${g} ply ${ply}: bot ${mine.length}, page ${theirs.length}`; break; }
      if (!mine.length) break;
      const caps = mine.filter(m => b.has(m.split('-')[1])), pool = caps.length && rng() < 0.6 ? caps : mine;
      const mv = pool[Math.floor(rng() * pool.length)];
      bot.make(bot.legalMoves().find(m => bot.moveStr(m) === mv));
      b = play(b, mv);
      side = other(side);
    }
  }
  check(`legal moves match the page on ${positions} random positions`, !bad && positions >= 300, bad || `fewest pieces ${fewest}`);
  check('random positions reach sparse endgames', fewest <= 8, `fewest pieces ${fewest}`);
}

// c. rules on hand-built positions: [label, pieces, side to move, move, legal?]
const kings = { e1: 'rK', d10: 'bK' };
const RULES = [
  ['pinned chariot slides along the generals’ file', { e1: 'rK', e10: 'bK', e5: 'rR' }, 'r', 'e5-e8', true],
  ['pinned chariot may not leave the generals’ file', { e1: 'rK', e10: 'bK', e5: 'rR' }, 'r', 'e5-d5', false],
  ['general may not step onto an open file facing the other', { d1: 'rK', e10: 'bK' }, 'r', 'd1-e1', false],
  ['general may step up its own file', { d1: 'rK', e10: 'bK' }, 'r', 'd1-d2', true],
  ['general may not step into an attacked point', { e1: 'rK', f10: 'bK', d9: 'bR' }, 'r', 'e1-d1', false],
  ['a move that leaves the general in check is illegal', { e1: 'rK', d10: 'bK', e2: 'rR', e9: 'bR' }, 'r', 'e2-d2', false],
  ['cannon captures over exactly one screen', { ...kings, b3: 'rC', b5: 'rP', b8: 'bH' }, 'r', 'b3-b8', true],
  ['cannon cannot capture without a screen', { ...kings, b3: 'rC', b8: 'bH' }, 'r', 'b3-b8', false],
  ['cannon cannot capture over two screens', { ...kings, b3: 'rC', b5: 'rP', b6: 'bP', b8: 'bH' }, 'r', 'b3-b8', false],
  ['cannon cannot move past a screen to an empty point', { ...kings, b3: 'rC', b5: 'rP' }, 'r', 'b3-b6', false],
  ['cannon slides up to a screen', { ...kings, b3: 'rC', b5: 'rP' }, 'r', 'b3-b4', true],
  ['horse blocked by a piece ahead of it', { ...kings, e5: 'rH', e6: 'bP' }, 'r', 'e5-d7', false],
  ['horse blocked ahead still moves sideways', { ...kings, e5: 'rH', e6: 'bP' }, 'r', 'e5-c6', true],
  ['horse blocked by a piece beside it', { ...kings, e5: 'rH', f5: 'bP' }, 'r', 'e5-g4', false],
  ['horse blocked beside still moves forward', { ...kings, e5: 'rH', f5: 'bP' }, 'r', 'e5-f7', true],
  ['elephant blocked on its eye', { ...kings, c1: 'rE', d2: 'bP' }, 'r', 'c1-e3', false],
  ['elephant with a free eye', { ...kings, c1: 'rE' }, 'r', 'c1-e3', true],
  ['elephant may not cross the river', { ...kings, c5: 'rE' }, 'r', 'c5-e7', false],
  ['black elephant may not cross the river', { ...kings, g6: 'bE' }, 'b', 'g6-e4', false],
  ['red soldier forward before the river', { ...kings, c4: 'rP' }, 'r', 'c4-c5', true],
  ['red soldier not sideways before the river', { ...kings, c4: 'rP' }, 'r', 'c4-b4', false],
  ['red soldier sideways after the river', { ...kings, c6: 'rP' }, 'r', 'c6-b6', true],
  ['red soldier never backward', { ...kings, c6: 'rP' }, 'r', 'c6-c5', false],
  ['black soldier forward before the river', { ...kings, g7: 'bP' }, 'b', 'g7-g6', true],
  ['black soldier not sideways before the river', { ...kings, g7: 'bP' }, 'b', 'g7-h7', false],
  ['black soldier sideways after the river', { ...kings, g5: 'bP' }, 'b', 'g5-h5', true],
  ['black soldier never backward', { ...kings, g5: 'bP' }, 'b', 'g5-g6', false],
  ['general may not leave the palace sideways', { d1: 'rK', f10: 'bK' }, 'r', 'd1-c1', false],
  ['general may not leave the palace forward', { d3: 'rK', f10: 'bK' }, 'r', 'd3-d4', false],
  ['general moves along the palace edge', { d3: 'rK', f10: 'bK' }, 'r', 'd3-e3', true],
  ['black general may not leave the palace', { e1: 'rK', f8: 'bK' }, 'b', 'f8-f7', false],
  ['advisor moves to the palace center', { e1: 'rK', f10: 'bK', d1: 'rA' }, 'r', 'd1-e2', true],
  ['advisor may not leave the palace', { e1: 'rK', f10: 'bK', d3: 'rA' }, 'r', 'd3-c4', false],
  ['advisor may not move straight', { e1: 'rK', f10: 'bK', d1: 'rA' }, 'r', 'd1-d2', false]
];
for (const [label, pieces, side, mv, want] of RULES) {
  const got = botMoves(pieces, side).includes(mv), ref = pageLegal(custom(pieces), side, mv);
  check(`rule: ${label}`, got === want && ref === want, `${mv} bot ${got}, page ${ref}`);
}
{
  bot.load({ e1: 'rK', d10: 'bK', d3: 'bH', d2: 'rA' }, 'r');
  const hobbled = bot.outcome().check;
  bot.load({ e1: 'rK', d10: 'bK', d3: 'bH' }, 'r');
  check('rule: a hobbled horse gives no check, a free one does', !hobbled && bot.outcome().check);
  bot.load({ e1: 'rK', d10: 'bK', d5: 'rR' }, 'b');
  const mate = bot.outcome();
  check('end: checked side with no legal move is mated', mate.status === 'mate' && mate.winner === 'r' && mate.check && !mate.legal.length);
  const stuckPieces = { e10: 'bK', d1: 'rK', f2: 'rR', a9: 'rR' };
  bot.load(stuckPieces, 'b');
  const stuck = bot.outcome();
  check('end: side with no legal move and no check loses', stuck.status === 'stuck' && stuck.winner === 'r' && !stuck.check && !pageMoves(custom(stuckPieces), 'b').length);
  const shuffle = ['h1-g3', 'h10-g8', 'g3-h1', 'g8-h10'], twice = [...shuffle, ...shuffle];
  const at = k => bot.reply({ id: k, moves: twice.slice(0, k), probe: true });
  check('end: start position seen twice is still play', at(4).status === 'play' && at(7).status === 'play');
  const third = at(8);
  check('end: third repetition is a draw', third.status === 'draw' && third.winner === null && !third.legal.length);
  // a 300-ply game with no capture and no third repetition, built from seeded random quiet moves
  const rng = bot.rand(3), long = [];
  let b = page.start(), side = 'r';
  const seen = new Map([[keyOf(b, side), 1]]);
  bot.load(bot.START, 'r');
  while (long.length < 300) {
    const legal = bot.legalMoves().map(bot.moveStr).filter(m => !b.has(m.split('-')[1]));
    const fine = legal.filter(m => (seen.get(keyOf(play(b, m), other(side))) || 0) < 2);
    if (!fine.length) break;
    const mv = fine[Math.floor(rng() * fine.length)];
    bot.make(bot.legalMoves().find(m => bot.moveStr(m) === mv));
    b = play(b, mv);
    side = other(side);
    seen.set(keyOf(b, side), (seen.get(keyOf(b, side)) || 0) + 1);
    long.push(mv);
  }
  const before = bot.reply({ moves: long.slice(0, 299), probe: true }), capped = bot.reply({ moves: long, probe: true });
  check('end: ply 300 is a draw by the cap', long.length === 300 && before.status === 'play' && capped.status === 'draw' && capped.winner === null);
  check('end: a move after the game is over is illegal', bot.reply({ id: 2, moves: [...long, before.legal[0]] }).at === 300);
}

// d. tactics. Mate in one: [side, pieces]. Every position must have a mate according to the page engine.
const MATE1 = [
  ['r', { e1: 'rK', h5: 'rR', d10: 'bK', a7: 'bP' }],
  ['r', { e1: 'rK', e5: 'rC', b6: 'rC', e10: 'bK', d10: 'bR', f10: 'bR' }],
  // the a7 soldier keeps f1-e1 from winning by leaving Black stuck, so the only win in one is the mate
  ['r', { f1: 'rK', d3: 'rR', h7: 'rH', e10: 'bK', e9: 'bA', f10: 'bA', a7: 'bP' }],
  ['r', { e1: 'rK', a9: 'rR', g9: 'rP', f10: 'bK', c5: 'bP' }],
  ['r', { d1: 'rK', a9: 'rR', b1: 'rR', e10: 'bK', e7: 'bP' }],
  ['b', { e10: 'bK', b6: 'bR', f1: 'rK', i6: 'rP' }],
  ['b', { e10: 'bK', e6: 'bC', b5: 'bC', e1: 'rK', d1: 'rR', f1: 'rR' }]
];
const MATE2 = [
  ['r', { d1: 'rK', a7: 'rR', b1: 'rR', e10: 'bK', i4: 'bP' }],
  ['r', { f2: 'rK', h1: 'rR', f1: 'rR', d8: 'bK', c10: 'bE', i3: 'bP' }],
  ['r', { d1: 'rK', b6: 'rR', f5: 'rH', a6: 'rH', e8: 'bK', f3: 'bH', f10: 'bA' }],
  ['r', { f3: 'rK', f1: 'rR', h7: 'rC', d6: 'rC', d9: 'bK', a8: 'bE', c5: 'bP' }]
];
const HANGING = [
  ['r', { e1: 'rK', a1: 'rR', d10: 'bK', e7: 'bP', a6: 'bR' }, 'a1-a6'],
  ['r', { d1: 'rK', b3: 'rC', b8: 'bC', b10: 'bR', e10: 'bK' }, 'b3-b10'],
  ['b', { e10: 'bK', c8: 'bH', b6: 'rR', d1: 'rK' }, 'c8-b6']
];
const toughTimes = [], gentleTimes = [];
const think = (level, pieces, side, seed) => {
  bot.load(pieces, side);
  const t = Date.now(), mv = bot.moveStr(bot.think(level, bot.rand(seed)));
  (level === 'tough' ? toughTimes : gentleTimes).push(Date.now() - t);
  return mv;
};
MATE1.forEach(([side, pieces], i) => {
  const b = custom(pieces), any = pageMoves(b, side).filter(m => mates(b, side, m));
  const tough = think('tough', pieces, side, i), gentle = [1, 2, 3].map(s => think('gentle', pieces, side, s));
  check(`mate in one #${i + 1}: tough and gentle mate`, any.length > 0 && mates(b, side, tough) && gentle.every(m => mates(b, side, m)), `${tough}, ${gentle.join(' ')}`);
});
MATE2.forEach(([side, pieces], i) => {
  const b = custom(pieces), none = !pageMoves(b, side).some(m => wins(b, side, m)), tough = think('tough', pieces, side, i);
  check(`mate in two #${i + 1}: tough plays a forced mate`, none && winInTwo(b, side, tough), tough);
});
HANGING.forEach(([side, pieces, want], i) => {
  const tough = think('tough', pieces, side, i), gentle = [1, 2, 3].map(s => think('gentle', pieces, side, s));
  check(`hanging piece #${i + 1}: both levels take it`, tough === want && gentle.every(m => m === want), `${tough}, ${gentle.join(' ')}`);
});
{
  // a free rook on i1 while a quiet move scored within the random margin at two plies
  const free = { c1: 'rR', d1: 'rA', e1: 'rK', f1: 'rA', h1: 'rH', i1: 'rR', c3: 'rC', e3: 'rE', i3: 'bR', a4: 'rP', g4: 'rP', c6: 'rP', a7: 'bP', g7: 'bP', h9: 'bC', b10: 'bH', c10: 'bE', d10: 'bA', e10: 'bK', f10: 'bA', g10: 'bE', h10: 'bH' };
  const gentle = [1, 2, 3, 4, 5, 6].map(s => think('gentle', free, 'b', s));
  check('gentle takes a free piece over a quiet move of nearly the same score', gentle.every(m => m === 'i3-i1'), gentle.join(' '));
  // an attacked crossed soldier: only stepping it forward saves it
  const SAVE = [['r', { e1: 'rK', c6: 'rP', d10: 'bK', a6: 'bR' }, 'c6-c7'], ['b', { f10: 'bK', e5: 'bP', d1: 'rK', i5: 'rR' }, 'e5-e4']];
  const saves = SAVE.map(([side, pieces]) => [1, 2, 3, 4, 5, 6, 7, 8].map(s => think('gentle', pieces, side, s)));
  check('gentle keeps to a small margin and does not drop a soldier', saves.every((ms, i) => ms.every(m => m === SAVE[i][2])), saves.map(ms => ms.join(' ')).join(' | '));
  // Red to move with a lone general: f2-f1 lets d2-e2 leave it with no legal move
  const lone = { f2: 'rK', d2: 'bP', i5: 'bP', a6: 'bP', e6: 'bP', e7: 'bH', d8: 'bA', e8: 'bE', d9: 'bK', f10: 'bA' }, b = custom(lone);
  const picks = [1, 2, 3, 4, 5, 6].map(s => think('gentle', lone, 'r', s));
  check('gentle sees a stuck loss at its horizon', picks.every(m => pageMoves(play(b, m), 'b').every(r => pageMoves(play(play(b, m), r), 'r').length)), picks.join(' '));
}
{
  const rng = bot.rand(11), found = [];
  while (found.length < 20) {
    const moves = [];
    let r = bot.reply({ moves, probe: true });
    for (let len = 10 + Math.floor(rng() * 60); moves.length < len && r.status === 'play'; r = bot.reply({ moves, probe: true })) moves.push(r.legal[Math.floor(rng() * r.legal.length)]);
    if (r.status !== 'play') continue;
    const [a, b] = [bot, noTT].map(B => { B.reply({ moves, probe: true }); fresh(B); return B.deepen(Infinity, 5).score; });
    found.push(a === b ? '' : `${moves.length} plies: ${a} vs ${b}`);
  }
  const off = found.filter(Boolean);
  check('search: the transposition table never changes a depth-5 score on 20 random positions', !off.length, off.join(', '));
  // Red is winning, and b9-b10 would repeat the position for the third time
  const line = ['a2-e2', 'c10-e8', 'c6-c7', 'd10-e9', 'c7-c8', 'e8-c10', 'c8-d8', 'c10-a8', 'f1-e1', 'e10-d10', 'e2-b2', 'e9-d8', 'b2-b10', 'd10-d9', 'b10-b9', 'd9-d10', 'b9-b10', 'd10-d9', 'b10-b9', 'd9-d10'];
  bot.load({ f1: 'rK', a2: 'rR', c6: 'rP', e10: 'bK', d10: 'bA', f10: 'bA', c10: 'bE', g10: 'bE' }, 'r');
  line.forEach(mv => bot.make(bot.legalMoves().find(m => bot.moveStr(m) === mv)));
  const mv = bot.think('tough', bot.rand(1), 20000);
  bot.make(mv);
  check('search: the winning side avoids a third repetition', bot.outcome().status === 'play', bot.moveStr(mv));
}

// e. protocol through the worker's handler
{
  const two = ['h3-e3', 'h10-g8'], b = play(play(page.start(), two[0]), two[1]);
  const r = bot.reply({ id: 7, moves: two, level: 'tough', seed: 1 });
  check('protocol: normal reply', r.id === 7 && pageLegal(b, 'r', r.move) && r.status === 'play' && r.winner === null && r.check === page.exposed(play(b, r.move), 'b') && sameSet(r.legal, pageMoves(play(b, r.move), 'b')), r.move);
  const errs = [[['h3-e3', 'h3-e4'], 1], [['h10-g8'], 0], [['zz'], 0], [[42], 0]];
  check('protocol: illegal move error', errs.every(([moves, at]) => JSON.stringify(bot.reply({ id: 'x', moves })) === JSON.stringify({ id: 'x', error: 'illegal move', at })));
  check('protocol: missing move list is an error, not a throw', bot.reply({ id: 1 }).error === 'illegal move' && bot.reply(null).error === 'illegal move');
  const p = bot.reply({ id: 9, moves: ['h3-e3'], probe: true });
  check('protocol: probe returns status without moving', p.id === 9 && p.move === null && p.status === 'play' && !p.check && sameSet(p.legal, pageMoves(play(page.start(), 'h3-e3'), 'b')));
  const drawn = bot.reply({ id: 3, moves: ['h1-g3', 'h10-g8', 'g3-h1', 'g8-h10', 'h1-g3', 'h10-g8', 'g3-h1', 'g8-h10'], level: 'tough' });
  check('protocol: finished game replies with no move', drawn.move === null && drawn.status === 'draw');
  const opens = [1, 2, 3, 4, 5].flatMap(seed => ['gentle', 'tough'].map(level => bot.reply({ moves: [], level, seed }).move));
  check('protocol: Red opens with the Central Cannon', opens.every(m => m === 'h3-e3'), opens.join(' '));
  const DEVELOP = new Set(['h1-g3', 'b1-c3', 'i1-h1', 'a1-b1', 'c4-c5', 'g4-g5']), BLACK = ['h10-g8', 'i10-h10', 'b10-c8', 'g7-g6'];
  const lines = [1, 2, 3, 4, 5, 6, 7, 8].map(seed => {
    const moves = ['h3-e3'];
    for (const reply of BLACK.slice(0, 3)) {
      moves.push(reply);
      moves.push(bot.reply({ moves, level: seed % 2 ? 'gentle' : 'tough', seed }).move);
    }
    return moves.filter((_, i) => i % 2 === 0);
  });
  check('protocol: next Red book moves are developing moves', lines.every(l => l.slice(1).every(m => DEVELOP.has(m))), lines.map(l => l.join(' ')).join(' | '));
  const odd = [1n, 'abc', null, {}, NaN].map(seed => { try { return bot.reply({ moves: ['h3-e3', 'h10-g8'], level: 'gentle', seed }).move; } catch (e) { return e.message; } });
  check('protocol: an odd seed still gets a move', odd.every(m => pageLegal(b, 'r', m)), odd.join(' '));
  const t = Date.now(), slow = bot.reply({ moves: ['h3-e3', 'h10-g8', 'h1-g3', 'i10-h10', 'i1-h1', 'b10-c8', 'b1-c3'], level: 'tough', seed: 1, ms: 1e9 });
  check('protocol: a time budget in the message is ignored, tough answers within 2.5 s', slow.status === 'play' && Date.now() - t <= 2500, `${Date.now() - t} ms`);
}

// e2. the book never plays a move clearly worse than the best one: every Black first reply, then seeded random and best Black replies
{
  const BOOKED = new Set(bot.BOOK.flat()), rng = bot.rand(21), firsts = bot.reply({ moves: ['h3-e3'], probe: true }).legal, bad = [];
  let judged = 0;
  const judge = moves => {
    const r = bot.reply({ moves, level: judged % 2 ? 'tough' : 'gentle', seed: judged });
    if (r.status !== 'play' || !BOOKED.has(r.move)) return r;
    judged++;
    bot.reply({ moves, probe: true });
    fresh(bot);
    const best = bot.deepen(Infinity, 5);
    bot.make(bot.legalMoves().find(m => bot.moveStr(m) === r.move));
    fresh(bot);
    const got = -bot.deepen(Infinity, 4).score;
    if (got < best.score - 60) bad.push(`${moves.join(' ')}: ${r.move} ${got}, ${bot.moveStr(best.move)} ${best.score}`);
    return r;
  };
  for (const first of firsts) {
    const moves = ['h3-e3', first];
    for (let k = 0; k < 3; k++) {
      const r = judge(moves);
      if (r.status !== 'play') break;
      bot.reply({ moves: [...moves, r.move], probe: true });
      fresh(bot);
      const black = rng() < 0.5 ? bot.moveStr(bot.deepen(Infinity, 3).move) : r.legal[Math.floor(rng() * r.legal.length)];
      moves.push(r.move, black);
    }
    judge(moves);
  }
  check(`book: ${judged} book moves after odd Black replies stay within 60 of the best move at depth 5`, judged >= 100 && !bad.length, bad.slice(0, 3).join(' | '));
  const traps = [[['h3-e3', 'h10-i8', 'b1-c3', 'b8-f8'], 'h1-g3'], [['h3-e3', 'h8-h7', 'h1-g3', 'b8-b9', 'i1-h1', 'b9-a9'], 'b1-c3']];
  const fell = traps.flatMap(([moves, blunder]) => [1, 2, 3, 4, 5, 6].flatMap(seed => ['gentle', 'tough'].map(level => bot.reply({ moves, level, seed }).move)).filter(m => m === blunder));
  check('book: skips a book move that drops a piece or misses a free one', !fell.length, fell.join(' '));
}

// f + g. self-play: gentle against tough with alternating colours, then tough against itself with random first plies
const SELF_NODES = 50000, times = { gentle: [], tough: [] }, results = [];
const game = (red, black, seed, randomPlies) => {
  const moves = [];
  let b = page.start(), side = 'r', r;
  const seen = new Map([[keyOf(b, side), 1]]);
  do {
    const level = moves.length < randomPlies ? 'gentle' : side === 'r' ? red : black, t = Date.now();
    r = bot.reply({ moves, level, seed: seed * 1000 + moves.length }, SELF_NODES);
    times[level].push(Date.now() - t);
    if (!pageLegal(b, side, r.move)) return { moves, bad: `illegal ${r.move} at ply ${moves.length}` };
    b = play(b, r.move);
    if (r.check !== page.exposed(b, other(side))) return { moves, bad: `wrong check flag after ${r.move}` };
    moves.push(r.move);
    side = other(side);
    seen.set(keyOf(b, side), (seen.get(keyOf(b, side)) || 0) + 1);
  } while (r.status === 'play');
  // the ending must hold up on the page's engine too
  const stuck = !pageMoves(b, side).length, ok = r.status === 'draw' ? !stuck && (moves.length === 300 || seen.get(keyOf(b, side)) === 3) : stuck && r.winner === other(side);
  return { moves, status: r.status, winner: r.winner, bad: ok ? '' : `bad ending ${r.status}` };
};
const t0 = Date.now(), score = { win: 0, draw: 0, loss: 0 };
for (let g = 0; g < 60; g++) {
  const toughSide = g % 2 ? 'b' : 'r', r = game(toughSide === 'r' ? 'tough' : 'gentle', toughSide === 'b' ? 'tough' : 'gentle', g + 1, 0);
  results.push(r);
  score[r.winner === toughSide ? 'win' : r.winner ? 'loss' : 'draw']++;
}
const pair = { r: 0, b: 0, draw: 0 };
for (let g = 0; g < 20; g++) {
  const r = game('tough', 'tough', 100 + g, 4);
  results.push(r);
  pair[r.winner || 'draw']++;
}
const again = game('tough', 'tough', 100, 4);
check('self-play: a seeded tough game replays move for move', again.moves.join() === results[60].moves.join(), `${again.moves.length} and ${results[60].moves.length} plies`);
const bad = results.find(r => r.bad), longest = Math.max(...results.map(r => r.moves.length));
check('self-play: every move is legal on the page and every game ends in mate, stuck or draw', !bad, bad?.bad);
check('self-play: tough beats gentle in a clear majority of 60 games', score.win >= 40, `tough ${score.win} wins, ${score.draw} draws, ${score.loss} losses`);
console.log(`     tough vs tough: Red ${pair.r}, Black ${pair.b}, draws ${pair.draw}. Longest game ${longest} plies. ${((Date.now() - t0) / 1000).toFixed(0)} s`);
{
  const mate = results.find(r => r.status === 'mate'), r = mate && bot.reply({ id: 5, moves: mate.moves, level: 'tough' });
  check('protocol: a mated game replies with no move and the winner', r?.move === null && r.status === 'mate' && r.winner === mate.winner && r.check);
}

// g. timing, with tough at its real 1 s budget on middlegame positions from self-play
// depth is only asked of positions with a choice to make and no mate in sight
const depths = [];
for (const r of results.slice(0, 12)) {
  bot.reply({ moves: r.moves.slice(0, 30), probe: true });
  fresh(bot);
  const t = Date.now(), { depth, score } = bot.deepen(1000);
  toughTimes.push(Date.now() - t);
  if (bot.legalMoves().length > 1 && Math.abs(score) < bot.MATE - 100) depths.push(depth);
}
const stat = a => `avg ${(a.reduce((s, x) => s + x, 0) / a.length).toFixed(0)} ms, worst ${Math.max(...a)} ms over ${a.length} moves`;
check(`timing: gentle self-play ${stat(times.gentle)}`, Math.max(...times.gentle, ...gentleTimes) <= 300);
check(`timing: tough self-play at ${SELF_NODES} nodes ${stat(times.tough)}`, Math.max(...times.tough) <= 2500);
check(`timing: tough at 1 s budget ${stat(toughTimes)}, depth ${depths.join(' ')}`, Math.max(...toughTimes) <= 2500 && depths.length >= 8 && Math.min(...depths) >= 5);

console.log(failures ? `${failures} check(s) failed` : 'all checks pass');
process.exit(failures ? 1 : 0);
