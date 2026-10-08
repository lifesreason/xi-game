/* 移动拼图：经典"空一格"滑块拼图（幼儿版）。
   一幅小火车图画切成小块并打乱，块只能滑向旁边的空格，
   通过一步步移动把图画复原。打乱方式为"从完成态随机走合法步"，
   天然保证一定可以复原。三档：2×2 / 3×3 / 4×4。 */
(function (global) {
  /* 16 个地标锚点：保证 4×4 切块时每块至少有一个可辨识内容 */
  var SCENE_EMOJIS = [
    ['🌤️', 12, 12], ['☁️', 38, 10], ['🌈', 64, 14], ['🐦', 88, 12],
    ['⛰️', 12, 38], ['🌲', 36, 40], ['🎁', 62, 38], ['🦋', 88, 40],
    ['🚂', 14, 64], ['🛤️', 40, 62], ['🎈', 64, 64], ['🌾', 88, 62],
    ['🌻', 12, 88], ['🍄', 38, 88], ['🐿️', 62, 86], ['🌿', 88, 88]
  ];

  function ri(n) { return (Math.random() * n) | 0; }

  function mount(host, api) {
    var G = { n: 3, pos: [], empty: 0, moves: 0, over: false, startTs: Date.now() };
    /* pos[piece] = 当前格位（只存真实块，不含空格）；empty = 空格格位 */
    var wrap = null, board = null, tileEls = [], holeEl = null;

    function rc(p) { return { r: (p / G.n) | 0, c: p % G.n }; }

    function solvedCount() {
      var k = 0;
      for (var i = 0; i < G.pos.length; i++) if (G.pos[i] === i) k++;
      return k;
    }
    function isSolved() { return solvedCount() === G.pos.length && G.empty === G.n * G.n - 1; }

    function build() {
      if (wrap) wrap.remove();
      wrap = document.createElement('div');
      wrap.className = 'sp-wrap';
      var bar = document.createElement('div');
      bar.className = 'pz-bar';
      bar.innerHTML =
        '<button type="button" class="btn small" id="sp-peek">👁️ 看一眼</button>' +
        '<span class="pz-progress"></span>' +
        '<span></span>';
      wrap.appendChild(bar);

      var picWrap = document.createElement('div');
      picWrap.className = 'pz-picwrap';
      board = document.createElement('div');
      board.className = 'sp-board';
      board.style.setProperty('--n', G.n);
      tileEls = [];
      for (var piece = 0; piece < G.n * G.n - 1; piece++) {
        (function (piece) {
          var t = document.createElement('button');
          t.type = 'button';
          t.className = 'pz-tile sp-tile';
          var scene = document.createElement('div');
          scene.className = 'pz-scene';
          var inner = '';
          for (var i = 0; i < SCENE_EMOJIS.length; i++) {
            var e = SCENE_EMOJIS[i];
            inner += '<span class="pz-el" style="left:' + e[1] + '%;top:' + e[2] + '%">' + e[0] + '</span>';
          }
          scene.innerHTML = inner;
          t.appendChild(scene);
          t.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            tapPiece(piece, e.clientX, e.clientY);
          });
          board.appendChild(t);
          tileEls.push({ el: t, scene: scene });
        })(piece);
      }
      /* 空格凹坑可视化：孩子一眼看出空格在哪 */
      holeEl = document.createElement('div');
      holeEl.className = 'sp-hole';
      board.appendChild(holeEl);
      picWrap.appendChild(board);
      /* 原图预览 */
      var peek = document.createElement('div');
      peek.className = 'pz-peek';
      var fullScene = document.createElement('div');
      fullScene.className = 'pz-scene pz-scene-full';
      fullScene.innerHTML = tileEls[0].scene.innerHTML;
      peek.appendChild(fullScene);
      picWrap.appendChild(peek);
      wrap.appendChild(picWrap);

      var tip = document.createElement('p');
      tip.className = 'muted small pz-tip';
      tip.textContent = '点空格旁边的小块，它就会滑进空格里。一步步把图画复原吧！';
      wrap.appendChild(tip);
      host.appendChild(wrap);

      wrap.querySelector('#sp-peek').onclick = function () {
        Sfx.click();
        peek.classList.add('show');
        global.setTimeout(function () { peek.classList.remove('show'); }, 1800);
      };
      layout();
      render();
    }

    /* 块绝对定位在棋盘上，位置变化由 CSS transition 平滑滑动 */
    function layout() {
      var n = G.n;
      var cellPct = 100 / n;
      for (var piece = 0; piece < G.pos.length; piece++) {
        var p = G.pos[piece];
        var rc = { r: (p / n) | 0, c: p % n };
        var el = tileEls[piece].el;
        el.style.width = cellPct + '%';
        el.style.height = cellPct + '%';
        el.style.transform = 'translate(' + rc.c * 100 + '%,' + rc.r * 100 + '%)';
        var scene = tileEls[piece].scene;
        var sr = (piece / n) | 0, sc = piece % n;
        scene.style.width = n * 100 + '%';
        scene.style.height = n * 100 + '%';
        scene.style.transform = 'translate(-' + (sc * 100 / n) + '%, -' + (sr * 100 / n) + '%)';
        el.classList.toggle('ok', piece === p);
      }
      /* 空格凹坑跟随空格格位 */
      if (holeEl) {
        var er = (G.empty / n) | 0, ec = G.empty % n;
        holeEl.style.width = cellPct + '%';
        holeEl.style.height = cellPct + '%';
        holeEl.style.transform = 'translate(' + ec * 100 + '%,' + er * 100 + '%)';
      }
    }

    function render() {
      layout();
      wrap.querySelector('.pz-progress').textContent = '已归位 ' + solvedCount() + ' / ' + (G.n * G.n - 1) + ' 块 · 走了 ' + G.moves + ' 步';
      api.changed();
    }

    function tapPiece(piece, cx, cy) {
      if (G.over) return;
      var cur = G.pos[piece];
      var er = (G.empty / G.n) | 0, ec = G.empty % G.n;
      var r = (cur / G.n) | 0, c = cur % G.n;
      var adjacent = (Math.abs(r - er) + Math.abs(c - ec)) === 1;
      if (!adjacent) {
        /* 不挨着空格：晃一下点到的块 + 空格凹坑闪一下，让孩子明白原因 */
        Fx.vibrate(6);
        Fx.shake(tileEls[piece].el);
        if (holeEl) {
          holeEl.classList.add('sp-hole-pulse');
          global.setTimeout(function () { holeEl.classList.remove('sp-hole-pulse'); }, 650);
        }
        return;
      }
      var tmp = G.empty;
      G.empty = cur;
      G.pos[piece] = tmp;
      G.moves++;
      Sfx.move();
      Fx.vibrate(10);
      render();
      after();
    }

    function after() {
      update();
      if (isSolved()) {
        G.over = true;
        Fx.confetti({ count: 100 });
        Sfx.win();
        api.over('win', {
          moves: G.moves,
          sec: Math.round((Date.now() - G.startTs) / 1000),
          score: G.n + '×' + G.n + ' · 走 ' + G.moves + ' 步'
        });
      }
    }

    function update() {
      api.status(G.over ? '复原啦！' : '移动拼图 · 已归位 ' + solvedCount() + ' 块');
      api.info('<b>' + G.n + '×' + G.n + ' 移动拼图</b>　走了 <b>' + G.moves + '</b> 步<br>' +
        '只有一个空格，点空格旁边的块让它滑过去。忘记原图就点「👁️ 看一眼」。');
      api.changed();
    }

    function shuffle() {
      var total = G.n * G.n;
      /* 从完成态开始：真实块 piece i 在格 i，空格在最后 */
      G.pos = [];
      for (var i = 0; i < total - 1; i++) G.pos.push(i);
      G.empty = total - 1;
      /* 随机走合法步（不立即回头），保证可解 */
      var steps = total * 10, last = -1;
      for (var s = 0; s < steps; s++) {
        var er = (G.empty / G.n) | 0, ec = G.empty % G.n;
        var cand = [];
        [[er - 1, ec], [er + 1, ec], [er, ec - 1], [er, ec + 1]].forEach(function (rc) {
          if (rc[0] < 0 || rc[1] < 0 || rc[0] >= G.n || rc[1] >= G.n) return;
          var p = rc[0] * G.n + rc[1];
          if (p !== last) cand.push(p);
        });
        var pick = cand[ri(cand.length)];
        var piece = G.pos.indexOf(pick);
        G.pos[piece] = G.empty;
        last = G.empty;
        G.empty = pick;
      }
      /* 保证真的被打乱 */
      if (isSolved()) shuffle();
    }

    return {
      restart: function (o) {
        var key = String((o && o.side) || G.n);
        G.n = (key === '2' || key === '4') ? Number(key) : 3;
        G.moves = 0; G.over = false;
        G.startTs = Date.now();
        shuffle();
        build();
        update();
      },
      pause: function () {},
      resume: function () {},
      undo: function () { api.toast('移动拼图不用悔棋，想一想哪块能滑～'); },
      hint: function () {
        if (G.over) return;
        /* 提示 = 展示原图 2 秒 */
        var peek = wrap.querySelector('.pz-peek');
        peek.classList.add('show');
        global.setTimeout(function () { peek.classList.remove('show'); }, 2000);
        api.toast('💡 对照原图，先归位左上角的块会更顺手！');
      },
      resign: function () {
        if (G.over) return;
        G.over = true;
        api.over('lose', { moves: G.moves, sec: Math.round((Date.now() - G.startTs) / 1000) });
      },
      serialize: function () {
        return { v: 1, n: G.n, pos: G.pos.slice(), empty: G.empty, moves: G.moves, ts: G.startTs };
      },
      restore: function (d) {
        if (!d || !d.pos || !d.n || d.pos.length !== d.n * d.n) return false;
        G.n = d.n;
        G.pos = d.pos.slice();
        G.empty = d.empty != null ? d.empty : d.pos.length - 1;
        G.moves = d.moves || 0;
        G.over = false;
        G.startTs = d.ts || Date.now();
        build(); update();
        if (isSolved()) return false;
        return true;
      },
      destroy: function () { if (wrap) wrap.remove(); },
      redraw: function () { if (tileEls.length) render(); }
    };
  }

  global.Games = global.Games || {};
  global.Games.slidepic = {
    stageType: 'arcade',
    hasHint: true,
    noUndo: true,
    id: 'slidepic', cat: 'kids', emoji: '🚂',
    name: '移动拼图',
    desc: '经典"空一格"滑块拼图！图画切成小块，只能滑向空格，一步步复原小火车图画。锻炼空间推理。',
    tags: ['滑块拼图', '空间推理', '4-8 岁'],
    rules: '① 图画切成小块，棋盘上有一个空格；② 点空格旁边的块，它就会滑进空格；③ 通过一步步滑动把图画复原；④ 忘记原图点「👁️ 看一眼」，从上往下逐行归位是好策略。',
    guide: '① 先复原第一行和第一列（外圈策略）；② 让块沿直线滑到目标，避免来回拉锯；③ 每滑一步想清楚空格会移到哪里，别堵死自己的路；④ 对照「看一眼」，把有 emoji 的块优先归位。',
    tip: '先归位第一行和第一列，剩下的就容易了；卡住了点「看一眼」对照原图。',
    single: true, noLevel: true, dom: true,
    sideOptions: [['2', '萌新 · 2×2'], ['3', '进阶 · 3×3'], ['4', '挑战 · 4×4']],
    mount: mount
  };
})(window);
