/* 旋转水管：点击管道旋转 90°，把水从 💧 水源接到每一块管道，且不能漏水！
   生成器先用 DFS 生成一棵覆盖全盘的生成树（保证有解），再随机打乱旋转角。
   三档：5×5 / 7×7 / 9×9。接通全部即通关。 */
(function (global) {
  /* 方向位：U=1 R=2 D=4 L=8 */
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  var OPP = [4, 8, 1, 2];

  function ri(n) { return (Math.random() * n) | 0; }
  function rotCW(m) { return ((m << 1) & 15) | (m >> 3); }

  function mount(host, api) {
    var G = { n: 5, mask: [], rot: [], sol: [], source: 0, over: false, moves: 0, startTs: Date.now() };
    var wrap = null, gridEl = null, cells = [];

    function gen(n) {
      var total = n * n;
      /* DFS 生成树 */
      var conn = new Array(total).fill(0);
      var seen = new Array(total).fill(false);
      var stack = [ri(total)];
      seen[stack[0]] = true;
      var made = 1;
      while (made < total) {
        var cur = stack[stack.length - 1];
        var cx = cur % n, cy = (cur / n) | 0;
        var cand = [];
        for (var d = 0; d < 4; d++) {
          var nx = cx + DX[d], ny = cy + DY[d];
          if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
          var ni = ny * n + nx;
          if (!seen[ni]) cand.push([d, ni]);
        }
        if (!cand.length) { stack.pop(); continue; }
        var pick = cand[ri(cand.length)];
        conn[cur] |= (1 << pick[0]);
        conn[pick[1]] |= (1 << ((pick[0] + 2) % 4));
        seen[pick[1]] = true;
        stack.push(pick[1]);
        made++;
      }
      /* 打乱旋转 */
      var rot = [];
      for (var i = 0; i < total; i++) rot.push(ri(4));
      return { conn: conn, rot: rot };
    }

    function curMask(i) {
      var m = G.mask[i];
      for (var k = 0; k < G.rot[i]; k++) m = rotCW(m);
      return m;
    }

    /* 水流：从水源 BFS；返回 {wet, leaks, all} */
    function flow() {
      var n = G.n, total = n * n;
      var wet = new Array(total).fill(false);
      var leaks = 0;
      wet[G.source] = true;
      var queue = [G.source];
      while (queue.length) {
        var i = queue.shift();
        var m = curMask(i);
        var x = i % n, y = (i / n) | 0;
        for (var d = 0; d < 4; d++) {
          if (!(m & (1 << d))) continue;
          var nx = x + DX[d], ny = y + DY[d];
          if (nx < 0 || ny < 0 || nx >= n || ny >= n) { leaks++; continue; }
          var ni = ny * n + nx;
          if (!(curMask(ni) & OPP[d])) { leaks++; continue; }
          if (!wet[ni]) { wet[ni] = true; queue.push(ni); }
        }
      }
      var cnt = wet.filter(Boolean).length;
      return { wet: wet, leaks: leaks, all: cnt === total && leaks === 0 };
    }

    function build() {
      if (wrap) wrap.remove();
      wrap = document.createElement('div');
      wrap.className = 'pp-wrap';
      var bar = document.createElement('div');
      bar.className = 'pp-bar';
      wrap.appendChild(bar);
      gridEl = document.createElement('div');
      gridEl.className = 'pp-grid';
      gridEl.style.setProperty('--n', G.n);
      cells = [];
      for (var i = 0; i < G.n * G.n; i++) {
        (function (i) {
          var c = document.createElement('button');
          c.type = 'button';
          c.className = 'pp-cell';
          var inner = document.createElement('div');
          inner.className = 'pp-pipe';
          for (var d = 0; d < 4; d++) {
            var arm = document.createElement('i');
            arm.className = 'pp-arm pp-a' + d;
            inner.appendChild(arm);
          }
          var dot = document.createElement('i');
          dot.className = 'pp-dot';
          inner.appendChild(dot);
          if (i === G.source) {
            var src = document.createElement('span');
            src.className = 'pp-src';
            src.textContent = '💧';
            inner.appendChild(src);
          }
          c.appendChild(inner);
          c.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            rotate(i, e.clientX, e.clientY);
          });
          gridEl.appendChild(c);
          cells.push({ el: c, inner: inner });
        })(i);
      }
      wrap.appendChild(gridEl);
      var tip = document.createElement('p');
      tip.className = 'muted small pp-tip';
      tip.textContent = '点管道让它转 90°，把 💧 的水送到每一根管子，一处都不能漏！';
      wrap.appendChild(tip);
      host.appendChild(wrap);
      render();
    }

    function render() {
      var f = flow();
      for (var i = 0; i < cells.length; i++) {
        var inner = cells[i].inner;
        inner.style.transform = 'rotate(' + (G.rot[i] * 90) + 'deg)';
        cells[i].el.classList.toggle('wet', f.wet[i]);
        cells[i].el.classList.toggle('fixed', G.rot[i] === 0 && G.mask[i] === G.sol[i]);
      }
      wrap.querySelector('.pp-bar').innerHTML =
        '<span>💧 已接通 <b>' + f.wet.filter(Boolean).length + '</b> / ' + G.n * G.n + '</span>' +
        '<span>🔄 <b>' + G.moves + '</b> 次</span>';
      api.changed();
      return f;
    }

    function rotate(i, cx, cy) {
      if (G.over) return;
      G.rot[i] = (G.rot[i] + 1) % 4;
      G.moves++;
      Sfx.click();
      Fx.vibrate(8);
      if (cx != null) Fx.ripple(gridEl, cx, cy);
      var f = render();
      if (f.all) {
        G.over = true;
        Fx.confetti({ count: 100 });
        Sfx.win();
        api.over('win', {
          moves: G.moves, sec: Math.round((Date.now() - G.startTs) / 1000),
          score: G.n + '×' + G.n + ' · 转 ' + G.moves + ' 次'
        });
        update();
      }
    }

    function update() {
      var f = flow();
      api.status(G.over ? '全部接通！' : '💧 ' + f.wet.filter(Boolean).length + '/' + G.n * G.n + (f.leaks ? ' ⚠️漏水' : ''));
      api.info('<b>' + G.n + '×' + G.n + ' 旋转水管</b>　旋转 <b>' + G.moves + '</b> 次<br>' +
        '点击管道转 90°。目标：水从 💧 流到每一根管子，而且一个口都不能漏。变蓝 = 有水流过。');
      api.changed();
    }

    return {
      restart: function (o) {
        var key = String((o && o.side) || G.n);
        G.n = key === '7' ? 7 : key === '9' ? 9 : 5;
        var g = gen(G.n);
        G.mask = g.conn; G.rot = g.rot; G.sol = g.conn.slice();
        G.source = ri(G.n * G.n);
        /* 保证初始不是已解状态（十字管旋转无效，多试几个） */
        var guard = 0;
        while (flow().all && guard < 12) {
          var i = ri(G.rot.length);
          G.rot[i] = (G.rot[i] + 1) % 4;
          guard++;
        }
        G.moves = 0; G.over = false;
        G.startTs = Date.now();
        build();
        update();
      },
      pause: function () {},
      resume: function () {},
      undo: function () { api.toast('水管不用悔棋，转回去就好～'); },
      hint: function () {
        if (G.over) return;
        /* 找一个还没转到正确角度的块（对称管以实际 mask 为准），转到正确位置 */
        var wrong = [];
        for (var i = 0; i < G.rot.length; i++) {
          if (curMask(i) !== G.mask[i]) wrong.push(i);
        }
        if (!wrong.length) { api.toast('每根管子的角度都对啦，看看水通了没！'); return; }
        var i2 = wrong[ri(wrong.length)];
        var guard = 0;
        while (curMask(i2) !== G.mask[i2] && guard < 4) {
          G.rot[i2] = (G.rot[i2] + 1) % 4;
          guard++;
        }
        G.moves++;
        Fx.burst(cells[i2].el, '💧', 4);
        Sfx.jump();
        var f = render();
        update();
        if (f.all) {
          G.over = true;
          Fx.confetti({ count: 100 });
          Sfx.win();
          api.over('win', { moves: G.moves, sec: Math.round((Date.now() - G.startTs) / 1000), score: G.n + '×' + G.n });
        }
      },
      resign: function () {
        if (G.over) return;
        G.over = true;
        api.over('lose', { moves: G.moves, sec: Math.round((Date.now() - G.startTs) / 1000) });
      },
      serialize: function () {
        return { v: 1, n: G.n, mask: G.mask, rot: G.rot, source: G.source, moves: G.moves, ts: G.startTs };
      },
      restore: function (d) {
        if (!d || !d.mask || !d.rot || d.mask.length !== d.n * d.n) return false;
        G.n = d.n; G.mask = d.mask.slice(); G.rot = d.rot.slice();
        G.sol = d.mask.slice(); G.source = d.source || 0;
        G.moves = d.moves || 0; G.over = false;
        G.startTs = d.ts || Date.now();
        build(); update();
        return true;
      },
      destroy: function () { if (wrap) wrap.remove(); },
      redraw: function () { if (cells.length) render(); }
    };
  }

  global.Games = global.Games || {};
  global.Games.pipes = {
    id: 'pipes', cat: 'brain', emoji: '🚇',
    name: '旋转水管',
    desc: '点击管道旋转 90°，把水接到每一根管子且不能漏水！空间旋转推理，生成器保证必有解。',
    tags: ['空间推理', '连通问题', '6-10 岁'],
    rules: '① 点任意管道，它会旋转 90°；② 让水从 💧 水源流到每一根管子，而且一个开口都不能对着墙漏水；③ 变蓝 = 有水流过；④ 全部接通且无漏水即通关。',
    guide: '① 先转「死胡同」管：只有一个口的管子位置最确定；② 直管只能横或竖，先排除错误朝向；③ 从 💧 水源顺着连通的管道往外推，变蓝的部分别再乱转；④ 卡住时检查每个「拐角」是否真的对上了相邻管口。',
    tip: '先看管道形状：直管只有两个对向口，弯管有两个相邻口——先固定"死胡同"的管子最容易！',
    single: true, noLevel: true, dom: true,
    sideOptions: [['5', '萌新 · 5×5'], ['7', '进阶 · 7×7'], ['9', '挑战 · 9×9']],
    mount: mount
  };
})(window);
