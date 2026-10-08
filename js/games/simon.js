/* 记忆亮灯：经典 Simon 序列记忆游戏（幼儿版）。
   四盏彩灯按顺序闪，小朋友照着按一遍。答错不扣分——
   灯会温柔地重新演示一遍，直到学会为止。
   序列越来越长，达到目标长度即通关。 */
(function (global) {
  var PADS = [
    { color: '#ff6b6b', emoji: '🍎' },
    { color: '#ffb02e', emoji: '🌟' },
    { color: '#39b878', emoji: '🐸' },
    { color: '#43a7f5', emoji: '🐳' }
  ];
  var LEVELS = {
    '1': { label: '萌新 · 记 5 步', start: 2, goal: 5, on: 480, off: 220 },
    '2': { label: '进阶 · 记 7 步', start: 3, goal: 7, on: 380, off: 180 },
    '3': { label: '挑战 · 记 9 步', start: 3, goal: 9, on: 300, off: 140 }
  };

  function mount(host, api) {
    var G = {
      level: '1', seq: [], len: 0, inputIdx: 0,
      phase: 'idle', over: false, rounds: 0, startTs: Date.now()
    };
    var wrap = null, pads = [], tQueue = [];

    function clearTimers() {
      tQueue.forEach(clearTimeout);
      tQueue = [];
    }

    function build() {
      if (wrap) wrap.remove();
      wrap = document.createElement('div');
      wrap.className = 'sm-wrap';
      var bar = document.createElement('div');
      bar.className = 'sm-bar';
      wrap.appendChild(bar);
      var grid = document.createElement('div');
      grid.className = 'sm-grid';
      for (var i = 0; i < 4; i++) {
        (function (i) {
          var p = document.createElement('button');
          p.type = 'button';
          p.className = 'sm-pad';
          p.style.setProperty('--pc', PADS[i].color);
          p.innerHTML = '<span>' + PADS[i].emoji + '</span>';
          p.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            tapPad(i);
          });
          grid.appendChild(p);
          pads.push(p);
        })(i);
      }
      wrap.appendChild(grid);
      var fb = document.createElement('div');
      fb.className = 'sm-fb';
      wrap.appendChild(fb);
      var tip = document.createElement('p');
      tip.className = 'muted small sm-tip';
      tip.textContent = '看灯闪的顺序，然后照着按。按错了没关系，灯会再教你一遍！';
      wrap.appendChild(tip);
      host.appendChild(wrap);
    }

    function barHtml() {
      var lv = LEVELS[G.level];
      return '<span>🎯 目标 <b>' + lv.goal + '</b> 步</span>' +
        '<span>📌 当前 <b>' + G.len + '</b> 步</span>';
    }
    function refreshBar() { if (wrap) wrap.querySelector('.sm-bar').innerHTML = barHtml(); }

    function light(i, ms) {
      pads[i].classList.add('lit');
      Sfx.light(i);
      Fx.vibrate(10);
      tQueue.push(global.setTimeout(function () { pads[i].classList.remove('lit'); }, ms || 380));
    }

    function playSeq() {
      clearTimers();
      G.phase = 'show';
      var lv = LEVELS[G.level];
      wrap.querySelector('.sm-fb').textContent = '👀 小眼睛看好了……';
      var t = 500;
      for (var i = 0; i < G.seq.length; i++) {
        (function (i, t) {
          tQueue.push(global.setTimeout(function () { light(G.seq[i], lv.on); }, t));
        })(i, t);
        t += lv.on + lv.off;
      }
      tQueue.push(global.setTimeout(function () {
        G.phase = 'input';
        G.inputIdx = 0;
        wrap.querySelector('.sm-fb').textContent = '🙌 到你啦！照着刚才的顺序按一遍';
      }, t));
    }

    function tapPad(i) {
      if (G.over) return;
      if (G.phase !== 'input') {
        if (G.phase === 'idle') startRound();
        return;
      }
      light(i, 300);
      if (i === G.seq[G.inputIdx]) {
        G.inputIdx++;
        if (G.inputIdx >= G.seq.length) {
          G.phase = 'wait';
          G.rounds++;
          Sfx.combo(G.seq.length);
          Fx.burst(pads[i], '⭐', 5);
          if (G.len >= LEVELS[G.level].goal) {
            wrap.querySelector('.sm-fb').textContent = '🎉 全部记住啦！你的小脑袋真厉害！';
            global.setTimeout(finish, 800);
          } else {
            wrap.querySelector('.sm-fb').textContent = '答对啦！下一轮多一步……';
            global.setTimeout(function () {
              G.len++;
              startRound();
            }, 1100);
          }
        }
      } else {
        /* 幼儿友好：不惩罚，重新演示 */
        G.phase = 'wait';
        Fx.shake(wrap.querySelector('.sm-grid'));
        Sfx.undo();
        wrap.querySelector('.sm-fb').textContent = '没关系，看灯再教你一遍～';
        global.setTimeout(function () { playSeq(); }, 900);
      }
    }

    function startRound() {
      /* 目标长度：首轮从 start 开始，之后每轮 +1 */
      G.len = G.len ? G.len + 1 : LEVELS[G.level].start;
      while (G.seq.length < G.len) G.seq.push((Math.random() * 4) | 0);
      G.seq.length = G.len;
      G.inputIdx = 0;
      refreshBar();
      update();
      playSeq();
    }

    function finish() {
      if (G.over) return;
      G.over = true;
      G.phase = 'done';
      clearTimers();
      Fx.confetti({ count: 100 });
      Sfx.win();
      api.over('win', {
        moves: G.rounds,
        sec: Math.round((Date.now() - G.startTs) / 1000),
        score: '记住 ' + LEVELS[G.level].goal + ' 步序列'
      });
      update();
    }

    function update() {
      var lv = LEVELS[G.level];
      api.status(G.over ? '完成！' : (G.phase === 'show' ? '👀 看好了……' : G.phase === 'input' ? '🙌 该你按啦' : '准备中'));
      api.info('<b>' + lv.label + '</b>　已完成 <b>' + G.rounds + '</b> 轮<br>' +
        '四盏彩灯会按顺序闪，记住顺序再照着按。答错不扣分，灯会重新演示，直到学会！');
      api.changed();
    }

    return {
      restart: function (o) {
        G.level = String((o && o.side) || G.level || '1');
        if (!LEVELS[G.level]) G.level = '1';
        clearTimers();
        G.seq = []; G.len = 0; G.inputIdx = 0;
        G.phase = 'idle'; G.over = false; G.rounds = 0;
        G.startTs = Date.now();
        build();
        refreshBar();
        update();
        /* 幼儿游戏自动开始第一轮 */
        global.setTimeout(function () { if (!G.over) startRound(); }, 600);
      },
      pause: function () { clearTimers(); },
      resume: function () {
        if (G.over) return;
        if (G.phase === 'show') playSeq();
        else if (G.phase === 'idle') startRound();
        /* input 阶段无需定时器 */
      },
      undo: function () { api.toast('记忆游戏不用悔棋，再记一遍～'); },
      hint: function () {
        if (G.over || G.phase !== 'input') { api.toast('先看完灯的演示～'); return; }
        /* 提示：亮出下一步该按的灯 */
        var next = G.seq[G.inputIdx];
        if (next == null) return;
        pads[next].classList.add('pat-hint');
        global.setTimeout(function () { pads[next].classList.remove('pat-hint'); }, 1200);
        api.toast('亮一亮的灯就是下一步，记住啦！');
      },
      resign: function () {
        if (G.over) return;
        G.over = true; G.phase = 'done';
        clearTimers();
        api.over('lose', { moves: G.rounds, sec: Math.round((Date.now() - G.startTs) / 1000) });
      },
      serialize: function () { return { v: 1, lv: G.level, len: G.len, rounds: G.rounds, ts: G.startTs }; },
      restore: function (d) { return false; },
      destroy: function () { clearTimers(); if (wrap) wrap.remove(); },
      redraw: function () { refreshBar(); }
    };
  }

  global.Games = global.Games || {};
  global.Games.simon = {
    stageType: 'arcade',
    hasHint: true,
    noUndo: true,
    id: 'simon', cat: 'kids', emoji: '💡',
    name: '记忆亮灯',
    desc: '经典序列记忆游戏！彩灯按顺序闪，照着按一遍，一轮多一步。答错灯会重新教你，适合 3-8 岁。',
    tags: ['序列记忆', '专注模仿', '3-8 岁'],
    rules: '① 四盏彩灯会按顺序闪，认真看；② 灯闪完后照同样的顺序按一遍；③ 每成功一轮就多一步，达到目标步数即通关；④ 按错了不扣分，灯会重新演示一遍。',
    guide: '① 边看边念出颜色或形状，把视觉记忆变成语言记忆；② 分组记：4 步拆成 2+2 更容易；③ 按错重放时只专注「刚才没记住的那几步」；④ 手指提前悬停在第一盏灯上方，抢出反应时间。',
    tip: '让孩子边看边小声念出来："红、黄、绿……"念出来记得更牢，也锻炼语言表达！',
    single: true, noLevel: true, dom: true,
    sideOptions: [['1', '萌新 · 记 5 步'], ['2', '进阶 · 记 7 步'], ['3', '挑战 · 记 9 步']],
    mount: mount
  };
})(window);
