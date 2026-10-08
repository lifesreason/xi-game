/* 围棋：9×9，黑先，白棋贴目 6.5。
   规则：气尽提子、禁止自杀、禁止打劫（简单劫）、双方连续停一手终局，采用数子法（中国规则简化）。
   AI：简单=随机+守形，一般=启发式打分，困难=候选点 + 蒙特卡洛模拟对局。 */
(function (global) {
  var N = 9, SIZE = N * N;
  var BLACK = 1, WHITE = 2, KOMI = 6.5;

  var NB = (function () {
    var arr = new Array(SIZE);
    for (var i = 0; i < SIZE; i++) {
      var x = i % N, y = (i / N) | 0, list = [];
      if (y > 0) list.push(i - N);
      if (y < N - 1) list.push(i + N);
      if (x > 0) list.push(i - 1);
      if (x < N - 1) list.push(i + 1);
      arr[i] = list;
    }
    return arr;
  })();

  var stack = new Int32Array(SIZE), mark = new Int32Array(SIZE), stamp = 0;

  function hasLib(b, i) {
    var color = b[i];
    if (!color) return true;
    stamp++;
    var top = 0; stack[top++] = i; mark[i] = stamp;
    while (top) {
      var c = stack[--top], nb = NB[c];
      for (var k = 0; k < nb.length; k++) {
        var n = nb[k];
        if (!b[n]) return true;
        if (b[n] === color && mark[n] !== stamp) { mark[n] = stamp; stack[top++] = n; }
      }
    }
    return false;
  }

  function groupSize(b, i) {
    var color = b[i]; if (!color) return 0;
    stamp++;
    var top = 0, cnt = 0; stack[top++] = i; mark[i] = stamp;
    while (top) {
      var c = stack[--top]; cnt++;
      var nb = NB[c];
      for (var k = 0; k < nb.length; k++) {
        var n = nb[k];
        if (b[n] === color && mark[n] !== stamp) { mark[n] = stamp; stack[top++] = n; }
      }
    }
    return cnt;
  }

  function libCount(b, i) {
    var color = b[i]; if (!color) return 0;
    stamp++;
    var top = 0, libs = 0; stack[top++] = i; mark[i] = stamp;
    var seenLib = new Int32Array(SIZE);
    while (top) {
      var c = stack[--top], nb = NB[c];
      for (var k = 0; k < nb.length; k++) {
        var n = nb[k];
        if (!b[n]) { if (seenLib[n] !== stamp) { seenLib[n] = stamp; libs++; } }
        else if (b[n] === color && mark[n] !== stamp) { mark[n] = stamp; stack[top++] = n; }
      }
    }
    return libs;
  }

  function kill(b, i) {
    var color = b[i]; if (!color) return 0;
    stamp++;
    var top = 0, cnt = 0; stack[top++] = i; mark[i] = stamp;
    while (top) {
      var c = stack[--top]; cnt++; b[c] = 0;
      var nb = NB[c];
      for (var k = 0; k < nb.length; k++) {
        var n = nb[k];
        if (b[n] === color && mark[n] !== stamp) { mark[n] = stamp; stack[top++] = n; }
      }
    }
    return cnt;
  }

  /* 落子：返回提子数，-1 表示非法（含自杀） */
  function tryPlay(b, i, side) {
    if (b[i]) return -1;
    b[i] = side;
    var o = 3 - side, cap = 0, k, n;
    for (k = 0; k < NB[i].length; k++) {
      n = NB[i][k];
      if (b[n] === o && !hasLib(b, n)) cap += kill(b, n);
    }
    if (cap === 0 && !hasLib(b, i)) { b[i] = 0; return -1; }
    return cap;
  }

  function boardKey(b) { return Array.prototype.join.call(b, ''); }

  function isEye(b, i, side) {
    if (b[i]) return false;
    var nb = NB[i];
    for (var k = 0; k < nb.length; k++) if (b[nb[k]] !== side) return false;
    var x = i % N, y = (i / N) | 0, opp = 3 - side, bad = 0;
    var corners = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (var c = 0; c < 4; c++) {
      var nx = x + corners[c][0], ny = y + corners[c][1];
      if (nx < 0 || nx >= N || ny < 0 || ny >= N) continue;   /* 边角放宽 */
      if (b[ny * N + nx] === opp) bad++;
    }
    return bad <= (nb.length < 4 ? 1 : 0);
  }

  /* 数子法终局计算 */
  function finalScore(b) {
    var vis = new Uint8Array(SIZE), stones = { 1: 0, 2: 0 }, terr = { 1: 0, 2: 0 };
    var i;
    for (i = 0; i < SIZE; i++) if (b[i]) stones[b[i]]++;
    var q = new Int32Array(SIZE);
    for (i = 0; i < SIZE; i++) {
      if (b[i] || vis[i]) continue;
      var top = 0, cnt = 0, touch1 = 0, touch2 = 0;
      q[top++] = i; vis[i] = 1;
      while (top) {
        var c = q[--top]; cnt++;
        var nb = NB[c];
        for (var k = 0; k < nb.length; k++) {
          var n = nb[k];
          if (b[n] === 1) touch1 = 1;
          else if (b[n] === 2) touch2 = 1;
          else if (!vis[n]) { vis[n] = 1; q[top++] = n; }
        }
      }
      if (touch1 && !touch2) terr[1] += cnt;
      else if (touch2 && !touch1) terr[2] += cnt;
    }
    return {
      black: stones[1] + terr[1],
      white: stones[2] + terr[2] + KOMI,
      stones: stones, terr: terr
    };
  }

  /* ---------- 启发式打分 ---------- */
  function rateMove(b, i, side, lastMove) {
    if (b[i]) return -1e9;
    var c = Int8Array.from(b);
    var cap = tryPlay(c, i, side);
    if (cap < 0) return -1e9;
    var o = 3 - side, score = 0, k, n;

    score += cap * 55;                                  /* 提子 */

    var myLib = libCount(c, i);
    if (myLib === 1) score -= 30;                       /* 自己被叫吃 */
    else if (myLib === 2) score += 2;
    else score += 8;

    for (k = 0; k < NB[i].length; k++) {                /* 打吃对手 */
      n = NB[i][k];
      if (c[n] === o && libCount(c, n) === 1) score += Math.min(groupSize(c, n), 5) * 14;
      else if (c[n] === side) score += 4;               /* 连接 */
      else if (c[n] === o) score += 2;                  /* 贴身 */
    }

    if (isEye(b, i, side)) score -= 34;                 /* 别填自己的眼 */
    if (lastMove >= 0) {
      var dx = Math.abs(i % N - lastMove % N), dy = Math.abs(((i / N) | 0) - ((lastMove / N) | 0));
      var d = dx + dy;
      if (d <= 2) score += 5; else if (d <= 4) score += 2;
    }
    var x = i % N, y = (i / N) | 0, edge = Math.min(x, y, N - 1 - x, N - 1 - y);
    score += edge === 0 ? -3 : edge === 1 ? 3 : edge === 2 ? 4 : 1;
    score += (8 - Math.abs(x - 4) - Math.abs(y - 4)) * 0.35;   /* 中央略优 */
    score += Math.random() * 3;
    return score;
  }

  function legalMoves(b, side) {
    var out = [];
    for (var i = 0; i < SIZE; i++) {
      if (b[i]) continue;
      var c = Int8Array.from(b);
      if (tryPlay(c, i, side) >= 0) out.push(i);
    }
    return out;
  }

  /* ---------- 蒙特卡洛模拟（困难） ---------- */
  function pickPlayoutMove(b, side, lastMove) {
    var tries = 0, i;
    while (tries++ < 8) {
      if (lastMove >= 0 && Math.random() < 0.68) {
        var lx = lastMove % N, ly = (lastMove / N) | 0;
        var r = 3;
        i = (ly + ((Math.random() * (2 * r + 1)) | 0) - r) * N + (lx + ((Math.random() * (2 * r + 1)) | 0) - r);
        if (i < 0 || i >= SIZE) continue;
      } else {
        i = (Math.random() * SIZE) | 0;
      }
      if (b[i]) continue;
      if (isEye(b, i, side)) continue;
      var c = Int8Array.from(b);
      if (tryPlay(c, i, side) >= 0) return i;
    }
    for (i = 0; i < SIZE; i++) {
      if (b[i] || isEye(b, i, side)) continue;
      var c2 = Int8Array.from(b);
      if (tryPlay(c2, i, side) >= 0) return i;
    }
    for (i = 0; i < SIZE; i++) {
      if (b[i]) continue;
      var c3 = Int8Array.from(b);
      if (tryPlay(c3, i, side) >= 0) return i;
    }
    return -1;
  }

  function playout(b0, side, lastMove, maxMoves) {
    var b = Int8Array.from(b0);
    var s = side, passes = 0, moves = 0, last = lastMove;
    while (passes < 2 && moves < maxMoves) {
      var m = pickPlayoutMove(b, s, last);
      if (m < 0) { passes++; s = 3 - s; continue; }
      passes = 0;
      tryPlay(b, m, s);
      last = m; s = 3 - s; moves++;
    }
    var sc = finalScore(b);
    return sc.black - sc.white;   /* >0 黑胜 */
  }

  var LEVELS = {
    easy: { rand: 0.55, mc: 0, time: 200 },
    normal: { rand: 0.08, mc: 0, time: 500 },
    hard: { rand: 0, mc: 1, time: 1600 }
  };

  function think(b, side, level, lastMove, koKey) {
    var cfg = LEVELS[level] || LEVELS.normal;
    var moves = [];
    for (var i = 0; i < SIZE; i++) {
      if (b[i]) continue;
      var c = Int8Array.from(b);
      if (tryPlay(c, i, side) < 0) continue;
      if (koKey && boardKey(c) === koKey) continue;      /* 打劫禁着 */
      moves.push(i);
    }
    if (!moves.length) return -1;                        /* 停一手 */

    var scored = moves.map(function (m) { return { m: m, s: rateMove(b, m, side, lastMove) }; });
    scored.sort(function (a, c) { return c.s - a.s; });

    if (!cfg.mc) {
      if (cfg.rand && Math.random() < cfg.rand) {
        var pool = scored.slice(0, Math.max(3, Math.min(8, scored.length)));
        return pool[(Math.random() * pool.length) | 0].m;
      }
      return scored[0].m;
    }

    /* 困难：对前 8 个候选点做随机模拟对局，按胜率选择 */
    var cands = scored.slice(0, 8);
    var perMove = 120, results = new Array(cands.length).fill(0), games = new Array(cands.length).fill(0);
    var deadline = Date.now() + cfg.time;
    var round = 0;
    while (Date.now() < deadline && round < perMove) {
      round++;
      for (var k = 0; k < cands.length; k++) {
        var c2 = Int8Array.from(b);
        tryPlay(c2, cands[k].m, side);
        var diff = playout(c2, 3 - side, cands[k].m, 90);
        var win = side === 1 ? diff > 0 : diff < 0;
        if (win) results[k]++;
        games[k]++;
        if (Date.now() > deadline) break;
      }
    }
    var best = cands[0].m, bestRate = -1;
    for (var j = 0; j < cands.length; j++) {
      if (!games[j]) continue;
      var rate = results[j] / games[j] + cands[j].s * 0.00004;
      if (rate > bestRate) { bestRate = rate; best = cands[j].m; }
    }
    return best;
  }

  /* ---------- 游戏实例 ---------- */
  function mount(host, api) {
    var G = {
      board: new Int8Array(SIZE), turn: BLACK, over: false,
      history: [], snaps: [], last: -1, ko: null, hash2: null,
      passes: 0, caps: { 1: 0, 2: 0 }, result: null, startTs: Date.now()
    };
    var human = api.getSide(), mode = api.getMode(), level = api.getLevel();
    var aiSide = human === BLACK ? WHITE : BLACK;
    var bk = null, thinking = false, cell = 0, ox = 0, oy = 0;

    function reset() {
      G.board = new Int8Array(SIZE); G.turn = BLACK; G.over = false;
      G.history = []; G.snaps = []; G.last = -1; G.ko = null; G.hash2 = null;
      G.passes = 0; G.caps = { 1: 0, 2: 0 }; G.result = null; G.startTs = Date.now();
    }
    function snap() {
      G.snaps.push({
        b: Array.prototype.slice.call(G.board), t: G.turn, l: G.last, k: G.ko,
        h2: G.hash2, p: G.passes, c: { 1: G.caps[1], 2: G.caps[2] }
      });
      if (G.snaps.length > 300) G.snaps.shift();
    }
    function name(s) { return s === BLACK ? '⚫ 黑棋' : '⚪ 白棋'; }

    function update() {
      api.status(G.over ? '对局结束' : name(G.turn) + '落子');
      api.info('手数：<b>' + G.history.length + '</b>　难度：<b>' +
        ({ easy: '简单', normal: '一般', hard: '困难' })[level] + '</b><br>' +
        '提子：黑 <b>' + G.caps[1] + '</b>　白 <b>' + G.caps[2] + '</b><br>' +
        '连续停一手：<b>' + G.passes + '</b>/2　白棋贴目 <b>' + KOMI + '</b>');
      if (bk) bk.redraw();
      api.changed();
    }

    function doPass(side) {
      if (G.over) return;
      snap();
      G.history.push(-1);
      G.passes++;
      G.last = -1; G.ko = null; G.hash2 = null;
      if (G.passes >= 2) { endGame(); return; }
      G.turn = 3 - side;
      update();
    }

    function endGame() {
      G.over = true;
      var sc = finalScore(G.board);
      G.result = sc;
      update();
      var winner = sc.black > sc.white ? BLACK : WHITE;
      api.info('手数：<b>' + G.history.length + '</b><br>黑：<b>' + sc.black.toFixed(1) +
        '</b> 目（子 ' + sc.stones[1] + ' + 空 ' + sc.terr[1] + '）<br>白：<b>' + sc.white.toFixed(1) +
        '</b> 目（子 ' + sc.stones[2] + ' + 空 ' + sc.terr[2] + ' + 贴目 ' + KOMI + '）');
      api.over(winner === human ? 'win' : 'lose',
        { moves: G.history.length, sec: Math.round((Date.now() - G.startTs) / 1000), score: sc.black.toFixed(1) + ' : ' + sc.white.toFixed(1) });
    }

    function play(x, y, side) {
      if (G.over || x < 0 || y < 0 || x >= N || y >= N) return false;
      var i = y * N + x;
      if (G.board[i]) return false;
      var c = Int8Array.from(G.board);
      var cap = tryPlay(c, i, side);
      if (cap < 0) { api.toast('这里不能下：没有气了'); return false; }
      if (G.ko && boardKey(c) === G.ko) { api.toast('打劫禁着：先在别处走一手'); return false; }
      snap();
      G.ko = boardKey(G.board);      /* 对手下一手不得还原本局面（打劫禁着） */
      G.board = c;
      G.caps[side] += cap;
      G.last = i;
      G.history.push(i);
      G.passes = 0;
      if (cap > 0) Sfx.capture(); else Sfx.place();
      G.turn = 3 - side;
      update();
      return true;
    }

    function aiTurn() {
      if (G.over || mode !== 'pve' || G.turn !== aiSide) return;
      thinking = true; api.busy(true); api.status('🤖 电脑思考中…'); if (bk) bk.redraw();
      setTimeout(function () {
        var m = -1;
        try { m = think(G.board, aiSide, level, G.last, G.ko); } catch (e) { m = -1; }
        thinking = false; api.busy(false);
        if (m < 0) { doPass(aiSide); if (!G.over && mode === 'pve' && G.turn === aiSide) return; return; }
        play(m % N, (m / N) | 0, aiSide);
      }, 60);
    }

    function draw(ctx, W, H, C) {
      cell = Math.min(W, H) / (N + 1);
      var bw = cell * (N - 1);
      ox = (W - bw) / 2; oy = (H - bw) / 2;

      ctx.fillStyle = C.board;
      BoardKit.roundRect(ctx, ox - cell * 0.8, oy - cell * 0.8, bw + cell * 1.6, bw + cell * 1.6, 14);
      ctx.fill();
      ctx.strokeStyle = C.boardEdge; ctx.lineWidth = 2; ctx.stroke();

      ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
      ctx.beginPath();
      for (var i = 0; i < N; i++) {
        ctx.moveTo(ox, oy + i * cell); ctx.lineTo(ox + bw, oy + i * cell);
        ctx.moveTo(ox + i * cell, oy); ctx.lineTo(ox + i * cell, oy + bw);
      }
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeRect(ox, oy, bw, bw);

      var hoshi = [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]];
      ctx.fillStyle = C.star;
      for (var s = 0; s < hoshi.length; s++) {
        ctx.beginPath();
        ctx.arc(ox + hoshi[s][0] * cell, oy + hoshi[s][1] * cell, Math.max(2, cell * 0.11), 0, Math.PI * 2);
        ctx.fill();
      }

      if (api.getOption('coords')) {
        ctx.fillStyle = C.star;
        ctx.font = Math.max(8, cell * 0.32) + 'px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var L = 'ABCDEFGHJ';
        for (var c2 = 0; c2 < N; c2++) {
          ctx.fillText(L[c2], ox + c2 * cell, oy - cell * 0.55);
          ctx.fillText(String(N - c2), ox - cell * 0.58, oy + c2 * cell);
        }
      }

      for (var p = 0; p < SIZE; p++) {
        var v = G.board[p];
        if (!v) continue;
        BoardKit.stone(ctx, ox + (p % N) * cell, oy + ((p / N) | 0) * cell, cell * 0.44,
          v === BLACK ? C.black : C.white);
      }
      if (G.last >= 0) {
        ctx.strokeStyle = C.last; ctx.lineWidth = Math.max(1.5, cell * 0.08);
        ctx.beginPath();
        ctx.arc(ox + (G.last % N) * cell, oy + ((G.last / N) | 0) * cell, cell * 0.16, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function onClick(px, py) {
      if (G.over || thinking) return;
      if (mode === 'pve' && G.turn !== human) return;
      var x = Math.round((px - ox) / cell), y = Math.round((py - oy) / cell);
      if (x < 0 || x >= N || y < 0 || y >= N) return;
      var dx = px - (ox + x * cell), dy = py - (oy + y * cell);
      if (dx * dx + dy * dy > (cell * 0.6) * (cell * 0.6)) return;
      if (play(x, y, G.turn) && !G.over) aiTurn();
    }

    bk = BoardKit.create(host, { aspect: 1, draw: draw, click: onClick });

    return {
      extra: [{ label: '✋ 停一手（虚手）', fn: function () { if (!G.over && !thinking) { doPass(G.turn); if (!G.over && mode === 'pve' && G.turn === aiSide) aiTurn(); } } }],
      setLevel: function (l) { level = l; update(); },
      restart: function (o) {
        mode = o.mode; level = o.level; human = o.side;
        aiSide = human === BLACK ? WHITE : BLACK;
        reset(); update();
        if (mode === 'pve' && G.turn === aiSide) aiTurn();
      },
      undo: function () {
        if (thinking) return;
        var times = (mode === 'pve' && G.snaps.length >= 2) ? 2 : 1;
        for (var i = 0; i < times; i++) {
          if (!G.snaps.length) break;
          var s = G.snaps.pop();
          G.board = Int8Array.from(s.b); G.turn = s.t; G.last = s.l; G.ko = s.k;
          G.hash2 = s.h2; G.passes = s.p; G.caps = { 1: s.c[1], 2: s.c[2] };
          G.history.pop();
        }
        G.over = false; G.result = null;
        update();
      },
      hint: function () {
        if (G.over || thinking) return;
        var m = think(G.board, G.turn, level === 'easy' ? 'normal' : level, G.last, G.ko);
        if (m < 0) { api.toast('建议停一手'); return; }
        var ctx = bk.ctx, C = BoardKit.colors();
        ctx.save();
        ctx.strokeStyle = C.hi; ctx.lineWidth = Math.max(2, cell * 0.1);
        ctx.setLineDash([cell * 0.22, cell * 0.16]);
        ctx.beginPath();
        ctx.arc(ox + (m % N) * cell, oy + ((m / N) | 0) * cell, cell * 0.5, 0, Math.PI * 2);
        ctx.stroke(); ctx.restore();
        setTimeout(function () { if (bk) bk.redraw(); }, 1800);
      },
      resign: function () {
        G.over = true; update();
        api.over('lose', { moves: G.history.length, sec: Math.round((Date.now() - G.startTs) / 1000) });
      },
      serialize: function () {
        return {
          v: 1, b: Array.prototype.slice.call(G.board), t: G.turn, h: G.history.slice(0),
          l: G.last, p: G.passes, c: { 1: G.caps[1], 2: G.caps[2] },
          mode: mode, level: level, side: human, ts: G.startTs
        };
      },
      restore: function (d) {
        if (!d || !d.b || d.b.length !== SIZE) return false;
        G.board = Int8Array.from(d.b); G.turn = d.t || BLACK; G.history = d.h || [];
        G.last = d.l == null ? -1 : d.l; G.passes = d.p || 0;
        G.caps = d.c || { 1: 0, 2: 0 };
        mode = d.mode || mode; level = d.level || level; human = d.side || human;
        aiSide = human === BLACK ? WHITE : BLACK;
        G.snaps = []; G.over = false; G.ko = null; G.hash2 = null; G.result = null;
        G.startTs = d.ts || Date.now();
        update();
        if (mode === 'pve' && G.turn === aiSide) aiTurn();
        return true;
      },
      destroy: function () { if (bk) bk.destroy(); },
      redraw: function () { if (bk) bk.redraw(); }
    };
  }

  global.Games = global.Games || {};
  global.Games.go = {
    stageType: 'board',
    cat: 'board',
    id: 'go', name: '围棋', emoji: '⚪',
    desc: '围地多者胜。棋盘 9×9，规则已简化：无气提子、禁止自杀与打劫，双方连续停一手即终局。',
    tags: ['9×9', '围地计数', '白贴 6.5 目'],
    sides: ['⚫ 黑棋（先手）', '⚪ 白棋（后手）'],
    rules: '① 双方轮流落子，围住对方棋子使其无气即可提走；② 禁止自杀与全局同形重复（打劫）；③ 双方连续停一手即终局，数子计算胜负（黑贴 6.5 目）；④ 「停一手」按钮在棋多了想收官时使用。',
    guide: '① 围空比吃子重要：先占地盘再谈战斗；② 棋子要连成片，落单的棋子容易被围死；③ 「金角银边草肚皮」——角上围空效率最高；④ 提子前确认这口气堵上后对方真的无路可逃。',
    tip: '棋子靠“气”存活，气被全部堵住就会被提掉。终局用数子法：自己的棋子 + 围住的空点，白棋额外加 6.5 目。',
    mount: mount
  };
})(window);
