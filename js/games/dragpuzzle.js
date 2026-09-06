/* 拖拖拼图：给 3-6 岁小朋友的拖拽式拼图。
   下方托盘里是打散的图画小块，用手指拖到上面的轮廓底板里，
   放对位置就"咔哒"吸进去！三档：2×2 / 3×2 / 3×3。
   全部放对即拼好。 */
(function (global) {
  /* 16 个地标锚点：保证 3×3 切块时每块至少有一个可辨识内容 */
  var SCENE_EMOJIS = [
    ['🌈', 12, 12], ['☀️', 38, 12], ['☁️', 64, 10], ['🎈', 88, 14],
    ['🦒', 12, 38], ['🌳', 38, 36], ['🦜', 64, 40], ['🐒', 88, 38],
    ['🦁', 14, 62], ['🌼', 40, 64], ['🌻', 62, 62], ['🌿', 88, 64],
    ['🐔', 12, 88], ['🐝', 38, 86], ['🦋', 64, 88], ['🍄', 88, 86]
  ];
  var LEVELS = {
    '1': { label: '萌新 · 4 块', cols: 2, rows: 2 },
    '2': { label: '进阶 · 6 块', cols: 3, rows: 2 },
    '3': { label: '挑战 · 9 块', cols: 3, rows: 3 }
  };

  function mount(host, api) {
    var G = { cols: 2, rows: 2, placed: 0, moves: 0, over: false, startTs: Date.now() };
    var wrap = null, boardEl = null, trayEl = null;
    var pieces = [];   /* {piece, el, homeEl, done} */

    function build() {
      if (wrap) wrap.remove();
      wrap = document.createElement('div');
      wrap.className = 'dp-wrap';
      var bar = document.createElement('div');
      bar.className = 'pz-bar';
      bar.innerHTML = '<span class="pz-progress"></span><span></span>';
      wrap.appendChild(bar);

      /* 底板：轮廓槽位 */
      var picWrap = document.createElement('div');
      picWrap.className = 'dp-boardwrap';
      boardEl = document.createElement('div');
      boardEl.className = 'dp-board';
      boardEl.style.setProperty('--c', G.cols);
      boardEl.style.setProperty('--r', G.rows);
      var n = G.cols * G.rows;
      for (var i = 0; i < n; i++) {
        var slot = document.createElement('div');
        slot.className = 'dp-slot';
        slot.dataset.piece = i;
        /* 幽灵参照图：孩子把手里的块和底板上的淡图案对照，而不是瞎试 */
        var ghost = document.createElement('div');
        ghost.className = 'dp-ghost';
        ghost.appendChild(makeScene(i));
        slot.appendChild(ghost);
        boardEl.appendChild(slot);
      }
      picWrap.appendChild(boardEl);
      wrap.appendChild(picWrap);

      /* 托盘：打散的小块 */
      trayEl = document.createElement('div');
      trayEl.className = 'dp-tray';
      wrap.appendChild(trayEl);

      var tip = document.createElement('p');
      tip.className = 'muted small pz-tip';
      tip.textContent = '用手指按住下面的小块，拖到上面同形状的轮廓里松手，放对就会吸进去！';
      wrap.appendChild(tip);
      host.appendChild(wrap);
      fill();
      render();
    }

    function makeScene(piece) {
      var n = G.cols, rows = G.rows;
      var scene = document.createElement('div');
      scene.className = 'pz-scene';
      var inner = '';
      for (var i = 0; i < SCENE_EMOJIS.length; i++) {
        var e = SCENE_EMOJIS[i];
        inner += '<span class="pz-el" style="left:' + e[1] + '%;top:' + e[2] + '%">' + e[0] + '</span>';
      }
      scene.innerHTML = inner;
      var sr = (piece / n) | 0, sc = piece % n;
      scene.style.width = n * 100 + '%';
      scene.style.height = rows * 100 + '%';
      scene.style.transform = 'translate(-' + (sc * 100 / n) + '%, -' + (sr * 100 / rows) + '%)';
      return scene;
    }
    function makePieceEl(piece) {
      var t = document.createElement('div');
      t.className = 'pz-tile dp-piece';
      t.appendChild(makeScene(piece));
      return t;
    }

    function fill() {
      pieces = [];
      trayEl.innerHTML = '';
      var n = G.cols * G.rows;
      /* 打乱顺序放入托盘 */
      var order = [];
      for (var i = 0; i < n; i++) order.push(i);
      order.sort(function () { return Math.random() - 0.5; });
      order.forEach(function (piece) {
        var el = makePieceEl(piece);
        el.dataset.piece = piece;
        trayEl.appendChild(el);
        var rec = { piece: piece, el: el, done: false };
        bindDrag(rec);
        pieces.push(rec);
      });
    }

    function bindDrag(rec) {
      var el = rec.el;
      var startX = 0, startY = 0, baseX = 0, baseY = 0, dragging = false, pid = null;
      el.addEventListener('pointerdown', function (e) {
        if (rec.done || G.over) return;
        e.preventDefault();
        dragging = true;
        pid = e.pointerId;
        var r = el.getBoundingClientRect();
        var br = trayEl.getBoundingClientRect();
        /* 转为相对 wrap 的自由定位 */
        var wr = wrap.getBoundingClientRect();
        el.style.position = 'fixed';
        el.style.left = r.left + 'px';
        el.style.top = r.top + 'px';
        el.style.width = r.width + 'px';
        el.style.height = r.height + 'px';
        el.style.zIndex = 50;
        el.classList.add('dragging');
        startX = e.clientX; startY = e.clientY;
        baseX = r.left; baseY = r.top;
        Sfx.click();
        try { el.setPointerCapture(pid); } catch (err) {}
      });
      el.addEventListener('pointermove', function (e) {
        if (!dragging || e.pointerId !== pid) return;
        e.preventDefault();
        el.style.left = (baseX + e.clientX - startX) + 'px';
        el.style.top = (baseY + e.clientY - startY) + 'px';
      });
      function finishDrag(e) {
        if (!dragging || e.pointerId !== pid) return;
        dragging = false;
        el.classList.remove('dragging');
        tryDrop(rec, e.clientX, e.clientY);
      }
      el.addEventListener('pointerup', finishDrag);
      el.addEventListener('pointercancel', finishDrag);
    }

    function tryDrop(rec, cx, cy) {
      var slots = boardEl.querySelectorAll('.dp-slot');
      var target = null;
      for (var i = 0; i < slots.length; i++) {
        var r = slots[i].getBoundingClientRect();
        if (cx >= r.left - 14 && cx <= r.right + 14 && cy >= r.top - 14 && cy <= r.bottom + 14) {
          target = slots[i];
          break;
        }
      }
      if (target && Number(target.dataset.piece) === rec.piece && !target.classList.contains('filled')) {
        /* 放对：吸附进槽位（定位交给 .snapped 类） */
        target.classList.add('filled');
        target.appendChild(rec.el);
        rec.el.classList.add('snapped');
        rec.done = true;
        G.placed++;
        G.moves++;
        Sfx.place();
        Fx.vibrate(20);
        Fx.burst(rec.el, ['✨', '⭐'][G.moves % 2], 4);
        render();
        after();
      } else {
        /* 放错：弹回托盘 */
        G.moves++;
        if (target) {
          Fx.shake(target);
          Fx.shake(rec.el);
        }
        Sfx.undo();
        rec.el.style.position = '';
        rec.el.style.left = '';
        rec.el.style.top = '';
        rec.el.style.width = '';
        rec.el.style.height = '';
        rec.el.style.zIndex = '';
        trayEl.appendChild(rec.el);
      }
    }

    function render() {
      wrap.querySelector('.pz-progress').textContent = '已拼上 ' + G.placed + ' / ' + (G.cols * G.rows) + ' 块';
      api.changed();
    }

    function after() {
      update();
      if (G.placed >= G.cols * G.rows) {
        G.over = true;
        Fx.confetti({ count: 100 });
        Sfx.win();
        api.over('win', {
          moves: G.moves,
          sec: Math.round((Date.now() - G.startTs) / 1000),
          score: G.cols + '×' + G.rows + ' · 放 ' + G.moves + ' 次'
        });
      }
    }

    function update() {
      api.status(G.over ? '拼好啦！' : '拖拖拼图 · 已拼上 ' + G.placed + ' 块');
      api.info('<b>' + LEVELS[levelKey()].label + '</b>　放了 <b>' + G.moves + '</b> 次<br>' +
        '按住托盘里的小块拖到上面的轮廓里。放错会弹回来，没关系，再试一次！');
      api.changed();
    }
    function levelKey() {
      return Object.keys(LEVELS).filter(function (k) { return LEVELS[k].cols === G.cols && LEVELS[k].rows === G.rows; })[0] || '1';
    }

    return {
      restart: function (o) {
        var key = String((o && o.side) || '1');
        var lv = LEVELS[key] || LEVELS['1'];
        G.cols = lv.cols; G.rows = lv.rows;
        G.placed = 0; G.moves = 0; G.over = false;
        G.startTs = Date.now();
        build();
        update();
      },
      pause: function () {},
      resume: function () {},
      undo: function () { api.toast('拖拖拼图不用悔棋，再拖一次就好～'); },
      hint: function () {
        if (G.over) return;
        /* 亮出第一块还没放的块的轮廓槽位 */
        var slots = boardEl.querySelectorAll('.dp-slot:not(.filled)');
        var rec = pieces.find(function (p) { return !p.done; });
        if (!rec || !slots.length) return;
        for (var i = 0; i < slots.length; i++) {
          if (Number(slots[i].dataset.piece) === rec.piece) {
            slots[i].classList.add('pat-hint');
            global.setTimeout(function (s) { return function () { s.classList.remove('pat-hint'); }; }(slots[i]), 1800);
            break;
          }
        }
        api.toast('亮一亮的轮廓就是这块的位置，拖过去吧！');
      },
      resign: function () {
        if (G.over) return;
        G.over = true;
        api.over('lose', { moves: G.moves, sec: Math.round((Date.now() - G.startTs) / 1000) });
      },
      serialize: function () { return { v: 1, c: G.cols, r: G.rows, placed: G.placed, ts: G.startTs }; },
      restore: function (d) { return false; },
      destroy: function () { if (wrap) wrap.remove(); },
      redraw: function () { if (wrap) render(); }
    };
  }

  global.Games = global.Games || {};
  global.Games.dragpuzzle = {
    id: 'dragpuzzle', cat: 'kids', emoji: '🧸',
    name: '拖拖拼图',
    desc: '用手指把打散的图画小块拖进轮廓底板，放对就"咔哒"吸住！最经典的幼儿拼图玩法，锻炼手眼协调。',
    tags: ['拖拽拼图', '手眼协调', '3-6 岁'],
    rules: '① 上方是轮廓底板（有淡色参照），下方托盘里是打散的小块；② 按住小块拖到底板上对应的轮廓里松手；③ 放对会「咔哒」吸住，放错会弹回托盘；④ 全部放对即拼好！',
    guide: '① 先拼最好认的块（太阳、屋顶、大动物）；② 拖动时对准底板上淡色图案的「特征点」再松手；③ 拼上一块后，邻接的块会变得更好认——由已知推未知；④ 放错会弹回，大胆试错没有惩罚。',
    tip: '让孩子先找"最好认"的一块（比如太阳、屋顶），拼对了再找下一块，成就感最重要！',
    single: true, noLevel: true, dom: true,
    sideOptions: [['1', '萌新 · 4 块'], ['2', '进阶 · 6 块'], ['3', '挑战 · 9 块']],
    mount: mount
  };
})(window);
