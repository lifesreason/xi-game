/* 奇妙点灯 (Lights Out · 星星点灯)：空间反转与因果推理思维训练
   3×3 / 4×4 / 5×5 矩阵，保证100%有解、关卡闯关进度、美轮美奂星光音阶与动效 */
(function (global) {
  var TIERS = {
    '3': { size: 3, label: '萌新 · 3×3 星阵' },
    '4': { size: 4, label: '探索 · 4×4 星阵' },
    '5': { size: 5, label: '大师 · 5×5 星阵' }
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function mount(host, api) {
    var S = null, box = null, timer = null;

    function startTimer() {
      stopTimer();
      timer = setInterval(function () {
        if (!S || S.over) return;
        S.sec = Math.floor((Date.now() - S.t0) / 1000);
        update();
      }, 1000);
    }
    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
    function fmt(s) { var m = (s / 60) | 0; return m + ':' + ('0' + (s % 60)).slice(-2); }

    /* 生成 100% 可解盘面：从全亮状态反向随机翻转若干个互异格子 */
    function generateSolvable(size, flipsCount) {
      var total = size * size;
      var grid = new Array(total);
      for (var i = 0; i < total; i++) grid[i] = 1; /* 1: 亮, 0: 灭 */

      var flipped = [];
      var chosen = {};
      var attempts = 0;
      while (flipped.length < flipsCount && attempts < 100) {
        attempts++;
        var pick = (Math.random() * total) | 0;
        if (!chosen[pick]) {
          chosen[pick] = true;
          flipped.push(pick);
        }
      }

      /* 执行翻转 */
      flipped.forEach(function (idx) {
        toggleCell(grid, size, idx);
      });

      /* 保证至少有灭的灯 */
      var hasOff = grid.some(function (v) { return v === 0; });
      if (!hasOff) {
        toggleCell(grid, size, (Math.random() * total) | 0);
      }

      return {
        grid: grid,
        solutionKeys: flipped
      };
    }

    function toggleCell(arr, size, idx) {
      var r = (idx / size) | 0, c = idx % size;
      arr[idx] = arr[idx] ? 0 : 1;
      if (r > 0) arr[(r - 1) * size + c] = arr[(r - 1) * size + c] ? 0 : 1;
      if (r < size - 1) arr[(r + 1) * size + c] = arr[(r + 1) * size + c] ? 0 : 1;
      if (c > 0) arr[r * size + (c - 1)] = arr[r * size + (c - 1)] ? 0 : 1;
      if (c < size - 1) arr[r * size + (c + 1)] = arr[r * size + (c + 1)] ? 0 : 1;
    }

    function newGame(tierKey) {
      var tier = TIERS[tierKey] || TIERS['3'];
      var size = tier.size;
      /* 根据盘面大小设置初始翻乱步数 */
      var flips = size === 3 ? 3 : size === 4 ? 5 : 7;
      var puzzle = generateSolvable(size, flips);

      S = {
        tierKey: tierKey,
        size: size,
        grid: puzzle.grid,
        solutionKeys: puzzle.solutionKeys,
        moves: 0,
        hist: [],
        sec: 0,
        t0: Date.now(),
        over: false
      };

      build();
      startTimer();
      update();
    }

    function build() {
      box = document.createElement('div');
      box.className = 'lo-wrap';
      host.innerHTML = '';
      host.appendChild(box);
      render();
    }

    function render() {
      if (!S) return;
      var html = '<div class="lo-board lo-size-' + S.size + '" style="--lo-cols:' + S.size + '">';

      for (var i = 0; i < S.grid.length; i++) {
        var isLit = S.grid[i] === 1;
        html += '<button type="button" class="lo-cell' + (isLit ? ' lit' : ' dark') + '" data-idx="' + i + '" tabindex="-1">';
        html += '  <span class="lo-icon">' + (isLit ? '🌟' : '🌙') + '</span>';
        html += '</button>';
      }

      html += '</div>';

      var litCount = S.grid.filter(function (v) { return v === 1; }).length;
      html += '<div class="lo-status-bar">';
      html += '  <span>✨ 已点亮 <b>' + litCount + ' / ' + S.grid.length + '</b> 颗星星</span>';
      html += '  <span>步数: <b>' + S.moves + '</b></span>';
      html += '</div>';

      box.innerHTML = html;

      Array.prototype.forEach.call(box.querySelectorAll('.lo-cell'), function (cell) {
        var triggered = false;
        cell.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          triggered = true;
          onCellClick(Number(cell.dataset.idx), e.clientX, e.clientY, cell);
        });
        cell.addEventListener('click', function (e) {
          e.preventDefault();
          if (triggered) { triggered = false; return; }
          onCellClick(Number(cell.dataset.idx), e.clientX, e.clientY, cell);
        });
      });
    }

    function onCellClick(idx, cx, cy, el) {
      if (!S || S.over) return;
      if (global.Fx) {
        global.Fx.vibrate(10);
        if (el && cx && cy) global.Fx.ripple(el, cx, cy);
      }

      S.hist.push(S.grid.slice());
      toggleCell(S.grid, S.size, idx);
      S.moves++;

      if (global.Sfx && global.Sfx.light) {
        global.Sfx.light(idx);
      } else {
        Sfx.place();
      }

      render();
      update();
      checkWin();
    }

    function checkWin() {
      var allLit = S.grid.every(function (v) { return v === 1; });
      if (allLit) {
        S.over = true;
        stopTimer();
        if (global.Fx) {
          global.Fx.confetti({ count: 110 });
          global.Fx.starFountain(null, null, 18);
        }
        if (global.Store) {
          global.Store.addStars(4);
          global.Store.unlockBadge('lights_novice');
          var totalCleared = (global.Store.get('lights_cleared', 0)) + 1;
          global.Store.set('lights_cleared', totalCleared);
          if (totalCleared >= 5) global.Store.unlockBadge('lights_master');
        }
        api.over('win', {
          moves: S.moves,
          sec: S.sec,
          score: S.moves + '步 (' + S.size + '×' + S.size + ')'
        });
      }
    }

    function update() {
      if (!S) return;
      var litCount = S.grid.filter(function (v) { return v === 1; }).length;
      api.status(S.over
        ? '全星点亮！用时 ' + fmt(S.sec) + ' · 步数 ' + S.moves
        : S.size + '×' + S.size + ' · 点亮 ' + litCount + '/' + S.grid.length + ' · ' + fmt(S.sec));
      api.info(
        '<b>奇妙点灯 · ' + S.size + '×' + S.size + '</b><br>' +
        '目标：把所有沉睡的 <b>🌙 星星全部点亮为 🌟</b>。<br>' +
        '规则：点击任意一颗星星，它与<b>上下左右相邻的星星都会同时反转</b>！<br>' +
        '锻炼空间反转与连锁因果推理能力。'
      );
      api.changed();
    }

    return {
      restart: function (o) {
        var tier = (o && o.side) || (S ? S.tierKey : '3');
        if (!TIERS[tier]) tier = '3';
        newGame(tier);
      },
      restore: function (data) {
        try {
          if (!data || !TIERS[String(data.tierKey)] || !data.grid) return false;
          S = {
            tierKey: String(data.tierKey),
            size: Number(data.size),
            grid: data.grid.slice(),
            solutionKeys: data.solutionKeys || [],
            moves: data.moves || 0,
            hist: data.hist || [],
            sec: data.sec || 0,
            t0: Date.now() - (data.sec || 0) * 1000,
            over: !!data.over
          };
          build();
          if (!S.over) startTimer();
          update();
          return true;
        } catch (e) { return false; }
      },
      serialize: function () {
        if (!S) return null;
        return {
          v: 1, kind: 'lightsout', tierKey: S.tierKey, size: S.size,
          grid: S.grid, moves: S.moves, hist: S.hist,
          sec: S.over ? S.sec : Math.floor((Date.now() - S.t0) / 1000),
          over: S.over, ts: Date.now()
        };
      },
      undo: function () {
        if (!S || S.over || !S.hist.length) {
          api.toast('还没有可以撤回的步骤');
          return;
        }
        S.grid = S.hist.pop();
        S.moves = Math.max(0, S.moves - 1);
        if (global.Sfx && global.Sfx.undo) global.Sfx.undo();
        else Sfx.click();
        render();
        update();
      },
      hint: function () {
        if (!S || S.over) return;
        /* 提示：找出当前暗的星星中相邻暗星最多的点 */
        var bestIdx = -1, maxOffNeighbors = -1;
        for (var i = 0; i < S.grid.length; i++) {
          if (S.grid[i] === 0) {
            var r = (i / S.size) | 0, c = i % S.size;
            var offCount = 1;
            if (r > 0 && S.grid[(r - 1) * S.size + c] === 0) offCount++;
            if (r < S.size - 1 && S.grid[(r + 1) * S.size + c] === 0) offCount++;
            if (c > 0 && S.grid[r * S.size + (c - 1)] === 0) offCount++;
            if (c < S.size - 1 && S.grid[r * S.size + (c + 1)] === 0) offCount++;
            if (offCount > maxOffNeighbors) {
              maxOffNeighbors = offCount;
              bestIdx = i;
            }
          }
        }
        if (bestIdx >= 0) {
          var r = ((bestIdx / S.size) | 0) + 1, c = (bestIdx % S.size) + 1;
          api.toast('💡 灵感提示：试试点击第 ' + r + ' 行第 ' + c + ' 列的星星！');
          var targetEl = box.querySelector('[data-idx="' + bestIdx + '"]');
          if (targetEl && global.Fx) global.Fx.pop(targetEl);
        } else {
          api.toast('💡 观察星盘：从边缘向中心推进反转往往有奇效！');
        }
      },
      resign: function () {
        if (!S || S.over) return;
        api.toast('重新打乱星阵，开启新一局！');
        newGame(S.tierKey);
      },
      redraw: function () { if (S) render(); },
      destroy: function () { stopTimer(); }
    };
  }

  global.Games = global.Games || {};
  global.Games.lightsout = {
    cat: 'puzzle',
    emoji: '💡',
    name: '奇妙点灯',
    desc: '超经典因果推理益智游戏！点亮一颗星星，周围四颗同时反转，把沉睡的夜空全部点亮吧！',
    tags: ['因果推理', '空间联想', '全星闪耀'],
    rules: '① 点一盏灯，它自己和上下左右四盏会同时翻转（亮变暗、暗变亮）；② 把整片星空全部点亮即过关；③ 出题保证 100% 有解，点两次等于没点；④ 试着找「必须按的格子」，剩下的会连锁解决。',
    guide: '① 只看第一行：决定第一行按哪些格子；② 第二行起逐行消灯：上一行亮着的灯，正下方按一下必然熄灭；③ 最后一行决定成败，按前两行的组合规律排查；④ 同一格点两次等于没点，试着找最小按键集合。',
    tip: '反转联想：一个格子点两次等于没点，寻找暗星集中的区域重点突破！',
    single: true,
    noLevel: true,
    dom: true,
    sideOptions: [
      ['3', '萌新 · 3×3 星阵'],
      ['4', '探索 · 4×4 星阵'],
      ['5', '大师 · 5×5 星阵']
    ],
    mount: mount
  };
})(window);
