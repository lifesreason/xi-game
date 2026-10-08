/* 数织 Nonogram：根据行列数字提示，涂出隐藏的像素画。
   规格：5×5 启蒙 / 8×8 进阶 / 10×10 挑战。
   操作：点格子涂色；「涂/叉」模式切换后可标记确定不含方格（❌）。
   支持按住拖动连续填涂。全部涂对即通关。 */
(function (global) {
  var SIZES = { '5': 5, '8': 8, '10': 10 };

  function mount(host, api) {
    var G = {
      n: 5, sol: [], marks: [],           /* marks: 0 空 / 1 涂 / 2 叉 */
      moves: 0, startTs: Date.now(), over: false,
      paintMode: 1, painting: false, paintVal: 1
    };
    var sizeKey = '5';
    var wrap = null, gridEl = null, cells = [], rowClueEls = [], colClueEls = [];
    var timer = null;
    var boundPaint = false;

    /* ---------- 谜题生成 ---------- */
    function genPuzzle(n) {
      /* 随机关卡：保证每行每列至少有提示（拒绝全空行/列过多的盘面） */
      for (var attempt = 0; attempt < 50; attempt++) {
        var sol = new Uint8Array(n * n);
        var density = n <= 5 ? 0.58 : 0.55;
        for (var i = 0; i < n * n; i++) sol[i] = Math.random() < density ? 1 : 0;
        var bad = false;
        for (var r = 0; r < n; r++) {
          var cnt = 0;
          for (var c = 0; c < n; c++) cnt += sol[r * n + c];
          if (cnt === 0 || cnt === n) { bad = true; break; }
        }
        if (bad) continue;
        for (var c2 = 0; c2 < n; c2++) {
          var cnt2 = 0;
          for (var r2 = 0; r2 < n; r2++) cnt2 += sol[r2 * n + c2];
          if (cnt2 === 0 || cnt2 === n) { bad = true; break; }
        }
        if (!bad) return sol;
      }
      /* 兜底：棋盘格图案 */
      var fb = new Uint8Array(n * n);
      for (var k = 0; k < n * n; k++) fb[k] = ((k % n + ((k / n) | 0)) % 2) ? 1 : 0;
      return fb;
    }

    function clueOf(line) {
      var out = [], run = 0;
      for (var i = 0; i < line.length; i++) {
        if (line[i]) run++;
        else if (run) { out.push(run); run = 0; }
      }
      if (run) out.push(run);
      return out.length ? out : [0];
    }

    /* ---------- 构建 DOM ---------- */
    function build() {
      if (wrap) wrap.remove();
      var n = G.n;
      wrap = document.createElement('div');
      wrap.className = 'nono-wrap';

      var bar = document.createElement('div');
      bar.className = 'nono-toolbar';
      var modeBtn = document.createElement('button');
      modeBtn.type = 'button';
      modeBtn.className = 'btn small nono-mode-btn';
      modeBtn.onclick = function () {
        Sfx.click();
        G.paintMode = G.paintMode === 1 ? 2 : 1;
        refreshMode();
      };
      bar.appendChild(modeBtn);
      var checkBtn = document.createElement('button');
      checkBtn.type = 'button'; checkBtn.className = 'btn small';
      checkBtn.textContent = '👀 检查';
      checkBtn.onclick = checkNow;
      bar.appendChild(checkBtn);
      wrap.appendChild(bar);

      var table = document.createElement('div');
      table.className = 'nono-table';
      table.style.setProperty('--n', n);
      /* 按盘面规格调整提示字号与行提示列宽，保证小屏 10×10 也可操作 */
      table.style.setProperty('--cluefs', n >= 10 ? '8.5px' : n >= 8 ? '10px' : '12px');
      var rowClues = [], colClues = [];
      for (var rc0 = 0; rc0 < n; rc0++) {
        var rl = [];
        for (var cc0 = 0; cc0 < n; cc0++) rl.push(G.sol[rc0 * n + cc0]);
        rowClues.push(clueOf(rl));
        var cl = [];
        for (var rr0 = 0; rr0 < n; rr0++) cl.push(G.sol[rr0 * n + rc0]);
        colClues.push(clueOf(cl));
      }
      var maxRowLen = 0, maxColLen = 0;
      rowClues.forEach(function (a) { maxRowLen = Math.max(maxRowLen, a.join(' ').length); });
      colClues.forEach(function (a) { maxColLen = Math.max(maxColLen, a.length); });
      var rowW = Math.min(64, Math.max(30, maxRowLen * 6.2 + 10));
      var colH = Math.min(64, Math.max(24, maxColLen * 12 + 8));
      table.style.setProperty('--roww', rowW + 'px');
      table.style.setProperty('--colh', colH + 'px');

      /* 顶部：左上角 + 列提示 */
      var head = document.createElement('div');
      head.className = 'nono-head';
      var corner = document.createElement('div');
      corner.className = 'nono-corner';
      head.appendChild(corner);
      var colBox = document.createElement('div');
      colBox.className = 'nono-colclues';
      colClueEls = [];
      for (var c = 0; c < n; c++) {
        var cc = document.createElement('div');
        cc.className = 'nono-clue nono-clue-col';
        cc.textContent = colClues[c].join('\n');
        colBox.appendChild(cc);
        colClueEls.push(cc);
      }
      head.appendChild(colBox);
      table.appendChild(head);

      /* 主体：行提示 + 格子 */
      var body = document.createElement('div');
      body.className = 'nono-body';
      var rowBox = document.createElement('div');
      rowBox.className = 'nono-rowclues';
      rowClueEls = []; cells = [];
      gridEl = document.createElement('div');
      gridEl.className = 'nono-grid';
      for (var r2 = 0; r2 < n; r2++) {
        var rc = document.createElement('div');
        rc.className = 'nono-clue nono-clue-row';
        rc.textContent = rowClues[r2].join(' ');
        rowBox.appendChild(rc);
        rowClueEls.push(rc);
      }
      for (var i = 0; i < n * n; i++) {
        (function (i) {
          var d = document.createElement('div');
          d.className = 'nono-cell';
          d.dataset.i = i;
          gridEl.appendChild(d);
          cells.push(d);
        })(i);
      }
      body.appendChild(rowBox);
      body.appendChild(gridEl);
      table.appendChild(body);
      wrap.appendChild(table);

      var hint = document.createElement('p');
      hint.className = 'muted small nono-hint';
      hint.textContent = '数字是每行/每列连续涂色块的长度。点格子涂色，再点一次取消；切换到 ❌ 模式可标记「这里肯定不涂」。按住拖动可以连涂！';
      wrap.appendChild(hint);

      host.appendChild(wrap);
      bindPaint();
      refreshMode();
    }

    function refreshMode() {
      var b = wrap && wrap.querySelector('.nono-mode-btn');
      if (!b) return;
      b.innerHTML = G.paintMode === 1 ? '🖌️ 涂色模式' : '❌ 标叉模式';
      b.classList.toggle('active-cross', G.paintMode === 2);
    }

    /* ---------- 拖动连涂 ---------- */
    function bindPaint() {
      gridEl.addEventListener('pointerdown', function (e) {
        var t = cellFromPoint(e.clientX, e.clientY);
        if (t < 0 || G.over) return;
        e.preventDefault();
        G.painting = true;
        G.paintVal = G.marks[t] === G.paintMode ? 0 : G.paintMode;
        applyPaint(t);
      });
      gridEl.addEventListener('pointermove', function (e) {
        if (!G.painting) return;
        var t = cellFromPoint(e.clientX, e.clientY);
        if (t >= 0) applyPaint(t);
      });
      /* 全局 pointerup 只绑一次（gridEl 每次重建都会换新元素） */
      if (!boundPaint) {
        global.addEventListener('pointerup', stopPaint);
        global.addEventListener('pointercancel', stopPaint);
        boundPaint = true;
      }
    }
    function stopPaint() { G.painting = false; }
    function cellFromPoint(x, y) {
      var el = document.elementFromPoint(x, y);
      if (!el || !el.classList.contains('nono-cell')) return -1;
      return Number(el.dataset.i);
    }
    function applyPaint(i) {
      if (G.marks[i] === G.paintVal) return;
      if (!G.opStack) G.opStack = [];
      if (G.opStack.length > 400) G.opStack.shift();
      G.opStack.push({ i: i, prev: G.marks[i] });
      G.marks[i] = G.paintVal;
      G.moves++;
      Sfx.click();
      Fx.vibrate(8);
      render();
      after();
    }

    /* ---------- 渲染 ---------- */
    function render() {
      var n = G.n;
      for (var i = 0; i < n * n; i++) {
        var d = cells[i], m = G.marks[i];
        d.classList.toggle('fill', m === 1);
        d.classList.toggle('cross', m === 2);
        d.classList.toggle('wrong', m === 1 && !G.sol[i] && G.revealWrong);
      }
      /* 行/列提示：已满足时变淡 */
      for (var r = 0; r < n; r++) {
        var line = [];
        for (var c = 0; c < n; c++) line.push(G.sol[r * n + c]);
        rowClueEls[r].classList.toggle('done', lineSatisfied(r, n, true));
      }
      for (var c2 = 0; c2 < n; c2++) {
        var line2 = [];
        for (var r2 = 0; r2 < n; r2++) line2.push(G.sol[r2 * n + c2]);
        colClueEls[c2].classList.toggle('done', lineSatisfied(c2, n, false));
      }
    }
    /* 该行的涂色是否与答案完全一致（用于提示淡显，结果可靠） */
    function lineSatisfied(idx, n, isRow) {
      for (var k = 0; k < n; k++) {
        var m = isRow ? G.marks[idx * n + k] : G.marks[k * n + idx];
        var s = isRow ? G.sol[idx * n + k] : G.sol[k * n + idx];
        if (s === 1 && m !== 1) return false;
      }
      return true;
    }

    function update() {
      var left = 0;
      for (var i = 0; i < G.sol.length; i++) if (G.sol[i] && G.marks[i] !== 1) left++;
      api.status(G.over ? '完成！' : '还需涂 ' + left + ' 格 · ' + fmtTime(elapsed()));
      api.info('盘面：<b>' + G.n + '×' + G.n + '</b>　步数：<b>' + G.moves + '</b><br>' +
        '看行列数字推理哪些格子要涂色，涂满所有正确格子即通关。卡住了就点 👀 检查。');
      api.changed();
    }
    function elapsed() { return Math.round((Date.now() - G.startTs) / 1000); }
    function fmtTime(s) {
      var m = (s / 60) | 0;
      return m + ':' + ('0' + (s % 60)).slice(-2);
    }
    function startTimer() {
      stopTimer();
      timer = global.setInterval(update, 1000);
    }
    function stopTimer() { if (timer) { global.clearInterval(timer); timer = null; } }

    function checkNow() {
      var wrong = 0;
      for (var i = 0; i < G.sol.length; i++) if (G.marks[i] === 1 && !G.sol[i]) wrong++;
      if (wrong === 0) { api.toast('目前全部正确，继续加油！'); return; }
      G.revealWrong = true;
      render();
      Fx.shake(gridEl);
      api.toast('发现 ' + wrong + ' 个涂错的格子（已标红），点掉它们！');
      global.setTimeout(function () { G.revealWrong = false; render(); }, 2600);
    }

    function after() {
      update();
      var win = true;
      for (var i = 0; i < G.sol.length; i++) {
        if ((G.sol[i] === 1) !== (G.marks[i] === 1)) { win = false; break; }
      }
      if (win) {
        G.over = true; stopTimer();
        Fx.burst(cells[G.sol.length >> 1], '🌟', 10);
        api.over('win', { moves: G.moves, sec: elapsed(), score: G.n + '×' + G.n });
      }
    }

    /* ---------- 对外接口 ---------- */
    function restart(o) {
      sizeKey = (o && o.side) || sizeKey;
      G.n = SIZES[sizeKey] || 5;
      G.sol = Array.prototype.slice.call(genPuzzle(G.n));
      G.marks = new Array(G.n * G.n).fill(0);
      G.moves = 0; G.over = false; G.revealWrong = false;
      G.opStack = [];
      G.startTs = Date.now();
      build();
      update();
      startTimer();
    }

    return {
      restart: restart,
      undo: function () {
        if (G.over) return;
        /* 撤销：回退最近一次涂/叉（用简易操作栈） */
        var last = G.opStack && G.opStack.pop();
        if (!last) { api.toast('没有可以撤销的操作'); return; }
        G.marks[last.i] = last.prev;
        G.moves = Math.max(0, G.moves - 1);
        Sfx.click();
        update(); render();
      },
      hint: function () {
        if (G.over) return;
        var cands = [];
        for (var i = 0; i < G.sol.length; i++) if (G.sol[i] && G.marks[i] !== 1) cands.push(i);
        if (!cands.length) { api.toast('该涂的都涂上啦，试试 👀 检查'); return; }
        var t = cands[(Math.random() * cands.length) | 0];
        G.marks[t] = 1; G.moves++;
        Fx.burst(cells[t], '💡', 4);
        Sfx.click();
        update(); render(); after();
      },
      resign: function () {
        if (G.over) return;
        G.over = true; stopTimer();
        api.over('lose', { moves: G.moves, sec: elapsed() });
      },
      serialize: function () {
        return {
          v: 1, n: G.n, key: sizeKey, sol: G.sol, marks: G.marks,
          moves: G.moves, ts: G.startTs
        };
      },
      restore: function (d) {
        if (!d || !d.sol || !d.marks || !SIZES[d.key]) return false;
        /* 已完成的对局不恢复，直接开新局 */
        var done = true;
        for (var k = 0; k < d.sol.length; k++) {
          if ((d.sol[k] === 1) !== (d.marks[k] === 1)) { done = false; break; }
        }
        if (done) return false;
        sizeKey = d.key;
        G.n = d.n; G.sol = d.sol.slice(); G.marks = d.marks.slice();
        G.moves = d.moves || 0; G.over = false; G.revealWrong = false;
        G.opStack = [];
        G.startTs = d.ts || Date.now();
        build(); update(); startTimer();
        return true;
      },
      destroy: function () { stopTimer(); if (wrap) wrap.remove(); },
      redraw: function () { if (cells.length) render(); }
    };
  }

  global.Games = global.Games || {};
  global.Games.nonogram = {
    stageType: 'puzzle',
    cat: 'puzzle',
    id: 'nonogram', emoji: '🦊',
    name: '像素数织',
    desc: '按行列数字提示涂出隐藏的像素画！锻炼观察推理与空间逻辑，越涂越上瘾。',
    tags: ['逻辑推理', '像素画', '拖动连涂'],
    rules: '① 行首和列顶的数字表示这行/列里连续涂色块的长度，顺序与图中一致；② 点格子涂色，再点一次取消；「❌ 模式」标记肯定不涂的格子；③ 按住拖动可以连涂；④ 全部涂对即通关，「检查」会把涂错的标红。',
    guide: '① 先涂数字之和最大的行列；② 「数字和 + 块数 − 1 = 行宽」时位置唯一，直接整行涂；③ 已确定的格子可以推出邻格必空，用 ❌ 排除；④ 大数字的块往往贴边或居中，先假设再验证。',
    tip: '先从数字最大的行/列入手：数字之和加上块数减一等于行宽时，整行位置就唯一确定了。',
    single: true, noLevel: true, dom: true,
    sideOptions: [['5', '启蒙 · 5×5'], ['8', '进阶 · 8×8'], ['10', '挑战 · 10×10']],
    mount: mount
  };
})(window);
