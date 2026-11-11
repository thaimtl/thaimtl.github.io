// Xiangqi bot for the home page, run as a Web Worker. Post { id, moves, level, seed } for a reply move, or { id, moves, probe: true } for the status only.
// A square is rank * 9 + file, counted from Red's a1. Red pieces are positive, Black's negative.
const FILES = 'abcdefghi', TYPES = 'KAEHRCP', CAP = 300, MATE = 30000, INF = 32000, MAXPLY = 64, MARGIN = 25, BOOK_DEPTH = 5, BOOK_MARGIN = 30;
const K = 1, A = 2, E = 3, H = 4, R = 5, C = 6, P = 7;
const VALUE = [0, 0, 120, 120, 400, 900, 450, 30];

// Positional bonus by rank from the piece's own back rank, files a to e (f to i mirror them).
const PST = [null,
  [[0, 0, 0, 4, 10], [0, 0, 0, -8, -6], [0, 0, 0, -16, -14]],
  [[0, 0, 0, 0, 0], [0, 0, 0, 0, 6], [0, 0, 0, -2, 0]],
  [[0, 0, 0, 0, 0], [], [-4, 0, 0, 0, 6], [], [0, 0, -2, 0, 0]],
  [[-20, -12, -8, -8, -10], [-12, -4, 0, 4, -10], [-8, 0, 10, 6, 6], [-6, 4, 10, 12, 10], [-4, 6, 12, 14, 14],
    [-2, 10, 16, 18, 16], [0, 12, 20, 22, 18], [0, 14, 22, 24, 20], [-4, 10, 18, 24, 10], [-10, 0, 6, 4, -6]],
  [[-6, 4, 2, 6, 0], [0, 4, 4, 6, 0], [-2, 4, 4, 6, 4], [2, 6, 6, 8, 8], [4, 8, 8, 10, 10],
    [4, 10, 10, 12, 12], [6, 12, 12, 14, 14], [6, 14, 14, 16, 16], [6, 14, 16, 18, 20], [4, 8, 10, 12, 12]],
  [[0, 0, 2, 4, 4], [0, 2, 2, 2, 4], [2, 4, 6, 4, 10], [0, 2, 2, 4, 4], [0, 2, 4, 4, 6],
    [0, 2, 4, 4, 8], [0, 2, 2, 4, 10], [2, 2, 0, -4, 2], [4, 4, 0, -6, -6], [6, 6, 2, -4, -6]],
  [[], [], [], [0, 0, -2, 0, 4], [2, 0, 6, 0, 10],
    [20, 30, 40, 50, 55], [30, 45, 55, 65, 70], [35, 50, 65, 80, 90], [30, 45, 60, 75, 80], [0, 5, 10, 15, 20]]
];

const rand = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Per square: sliding rays, one-step targets, elephant [target, eye] and horse [target, leg] pairs.
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const RAYS = [], STEPS = [], ADV = [], ELE = [], HORSE = [], HORSE_ATK = [], PALACE = new Int8Array(90);
for (let s = 0; s < 90; s++) {
  const f = s % 9, r = (s / 9) | 0, ok = (df, dr) => f + df >= 0 && f + df < 9 && r + dr >= 0 && r + dr < 10, sq = (df, dr) => s + dr * 9 + df;
  if (f >= 3 && f <= 5) PALACE[s] = r <= 2 ? 1 : r >= 7 ? -1 : 0;
  RAYS[s] = ORTH.map(([df, dr]) => { const ray = []; for (let k = 1; ok(df * k, dr * k); k++) ray.push(sq(df * k, dr * k)); return ray; });
  STEPS[s] = ORTH.filter(d => ok(...d)).map(d => sq(...d));
  ADV[s] = DIAG.filter(d => ok(...d)).map(d => sq(...d));
  ELE[s] = DIAG.filter(([df, dr]) => ok(2 * df, 2 * dr)).map(([df, dr]) => [sq(2 * df, 2 * dr), sq(df, dr)]);
  HORSE[s] = [];
  HORSE_ATK[s] = [];
  for (const [df, dr] of ORTH) for (const k of [1, -1]) {
    const tf = 2 * df + k * dr, tr = 2 * dr + k * df;
    if (!ok(tf, tr)) continue;
    HORSE[s].push([sq(tf, tr), sq(df, dr)]);
    // a horse on that target comes back to s through the point diagonal to s
    HORSE_ATK[s].push([sq(tf, tr), sq(df + k * dr, dr + k * df)]);
  }
}

const PSQ = new Int16Array(15 * 90), Z1 = new Int32Array(15 * 90), Z2 = new Int32Array(15 * 90);
for (let t = 1; t <= 7; t++) for (let s = 0; s < 90; s++) {
  const f = s % 9, r = (s / 9) | 0, bonus = rank => PST[t][rank]?.[f < 5 ? f : 8 - f] ?? 0;
  PSQ[(7 + t) * 90 + s] = VALUE[t] + bonus(r);
  PSQ[(7 - t) * 90 + s] = -VALUE[t] - bonus(9 - r);
}
const key = rand(20240611);
for (let i = 0; i < Z1.length; i++) { Z1[i] = key() * 2 ** 32; Z2[i] = key() * 2 ** 32; }
const SIDE1 = key() * 2 ** 32 | 0, SIDE2 = key() * 2 ** 32 | 0;

const START = {};
[...'RHEAKAEHR'].forEach((t, f) => { START[FILES[f] + 1] = 'r' + t; START[FILES[f] + 10] = 'b' + t; });
for (const f of 'bh') { START[f + 3] = 'rC'; START[f + 8] = 'bC'; }
for (const f of 'acegi') { START[f + 4] = 'rP'; START[f + 7] = 'bP'; }

// Position state plus a stack per ply: hashes, score from Red's view, and the piece each move took.
const board = new Int8Array(90), kings = [0, 0], SIZE = CAP + MAXPLY + 2;
const H1 = new Int32Array(SIZE), H2 = new Int32Array(SIZE), SCORE = new Int32Array(SIZE), TAKEN = new Int8Array(SIZE);
let side = 1, n = 0;

const sqOf = s => (s.slice(1) - 1) * 9 + FILES.indexOf(s[0]);
const sqName = s => FILES[s % 9] + ((s / 9 | 0) + 1);
const moveStr = m => sqName(m & 127) + '-' + sqName(m >> 7);

function load(pieces, toMove) {
  board.fill(0);
  let h1 = 0, h2 = 0, sc = 0;
  for (const [s, v] of Object.entries(pieces)) {
    const at = sqOf(s), p = (TYPES.indexOf(v[1]) + 1) * (v[0] === 'r' ? 1 : -1), i = (p + 7) * 90 + at;
    board[at] = p;
    h1 ^= Z1[i];
    h2 ^= Z2[i];
    sc += PSQ[i];
    if (p === K || p === -K) kings[p > 0 ? 0 : 1] = at;
  }
  side = toMove === 'b' ? -1 : 1;
  n = 0;
  H1[0] = side > 0 ? h1 : h1 ^ SIDE1;
  H2[0] = side > 0 ? h2 : h2 ^ SIDE2;
  SCORE[0] = sc;
}

function make(m) {
  const from = m & 127, to = m >> 7, p = board[from], q = board[to], a = (p + 7) * 90, b = (q + 7) * 90;
  board[to] = p;
  board[from] = 0;
  if (p === K || p === -K) kings[p > 0 ? 0 : 1] = to;
  n++;
  TAKEN[n] = q;
  H1[n] = H1[n - 1] ^ Z1[a + from] ^ Z1[a + to] ^ (q && Z1[b + to]) ^ SIDE1;
  H2[n] = H2[n - 1] ^ Z2[a + from] ^ Z2[a + to] ^ (q && Z2[b + to]) ^ SIDE2;
  SCORE[n] = SCORE[n - 1] - PSQ[a + from] + PSQ[a + to] - (q && PSQ[b + to]);
  side = -side;
}

function unmake(m) {
  const from = m & 127, to = m >> 7, p = board[to];
  board[from] = p;
  board[to] = TAKEN[n];
  if (p === K || p === -K) kings[p > 0 ? 0 : 1] = from;
  n--;
  side = -side;
}

// Pseudo-legal moves into list, quiet moves only when asked. Returns the count.
function gen(list, quiet) {
  let c = 0;
  const add = (from, to) => { const q = board[to]; if (q * side <= 0 && (quiet || q)) list[c++] = from | to << 7; };
  for (let s = 0; s < 90; s++) {
    const p = board[s] * side;
    if (p <= 0) continue;
    if (p === K) { for (const t of STEPS[s]) if (PALACE[t] === side) add(s, t); }
    else if (p === A) { for (const t of ADV[s]) if (PALACE[t] === side) add(s, t); }
    else if (p === E) { for (const [t, eye] of ELE[s]) if (!board[eye] && t < 45 === side > 0) add(s, t); }
    else if (p === H) { for (const [t, leg] of HORSE[s]) if (!board[leg]) add(s, t); }
    else if (p === P) {
      const r = (s / 9) | 0, f = s % 9;
      if (side > 0 ? r < 9 : r > 0) add(s, s + 9 * side);
      if (side > 0 ? r > 4 : r < 5) { if (f > 0) add(s, s - 1); if (f < 8) add(s, s + 1); }
    } else for (const ray of RAYS[s]) {
      let i = 0;
      for (; i < ray.length && !board[ray[i]]; i++) if (quiet) list[c++] = s | ray[i] << 7;
      if (p === C) for (i++; i < ray.length && !board[ray[i]]; i++);
      if (i < ray.length) add(s, ray[i]);
    }
  }
  return c;
}

// Whether side `by` attacks square s, which holds the other side's general. Facing generals count as an attack.
function attacked(s, by) {
  for (const ray of RAYS[s]) {
    let i = 0;
    while (i < ray.length && !board[ray[i]]) i++;
    if (i === ray.length) continue;
    if (board[ray[i]] === by * R || board[ray[i]] === by * K) return true;
    for (i++; i < ray.length && !board[ray[i]]; i++);
    if (i < ray.length && board[ray[i]] === by * C) return true;
  }
  for (const [t, leg] of HORSE_ATK[s]) if (board[t] === by * H && !board[leg]) return true;
  const ahead = s - 9 * by, f = s % 9;
  if (ahead >= 0 && ahead < 90 && board[ahead] === by * P) return true;
  // a general stands on its own half, so a soldier beside it has crossed the river and may strike sideways
  return (f > 0 && board[s - 1] === by * P) || (f < 8 && board[s + 1] === by * P);
}

const inCheck = s => attacked(kings[s > 0 ? 0 : 1], -s);

const ROOT = new Int32Array(128);
function legalMoves() {
  const out = [];
  for (let i = 0, c = gen(ROOT, true); i < c; i++) {
    const m = ROOT[i];
    make(m);
    if (!inCheck(-side)) out.push(m);
    unmake(m);
  }
  return out;
}

// Earlier occurrences of this position with the same side to move, back to the last capture.
function repeats() {
  let c = 0;
  for (let i = n - 2; i >= 0 && !TAKEN[i + 1] && !TAKEN[i + 2]; i -= 2) if (H1[i] === H1[n] && H2[i] === H2[n]) c++;
  return c;
}

// No legal move loses, check or not. Perpetual check and perpetual chase are not ruled on: they end as repetition draws.
function outcome() {
  const legal = legalMoves(), check = inCheck(side);
  if (!legal.length) return { status: check ? 'mate' : 'stuck', winner: side > 0 ? 'b' : 'r', check, legal };
  if (repeats() >= 2 || n >= CAP) return { status: 'draw', winner: null, check, legal: [] };
  return { status: 'play', winner: null, check, legal };
}

const TT = 1 << 18, TTL = new Int32Array(TT), TTM = new Int32Array(TT), TTS = new Int16Array(TT), TTD = new Int8Array(TT), TTF = new Int8Array(TT);
const EXACT = 1, LOWER = 2, UPPER = 3;
const LISTS = [], KEYS = [], KILL = new Int32Array(2 * MAXPLY), HIST = new Int32Array(1 << 14);
for (let i = 0; i <= MAXPLY; i++) { LISTS.push(new Int32Array(128)); KEYS.push(new Int32Array(128)); }
// mate scores go into the table as distance from this node, not from the root
const toTT = (s, ply) => s > MATE - MAXPLY ? s + ply : s < MAXPLY - MATE ? s - ply : s;
const fromTT = (s, ply) => s > MATE - MAXPLY ? s - ply : s < MAXPLY - MATE ? s + ply : s;
let nodes = 0, maxNodes = Infinity, stopAt = 0, stopped = false;
const tick = () => { if ((++nodes & 1023) === 0 && (Date.now() > stopAt || nodes > maxNodes)) stopped = true; return stopped; };

// Hash move first, then captures by most valuable victim and cheapest attacker, then killers and history.
function order(list, keys, c, best, ply) {
  for (let i = 0; i < c; i++) {
    const m = list[i], q = board[m >> 7];
    keys[i] = m === best ? 1 << 30 : q ? (1 << 24) + VALUE[q < 0 ? -q : q] * 64 - VALUE[Math.abs(board[m & 127])]
      : m === KILL[2 * ply] ? 1 << 23 : m === KILL[2 * ply + 1] ? (1 << 23) - 1 : HIST[m];
  }
}
function pick(list, keys, i, c) {
  let j = i;
  for (let k = i + 1; k < c; k++) if (keys[k] > keys[j]) j = k;
  const m = list[j], v = keys[j];
  list[j] = list[i]; keys[j] = keys[i]; list[i] = m; keys[i] = v;
  return m;
}

function quiesce(alpha, beta, ply) {
  const stand = side * SCORE[n];
  if (tick() || stand >= beta || ply >= MAXPLY) return stand;
  if (stand > alpha) alpha = stand;
  const list = LISTS[ply], keys = KEYS[ply], c = gen(list, false);
  order(list, keys, c, 0, ply);
  for (let i = 0; i < c; i++) {
    const m = pick(list, keys, i, c);
    make(m);
    if (inCheck(-side)) { unmake(m); continue; }
    const s = -quiesce(-beta, -alpha, ply + 1);
    unmake(m);
    if (s > alpha) { alpha = s; if (s >= beta) break; }
  }
  return alpha;
}

// Quiescence stands pat, so the horizon checks for a side with no legal move, which loses even out of check.
function anyLegal(ply) {
  const list = LISTS[ply];
  for (let i = 0, c = gen(list, true); i < c; i++) {
    make(list[i]);
    const ok = !inCheck(-side);
    unmake(list[i]);
    if (ok) return true;
  }
  return false;
}

function search(depth, alpha, beta, ply) {
  if (ply && (n >= CAP || repeats())) return 0;
  if (inCheck(side)) depth++;
  if (depth <= 0) return anyLegal(ply) ? quiesce(alpha, beta, ply) : ply - MATE;
  if (tick() || ply >= MAXPLY) return side * SCORE[n];
  const slot = H1[n] & (TT - 1), hit = TTF[slot] && TTL[slot] === H2[n];
  if (hit && ply && TTD[slot] >= depth) {
    const s = fromTT(TTS[slot], ply), f = TTF[slot];
    if (f === EXACT || (f === LOWER ? s >= beta : s <= alpha)) return s;
  }
  const list = LISTS[ply], keys = KEYS[ply], c = gen(list, true), alpha0 = alpha;
  order(list, keys, c, hit ? TTM[slot] : 0, ply);
  let best = -INF, bestMove = 0, legal = 0;
  for (let i = 0; i < c; i++) {
    const m = pick(list, keys, i, c);
    make(m);
    if (inCheck(-side)) { unmake(m); continue; }
    let s;
    if (legal++ === 0) s = -search(depth - 1, -beta, -alpha, ply + 1);
    else {
      s = -search(depth - 1, -alpha - 1, -alpha, ply + 1);
      if (s > alpha && s < beta) s = -search(depth - 1, -beta, -alpha, ply + 1);
    }
    unmake(m);
    if (stopped) return 0;
    if (s > best) { best = s; bestMove = m; }
    if (s > alpha) alpha = s;
    if (alpha >= beta) {
      if (!board[m >> 7]) {
        if (KILL[2 * ply] !== m) { KILL[2 * ply + 1] = KILL[2 * ply]; KILL[2 * ply] = m; }
        if ((HIST[m] += depth * depth) > 1 << 20) for (let k = 0; k < HIST.length; k++) HIST[k] >>= 1;
      }
      break;
    }
  }
  if (!legal) return ply - MATE;
  TTL[slot] = H2[n];
  TTM[slot] = bestMove;
  TTS[slot] = toTT(best, ply);
  TTD[slot] = depth;
  TTF[slot] = best >= beta ? LOWER : best > alpha0 ? EXACT : UPPER;
  return best;
}

// Iterative deepening from the root until the time or node budget or maxDepth runs out. Returns the best move, its score and the depth searched.
function deepen(ms, maxDepth = MAXPLY - 1, nodeBudget = Infinity) {
  const t0 = Date.now();
  stopAt = t0 + ms;
  maxNodes = nodeBudget;
  nodes = 0;
  stopped = false;
  let root = legalMoves(), move = root[0], score = -MATE, depth = 0;
  if (!root.length) return { move: 0, score, depth };
  for (let d = 1; d <= maxDepth; d++) {
    let alpha = -INF, found = 0;
    for (const m of root) {
      make(m);
      let s = found ? -search(d - 1, -alpha - 1, -alpha, 1) : -search(d - 1, -INF, INF, 1);
      if (found && s > alpha) s = -search(d - 1, -INF, -alpha, 1);
      unmake(m);
      if (stopped) break;
      if (s > alpha) { alpha = s; found = m; }
    }
    if (found) { move = found; score = alpha; root = [found, ...root.filter(m => m !== found)]; }
    if (stopped) break;
    depth = d;
    if (score > MATE - MAXPLY || root.length === 1 || Date.now() - t0 > ms / 2 || nodes > nodeBudget / 2) break;
  }
  return { move, score, depth };
}

// Two plies plus captures, then a random pick among the moves within MARGIN of the best, captures first so it never skips a free piece.
function gentle(rng) {
  stopAt = maxNodes = Infinity;
  stopped = false;
  const root = legalMoves(), scores = [];
  let best = -INF;
  for (const m of root) {
    make(m);
    const s = -search(1, -INF, MARGIN - best, 1);
    unmake(m);
    scores.push(s);
    if (s > best) best = s;
  }
  const near = root.filter((m, i) => scores[i] > best - MARGIN), takes = near.filter(m => board[m >> 7]);
  const pool = takes.length ? takes : near;
  return pool[Math.floor(rng() * pool.length)];
}

// Red's first moves from Central Cannon openings. A book move must be legal and score close to the best move at equal depth.
const BOOK = [
  ['h3-e3', 'h1-g3', 'i1-h1', 'b1-c3'],
  ['h3-e3', 'h1-g3', 'i1-h1', 'c4-c5'],
  ['h3-e3', 'h1-g3', 'g4-g5', 'i1-h1'],
  ['h3-e3', 'b1-c3', 'h1-g3', 'i1-h1']
];
function book(moves, rng) {
  if (side < 0 || moves.length >= 2 * BOOK[0].length) return 0;
  const k = moves.length / 2, mine = moves.filter((_, i) => i % 2 === 0).join();
  const options = [...new Set(BOOK.filter(l => l.slice(0, k).join() === mine).map(l => l[k]))], legal = legalMoves();
  let base;
  while (options.length) {
    const [want] = options.splice(Math.floor(rng() * options.length), 1), m = legal.find(x => moveStr(x) === want);
    if (!m) continue;
    base ??= deepen(Infinity, BOOK_DEPTH).score;
    make(m);
    const ok = -deepen(Infinity, BOOK_DEPTH - 1).score >= base - BOOK_MARGIN;
    unmake(m);
    if (ok) return m;
  }
  return 0;
}

// Tough searches for 1 s, or for a fixed node count when one is given, which tests use to replay games exactly.
function think(level, rng, nodeBudget, moves) {
  TTF.fill(0);
  KILL.fill(0);
  HIST.fill(0);
  return (moves && book(moves, rng)) || (level === 'tough' ? deepen(nodeBudget ? Infinity : 1000, MAXPLY - 1, nodeBudget).move : gentle(rng));
}

function reply(msg, nodeBudget) {
  const { id, moves, level, seed, probe } = msg || {};
  if (!Array.isArray(moves)) return { id, error: 'illegal move', at: 0 };
  load(START, 'r');
  for (let i = 0; i < moves.length; i++) {
    const o = outcome(), m = o.status === 'play' && o.legal.find(x => moveStr(x) === moves[i]);
    if (!m) return { id, error: 'illegal move', at: i };
    make(m);
  }
  let o = outcome(), move = null;
  if (!probe && o.status === 'play') {
    const m = think(level, rand(Number.isFinite(Number(seed)) ? Number(seed) : Date.now()), nodeBudget, moves);
    make(m);
    move = moveStr(m);
    o = outcome();
  }
  return { id, move, status: o.status, winner: o.winner, check: o.check, legal: o.legal.map(moveStr) };
}

if (typeof importScripts === 'function') onmessage = e => postMessage(reply(e.data));
