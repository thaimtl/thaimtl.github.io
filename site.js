{
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onIn = (el, fn) => {
    if (!el) return;
    if (reduce) return fn();
    const min = Math.min(.25, .25 * innerHeight / (el.getBoundingClientRect().height || 1));
    new IntersectionObserver((es, io) => {
      if (es.some(e => e.isIntersecting && e.intersectionRatio >= min - .01)) { io.disconnect(); fn(); }
    }, { threshold: min }).observe(el);
  };
  window.site = { reduce, onIn };

  // a stone drops into its socket just before the socket reaches the screen, and is simply set if the socket is already on screen
  if (!reduce) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const y = e.target.parentNode.getBoundingClientRect().bottom;
      e.target.parentNode.classList.add('in', ...(y > innerHeight || y < 0 ? ['drop'] : []));
      io.unobserve(e.target);
    }), { rootMargin: '64px 0px' });
    document.querySelectorAll('.seal').forEach(s => io.observe(s));
  }

  if (!reduce) for (const el of document.querySelectorAll('[data-count]')) {
    const text = el.textContent, m = text.match(/\d[\d,]*/);
    if (!m) continue;
    const end = +m[0].replace(/,/g, ''), fmt = n => m[0].includes(',') ? n.toLocaleString('en-US') : n;
    el.textContent = text.replace(m[0], 0);
    onIn(el, () => {
      let t0;
      const step = t => {
        const k = Math.min(1, (t - (t0 ??= t)) / 800);
        el.textContent = text.replace(m[0], fmt(Math.round(end * (1 - (1 - k) ** 3))));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
}

{
  /*rules*/
  const FILES = 'abcdefghi';
  const sq = s => [FILES.indexOf(s[0]), +s.slice(1)];
  const at = (x, r) => FILES[x] + r;
  const start = () => {
    const b = new Map();
    [...'RHEAKAEHR'].forEach((t, x) => { b.set(at(x, 1), { side: 'r', t }); b.set(at(x, 10), { side: 'b', t }); });
    for (const x of [1, 7]) { b.set(at(x, 3), { side: 'r', t: 'C' }); b.set(at(x, 8), { side: 'b', t: 'C' }); }
    for (const x of [0, 2, 4, 6, 8]) { b.set(at(x, 4), { side: 'r', t: 'P' }); b.set(at(x, 7), { side: 'b', t: 'P' }); }
    return b;
  };
  const palace = (side, x, r) => x > 2 && x < 6 && (side === 'r' ? r < 4 : r > 7);
  const home = (side, r) => (side === 'r' ? r < 6 : r > 5);
  const between = (b, [x1, r1], [x2, r2]) => {
    let n = 0;
    if (x1 === x2) for (let r = Math.min(r1, r2) + 1; r < Math.max(r1, r2); r++) n += b.has(at(x1, r));
    else for (let x = Math.min(x1, x2) + 1; x < Math.max(x1, x2); x++) n += b.has(at(x, r1));
    return n;
  };
  // whether the piece on `from` can reach `to` by its own rule, before asking about its general
  const reach = (b, from, to) => {
    const p = b.get(from), q = b.get(to);
    if (!p || q?.side === p.side) return false;
    const [x1, r1] = sq(from), [x2, r2] = sq(to), dx = x2 - x1, dr = r2 - r1, ax = Math.abs(dx), ar = Math.abs(dr), line = !ax !== !ar;
    switch (p.t) {
      case 'K': return ax + ar === 1 && palace(p.side, x2, r2);
      case 'A': return ax === 1 && ar === 1 && palace(p.side, x2, r2);
      case 'E': return ax === 2 && ar === 2 && home(p.side, r2) && !b.has(at(x1 + dx / 2, r1 + dr / 2));
      case 'H': return ax * ar === 2 && !b.has(ar === 2 ? at(x1, r1 + dr / 2) : at(x1 + dx / 2, r1));
      case 'R': return line && !between(b, [x1, r1], [x2, r2]);
      case 'C': return line && between(b, [x1, r1], [x2, r2]) === (q ? 1 : 0);
      case 'P': return (!ax && dr === (p.side === 'r' ? 1 : -1)) || (ax === 1 && !ar && !home(p.side, r1));
    }
    return false;
  };
  // a side is exposed when its general is missing, attacked, or faces the other general on an open file
  const exposed = (b, side) => {
    const general = s => [...b].find(([, p]) => p.side === s && p.t === 'K')?.[0];
    const mine = general(side), theirs = general(side === 'r' ? 'b' : 'r');
    if (!mine) return true;
    if (theirs && sq(mine)[0] === sq(theirs)[0] && !between(b, sq(mine), sq(theirs))) return true;
    return [...b].some(([s, p]) => p.side !== side && reach(b, s, mine));
  };
  const legal = (b, from, to) => {
    if (!reach(b, from, to)) return false;
    const next = new Map(b);
    next.set(to, next.get(from));
    next.delete(from);
    return !exposed(next, b.get(from).side);
  };
  const moves = (b, from) => [...Array(90)].map((_, i) => at(i % 9, 1 + Math.floor(i / 9))).filter(to => legal(b, from, to));
  /*rules end*/

  // Central Cannon with Cross-River Chariot against Screen Horses: [beat, Red's move, Black's reply, what Red's move does]
  const GAME = /*game*/[
    ["1", "h3-e3", "h10-g8", "Puts the cannon on the center line, aiming at Black’s central soldier."],
    ["2", "h1-g3", "i10-h10", "Develops a horse to guard the soldier in front of the cannon."],
    ["3", "i1-h1", "g7-g6", "Brings the corner chariot onto an open line, ready to advance."],
    ["4", "h1-h7", "b10-c8", "Pushes the chariot across the river to press Black’s side early."],
    ["5", "c4-c5", "h8-i8", "Advances a soldier, which also opens space for Red’s other horse."],
    ["6", "h7-g7", "i8-i9", "Slides the chariot sideways to attack a horse and avoid a chariot trade."],
    ["7", "b1-c3", "d10-e9", "Develops the second horse toward the center of the board."],
    ["end", "c3-d5", null, "Eight moves in, and it’s Black’s turn. What would you play?"]
  ]/*end*/;

  const NAME = { K: 'General', A: 'Advisor', E: 'Elephant', H: 'Horse', R: 'Chariot', C: 'Cannon', P: 'Soldier' };
  const RULE = {
    K: 'Moves one point up, down, left or right and never leaves the palace.',
    A: 'Moves one point along the palace diagonals and never leaves the palace.',
    E: 'Moves exactly two points diagonally, can’t cross the river, and is blocked by a piece in between.',
    H: 'Moves one point straight, then one diagonally outward, and is blocked by a piece on the point it steps through.',
    R: 'Moves any distance in a straight line, with nothing in the way.',
    C: 'Moves like a chariot, and captures only by jumping exactly one piece.',
    P: 'Moves one point forward, and after crossing the river it can also step sideways, never back.'
  };
  const GLYPH = { K: ['shuai', 'jiang'], A: ['shi', 'shi-b'], E: ['xiang', 'xiang-b'], H: ['ma', 'ma-b'], R: ['ju', 'ju-b'], C: ['pao', 'pao-b'], P: ['bing', 'zu'] };
  const glyph = (t, side) => 'g-' + GLYPH[t][side === 'r' ? 0 : 1];
  const disc = (t, side) => `<svg class="disc pc${side === 'r' ? ' pc--red' : ''}" viewBox="-50 -50 100 106" aria-hidden="true"><circle class="disc-wall" cy="5" r="46"/><circle class="pc-body" r="46"/><circle class="pc-ring" r="38"/><use href="#${glyph(t, side)}" x="-29" y="-29" width="58" height="58"/></svg>`;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Mini boards. Points are "col row" digit pairs, row 0 at the top. Each leg is a walk out and back ("21>10" passes 21 on its way to 10).
  // dots: legal points that are not leg ends, block: other pieces, x: points a blocker cuts off, take: the enemy the cannon jumps to, palace: its top left point.
  const MINI = {
    K: { g: '33', at: '11', palace: '00', legs: '10 21 12 01' },
    A: { g: '33', at: '11', palace: '00', legs: '00 20 22 02' },
    E: { g: '55', at: '22', river: -1, palace: '12', legs: '00 40 04', block: '33', x: '44' },
    H: { g: '55', at: '22', legs: '21>10 21>30 23>34 23>14 12>03 12>01', block: '32', x: '41 43' },
    R: { g: '55', at: '22', legs: '20 42 24 02', dots: '21 32 23 12' },
    C: { g: '55', at: '24', legs: '04 44 23 20', dots: '14 34', block: '22', take: '20' },
    P: { g: '55', at: '24', river: 2, legs: '23 23>22 23>22>12 23>22>32' }
  };
  // Drawn with Red at the bottom. flip turns it to match the stage, where Red sits on the far side.
  const mini = (t, side, flip) => {
    const m = MINI[t], w = (m.g[0] - 1) * 100, h = (m.g[1] - 1) * 100, top = m.river === -1 ? -100 : 0, foe = side === 'r' ? 'b' : 'r';
    const pts = s => (s ? s.split(' ').map(p => [p[0] * 100, p[1] * 100]) : []);
    const from = pts(m.at)[0], legs = m.legs.split(' ').map(l => pts(l.replace(/>/g, ' '))), take = pts(m.take)[0];
    const lines = [];
    for (let y = top; y <= h; y += 100) lines.push(`M0 ${y}H${w}`);
    for (let x = 0; x <= w; x += 100) lines.push(m.river > 0 ? `M${x} 0V${m.river * 100}M${x} ${m.river * 100 + 100}V${h}` : `M${x} 0V${h}`);
    if (m.palace) lines.push(`M${m.palace[0]}00 ${m.palace[1]}00l200 200m0-200l-200 200`);
    const stone = ([x, y], s, g, cls = '') => `<g class="pc${s === 'r' ? ' pc--red' : ''}${cls}" style="transform:translate(${x}px,${y}px)"><g${flip ? ' transform="rotate(180)"' : ''}><circle class="disc-wall" cy="6" r="40"/><circle class="pc-body" r="40"/><circle class="pc-ring" r="33"/><use href="#${g}" x="-26" y="-26" width="52" height="52"/></g></g>`;
    const path = l => `M${from}L${l.join('L')}`;
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('class', 'mini');
    el.setAttribute('viewBox', `-70 ${top - 70} ${w + 140} ${h - top + 140}`);
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', RULE[t]);
    el.style.backgroundImage = 'url(img/scene-board.png)';
    el.innerHTML = (flip ? `<g transform="rotate(180 ${w / 2} ${(top + h) / 2})">` : '<g>') + `<path class="m-line" d="${lines.join('')}"/>`
      + legs.map(l => `<path class="m-trail" d="${path(l)}"/>`).join('')
      + legs.map(l => l.at(-1)).concat(pts(m.dots)).map(([x, y]) => take && x === take[0] && y === take[1] ? '' : `<circle class="m-dot" cx="${x}" cy="${y}" r="13"/>`).join('')
      + pts(m.x).map(([x, y]) => `<path class="m-x" d="M${x - 14} ${y - 14}l28 28m0-28l-28 28"/>`).join('')
      + pts(m.block).map(p => stone(p, foe, 'g-' + GLYPH.P[foe === 'r' ? 0 : 1])).join('')
      + (take ? stone(take, foe, 'g-' + GLYPH.R[foe === 'r' ? 0 : 1], ' m-taken') + `<circle class="m-take" cx="${take[0]}" cy="${take[1]}" r="48"/>` : '')
      + stone(from, side, glyph(t, side), ' m-piece') + '</g>';
    if (reduce) return { el, anims: [] };
    // one leg every 1.2s: out in the first third, rest, back in the last third
    const n = legs.length, leg = 1 / n, key = (offset, [x, y], s = 1) => ({ offset, easing: 'ease-in-out', transform: `translate(${x}px,${y}px) scale(${s})` });
    const kf = [], fade = [], gone = [{ offset: 0, opacity: 1 }];
    legs.forEach((l, i) => {
      const o = i * leg, step = leg / 3 / l.length, end = l.at(-1), jump = take && end[0] === take[0] && end[1] === take[1];
      kf.push(key(o, from));
      if (jump) kf.push(key(o + step / 2, [(from[0] + end[0]) / 2, (from[1] + end[1]) / 2], 1.3));
      l.forEach((p, j) => kf.push(key(o + step * (j + 1), p)));
      kf.push(key(o + leg * 2 / 3, end));
      [...l.slice(0, -1).reverse(), from].forEach((p, j) => kf.push(key(o + leg * 2 / 3 + step * (j + 1), p)));
      fade.push([{ offset: 0, opacity: 0 }, { offset: o, opacity: 0 }, { offset: o, opacity: 1 }, { offset: o + leg, opacity: 1 }, { offset: o + leg, opacity: 0 }, { offset: 1, opacity: 0 }]);
      if (jump) gone.push({ offset: o + leg / 3, opacity: 1 }, { offset: o + leg / 3, opacity: 0 }, { offset: o + leg * 2 / 3, opacity: 0 }, { offset: o + leg * 2 / 3, opacity: 1 });
    });
    gone.push({ offset: 1, opacity: 1 });
    // offsets are sums of fractions, so round-off can step back a hair
    let last;
    const run = (node, frames) => (last = 0, node.animate(frames.map(f => ({ ...f, offset: (last = Math.min(1, Math.max(last, f.offset))) })), { duration: 1200 * n, iterations: Infinity }));
    const anims = [run(el.querySelector('.m-piece'), kf), ...[...el.querySelectorAll('.m-trail')].map((p, i) => run(p, fade[i]))];
    if (take) anims.push(run(el.querySelector('.m-taken'), gone));
    return { el, anims };
  };

  const stage = document.querySelector('.stage');
  if (stage) {
    const dots = stage.querySelector('.dots'), page = document.querySelector('.page'), hero = document.querySelector('.hero');
    const START = start(), OPEN = new Map([...START.keys()].map(s => [s, s]));
    const els = new Map([...stage.querySelectorAll('.p')].map(el => [el.dataset.sq, el]));
    // board point of a square: file a is on the camera's right, rank 1 is the far rank
    const xy = s => { const [f, r] = sq(s); return [8 - f, r - 1]; };
    const board = pos => new Map([...pos].map(([s, id]) => [s, START.get(id)]));
    // a position maps square -> piece id (its starting square). half[i] is after Red's move of row i, full[i] after Black's reply.
    const half = [], full = [], mover = [];
    let pos = OPEN;
    const step = (p, mv) => { const [a, b] = mv.split('-'), n = new Map(p); n.set(b, n.get(a)); n.delete(a); return n; };
    const play = mv => { const id = pos.get(mv.split('-')[0]); pos = step(pos, mv); return id; };
    for (const [, red, black] of GAME) { mover.push(play(red)); half.push(pos); if (black) play(black); full.push(pos); }
    const beats = [...document.querySelectorAll('main .beat[data-beat]')].map(b => [b, GAME.findIndex(g => g[0] === b.dataset.beat)]).filter(([, i]) => i >= 0);

    const show = (next, hop) => {
      const where = new Map([...next].map(([s, id]) => [id, s]));
      stage.classList.toggle('jump', !hop);
      for (const [id, el] of els) {
        const s = where.get(id);
        el.style.zIndex = '';
        el.classList.toggle('gone', !s);
        if (!s || s === (el.dataset.at || id)) continue;
        // a piece in flight passes over the others
        el.style.zIndex = 1;
        el.dataset.at = s;
        const [x, y] = xy(s);
        el.style.setProperty('--x', x);
        el.style.setProperty('--y', y);
        if (hop) el.dataset.hop = el.dataset.hop === 'a' ? 'b' : 'a';
      }
    };
    // dots on every legal point of the piece on s, each with a dotted trail along the way it moves
    const trail = (p, s) => {
      const b = board(p), [x0, y0] = xy(s), horse = b.get(s).t === 'H';
      return moves(b, s).map(to => {
        const [x, y] = xy(to), via = !horse ? '' : Math.abs(x - x0) === 2 ? `L${(x + x0) * 50} ${y0 * 100}` : `L${x0 * 100} ${(y + y0) * 50}`;
        return `<path d="M${x0 * 100} ${y0 * 100}${via}L${x * 100} ${y * 100}"/>` + (b.has(to) ? '' : `<circle cx="${x * 100}" cy="${y * 100}" r="13"/>`);
      }).join('');
    };
    // a piece that the one on s can take wears a ring on its own stone
    const prey = (p, s) => {
      const b = s && board(p), hit = new Set(s ? moves(b, s).filter(to => b.has(to)).map(to => p.get(to)) : []);
      for (const [id, el] of els) el.classList.toggle('prey', hit.has(id));
    };
    const mark = (p, s) => { dots.innerHTML = s ? trail(p, s) : ''; prey(p, s); };
    // every stone drops onto the board again, as on page load
    let landed = 0;
    const drop = () => {
      if (reduce) return;
      clearTimeout(landed);
      // a stone that has hopped would keep its hop animation and sit the landing out
      for (const el of els.values()) delete el.dataset.hop;
      stage.classList.remove('setup');
      stage.offsetWidth;
      stage.classList.add('setup');
      landed = setTimeout(() => stage.classList.remove('setup'), 1400);
    };

    const note = document.createElement('div');
    stage.append(note);
    let anims = [];
    const say = (t, side, title, text) => {
      anims.forEach(a => a.cancel());
      anims = [];
      note.className = t ? 'beat-note' : 'beat-note beat-note--bare';
      note.innerHTML = t ? `<div><h3>${disc(t, side)}${title}</h3>${text ? `<p>${text}</p>` : ''}</div>` : '';
      if (t) { const m = mini(t, side, side === 'r'); note.prepend(m.el); anims = m.anims; }
      if (note.hidden) anims.forEach(a => a.pause());
    };
    // between beats the note is empty and hidden. The hover hint sits in the intro card, for visitors with a mouse.
    const invite = () => say();
    document.querySelector('.intro .note')?.insertAdjacentHTML('beforeend', '<span class="hover"> Hover a piece to see where it can go.</span>');

    // beat shots: both moves and every dot as large as fits above the note, with the whole board in the frame
    const T = Math.PI / 4, K = 22, BOARD = [[-.62, -.62, .56], [8.62, -.62, .56], [-.62, 9.62, 0], [8.62, 9.62, 0]];
    const project = (f, x, y, z, t = T, k = K) => { const q = k / (k - (y - f[1]) * Math.sin(t) - z * Math.cos(t)); return [(x - f[0]) * q, ((y - f[1]) * Math.cos(t) - z * Math.sin(t)) * q]; };
    // fits the whole board into the frame fr and points the camera there. Returns the pixels per cell and where the focus lands.
    const aim = (f, fr, fit, t = T, k = K) => {
      const s = box(BOARD.map(p => project(f, ...p, t, k))), st = stage.style;
      const c = Math.min(...[0, 1].flatMap(j => [fit, s].filter(Boolean).map(r => span(fr[j]) / span(r[j]))));
      const [tx, ty] = [0, 1].map(j => (fr[j][0] + fr[j][1] - c * (s[j][0] + s[j][1])) / 2);
      st.setProperty('--tx', tx + 'px');
      st.setProperty('--ty', ty + 'px');
      st.setProperty('--fx', f[0]);
      st.setProperty('--fy', f[1]);
      st.setProperty('--T', t + 'rad');
      st.setProperty('--K', k);
      st.setProperty('--k', c / b0);
      return { f, c, tx, ty };
    };
    const box = ps => [0, 1].map(j => [Math.min(...ps.map(p => p[j])), Math.max(...ps.map(p => p[j]))]);
    const span = ([a, b]) => b - a;
    let cur = -2, wide, b0;
    const shot = () => {
      const st = stage.style, i = cur < 0 ? -1 : beats[cur][1];
      if (i < 0) return ['--tx', '--ty', '--fx', '--fy', '--T', '--K', '--k'].forEach(v => st.removeProperty(v));
      const [, red, black] = GAME[i], to = red.split('-')[1];
      const pts = [red, black].filter(Boolean).flatMap(m => m.split('-')).concat(moves(board(half[i]), to), moves(board(full[i]), to)).map(xy);
      const f = box(pts).map(r => (r[0] + r[1]) / 2);
      // at 1100px up the board fills the match zone, seen from half a cell right of center so the clementines stay on screen
      if (wide) f[0] = 4.5;
      const g = box(pts.flatMap(([x, y]) => [[-.6, -.6], [.6, -.6], [-.6, .6], [.6, .6]].map(([u, v]) => project(f, x + u, y + v, .56))));
      aim(f, wide ? [[24, page.getBoundingClientRect().left - 24], [24, innerHeight - note.offsetHeight - 48]] : [[12, innerWidth - 12], [innerHeight * .15, innerHeight - note.offsetHeight - 24]], g);
    };

    let timers = [];
    const go = k => {
      timers.forEach(clearTimeout);
      timers = [];
      const step = !reduce && cur > -2 && k === cur + 1, i = k < 0 ? -1 : beats[k][1];
      cur = k;
      opener.hidden = k >= 0;
      stage.classList.toggle('zoom', k >= 0);
      if (i < 0) { show(OPEN); mark(); invite(); return shot(); }
      const [beat, red, black, text] = GAME[i], to = red.split('-')[1], t = START.get(mover[i]).t;
      say(t, 'r', beat === 'end' ? 'Your move' : NAME[t], text);
      shot();
      if (!step) { show(full[i]); return mark(full[i], to); }
      show(i ? full[i - 1] : OPEN);
      mark();
      timers.push(setTimeout(show, 500, half[i], true), setTimeout(mark, 1100, half[i], to));
      if (black) timers.push(setTimeout(show, 1800, full[i], true), setTimeout(mark, 2400, full[i], to));
    };

    // the narrow note docks to the bottom of the visible gap and hides when a card would sit under it
    const dock = () => {
      let off = 0, open = true;
      if (!wide) {
        const r = (cur < 0 ? hero : beats[cur][0])?.getBoundingClientRect(), bottom = Math.min(innerHeight, r ? r.bottom : 0) - 12;
        open = !!r && bottom - note.offsetHeight >= Math.max(0, r.top) + 12;
        off = bottom - innerHeight + 12;
      }
      note.style.transform = off ? `translateY(${off}px)` : '';
      if (note.hidden !== !open) { note.hidden = !open; anims.forEach(a => (open ? a.play() : a.pause())); }
    };

    // Play mode, 768px and wider: the visitor takes Black against bot.js in a top-down shot that holds still. The story's note, hover and scroll stand down until they leave.
    const opener = document.createElement('button'), bar = document.createElement('div');
    opener.type = 'button';
    opener.className = 'btn play-start';
    opener.textContent = 'Play my grandfather';
    hero?.append(opener);
    bar.className = 'beat-note play-bar';
    bar.hidden = true;
    bar.innerHTML = '<div class="vh" tabindex="0" role="application" aria-label="Board. Arrow keys move, Enter picks up or places a piece, Escape puts it back."></div><div class="play-status" aria-live="polite"></div><p class="vh" aria-live="polite"></p>'
      + '<div class="play-tools"><button type="button" class="btn btn--quiet" data-do="undo">Undo</button><button type="button" class="btn btn--quiet" data-do="begin">Restart</button><button type="button" class="btn btn--quiet" data-do="swap"></button><button type="button" class="btn btn--quiet" data-do="leave">Back to the story</button></div>';
    stage.after(bar);
    const [pad, status, heard] = bar.children, tools = bar.lastChild.children;
    const PT = Math.PI / 9, PK = 30, root = document.documentElement, low = t => NAME[t].toLowerCase();
    let game = null, bot = null, asked = 0, level = 'gentle', cam, barH = 0, back = 0;
    // frames the board between the screen edges (or the page, at 1100px up) and the bar. snap skips the camera's glide, so clicks never land on a board still in motion.
    const lay = snap => {
      if (snap) stage.style.transition = 'none';
      const right = wide ? page.getBoundingClientRect().left : innerWidth;
      barH = bar.offsetHeight;
      cam = aim([4, 4.5], [[24, right - 24], [24, bar.getBoundingClientRect().top - 24]], null, PT, PK);
      // his plate, his cup and the pot stay only where they fit whole beside the board
      const side = (x, y) => cam.tx + cam.c * project(cam.f, x, y, 0, PT, PK)[0];
      stage.classList.toggle('bare', wide || side(11.1, 4.5) > innerWidth || side(-3.3, .9) < 0);
      if (snap) { stage.offsetWidth; stage.style.transition = ''; }
    };
    new ResizeObserver(() => game && bar.offsetHeight !== barH && lay(true)).observe(bar);
    // the square whose point is nearest the pointer, within half a cell
    const pick = (px, py) => {
      let best = null, d = cam.c / 2;
      for (let i = 0; i < 90; i++) {
        const x = i % 9, y = (i - x) / 9, [u, v] = project(cam.f, x, y, .3, PT, PK), e = Math.hypot(px - cam.tx - cam.c * u, py - cam.ty - cam.c * v);
        if (e < d) { d = e; best = at(8 - x, y + 1); }
      }
      return best;
    };
    const tell = (title, text) => { game.title = title; status.innerHTML = `<strong>${title}</strong><p>${text}</p>`; };
    const said = (b, [from, to], mine) => {
      const p = low(b.get(from).t), q = b.get(to), where = `<span class="vh"> from ${from} to ${to}</span>`;
      return q ? `${mine ? 'Your' : 'His'} ${p} took ${mine ? 'his' : 'your'} ${low(q.t)}${where}.` : `${mine ? 'You moved your' : 'He moved his'} ${p}${where}.`;
    };
    const ring = (s, cls, r) => { const [x, y] = xy(s); return `<circle class="${cls}" cx="${x * 100}" cy="${y * 100}" r="${r}"/>`; };
    // marks for the last move, the piece in hand and what it can do, and the keyboard's cursor
    const paint = () => {
      const g = game;
      dots.innerHTML = (g.last ? ring(g.last[0], 'was', 22) : '') + (g.sel ? trail(g.pos, g.sel) : '') + (g.keys && document.activeElement === pad ? ring(g.cur, 'cur', 58) : '');
      prey(g.pos, g.sel);
      const where = new Map([...g.pos].map(([s, id]) => [id, s]));
      for (const [id, el] of els) { const s = where.get(id); el.classList.toggle('sel', !!s && s === g.sel); el.classList.toggle('last', !!s && s === g.last?.[1]); }
      tools[0].disabled = g.moves.length < 2;
    };
    const label = () => { tools[2].textContent = level === 'gentle' ? 'Make it harder' : 'Make it easier'; };
    const fail = () => { bot = null; if (game) tell('The game didn’t load', 'Check your connection, then press Restart.'); };
    const answer = ({ data: d }) => {
      const g = game;
      if (!g || d.id !== asked) return;
      if (d.error) return fail();
      // the reply waits for the camera or the visitor's own piece to settle
      setTimeout(() => {
        if (game !== g || d.id !== asked) return;
        const hop = d.move?.split('-'), moved = hop && said(board(g.pos), hop);
        if (hop) { g.moves.push(d.move); g.pos = step(g.pos, d.move); g.last = hop; show(g.pos, true); }
        Object.assign(g, { busy: false, over: d.status !== 'play', check: d.check });
        const end = { mate: 'Checkmate.', stuck: `${d.winner === 'b' ? 'He has' : 'You have'} no legal move left, and in xiangqi that loses.`, draw: g.moves.length >= 300 ? '150 moves each and no winner.' : 'The same position came up three times.' }[d.status];
        tell(d.status === 'draw' ? 'Draw' : d.winner ? (d.winner === 'b' ? 'You win' : 'He wins') : d.check ? 'You’re in check' : 'Your move', [end ? moved : g.hint || moved, end].filter(Boolean).join(' '));
        g.hint = '';
        paint();
      }, Math.max(0, g.due - performance.now()));
    };
    const ask = more => {
      bot ||= Object.assign(new Worker('bot.js'), { onmessage: answer, onerror: fail });
      bot.postMessage({ id: ++asked, moves: game.moves, level, ...more });
    };
    const begin = () => {
      if (game?.moves.length) drop();
      game = { moves: [], pos: OPEN, sel: null, last: null, busy: true, over: false, check: false, cur: 'e7', keys: false, due: performance.now() + 1100,
        hint: `Yours are the pieces with black characters. ${matchMedia('(hover: none)').matches ? 'Tap' : 'Click'} one, then one of its dots.` };
      tell('He’s thinking', 'My grandfather plays Red, and Red moves first.');
      show(OPEN);
      paint();
      ask();
    };
    const move = (from, to) => {
      const g = game;
      tell('He’s thinking', said(board(g.pos), [from, to], true));
      g.moves.push(from + '-' + to);
      g.pos = step(g.pos, from + '-' + to);
      Object.assign(g, { sel: null, last: [from, to], busy: true, due: performance.now() + 900 });
      show(g.pos, true);
      paint();
      ask();
    };
    // a click or Enter on square s: take the piece in hand there, or pick up, swap or put down
    const choose = s => {
      const g = game, b = board(g.pos), p = s && b.get(s), had = g.sel;
      if (g.busy || g.over) return void (heard.textContent = g.over ? 'The game is over' : 'Wait, he’s still thinking');
      if (had && s && legal(b, had, s)) return move(had, s);
      const mine = p?.side === 'b' && s !== had, n = mine ? moves(b, s).length : 0;
      g.sel = n ? s : null;
      heard.textContent = n ? `Picked up your ${low(p.t)} on ${s}, ${n} ${n > 1 ? 'moves' : 'move'}` : mine ? `Your ${low(p.t)} on ${s} has no legal move` : had ? 'Put down' : 'Nothing of yours here';
      if (mine && !n) tell(g.title, `Your ${low(p.t)} has no legal move${g.check ? ' while you’re in check' : ''}.`);
      paint();
    };
    const undo = () => {
      const g = game, n = g.moves.length % 2 ? 2 : 1;
      if (g.moves.length <= n) return;
      g.moves.length -= n;
      Object.assign(g, { pos: g.moves.reduce((p, mv) => step(p, mv), OPEN), sel: null, last: g.moves.at(-1).split('-'), busy: true, hint: 'Took back your last move.', due: 0 });
      show(g.pos, true);
      paint();
      // a button that just switched itself off would drop the keyboard's focus
      if (tools[0].disabled) pad.focus({ preventScroll: true });
      ask({ probe: true });
    };
    const swap = () => {
      level = level === 'gentle' ? 'tough' : 'gentle';
      if (!game.over) tell(game.title, level === 'tough' ? 'He’ll play harder from his next move.' : 'He’ll go easier from his next move.');
      label();
    };
    const enter = () => {
      timers.forEach(clearTimeout);
      tip(null);
      back = scrollY;
      level = 'gentle';
      label();
      root.classList.add('playing');
      stage.classList.add('zoom', 'play');
      bar.hidden = false;
      if (!wide) scrollTo({ top: 0, behavior: 'instant' });
      begin();
      lay();
      pad.focus({ preventScroll: true });
    };
    const leave = () => {
      if (game.moves.length) drop();
      game = null;
      asked++;
      root.style.cursor = '';
      stage.classList.remove('play', 'bare');
      bar.hidden = true;
      for (const el of els.values()) el.classList.remove('sel', 'last', 'prey');
      if (!wide) scrollTo({ top: back, behavior: 'instant' });
      cur = -2;
      frame();
      // the page and the Play button come back once the camera has swung most of the way home
      setTimeout(() => {
        if (game) return;
        root.classList.remove('playing');
        // unless the visitor has already moved on with the keyboard
        if (document.activeElement === document.body) (opener.getClientRects().length ? opener : document.getElementById('main')).focus({ preventScroll: true });
      }, reduce ? 0 : 700);
    };
    const hover = e => {
      const g = game, s = !g.busy && !g.over && open(e.target) && pick(e.clientX, e.clientY), b = s && board(g.pos);
      root.style.cursor = s && (b.get(s)?.side === 'b' || (g.sel && legal(b, g.sel, s))) ? 'pointer' : '';
    };
    opener.addEventListener('click', enter);
    bar.addEventListener('click', e => { const act = e.target.closest('button')?.dataset.do; if (act) ({ undo, begin, swap, leave })[act](); });
    // on the stage itself, not the window: Safari on a touch screen only turns a tap into a click for an element that listens for one
    stage.addEventListener('click', e => {
      if (!game) return;
      game.keys = false;
      choose(pick(e.clientX, e.clientY));
    });
    pad.addEventListener('keydown', e => {
      const g = game, d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
      if (!d && !['Enter', ' ', 'Escape'].includes(e.key)) return;
      e.preventDefault();
      g.keys = true;
      if (d) {
        const [x, y] = xy(g.cur), b = board(g.pos);
        g.cur = at(8 - Math.min(8, Math.max(0, x + d[0])), Math.min(9, Math.max(0, y + d[1])) + 1);
        const p = b.get(g.cur);
        heard.textContent = `${g.cur}, ${p ? (p.side === 'b' ? 'your ' : 'his ') + low(p.t) : 'empty'}${g.sel && legal(b, g.sel, g.cur) ? ', you can move here' : ''}`;
        paint();
      } else if (e.key === 'Escape') {
        if (g.sel) heard.textContent = 'Put down';
        g.sel = null;
        paint();
      } else choose(g.cur);
    });
    pad.addEventListener('focus', () => { if (!game) return; game.keys ||= pad.matches(':focus-visible'); paint(); });
    // only the cursor goes: Safari drops a click if what was pressed gets redrawn before the release, and the press is what takes focus away
    pad.addEventListener('blur', () => dots.querySelector('.cur')?.remove());

    // in the opening shot hovering a piece shows its moves, clicks and taps on the board do nothing
    let tipped = null;
    const open = t => !t.closest('a,button,input,select,textarea,label,header,footer,main>section:not(.hero,.beat)');
    const hit = (x, y) => {
      if (cur >= 0) return null;
      for (const [id, el] of els) {
        const r = el.querySelector('.p-face').getBoundingClientRect();
        if (Math.hypot(x - r.left - r.width / 2, (y - r.top - r.height / 2) * r.width / r.height) < r.width / 2) return id;
      }
      return null;
    };
    const tip = id => {
      if (id === tipped) return;
      tipped = id;
      if (!id) { mark(); return invite(); }
      const p = START.get(id);
      mark(OPEN, id);
      say(p.t, p.side, NAME[p.t]);
    };
    addEventListener('pointermove', e => { if (game) hover(e); else if (e.pointerType !== 'touch') tip((open(e.target) && hit(e.clientX, e.clientY)) || null); });
    let raf = 0;
    const frame = () => {
      raf = 0;
      if (game) return;
      let k = -1;
      // the opening shot holds until the reader has scrolled, however tall the window is
      if (scrollY > innerHeight * .3) beats.forEach(([b], j) => { if (b.getBoundingClientRect().top < innerHeight / 2) k = j; });
      if (k !== cur) { tip(null); go(k); }
      dock();
    };
    const measure = () => {
      const root = document.documentElement.style, head = document.querySelector('header.top');
      if (page) root.setProperty('--zone', Math.round(page.getBoundingClientRect().left) + 'px');
      if (head) root.setProperty('--head', Math.round(head.getBoundingClientRect().bottom + scrollY + 8) + 'px');
      wide = innerWidth >= 1100;
      b0 = parseFloat(getComputedStyle(stage).getPropertyValue('--b'));
    };
    if (scrollY < 1 && !location.hash) drop();
    stage.classList.remove('pre');
    measure();
    frame();
    addEventListener('scroll', () => { raf ||= requestAnimationFrame(frame); }, { passive: true });
    addEventListener('resize', () => { measure(); if (game) return innerWidth < 768 ? leave() : lay(true); frame(); shot(); });
  }

  const list = document.querySelector('#rules .kinds');
  if (list) {
    const items = [...list.children], pick = document.createElement('div'), show = document.createElement('div');
    pick.className = 'pick';
    pick.setAttribute('role', 'group');
    pick.setAttribute('aria-label', 'Pieces');
    pick.innerHTML = items.map(li => `<button type="button" aria-label="${NAME[li.dataset.t]}">${disc(li.dataset.t, 'r')}</button>`).join('');
    list.previousElementSibling.querySelector('[hidden]')?.removeAttribute('hidden');
    show.className = 'show';
    show.append(document.createElement('span'));
    list.before(pick, show);
    show.append(list);
    const buttons = [...pick.children];
    let anims = [];
    const select = (j, focus) => {
      buttons.forEach((b, n) => { b.setAttribute('aria-pressed', n === j); b.tabIndex = n === j ? 0 : -1; });
      items.forEach((li, n) => { li.hidden = n !== j; });
      anims.forEach(a => a.cancel());
      const m = mini(items[j].dataset.t, 'r');
      // the list beside it already reads the rule
      m.el.setAttribute('aria-hidden', 'true');
      show.firstElementChild.replaceWith(m.el);
      anims = m.anims;
      if (focus) buttons[j].focus();
    };
    pick.addEventListener('click', e => { const b = e.target.closest('button'); if (b) select(buttons.indexOf(b)); });
    pick.addEventListener('keydown', e => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      select((buttons.indexOf(e.target.closest('button')) + d + buttons.length) % buttons.length, true);
    });
    select(0);
  }

  // checkmate: the chariot slides onto the general's rank, then the general's three steps are crossed out one by one
  const mate = document.querySelector('#rules .mate');
  if (mate && !reduce) {
    const loop = (node, frames) => node.animate(frames, { duration: 4800, iterations: Infinity });
    const on = (node, at) => loop(node, [{ opacity: 0 }, { opacity: 0, offset: at }, { opacity: 1, offset: at + .04 }, { opacity: 1, offset: .9 }, { opacity: 0, offset: .96 }, { opacity: 0 }]);
    const key = (offset, opacity, y, easing = 'linear') => ({ offset, opacity, easing, transform: `translate(0px,${y}px)` });
    loop(mate.querySelector('.m-piece'), [key(0, 0, 200), key(.06, 1, 200), key(.14, 1, 200, 'ease-in-out'), key(.34, 1, 0), key(.9, 1, 0), key(.96, 0, 0), key(1, 0, 200)]);
    on(mate.querySelector('.m-trail'), .14);
    on(mate.querySelector('.m-take'), .34);
    mate.querySelectorAll('.m-x').forEach((x, i) => on(x, .44 + i * .08));
  }
}
