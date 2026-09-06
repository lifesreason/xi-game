/* 规律排排看：给 4-5 岁小朋友的找规律接龙游戏。
   看一排小图标，猜猜"?"处应该是谁。三档难度：
   萌新 = ABAB 交替；进阶 = ABC / AABB / ABB；挑战 = 数量递增 1,2,3,?
   每轮 8 题，答错不扣分只鼓励，答对有小星星！ */
(function (global) {
  var ROUND = 8;
  var POOLS = {
    easy: ['🍎', '🍌', '🐸', '🌻', '🐟', '🚗', '🎈', '⭐'],
    mid: ['🐭', '🦊', '🧸', '🍭', '🍇', '⚽', '🚀', '🐝', '🌈', '🍪']
  };
  var LEVELS = {
    '1': { label: '萌新 · ABAB', gen: genAB },
    '2': { label: '进阶 · ABC', gen: genABC },
    '3': { label: '挑战 · 数数看', gen: genCount }
  };

  function ri(n) { return (Math.random() * n) | 0; }
  function pick(arr, n) {
    var cp = arr.slice(), out = [];
    while (out.length < n && cp.length) out.push(cp.splice(ri(cp.length), 1)[0]);
    return out;
  }

  /* ABAB / AABB / ABB 交替 */
  function genAB() {
    var pool = POOLS.easy, a = pool[ri(pool.length)], b = pool[ri(pool.length)];
    while (b === a) b = pool[ri(pool.length)];
    var kinds = [['A', 'B', 'A', 'B'], ['A', 'A', 'B', 'B'], ['A', 'B', 'B', 'A']];
    var kind = kinds[ri(kinds.length)];
    var seq = kind.map(function (k) { return k === 'A' ? a : b; });
    return buildQ(seq, seq[3], [a, b, pick(POOLS.easy.concat(POOLS.mid), 1)[0]]);
  }
  /* ABC 循环 */
  function genABC() {
    var trio = pick(POOLS.mid, 3);
    var seq = [trio[0], trio[1], trio[2], trio[0], trio[1]];
    return buildQ(seq, trio[2], [trio[2], trio[0], trio[1]]);
  }
  /* 数量递增：1 个、2 个、3 个 → ?（选项为不同数量的同款图案，练点数） */
  function genCount() {
    var e = POOLS.easy.concat(POOLS.mid)[ri(POOLS.easy.length + POOLS.mid.length)];
    var seq = [e, e + e, e + e + e];
    var wrongs = [2, 3, 5].sort(function () { return Math.random() - 0.5; }).slice(0, 2);
    var opts = [e + e + e + e].concat(wrongs.map(function (n) { return e.repeat(n); }));
    return { seq: seq, ans: e + e + e + e, opts: opts.sort(function () { return Math.random() - 0.5; }) };
  }
  function buildQ(seq, ans, opts) {
    return { seq: seq, ans: ans, opts: opts.slice().sort(function () { return Math.random() - 0.5; }) };
  }

  function mount(host, api) {
    var G = { qs: [], idx: 0, correct: 0, over: false, level: '1', locked: false, startTs: Date.now() };
    var wrap = null;

    function makeRound() {
      var gen = LEVELS[G.level].gen;
      var qs = [];
      for (var i = 0; i < ROUND; i++) qs.push(gen());
      return qs;
    }

    function build() {
      if (wrap) wrap.remove();
      wrap = document.createElement('div');
      wrap.className = 'pat-wrap';
      wrap.innerHTML =
        '<div class="pat-title">小眼睛看一看：问号处应该是谁呀？</div>' +
        '<div class="pat-board"></div>' +
        '<div class="pat-opts"></div>' +
        '<div class="pat-fb"></div>';
      host.appendChild(wrap);
      renderQ();
    }

    function renderQ() {
      var q = G.qs[G.idx];
      var board = wrap.querySelector('.pat-board');
      board.innerHTML = '';
      /* 数量题：每格显示一组（多个 emoji） */
      q.seq.forEach(function (item, i) {
        var isQ = i === q.seq.length - 1;
        var cell = document.createElement('div');
        cell.className = 'pat-cell' + (isQ ? ' pat-q' : '');
        cell.textContent = isQ ? '?' : (Array.isArray(item) ? item.join('') : item);
        board.appendChild(cell);
      });
      var opts = wrap.querySelector('.pat-opts');
      opts.innerHTML = '';
      q.opts.forEach(function (o) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'pat-opt';
        b.textContent = o;
        b.onclick = function () { choose(o, b); };
        opts.appendChild(b);
      });
      var fb = wrap.querySelector('.pat-fb');
      fb.textContent = '第 ' + (G.idx + 1) + ' / ' + G.qs.length + ' 题 · 已得 ' + G.correct + ' 颗小星星 ⭐';
    }

    function choose(o, btn) {
      if (G.over || G.locked) return;
      var q = G.qs[G.idx];
      G.locked = true;
      if (o === q.ans) {
        G.correct++;
        btn.classList.add('pat-right');
        Sfx.pop();
        Fx.vibrate(15);
        Fx.burst(btn, '⭐', 5);
        wrap.querySelector('.pat-fb').textContent = ['答对啦，你真棒！', '小脑袋瓜真聪明！', '哇，又对了！', '厉害呀，继续！'][ri(4)];
      } else {
        btn.classList.add('pat-wrong');
        Fx.shake(btn);
        wrap.querySelector('.pat-fb').textContent = '没关系！正确的是亮起来的那个，再试一次肯定行～';
        /* 高亮正确项帮助学习 */
        Array.prototype.forEach.call(wrap.querySelectorAll('.pat-opt'), function (b) {
          if (b.textContent === q.ans) b.classList.add('pat-right');
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
            score: '对 ' + G.correct + '/' + G.qs.length, perfect: perfect
          });
          renderQ();
        } else renderQ();
      }, o === q.ans ? 650 : 1400);
    }

    function update() {
      api.status(G.over ? '完成！' : '规律接龙 · 第 ' + (G.idx + 1) + ' 题');
      api.info('<b>' + LEVELS[G.level].label + '</b>　已得 <b>' + G.correct + '</b> 颗小星星<br>' +
        '看一排图案的规律，从下面三个选项里挑出问号处的那个。答错也没关系，会告诉你答案哦！');
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
      undo: function () { api.toast('找规律不用悔棋，想一想再选～'); },
      hint: function () {
        if (G.over) return;
        var q = G.qs[G.idx];
        Array.prototype.forEach.call(wrap.querySelectorAll('.pat-opt'), function (b) {
          if (b.textContent === q.ans) { b.classList.add('pat-hint'); global.setTimeout(function () { b.classList.remove('pat-hint'); }, 1800); }
        });
        api.toast('亮一亮的那个就是答案哦，再想想为什么～');
      },
      resign: function () {
        if (G.over) return;
        G.over = true;
        api.over('lose', { moves: G.idx, sec: Math.round((Date.now() - G.startTs) / 1000) });
      },
      serialize: function () { return { v: 1, lv: G.level, idx: G.idx, correct: G.correct, ts: G.startTs }; },
      restore: function (d) { return false; /* 幼儿游戏不恢复残局，每次都是新的一轮 */ },
      destroy: function () { if (wrap) wrap.remove(); },
      redraw: function () {}
    };
  }

  global.Games = global.Games || {};
  global.Games.pattern = {
    id: 'pattern', cat: 'kids', emoji: '🐣',
    name: '规律排排看',
    desc: '给小宝贝的找规律游戏！看一排小图案，猜猜问号处是谁。全程鼓励式引导，适合 3-6 岁。',
    tags: ['找规律', '逻辑启蒙', '3-6 岁'],
    rules: '① 看一排小图案，找出排列的规律；② 点下方三个选项中「问号处应该是谁」；③ 答错没关系，正确答案会亮出来再讲一遍；④ 每轮 8 题，拿满 8 颗小星星最棒！',
    guide: '① 先数数量再比种类：是 ABAB 交替还是 ABB 递增；② 大声念出来：「苹果、香蕉、苹果、香蕉……」念到问号答案自然出现；③ 挑战档的数数题从 1、2、3 递增，答案往往是 4 个；④ 拿不准时用排除法，先去掉明显不对的。',
    tip: '陪孩子一起大声念出图案："苹果、香蕉、苹果、香蕉……"念到问号处，答案就自己冒出来啦！',
    single: true, noLevel: true, dom: true,
    sideOptions: [['1', '萌新 · ABAB'], ['2', '进阶 · ABC'], ['3', '挑战 · 数数看']],
    mount: mount
  };
})(window);
