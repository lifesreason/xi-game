/* 影子找朋友：给 4-5 岁小朋友的观察配对游戏。
   看黑色小影子，找到它的彩色好朋友。选项数量随难度增加。
   每轮 8 题，答错会亮出答案并鼓励，全程无挫败感。 */
(function (global) {
  var ROUND = 8;
  var ANIMALS = ['🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐸', '🐵', '🐷', '🐔', '🦄', '🐢', '🦋', '🐝', '🐞', '🐠', '🐙', '🦀', '🐬'];
  var THINGS = ['🍎', '🍌', '🍓', '🍉', '🍇', '🥕', '🌻', '🚗', '✈️', '🚀', '⚽', '🎈', '🧸', '🎁', '☂️', '🔑', '🎩', '👟'];
  var LEVELS = { '1': 3, '2': 4, '3': 6 };

  function ri(n) { return (Math.random() * n) | 0; }

  function mount(host, api) {
    var G = { qs: [], idx: 0, correct: 0, over: false, level: '1', locked: false, startTs: Date.now() };
    var wrap = null;

    function makeRound() {
      var n = LEVELS[G.level] || 3;
      var qs = [];
      for (var i = 0; i < ROUND; i++) {
        var pool = Math.random() < 0.5 ? ANIMALS : THINGS;
        var opts = [];
        var used = {};
        while (opts.length < n) {
          var e = pool[ri(pool.length)];
          if (!used[e]) { used[e] = 1; opts.push(e); }
        }
        qs.push({ ans: opts[ri(opts.length)], opts: opts.slice().sort(function () { return Math.random() - 0.5; }) });
      }
      return qs;
    }

    function build() {
      if (wrap) wrap.remove();
      wrap = document.createElement('div');
      wrap.className = 'sh-wrap';
      wrap.innerHTML =
        '<div class="sh-title">哪个彩色的，是这个黑影子的好朋友呀？</div>' +
        '<div class="sh-shadow"><span class="sh-ghost"></span></div>' +
        '<div class="sh-opts"></div>' +
        '<div class="sh-fb"></div>';
      host.appendChild(wrap);
      renderQ();
    }

    function renderQ() {
      var q = G.qs[G.idx];
      wrap.querySelector('.sh-ghost').textContent = q.ans;
      var opts = wrap.querySelector('.sh-opts');
      opts.style.setProperty('--sh-n', q.opts.length <= 3 ? 3 : q.opts.length === 4 ? 2 : 3);
      opts.innerHTML = '';
      q.opts.forEach(function (o) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'sh-opt';
        b.textContent = o;
        b.onclick = function () { choose(o, b); };
        opts.appendChild(b);
      });
      wrap.querySelector('.sh-fb').textContent = '第 ' + (G.idx + 1) + ' / ' + G.qs.length + ' 题 · 已找到 ' + G.correct + ' 个好朋友';
    }

    function choose(o, btn) {
      if (G.over || G.locked) return;
      var q = G.qs[G.idx];
      G.locked = true;
      if (o === q.ans) {
        G.correct++;
        btn.classList.add('sh-right');
        Sfx.pop();
        Fx.vibrate(15);
        Fx.burst(btn, '✨', 5);
        wrap.querySelector('.sh-fb').textContent = ['找到啦！眼睛真尖！', '太厉害了！', '又找到好朋友啦！', '真棒，就是它！'][ri(4)];
      } else {
        btn.classList.add('sh-wrong');
        Fx.shake(btn);
        wrap.querySelector('.sh-fb').textContent = '没关系！好朋友自己跳出来啦，看看它～';
        Array.prototype.forEach.call(wrap.querySelectorAll('.sh-opt'), function (b) {
          if (b.textContent === q.ans) b.classList.add('sh-right');
        });
        Sfx.click();
      }
      global.setTimeout(function () {
        G.locked = false;
        G.idx++;
        if (G.idx >= G.qs.length) {
          G.over = true;
          var perfect = G.correct === G.qs.length;
          if (perfect) { Fx.confetti({ count: 90 }); Sfx.win(); }
          api.over(G.correct >= G.qs.length * 0.7 ? 'win' : 'lose', {
            moves: G.qs.length, sec: Math.round((Date.now() - G.startTs) / 1000),
            score: '找到 ' + G.correct + '/' + G.qs.length, perfect: perfect
          });
          renderQ();
        } else renderQ();
      }, o === q.ans ? 650 : 1400);
    }

    function update() {
      api.status(G.over ? '完成！' : '影子配对 · 第 ' + (G.idx + 1) + ' 题');
      api.info('<b>影子找朋友</b>　已找到 <b>' + G.correct + '</b> 个好朋友<br>' +
        '上面是黑色小影子，下面有 ' + LEVELS[G.level] + ' 个彩色图案，点一点哪个和影子形状一样。');
      api.changed();
    }

    return {
      restart: function (o) {
        G.level = String((o && o.side) || G.level || '1');
        if (!LEVELS[G.level]) G.level = '1';
        G.qs = makeRound();
        G.idx = 0; G.correct = 0; G.over = false; G.locked = false;
        G.startTs = Date.now();
        build(); update();
      },
      undo: function () { api.toast('配对游戏不用悔棋，再找找看～'); },
      hint: function () {
        if (G.over) return;
        var q = G.qs[G.idx];
        Array.prototype.forEach.call(wrap.querySelectorAll('.sh-opt'), function (b) {
          if (b.textContent === q.ans) { b.classList.add('pat-hint'); global.setTimeout(function () { b.classList.remove('pat-hint'); }, 1800); }
        });
        api.toast('亮一亮的那个就是影子好朋友哦！');
      },
      resign: function () {
        if (G.over) return;
        G.over = true;
        api.over('lose', { moves: G.idx, sec: Math.round((Date.now() - G.startTs) / 1000) });
      },
      serialize: function () { return { v: 1, lv: G.level, idx: G.idx, correct: G.correct, ts: G.startTs }; },
      restore: function (d) { return false; },
      destroy: function () { if (wrap) wrap.remove(); },
      redraw: function () {}
    };
  }

  global.Games = global.Games || {};
  global.Games.shadow = {
    id: 'shadow', cat: 'kids', emoji: '🐰',
    name: '影子找朋友',
    desc: '观察力小挑战！看黑影子找彩色好朋友，锻炼形状辨识与专注力，适合 3-6 岁。',
    tags: ['观察配对', '形状辨识', '3-6 岁'],
    rules: '① 上方是一个黑色小影子；② 在下方找出形状一模一样的彩色图案点它；③ 答错会自动亮出好朋友，不扣分；④ 每轮 8 题，全部找到就是火眼金睛！',
    guide: '① 先看影子的轮廓特征：耳朵？尾巴？角？② 数数量：影子上有几个凸起，选项里对应几个；③ 排除法最快——明显不像的先划掉；④ 大小和朝向也是线索，影子不会缩放和旋转。',
    tip: '引导孩子说出影子的特征："这里有两只长耳朵，是不是小兔子？"把观察变成小游戏。',
    single: true, noLevel: true, dom: true,
    sideOptions: [['1', '萌新 · 3 选 1'], ['2', '进阶 · 4 选 1'], ['3', '挑战 · 6 选 1']],
    mount: mount
  };
})(window);
