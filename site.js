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

  const NAME = { K: 'General', A: 'Advisor', E: 'Elephant', H: 'Horse', R: 'Chariot', C: 'Cannon', P: 'Soldier' };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stage = document.querySelector('.stage');
  if (stage) {
    const dots = stage.querySelector('.dots'), hero = document.querySelector('.hero');
    const START = start(), OPEN = new Map([...START.keys()].map(s => [s, s]));
    const els = new Map([...stage.querySelectorAll('.p')].map(el => [el.dataset.sq, el]));
    // board point of a square: file a is on the camera's right, rank 1 is the far rank
    const xy = s => { const [f, r] = sq(s); return [8 - f, r - 1]; };
    const board = pos => new Map([...pos].map(([s, id]) => [s, START.get(id)]));
    // a position maps square -> piece id (its starting square)
    const step = (p, mv) => { const [a, b] = mv.split('-'), n = new Map(p); n.set(b, n.get(a)); n.delete(a); return n; };
    // each spacer names the square of the piece its card is about
    const beats = [...document.querySelectorAll('main .beat[data-sq]')].map(b => [b, b.dataset.sq]);

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

    // the camera: the focus point f on the table lands on (tx, ty) at c pixels per cell, seen from k cells away, tilted t
    const T = Math.PI / 4, K = 22, BOARD = [[-.62, -.62, .56], [8.62, -.62, .56], [-.62, 9.62, 0], [8.62, 9.62, 0]];
    const project = (f, x, y, z, t = T, k = K) => { const q = k / (k - (y - f[1]) * Math.sin(t) - z * Math.cos(t)); return [(x - f[0]) * q, ((y - f[1]) * Math.cos(t) - z * Math.sin(t)) * q]; };
    const put = (f, tx, ty, c, t = T, k = K) => {
      const st = stage.style;
      st.setProperty('--tx', tx + 'px');
      st.setProperty('--ty', ty + 'px');
      st.setProperty('--fx', f[0]);
      st.setProperty('--fy', f[1]);
      st.setProperty('--T', t + 'rad');
      st.setProperty('--K', k);
      st.setProperty('--k', c / b0);
      return { f, c, tx, ty };
    };
    // fits the whole board into the frame fr
    const aim = (f, fr, t, k) => {
      const s = box(BOARD.map(p => project(f, ...p, t, k))), c = Math.min(...[0, 1].map(j => span(fr[j]) / span(s[j])));
      return put(f, ...[0, 1].map(j => (fr[j][0] + fr[j][1] - c * (s[j][0] + s[j][1])) / 2), c, t, k);
    };
    const box = ps => [0, 1].map(j => [Math.min(...ps.map(p => p[j])), Math.max(...ps.map(p => p[j]))]);
    const span = ([a, b]) => b - a;
    let cur = -2, b0;
    // a piece stop: the stone's face in the middle of the screen, three times the size of a cell in the opening shot
    const shot = () => {
      const st = stage.style;
      if (cur < 0) return ['--tx', '--ty', '--fx', '--fy', '--T', '--K', '--k'].forEach(v => st.removeProperty(v));
      const f = xy(beats[cur][1]), c = 3 * b0;
      put(f, innerWidth / 2, innerHeight / 2 - c * project(f, ...f, .56)[1], c);
    };
    const go = k => {
      cur = k;
      opener.hidden = k >= 0;
      stage.classList.toggle('zoom', k >= 0);
      for (const [id, el] of els) el.classList.toggle('sel', id === beats[k]?.[1]);
      shot();
    };

    // Play mode, 768px and wider: the visitor takes Black against bot.js in a top-down shot that holds still. The story's page and scroll stand down until they leave.
    const opener = document.createElement('button'), bar = document.createElement('div');
    opener.type = 'button';
    opener.className = 'btn play-start';
    opener.textContent = 'Play Xiangqi';
    hero?.append(opener);
    bar.className = 'play-bar';
    bar.hidden = true;
    bar.innerHTML = '<div class="vh" tabindex="0" role="application" aria-label="Board. Arrow keys move, Enter picks up or places a piece, Escape puts it back, or leaves the game when nothing is held."></div><div class="play-status" aria-live="polite"></div><p class="vh" aria-live="polite"></p>'
      + '<div class="play-tools"><button type="button" class="btn btn--quiet" data-do="undo">Undo</button><button type="button" class="btn btn--quiet" data-do="begin">Restart</button><button type="button" class="btn btn--quiet" data-do="swap"></button><button type="button" class="btn btn--quiet" data-do="leave">Back to the story</button></div>';
    stage.after(bar);
    const [pad, status, heard] = bar.children, tools = bar.lastChild.children;
    const PT = Math.PI / 9, PK = 30, root = document.documentElement, low = t => NAME[t].toLowerCase();
    let game = null, bot = null, asked = 0, level = 'gentle', cam, barH = 0, back = 0;
    // frames the board between the screen edges and the bar. snap skips the camera's glide, so clicks never land on a board still in motion.
    const lay = snap => {
      if (snap) stage.style.transition = 'none';
      barH = bar.offsetHeight;
      cam = aim([4, 4.5], [[24, innerWidth - 24], [24, bar.getBoundingClientRect().top - 24]], PT, PK);
      // his plate, his cup and the pot stay only where they fit whole beside the board
      const side = (x, y) => cam.tx + cam.c * project(cam.f, x, y, 0, PT, PK)[0];
      stage.classList.toggle('bare', side(11.1, 4.5) > innerWidth || side(-3.3, .9) < 0);
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
      tip(null);
      back = scrollY;
      level = 'gentle';
      label();
      root.classList.add('playing');
      stage.classList.add('zoom', 'play');
      bar.hidden = false;
      scrollTo({ top: 0, behavior: 'instant' });
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
      dots.innerHTML = '';
      // the story's board is always the opening position
      show(OPEN);
      scrollTo({ top: back, behavior: 'instant' });
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
      if (!game) return void point(propAt(e.clientX, e.clientY));
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
        if (!g.sel) return leave();
        heard.textContent = 'Put down';
        g.sel = null;
        paint();
      } else choose(g.cur);
    });
    pad.addEventListener('focus', () => { if (!game) return; game.keys ||= pad.matches(':focus-visible'); paint(); });
    // only the cursor goes: Safari drops a click if what was pressed gets redrawn before the release, and the press is what takes focus away
    pad.addEventListener('blur', () => dots.querySelector('.cur')?.remove());

    // in the story a mouse resting on a stone shows where it can go from the opening position. Clicks and taps on the board do nothing.
    const open = t => !t.closest('a,button,input,select,textarea,label,header,footer,main>section:not(.hero,.beat)');
    const hit = (x, y) => {
      for (const [id, el] of els) {
        const r = el.querySelector('.p-face').getBoundingClientRect();
        if (Math.hypot(x - r.left - r.width / 2, (y - r.top - r.height / 2) * r.width / r.height) < r.width / 2) return id;
      }
      return null;
    };
    let tipped = null;
    const tip = id => {
      if (id === tipped) return;
      tipped = id;
      dots.innerHTML = id ? trail(OPEN, id) : '';
      prey(OPEN, id);
    };
    document.querySelector('.intro .note')?.insertAdjacentHTML('beforeend', '<span class="hover"> Hover a piece to see where it can go.</span>');
    // the props on the table each show a card: the clementines one for the plates, the tea one for the cups and the pot. The copy sits in the hero's [data-tip] blocks.
    const props = [...stage.querySelectorAll('.prop')], kind = p => (/fruit/.test(p.querySelector('img').getAttribute('src')) ? 'fruit' : 'tea');
    const blocks = document.querySelectorAll('header.top,main>section:not(.hero,.beat),footer.foot'), card = document.createElement('div'), halo = document.createElement('div'), elder = stage.querySelector('.spr--elder'), slab = stage.querySelector('.slab');
    card.className = 'prop-tip';
    halo.className = 'prop-ring';
    card.setAttribute('aria-hidden', 'true');
    halo.hidden = true;
    stage.after(card, halo);
    const sprite = p => p.querySelector(stage.matches('.zoom') ? '.z' : 'img:not(.z)').getBoundingClientRect();
    const seen = p => {
      if (game || root.matches('.playing') || stage.matches('.bare')) return false;
      const r = sprite(p);
      return r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
    };
    const propAt = (x, y) => props.findLast(p => { const r = sprite(p); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && seen(p); }) || null;
    // on: the props that may carry the card, first seen wins, and whether the keyboard asked (then a ring marks the prop). keyed: what a focused button asks for.
    let on = null, keyed = null, loop = 0, until = 0;
    const follow = now => {
      loop = 0;
      const p = on?.list.find(seen);
      if (on && !p && !on.keys) on = null;
      card.classList.toggle('on', !!p);
      halo.hidden = !(p && on.keys);
      if (p) {
        const k = kind(p);
        if (card.dataset.k !== k) {
          card.dataset.k = k;
          card.replaceChildren(...document.querySelector(`[data-tip=${k}]`).cloneNode(true).childNodes);
          card.querySelector('[id]')?.removeAttribute('id');
        }
        // above the prop, below it or beside it, each pulled into the screen. The spot that covers the least wins: his face counts most, then the page's cards and the Play button, then the prop itself, then the board.
        const r = sprite(p), w = card.offsetWidth, h = card.offsetHeight, m = 12, g = on.keys ? 16 : 10, e = elder.getBoundingClientRect();
        const face = !stage.matches('.zoom') && { left: e.left + e.width * .36, right: e.left + e.width * .64, top: e.top, bottom: e.top + e.height * .4 };
        const over = [[face, 1e6], ...[...blocks, opener].map(c => [c.getBoundingClientRect(), 1e3]), [r, 30], [slab.getBoundingClientRect(), 1]];
        const cost = ([x, y]) => over.reduce((s, [c, k]) => s + (c ? k * Math.max(0, Math.min(x + w, c.right) - Math.max(x, c.left)) * Math.max(0, Math.min(y + h, c.bottom) - Math.max(y, c.top)) : 0), 0);
        const cx = (r.left + r.right - w) / 2, spots = [[cx, r.top - g - h], [cx, r.bottom + g], [r.right + g, r.top], [r.left - g - w, r.top]];
        const [sx, sy] = spots.map(([x, y]) => [Math.max(m, Math.min(x, innerWidth - m - w)), Math.max(m, Math.min(y, innerHeight - m - h))]).sort((s, t) => cost(s) - cost(t))[0];
        card.style.transform = `translate(${Math.round(sx)}px,${Math.round(sy)}px)`;
        if (on.keys) halo.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
      }
      if (on && now < until) loop = requestAnimationFrame(follow);
    };
    // the card is placed again for a moment after anything that can move a prop, because the camera glides
    const place = () => { until = performance.now() + 1500; loop ||= requestAnimationFrame(follow); };
    const point = (p, keys = false) => { on = p && { list: [].concat(p), keys }; place(); };
    // a scroll beat or a resize moves the props: a mouse card goes, a keyboard card follows
    const moved = () => { if (on) on.keys ? place() : point(null); };
    opener.after(...[...document.querySelectorAll('[data-tip]')].map(src => {
      const b = document.createElement('button'), k = src.dataset.tip;
      // the viewer's own plate or cup first, then his
      const list = props.filter(p => kind(p) === k).sort((a, c) => c.matches('.prop--near') - a.matches('.prop--near'));
      b.type = 'button';
      b.className = 'vh tip-key';
      b.textContent = src.querySelector('strong').textContent;
      b.setAttribute('aria-describedby', src.querySelector('p').id);
      b.addEventListener('focus', () => { keyed = list; tip(null); point(list, true); });
      b.addEventListener('blur', () => { keyed = null; point(null); });
      b.addEventListener('keydown', e => { if (e.key === 'Escape') { keyed = null; point(null); } });
      return b;
    }));
    addEventListener('pointermove', e => {
      if (game) return hover(e);
      if (e.pointerType === 'touch') return;
      const o = open(e.target), pr = (o && propAt(e.clientX, e.clientY)) || null;
      // pointing at a prop is not pointing at a piece. The pointer takes the card when it enters a prop and hands it back to a focused button when it leaves.
      if (pr !== (on?.keys ? null : on?.list[0] ?? null)) pr ? point(pr) : point(keyed, !!keyed);
      tip((e.pointerType === 'mouse' && o && !on && hit(e.clientX, e.clientY)) || null);
    });
    root.addEventListener('mouseleave', () => game || tip(null));
    // a tap or click on a prop shows its card, a press anywhere else hides it
    addEventListener('pointerdown', e => { if (!(open(e.target) && propAt(e.clientX, e.clientY))) point(null); });
    let raf = 0;
    const frame = () => {
      raf = 0;
      if (game) return;
      let k = -1;
      // the opening shot holds until the reader has scrolled, however tall the window is
      if (scrollY > innerHeight * .3) beats.forEach(([b], j) => { if (b.getBoundingClientRect().top < innerHeight / 2) k = j; });
      if (k !== cur) { tip(null); moved(); go(k); }
    };
    const measure = () => {
      const head = document.querySelector('header.top');
      if (head) root.style.setProperty('--head', Math.round(head.getBoundingClientRect().bottom + scrollY + 8) + 'px');
      b0 = parseFloat(getComputedStyle(stage).getPropertyValue('--b'));
    };
    if (scrollY < 1 && !location.hash) drop();
    stage.classList.remove('pre');
    measure();
    frame();
    addEventListener('scroll', () => { raf ||= requestAnimationFrame(frame); }, { passive: true });
    addEventListener('resize', () => { measure(); if (game) return innerWidth < 768 ? leave() : lay(true); moved(); frame(); shot(); });
  }
}
