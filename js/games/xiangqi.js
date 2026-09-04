/* 中国象棋：10×9 棋盘，红先。
   规则：完整走子（含马腿、象眼、炮翻山、兵过河、士将限九宫）、将帅照面、自杀手非法、无棋可走判负。
   引擎：Alpha-Beta + 子力位置表 + 走法排序 + 迭代加深，三档难度。 */
(function (global) {
  var RED = 1, BLACK = 2;
  var K = 1, A = 2, B = 3, N = 4, R = 5, C = 6, P = 7;

  function sideOf(p) { return p === 0 ? 0 : (p < 8 ? RED : BLACK); }
  function kindOf(p) { return p & 7; }
  function mk(side, kind) { return side === RED ? kind : kind + 8; }
  function row(i) { return (i / 9) | 0; }
  function col(i) { return i % 9; }

  var VALUE = { 1: 6000, 2: 120, 3: 120, 4: 270, 5: 600, 6: 285, 7: 60 };
  var NAME = {
    1: ['帅', '将'], 2: ['仕', '士'], 3: ['相', '象'], 4: ['马', '馬'],
    5: ['车', '車'], 6: ['炮', '砲'], 7: ['兵', '卒']
  };

  /* 位置价值表（红方视角，第 0 行 = 对方底线；黑方按行镜像） */
  function T(rows) { var a = []; rows.forEach(function (r) { a = a.concat(r); }); return a; }
  var PST = {};
  PST[P] = T([
    [9, 9, 9, 11, 13, 11, 9, 9, 9],
    [19, 24, 34, 42, 44, 42, 34, 24, 19],
    [19, 24, 32, 37, 37, 37, 32, 24, 19],
    [19, 23, 27, 29, 30, 29, 27, 23, 19],
    [14, 18, 20, 27, 29, 27, 20, 18, 14],
    [7, 0, 13, 0, 16, 0, 13, 0, 7],
    [7, 0, 7, 0, 15, 0, 7, 0, 7],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0]
  ]);
  PST[N] = T([
    [4, 8, 16, 12, 4, 12, 16, 8, 4],
    [4, 10, 28, 16, 8, 16, 28, 10, 4],
    [12, 14, 16, 20, 18, 20, 16, 14, 12],
    [8, 24, 18, 24, 20, 24, 18, 24, 8],
    [6, 16, 14, 18, 16, 18, 14, 16, 6],
    [4, 12, 16, 14, 12, 14, 16, 12, 4],
    [2, 6, 8, 6, 10, 6, 8, 6, 2],
    [4, 2, 8, 8, 4, 8, 8, 2, 4],
    [0, 2, 4, 4, -2, 4, 4, 2, 0],
    [0, -4, 0, 0, 0, 0, 0, -4, 0]
  ]);
  PST[R] = T([
    [14, 14, 12, 18, 16, 18, 12, 14, 14],
    [16, 20, 18, 24, 26, 24, 18, 20, 16],
    [12, 12, 12, 18, 18, 18, 12, 12, 12],
    [12, 18, 16, 22, 22, 22, 16, 18, 12],
    [12, 14, 12, 18, 18, 18, 12, 14, 12],
    [12, 16, 14, 20, 20, 20, 14, 16, 12],
    [6, 10, 8, 14, 14, 14, 8, 10, 6],
    [4, 8, 6, 14, 12, 14, 6, 8, 4],
    [8, 4, 8, 16, 8, 16, 8, 4, 8],
    [-2, 10, 6, 14, 12, 14, 6, 10, -2]
  ]);
  PST[C] = T([
    [6, 4, 0, -10, -12, -10, 0, 4, 6],
    [2, 2, 0, -4, -14, -4, 0, 2, 2],
    [2, 2, 0, -10, -8, -10, 0, 2, 2],
    [0, 0, -2, 4, 10, 4, -2, 0, 0],
    [0, 0, 0, 2, 8, 2, 0, 0, 0],
    [-2, 0, 4, 2, 6, 2, 4, 0, -2],
    [0, 0, 0, 2, 4, 2, 0, 0, 0],
    [4, 0, 8, 6, 10, 6, 8, 0, 4],
    [0, 2, 4, 6, 6, 6, 4, 2, 0],
    [0, 0, 2, 6, 6, 6, 2, 0, 0]
  ]);
  PST[B] = T([
    [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 6, 0, 0, 0, 6, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0]
  ]);
  PST[K] = T([
    [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 2, 0, 0, 0, 0],
    [0, 0, 0, 2, 4, 2, 0, 0, 0], [0, 0, 0, 4, 6, 4, 0, 0, 0]
  ]);
  PST[A] = new Array(90).fill(0);

  function initialBoard() {
    var b = new Int8Array(90);
    var back = [R, N, B, A, K, A, B, N, R];
    for (var c = 0; c < 9; c++) {
      b[c] = mk(BLACK, back[c]);
      b[81 + c] = mk(RED, back[c]);
    }
    b[2 * 9 + 1] = mk(BLACK, C); b[2 * 9 + 7] = mk(BLACK, C);
    b[7 * 9 + 1] = mk(RED, C); b[7 * 9 + 7] = mk(RED, C);
    [0, 2, 4, 6, 8].forEach(function (c) {
      b[3 * 9 + c] = mk(BLACK, P);
      b[6 * 9 + c] = mk(RED, P);
    });
    return b;
  }

  function inPalace(r, c, side) {
    if (c < 3 || c > 5) return false;
    return side === RED ? (r >= 7 && r <= 9) : (r >= 0 && r <= 2);
  }
  function ownHalf(r, side) { return side === RED ? r >= 5 : r <= 4; }
  function findKing(bd, side) {
    var k = mk(side, K);
    for (var i = 0; i < 90; i++) if (bd[i] === k) return i;
    return -1;
  }
  function kingsFacing(bd) {
    var kr = findKing(bd, RED), kb = findKing(bd, BLACK);
    if (kr < 0 || kb < 0) return false;
    if (col(kr) !== col(kb)) return false;
    var c = col(kr), a = Math.min(row(kr), row(kb)) + 1, z = Math.max(row(kr), row(kb));
    for (var r = a; r < z; r++) if (bd[r * 9 + c]) return false;
    return true;
  }

  var HORSE = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  var ELEPH = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
  var ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  var DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  /* 将/帅所在格是否被攻击（不含照面，照面单独判断） */
  function kingAttacked(bd, side) {
    var k = findKing(bd, side);
    if (k < 0) return true;
    var r = row(k), c = col(k), i, p, kk, ss, d, dr, dc, rr, cc, first;

    for (d = 0; d < 4; d++) {
      dr = ORTHO[d][0]; dc = ORTHO[d][1];
      rr = r + dr; cc = c + dc; first = false;
      while (rr >= 0 && rr < 10 && cc >= 0 && cc < 9) {
        p = bd[rr * 9 + cc];
        if (p) {
          if (!first) {
            first = true;
            kk = kindOf(p); ss = sideOf(p);
            if (ss !== side && (kk === R || kk === K)) return true;
          } else {
            kk = kindOf(p); ss = sideOf(p);
            if (ss !== side && kk === C) return true;
            break;
          }
        }
        rr += dr; cc += dc;
      }
    }
    for (i = 0; i < 8; i++) {
      dr = HORSE[i][0]; dc = HORSE[i][1];
      rr = r + dr; cc = c + dc;
      if (rr < 0 || rr > 9 || cc < 0 || cc > 8) continue;
      var lr = r + (Math.abs(dr) === 2 ? dr / 2 : dr);
      var lc = c + (Math.abs(dc) === 2 ? dc / 2 : dc);
      if (bd[lr * 9 + lc]) continue;
      p = bd[rr * 9 + cc];
      if (p && sideOf(p) !== side && kindOf(p) === N) return true;
    }
    var opp = 3 - side;
    var fwd = opp === BLACK ? -1 : 1;
    rr = r + fwd;
    if (rr >= 0 && rr < 10) {
      p = bd[rr * 9 + c];
      if (p && sideOf(p) === opp && kindOf(p) === P) return true;
    }
    for (d = -1; d <= 1; d += 2) {
      cc = c + d;
      if (cc < 0 || cc > 8) continue;
      p = bd[r * 9 + cc];
      if (p && sideOf(p) === opp && kindOf(p) === P) return true;
    }
    return false;
  }

  function pseudoMoves(bd, side) {
    var out = [], i, p, kk, r, c, d, dr, dc, rr, cc, t, j;
    for (i = 0; i < 90; i++) {
      p = bd[i];
      if (!p || sideOf(p) !== side) continue;
      kk = kindOf(p); r = row(i); c = col(i);
      switch (kk) {
        case K:
          for (d = 0; d < 4; d++) {
            rr = r + ORTHO[d][0]; cc = c + ORTHO[d][1];
            if (!inPalace(rr, cc, side)) continue;
            t = rr * 9 + cc;
            if (!bd[t] || sideOf(bd[t]) !== side) out.push({ from: i, to: t });
          }
          break;
        case A:
          for (d = 0; d < 4; d++) {
            rr = r + DIAG[d][0]; cc = c + DIAG[d][1];
            if (!inPalace(rr, cc, side)) continue;
            t = rr * 9 + cc;
            if (!bd[t] || sideOf(bd[t]) !== side) out.push({ from: i, to: t });
          }
          break;
        case B:
          for (d = 0; d < 4; d++) {
            rr = r + ELEPH[d][0]; cc = c + ELEPH[d][1];
            if (rr < 0 || rr > 9 || cc < 0 || cc > 8) continue;
            if (!ownHalf(rr, side)) continue;                       /* 不能过河 */
            if (bd[(r + ELEPH[d][0] / 2) * 9 + (c + ELEPH[d][1] / 2)]) continue;  /* 塞象眼 */
            t = rr * 9 + cc;
            if (!bd[t] || sideOf(bd[t]) !== side) out.push({ from: i, to: t });
          }
          break;
        case N:
          for (d = 0; d < 8; d++) {
            rr = r + HORSE[d][0]; cc = c + HORSE[d][1];
            if (rr < 0 || rr > 9 || cc < 0 || cc > 8) continue;
            var lr2 = r + (Math.abs(HORSE[d][0]) === 2 ? HORSE[d][0] / 2 : 0);
            var lc2 = c + (Math.abs(HORSE[d][1]) === 2 ? HORSE[d][1] / 2 : 0);
            if (bd[lr2 * 9 + lc2]) continue;                        /* 蹩马腿 */
            t = rr * 9 + cc;
            if (!bd[t] || sideOf(bd[t]) !== side) out.push({ from: i, to: t });
          }
          break;
        case R:
          for (d = 0; d < 4; d++) {
            dr = ORTHO[d][0]; dc = ORTHO[d][1];
            rr = r + dr; cc = c + dc;
            while (rr >= 0 && rr < 10 && cc >= 0 && cc < 9) {
              t = rr * 9 + cc;
              if (!bd[t]) out.push({ from: i, to: t });
              else { if (sideOf(bd[t]) !== side) out.push({ from: i, to: t }); break; }
              rr += dr; cc += dc;
            }
          }
          break;
        case C:
          for (d = 0; d < 4; d++) {
            dr = ORTHO[d][0]; dc = ORTHO[d][1];
            rr = r + dr; cc = c + dc; j = 0;
            while (rr >= 0 && rr < 10 && cc >= 0 && cc < 9) {
              t = rr * 9 + cc;
              if (!bd[t]) { if (!j) out.push({ from: i, to: t }); }
              else {
                j++;
                if (j === 2) { if (sideOf(bd[t]) !== side) out.push({ from: i, to: t }); break; }
              }
              rr += dr; cc += dc;
            }
          }
          break;
        case P:
          var fwd2 = side === RED ? -1 : 1;
          rr = r + fwd2;
          if (rr >= 0 && rr < 10) {
            t = rr * 9 + c;
            if (!bd[t] || sideOf(bd[t]) !== side) out.push({ from: i, to: t });
          }
          if (!ownHalf(r, side)) {                                  /* 过河后可横走 */
            for (d = -1; d <= 1; d += 2) {
              cc = c + d;
              if (cc < 0 || cc > 8) continue;
              t = r * 9 + cc;
              if (!bd[t] || sideOf(bd[t]) !== side) out.push({ from: i, to: t });
            }
          }
          break;
      }
    }
    return out;
  }

  function legalMoves(bd, side) {
    var pm = pseudoMoves(bd, side), out = [];
    for (var i = 0; i < pm.length; i++) {
      var m = pm[i], cap = bd[m.to];
      bd[m.to] = bd[m.from]; bd[m.from] = 0;
      var bad = kingsFacing(bd) || kingAttacked(bd, side);
      bd[m.from] = bd[m.to]; bd[m.to] = cap;
      if (!bad) out.push(m);
    }
    return out;
  }

  function inCheck(bd, side) { return kingAttacked(bd, side) || kingsFacing(bd); }

  function evaluate(bd, side) {
    var s = 0;
    for (var i = 0; i < 90; i++) {
      var p = bd[i];
      if (!p) continue;
      var kk = kindOf(p), sd = sideOf(p), r = row(i), c = col(i);
      var ti = sd === RED ? i : (9 - r) * 9 + c;
      var v = VALUE[kk] + PST[kk][ti];
      s += sd === RED ? v : -v;
    }
    return side === RED ? s : -s;
  }

  /* ---------- 搜索 ---------- */
  var MATE = 100000;
  var deadline = 0, aborted = false, nodes = 0;

  function orderMoves(bd, moves) {
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i], s = 0;
      if (bd[m.to]) s = VALUE[kindOf(bd[m.to])] * 8 - VALUE[kindOf(bd[m.from])];
      m.s = s;
    }
    moves.sort(function (a, b) { return b.s - a.s; });
    return moves;
  }

  function negamax(bd, side, depth, alpha, beta, ply, ext) {
    if (aborted) return 0;
    if ((++nodes & 511) === 0 && Date.now() > deadline) { aborted = true; return 0; }
    if (depth <= 0) {
      /* 被将军时延伸一层，避免地平线误判（最多延伸 3 层） */
      if (kingAttacked(bd, side) && ext < 3) { depth = 1; ext++; }
      else return evaluate(bd, side);
    }
    var moves = legalMoves(bd, side);
    if (!moves.length) return -MATE + ply;         /* 无棋可走 = 负 */
    orderMoves(bd, moves);
    var best = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i], cap = bd[m.to];
      bd[m.to] = bd[m.from]; bd[m.from] = 0;
      var v = -negamax(bd, 3 - side, depth - 1, -beta, -alpha, ply + 1, ext);
      bd[m.from] = bd[m.to]; bd[m.to] = cap;
      if (aborted) return 0;
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  var LEVELS = {
    easy: { max: 1, time: 250, noise: 160, rand: 0.4 },
    normal: { max: 3, time: 600, noise: 45, rand: 0.06 },
    hard: { max: 5, time: 1200, noise: 0, rand: 0 }
  };

  function think(bd0, side, level) {
    var bd = Int8Array.from(bd0);
    var cfg = LEVELS[level] || LEVELS.normal;
    var moves = legalMoves(bd, side);
    if (!moves.length) return null;

    if (cfg.rand && Math.random() < cfg.rand) {
      return moves[(Math.random() * moves.length) | 0];
    }

    orderMoves(bd, moves);
    deadline = Date.now() + cfg.time;
    aborted = false; nodes = 0;

    var best = moves[0], bestVal = -Infinity;
    for (var d = 1; d <= cfg.max; d++) {
      var localBest = null, localVal = -Infinity, alpha = -Infinity;
      var list = best ? [best].concat(moves.filter(function (m) { return m !== best; })) : moves;
      for (var i = 0; i < list.length; i++) {
        var m = list[i], cap = bd[m.to];
        bd[m.to] = bd[m.from]; bd[m.from] = 0;
        var v = -negamax(bd, 3 - side, d - 1, -Infinity, -alpha, 1, 0);
        bd[m.from] = bd[m.to]; bd[m.to] = cap;
        if (aborted) break;
        v += (Math.random() - 0.5) * cfg.noise;
        if (v > localVal) { localVal = v; localBest = m; }
        if (v > alpha) alpha = v;
      }
      if (localBest && (!aborted || localVal > -Infinity)) {
        best = localBest; bestVal = localVal;
      }
      if (aborted) break;
    }
    return { from: best.from, to: best.to };
  }

  /* ---------- 游戏实例 ---------- */
  function mount(host, api) {
    var G = {
      board: initialBoard(), turn: RED, over: false, winner: 0,
      history: [], snaps: [], sel: -1, moves: [], last: null,
      noCapture: 0, reps: {}, startTs: Date.now(), checkSide: 0
    };
    var human = api.getSide(), mode = api.getMode(), level = api.getLevel();
    var aiSide = human === RED ? BLACK : RED;
    var bk = null, thinking = false, cell = 30, ox = 0, oy = 0;

    function reset() {
      G.board = initialBoard(); G.turn = RED; G.over = false; G.winner = 0;
      G.history = []; G.snaps = []; G.sel = -1; G.moves = []; G.last = null;
      G.noCapture = 0; G.reps = {}; G.startTs = Date.now(); G.checkSide = 0;
      countRep();
    }
    function key() { return Array.prototype.join.call(G.board, '') + '|' + G.turn; }
    function countRep() { var k = key(); G.reps[k] = (G.reps[k] || 0) + 1; return G.reps[k]; }
    function snap() {
      G.snaps.push({
        b: Array.prototype.slice.call(G.board), t: G.turn, l: G.last,
        nc: G.noCapture, r: JSON.parse(JSON.stringify(G.reps))
      });
      if (G.snaps.length > 300) G.snaps.shift();
    }
    function sname(s) { return s === RED ? '❤️ 红方' : '🖤 黑方'; }

    function update() {
      var st;
      if (G.over) st = G.winner === 0 ? '和棋' : sname(G.winner) + '获胜！';
      else st = sname(G.turn) + '走棋' + (inCheck(G.board, G.turn) ? '（被将军！）' : '');
      api.status(st);
      api.info('回合：<b>' + (Math.floor(G.history.length / 2) + 1) + '</b>　难度：<b>' +
        ({ easy: '简单', normal: '一般', hard: '困难' })[level] + '</b><br>' +
        '你执：<b>' + (human === RED ? '红（先手）' : '黑（后手）') + '</b><br>' +
        '规则：将帅照面、无棋可走均判负');
      if (bk) bk.redraw();
      api.changed();
    }

    function finish(winner) {
      G.over = true; G.winner = winner;
      update();
      api.over(winner === 0 ? 'draw' : (winner === human ? 'win' : 'lose'),
        { moves: G.history.length, sec: Math.round((Date.now() - G.startTs) / 1000) });
    }

    function doMove(mv) {
      var cap = G.board[mv.to];
      snap();
      G.board[mv.to] = G.board[mv.from];
      G.board[mv.from] = 0;
      G.last = mv; G.history.push(mv); G.sel = -1; G.moves = [];
      G.noCapture = cap ? 0 : G.noCapture + 1;
      if (cap) Sfx.capture(); else Sfx.move();

      var opp = 3 - G.turn;
      var oppMoves = legalMoves(G.board, opp);
      if (!oppMoves.length) { finish(G.turn); return; }               /* 将死 / 困毙 */
      if (G.noCapture >= 120) { finish(0); return; }
      var n = countRep();
      if (n >= 3) { finish(0); return; }
      if (!findKing(G.board, RED) || !findKing(G.board, BLACK)) { finish(G.turn); return; }

      G.turn = opp;
      update();
    }

    function aiTurn() {
      if (G.over || mode !== 'pve' || G.turn !== aiSide) return;
      thinking = true; api.busy(true); api.status('🤖 电脑思考中…'); if (bk) bk.redraw();
      setTimeout(function () {
        var mv = null;
        try { mv = think(G.board, aiSide, level); } catch (e) { mv = null; }
        thinking = false; api.busy(false);
        if (!mv) { finish(3 - aiSide); return; }
        doMove(mv);
      }, 60);
    }

    function draw(ctx, W, H, C) {
      var padR = 0.62;
      cell = Math.min(W / (8 + padR * 2), H / (9 + padR * 2));
      var bw = cell * 8, bh = cell * 9;
      ox = (W - bw) / 2; oy = (H - bh) / 2;
      var X = function (c) { return ox + c * cell; };
      var Y = function (r) { return oy + r * cell; };

      ctx.fillStyle = C.board;
      BoardKit.roundRect(ctx, ox - cell * 0.55, oy - cell * 0.55, bw + cell * 1.1, bh + cell * 1.1, 12);
      ctx.fill();
      ctx.strokeStyle = C.boardEdge; ctx.lineWidth = 3; ctx.stroke();

      ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
      ctx.beginPath();
      for (var r = 0; r < 10; r++) { ctx.moveTo(X(0), Y(r)); ctx.lineTo(X(8), Y(r)); }
      for (var c = 0; c < 9; c++) {
        if (c === 0 || c === 8) { ctx.moveTo(X(c), Y(0)); ctx.lineTo(X(c), Y(9)); }
        else { ctx.moveTo(X(c), Y(0)); ctx.lineTo(X(c), Y(4)); ctx.moveTo(X(c), Y(5)); ctx.lineTo(X(c), Y(9)); }
      }
      /* 九宫斜线 */
      ctx.moveTo(X(3), Y(0)); ctx.lineTo(X(5), Y(2));
      ctx.moveTo(X(5), Y(0)); ctx.lineTo(X(3), Y(2));
      ctx.moveTo(X(3), Y(7)); ctx.lineTo(X(5), Y(9));
      ctx.moveTo(X(5), Y(7)); ctx.lineTo(X(3), Y(9));
      ctx.stroke();
      ctx.strokeRect(X(0), Y(0), bw, bh);

      /* 河界 */
      ctx.fillStyle = C.grid;
      ctx.font = 'bold ' + Math.round(cell * 0.52) + 'px "KaiTi","STKaiti","SimSun",serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('楚 河', X(2), (Y(4) + Y(5)) / 2);
      ctx.fillText('汉 界', X(6), (Y(4) + Y(5)) / 2);

      /* 炮位/兵位标记 */
      var marks = [[2, 1], [2, 7], [7, 1], [7, 7], [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [6, 0], [6, 2], [6, 4], [6, 6], [6, 8]];
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1.5;
      marks.forEach(function (m) {
        var mx = X(m[1]), my = Y(m[0]), g = cell * 0.09, l = cell * 0.2;
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (s) {
          var ex = mx + s[0] * (g + l);
          if (ex < X(0) - 0.5 || ex > X(8) + 0.5) return;   /* 边线只画内侧标记 */
          ctx.beginPath();
          ctx.moveTo(mx + s[0] * g, my + s[1] * (g + l)); ctx.lineTo(mx + s[0] * g, my + s[1] * g);
          ctx.lineTo(mx + s[0] * (g + l), my + s[1] * g);
          ctx.stroke();
        });
      });

      /* 上一手 */
      if (G.last) {
        ctx.strokeStyle = C.last; ctx.lineWidth = Math.max(2, cell * 0.06);
        ctx.strokeRect(X(col(G.last.from)) - cell * 0.45, Y(row(G.last.from)) - cell * 0.45, cell * 0.9, cell * 0.9);
        ctx.strokeRect(X(col(G.last.to)) - cell * 0.45, Y(row(G.last.to)) - cell * 0.45, cell * 0.9, cell * 0.9);
      }
      /* 选中与可走点 */
      if (G.sel >= 0) {
        G.moves.forEach(function (t) {
          ctx.beginPath();
          ctx.arc(X(col(t)), Y(row(t)), cell * 0.18, 0, Math.PI * 2);
          ctx.fillStyle = G.board[t] ? 'rgba(255,90,80,.55)' : 'rgba(57,184,120,.6)';
          ctx.fill();
        });
      }

      /* 棋子 */
      for (var i = 0; i < 90; i++) {
        var p = G.board[i];
        if (!p) continue;
        var sd = sideOf(p), kk = kindOf(p);
        var x = X(col(i)), y = Y(row(i)), rad = cell * 0.42;
        ctx.beginPath(); ctx.arc(x, y + cell * 0.05, rad, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fill();
        var g2 = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.35, rad * 0.1, x, y, rad);
        var base = sd === RED ? C.red : C.blue;
        g2.addColorStop(0, BoardKit.lighten(base, 55));
        g2.addColorStop(1, BoardKit.darken(base, 25));
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fillStyle = g2; ctx.fill();
        ctx.lineWidth = Math.max(1.2, cell * 0.045);
        ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, rad * 0.78, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(1, cell * 0.03); ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold ' + Math.round(cell * 0.52) + 'px "KaiTi","STKaiti","SimSun",serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(NAME[kk][sd === RED ? 0 : 1], x, y + cell * 0.02);

        if (i === G.sel) {
          ctx.beginPath(); ctx.arc(x, y, rad + cell * 0.08, 0, Math.PI * 2);
          ctx.strokeStyle = C.hi; ctx.lineWidth = Math.max(2, cell * 0.07);
          ctx.setLineDash([cell * 0.16, cell * 0.12]); ctx.stroke(); ctx.setLineDash([]);
        }
        /* 被将军提示 */
        if (kk === K && G.turn === sd && inCheck(G.board, sd)) {
          ctx.beginPath(); ctx.arc(x, y, rad + cell * 0.12, 0, Math.PI * 2);
          ctx.strokeStyle = C.hi; ctx.lineWidth = Math.max(2, cell * 0.06); ctx.stroke();
        }
      }
    }

    function cellAt(px, py) {
      var c = Math.round((px - ox) / cell), r = Math.round((py - oy) / cell);
      if (c < 0 || c > 8 || r < 0 || r > 9) return -1;
      var dx = px - (ox + c * cell), dy = py - (oy + r * cell);
      if (dx * dx + dy * dy > (cell * 0.44) * (cell * 0.44)) return -1;
      return r * 9 + c;
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
      if (G.board[i] && sideOf(G.board[i]) === G.turn) {
        G.sel = i;
        G.moves = legalMoves(G.board, G.turn).filter(function (m) { return m.from === i; })
          .map(function (m) { return m.to; });
        Sfx.click();
        if (bk) bk.redraw();
      } else {
        G.sel = -1; G.moves = []; if (bk) bk.redraw();
      }
    }

    bk = BoardKit.create(host, { aspect: (9 + 1.24) / (8 + 1.24), draw: draw, click: onClick });

    return {
      setLevel: function (l) { level = l; update(); },
      restart: function (o) {
        mode = o.mode; level = o.level; human = o.side;
        aiSide = human === RED ? BLACK : RED;
        reset(); update();
        if (mode === 'pve' && G.turn === aiSide) aiTurn();
      },
      undo: function () {
        if (thinking) return;
        var times = (mode === 'pve' && G.snaps.length >= 2) ? 2 : 1;
        for (var i = 0; i < times; i++) {
          if (!G.snaps.length) break;
          var s = G.snaps.pop();
          G.board = Int8Array.from(s.b); G.turn = s.t; G.last = s.l;
          G.noCapture = s.nc; G.reps = s.r; G.history.pop();
        }
        G.over = false; G.winner = 0; G.sel = -1; G.moves = [];
        update();
      },
      hint: function () {
        if (G.over || thinking) return;
        var mv = think(G.board, G.turn, level === 'easy' ? 'normal' : level);
        if (!mv) return;
        var ctx = bk.ctx, C = BoardKit.colors();
        ctx.save();
        ctx.strokeStyle = C.hi; ctx.lineWidth = Math.max(2, cell * 0.08);
        ctx.setLineDash([cell * 0.16, cell * 0.12]);
        ctx.beginPath();
        ctx.arc(ox + col(mv.from) * cell, oy + row(mv.from) * cell, cell * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ox + col(mv.to) * cell, oy + row(mv.to) * cell, cell * 0.5, 0, Math.PI * 2);
        ctx.stroke(); ctx.restore();
        setTimeout(function () { if (bk) bk.redraw(); }, 1800);
      },
      resign: function () { finish(aiSide); },
      serialize: function () {
        return {
          v: 1, b: Array.prototype.slice.call(G.board), t: G.turn,
          h: G.history.map(function (m) { return [m.from, m.to]; }), nc: G.noCapture,
          mode: mode, level: level, side: human, ts: G.startTs
        };
      },
      restore: function (d) {
        if (!d || !d.b || d.b.length !== 90) return false;
        G.board = Int8Array.from(d.b); G.turn = d.t || RED;
        G.history = (d.h || []).map(function (a) { return { from: a[0], to: a[1] }; });
        G.noCapture = d.nc || 0;
        mode = d.mode || mode; level = d.level || level; human = d.side || human;
        aiSide = human === RED ? BLACK : RED;
        G.snaps = []; G.over = false; G.winner = 0; G.sel = -1; G.moves = [];
        G.last = G.history.length ? G.history[G.history.length - 1] : null;
        G.reps = {}; G.startTs = d.ts || Date.now(); countRep();
        update();
        if (mode === 'pve' && G.turn === aiSide) aiTurn();
        return true;
      },
      destroy: function () { if (bk) bk.destroy(); },
      redraw: function () { if (bk) bk.redraw(); }
    };
  }

  global.Games = global.Games || {};
  global.Games.xiangqi = {
    id: 'xiangqi', name: '象棋', emoji: '♟️',
    desc: '中国象棋完整规则：马腿、象眼、炮翻山、兵过河、将帅不能照面，将死或困毙即负。',
    tags: ['10×9', '完整规则', '将死判负'],
    sides: ['❤️ 红方（先手）', '🖤 黑方（后手）'],
    tip: '车最厉害（约等于两个炮），炮需要“炮架”才能吃子，兵过河后才能横着走。将和帅不能在同一条竖线上直接照面。',
    mount: mount
  };
})(window);
