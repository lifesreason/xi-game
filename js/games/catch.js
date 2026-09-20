/* 接星星：给 4-5 岁小朋友的手眼协调 + 视觉追踪游戏。
   小星星从天上落下来，左右滑动手指（或鼠标）移动小篮子接住它们！
   30 秒限时，金星星 🌟 +2 分。漏掉不扣分，纯快乐收集。
   三档：下落速度与生成间隔不同。 */
(function (global) {
  var DURATION = 30;
  var LEVELS = {
    '1': { label: '萌新 · 慢慢飘', fall: [1.6, 2.4], spawn: 950, goal: 8 },
    '2': { label: '进阶 · 飘飘落', fall: [2.2, 3.4], spawn: 700, goal: 12 },
    '3': { label: '挑战 · 星星雨', fall: [3.0, 4.6], spawn: 480, goal: 18 }
  };

  function mount(host, api) {
    var G = { score: 0, caught: 0, over: false, level: '1', sec: DURATION, startTs: 0, started: false, flashT: 0, paused: false };
    var bk = null, basketX = 0.5, stars = [], tSpawn = null, tClock = null, raf = null;

    function draw(ctx, w, h, C) {
      var t = Date.now();
      /* 夜空渐变 */
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1e2a4a');
      g.addColorStop(1, '#3a4f86');
      BoardKit.roundRect(ctx, 0, 0, w, h, 14);
      ctx.fillStyle = g; ctx.fill();
      /* 背景闪烁的小星星 */
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (var i = 0; i < 14; i++) {
        var sx = (i * 97 % 100) / 100 * w;
        var sy = (i * 53 % 60) / 100 * h * 0.6 + 12;
        var tw = 0.5 + 0.5 * Math.sin(t / 400 + i * 1.7);
        ctx.globalAlpha = 0.2 + tw * 0.3;
        ctx.fillStyle = '#fff';
        ctx.font = Math.round(w * 0.03) + 'px sans-serif';
        ctx.fillText('✦', sx, sy);
      }
      ctx.globalAlpha = 1;
      /* 落下的星星 */
      for (var k = 0; k < stars.length; k++) {
        var s = stars[k];
        ctx.font = Math.round(w * (s.gold ? 0.095 : 0.085)) + 'px sans-serif';
        ctx.fillText(s.gold ? '🌟' : '⭐', s.x * w, s.y * h);
      }
      /* 小篮子 */
      var bw = w * 0.2, bh = h * 0.09;
      var bx = basketX * w - bw / 2, by = h - bh - w * 0.025;
      ctx.fillStyle = '#e8a24b';
      ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = Math.max(2, w * 0.008);
      BoardKit.roundRect(ctx, bx, by, bw, bh, 8);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.arc(basketX * w, by + 2, bw * 0.3, Math.PI, 0);
      ctx.stroke();
      /* 接到时的闪光圈 */
      if (G.flashT && t - G.flashT < 260) {
        ctx.globalAlpha = 1 - (t - G.flashT) / 260;
        ctx.fillStyle = '#ffe58f';
        ctx.beginPath();
        ctx.arc(basketX * w, by, bw * 0.3 * (1 + (t - G.flashT) / 300), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (!G.started && !G.over) {
        ctx.fillStyle = 'rgba(20,28,46,.72)';
        BoardKit.roundRect(ctx, w * 0.08, h * 0.42, w * 0.84, h * 0.26, 12);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '700 ' + Math.round(w * 0.048) + 'px "PingFang SC","Microsoft YaHei",sans-serif';
        ctx.fillText('左右滑动手指移动小篮子', w / 2, h * 0.5);
        ctx.fillText('点一下屏幕开始 ⭐', w / 2, h * 0.6);
      }
    }

    function loop() {
      if (G.over) return;
      for (var i = stars.length - 1; i >= 0; i--) {
        var s = stars[i];
        s.y += s.v / 60;
        s.x += Math.sin(Date.now() / 700 + i) * 0.0012;
        if (s.y >= 0.9 && Math.abs(s.x - basketX) < 0.14) {
          stars.splice(i, 1);
          G.score += s.gold ? 2 : 1;
          G.caught++;
          G.flashT = Date.now();
          if (Sfx.coin) Sfx.coin(); else Sfx.pop();
          Fx.vibrate(12);
          update();
          continue;
        }
        if (s.y > 1.15) stars.splice(i, 1);
      }
      bk.redraw();
      raf = requestAnimationFrame(loop);
    }

    function spawnStar() {
      if (G.over || !G.started) return;
      var lv = LEVELS[G.level];
      stars.push({
        x: 0.1 + Math.random() * 0.8, y: -0.05,
        v: lv.fall[0] + Math.random() * (lv.fall[1] - lv.fall[0]),
        gold: Math.random() < 0.18
      });
      tSpawn = global.setTimeout(spawnStar, lv.spawn * (0.7 + Math.random() * 0.6));
    }

    function pause() {
      if (G.over || G.paused || !G.started) return;
      stopTimers();
      G.paused = true;
    }
    function resume() {
      if (!G.paused || G.over || !G.started) return;
      G.paused = false;
      spawnStar();
      tClock = global.setInterval(function () {
        G.sec--;
        update();
        if (G.sec <= 0) finish();
      }, 1000);
      loop();
    }
    function begin() {
      if (G.started || G.over) return;
      G.started = true;
      G.startTs = Date.now();
      spawnStar();
      tClock = global.setInterval(function () {
        G.sec--;
        update();
        if (G.sec <= 0) finish();
      }, 1000);
      loop();
    }

    function finish() {
      if (G.over) return;
      G.over = true;
      clearInterval(tClock); clearTimeout(tSpawn);
      if (raf) cancelAnimationFrame(raf);
      stars = [];
      var goal = LEVELS[G.level].goal;
      var win = G.score >= goal;
      if (win) { Fx.confetti({ count: 90 }); Sfx.win(); } else Sfx.lose();
      var isRec = global.Store && Store.setBest('catch.score.' + G.level, G.score, false);
      api.over(win ? 'win' : 'lose', {
        moves: G.caught, sec: DURATION,
        score: '接到 ' + G.score + ' 分 · 目标 ' + goal,
        newRecord: isRec ? '本机最高分新纪录：' + G.score + ' 分' : ''
      });
      update();
      bk.redraw();
    }

    function update() {
      var lv = LEVELS[G.level];
      api.status(G.over ? '完成！接到 ' + G.score + ' 分'
        : (G.started ? '⏰ ' + G.sec + ' 秒 · ⭐ ' + G.score : '准备好啦！'));
      api.info('<b>' + lv.label + '</b>　目标：<b>' + lv.goal + '</b> 分 / 30 秒（🌟 金星星 +2）<br>' +
        '手指按住屏幕左右滑动，小篮子会跟着跑，把落下来的星星都接住！');
      api.changed();
    }

    function stopTimers() {
      clearInterval(tClock); clearTimeout(tSpawn);
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }

    bk = BoardKit.create(host, {
      aspect: 1.15,
      draw: draw,
      click: function (x, y, W) {
        basketX = x / W;
        if (!G.started) begin();
        else bk.redraw();
      }
    });
    /* 手指/鼠标滑动追踪：按住拖动即可移动篮子 */
    var cv = host.querySelector('canvas');
    function track(e) {
      var r = cv.getBoundingClientRect();
      basketX = Math.min(0.96, Math.max(0.04, (e.clientX - r.left) / r.width));
      if (G.started) { e.preventDefault(); bk.redraw(); }
    }
    cv.addEventListener('pointerdown', function (e) { track(e); }, { passive: false });
    cv.addEventListener('pointermove', function (e) {
      if (e.buttons || e.pointerType === 'touch') track(e);
    }, { passive: false });

    update();
    bk.redraw();

    return {
      restart: function (o) {
        G.level = String((o && o.side) || G.level || '1');
        if (!LEVELS[G.level]) G.level = '1';
        stopTimers();
        G.score = 0; G.caught = 0; G.over = false; G.sec = DURATION;
        G.started = false; stars = []; basketX = 0.5;
        update();
        bk.redraw();
      },
      pause: pause,
      resume: resume,
      undo: function () { api.toast('接星星不用悔棋，手要稳哦！'); },
      hint: function () { api.toast('眼睛盯着星星，手提前移到它落下来的位置～'); },
      resign: function () { if (G.started) finish(); },
      serialize: function () { return { v: 1, lv: G.level, score: G.score, sec: G.sec, ts: G.startTs }; },
      restore: function (d) { return false; /* 计时游戏不恢复残局 */ },
      destroy: function () { stopTimers(); if (bk) bk.destroy(); },
      redraw: function () { if (bk) bk.redraw(); }
    };
  }

  global.Games = global.Games || {};
  global.Games.catch = {
    id: 'catch', cat: 'kids', emoji: '⭐',
    name: '快乐接星星',
    desc: '滑动手指移动小篮子，接住天上掉下来的小星星！锻炼视觉追踪与手眼协调，适合 3-6 岁。',
    tags: ['手眼协调', '视觉追踪', '3-6 岁'],
    rules: '① 手指按住屏幕左右滑动，小篮子会跟着移动；② 接住天上掉下来的星星得 1 分，金色 🌟 得 2 分；③ 30 秒内达到目标分即获胜；④ 漏掉星星不扣分，放心追！',
    guide: '① 移动幅度要提前：篮子移到星星落点的正下方等着；② 优先接必然接得住的，别为金星星放弃保底；③ 星星会左右飘，追它的「投影」而不是它本身；④ 手臂大动作滑动比指尖微调更稳。',
    tip: '让孩子用整只手臂大动作滑动，比只用手指更稳；金星星值 2 分，先接容易接的！',
    single: true, noLevel: true, dom: false,
    sideOptions: [['1', '萌新 · 慢慢飘'], ['2', '进阶 · 飘飘落'], ['3', '挑战 · 星星雨']],
    mount: mount
  };
})(window);
