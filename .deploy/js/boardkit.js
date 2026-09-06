/* 画布工具：自适应尺寸 / 高清屏 / 点击坐标 / 主题配色 */
(function (global) {
  var THEMES = {
    bright: {
      board: '#f7dca9', boardEdge: '#e0b978', line: '#8a5a2b', grid: '#8a5a2b',
      text: '#2b3a4a', black: '#22262e', white: '#fdfdfd', red: '#d94f45', blue: '#2f7ed8',
      hi: '#ff5d5d', mark: '#ff4d4f', last: '#3aa0ff', star: '#8a5a2b'
    },
    wood: {
      board: '#e3ba7c', boardEdge: '#c99a58', line: '#5c3a1c', grid: '#5c3a1c',
      text: '#3a2a18', black: '#241a10', white: '#fbf3e2', red: '#b8412f', blue: '#2a6fb0',
      hi: '#e0483c', mark: '#e04a3a', last: '#2f86d8', star: '#5c3a1c'
    },
    night: {
      board: '#33415c', boardEdge: '#2a3550', line: '#8ea3c2', grid: '#8ea3c2',
      text: '#e8eef7', black: '#151b27', white: '#eef3fa', red: '#ef6b60', blue: '#62b0e8',
      hi: '#ff7a6e', mark: '#ff6b6b', last: '#62b0e8', star: '#8ea3c2'
    }
  };

  function colors() {
    var t = document.documentElement.getAttribute('data-theme') || 'bright';
    return THEMES[t] || THEMES.bright;
  }

  /**
   * host       容器元素
   * opts.aspect 高/宽 比例
   * opts.draw(ctx, W, H, C) 绘制回调
   * opts.click(x, y, W, H)  点击回调（CSS 像素坐标）
   */
  function create(host, opts) {
    host.innerHTML = '';
    var canvas = document.createElement('canvas');
    canvas.className = 'board-canvas';
    host.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, ro = null;

    var api = {
      canvas: canvas, ctx: ctx,
      get w() { return W; }, get h() { return H; },
      redraw: function () {
        if (!W) return; /* 首次 resize 前尺寸为 0，绘制无意义还可能出负半径 */
        var C = colors();
        ctx.clearRect(0, 0, W, H);
        if (opts.draw) opts.draw(ctx, W, H, C);
      }
    };

    function resize() {
      var ar = opts.aspect || 1;
      var cw = host.clientWidth || 320;
      /* 容器高度按「可用宽度 × 宽高比」自适应，让竖长棋盘（象棋/跳棋）也能吃满宽度；
         上限 75% 视口高，保证控制按钮不被挤出屏幕。CSS 里的固定高度仅作无 JS 兜底 */
      var idealH = Math.round(cw * ar);
      var capH = Math.round((global.innerHeight || 800) * 0.75);
      var wantH = Math.max(200, Math.min(idealH, capH));
      if (Math.abs(host.clientHeight - wantH) > 1) host.style.height = wantH + 'px';
      var ch = host.clientHeight || 320;
      var w, h;
      if (cw * ar <= ch) { w = cw; h = cw * ar; } else { h = ch; w = ch / ar; }
      w = Math.max(200, Math.floor(w)); h = Math.max(160, Math.floor(h));
      W = w; H = h;
      var dpr = Math.min(global.devicePixelRatio || 1, 2.5);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      api.redraw();
    }

    function onClick(ev) {
      var r = canvas.getBoundingClientRect();
      var p = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
      var clientX = p.clientX, clientY = p.clientY;
      var x = (clientX - r.left) * (W / r.width);
      var y = (clientY - r.top) * (H / r.height);
      if (global.Fx) {
        global.Fx.vibrate(8);
        global.Fx.ripple(host, clientX, clientY);
      }
      if (opts.click) opts.click(x, y, W, H);
    }
    canvas.addEventListener('click', onClick);

    if (global.ResizeObserver) {
      ro = new ResizeObserver(function () { resize(); });
      ro.observe(host);
    }
    /* 视口高度变化（软键盘、旋转、浏览器工具栏收展）也可能改变高度上限 */
    global.addEventListener('resize', resize);
    setTimeout(resize, 0);
    api.destroy = function () {
      if (ro) ro.disconnect();
      global.removeEventListener('resize', resize);
      canvas.removeEventListener('click', onClick);
      host.style.height = '';
    };
    api.resize = resize;
    return api;
  }

  /* 圆角矩形（兼容老浏览器） */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* 带立体感的棋子 */
  function stone(ctx, x, y, r, fill, ring) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y + r * 0.12, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fill();
    var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
    g.addColorStop(0, lighten(fill, 45));
    g.addColorStop(0.65, fill);
    g.addColorStop(1, darken(fill, 22));
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    if (ring !== false) {
      ctx.lineWidth = Math.max(1, r * 0.09);
      ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.stroke();
    }
    ctx.restore();
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hex2rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function lighten(h, p) {
    var c = hex2rgb(h);
    return 'rgb(' + c.map(function (v) { return clamp(Math.round(v + (255 - v) * p / 100), 0, 255); }).join(',') + ')';
  }
  function darken(h, p) {
    var c = hex2rgb(h);
    return 'rgb(' + c.map(function (v) { return clamp(Math.round(v * (1 - p / 100)), 0, 255); }).join(',') + ')';
  }

  global.BoardKit = {
    create: create, colors: colors, roundRect: roundRect, stone: stone,
    lighten: lighten, darken: darken, clamp: clamp
  };
})(window);
