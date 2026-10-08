/* 跳棋（中国跳棋）：121 孔六角星盘，双方各 10 枚。
   走法：向相邻空位走一步；或跳过相邻的一枚棋子落到它正后方的空位，可连续跳。
   胜负：最先把自己的 10 枚棋子全部移进对面三角形者获胜。
   AI：简单=随机，一般=贪心推进，困难=Top-K 极小化极大搜索（3 层）。 */
(function (global) {
  var P1 = 1, P2 = 2;                       /* P1 在上方，目标下方；P2 在下方，目标上方 */
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];

  /* ---------- 棋盘构建（立方坐标） ---------- */
  var BOARD = (function () {
    var cells = [], map = {};
    for (var y = -8; y <= 8; y++) {
      for (var x = -8; x <= 8; x++) {
        var z = -x - y;
        var hex = Math.abs(x) <= 4 && Math.abs(y) <= 4 && Math.abs(z) <= 4;
        var tri =
          (y <= -5 && x <= 4 && z <= 4) ||
          (y >= 5 && x >= -4 && z >= -4) ||
          (x <= -5 && y <= 4 && z <= 4) ||
          (x >= 5 && y >= -4 && z >= -4) ||
          (z <= -5 && x <= 4 && y <= 4) ||
          (z >= 5 && x >= -4 && y >= -4);
        if (!hex && !tri) continue;
        map[x + ',' + y] = cells.length;
        cells.push({ x: x, y: y, sx: x + y * 0.5, sy: y * 0.8660254 });
      }
    }
    /* 邻居索引 */
    for (var i = 0; i < cells.length; i++) {
      var nb = [];
      for (var d = 0; d < 6; d++) {
        var k = map[(cells[i].x + DIRS[d][0]) + ',' + (cells[i].y + DIRS[d][1])];
        nb.push(k == null ? -1 : k);
      }
      cells[i].nb = nb;
    }
    return { cells: cells, map: map };
  })();

  var NC = BOARD.cells.length;              /* 应为 121 */
  var HOME = { 1: [], 2: [] };
  var GOAL = { 1: [], 2: [] };
  BOARD.cells.forEach(function (c, i) {
    if (c.y <= -5) { HOME[1].push(i); GOAL[2].push(i); }
    if (c.y >= 5) { HOME[2].push(i); GOAL[1].push(i); }
  });

  function hexDist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return (Math.abs(dx) + Math.abs(dy) + Math.abs(dx + dy)) / 2;
  }
  /* 每个格子到目标区的最短距离 */
  var DIST = { 1: new Float32Array(NC), 2: new Float32Array(NC) };
  (function () {
    for (var i = 0; i < NC; i++) {
      var c = BOARD.cells[i], b1 = 99, b2 = 99;
      for (var k = 0; k < GOAL[1].length; k++) b1 = Math.min(b1, hexDist(c, BOARD.cells[GOAL[1][k]]));
      for (var j = 0; j < GOAL[2].length; j++) b2 = Math.min(b2, hexDist(c, BOARD.cells[GOAL[2][j]]));
      DIST[1][i] = b1; DIST[2][i] = b2;
    }
  })();

  /* ---------- 走法生成 ---------- */
  var visited = new Int32Array(NC), vgen = 0;
  function movesFrom(board, from) {
    var out = [], c = BOARD.cells[from];
    for (var d = 0; d < 6; d++) {
      var n = c.nb[d];
      if (n < 0) continue;
      if (!board[n]) { out.push(n); continue; }
      var j = BOARD.cells[n].nb[d];         /* 跳过后的落点 */
      if (j >= 0 && !board[j]) jump(board, j, out);
    }
    return out;
  }
  function jump(board, pos, out) {
    vgen++;
    var stack = [pos];
    visited[pos] = vgen;
    while (stack.length) {
      var p = stack.pop();
      out.push(p);
      var c = BOARD.cells[p];
      for (var d = 0; d < 6; d++) {
        var n = c.nb[d];
        if (n < 0 || !board[n]) continue;
        var j = BOARD.cells[n].nb[d];
        if (j >= 0 && !board[j] && visited[j] !== vgen) { visited[j] = vgen; stack.push(j); }
      }
    }
  }

  function allMoves(board, side) {
    var out = [];
    for (var i = 0; i < NC; i++) {
      if (board[i] !== side) continue;
      var list = movesFrom(board, i);
      for (var k = 0; k < list.length; k++) out.push({ from: i, to: list[k] });
    }
    return out;
  }

  function applyMove(board, mv) {
    board[mv.to] = board[mv.from];
    board[mv.from] = 0;
  }
  function undoMove(board, mv) {
    board[mv.from] = board[mv.to];
    board[mv.to] = 0;
  }

  /* 局面评估：己方总距离越小越好，对手总距离越大越好。
     附加：掉队棋子（离目标最远者）额外惩罚，促使 AI 不丢下尾巴；
     已进营的棋子给小额奖励，鼓励尽早清空出发营地。 */
  function evaluate(board, side) {
    var o = 3 - side, s = 0, i, maxOwn = 0, maxOpp = 0, ownIn = 0;
    for (i = 0; i < NC; i++) {
      if (board[i] === side) {
        s -= DIST[side][i];
        if (DIST[side][i] > maxOwn) maxOwn = DIST[side][i];
        if (DIST[side][i] === 0) ownIn++;
      } else if (board[i] === o) {
        s += DIST[o][i];
        if (DIST[o][i] > maxOpp) maxOpp = DIST[o][i];
      }
    }
    s -= maxOwn * 0.6;   /* 己方掉队棋子拖后腿 */
    s += maxOpp * 0.6;   /* 对手掉队棋子是优势 */
    s += ownIn * 0.3;    /* 鼓励进营 */
    return s;
  }
  /* 胜负（反赖皮规则）：目标区 10 格须全部被占据；己方棋子占的格子直接算数，
     对方棋子占的格子只有在该格“曾被腾空过”后才算数（防止初始棋子白送胜利，
     也防止对方把棋子赖进你营地导致死锁——赖着不走反而送你获胜）。 */
  var vacated = new Uint8Array(NC);        /* 目标区格子是否被腾空过 */
  function markVacated(board) {
    [1, 2].forEach(function (s) {
      GOAL[s].forEach(function (i) { if (!board[i]) vacated[i] = 1; });
    });
  }
  function isWin(board, side) {
    var g = GOAL[side];
    for (var k = 0; k < g.length; k++) {
      if (!board[g[k]]) return false;
      if (board[g[k]] !== side && !vacated[g[k]]) return false;
    }
    return true;
  }
  function gainOf(mv, side) { return DIST[side][mv.from] - DIST[side][mv.to]; }

  function topMoves(board, side, k) {
    var list = allMoves(board, side);
    for (var i = 0; i < list.length; i++) {
      list[i].g = gainOf(list[i], side) + (DIST[side][list[i].to] === 0 ? 0.4 : 0);
      list[i].g += Math.random() * 0.02;
    }
    list.sort(function (a, b) { return b.g - a.g; });
    return list.slice(0, k);
  }

  var LEVELS = {
    easy: { rand: 0.6, depth: 0 },
    normal: { rand: 0.12, depth: 1 },
    hard: { rand: 0, depth: 4 }
  };

  function minimax(board, side, rootSide, depth, widths) {
    if (depth === 0) return evaluate(board, rootSide);
    var w = widths[widths.length - depth] || 6;
    var list = allMoves(board, side);
    if (!list.length) return evaluate(board, rootSide);
    for (var i = 0; i < list.length; i++) list[i].g = gainOf(list[i], side);
    list.sort(function (a, b) { return b.g - a.g; });
    list = list.slice(0, w);
    var best = side === rootSide ? -Infinity : Infinity;
    for (var k = 0; k < list.length; k++) {
      applyMove(board, list[k]);
      var v = minimax(board, 3 - side, rootSide, depth - 1, widths);
      undoMove(board, list[k]);
      if (side === rootSide) { if (v > best) best = v; }
      else { if (v < best) best = v; }
    }
    return best;
  }

  function think(board0, side, level) {
    var board = Int8Array.from(board0);
    var cfg = LEVELS[level] || LEVELS.normal;
    var all = allMoves(board, side);
    if (!all.length) return null;

    if (cfg.rand && Math.random() < cfg.rand) {
      /* 简单：偏好前进，但不追求最优 */
      var pool = all.filter(function (m) { return gainOf(m, side) > 0; });
      if (!pool.length) pool = all;
      return pool[(Math.random() * pool.length) | 0];
    }
    if (cfg.depth <= 1) {
      var best = all[0], bg = -Infinity;
      for (var i = 0; i < all.length; i++) {
        var g = gainOf(all[i], side) + Math.random() * 0.05;
        if (g > bg) { bg = g; best = all[i]; }
      }
      return best;
    }
    var cands = topMoves(board, side, 12);
    var bestM = cands[0], bestV = -Infinity;
    for (var k = 0; k < cands.length; k++) {
      applyMove(board, cands[k]);
      var v = minimax(board, 3 - side, side, cfg.depth - 1, [12, 10, 8, 6]);
      undoMove(board, cands[k]);
      if (v > bestV) { bestV = v; bestM = cands[k]; }
    }
    return { from: bestM.from, to: bestM.to };
  }

  /* ---------- 游戏实例 ---------- */
  function mount(host, api) {
    var G = {
      board: new Int8Array(NC), turn: P1, over: false, winner: 0,
      history: [], snaps: [], sel: -1, moves: [], last: null, startTs: Date.now()
    };
    var human = api.getSide(), mode = api.getMode(), level = api.getLevel();
    var aiSide = human === P1 ? P2 : P1;
    var bk = null, thinking = false, R = 12, ox = 0, oy = 0;

    function reset() {
      G.board = new Int8Array(NC);
      HOME[1].forEach(function (i) { G.board[i] = P1; });
      HOME[2].forEach(function (i) { G.board[i] = P2; });
      G.turn = P1; G.over = false; G.winner = 0;
      G.history = []; G.snaps = []; G.sel = -1; G.moves = []; G.last = null;
      G.startTs = Date.now();
      vacated.fill(0);
    }
    /* 从初始局面重放历史，重建 vacated 标记（悔棋/恢复存档用） */
    function rebuildVacated() {
      vacated.fill(0);
      var b = new Int8Array(NC);
      HOME[1].forEach(function (i) { b[i] = P1; });
      HOME[2].forEach(function (i) { b[i] = P2; });
      G.history.forEach(function (m) { applyMove(b, m); markVacated(b); });
    }
    function snap() {
      G.snaps.push({ b: Array.prototype.slice.call(G.board), t: G.turn, l: G.last });
      if (G.snaps.length > 300) G.snaps.shift();
    }
    function pname(s) { return s === P1 ? '🔴 红方（上）' : '🔵 蓝方（下）'; }
    function progress(s) {
      var g = GOAL[s], cnt = 0;
      for (var i = 0; i < g.length; i++) if (G.board[g[i]] === s) cnt++;
      return cnt;
    }

    function update() {
      api.status(G.over ? '对局结束' : pname(G.turn) + '走棋');
      api.info('回合：<b>' + (Math.floor(G.history.length / 2) + 1) + '</b>　难度：<b>' +
        ({ easy: '简单', normal: '一般', hard: '困难' })[level] + '</b><br>' +
        '红方进营：<b>' + progress(P1) + '/10</b><br>蓝方进营：<b>' + progress(P2) + '/10</b><br>' +
        '点自己的棋子选中，再点亮点落子；可连跳');
      if (bk) bk.redraw();
      api.changed();
    }

    function finish(winner) {
      G.over = true; G.winner = winner;
      update();
      api.over(winner === human ? 'win' : 'lose',
        { moves: G.history.length, sec: Math.round((Date.now() - G.startTs) / 1000) });
    }

    function doMove(mv, silent) {
      snap();
      /* 连跳判定：落点与起点不相邻即为跳跃（单步只会落在相邻格） */
      var jumped = BOARD.cells[mv.from].nb.indexOf(mv.to) < 0;
      applyMove(G.board, mv);
      markVacated(G.board);
      G.history.push(mv); G.last = mv; G.sel = -1; G.moves = [];
      if (!silent) { if (jumped) Sfx.jump(); else Sfx.move(); }
      if (isWin(G.board, G.turn)) { finish(G.turn); return; }
      G.turn = 3 - G.turn;
      update();
    }

    function aiTurn() {
      if (G.over || mode !== 'pve' || G.turn !== aiSide) return;
      thinking = true; api.busy(true); api.status('🤖 电脑思考中…'); if (bk) bk.redraw();
      setTimeout(function () {
        var mv = null;
        try { mv = think(G.board, aiSide, level); } catch (e) { mv = null; }
        thinking = false; api.busy(false);
        if (!mv) { update(); return; }
        doMove(mv);
      }, 60);
    }

    function draw(ctx, W, H, C) {
      var pad = 0.62;
      var unit = Math.min(W / (12 + pad * 2), H / (13.857 + pad * 2));
      R = unit;
      ox = W / 2; oy = H / 2;
      var sx = function (c) { return ox + c.sx * unit; };
      var sy = function (c) { return oy + c.sy * unit; };

      /* 星形轮廓 */
      var outline = [];
      [[4, -4], [4, 0], [0, 4], [-4, 4], [-4, 0], [0, -4],
       [4, -8], [8, -4], [4, 4], [-8, 4], [-4, 8], [-4, -4]].forEach(function (p) {
        var i = BOARD.map[p[0] + ',' + p[1]];
        if (i != null) outline.push(BOARD.cells[i]);
      });
      outline.sort(function (a, b) { return Math.atan2(a.sy, a.sx) - Math.atan2(b.sy, b.sx); });

      ctx.beginPath();
      outline.forEach(function (c, i) { i ? ctx.lineTo(sx(c), sy(c)) : ctx.moveTo(sx(c), sy(c)); });
      ctx.closePath();
      ctx.fillStyle = C.board; ctx.fill();
      ctx.strokeStyle = C.boardEdge; ctx.lineWidth = 3; ctx.stroke();

      /* 目标区底色 */
      ctx.lineWidth = 2;
      [1, 2].forEach(function (p) {
        ctx.beginPath();
        GOAL[p].forEach(function (i) {
          var c = BOARD.cells[i];
          ctx.moveTo(sx(c) + unit * 0.36, sy(c));
          ctx.arc(sx(c), sy(c), unit * 0.36, 0, Math.PI * 2);
        });
        ctx.fillStyle = p === P1 ? 'rgba(217,79,69,.16)' : 'rgba(47,126,216,.16)';
        ctx.fill();
      });

      /* 孔位 */
      ctx.fillStyle = C.grid;
      BOARD.cells.forEach(function (c) {
        ctx.beginPath(); ctx.arc(sx(c), sy(c), unit * 0.1, 0, Math.PI * 2); ctx.fill();
      });

      /* 上一步 */
      if (G.last) {
        ctx.strokeStyle = C.last; ctx.lineWidth = Math.max(2, unit * 0.09);
        ctx.setLineDash([unit * 0.2, unit * 0.16]);
        ctx.beginPath();
        ctx.moveTo(sx(BOARD.cells[G.last.from]), sy(BOARD.cells[G.last.from]));
        ctx.lineTo(sx(BOARD.cells[G.last.to]), sy(BOARD.cells[G.last.to]));
        ctx.stroke(); ctx.setLineDash([]);
      }
      /* 可落点提示 */
      if (G.sel >= 0) {
        G.moves.forEach(function (t) {
          var c = BOARD.cells[t];
          ctx.beginPath(); ctx.arc(sx(c), sy(c), unit * 0.34, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(57,184,120,.45)'; ctx.fill();
          ctx.strokeStyle = '#39b878'; ctx.lineWidth = 2; ctx.stroke();
        });
      }

      /* 棋子 */
      BOARD.cells.forEach(function (c, i) {
        var v = G.board[i];
        if (!v) return;
        var x = sx(c), y = sy(c);
        var sel = (i === G.sel);
        ctx.beginPath(); ctx.arc(x, y + unit * 0.06, unit * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fill();
        var g = ctx.createRadialGradient(x - unit * 0.1, y - unit * 0.13, unit * 0.05, x, y, unit * 0.33);
        var base = v === P1 ? C.red : C.blue;
        g.addColorStop(0, BoardKit.lighten(base, 50));
        g.addColorStop(1, BoardKit.darken(base, 18));
        ctx.beginPath(); ctx.arc(x, y, unit * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = sel ? C.hi : 'rgba(0,0,0,.3)';
        ctx.lineWidth = sel ? Math.max(2.5, unit * 0.1) : Math.max(1, unit * 0.05);
        ctx.stroke();
        if (sel) {
          ctx.beginPath(); ctx.arc(x, y, unit * 0.44, 0, Math.PI * 2);
          ctx.strokeStyle = C.hi; ctx.lineWidth = 2; ctx.setLineDash([unit * 0.16, unit * 0.12]);
          ctx.stroke(); ctx.setLineDash([]);
        }
      });
    }

    function cellAt(px, py) {
      var bestI = -1, bestD = 1e9;
      var unit = R;
      /* 移动端小屏热区下限 24px，避免孔位过小点不中 */
      var hitR = Math.max(unit * 0.46, 24);
      for (var i = 0; i < NC; i++) {
        var c = BOARD.cells[i];
        var dx = px - (ox + c.sx * unit), dy = py - (oy + c.sy * unit);
        var d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; bestI = i; }
      }
      return bestD <= hitR * hitR ? bestI : -1;
    }

    function onClick(px, py) {
      if (G.over || thinking) return;
      if (mode === 'pve' && G.turn !== human) return;
      var i = cellAt(px, py);
      if (i < 0) { G.sel = -1; G.moves = []; if (bk) bk.redraw(); return; }

      if (G.sel >= 0 && G.moves.indexOf(i) >= 0) {
        var mv = { from: G.sel, to: i };
        doMove(mv);
        if (!G.over) aiTurn();
        return;
      }
      if (G.board[i] === G.turn) {
        G.sel = i; G.moves = movesFrom(G.board, i);
        Sfx.click();
        if (bk) bk.redraw();
      } else {
        G.sel = -1; G.moves = []; if (bk) bk.redraw();
      }
    }

    bk = BoardKit.create(host, { aspect: (13.857 + 1.24) / (12 + 1.24), draw: draw, click: onClick });

    return {
      setLevel: function (l) { level = l; update(); },
      restart: function (o) {
        mode = o.mode; level = o.level; human = o.side;
        aiSide = human === P1 ? P2 : P1;
        reset(); update();
        if (mode === 'pve' && G.turn === aiSide) aiTurn();
      },
      undo: function () {
        if (thinking) return;
        var times = (mode === 'pve' && G.snaps.length >= 2) ? 2 : 1;
        for (var i = 0; i < times; i++) {
          if (!G.snaps.length) break;
          var s = G.snaps.pop();
          G.board = Int8Array.from(s.b); G.turn = s.t; G.last = s.l; G.history.pop();
        }
        G.over = false; G.winner = 0; G.sel = -1; G.moves = [];
        rebuildVacated();
        update();
      },
      hint: function () {
        if (G.over || thinking) return;
        var mv = think(G.board, G.turn, level === 'easy' ? 'normal' : level);
        if (!mv) return;
        G.sel = mv.from; G.moves = [mv.to];
        var ctx = bk.ctx, C = BoardKit.colors(), unit = R;
        var c = BOARD.cells[mv.to];
        ctx.beginPath();
        ctx.arc(ox + c.sx * unit, oy + c.sy * unit, unit * 0.5, 0, Math.PI * 2);
        ctx.strokeStyle = C.hi; ctx.lineWidth = 3; ctx.setLineDash([unit * 0.18, unit * 0.14]);
        ctx.stroke(); ctx.setLineDash([]);
        setTimeout(function () { G.sel = -1; G.moves = []; if (bk) bk.redraw(); }, 2000);
      },
      resign: function () { finish(3 - human); },
      serialize: function () {
        return {
          v: 1, b: Array.prototype.slice.call(G.board), t: G.turn,
          h: G.history.map(function (m) { return [m.from, m.to]; }),
          mode: mode, level: level, side: human, ts: G.startTs
        };
      },
      restore: function (d) {
        if (!d || !d.b || d.b.length !== NC) return false;
        G.board = Int8Array.from(d.b); G.turn = d.t || P1;
        G.history = (d.h || []).map(function (a) { return { from: a[0], to: a[1] }; });
        mode = d.mode || mode; level = d.level || level; human = d.side || human;
        aiSide = human === P1 ? P2 : P1;
        G.snaps = []; G.over = false; G.winner = 0; G.sel = -1; G.moves = [];
        G.last = G.history.length ? G.history[G.history.length - 1] : null;
        G.startTs = d.ts || Date.now();
        rebuildVacated();
        if (isWin(G.board, P1)) { G.over = true; G.winner = P1; }
        else if (isWin(G.board, P2)) { G.over = true; G.winner = P2; }
        update();
        if (!G.over && mode === 'pve' && G.turn === aiSide) aiTurn();
        return true;
      },
      destroy: function () { if (bk) bk.destroy(); },
      redraw: function () { if (bk) bk.redraw(); }
    };
  }

  global.Games = global.Games || {};
  global.Games.checkers = {
    stageType: 'board',
    cat: 'board',
    id: 'checkers', name: '跳棋', emoji: '🔺',
    desc: '六角星盘，双方各 10 枚。走一步或连跳，最先把全部棋子送进对面三角星算赢。',
    tags: ['121 孔', '可连跳', '先进营者胜'],
    sides: ['🔴 红方（先手）', '🔵 蓝方（后手）'],
    rules: '① 双方各 10 枚棋子，每回合沿相邻空位走一步；② 也可以跳过相邻棋子落到它正后方，能连跳就连跳；③ 最先把全部棋子送进对面三角营者胜；④ 对方赖在你营地不走也白搭——那会直接判你占满。',
    guide: '① 优先把落后的棋子往前赶，别留「尾巴」；② 搭「跳梯」：把自己的棋子排成间隔链，一次能连跳很远；③ 对方棋子也可以借力跳——它是桥不是墙；④ 控制中心区域，入口越窄对方越难防。',
    tip: '跳跃可以“搭桥”：把自己的棋子排成阶梯，一次能跳很远。别把落后的棋子落在后面。',
    mount: mount
  };
})(window);
