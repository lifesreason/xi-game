/* 扫雷·少儿版：数字推理排雷。
   第一次点击永远安全（点击后才布雷，且避开点击处周围一圈）。
   翻开所有非雷格子即获胜；两种模式：⛏️ 翻开 / 🚩 插旗。
   三档：6×6·3 雷 / 8×8·8 雷 / 10×10·15 雷。 */
(function (global) {
  var LEVELS = {
    '1': { label: '萌新 · 6×6', n: 6, mines: 3 },
    '2': { label: '进阶 · 8×8', n: 8, mines: 8 },
    '3': { label: '挑战 · 10×10', n: 10, mines: 15 }
  };

  function ri(n) { return (Math.random() * n) | 0; }

  function mount(host, api) {
    var G = {
      n: 6, mines: 3, mineSet: {}, revealed: {}, flags: {},
      placed: false, over: false, mode: 'dig', startTs: Date.now()
    };
    var wrap = null, gridEl = null, cells = [], timer = null;

    function neighbors(i) {
      var n = G.n, x = i % n, y = (i / n) | 0, out = [];
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        out.push(ny * n + nx);
      }
      return out;
    }

    function placeMines(safe) {
      var total = G.n * G.n;
      var banned = {};
      banned[safe] = true;
      neighbors(safe).forEach(function (i) { banned[i] = true; });
      G.mineSet = {};
      var guard = 0;
      while (Object.keys(G.mineSet).length < Math.min(G.mines, total - Object.keys(banned).length) && guard < 2000) {
        var i = ri(total);
        if (!banned[i] && !G.mineSet[i]) G.mineSet[i] = true;
        guard++;
      }
      G.placed = true;
    }

    function countAround(i) {
      return neighbors(i).filter(function (j) { return G.mineSet[j]; }).length;
    }

    function build() {
      if (wrap) wrap.remove();
      wrap = document.createElement('div');
      wrap.className = 'mn-wrap';
      var bar = document.createElement('div');
      bar.className = 'mn-bar';
      wrap.appendChild(bar);
      var modeRow = document.createElement('div');
      modeRow.className = 'mn-modes';
      var dig = document.createElement('button');
      dig.type = 'button';
      dig.className = 'btn small mn-mode active';
      dig.textContent = '⛏️ 翻开';
      dig.onclick = function () { setMode('dig', dig); };
      var flag = document.createElement('button');
      flag.type = 'button';
      flag.className = 'btn small mn-mode';
      flag.textContent = '🚩 插旗';
      flag.onclick = function () { setMode('flag', flag); };
      modeRow.appendChild(dig);
      modeRow.appendChild(flag);
      wrap.appendChild(modeRow);
      gridEl = document.createElement('div');
      gridEl.className = 'mn-grid';
      gridEl.style.setProperty('--n', G.n);
      cells = [];
      for (var i = 0; i < G.n * G.n; i++) {
        (function (i) {
          var c = document.createElement('button');
          c.type = 'button';
          c.className = 'mn-cell';
          c.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            tap(i, c);
          });
          gridEl.appendChild(c);
          cells.push(c);
        })(i);
      }
      wrap.appendChild(gridEl);
      var tip = document.createElement('p');
      tip.className = 'muted small mn-tip';
      tip.textContent = '数字 = 它周围 8 格里埋了几颗雷。第一次点击永远安全！';
      wrap.appendChild(tip);
      host.appendChild(wrap);
      refreshBar();
    }

    function setMode(m, btn) {
      G.mode = m;
      Sfx.click();
      [...wrap.querySelectorAll('.mn-mode')].forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
    }

    function refreshBar() {
      var flags = Object.keys(G.flags).length;
      wrap.querySelector('.mn-bar').innerHTML =
        '<span>💣 <b>' + (G.mines - flags) + '</b> 颗未标记</span>' +
        '<span>⛏️ 已翻开 <b>' + Object.keys(G.revealed).length + '</b> / ' + (G.n * G.n - G.mines) + '</span>';
    }

    function renderCell(i) {
      var c = cells[i];
      if (G.flags[i] && !G.revealed[i]) { c.textContent = '🚩'; c.classList.add('flag'); return; }
      if (!G.revealed[i]) { c.textContent = ''; c.classList.remove('flag'); return; }
      c.classList.add('open');
      if (G.mineSet[i]) { c.textContent = '💣'; c.classList.add('boom'); return; }
      var cnt = countAround(i);
      if (cnt) { c.textContent = cnt; c.setAttribute('data-n', cnt); }
    }

    function reveal(i) {
      if (G.revealed[i] || G.flags[i]) return;
      G.revealed[i] = true;
      renderCell(i);
      if (countAround(i) === 0 && !G.mineSet[i]) {
        neighbors(i).forEach(function (j) { reveal(j); });
      }
    }

    function tap(i, c) {
      if (G.over) return;
      if (G.mode === 'flag') {
        if (G.revealed[i]) return;
        if (G.flags[i]) delete G.flags[i];
        else G.flags[i] = true;
        Sfx.click();
        renderCell(i);
        refreshBar();
        api.changed();
        return;
      }
      if (G.flags[i]) return;
      if (!G.placed) placeMines(i);
      if (G.mineSet[i]) {
        G.revealed[i] = true;
        renderCell(i);
        G.over = true;
        stopTimer();
        /* 揭示所有雷 */
        Object.keys(G.mineSet).forEach(function (k) {
          G.revealed[k] = true;
          renderCell(Number(k));
        });
        Fx.shake(gridEl);
        Sfx.lose();
        api.over('lose', { moves: Object.keys(G.revealed).length, sec: elapsed() });
        update();
        return;
      }
      reveal(i);
      Sfx.click();
      Fx.vibrate(8);
      refreshBar();
      api.changed();
      /* 胜利判定 */
      var need = G.n * G.n - G.mines;
      if (Object.keys(G.revealed).filter(function (k) { return !G.mineSet[k]; }).length >= need) {
        G.over = true;
        stopTimer();
        Fx.confetti({ count: 100 });
        Sfx.win();
        var isRec = global.Store && Store.setBest('mines.time.' + G.levelKey, elapsed(), true);
        api.over('win', {
          moves: G.moves || need, sec: elapsed(), score: LEVELS[G.levelKey].label,
          newRecord: isRec ? LEVELS[G.levelKey].label + ' 最快排雷新纪录：' + elapsed() + ' 秒' : ''
        });
        update();
      } else {
        update();
      }
    }

    function elapsed() { return Math.round((Date.now() - G.startTs) / 1000); }
    function startTimer() {
      stopTimer();
      timer = global.setInterval(function () {
        if (G.over || !G.placed) return;
        update();
      }, 1000);
    }
    function stopTimer() { if (timer) { global.clearInterval(timer); timer = null; } }

    function update() {
      var left = G.n * G.n - Object.keys(G.revealed).length;
      api.status(G.over ? (Object.keys(G.revealed).some(function (k) { return G.mineSet[k]; })) ? '踩到雷了…' : '排雷成功！' : '剩余 ' + left + ' 格');
      api.info('<b>' + LEVELS[G.levelKey].label + '</b>　用时 <b>' + elapsed() + '</b> 秒<br>' +
        '先用 🚩 标记你确定的雷，再换成 ⛏️ 翻开其他格子。数字表示周围 8 格有几颗雷。');
      api.changed();
    }

    return {
      restart: function (o) {
        G.levelKey = String((o && o.side) || G.levelKey || '1');
        var lv = LEVELS[G.levelKey] || LEVELS['1'];
        G.n = lv.n; G.mines = lv.mines;
        G.mineSet = {}; G.revealed = {}; G.flags = {};
        G.placed = false; G.over = false; G.mode = 'dig';
        G.startTs = Date.now();
        build();
        startTimer();
        update();
      },
      pause: function () {},
      resume: function () {},
      undo: function () { api.toast('扫雷没有后悔药，插旗要慎重哦～'); },
      hint: function () {
        if (G.over) return;
        if (!G.placed) { api.toast('先随便翻一格吧，第一次点击永远安全！'); return; }
        var safe = [];
        for (var i = 0; i < G.n * G.n; i++) {
          if (!G.mineSet[i] && !G.revealed[i] && !G.flags[i]) safe.push(i);
        }
        if (!safe.length) return;
        var pick = safe[ri(safe.length)];
        cells[pick].classList.add('pat-hint');
        global.setTimeout(function () { cells[pick].classList.remove('pat-hint'); }, 1800);
        api.toast('💡 亮一亮的位置是安全的，翻它！');
      },
      resign: function () {
        if (G.over) return;
        G.over = true;
        stopTimer();
        api.over('lose', { moves: 0, sec: elapsed() });
      },
      serialize: function () {
        return {
          v: 1, lv: G.levelKey, mines: Object.keys(G.mineSet).map(Number),
          revealed: Object.keys(G.revealed).map(Number), flags: Object.keys(G.flags).map(Number),
          placed: G.placed, ts: G.startTs
        };
      },
      restore: function (d) {
        if (!d || !d.lv || !d.mines) return false;
        G.levelKey = d.lv;
        var lv = LEVELS[G.levelKey];
        if (!lv) return false;
        G.n = lv.n; G.mines = lv.mines;
        G.mineSet = {}; (d.mines || []).forEach(function (i) { G.mineSet[i] = true; });
        G.revealed = {}; (d.revealed || []).forEach(function (i) { G.revealed[i] = true; });
        G.flags = {}; (d.flags || []).forEach(function (i) { G.flags[i] = true; });
        G.placed = !!d.placed; G.over = false; G.mode = 'dig';
        G.startTs = d.ts || Date.now();
        build();
        for (var i = 0; i < G.n * G.n; i++) if (G.revealed[i]) renderCell(i);
        startTimer(); update();
        return true;
      },
      destroy: function () { stopTimer(); if (wrap) wrap.remove(); },
      redraw: function () { refreshBar(); }
    };
  }

  global.Games = global.Games || {};
  global.Games.mines = {
    id: 'mines', cat: 'brain', emoji: '💣',
    name: '扫雷·少儿版',
    desc: '经典扫雷的儿童友好版！数字推理雷区，第一次点击永远安全，插旗标记慢慢排。锻炼数字演绎。',
    tags: ['数字演绎', '概率排除', '6-10 岁'],
    rules: '① 点格子翻开它：数字表示它周围 8 格里有几颗雷；② 用「🚩 插旗」模式标记你确定的雷；③ 翻开所有安全的格子即获胜；④ 第一次点击永远安全，放心下手！',
    guide: '① 「1-2-1」和「1-2-2-1」是常见定式，雷的位置有公式；② 已插旗的雷会消耗周围数字——先插旗再看剩余数字；③ 不确定时用排除法缩小范围，别凭感觉乱点；④ 优先翻开数字多的区域，信息量大。',
    tip: '看到"1"周围只剩一个没翻的格子，那里就一定是雷——先插旗，再翻别处！',
    single: true, noLevel: true, dom: true,
    sideOptions: [['1', '萌新 · 6×6'], ['2', '进阶 · 8×8'], ['3', '挑战 · 10×10']],
    mount: mount
  };
})(window);
