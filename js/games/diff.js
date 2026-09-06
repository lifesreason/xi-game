/* 火眼找不同：两幅"完整场景画"里有几处不一样，全找出来！
   场景由背景 + 多个配景元素组成（海边/公园/太空/农场/海底/游乐园六套），
   差异类型：换了图案 / 挪了位置 / 少了东西。程序自动出题，每一轮都新鲜。
   只点右边图里不一样的地方。三档：差异更多、场景元素更多。共 6 轮。 */
(function (global) {
  var ROUNDS = 6;
  /* 每个场景：背景渐变 + 元素 [emoji, x%, y%, 可替换的相近图案] */
  var SCENES = [
    {
      name: '海边', bg: 'linear-gradient(180deg,#aee3ff 0%,#cdefff 46%,#5fb6e8 47%,#3f9ad6 72%,#f2dfa7 73%,#e8cf8e 100%)',
      els: [['🌞', 12, 12, '🌙'], ['☁️', 62, 10, '⛅'], ['⛵', 45, 52, '🚢'], ['🌴', 85, 46, '🌵'], ['🐚', 20, 82, '⭐'], ['🦀', 55, 84, '🦐'], ['🐠', 70, 66, '🐡'], ['🏖️', 90, 84, '🏝️']]
    },
    {
      name: '公园', bg: 'linear-gradient(180deg,#aee3ff 0%,#d8f3ff 52%,#8fd06f 53%,#6dbb4e 100%)',
      els: [['🌳', 14, 48, '🌲'], ['🌻', 40, 76, '🌹'], ['🐿️', 68, 72, '🐰'], ['🦋', 84, 22, '🐝'], ['⛲', 52, 56, '🏠'], ['🚲', 20, 82, '🛴'], ['🐦', 76, 40, '🐔'], ['🌈', 30, 14, '☁️']]
    },
    {
      name: '太空', bg: 'linear-gradient(180deg,#0f1730 0%,#22315e 60%,#31427a 100%)',
      dark: true,
      els: [['🚀', 22, 55, '🛸'], ['🪐', 74, 30, '🌍'], ['🌟', 45, 18, '💫'], ['👾', 60, 74, '🤖'], ['☄️', 86, 62, '🌕'], ['🌙', 12, 24, '⭐'], ['🛰️', 40, 82, '🔭']]
    },
    {
      name: '农场', bg: 'linear-gradient(180deg,#aee3ff 0%,#e6f6ff 44%,#a8d977 45%,#7fbf57 78%,#c9a36a 79%,#b08a52 100%)',
      els: [['🐄', 16, 56, '🐖'], ['🐔', 46, 72, '🐤'], ['🚜', 72, 62, '🚚'], ['🌾', 88, 82, '🌱'], ['🍎', 30, 82, '🍅'], ['🐑', 58, 50, '🐐'], ['🏠', 84, 30, '🏘️'], ['🌻', 8, 30, '🌷']]
    },
    {
      name: '海底', bg: 'linear-gradient(180deg,#3aa7dd 0%,#2b8ec9 50%,#1f6fa8 100%)',
      els: [['🐠', 18, 30, '🐡'], ['🐙', 70, 62, '🦑'], ['🦀', 30, 82, '🦐'], ['🌿', 52, 78, '🌱'], ['🐚', 84, 84, '⭐'], ['🐳', 46, 38, '🐬'], ['🪸', 8, 66, '🪨'], ['🫧', 88, 20, '💧']]
    },
    {
      name: '游乐园', bg: 'linear-gradient(180deg,#ffd9f0 0%,#fff3c8 46%,#c8ecff 47%,#a8ddff 100%)',
      els: [['🎡', 18, 42, '🎠'], ['🎈', 60, 16, '🎉'], ['🍦', 40, 74, '🍭'], ['🎪', 78, 52, '🎦'], ['🐻', 20, 80, '🐼'], ['🎯', 62, 62, '🎆'], ['🎠', 88, 24, '🪁'], ['🍨', 8, 58, '🧁']]
    }
  ];

  var LEVELS = {
    '1': { label: '萌新 · 3 处不同', k: 3 },
    '2': { label: '进阶 · 4 处不同', k: 4 },
    '3': { label: '挑战 · 5 处不同', k: 5 }
  };

  function ri(n) { return (Math.random() * n) | 0; }

  function mount(host, api) {
    var G = { levelKey: '1', round: 0, diffs: [], found: [], scene: null, over: false, wrongTaps: 0, startTs: Date.now(), locked: false };
    var wrap = null, rightBox = null;

    /* 生成一轮差异：从场景元素里挑 k 个，随机套一种变化 */
    function makeRound() {
      var lv = LEVELS[G.levelKey];
      var scene = SCENES[ri(SCENES.length)];
      G.scene = scene;
      var idxs = [];
      while (idxs.length < Math.min(lv.k, scene.els.length - 2)) {
        var p = ri(scene.els.length);
        if (idxs.indexOf(p) < 0) idxs.push(p);
      }
      G.diffs = idxs.map(function (p) {
        var el = scene.els[p];
        var type = ['swap', 'move', 'gone'][ri(3)];
        var d = { pos: p, type: type };
        if (type === 'swap') d.emoji = el[3];
        else if (type === 'move') {
          d.x = Math.max(6, Math.min(92, el[1] + (ri(2) ? 1 : -1) * (14 + ri(8))));
          d.y = Math.max(8, Math.min(90, el[2] + (ri(2) ? 1 : -1) * (12 + ri(8))));
        }
        return d;
      });
      G.found = [];
    }

    function elRight(i) {
      var el = G.scene.els[i];
      for (var j = 0; j < G.diffs.length; j++) {
        if (G.diffs[j].pos !== i) continue;
        var d = G.diffs[j];
        if (d.type === 'swap') return { emoji: d.emoji, x: el[1], y: el[2] };
        if (d.type === 'move') return { emoji: el[0], x: d.x, y: d.y };
        if (d.type === 'gone') return null;
      }
      return { emoji: el[0], x: el[1], y: el[2] };
    }

    function sceneNode(which) {
      /* which: 'left' | 'right' */
      var box = document.createElement('div');
      box.className = 'df-scene' + (G.scene.dark ? ' df-dark' : '');
      box.innerHTML = '<div class="df-scenename">' + G.scene.name + (which === 'left' ? ' · 原图' : ' · 找这里 🔍') + '</div>';
      var n = G.scene.els.length;
      for (var i = 0; i < n; i++) {
        var el = G.scene.els[i];
        var right = which === 'right';
        var view = right ? elRight(i) : { emoji: el[0], x: el[1], y: el[2] };
        var isDiffPos = right && G.diffs.some(function (d) { return d.pos === i; });
        if (right && isDiffPos && view === null) {
          /* 消失型：在原位置放一个隐形的点按区 */
          var ghost = document.createElement('button');
          ghost.type = 'button';
          ghost.className = 'df-el df-ghost';
          ghost.style.left = el[1] + '%';
          ghost.style.top = el[2] + '%';
          bindTap(ghost, i);
          box.appendChild(ghost);
          continue;
        }
        var s = document.createElement(right ? 'button' : 'div');
        s.type = right ? 'button' : null;
        s.className = 'df-el' + (right ? ' df-tap' : '') + (right && G.found.indexOf(i) >= 0 ? ' found' : '');
        s.textContent = view.emoji;
        s.style.left = view.x + '%';
        s.style.top = view.y + '%';
        if (right) bindTap(s, i);
        box.appendChild(s);
      }
      return box;
    }

    function bindTap(node, pos) {
      node.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        tapEl(pos, node, e.clientX, e.clientY);
      });
    }

    function build() {
      if (wrap) wrap.remove();
      wrap = document.createElement('div');
      wrap.className = 'df-wrap';
      wrap.innerHTML =
        '<div class="df-title">两幅画有 ' + G.diffs.length + ' 处不一样：换了图案、挪了位置、少了东西。点点右图里奇怪的地方！</div>' +
        '<div class="df-panels"></div>' +
        '<div class="df-fb"></div>';
      var panels = wrap.querySelector('.df-panels');
      panels.appendChild(sceneNode('left'));
      rightBox = sceneNode('right');
      panels.appendChild(rightBox);
      host.appendChild(wrap);
      refreshFb();
    }

    function refreshFb() {
      wrap.querySelector('.df-fb').textContent =
        '第 ' + (G.round + 1) + ' / ' + ROUNDS + ' 轮 · 已找到 ' + G.found.length + ' / ' + G.diffs.length + ' 处';
    }

    function tapEl(pos, node, cx, cy) {
      if (G.over || G.locked) return;
      var isDiff = G.diffs.some(function (d) { return d.pos === pos; });
      if (!isDiff || G.found.indexOf(pos) >= 0) {
        if (G.found.indexOf(pos) < 0) {
          Fx.shake(node);
          Fx.vibrate(6);
          G.wrongTaps++;
          Sfx.click();
        }
        return;
      }
      G.found.push(pos);
      node.classList.add('found');
      if (node.classList.contains('df-ghost')) {
        node.classList.add('ghost-found');
        node.textContent = '💭';
      }
      Sfx.pop();
      Fx.vibrate(15);
      Fx.burst(node, '✨', 4);
      refreshFb();
      if (G.found.length >= G.diffs.length) {
        G.locked = true;
        if (G.round + 1 >= ROUNDS) {
          global.setTimeout(finish, 700);
        } else {
          wrap.querySelector('.df-fb').textContent = '太厉害了！全找到啦，下一幅画马上来～';
          global.setTimeout(function () {
            G.locked = false;
            G.round++;
            makeRound();
            build();
            update();
          }, 1300);
        }
      }
    }

    function finish() {
      G.over = true;
      Fx.confetti({ count: 110 });
      Sfx.win();
      api.over('win', {
        moves: ROUNDS * LEVELS[G.levelKey].k,
        sec: Math.round((Date.now() - G.startTs) / 1000),
        score: LEVELS[G.levelKey].label + ' · 点错 ' + G.wrongTaps + ' 次'
      });
      update();
    }

    function update() {
      var lv = LEVELS[G.levelKey];
      api.status(G.over ? '全部找到啦！' : '第 ' + (G.round + 1) + ' / ' + ROUNDS + ' 轮 · 已找到 ' + G.found.length + ' / ' + G.diffs.length + ' 处');
      api.info('<b>' + lv.label + ' · 场景找不同</b>　点错 <b>' + G.wrongTaps + '</b> 次（没关系！）<br>' +
        '仔细比一比两幅画：有没有<b>换了图案</b>、<b>挪了位置</b>、<b>少了东西</b>？共 ' + ROUNDS + ' 轮，每轮一幅新场景。');
      api.changed();
    }

    return {
      restart: function (o) {
        G.levelKey = String((o && o.side) || G.levelKey || '1');
        if (!LEVELS[G.levelKey]) G.levelKey = '1';
        G.round = 0; G.over = false; G.wrongTaps = 0; G.locked = false;
        G.startTs = Date.now();
        makeRound();
        build();
        update();
      },
      undo: function () { api.toast('找不同不用悔棋，慢慢看～'); },
      hint: function () {
        if (G.over) return;
        var left = G.diffs.filter(function (d) { return G.found.indexOf(d.pos) < 0; });
        if (!left.length) { api.toast('这一幅都找到啦！'); return; }
        var d = left[ri(left.length)];
        var nodes = rightBox.querySelectorAll('.df-el');
        var target = nodes[d.pos];   /* DOM 顺序与场景元素顺序一致 */
        if (target) {
          target.classList.add('pat-hint');
          global.setTimeout(function () { target.classList.remove('pat-hint'); }, 1600);
        }
        var msg = { swap: '有一个图案被换成别的啦', move: '有一个东西被挪了位置', gone: '有一个东西不见啦' }[d.type];
        api.toast('💡 ' + msg + '，找找看！');
      },
      resign: function () {
        if (G.over) return;
        G.over = true;
        api.over('lose', { moves: G.round, sec: Math.round((Date.now() - G.startTs) / 1000) });
      },
      serialize: function () { return { v: 2, lv: G.levelKey, round: G.round, ts: G.startTs }; },
      restore: function (d) { return false; },
      destroy: function () { if (wrap) wrap.remove(); },
      redraw: function () {}
    };
  }

  global.Games = global.Games || {};
  global.Games.diff = {
    id: 'diff', cat: 'kids', emoji: '🔍',
    name: '火眼找不同',
    desc: '两幅完整场景画找不同：换了图案、挪了位置、少了东西！六套场景自动出题，每一轮都新鲜，适合 4-8 岁。',
    tags: ['观察比较', '专注力', '4-8 岁'],
    rules: '① 左右两幅画几乎一样，但有几处被偷偷改过；② 点右图中不一样的地方：换了图案、挪了位置、少了东西都算；③ 点错只晃一下不扣分；④ 每轮找齐后进入下一幅，共 6 幅。',
    guide: '① 分区扫描：先比天空/上半部，再比地面/下半部；② 一行一行横向对照，视线像扫描仪一样移动；③ 特别注意「该有而没有」的东西——消失型差异最容易被忽略；④ 数量守恒：两边元素总数对不上，差异就在附近。',
    tip: '教孩子按区域对比：先看天上，再看地上，最后看角落—— systematic 地扫一遍比乱看快得多！',
    single: true, noLevel: true, dom: true,
    sideOptions: [['1', '萌新 · 3 处不同'], ['2', '进阶 · 4 处不同'], ['3', '挑战 · 5 处不同']],
    mount: mount
  };
})(window);
