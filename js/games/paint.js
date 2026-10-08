/* 魔法小画板：自由涂鸦创作。
   12 色 + 3 种笔粗细 + emoji 印章 + 橡皮 + 撤销 + 保存到相册。
   Canvas 实现，作品自动存档（刷新不丢）。没有输赢，纯创作。 */
(function (global) {
  var COLORS = ['#2b3a4a', '#ff6b6b', '#ff9f43', '#ffb02e', '#9be07a', '#39b878', '#43a7f5', '#5a8dee', '#7c5cff', '#c86bfa', '#ff8fc7', '#8a5a2b'];
  var STAMPS = ['⭐', '❤️', '🌸', '🦋', '☀️', '🌈', '🍀', '🐠', '🎈', '🐝'];

  function mount(host, api) {
    var G = { color: COLORS[0], size: 6, tool: 'brush', stamp: STAMPS[0], drawing: false, undoStack: [] };
    var wrap = null, cv = null, ctx = null, toastSave = false;

    function build() {
      if (wrap) wrap.remove();
      wrap = document.createElement('div');
      wrap.className = 'pt-wrap';

      /* 工具行 */
      var tools = document.createElement('div');
      tools.className = 'pt-tools';
      [['✏️ 画笔', 'brush'], ['🧽 橡皮', 'eraser'], ['🐾 印章', 'stamp']].forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn small pt-tool' + (G.tool === t[1] ? ' active' : '');
        b.textContent = t[0];
        b.dataset.tool = t[1];
        b.onclick = function () {
          G.tool = t[1];
          Sfx.click();
          [...wrap.querySelectorAll('.pt-tool')].forEach(function (x) { x.classList.toggle('active', x.dataset.tool === G.tool); });
          refreshStampRow();
        };
        tools.appendChild(b);
      });
      var undoB = document.createElement('button');
      undoB.type = 'button';
      undoB.className = 'btn small';
      undoB.textContent = '↩️ 撤销';
      undoB.onclick = undo;
      tools.appendChild(undoB);
      var clearB = document.createElement('button');
      clearB.type = 'button';
      clearB.className = 'btn small';
      clearB.textContent = '🗑️ 清空';
      clearB.onclick = clearAll;
      tools.appendChild(clearB);
      var saveB = document.createElement('button');
      saveB.type = 'button';
      saveB.className = 'btn small primary';
      saveB.textContent = '💾 保存';
      saveB.onclick = save;
      tools.appendChild(saveB);
      wrap.appendChild(tools);

      /* 调色盘 + 笔粗细 */
      var pal = document.createElement('div');
      pal.className = 'pt-palette';
      COLORS.forEach(function (c) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'pt-color' + (c === G.color ? ' active' : '');
        b.style.background = c;
        b.onclick = function () {
          G.color = c;
          G.tool = G.tool === 'eraser' ? 'brush' : G.tool;
          [...wrap.querySelectorAll('.pt-tool')].forEach(function (x) { x.classList.toggle('active', x.dataset.tool === G.tool); });
          Sfx.click();
          [...wrap.querySelectorAll('.pt-color')].forEach(function (x) { x.classList.toggle('active', x.style.background === b.style.background || x === b); });
        };
        pal.appendChild(b);
      });
      [4, 8, 16].forEach(function (s) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'pt-size' + (G.size === s ? ' active' : '');
        b.innerHTML = '<i style="width:' + s + 'px;height:' + s + 'px"></i>';
        b.onclick = function () {
          G.size = s;
          Sfx.click();
          [...wrap.querySelectorAll('.pt-size')].forEach(function (x) { x.classList.toggle('active', x === b); });
        };
        pal.appendChild(b);
      });
      wrap.appendChild(pal);

      /* 印章行 */
      var stamps = document.createElement('div');
      stamps.className = 'pt-stamps';
      STAMPS.forEach(function (s) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'pt-stamp';
        b.textContent = s;
        b.onclick = function () {
          G.tool = 'stamp';
          G.stamp = s;
          Sfx.click();
          [...wrap.querySelectorAll('.pt-tool')].forEach(function (x) { x.classList.toggle('active', x.dataset.tool === 'stamp'); });
          [...wrap.querySelectorAll('.pt-stamp')].forEach(function (x) { x.classList.toggle('active', x === b); });
        };
        stamps.appendChild(b);
      });
      wrap.appendChild(stamps);

      /* 画布 */
      var holder = document.createElement('div');
      holder.className = 'pt-canvaswrap';
      cv = document.createElement('canvas');
      cv.className = 'pt-canvas';
      holder.appendChild(cv);
      wrap.appendChild(holder);
      host.appendChild(wrap);

      ctx = cv.getContext('2d');
      sizeCanvas();
      bindDraw();
      refreshStampRow();
      api.changed();
    }

    function refreshStampRow() {
      if (!wrap) return;
      wrap.querySelector('.pt-stamps').style.display = G.tool === 'stamp' ? 'flex' : 'none';
    }

    function sizeCanvas() {
      var r = cv.parentElement.getBoundingClientRect();
      var dpr = Math.min(global.devicePixelRatio || 1, 2);
      var w = Math.max(240, Math.floor(r.width));
      var h = Math.max(200, Math.floor(Math.min(r.width * 1.05, 460)));
      /* 保留旧画 */
      var old = null;
      if (cv.width) { try { old = ctx.getImageData(0, 0, cv.width, cv.height); } catch (e) {} }
      cv.width = w * dpr;
      cv.height = h * dpr;
      cv.style.width = w + 'px';
      cv.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (old && old.width === cv.width) ctx.putImageData(old, 0, 0);
    }

    function canvasPos(e) {
      var r = cv.getBoundingClientRect();
      /* 画布逻辑尺寸 = CSS 尺寸（transform 里已处理 dpr），直接用相对偏移 */
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function pushUndo() {
      try {
        G.undoStack.push(cv.toDataURL());
        if (G.undoStack.length > 12) G.undoStack.shift();
      } catch (e) {}
    }

    function undo() {
      if (!G.undoStack.length) { api.toast('没有可以撤销的啦'); return; }
      var url = G.undoStack.pop();
      var img = new Image();
      img.onload = function () {
        var dpr = Math.min(global.devicePixelRatio || 1, 2);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        api.changed();
      };
      img.src = url;
      Sfx.undo();
    }

    function clearAll() {
      pushUndo();
      var dpr = Math.min(global.devicePixelRatio || 1, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cv.width / dpr, cv.height / dpr);
      Sfx.undo();
      api.changed();
    }

    function save() {
      try {
        var a = document.createElement('a');
        a.href = cv.toDataURL('image/png');
        a.download = '我的画作-' + new Date().toISOString().slice(0, 10) + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (Store.unlockBadge('paint_master')) api.toast('🎨 画作已保存！还解锁了新徽章～');
        else api.toast('🎨 画作已保存！');
        Sfx.win();
      } catch (e) {
        api.toast('保存失败，试试截图吧');
      }
    }

    function bindDraw() {
      var last = null;
      cv.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        try { cv.setPointerCapture(e.pointerId); } catch (err) {}
        pushUndo();
        var p = canvasPos(e);
        if (G.tool === 'stamp') {
          ctx.font = '42px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(G.stamp, p.x, p.y);
          Sfx.pop();
          Fx.vibrate(12);
          api.changed();
          return;
        }
        G.drawing = true;
        last = p;
        dot(p);
      });
      cv.addEventListener('pointermove', function (e) {
        if (!G.drawing) return;
        e.preventDefault();
        var p = canvasPos(e);
        stroke(last, p);
        last = p;
      });
      global.addEventListener('pointerup', function () {
        if (G.drawing) { G.drawing = false; api.changed(); }
      });
    }

    function dot(p) {
      ctx.beginPath();
      if (G.tool === 'eraser') {
        ctx.fillStyle = '#ffffff';
        ctx.arc(p.x, p.y, G.size * 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = G.color;
        ctx.arc(p.x, p.y, G.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    function stroke(a, b) {
      ctx.beginPath();
      ctx.lineWidth = G.tool === 'eraser' ? G.size * 4 : G.size;
      ctx.strokeStyle = G.tool === 'eraser' ? '#ffffff' : G.color;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    return {
      restart: function (o) {
        G.color = COLORS[0]; G.size = 6; G.tool = 'brush';
        G.undoStack = [];
        build();
        update();
      },
      pause: function () {},
      resume: function () {},
      undo: undo,
      hint: function () { api.toast('换几种颜色试试，再盖几个 emoji 印章，画面会更丰富！'); },
      resign: function () { api.toast('画板没有输赢，尽情创作吧！'); },
      serialize: function () {
        try { return { v: 1, img: cv.toDataURL('image/jpeg', 0.6), ts: Date.now() }; }
        catch (e) { return { v: 1, ts: Date.now() }; }
      },
      restore: function (d) {
        build();
        if (d && d.img) {
          var img = new Image();
          img.onload = function () {
            var r = cv.getBoundingClientRect();
            ctx.drawImage(img, 0, 0, r.width, r.height);
          };
          img.src = d.img;
        }
        update();
        return true;
      },
      destroy: function () { if (wrap) wrap.remove(); },
      redraw: function () {}
    };
  }

  global.Games = global.Games || {};
  global.Games.paint = {
    stageType: 'arcade',
    noQuickActions: true,
    id: 'paint', cat: 'create', emoji: '🎨',
    name: '魔法小画板',
    desc: '自由涂鸦创作！12 色 + 3 种笔粗细 + emoji 印章 + 橡皮撤销，作品可保存到相册。没有输赢，尽情画！',
    tags: ['创意表达', '精细动作', '全年龄'],
    rules: '① 选颜色和笔的粗细，在画布上自由涂鸦；② 「🐾 印章」模式可以盖上星星、爱心等图案；③ 画错点「↩️ 撤销」，不满意「🗑️ 清空」重来；④ 点「💾 保存」把作品存到相册，还能拿「神笔小画家」徽章！',
    guide: '① 先用大笔铺背景色块，再用细笔画细节；② 印章当「点睛」用：太阳贴左上、鱼贴水里，构图更讲究；③ 配色试试对比色（红配绿、蓝配黄）画面更活泼；④ 大胆下笔——撤销和橡皮永远等着你。',
    tip: '让孩子画今天最开心的一件事，然后用 emoji 印章"贴"上去，讲给你听——画完还能保存留念！',
    single: true, noLevel: true, dom: true,
    mount: mount
  };
})(window);
