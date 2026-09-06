/* 打地鼠：给 4-5 岁小朋友的手眼协调 + 反应力游戏。
   小地鼠从洞里冒出来，快点它！30 秒限时，敲到越多越棒。
   三档：地鼠冒出的间隔与停留时间不同；敲中 30 秒内达到目标分即胜利。 */
(function (global) {
  var HOLES = 9, DURATION = 30;
  var LEVELS = {
    '1': { label: '萌新 · 慢慢来', gap: [900, 1400], stay: 1300, goal: 8 },
    '2': { label: '进阶 · 蹦蹦跳', gap: [650, 1000], stay: 1000, goal: 14 },
    '3': { label: '闪电 · 快快快', gap: [420, 750], stay: 750, goal: 20 }
  };

  function ri(n) { return (Math.random() * n) | 0; }

  function mount(host, api) {
    var G = { score: 0, missed: 0, over: false, level: '1', sec: DURATION, startTs: 0, whacks: 0, paused: false };
    var wrap = null, holes = [], tSpawn = null, tClock = null, upIdx = -1, tHide = null;

    function build() {
      if (wrap) wrap.remove();
      wrap = document.createElement('div');
      wrap.className = 'mole-wrap';
      var bar = document.createElement('div');
      bar.className = 'mole-bar';
      wrap.appendChild(bar);
      var grid = document.createElement('div');
      grid.className = 'mole-grid';
      holes = [];
      for (var i = 0; i < HOLES; i++) {
        (function (i) {
          var h = document.createElement('div');
          h.className = 'mole-hole';
          h.innerHTML = '<div class="mole-dirt"></div><button type="button" class="mole-critter" aria-label="敲地鼠">🐹</button>';
          var btn = h.querySelector('.mole-critter');
          btn.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            whack(i, btn, e.clientX, e.clientY);
          });
          grid.appendChild(h);
          holes.push({ el: h, btn: btn });
        })(i);
      }
      wrap.appendChild(grid);
      var tip = document.createElement('p');
      tip.className = 'muted small mole-tip';
      tip.textContent = '小地鼠冒出来时，快点它的小脑袋！';
      wrap.appendChild(tip);
      host.appendChild(wrap);
    }

    function barHtml() {
      return '<span>⏰ <b>' + G.sec + '</b> 秒</span>' +
        '<span>🔨 得分 <b>' + G.score + '</b> / 目标 ' + LEVELS[G.level].goal + '</span>';
    }
    function refreshBar() { if (wrap) wrap.querySelector('.mole-bar').innerHTML = barHtml(); }

    function popOne() {
      if (G.over) return;
      /* 随机挑一个没被占用的洞 */
      var free = [];
      for (var i = 0; i < HOLES; i++) if (i !== upIdx) free.push(i);
      var i = free[ri(free.length)];
      upIdx = i;
      var btn = holes[i].btn;
      btn.classList.add('up');
      tHide = global.setTimeout(function () {
        if (btn.classList.contains('up')) {
          btn.classList.remove('up');
          G.missed++;
          upIdx = -1;
        }
        schedule();
      }, LEVELS[G.level].stay);
    }
    function schedule() {
      if (G.over) return;
      var g = LEVELS[G.level].gap;
      tSpawn = global.setTimeout(popOne, g[0] + ri(g[1] - g[0]));
    }

    function whack(i, btn, cx, cy) {
      if (G.over || !btn.classList.contains('up')) {
        Fx.vibrate(6);
        return;
      }
      btn.classList.remove('up');
      upIdx = -1;
      G.score++;
      G.whacks++;
      Sfx.pop();
      Fx.vibrate(20);
      Fx.burst(btn, ['💥', '⭐', '🌟'][ri(3)], 4);
      if (cx != null) Fx.ripple(wrap.querySelector('.mole-grid'), cx, cy, 'rgba(255,176,46,.6)');
      refreshBar();
      if (G.score >= LEVELS[G.level].goal && !G.over) {
        /* 提前达成目标也继续到时间结束，让小朋友尽兴 */
        refreshBar();
      }
      clearTimeout(tHide);
      schedule();
    }

    /* 离开对局页时暂停，回来继续 */
    function pause() {
      if (G.over || G.paused) return;
      stopAll();
      G.paused = true;
    }
    function resume() {
      if (!G.paused || G.over) return;
      G.paused = false;
      schedule();
      tClock = global.setInterval(function () {
        G.sec--;
        refreshBar();
        api.status('⏰ 还剩 ' + G.sec + ' 秒 · 得分 ' + G.score);
        if (G.sec <= 0) finish();
      }, 1000);
    }
    function start() {
      G.sec = DURATION; G.score = 0; G.missed = 0; G.over = false;
      G.paused = false;
      G.startTs = Date.now();
      refreshBar();
      clearTimeout(tSpawn); clearTimeout(tHide);
      schedule();
      tClock = global.setInterval(function () {
        G.sec--;
        refreshBar();
        api.status('⏰ 还剩 ' + G.sec + ' 秒 · 得分 ' + G.score);
        if (G.sec <= 0) finish();
      }, 1000);
      update();
    }
    function stopAll() {
      clearTimeout(tSpawn); clearTimeout(tHide);
      if (tClock) { global.clearInterval(tClock); tClock = null; }
      holes.forEach(function (h) { h.btn.classList.remove('up'); });
      upIdx = -1;
    }

    function finish() {
      if (G.over) return;
      G.over = true;
      stopAll();
      var goal = LEVELS[G.level].goal;
      var win = G.score >= goal;
      if (win) {
        Fx.confetti({ count: 90 });
        Sfx.win();
      } else Sfx.lose();
      api.over(win ? 'win' : 'lose', {
        moves: G.whacks, sec: DURATION,
        score: '敲到 ' + G.score + ' 只 · 目标 ' + goal
      });
      update();
    }

    function update() {
      api.status(G.over ? '完成！敲到 ' + G.score + ' 只' : '⏰ ' + G.sec + ' 秒 · 得分 ' + G.score);
      api.info('<b>' + LEVELS[G.level].label + '</b>　目标：<b>' + LEVELS[G.level].goal + '</b> 只 / 30 秒<br>' +
        '地鼠冒头就点它！锻炼小手快快快。没敲到也没关系，下一只马上出来。');
      api.changed();
    }

    return {
      restart: function (o) {
        G.level = String((o && o.side) || G.level || '1');
        if (!LEVELS[G.level]) G.level = '1';
        stopAll();
        build();
        start();
      },
      pause: pause,
      resume: resume,
      undo: function () { api.toast('打地鼠不用悔棋，手要快哦！'); },
      hint: function () { api.toast('盯着洞口，地鼠一冒头就点它的小脑袋！'); },
      resign: function () { finish(); },
      serialize: function () { return { v: 1, lv: G.level, score: G.score, sec: G.sec, ts: G.startTs }; },
      restore: function (d) { return false; /* 计时游戏不恢复 */ },
      destroy: function () { stopAll(); if (wrap) wrap.remove(); },
      redraw: function () { refreshBar(); }
    };
  }

  global.Games = global.Games || {};
  global.Games.mole = {
    id: 'mole', cat: 'kids', emoji: '🐹',
    name: '开心打地鼠',
    desc: '经典手眼协调游戏！小地鼠冒出来就快点它，30 秒看谁敲得多。锻炼反应力与小手灵活性。',
    tags: ['手眼协调', '反应力', '3-6 岁'],
    rules: '① 小地鼠会从 9 个洞里随机冒出来；② 地鼠一冒头就点它的小脑袋，敲到一只得 1 分；③ 30 秒内敲到目标数量即获胜；④ 没敲到不扣分，下一只马上冒出来！',
    guide: '① 手放在屏幕中央待命，不要跟地鼠跑；② 眼睛看全九个洞，用余光捕捉冒头；③ 连续点按比犹豫快——点错洞不扣分；④ 越到后面越紧张，保持节奏比加速重要。',
    tip: '告诉孩子：手放在屏幕中间待命，眼睛看全部九个洞，地鼠冒头马上点，比速度更比稳！',
    single: true, noLevel: true, dom: true,
    sideOptions: [['1', '萌新 · 慢慢来'], ['2', '进阶 · 蹦蹦跳'], ['3', '闪电 · 快快快']],
    mount: mount
  };
})(window);
