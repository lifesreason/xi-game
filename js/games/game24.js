/* 24 点：四张数字牌，加减乘除凑出 24
   内置有理数求解器，保证每局一定有解；两两组合式操作，适合孩子 */
(function (global) {
  var RANGES = {
    '9': { max: 9, label: '入门 · 数字 1~9' },
    '10': { max: 10, label: '标准 · 数字 1~10' },
    '13': { max: 13, label: '挑战 · 数字 1~13' }
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- 有理数（分数）运算 ---------- */
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a || 1; }
  function rat(p, q) { if (q === 0) return null; if (q < 0) { p = -p; q = -q; } var g = gcd(p, q); return { p: p / g, q: q / g }; }
  function rAdd(a, b) { return rat(a.p * b.q + b.p * a.q, a.q * b.q); }
  function rSub(a, b) { return rat(a.p * b.q - b.p * a.q, a.q * b.q); }
  function rMul(a, b) { return rat(a.p * b.p, a.q * b.q); }
  function rDiv(a, b) { return b.p === 0 ? null : rat(a.p * b.q, a.q * b.p); }
  function rEq24(a) { return a && a.p === 24 && a.q === 1; }
  function rStr(a) { return a.q === 1 ? String(a.p) : a.p + '/' + a.q; }

  /* 求解：items 为 [{v:有理数, e:表达式}]，返回表达式字符串或 null */
  function solveR(items) {
    var memo = {};
    function key(arr) { return arr.map(function (x) { return x.v.p + '/' + x.v.q; }).sort().join('|'); }
    function go(arr) {
      if (arr.length === 1) return rEq24(arr[0].v) ? arr[0].e : null;
      var k = key(arr);
      if (memo[k] !== undefined) return memo[k];
      var n = arr.length;
      for (var i = 0; i < n; i++) {
        for (var j = 0; j < n; j++) {
          if (i === j) continue;
          var rest = [];
          for (var m = 0; m < n; m++) if (m !== i && m !== j) rest.push(arr[m]);
          var A = arr[i], B = arr[j];
          var ops = [
            ['+', rAdd(A.v, B.v), A.e + '+' + B.e],
            ['×', rMul(A.v, B.v), '(' + A.e + ')×(' + B.e + ')'],
            ['−', rSub(A.v, B.v), A.e + '−' + B.e],
            ['÷', rDiv(A.v, B.v), '(' + A.e + ')÷(' + B.e + ')']
          ];
          for (var o = 0; o < ops.length; o++) {
            if (!ops[o][1]) continue;
            var r = go(rest.concat([{ v: ops[o][1], e: ops[o][2] }]));
            if (r) { memo[k] = r; return r; }
          }
        }
      }
      memo[k] = null;
      return null;
    }
    return go(items);
  }

  function solve(nums) {
    return solveR(nums.map(function (x) { return { v: rat(x, 1), e: String(x) }; }));
  }

  function mount(host, api) {
    var S = null, box = null, timer = null;

    function startTimer() {
      stopTimer();
      timer = setInterval(function () {
        if (!S || S.over) return;
        S.sec = Math.floor((Date.now() - S.t0) / 1000);
        update();
      }, 1000);
    }
    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
    function elapsed() { return S.over ? S.sec : Math.floor((Date.now() - S.t0) / 1000); }
    function fmtTime(s) { var m = (s / 60) | 0; return m + ':' + ('0' + (s % 60)).slice(-2); }

    function newDeal(max) {
      var nums = null, expr = null;
      for (var t = 0; t < 400 && !expr; t++) {
        nums = [];
        for (var i = 0; i < 4; i++) nums.push(1 + ((Math.random() * max) | 0));
        expr = solve(nums);
      }
      if (!expr) { nums = [3, 3, 8, 8]; expr = solve(nums); } /* 经典保底 */
      S = {
        max: max, label: RANGES[String(max)].label,
        orig: nums.slice(), solExpr: expr,
        nums: nums.map(function (n) { return { p: n, q: 1, e: String(n) }; }),
        sel: -1, op: null, hist: [], log: [],
        moves: 0, sec: 0, t0: Date.now(), over: false
      };
      build();
      startTimer();
      update();
    }

    function build() {
      box = document.createElement('div');
      box.className = 'n24-wrap';
      host.innerHTML = '';
      host.appendChild(box);
      render();
    }

    function render() {
      var html = '<div class="n24-goal">🎯 用四张牌算出 <b>24</b></div><div class="n24-tiles">';
      S.nums.forEach(function (t, i) {
        var label = rStr(t);
        html += '<button type="button" class="n24-tile' + (i === S.sel ? ' sel' : '') + '" data-i="' + i + '">' +
          '<b>' + label + '</b>' + (t.e !== label ? '<i>' + esc(t.e) + '</i>' : '') + '</button>';
      });
      html += '</div><div class="n24-ops">';
      [['+', '+'], ['−', '−'], ['×', '×'], ['÷', '÷']].forEach(function (o) {
        html += '<button type="button" class="n24-op' + (S.op === o[0] ? ' sel' : '') + '" data-op="' + o[0] + '">' + o[1] + '</button>';
      });
      html += '</div>';
      html += '<div class="n24-log">' + (S.log.length
        ? S.log.map(function (l) { return '<div>✔ ' + esc(l) + '</div>'; }).join('')
        : '<div class="muted small">点第一张牌 → 点运算符 → 点第二张牌，两步一算。</div>') + '</div>';
      box.innerHTML = html;

      Array.prototype.forEach.call(box.querySelectorAll('.n24-tile'), function (b) {
        b.onclick = function () { tapTile(Number(b.dataset.i)); };
      });
      Array.prototype.forEach.call(box.querySelectorAll('.n24-op'), function (b) {
        b.onclick = function () { tapOp(b.dataset.op); };
      });
    }

    function tapTile(i) {
      if (!S || S.over) return;
      if (S.sel < 0) {
        S.sel = i;
        Sfx.click();
        render();
        return;
      }
      if (!S.op) {
        if (i === S.sel) { S.sel = -1; render(); return; } /* 再点取消 */
        S.sel = i; Sfx.click(); render();
        return;
      }
      if (i === S.sel) { api.toast('要选两张不同的牌'); return; }
      combine(S.sel, i);
    }

    function tapOp(op) {
      if (!S || S.over) return;
      if (S.sel < 0) { api.toast('先点一张数字牌'); return; }
      S.op = op;
      Sfx.click();
      render();
    }

    function snapshot() {
      S.hist.push({
        nums: S.nums.map(function (t) { return { p: t.p, q: t.q, e: t.e }; }),
        log: S.log.slice(), moves: S.moves, sel: S.sel, op: S.op
      });
    }

    var OPS = {
      '+': function (a, b) { return [rAdd(a, b), function (x, y) { return x.e + '+' + y.e; }]; },
      '−': function (a, b) { return [rSub(a, b), function (x, y) { return x.e + '−' + y.e; }]; },
      '×': function (a, b) { return [rMul(a, b), function (x, y) { return '(' + x.e + ')×(' + y.e + ')'; }]; },
      '÷': function (a, b) { return [rDiv(a, b), function (x, y) { return '(' + x.e + ')÷(' + y.e + ')'; }]; }
    };

    function combine(i, j) {
      snapshot();
      var a = S.nums[i], b = S.nums[j];
      var pair = OPS[S.op](a, b);
      var v = pair[0];
      if (!v) { api.toast('这个除法算不出来（除数是 0），换一个吧'); S.op = null; render(); return; }
      var expr = pair[1](a, b);
      var rest = [];
      S.nums.forEach(function (t, k) { if (k !== i && k !== j) rest.push(t); });
      rest.push({ p: v.p, q: v.q, e: expr });
      S.nums = rest;
      S.log.push(expr + ' = ' + rStr(v));
      S.moves++;
      S.sel = -1; S.op = null;
      Sfx.click();
      update();
      if (S.nums.length === 1) {
        if (rEq24(S.nums[0])) {
          S.over = true; S.sec = elapsed(); stopTimer();
          var isRec = global.Store && Store.setBest('game24.time.' + S.max, S.sec, true);
          api.over('win', {
            moves: S.moves, sec: S.sec, score: S.nums[0].e + '=24',
            newRecord: isRec ? '本档最快新纪录：' + S.sec + ' 秒解出' : ''
          });
        } else {
          api.toast('最后得到 ' + rStr(S.nums[0]) + '，不是 24。点「悔棋」换条路试试！');
        }
      }
    }

    function update() {
      if (!S) return;
      api.status(S.over ? '完成！' + fmtTime(S.sec) : S.moves + ' 次运算 · ' + fmtTime(elapsed()));
      api.info(
        '难度：<b>' + S.label + '</b>　运算：<b>' + S.moves + '</b> 次<br>' +
        '先点一张牌，再点 <b>+ − × ÷</b>，最后点另一张牌。<br>一定有解，慢慢想！'
      );
      api.changed();
      render();
    }

    return {
      restart: function (o) {
        var max = Number(o && o.side) || (S ? S.max : 10);
        if (!RANGES[String(max)]) max = 10;
        newDeal(max);
      },
      restore: function (data) {
        try {
          if (!data || !RANGES[String(data.max)] || !data.nums || !data.orig) return false;
          S = {
            max: data.max, label: RANGES[String(data.max)].label,
            orig: data.orig.slice(), solExpr: data.solExpr || '',
            nums: data.nums.map(function (t) { return { p: t.p, q: t.q, e: t.e }; }),
            sel: -1, op: null, hist: [], log: (data.log || []).slice(),
            moves: data.moves || 0, sec: data.sec || 0,
            t0: Date.now() - (data.sec || 0) * 1000, over: !!data.over
          };
          build();
          if (S.over) { update(); return true; }
          startTimer();
          update();
          return true;
        } catch (e) { return false; }
      },
      serialize: function () {
        if (!S) return null;
        return {
          v: 1, kind: 'game24', max: S.max, orig: S.orig, solExpr: S.solExpr,
          nums: S.nums.map(function (t) { return { p: t.p, q: t.q, e: t.e }; }),
          log: S.log, moves: S.moves, sec: elapsed(), over: S.over, ts: Date.now()
        };
      },
      undo: function () {
        if (!S || S.over || !S.hist.length) return;
        var s = S.hist.pop();
        S.nums = s.nums; S.log = s.log; S.moves = s.moves;
        S.sel = -1; S.op = null;
        Sfx.click();
        update();
      },
      hint: function () {
        if (!S || S.over) return;
        var cur = solveR(S.nums.map(function (t) { return { v: rat(t.p, t.q), e: t.e }; }));
        if (cur) api.toast('提示：' + cur + ' = 24，想想先算哪一步！');
        else api.toast('当前剩的牌凑不出 24 了，点「悔棋」退回上一步！');
      },
      resign: function () {
        if (!S || S.over) return;
        S.over = true; S.sec = elapsed(); stopTimer();
        var expr = solve(S.orig);
        api.info('<b>' + S.label + '</b><br>这局的牌是 <b>' + S.orig.join('、') + '</b>。<br>' +
          (expr ? '一种解法：<b>' + esc(expr) + ' = 24</b>。下次一定能自己想出来！' : '这组牌无解（不该出现）。'));
        api.over('lose', { moves: S.moves, sec: S.sec, score: S.orig.join(' ') });
      },
      redraw: function () { if (S) render(); },
      destroy: function () { stopTimer(); }
    };
  }

  global.Games = global.Games || {};
  global.Games.game24 = {
    stageType: 'puzzle',
    cat: 'number',
    emoji: '🎯',
    name: '24 点',
    desc: '四张牌加减乘除凑出 24！每局都保证有解，心算能力蹭蹭涨。',
    tags: ['入门/标准/挑战', '心算', '保证有解'],
    rules: '① 用给出的四张牌，通过加减乘除算出 24；② 先点两张牌，再点一个运算符，合成一张新牌，直到只剩 24；③ 内置求解器保证每一局都有解；④ 点错了可以撤销重算。',
    guide: '① 先找能凑成 3×8、4×6、2×12、1×24 的组合；② 除法优先用大数除小数试试；③ 分数和小数合法（如 8÷(3−8÷3)），思维别被整数困住；④ 两两组合时先固定一张牌穷举运算符。',
    tip: '看到 3 和 8、4 和 6 先乘起来——凑「因数对」是 24 点最快的路。',
    single: true,
    noLevel: true,
    dom: true,
    sideOptions: [['9', '入门 · 数字 1~9'], ['10', '标准 · 数字 1~10'], ['13', '挑战 · 数字 1~13']],
    mount: mount
  };
})(window);
