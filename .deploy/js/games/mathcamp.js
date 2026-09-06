/* 口算训练营：加减乘除自动出题、计时挑战、连击鼓励、错题本重练
   四档梯度（档位选择器切换）：启蒙 10 内 → 基础 20 内 → 进阶乘法表/百内 → 挑战两位数乘除 */
(function (global) {
  var ROUND = 10;                 /* 每轮题数 */
  var WIN_RATE = 0.8;             /* 正确率达标判胜 */
  var WRONG_KEY = 'mathcamp.wrong';
  var HIST_KEY = 'mathcamp.hist';

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function ri(n) { return (Math.random() * n) | 0; }

  /* ---------- 出题器：返回 {a, op, b, ans} ---------- */
  var GEN = {
    add10: function () { var a = 1 + ri(9), b = 1 + ri(10 - a); return { a: a, op: '+', b: b, ans: a + b }; },
    sub10: function () { var a = 2 + ri(9), b = 1 + ri(a - 1); return { a: a, op: '−', b: b, ans: a - b }; },
    add20: function () {
      var a, b;
      if (Math.random() < 0.65) { /* 侧重进位加法 */
        a = 3 + ri(17); b = 1 + ri(19 - a + 1);
        if ((a % 10) + (b % 10) < 10 && a + b <= 19) { b = 10 - (a % 10) + ri(Math.max(1, 20 - a - (10 - (a % 10)))); if (a + b > 20) b = 20 - a; }
      } else { a = 1 + ri(19); b = 1 + ri(20 - a); }
      return { a: a, op: '+', b: Math.max(1, b), ans: a + Math.max(1, b) };
    },
    sub20: function () {
      var a = 2 + ri(19), b;
      if (Math.random() < 0.6 && a % 10 !== 0) b = (a % 10) + 1 + ri(Math.max(1, a - (a % 10))); /* 侧重退位 */
      else b = 1 + ri(a - 1);
      return { a: a, op: '−', b: Math.min(b, a - 1), ans: a - Math.min(b, a - 1) };
    },
    mulTable: function () { var a = 1 + ri(9), b = 1 + ri(9); return { a: a, op: '×', b: b, ans: a * b }; },
    divTable: function () { var b = 1 + ri(9), q = 1 + ri(9); return { a: b * q, op: '÷', b: b, ans: q }; },
    add100: function () { var a = 11 + ri(89), b = 1 + ri(Math.min(99, 100 - a)); return { a: a, op: '+', b: b, ans: a + b }; },
    sub100: function () { var a = 20 + ri(81), b = 9 + ri(a - 9); return { a: a, op: '−', b: b, ans: a - b }; },
    mul2x1: function () { var a = 11 + ri(89), b = 2 + ri(8); return { a: a, op: '×', b: b, ans: a * b }; },
    div2x1: function () { var b = 2 + ri(8), q = 4 + ri(46); return { a: b * q, op: '÷', b: b, ans: q }; }
  };

  var TIERS = {
    '1': { label: '启蒙 · 10 以内加减', gens: ['add10', 'sub10'] },
    '2': { label: '基础 · 20 以内加减', gens: ['add20', 'sub20'] },
    '3': { label: '进阶 · 乘法表与百内加减', gens: ['mulTable', 'divTable', 'add100', 'sub100'] },
    '4': { label: '挑战 · 两位数乘除混合', gens: ['mul2x1', 'div2x1', 'add100', 'sub100', 'mulTable'] }
  };

  function qText(q) { return q.a + ' ' + q.op + ' ' + q.b + ' = ?'; }
  function qKey(q) { return q.a + q.op + q.b; }

  /* ---------- 错题本 ---------- */
  function getWrong() { return global.Store.get(WRONG_KEY, []); }
  function addWrong(q) {
    var list = getWrong().filter(function (w) { return w.q !== qKey(q); });
    list.unshift({ q: qKey(q), ts: Date.now() });
    if (list.length > 60) list.length = 60;
    global.Store.set(WRONG_KEY, list);
  }
  function removeWrong(q) {
    global.Store.set(WRONG_KEY, getWrong().filter(function (w) { return w.q !== qKey(q); }));
  }
  function parseKey(k) {
    var m = k.match(/^(\d+)([+−×÷])(\d+)$/);
    if (!m) return null;
    var a = Number(m[1]), b = Number(m[3]), op = m[2];
    var ans = op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : (b ? a / b : 0);
    return { a: a, op: op, b: b, ans: ans };
  }

  /* ---------- 历史 ---------- */
  function getHist() { return global.Store.get(HIST_KEY, []); }
  function pushHist(rec) {
    var list = getHist(); list.unshift(rec);
    if (list.length > 20) list.length = 20;
    global.Store.set(HIST_KEY, list);
  }

  /* ---------- 游戏实例 ---------- */
  function mount(host, api) {
    var S = null, box = null, timer = null, nextT = null;

    function startTimer() {
      stopTimer();
      timer = setInterval(function () {
        if (!S || S.over) return;
        S.sec = Math.floor((Date.now() - S.t0) / 1000);
        api.status(S.idx < ROUND ? '第 ' + (S.idx + 1) + '/' + S.qs.length + ' 题 · ' + fmt(S.sec) + ' · 🔥 连对 ' + S.streak : '完成！' + fmt(S.sec));
      }, 1000);
    }
    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
    function fmt(s) { var m = (s / 60) | 0; return m + ':' + ('0' + (s % 60)).slice(-2); }

    /* 一轮题目：练习模式按档位随机；重练模式从错题本取 */
    function makeRound(tier, review) {
      var qs = [];
      if (review) {
        var wrong = getWrong();
        if (wrong.length < 3) { api.toast('错题本还空着，先练一轮吧！'); return null; }
        wrong.slice(0, ROUND).forEach(function (w) {
          var q = parseKey(w.q);
          if (q) qs.push({ q: q, review: true });
        });
      } else {
        var t = TIERS[tier];
        for (var i = 0; i < ROUND; i++) {
          var g = GEN[t.gens[ri(t.gens.length)]];
          qs.push({ q: g(), review: false });
        }
      }
      return qs;
    }

    function newRound(tier, review) {
      var qs = makeRound(tier, review);
      if (!qs) return;
      S = {
        tier: tier, tierLabel: TIERS[tier].label, review: !!review,
        qs: qs, idx: 0, correct: 0, wrongNow: [], streak: 0, bestStreak: 0,
        sec: 0, t0: Date.now(), over: false, input: '', flash: null
      };
      build();
      startTimer();
      update();
    }

    function build() {
      box = document.createElement('div');
      box.className = 'mc-wrap';
      host.innerHTML = '';
      host.appendChild(box);
      /* 结构只建一次，之后 render 只更新文字内容。
         关键：键盘节点绝不重建——否则真实触屏上 pointerdown 之后
         浏览器派发的 click 会落在重建的新节点上（守卫状态被丢弃），造成一次点击输入两次。 */
      var keysHtml = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '⌫'].map(function (k) {
        var cls = 'mc-key';
        if (k === 'C') cls += ' mc-key-clear';
        if (k === '⌫') cls += ' mc-key-del';
        return '<button type="button" class="' + cls + '" data-k="' + k + '" tabindex="-1">' + k + '</button>';
      }).join('');
      box.innerHTML =
        '<div class="mc-mode"><span class="mc-mode-label"></span>' +
        '　<button type="button" class="mc-link" data-act="switch"></button>' +
        '　<button type="button" class="mc-link" data-act="new">换一组</button></div>' +
        '<div class="mc-prog"></div>' +
        '<div class="mc-question"></div>' +
        '<div class="mc-live">' +
        '  <div class="mc-answer" tabindex="-1">' +
        '    <div class="mc-input-wrap">' +
        '      <div class="mc-input" tabindex="-1" role="textbox" aria-readonly="true"></div>' +
        '    </div>' +
        '    <button type="button" class="btn primary mc-go" tabindex="-1">确定 ✔</button>' +
        '  </div>' +
        '  <div class="mc-pad">' + keysHtml + '</div>' +
        '</div>' +
        '<div class="mc-result" hidden>' +
        '  <div class="mc-score"></div>' +
        '  <div class="muted mc-result-sub"></div>' +
        '  <div class="mc-pad mc-again"><button type="button" class="btn primary" data-act="new">🔄 再来一轮</button></div>' +
        '</div>' +
        '<div class="mc-fb" hidden></div>' +
        '<div class="mc-hist"></div>';
      bindOnce();
      render();
    }

    /* 事件只绑一次 */
    function bindOnce() {
      var go = box.querySelector('.mc-go');
      var goHit = false;
      go.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        goHit = true;
        submit();
      });
      go.addEventListener('click', function (e) {
        e.preventDefault();
        if (goHit) { goHit = false; return; }
        submit();
      });

      Array.prototype.forEach.call(box.querySelectorAll('.mc-key'), function (b) {
        var keyHit = false;
        b.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          keyHit = true;
          tapKey(b.dataset.k, e.clientX, e.clientY, b);
        });
        b.addEventListener('click', function (e) {
          e.preventDefault();
          if (keyHit) { keyHit = false; return; }
          tapKey(b.dataset.k, e.clientX, e.clientY, b);
        });
      });

      Array.prototype.forEach.call(box.querySelectorAll('[data-act]'), function (b) {
        b.onclick = function (e) {
          e.preventDefault();
          Sfx.click();
          act(b.dataset.act);
        };
      });
    }

    /* 只更新动态内容，不重建任何节点 */
    function render() {
      if (!box || !S) return;
      var q = S.qs[S.idx];
      var inRound = S.idx < S.qs.length;

      box.querySelector('.mc-mode-label').textContent = S.review ? '📕 错题重练' : '🎯 ' + S.tierLabel;
      box.querySelector('[data-act="switch"]').textContent = S.review ? '返回练习' : '错题重练';

      var prog = '';
      for (var i = 0; i < S.qs.length; i++) {
        prog += '<i class="' + (i < S.idx ? (S.marks[i] ? 'ok' : 'no') : i === S.idx ? 'cur' : '') + '"></i>';
      }
      box.querySelector('.mc-prog').innerHTML = prog;

      var qEl = box.querySelector('.mc-question');
      qEl.className = 'mc-question' + (S.flash ? ' ' + S.flash : '');
      qEl.textContent = inRound ? qText(q.q) : '本轮完成！';

      var live = box.querySelector('.mc-live');
      var result = box.querySelector('.mc-result');
      live.hidden = !inRound;
      result.hidden = inRound;
      if (inRound) {
        var inp = box.querySelector('.mc-input');
        inp.className = 'mc-input' + (S.input ? '' : ' empty');
        inp.innerHTML = (S.input ? esc(S.input) : '<span>点下方数字</span>') + '<i class="mc-caret"></i>';
      } else {
        var pct = S.qs.length ? Math.round(S.correct / S.qs.length * 100) : 0;
        var perfect = S.correct === S.qs.length;
        result.querySelector('.mc-score').className = 'mc-score' + (perfect ? ' perfect' : '');
        result.querySelector('.mc-score').textContent = S.correct + ' / ' + S.qs.length + ' · ' + pct + '%';
        result.querySelector('.mc-result-sub').textContent =
          '用时 ' + fmt(S.sec) + ' · 最佳连对 ' + S.bestStreak + (perfect ? ' 🌟 完美全对！' : '');
      }

      var fb = box.querySelector('.mc-fb');
      if (S.feedback) {
        fb.hidden = false;
        fb.className = 'mc-fb ' + S.feedback.ok;
        fb.innerHTML = S.feedback.msg;
      } else fb.hidden = true;

      box.querySelector('.mc-hist').innerHTML = histHtml();
    }

    function histHtml() {
      var h = getHist().slice(0, 5);
      if (!h.length) return '<span class="muted small">完成一轮后，这里会记录你的正确率进步曲线。</span>';
      return '<b class="small">最近成绩</b> ' + h.map(function (r) {
        return '<span class="mc-hist-item">' + Math.round(r.correct / r.total * 100) + '%<i>' +
          (r.tier ? TIERS[r.tier].label.slice(0, 2) : '') + '</i></span>';
      }).join('');
    }

    function act(a) {
      if (a === 'new') { newRound(S.tier, false); return; }
      if (a === 'switch') { newRound(S.tier, !S.review); }
    }

    function tapKey(k, cx, cy, el) {
      if (!S || S.over || S.idx >= S.qs.length) return;
      if (global.Fx) {
        global.Fx.vibrate(10);
        if (el && cx && cy) global.Fx.ripple(el, cx, cy);
      }
      Sfx.click();
      if (k === 'C') S.input = '';
      else if (k === '⌫') S.input = S.input.slice(0, -1);
      else if (S.input.length < 4) S.input += k;
      render();
    }

    function submit() {
      if (!S || S.over || S.idx >= S.qs.length) return;
      if (S.input === '') { api.toast('先输入答案'); return; }
      var q = S.qs[S.idx].q;
      var okAns = Number(S.input) === q.ans;
      S.marks = S.marks || [];
      S.marks[S.idx] = okAns;
      if (okAns) {
        S.correct++; S.streak++;
        if (S.streak > S.bestStreak) S.bestStreak = S.streak;
        if (S.qs[S.idx].review) removeWrong(q);
        var cheerMsg = '答对啦！真棒 ✨';
        if (S.streak === 3) cheerMsg = '🔥 3连对！思维飞转！';
        else if (S.streak === 5) cheerMsg = '⚡ 5连对！心算小天才！';
        else if (S.streak >= 8) cheerMsg = '👑 ' + S.streak + '连对！势如破竹！';
        S.feedback = { ok: 'good', msg: cheerMsg };
        S.flash = 'good';
        if (S.streak >= 3 && Sfx.combo) Sfx.combo(S.streak);
        else Sfx.pop();
        if (S.streak >= 5 && global.Store) global.Store.unlockBadge('math_streak');
      } else {
        S.streak = 0;
        S.wrongNow.push(qText(q));
        if (!S.qs[S.idx].review) addWrong(q);
        S.feedback = { ok: 'bad', msg: '正确答案是 <b>' + q.ans + '</b>，记在心里继续加油！' };
        S.flash = 'bad';
        Sfx.lose();
      }
      S.idx++;
      S.input = '';
      update();

      if (global.Fx) {
        var card = box.querySelector('.mc-question');
        if (okAns) {
          global.Fx.pop(card, 'good');
          if (S.streak >= 3) global.Fx.burst(card, ['⭐', '✨', '🔥'][ri(3)], 8);
        } else {
          global.Fx.shake(card);
        }
      }
      clearTimeout(nextT);
      nextT = setTimeout(function () {
        if (!S) return;
        S.feedback = null; S.flash = null;
        if (S.idx >= S.qs.length) finish();
        else { render(); api.status('第 ' + (S.idx + 1) + '/' + S.qs.length + ' 题 · ' + fmt(S.sec) + ' · 🔥 连对 ' + S.streak); }
      }, okAns ? 550 : 1300);
    }

    function finish() {
      S.over = true; stopTimer();
      var total = S.qs.length, pct = Math.round(S.correct / total * 100);
      var perfect = S.correct === total;
      if (perfect && global.Store) {
        global.Store.unlockBadge('math_master');
        global.Store.addStars(5);
      }
      if (global.Fx && perfect) global.Fx.confetti({ count: 120 });
      pushHist({ ts: Date.now(), tier: S.tier, correct: S.correct, total: total, sec: S.sec });
      api.over(pct >= WIN_RATE * 100 ? 'win' : 'lose', {
        moves: total, sec: S.sec, perfect: perfect,
        score: '对 ' + S.correct + '/' + total + ' · ' + pct + '%'
      });
      render();
    }

    function update() {
      if (!S) return;
      api.status(S.idx < S.qs.length
        ? '第 ' + (S.idx + 1) + '/' + S.qs.length + ' 题 · ' + fmt(S.sec) + ' · 🔥 连对 ' + S.streak
        : '完成！' + fmt(S.sec));
      api.info(
        '<b>' + (S.review ? '错题重练' : S.tierLabel) + '</b>　已对 <b>' + S.correct + '</b>/' + S.qs.length +
        '<br>' + (S.review
          ? '答对的题会从错题本里移除，直到清空为止！'
          : '答错会自动收进错题本，点「错题重练」专攻弱点。') +
        '<br>错题本：<b>' + getWrong().length + '</b> 题'
      );
      api.changed();
      render();
    }

    function onKey(e) {
      if (!S || S.over || S.idx >= S.qs.length) return;
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return; /* 焦点在输入框时由输入框自己处理，避免重复计数 */
      if (e.key >= '0' && e.key <= '9' && S.input.length < 4) {
        S.input += e.key; render();
      } else if (e.key === 'Backspace') {
        S.input = S.input.slice(0, -1); render();
        e.preventDefault();
      } else if (e.key === 'Enter') {
        submit();
      }
    }
    global.addEventListener('keydown', onKey);

    return {
      restart: function (o) {
        var tier = String(o && o.side) || (S ? S.tier : '2');
        if (!TIERS[tier]) tier = '2';
        newRound(tier, false);
      },
      restore: function (data) {
        try {
          if (!data || !TIERS[String(data.tier)] || !data.qs || !data.qs.length) return false;
          S = {
            tier: String(data.tier), tierLabel: TIERS[String(data.tier)].label,
            review: !!data.review,
            qs: data.qs.map(function (x) { return { q: x.q, review: !!x.review }; }),
            idx: data.idx || 0, correct: data.correct || 0,
            marks: data.marks || [], wrongNow: (data.wrongNow || []).slice(),
            streak: 0, bestStreak: data.bestStreak || 0,
            input: '', feedback: null, flash: null,
            sec: data.sec || 0, t0: Date.now() - (data.sec || 0) * 1000, over: !!data.over
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
          v: 1, kind: 'mathcamp', tier: S.tier, review: S.review,
          qs: S.qs.map(function (x) { return { q: x.q, review: !!x.review }; }),
          idx: S.idx, correct: S.correct, marks: S.marks || [],
          wrongNow: S.wrongNow, bestStreak: S.bestStreak,
          sec: S.over ? S.sec : Math.floor((Date.now() - S.t0) / 1000),
          over: S.over, ts: Date.now()
        };
      },
      undo: function () {
        /* 口算没有悔棋概念：回退上一题判定 */
        if (!S || S.over || S.idx === 0) return;
        S.idx--;
        var wasOk = S.marks && S.marks[S.idx];
        if (wasOk) { S.correct = Math.max(0, S.correct - 1); S.streak = 0; }
        S.marks[S.idx] = undefined;
        S.feedback = { ok: 'good', msg: '已回退，这题重新答' };
        Sfx.click();
        update();
      },
      hint: function () {
        if (!S || S.over || S.idx >= S.qs.length) return;
        var q = S.qs[S.idx].q;
        if (q.op === '+') api.toast('拆一拆：' + q.a + ' + ' + q.b + '，把 ' + q.b + ' 拆成「凑整」的两部分');
        else if (q.op === '−') api.toast('想加法：' + q.b + ' + ? = ' + q.a + '，缺几就是几');
        else if (q.op === '×') api.toast('背口诀：' + q.a + ' 和 ' + q.b + ' 的乘法口诀是哪句？');
        else api.toast('想乘法：' + q.b + ' × ? = ' + q.a + '，用口诀倒着想');
      },
      resign: function () {
        if (!S || S.over) return;
        S.idx = S.qs.length; finish();
      },
      redraw: function () { if (S) render(); },
      destroy: function () {
        stopTimer();
        clearTimeout(nextT);
        global.removeEventListener('keydown', onKey);
      }
    };
  }

  global.Games = global.Games || {};
  global.Games.mathcamp = {
    cat: 'number',
    emoji: '🧮',
    name: '口算训练营',
    desc: '加减乘除计时挑战！自动出题、连击奖励、错题本专攻弱点，每天 10 题口算快到飞起。',
    tags: ['加减乘除', '计时挑战', '错题本'],
    rules: '① 每轮 10 道口算题，点数字键盘输入答案后按「确定 ✔」；② 正确率 ≥ 80% 判胜，连对 3 题起有连击奖励；③ 答错的题自动收进错题本，点「错题重练」专攻弱点；④ 提示会给「凑十 / 破十 / 口诀」思路。',
    guide: '① 加法凑十：8+7 想「8+2+5」；② 减法破十：15−9 想「15−5−4」；③ 乘法背口诀、除法倒着想乘法；④ 连击时别图快——按错会断连，稳住节奏分数最高。',
    tip: '加法想「凑十」，减法想「破十」，乘除靠口诀——错的题当天重练一遍最有效。',
    single: true,
    noLevel: true,
    dom: true,
    sideOptions: [
      ['1', '启蒙 · 10 以内加减'],
      ['2', '基础 · 20 以内加减'],
      ['3', '进阶 · 乘法表与百内'],
      ['4', '挑战 · 两位数乘除']
    ],
    mount: mount
  };
})(window);
