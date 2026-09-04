/* 五子棋：15×15，黑先。
   AI：窗口模式计分（增量维护）+ Alpha-Beta 剪枝 + 启发式排序，三档难度 */
(function (global) {
  var N = 15, SIZE = N * N;
  var BLACK = 1, WHITE = 2;
  var WIN = [0, 1, 18, 260, 3200, 200000];
  var MATE = 900000;
  var DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

  function at(x, y) { return y * N + x; }
  function opp(s) { return 3 - s; }

  /* 所有长度为 5 的窗口（四个方向） */
  var WINDOWS = (function () {
    var out = [];
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      for (var d = 0; d < 4; d++) {
        var dx = DIRS[d][0], dy = DIRS[d][1];
        var ex = x + dx * 4, ey = y + dy * 4;
        if (ex < 0 || ex >= N || ey < 0 || ey >= N) continue;
        var w = new Int16Array(5);
        for (var k = 0; k < 5; k++) w[k] = (y + dy * k) * N + (x + dx * k);
        out.push(w);
      }
    }
    return out;
  })();

  /* 每个格子所属的窗口（最多 20 个），用于增量评估 */
  var CELLW = (function () {
    var arr = new Array(SIZE);
    for (var i = 0; i < SIZE; i++) arr[i] = [];
    for (var w = 0; w < WINDOWS.length; w++) {
      var win = WINDOWS[w];
      for (var k = 0; k < 5; k++) arr[win[k]].push(win);
    }
    return arr;
  })();

  /* 单个窗口对黑方的价值 */
  function winVal(b, w) {
    var bk = 0, wh = 0;
    for (var k = 0; k < 5; k++) {
      var v = b[w[k]];
      if (v === 1) bk++; else if (v === 2) wh++;
    }
    if (bk && wh) return 0;
    if (bk) return WIN[bk];
    if (wh) return -WIN[wh];
    return 0;
  }

  function fullScore(b) {
    var s = 0;
    for (var i = 0; i < WINDOWS.length; i++) s += winVal(b, WINDOWS[i]);
    return s;
  }

  /* 在 m 处落下 side 后，黑方分数的变化（调用后棋盘不变） */
  function deltaBlack(b, m, side) {
    var ws = CELLW[m], i, s = 0;
    for (i = 0; i < ws.length; i++) s -= winVal(b, ws[i]);
    b[m] = side;
    for (i = 0; i < ws.length; i++) s += winVal(b, ws[i]);
    b[m] = 0;
    return s;
  }

  function isWin(b, m, side) {
    var x = m % N, y = (m / N) | 0;
    for (var d = 0; d < 4; d++) {
      var dx = DIRS[d][0], dy = DIRS[d][1], c = 1, s, nx, ny;
      for (s = 1; s < 5; s++) { nx = x + dx * s; ny = y + dy * s; if (nx < 0 || nx >= N || ny < 0 || ny >= N || b[at(nx, ny)] !== side) break; c++; }
      for (s = 1; s < 5; s++) { nx = x - dx * s; ny = y - dy * s; if (nx < 0 || nx >= N || ny < 0 || ny >= N || b[at(nx, ny)] !== side) break; c++; }
      if (c >= 5) return true;
    }
    return false;
  }

  function winLine(b, m, side) {
    var x = m % N, y = (m / N) | 0;
    for (var d = 0; d < 4; d++) {
      var dx = DIRS[d][0], dy = DIRS[d][1];
      var line = [[x, y]], s, nx, ny;
      for (s = 1; s < 5; s++) { nx = x + dx * s; ny = y + dy * s; if (nx < 0 || nx >= N || ny < 0 || ny >= N || b[at(nx, ny)] !== side) break; line.push([nx, ny]); }
      for (s = 1; s < 5; s++) { nx = x - dx * s; ny = y - dy * s; if (nx < 0 || nx >= N || ny < 0 || ny >= N || b[at(nx, ny)] !== side) break; line.unshift([nx, ny]); }
      if (line.length >= 5) return line;
    }
    return null;
  }

  /* 候选点：已有棋子周围 radius 格内的空点 */
  var seen = new Int32Array(SIZE), gen = 0;
  function candidates(b, radius) {
    gen++;
    var out = [], R = radius || 2;
    for (var i = 0; i < SIZE; i++) {
      if (!b[i]) continue;
      var x = i % N, y = (i / N) | 0;
      for (var dy = -R; dy <= R; dy++) {
        var ny = y + dy; if (ny < 0 || ny >= N) continue;
        for (var dx = -R; dx <= R; dx++) {
          var nx = x + dx; if (nx < 0 || nx >= N) continue;
          var j = ny * N + nx;
          if (b[j] || seen[j] === gen) continue;
          seen[j] = gen; out.push(j);
        }
      }
    }
    if (!out.length) out.push(at((N / 2) | 0, (N / 2) | 0));
    return out;
  }

  /* 走法评分：自己的收益 + 对手在此的收益（即堵的价值） */
  function scoreMove(b, m, side) {
    var sgn = side === 1 ? 1 : -1;
    var mine = deltaBlack(b, m, side) * sgn;
    var theirs = deltaBlack(b, m, opp(side)) * (-sgn);
    return mine + theirs * 0.9;
  }

  function orderMoves(b, side, list, limit) {
    var scored = new Array(list.length);
    for (var i = 0; i < list.length; i++) scored[i] = { m: list[i], s: scoreMove(b, list[i], side) };
    scored.sort(function (a, c) { return c.s - a.s; });
    var out = [];
    for (var k = 0; k < Math.min(limit, scored.length); k++) out.push(scored[k].m);
    return out;
  }

  /* ---------- 搜索 ---------- */
  var S = 0;                 /* 黑方当前总分（增量维护） */
  var deadline = 0, aborted = false, nodes = 0;

  function negamax(b, side, depth, alpha, beta) {
    if (aborted) return 0;
    if (depth <= 0) return side === 1 ? S : -S;
    if ((++nodes & 511) === 0 && Date.now() > deadline) { aborted = true; return 0; }
    var list = candidates(b, depth >= 3 ? 1 : 2);
    if (!list.length) return 0;
    var moves = orderMoves(b, side, list, depth >= 3 ? 8 : 10);
    var best = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      var d = deltaBlack(b, m, side);
      b[m] = side; S += d;
      var v;
      if (isWin(b, m, side)) v = MATE - (10 - depth);
      else v = -negamax(b, opp(side), depth - 1, -beta, -alpha);
      b[m] = 0; S -= d;
      if (aborted) break;
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  var LEVELS = {
    easy: { depth: 0, rand: 0.45, width: 12, time: 300 },
    normal: { depth: 2, rand: 0.10, width: 12, time: 900 },
    hard: { depth: 5, rand: 0, width: 12, time: 1500 }
  };

  function think(b0, side, level) {
    var b = Int8Array.from(b0);            /* 副本，避免污染真实棋盘 */
    var cfg = LEVELS[level] || LEVELS.normal;
    var list = candidates(b, 2);
    if (!list.length) return -1;

    /* 1. 自己能连五 —— 直接赢 */
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      b[m] = side;
      var w = isWin(b, m, side);
      b[m] = 0;
      if (w) return m;
    }
    /* 2. 对手下一手能连五 —— 必须封堵 */
    var o = opp(side), blocks = [];
    for (var j = 0; j < list.length; j++) {
      var q = list[j];
      b[q] = o;
      var w2 = isWin(b, q, o);
      b[q] = 0;
      if (w2) blocks.push(q);
    }
    if (blocks.length) return blocks[0];

    /* 3. 低难度随机来一手，制造可乘之机 */
    if (cfg.rand && Math.random() < cfg.rand) {
      return list[(Math.random() * list.length) | 0];
    }

    /* 4. Alpha-Beta 搜索 */
    S = fullScore(b);
    deadline = Date.now() + cfg.time;
    aborted = false; nodes = 0;
    var moves = orderMoves(b, side, list, cfg.width);
    var best = moves[0], bestVal = -Infinity;
    for (var k = 0; k < moves.length; k++) {
      var mv = moves[k];
      var d = deltaBlack(b, mv, side);
      b[mv] = side; S += d;
      var v;
      if (isWin(b, mv, side)) v = MATE;
      else v = -negamax(b, o, cfg.depth - 1, -Infinity, -bestVal);
      b[mv] = 0; S -= d;
      if (aborted) break;
      if (v > bestVal) { bestVal = v; best = mv; }
    }
    return best;
  }

  /* ---------- 游戏实例 ---------- */
  function mount(host, api) {
    var Sg = {
      board: new Int8Array(SIZE), turn: BLACK, over: false, winner: 0,
      history: [], snaps: [], last: -1, win: null, startTs: Date.now()
    };
    var human = api.getSide(), mode = api.getMode(), level = api.getLevel();
    var aiSide = human === BLACK ? WHITE : BLACK;
    var bk = null, thinking = false, cell = 20, ox = 0, oy = 0;

    function reset() {
      Sg.board = new Int8Array(SIZE);
      Sg.turn = BLACK; Sg.over = false; Sg.winner = 0;
      Sg.history = []; Sg.snaps = []; Sg.last = -1; Sg.win = null; Sg.startTs = Date.now();
    }
    function snap() {
      Sg.snaps.push({ b: Array.prototype.slice.call(Sg.board), t: Sg.turn, l: Sg.last });
      if (Sg.snaps.length > 300) Sg.snaps.shift();
    }
    function setName(s) { return s === BLACK ? '⚫ 黑棋' : '⚪ 白棋'; }

    function update() {
      api.status(Sg.over
        ? (Sg.winner === 0 ? '平局 · 棋盘已满' : setName(Sg.winner) + '获胜！')
        : setName(Sg.turn) + '落子');
      api.info('步数：<b>' + Sg.history.length + '</b>　难度：<b>' +
        ({ easy: '简单', normal: '一般', hard: '困难' })[level] + '</b><br>' +
        '目标：横、竖、斜任意方向连成 5 子');
      if (bk) bk.redraw();
      api.changed();
    }

    function finish(winner) {
      Sg.over = true; Sg.winner = winner;
      update();
      api.over(winner === 0 ? 'draw' : (winner === human ? 'win' : 'lose'),
        { moves: Sg.history.length, sec: Math.round((Date.now() - Sg.startTs) / 1000) });
    }

    function place(x, y, side) {
      if (Sg.over || x < 0 || y < 0 || x >= N || y >= N) return false;
      var i = at(x, y);
      if (Sg.board[i]) return false;
      snap();
      Sg.board[i] = side; Sg.last = i; Sg.history.push(i);
      Sfx[side === BLACK ? 'place' : 'move']();
      if (isWin(Sg.board, i, side)) { Sg.win = winLine(Sg.board, i, side); update(); finish(side); return true; }
      Sg.win = null;
      var full = true;
      for (var k = 0; k < SIZE; k++) if (!Sg.board[k]) { full = false; break; }
      if (full) { update(); finish(0); return true; }
      Sg.turn = opp(side);
      update();
      return true;
    }

    function aiTurn() {
      if (Sg.over || mode !== 'pve' || Sg.turn !== aiSide) return;
      thinking = true; api.busy(true); api.status('🤖 电脑思考中…'); if (bk) bk.redraw();
      setTimeout(function () {
        var m = -1;
        try { m = think(Sg.board, aiSide, level); } catch (e) { m = -1; }
        thinking = false; api.busy(false);
        if (m < 0) { update(); return; }
        place(m % N, (m / N) | 0, aiSide);
      }, 60);
    }

    function draw(ctx, W, H, C) {
      cell = Math.min(W, H) / (N + 1);
      var bw = cell * (N - 1);
      ox = (W - bw) / 2; oy = (H - bw) / 2;

      ctx.fillStyle = C.board;
      BoardKit.roundRect(ctx, ox - cell * 0.78, oy - cell * 0.78, bw + cell * 1.56, bw + cell * 1.56, 14);
      ctx.fill();
      ctx.strokeStyle = C.boardEdge; ctx.lineWidth = 2; ctx.stroke();

      ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
      ctx.beginPath();
      for (var i = 0; i < N; i++) {
        ctx.moveTo(ox, oy + i * cell); ctx.lineTo(ox + bw, oy + i * cell);
        ctx.moveTo(ox + i * cell, oy); ctx.lineTo(ox + i * cell, oy + bw);
      }
      ctx.stroke();

      var stars = [[3, 3], [11, 3], [3, 11], [11, 11], [7, 7]];
      ctx.fillStyle = C.star;
      for (var s = 0; s < stars.length; s++) {
        ctx.beginPath();
        ctx.arc(ox + stars[s][0] * cell, oy + stars[s][1] * cell, Math.max(2, cell * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }

      if (api.getOption('coords')) {
        ctx.fillStyle = C.star;
        ctx.font = Math.max(8, cell * 0.32) + 'px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var L = 'ABCDEFGHIJKLMNO';
        for (var c = 0; c < N; c++) {
          ctx.fillText(L[c], ox + c * cell, oy - cell * 0.52);
          ctx.fillText(String(c + 1), ox - cell * 0.55, oy + c * cell);
        }
      }

      for (var p = 0; p < SIZE; p++) {
        var v = Sg.board[p];
        if (!v) continue;
        BoardKit.stone(ctx, ox + (p % N) * cell, oy + ((p / N) | 0) * cell, cell * 0.44,
          v === BLACK ? C.black : C.white);
      }

      if (Sg.last >= 0) {
        ctx.strokeStyle = C.last; ctx.lineWidth = Math.max(1.5, cell * 0.07);
        ctx.beginPath();
        ctx.arc(ox + (Sg.last % N) * cell, oy + ((Sg.last / N) | 0) * cell, cell * 0.2, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (Sg.win && Sg.win.length) {
        ctx.strokeStyle = C.hi; ctx.lineWidth = Math.max(2, cell * 0.12);
        ctx.beginPath();
        for (var w = 0; w < Sg.win.length; w++) {
          var wx = ox + Sg.win[w][0] * cell, wy = oy + Sg.win[w][1] * cell;
          if (w === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
        }
        ctx.stroke();
      }
    }

    function onClick(px, py) {
      if (Sg.over || thinking) return;
      if (mode === 'pve' && Sg.turn !== human) return;
      var x = Math.round((px - ox) / cell), y = Math.round((py - oy) / cell);
      if (x < 0 || x >= N || y < 0 || y >= N) return;
      var dx = px - (ox + x * cell), dy = py - (oy + y * cell);
      if (dx * dx + dy * dy > (cell * 0.62) * (cell * 0.62)) return;
      if (place(x, y, Sg.turn) && !Sg.over) aiTurn();
    }

    bk = BoardKit.create(host, { aspect: 1, draw: draw, click: onClick });

    return {
      setLevel: function (l) { level = l; update(); },
      restart: function (o) {
        mode = o.mode; level = o.level; human = o.side;
        aiSide = human === BLACK ? WHITE : BLACK;
        reset(); update();
        if (mode === 'pve' && Sg.turn === aiSide) aiTurn();
      },
      undo: function () {
        if (thinking) return;
        var times = (mode === 'pve' && Sg.snaps.length >= 2) ? 2 : 1;
        for (var i = 0; i < times; i++) {
          if (!Sg.snaps.length) break;
          var s = Sg.snaps.pop();
          Sg.board = Int8Array.from(s.b); Sg.turn = s.t; Sg.last = s.l; Sg.history.pop();
        }
        Sg.over = false; Sg.winner = 0; Sg.win = null;
        update();
      },
      hint: function () {
        if (Sg.over || thinking) return;
        var m = think(Sg.board, Sg.turn, level === 'easy' ? 'normal' : level);
        if (m < 0) return;
        var ctx = bk.ctx, C = BoardKit.colors();
        ctx.save();
        ctx.strokeStyle = C.hi; ctx.lineWidth = Math.max(2, cell * 0.1);
        ctx.setLineDash([cell * 0.22, cell * 0.16]);
        ctx.beginPath();
        ctx.arc(ox + (m % N) * cell, oy + ((m / N) | 0) * cell, cell * 0.5, 0, Math.PI * 2);
        ctx.stroke(); ctx.restore();
        setTimeout(function () { if (bk) bk.redraw(); }, 1800);
      },
      resign: function () { finish(opp(human)); },
      serialize: function () {
        return {
          v: 1, b: Array.prototype.slice.call(Sg.board), t: Sg.turn,
          h: Sg.history.slice(0), l: Sg.last, mode: mode, level: level, side: human, ts: Sg.startTs
        };
      },
      restore: function (d) {
        if (!d || !d.b || d.b.length !== SIZE) return false;
        Sg.board = Int8Array.from(d.b); Sg.turn = d.t || BLACK;
        Sg.history = d.h || []; Sg.last = d.l == null ? -1 : d.l;
        mode = d.mode || mode; level = d.level || level; human = d.side || human;
        aiSide = human === BLACK ? WHITE : BLACK;
        Sg.snaps = []; Sg.over = false; Sg.winner = 0; Sg.win = null; Sg.startTs = d.ts || Date.now();
        for (var i = 0; i < SIZE; i++) {
          if (!Sg.board[i]) continue;
          if (isWin(Sg.board, i, Sg.board[i])) { Sg.over = true; Sg.winner = Sg.board[i]; Sg.win = winLine(Sg.board, i, Sg.board[i]); break; }
        }
        update();
        if (!Sg.over && mode === 'pve' && Sg.turn === aiSide) aiTurn();
        return true;
      },
      destroy: function () { if (bk) bk.destroy(); },
      redraw: function () { if (bk) bk.redraw(); }
    };
  }

  global.Games = global.Games || {};
  global.Games.gomoku = {
    id: 'gomoku', name: '五子棋', emoji: '⚫',
    desc: '横、竖、斜任意方向先连成五子即胜。规则最简单，最适合入门。',
    tags: ['15×15', '连五即胜', '推荐入门'],
    sides: ['⚫ 黑棋（先手）', '⚪ 白棋（后手）'],
    tip: '先手优势很大，想挑战就选白棋。注意对手的“活三”，要尽早堵住。',
    mount: mount
  };
})(window);
