/* 推理密码 Mastermind：破译隐藏的颜色密码。
   密码 4 格 · 6 种颜色 · 不重复 · 最多 8 次尝试。
   每次猜测后给出反馈：🟣 颜色对位置也对；⚪ 颜色对位置不对。
   纯自绘色盘，不使用软键盘；支持悔棋（撤销上一次猜测）。 */
(function (global) {
  var LEN = 4, COLORS = 6, TRIES = 8;
  var CEmoji = ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣'];
  var CName = ['红', '橙', '黄', '绿', '蓝', '紫'];

  function mount(host, api) {
    var G = {
      code: [], guesses: [], cur: [],
      startTs: Date.now(), over: false
    };
    var wrap = null, histEl = null, curEl = null, padEl = null, fbEl = null;

    function newCode() {
      var pool = [0, 1, 2, 3, 4, 5], out = [];
      for (var i = 0; i < LEN; i++) {
        var k = (Math.random() * pool.length) | 0;
        out.push(pool.splice(k, 1)[0]);
      }
      return out;
    }

    function feedback(guess, code) {
      var exact = 0, near = 0;
      var gc = guess.slice(), cc = code.slice();
      for (var i = 0; i < LEN; i++) if (gc[i] === cc[i]) { exact++; gc[i] = cc[i] = -1; }
      for (var j = 0; j < LEN; j++) {
        if (gc[j] < 0) continue;
        var idx = cc.indexOf(gc[j]);
        if (idx >= 0) { near++; cc[idx] = -1; }
      }
      return { exact: exact, near: near };
    }

    /* ---------- DOM ---------- */
    function build() {
      if (wrap) wrap.remove();
      wrap = document.createElement('div');
      wrap.className = 'mm-wrap';

      var legend = document.createElement('div');
      legend.className = 'mm-legend';
      legend.innerHTML = '🟣 颜色且位置都对　⚪ 颜色对但位置不对　·　密码 ' + LEN + ' 格，' + TRIES + ' 次机会';
      wrap.appendChild(legend);

      histEl = document.createElement('div');
      histEl.className = 'mm-history';
      wrap.appendChild(histEl);

      fbEl = document.createElement('div');
      fbEl.className = 'mm-fb';
      wrap.appendChild(fbEl);

      curEl = document.createElement('div');
      curEl.className = 'mm-cur';
      wrap.appendChild(curEl);

      padEl = document.createElement('div');
      padEl.className = 'mm-pad';
      for (var c = 0; c < COLORS; c++) {
        (function (c) {
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'mm-color';
          b.innerHTML = '<span class="mm-dot">' + CEmoji[c] + '</span>';
          b.title = CName[c];
          b.onclick = function () { pick(c); };
          padEl.appendChild(b);
        })(c);
      }
      var del = document.createElement('button');
      del.type = 'button'; del.className = 'mm-color mm-act';
      del.textContent = '⌫';
      del.onclick = function () {
        if (G.over || !G.cur.length) return;
        G.cur.pop(); Sfx.click(); renderCur();
      };
      padEl.appendChild(del);
      var go = document.createElement('button');
      go.type = 'button'; go.className = 'mm-color mm-act mm-go';
      go.textContent = '提交';
      go.onclick = submit;
      padEl.appendChild(go);
      wrap.appendChild(padEl);

      host.appendChild(wrap);
      renderHist(); renderCur();
    }

    function pick(c) {
      if (G.over || G.cur.length >= LEN) return;
      if (G.cur.indexOf(c) >= 0) { api.toast('密码里颜色不重复哦'); return; }
      G.cur.push(c);
      Sfx.click();
      Fx.vibrate(8);
      renderCur();
    }

    function submit() {
      if (G.over) return;
      if (G.cur.length < LEN) { api.toast('先选满 ' + LEN + ' 个颜色'); return; }
      var fb = feedback(G.cur, G.code);
      G.guesses.push({ g: G.cur.slice(), fb: fb });
      G.cur = [];
      Sfx.click();
      renderHist(); renderCur();

      if (fb.exact === LEN) {
        G.over = true;
        Fx.burst(curEl, '🎉', 12);
        api.over('win', { moves: G.guesses.length, sec: elapsed(), score: '剩 ' + (TRIES - G.guesses.length) + ' 次余量' });
        return;
      }
      if (G.guesses.length >= TRIES) {
        G.over = true;
        revealCode();
        api.toast('密码是：' + G.code.map(function (c) { return CName[c]; }).join(' '));
        api.over('lose', { moves: G.guesses.length, sec: elapsed() });
        return;
      }
      fbEl.textContent = '第 ' + (G.guesses.length + 1) + ' 次尝试 · 剩 ' + (TRIES - G.guesses.length) + ' 次机会';
    }

    function revealCode() {
      var row = document.createElement('div');
      row.className = 'mm-row mm-reveal';
      var pegs = '';
      for (var i = 0; i < LEN; i++) pegs += '<span class="mm-peg">' + CEmoji[G.code[i]] + '</span>';
      row.innerHTML = '<span class="mm-no">🔑</span><span class="mm-pegs">' + pegs + '</span><span class="mm-pins">密码揭晓</span>';
      histEl.appendChild(row);
    }

    function renderHist() {
      if (!histEl) return;
      histEl.innerHTML = '';
      G.guesses.forEach(function (h, n) {
        var row = document.createElement('div');
        row.className = 'mm-row';
        var pegs = h.g.map(function (c) { return '<span class="mm-peg">' + CEmoji[c] + '</span>'; }).join('');
        var pins = '';
        for (var i = 0; i < h.fb.exact; i++) pins += '<span class="mm-pin exact">🟣</span>';
        for (var j = 0; j < h.fb.near; j++) pins += '<span class="mm-pin near">⚪</span>';
        row.innerHTML = '<span class="mm-no">' + (n + 1) + '</span><span class="mm-pegs">' + pegs + '</span><span class="mm-pins">' + (pins || '—') + '</span>';
        histEl.appendChild(row);
      });
      histEl.scrollTop = histEl.scrollHeight;
    }

    function renderCur() {
      if (!curEl) return;
      var html = '';
      for (var i = 0; i < LEN; i++) {
        html += '<span class="mm-peg' + (i < G.cur.length ? ' set' : ' empty') + '">' +
          (i < G.cur.length ? CEmoji[G.cur[i]] : '·') + '</span>';
      }
      curEl.innerHTML = html;
      var go = padEl && padEl.querySelector('.mm-go');
      if (go) go.classList.toggle('ready', G.cur.length === LEN && !G.over);
    }

    function elapsed() { return Math.round((Date.now() - G.startTs) / 1000); }

    function update() {
      api.status(G.over ? '本局结束' : '第 ' + (G.guesses.length + 1) + ' / ' + TRIES + ' 次尝试');
      api.info('密码有 <b>' + LEN + '</b> 格、<b>' + COLORS + '</b> 种颜色且<b>不重复</b>。<br>' +
        '从下面的色盘点选颜色，选满后点「提交」。🟣 = 颜色位置都对，⚪ = 颜色对位置不对。');
      api.changed();
    }

    return {
      restart: function () {
        G.code = newCode();
        G.guesses = []; G.cur = []; G.over = false;
        G.startTs = Date.now();
        build(); update();
      },
      undo: function () {
        if (G.over || !G.guesses.length) { api.toast('没有可以撤销的猜测'); return; }
        G.guesses.pop();
        Sfx.click();
        renderHist(); update();
      },
      hint: function () {
        if (G.over) return;
        /* 提示：揭示一个还没猜对的位置 */
        var known = [];
        G.guesses.forEach(function (h) { h.g.forEach(function (c, i) { if (c === G.code[i]) known[i] = true; }); });
        var cands = [];
        for (var i = 0; i < LEN; i++) if (!known[i]) cands.push(i);
        if (!cands.length) { api.toast('对照之前的反馈推一推，答案就在眼前！'); return; }
        var pos = cands[(Math.random() * cands.length) | 0];
        api.toast('💡 提示：第 ' + (pos + 1) + ' 格是「' + CName[G.code[pos]] + '」' + CEmoji[G.code[pos]]);
      },
      resign: function () {
        if (G.over) return;
        G.over = true;
        revealCode();
        api.over('lose', { moves: G.guesses.length, sec: elapsed() });
      },
      serialize: function () {
        return { v: 1, code: G.code, guesses: G.guesses, cur: G.cur, ts: G.startTs };
      },
      restore: function (d) {
        if (!d || !d.code || d.code.length !== LEN) return false;
        /* 已用尽机会的对局不恢复，直接开新局 */
        if ((d.guesses || []).length >= TRIES) return false;
        G.code = d.code.slice();
        G.guesses = (d.guesses || []).map(function (h) { return { g: h.g.slice(), fb: { exact: h.fb.exact, near: h.fb.near } }; });
        G.cur = (d.cur || []).slice();
        G.over = false;
        G.startTs = d.ts || Date.now();
        build(); update();
        return true;
      },
      destroy: function () { if (wrap) wrap.remove(); },
      redraw: function () {}
    };
  }

  global.Games = global.Games || {};
  global.Games.mastermind = {
    cat: 'number',
    id: 'mastermind', emoji: '🕵️',
    name: '推理密码',
    desc: '破译隐藏的颜色密码！根据每轮反馈逐步逼近答案，锻炼演绎推理与排除法。',
    tags: ['演绎推理', '排除法', '8 次机会'],
    rules: '① 密码有 4 格、6 种颜色、不重复；② 点色盘选颜色，选满后「提交」；③ 🟣 = 颜色和位置都对，⚪ = 颜色对但位置不对；④ 8 次内破译即胜，按错可以悔棋重来。',
    guide: '① 前两轮先探颜色：固定换位法，如 1234 → 1567，快速锁定用色；② 反馈相同时优先排除已知颜色；③ 用「假设-验证」：每次提交前在纸上推演各种可能；④ 剩两次机会时只做有把握的验证，别赌运气。',
    tip: '先用固定套路探色：前几轮专注找出「有哪些颜色」，再集中调整「位置」。',
    single: true, noLevel: true, dom: true,
    mount: mount
  };
})(window);
