/* 可爱拼图：给 3-6 岁小朋友的交换式拼图。
   一幅可爱的图画被切成小块，点两块互相交换，把图画拼完整！
   比"滑块拼图"更适合小朋友：任何两块都能换，没有死路。
   三档：2×2 / 3×3 / 4×4。支持"看一眼"原图和单块提示。 */
(function (global) {
  /* 图画：一片草地上的小房子场景（百分比定位，任何分辨率都好看） */
  /* 16 个地标锚点：保证 4×4 切块时每块至少有一个可辨识内容 */
  var SCENE_EMOJIS = [
    ['☁️', 14, 10], ['☀️', 36, 12], ['🎈', 62, 14], ['🐦', 86, 12],
    ['🌳', 10, 36], ['🏡', 38, 38], ['🌻', 64, 36], ['🦋', 88, 40],
    ['🍄', 12, 62], ['🌲', 40, 62], ['🐶', 62, 64], ['🌼', 86, 62],
    ['🌷', 14, 88], ['🐝', 38, 86], ['🐑', 64, 88], ['🌿', 86, 86]
  ];

  function mount(host, api) {
    var G = { n: 3, order: [], sel: -1, moves: 0, over: false, startTs: Date.now() };
    var wrap = null, gridEl = null, tiles = [];

    function solvedCount() {
      var k = 0;
      for (var i = 0; i < G.order.length; i++) if (G.order[i] === i) k++;
      return k;
    }
    function isSolved() { return solvedCount() === G.order.length; }

    function build() {
      if (wrap) wrap.remove();
      wrap = document.createElement('div');
      wrap.className = 'pz-wrap';
      var bar = document.createElement('div');
      bar.className = 'pz-bar';
      bar.innerHTML =
        '<button type="button" class="btn small" id="pz-peek">👁️ 看一眼</button>' +
        '<span class="pz-progress"></span>' +
        '<button type="button" class="btn small" id="pz-hint">💡 提示</button>';
      wrap.appendChild(bar);

      var picWrap = document.createElement('div');
      picWrap.className = 'pz-picwrap';
      gridEl = document.createElement('div');
      gridEl.className = 'pz-grid';
      gridEl.style.setProperty('--n', G.n);
      tiles = [];
      for (var p = 0; p < G.n * G.n; p++) {
        (function (p) {
          var t = document.createElement('div');
          t.className = 'pz-tile';
          t.dataset.pos = p;
          var scene = document.createElement('div');
          scene.className = 'pz-scene';
          var inner = '';
          for (var i = 0; i < SCENE_EMOJIS.length; i++) {
            var e = SCENE_EMOJIS[i];
            inner += '<span class="pz-el" style="left:' + e[1] + '%;top:' + e[2] + '%">' + e[0] + '</span>';
          }
          scene.innerHTML = inner;
          t.appendChild(scene);
          t.classList.add('pz-swap');
          t.dataset.pos = p;
          bindDragSwap(t, p);
          t.addEventListener('pointerup', function (e) {
            /* 未拖动的"点一下"走原有选择/交换逻辑 */
            if (!t.__dragged) tap(p, e.clientX, e.clientY);
            t.__dragged = false;
          });
          gridEl.appendChild(t);
          tiles.push({ el: t, scene: scene });
        })(p);
      }
      picWrap.appendChild(gridEl);
      /* 原图预览层 */
      var peek = document.createElement('div');
      peek.className = 'pz-peek';
      var fullScene = document.createElement('div');
      fullScene.className = 'pz-scene pz-scene-full';
      fullScene.innerHTML = gridEl.querySelector('.pz-scene').innerHTML;
      peek.appendChild(fullScene);
      picWrap.appendChild(peek);
      wrap.appendChild(picWrap);

      var tip = document.createElement('p');
      tip.className = 'muted small pz-tip';
      tip.textContent = '先点一块，再点另一块，两块就会交换位置。把图画拼回原样就赢啦！';
      wrap.appendChild(tip);

      host.appendChild(wrap);

      wrap.querySelector('#pz-peek').onclick = function () {
        Sfx.click();
        peek.classList.add('show');
        global.setTimeout(function () { peek.classList.remove('show'); }, 1600);
      };
      wrap.querySelector('#pz-hint').onclick = function () { hint(); };
      render();
    }

    function render() {
      var n = G.n;
      var done = solvedCount();
      for (var pos = 0; pos < G.order.length; pos++) {
        var piece = G.order[pos];
        var r = (piece / n) | 0, c = piece % n;
        tiles[pos].scene.style.transform = 'translate(-' + (c * 100 / n) + '%, -' + (r * 100 / n) + '%)';
        tiles[pos].el.classList.toggle('sel', pos === G.sel);
        tiles[pos].el.classList.toggle('ok', piece === pos);
      }
      wrap.querySelector('.pz-progress').textContent = '已拼好 ' + done + ' / ' + G.order.length + ' 块 · 换了 ' + G.moves + ' 次';
      api.changed();
    }

    /* 拖拽交换：按住一块拖到另一块上松手即交换；不拖动则仍是点选 */
    function bindDragSwap(el, fromPos) {
      var sx = 0, sy = 0, bx = 0, by = 0, dragging = false, pid = null, w = 0, h = 0;
      el.addEventListener('pointerdown', function (e) {
        if (G.over) return;
        e.preventDefault();
        dragging = true;
        el.__dragged = false;
        pid = e.pointerId;
        sx = e.clientX; sy = e.clientY;
        var r = el.getBoundingClientRect();
        bx = r.left; by = r.top; w = r.width; h = r.height;
        try { el.setPointerCapture(pid); } catch (err) {}
      });
      el.addEventListener('pointermove', function (e) {
        if (!dragging || e.pointerId !== pid) return;
        var dx = e.clientX - sx, dy = e.clientY - sy;
        if (!el.__dragged && Math.abs(dx) + Math.abs(dy) < 10) return;
        if (!el.__dragged) {
          el.__dragged = true;
          el.classList.add('pz-dragging');
          el.style.width = w + 'px';
          el.style.height = h + 'px';
        }
        e.preventDefault();
        el.style.left = (bx + dx) + 'px';
        el.style.top = (by + dy) + 'px';
      });
      function finish(e) {
        if (!dragging || e.pointerId !== pid) return;
        dragging = false;
        if (!el.__dragged) return;
        el.classList.remove('pz-dragging');
        el.style.left = ''; el.style.top = ''; el.style.width = ''; el.style.height = '';
        /* 隐藏拖动块本体再取落点，否则命中的永远是它自己 */
        el.style.pointerEvents = 'none';
        var target = document.elementFromPoint(e.clientX, e.clientY);
        el.style.pointerEvents = '';
        var tEl = target && target.closest ? target.closest('.pz-tile') : null;
        if (tEl && tEl !== el && !G.over) {
          var toPos = Number(tEl.dataset.pos);
          if (G.sel >= 0) { G.sel = -1; }
          var tmp = G.order[fromPos];
          G.order[fromPos] = G.order[toPos];
          G.order[toPos] = tmp;
          G.moves++;
          Sfx.place();
          Fx.vibrate(10);
          render();
          after();
        }
      }
      el.addEventListener('pointerup', finish);
      el.addEventListener('pointercancel', finish);
    }

    function tap(pos, cx, cy) {
      if (G.over) return;
      Fx.vibrate(8);
      if (G.sel < 0) {
        G.sel = pos;
        Sfx.click();
        render();
        return;
      }
      if (G.sel === pos) {
        G.sel = -1;
        Sfx.click();
        render();
        return;
      }
      /* 交换 */
      var tmp = G.order[G.sel];
      G.order[G.sel] = G.order[pos];
      G.order[pos] = tmp;
      G.moves++;
      G.sel = -1;
      Sfx.place();
      Fx.ripple(gridEl, cx, cy);
      render();
      after();
    }

    function after() {
      update();
      if (isSolved()) {
        G.over = true;
        Fx.confetti({ count: 100 });
        Sfx.win();
        api.over('win', {
          moves: G.moves,
          sec: Math.round((Date.now() - G.startTs) / 1000),
          score: G.n + '×' + G.n + ' · 换 ' + G.moves + ' 次'
        });
      }
    }

    function update() {
      api.status(G.over ? '拼好啦！' : '拼图中 · 已拼好 ' + solvedCount() + ' 块');
      api.info('<b>' + G.n + '×' + G.n + ' 可爱拼图</b>　换了 <b>' + G.moves + '</b> 次<br>' +
        '点两块互相交换，把图画拼回原样。忘记原图了就点「👁️ 看一眼」，卡住了点「💡 提示」。');
      api.changed();
    }

    function hint() {
      if (G.over) return;
      /* 找第一块不在家的，把它换回自己的位置 */
      for (var pos = 0; pos < G.order.length; pos++) {
        if (G.order[pos] !== pos) {
          var home = G.order[pos];   /* 这块拼图属于的位置 */
          var tmp = G.order[home];
          G.order[home] = G.order[pos];
          G.order[pos] = tmp;
          Sfx.jump();
          Fx.burst(tiles[home].el, '✨', 4);
          render();
          after();
          return;
        }
      }
      api.toast('全都拼好啦，你真棒！');
    }

    function shuffle() {
      var n = G.n, total = n * n, i;
      G.order = [];
      for (i = 0; i < total; i++) G.order.push(i);
      /* 随机交换打乱（交换式拼图任何排列都能还原） */
      for (i = 0; i < total * 8; i++) {
        var a = (Math.random() * total) | 0, b = (Math.random() * total) | 0;
        var t = G.order[a]; G.order[a] = G.order[b]; G.order[b] = t;
      }
      /* 保证不是已解状态，且至少一半的块不在家 */
      var wrong = total - solvedCount();
      if (wrong < Math.ceil(total * 0.6)) shuffle();
    }

    return {
      restart: function (o) {
        var key = String((o && o.side) || G.n) ;
        G.n = (key === '2' || key === '4') ? Number(key) : 3;
        G.moves = 0; G.over = false; G.sel = -1;
        G.startTs = Date.now();
        shuffle();
        build();
        update();
      },
      undo: function () { api.toast('拼图慢慢来，点两块交换就好～'); },
      hint: hint,
      resign: function () {
        if (G.over) return;
        G.over = true;
        api.over('lose', { moves: G.moves, sec: Math.round((Date.now() - G.startTs) / 1000) });
      },
      serialize: function () {
        return { v: 1, n: G.n, order: G.order.slice(), moves: G.moves, ts: G.startTs };
      },
      restore: function (d) {
        if (!d || !d.order || !d.n || d.order.length !== d.n * d.n) return false;
        G.n = d.n;
        G.order = d.order.slice();
        G.moves = d.moves || 0;
        G.over = false; G.sel = -1;
        G.startTs = d.ts || Date.now();
        build(); update();
        if (isSolved()) return false; /* 已完成的存档直接开新局 */
        return true;
      },
      destroy: function () { if (wrap) wrap.remove(); },
      redraw: function () { if (tiles.length) render(); }
    };
  }

  global.Games = global.Games || {};
  global.Games.puzzle = {
    id: 'puzzle', cat: 'kids', emoji: '🖼️',
    name: '可爱拼图',
    desc: '阳光小屋图画拼图！点两块互相交换，把图画拼回原样。比滑块拼图更简单，适合 3-6 岁。',
    tags: ['图形拼合', '观察力', '3-6 岁'],
    rules: '① 图画被切成小块并打乱了；② 点两块互相交换（也可以按住一块拖到另一块上）；③ 忘记原图点「👁️ 看一眼」；④ 全部归位即通关，「💡 提示」会帮你放好一块。',
    guide: '① 先拼四角，四角特征最明显；② 对照「看一眼」的原图，按「先外圈后内部」的顺序归位；③ 拿不准两块时，交换试试——错了解开就行；④ 4×4 时先找有 emoji 的块，纯色块最后处理。',
    tip: '先拼四角和边缘，再拼中间；随时点「看一眼」对照原图，孩子会越拼越快！',
    single: true, noLevel: true, dom: true,
    sideOptions: [['2', '萌新 · 2×2'], ['3', '进阶 · 3×3'], ['4', '挑战 · 4×4']],
    mount: mount
  };
})(window);
