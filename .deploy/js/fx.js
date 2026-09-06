/* 全站动效：彩带粒子、烟花、涟漪波纹、触觉震动、表情飘浮
   纯 Canvas + CSS 类，轻量高效无外部依赖；尊重系统「减少动态效果」偏好 */
(function (global) {
  var reduce = false;
  try {
    reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  var COLORS = ['#ff6b6b', '#ffb02e', '#39b878', '#43a7f5', '#a78bfa', '#ff8fc7', '#ffd86b', '#38bdf8'];

  /* ---------- 触觉震动反馈（移动端提升手感） ---------- */
  function vibrate(ms) {
    if (reduce) return;
    try {
      if (global.navigator && typeof global.navigator.vibrate === 'function') {
        global.navigator.vibrate(ms || 12);
      }
    } catch (e) {}
  }

  /* ---------- 彩带：全屏粒子，自动清理 ---------- */
  function confetti(opt) {
    if (reduce) return;
    opt = opt || {};
    var count = opt.count || 100;
    var cv = document.createElement('canvas');
    cv.className = 'fx-confetti';
    document.body.appendChild(cv);
    var ctx = cv.getContext('2d');
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var W = 0, H = 0;

    function size() {
      W = cv.clientWidth || global.innerWidth;
      H = cv.clientHeight || global.innerHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    global.addEventListener('resize', size);

    var ps = [];
    for (var i = 0; i < count; i++) {
      ps.push({
        x: W * (0.1 + Math.random() * 0.8),
        y: -20 - Math.random() * H * 0.45,
        w: 6 + Math.random() * 8,
        h: 10 + Math.random() * 10,
        vy: 2.2 + Math.random() * 3.4,
        vx: -1.8 + Math.random() * 3.6,
        rot: Math.random() * Math.PI * 2,
        vr: -0.15 + Math.random() * 0.3,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        a: 1
      });
    }

    var t0 = Date.now();
    (function frame() {
      var el = Date.now() - t0;
      ctx.clearRect(0, 0, W, H);
      var alive = 0;
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        p.vy += 0.048;
        p.x += p.vx + Math.sin(el / 400 + i) * 0.7;
        p.y += p.vy;
        p.rot += p.vr;
        if (el > 2200) p.a = Math.max(0, p.a - 0.018);
        if (p.y < H + 50 && p.a > 0) alive++;
        ctx.save();
        ctx.globalAlpha = p.a;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (alive > 0 && el < 6500) requestAnimationFrame(frame);
      else {
        global.removeEventListener('resize', size);
        if (cv.parentNode) cv.parentNode.removeChild(cv);
      }
    })();
  }

  /* ---------- 点击水波纹效果 (Ripple) ---------- */
  function ripple(parent, clientX, clientY, color) {
    if (reduce || !parent) return;
    var rect = parent.getBoundingClientRect();
    var rip = document.createElement('span');
    rip.className = 'fx-ripple';
    var size = Math.max(rect.width, rect.height) * 1.5;
    var x = (clientX != null ? clientX - rect.left : rect.width / 2) - size / 2;
    var y = (clientY != null ? clientY - rect.top : rect.height / 2) - size / 2;
    rip.style.width = rip.style.height = size + 'px';
    rip.style.left = x + 'px';
    rip.style.top = y + 'px';
    if (color) rip.style.borderColor = color;
    parent.appendChild(rip);
    setTimeout(function () {
      if (rip.parentNode) rip.parentNode.removeChild(rip);
    }, 600);
  }

  /* ---------- 元素弹跳 / 晃动 ---------- */
  function pulse(el, cls, ms) {
    if (!el || reduce) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, ms || 460);
  }
  function pop(el, kind) { pulse(el, 'fx-' + (kind === 'bad' ? 'bad' : 'pop'), 480); }
  function shake(el) { pulse(el, 'fx-shake', 480); }

  /* ---------- 表情飘浮：从元素位置向上飘散 ---------- */
  function burst(el, emoji, n) {
    if (!el || reduce) return;
    var r = el.getBoundingClientRect();
    n = n || 6;
    for (var i = 0; i < n; i++) {
      (function (i) {
        var s = document.createElement('span');
        s.className = 'fx-emoji';
        s.textContent = emoji || '⭐';
        s.style.left = (r.left + r.width * (0.2 + Math.random() * 0.6)) + 'px';
        s.style.top = (r.top + r.height * 0.35) + 'px';
        s.style.fontSize = (20 + Math.random() * 16) + 'px';
        s.style.setProperty('--dx', (-50 + Math.random() * 100) + 'px');
        s.style.setProperty('--rot', (-50 + Math.random() * 100) + 'deg');
        s.style.animationDelay = (i * 50) + 'ms';
        document.body.appendChild(s);
        setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 1200 + i * 50);
      })(i);
    }
  }

  /* ---------- 连击横幅（大字一闪而过） ---------- */
  function banner(text, kind) {
    if (reduce) return;
    var b = document.createElement('div');
    b.className = 'fx-banner' + (kind ? ' ' + kind : '');
    b.textContent = text;
    document.body.appendChild(b);
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 1200);
  }

  /* ---------- 星星喷泉 ---------- */
  function starFountain(x, y, count) {
    if (reduce) return;
    count = count || 12;
    var emojis = ['⭐', '✨', '🌟', '💫', '🎉'];
    for (var i = 0; i < count; i++) {
      (function (i) {
        var s = document.createElement('span');
        s.className = 'fx-emoji';
        s.textContent = emojis[(Math.random() * emojis.length) | 0];
        s.style.left = (x || (global.innerWidth / 2)) + 'px';
        s.style.top = (y || (global.innerHeight / 2)) + 'px';
        s.style.fontSize = (22 + Math.random() * 16) + 'px';
        s.style.setProperty('--dx', (-90 + Math.random() * 180) + 'px');
        s.style.setProperty('--rot', (-60 + Math.random() * 120) + 'deg');
        s.style.animationDelay = (i * 35) + 'ms';
        document.body.appendChild(s);
        setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 1300 + i * 35);
      })(i);
    }
  }

  global.Fx = {
    confetti: confetti,
    pop: pop,
    shake: shake,
    burst: burst,
    banner: banner,
    ripple: ripple,
    vibrate: vibrate,
    starFountain: starFountain,
    reduced: reduce
  };
})(window);
