/* 数字华容道：3×3 / 4×4 / 5×5
   从完成态随机走子打乱（天然保证有解），计数步数与用时 */
(function (global) {
  var BK = global.BoardKit;

  function mount(host, api) {
    var S = null, bk = null, timer = null;

    function startTimer() {
      stopTimer();
      timer = setInterval(function () {
        if (!S || S.over) return;
        S.sec = Math.floor((Date.now() - S.t0) / 1000);
        update();
      }, 1000);
    }
    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
    function elapsed() { return S.over ? S.sec : Math.floor((Date.now() - S.t0) / 1000); }
    function fmtTime(s) { var m = (s / 60) | 0; return m + ':' + ('0' + (s % 60)).slice(-2); }

    function solved(n) {
      var t = new Array(n * n);
      for (var i = 0; i < n * n - 1; i++) t[i] = i + 1;
      t[n * n - 1] = 0;
      return t;
    }

    /* 从完成态随机走 N 步打乱（不走回头路），保证可解 */
    function scramble(n) {
      var t = solved(n), blank = n * n - 1, prev = -1;
      var steps = n * n * 24;
      for (var k = 0; k < steps; k++) {
        var nbrs = neighbors(n, blank).filter(function (p) { return p !== prev; });
        var pick = nbrs[(Math.random() * nbrs.length) | 0];
        t[blank] = t[pick]; t[pick] = 0;
        prev = blank; blank = pick;
      }
      return t;
    }

    function neighbors(n, p) {
      var r = (p / n) | 0, c = p % n, out = [];
      if (r > 0) out.push(p - n);
      if (r < n - 1) out.push(p + n);
      if (c > 0) out.push(p - 1);
      if (c < n - 1) out.push(p + 1);
      return out;
    }

    function manhattan(t, n) {
      var d = 0;
      for (var i = 0; i < t.length; i++) {
        var v = t[i];
        if (!v) continue;
        var goal = v - 1;
        d += Math.abs(((i / n) | 0) - ((goal / n) | 0)) + Math.abs((i % n) - (goal % n));
      }
      return d;
    }

    function newGame(n) {
      S = { n: n, tiles: scramble(n), blank: 0, moves: 0, sec: 0, t0: Date.now(), over: false, hist: [], hintTile: -1, last: -1, anim: null };
      S.blank = S.tiles.indexOf(0);
      startTimer();
      update();
    }

    function slide(p, record) {
      var t = S.tiles, nb = neighbors(S.n, S.blank);
      if (nb.indexOf(p) < 0) return false;
      if (record) S.hist.push(S.blank);
      var from = p, to = S.blank;
      t[S.blank] = t[p]; t[p] = 0;
      S.last = p; S.blank = p; S.hintTile = -1;
      S.moves++;
      Sfx.move();
      /* 滑动动画：让移动的块从原格平滑滑入空格 */
      S.anim = { piece: t[to], from: from, to: to, t0: Date.now() };
      animate();
      after();
      return true;
    }

    function animate() {
      if (!S || !S.anim) return;
      bk.redraw();
      if (Date.now() - S.anim.t0 < 140) requestAnimationFrame(animate);
      else { S.anim = null; bk.redraw(); }
    }

    function after() {
      update();
      var win = true;
      for (var i = 0; i < S.tiles.length - 1; i++) if (S.tiles[i] !== i + 1) { win = false; break; }
      if (win) {
        S.over = true; S.sec = elapsed(); stopTimer();
        var isRec = global.Store && Store.setBest('slide.moves.' + S.n, S.moves, true);
        var best = global.Store ? Store.getBest('slide.moves.' + S.n) : null;
        api.over('win', {
          moves: S.moves, sec: S.sec, score: S.n + '×' + S.n + ' · 最佳 ' + best + ' 步',
          newRecord: isRec ? S.n + '×' + S.n + ' 最少步数新纪录：' + S.moves + ' 步' : ''
        });
      }
    }

    function update() {
      if (!S) return;
      var near = nearDone();
      api.status(S.over ? '完成！' + S.moves + ' 步 · ' + fmtTime(S.sec)
        : (near ? '就快好了！' : '') + S.moves + ' 步 · ' + fmtTime(elapsed()));
      var bestMove = global.Store ? Store.getBest('slide.moves.' + S.n) : null;
      api.info(
        '盘面：<b>' + S.n + '×' + S.n + '</b>　步数：<b>' + S.moves + '</b>' +
        (bestMove ? '　🏆 本机最佳：<b>' + bestMove + '</b> 步' : '') + '<br>' +
        '目标：把数字按 <b>1 → ' + (S.n * S.n - 1) + '</b> 从左到右、从上到下排好。<br>' +
        '点空格旁边的块，或直接<b>往滑的方向刷</b>，想好再动哦！'
      );
      api.changed();
      if (bk) bk.redraw();
    }

    function nearDone() {
      if (!S) return false;
      var n = S.n, ok = 0;
      for (var i = 0; i < n * n - 1; i++) if (S.tiles[i] === i + 1) ok++;
      return ok >= n * n - 1 - Math.max(2, n);
    }

    function draw(g, W, H, C) {
      if (!S) return;
      var n = S.n, cell = W / n, gap = Math.max(2, cell * 0.045);
      for (var i = 0; i < S.tiles.length; i++) {
        var v = S.tiles[i];
        if (!v) continue;
        var r = (i / n) | 0, c = i % n;
        var x = c * cell + gap, y = r * cell + gap, w = cell - gap * 2;
        /* 滑动动画：正在移动的块按缓动插值绘制 */
        if (S.anim && v === S.anim.piece) {
          var prog = Math.min(1, (Date.now() - S.anim.t0) / 140);
          prog = 1 - (1 - prog) * (1 - prog); /* easeOut */
          var fr = (S.anim.from / n) | 0, fc = S.anim.from % n;
          var tr = (S.anim.to / n) | 0, tc = S.anim.to % n;
          x = (fc + (tc - fc) * prog) * cell + gap;
          y = (fr + (tr - fr) * prog) * cell + gap;
        }
        var hue = 205 - (v / (n * n)) * 160;
        g.save();
        g.shadowColor = 'rgba(40,70,120,.25)'; g.shadowBlur = cell * 0.06; g.shadowOffsetY = cell * 0.03;
        g.fillStyle = 'hsl(' + hue + ',72%,' + (62 + (v % 2) * 4) + '%)';
        BK.roundRect(g, x, y, w, w, w * 0.18); g.fill();
        g.restore();
        if (i === S.hintTile) {
          g.lineWidth = Math.max(2, w * 0.06);
          g.strokeStyle = '#ff9800';
          BK.roundRect(g, x + 2, y + 2, w - 4, w - 4, w * 0.16); g.stroke();
        }
        if (i === S.last && S.hintTile < 0) {
          g.lineWidth = Math.max(1.5, w * 0.045);
          g.strokeStyle = 'rgba(255,255,255,.85)';
          BK.roundRect(g, x + 2, y + 2, w - 4, w - 4, w * 0.16); g.stroke();
        }
        g.fillStyle = '#fff';
        g.font = '800 ' + Math.round(w * 0.46) + 'px "PingFang SC","Microsoft YaHei",sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(v), x + w / 2, y + w / 2 + w * 0.03);
      }
    }

    var swSuppressUntil = 0; /* 滑动手势后短暂抑制 click，防止一次滑动算两步 */
    bk = BK.create(host, {
      aspect: 1,
      draw: draw,
      click: function (x, y, W) {
        if (!S || S.over) return;
        if (Date.now() < swSuppressUntil) return;
        var cell = W / S.n, c = (x / cell) | 0, r = (y / cell) | 0;
        if (c < 0 || r < 0 || c >= S.n || r >= S.n) return;
        slide(r * S.n + c, true);
      }
    });
    /* 滑动手势：往哪个方向滑，相邻的块就往空格滑过去 */
    var slideCv = host.querySelector('canvas');
    if (slideCv) {
      slideCv.style.touchAction = 'none';
      var swX = 0, swY = 0, swOn = false;
      slideCv.addEventListener('pointerdown', function (e) { swX = e.clientX; swY = e.clientY; swOn = true; });
      slideCv.addEventListener('pointerup', function (e) {
        if (!swOn) return;
        swOn = false;
        var dx = e.clientX - swX, dy = e.clientY - swY;
        if (Math.abs(dx) + Math.abs(dy) < 28) return;
        if (!S || S.over) return;
        swSuppressUntil = Date.now() + 450;
        var dcol = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? -1 : 1) : 0;   /* 往左滑＝右边的块滑进来 */
        var drow = dcol === 0 ? (dy > 0 ? -1 : 1) : 0;
        var br = (S.blank / S.n) | 0, bc = S.blank % S.n;
        var tr = br + drow, tc = bc + dcol;
        if (tr < 0 || tc < 0 || tr >= S.n || tc >= S.n) return;
        slide(tr * S.n + tc, true);
      });
    }

    update();

    return {
      restart: function (o) {
        var n = Number(o && o.side) || (S ? S.n : 3);
        if ([3, 4, 5].indexOf(n) < 0) n = 3;
        newGame(n);
      },
      restore: function (data) {
        try {
          if (!data || !data.tiles || [3, 4, 5].indexOf(data.n) < 0 || data.tiles.length !== data.n * data.n) return false;
          var sorted = data.tiles.slice().sort(function (a, b) { return a - b; });
          for (var i = 0; i < sorted.length; i++) if (sorted[i] !== i) return false;
          S = {
            n: data.n, tiles: data.tiles.slice(), blank: data.tiles.indexOf(0),
            moves: data.moves || 0, sec: data.sec || 0, over: !!data.over,
            t0: Date.now() - (data.sec || 0) * 1000, hist: [], hintTile: -1, last: -1
          };
          if (S.over) { update(); return true; }
          startTimer();
          update();
          return true;
        } catch (e) { return false; }
      },
      serialize: function () {
        if (!S) return null;
        return { v: 1, kind: 'slide', n: S.n, tiles: S.tiles, moves: S.moves, sec: elapsed(), over: S.over, ts: Date.now() };
      },
      undo: function () {
        if (!S || S.over || !S.hist.length) return;
        var b = S.hist.pop();
        var t = S.tiles;
        t[S.blank] = t[b]; t[b] = 0;
        S.last = b; S.blank = b; S.hintTile = -1;
        S.moves = Math.max(0, S.moves - 1);
        Sfx.click();
        update();
      },
      hint: function () {
        if (!S || S.over) return;
        var best = -1, bestD = 1e9;
        neighbors(S.n, S.blank).forEach(function (p) {
          var t = S.tiles.slice();
          t[S.blank] = t[p]; t[p] = 0;
          var d = manhattan(t, S.n);
          if (d < bestD) { bestD = d; best = p; }
        });
        if (best >= 0) {
          S.hintTile = best;
          api.toast('把 ' + S.tiles[best] + ' 号滑进空格，会更接近目标！');
          bk.redraw();
        }
      },
      resign: function () {
        if (!S || S.over) return;
        S.over = true; S.sec = elapsed(); stopTimer();
        S.tiles = solved(S.n); S.blank = S.tiles.indexOf(0);
        update();
        api.over('lose', { moves: S.moves, sec: S.sec, score: S.n + '×' + S.n });
      },
      redraw: function () { if (bk) bk.redraw(); },
      destroy: function () {
        stopTimer();
        if (bk) { try { bk.destroy(); } catch (e) {} bk = null; }
      }
    };
  }

  global.Games = global.Games || {};
  global.Games.slide = {
    stageType: 'puzzle',
    cat: 'puzzle',
    emoji: '🧩',
    name: '数字华容道',
    desc: '滑动数字块，把 1 排到末尾！锻炼空间规划力，从 3×3 一路挑战 5×5。',
    tags: ['3×3/4×4/5×5', '空间思维', '步步必解'],
    rules: '① 点数字块，它会滑进旁边的空位；② 目标：把数字排成 1、2、3……从左到右从上到下；③ 打乱由完成态走步而来，必定可以复原；④ 步数越少越厉害，卡住可「悔棋」。',
    guide: '① 先复原第一行和第一列（外圈），再处理内部；② 让目标块贴着空格走「直线」，避免绕远；③ 移动时想两步：这一步会不会把已复原的块挤走；④ 3×3 以上建议按 1、2、3 / 4、5、6 分行攻克。',
    tip: '先拼好第一行和第一列，再在剩下的区域里转，就不会乱。',
    single: true,
    noLevel: true,
    sideOptions: [['3', '3×3 入门'], ['4', '4×4 进阶'], ['5', '5×5 挑战']],
    mount: mount
  };
})(window);
