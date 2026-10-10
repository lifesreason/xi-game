/* 写作乐园：错字啄木鸟（L1）+ 词语炼金炉（L4）+ 标点小交警（L2）+ 连词对对碰（L3）
   依据 docs/WRITING-PRD.md §6/§9/§14：
   - L1「句子里的虫子」点错字，变体：点虫 / 二选一 / 句子体检（无虫句）
   - L4「把 1★ 词炼成 2★3★」，变体：三选一炼金 / ABB 挖空
   - L2「标点小交警」拖标点进句中空位（拖拽 + 点选双通道），空位数 = 标点数
   - L3「连词对对碰」前后半句配对 / 关联词填空 / 「然后改造师」
   - 知识点调度器（§14.2）：未见过 > 低星 > 间隔到期；L1/L4 一轮 8 题覆盖 ≥4 知识点，
     L2/L3 一轮 6 题全对即胜（PRD §5.2）
   - 错字本答对 2 次移除；词卡图鉴按单元收集；进步曲线
   全程 Pointer 按钮交互，绝不唤起系统键盘 */
(function (global) {
  var D = global.WRITING_DATA || {};
  var ROUND = 8;                     /* L1/L4 每轮题数（PRD §15 回合示例为 8 题） */
  var ROUND2 = 6;                    /* L2/L3 每轮题数（PRD §5.2：6 题全对即胜） */
  var WIN_RATE = 0.8;                /* L1/L4 ≥80% 判胜 */
  var SEEN_MAX = 48;                 /* 同题面近期去重池 */

  var KP_KEY = 'writing.kp';         /* 知识点掌握 { kp: {s,seen,last} } */
  var WRONG_KEY = 'writing.wrong';   /* 错字本 */
  var CARDS_KEY = 'writing.cards';   /* 词卡图鉴 */
  var HIST1_KEY = 'writing.hist1';   /* L1 进步曲线 */
  var HIST2_KEY = 'writing.hist2';
  var HIST3_KEY = 'writing.hist3';
  var HIST4_KEY = 'writing.hist4';
  var SEEN_KEY = 'writing.seen';     /* {t1:[id],t2:[id],t3:[id],t4:[id]} 近期题面 */
  var COUNT_KEY = 'writing.counts';  /* 徽章计数 */

  /* 复习间隔（天），按星级递进 —— §14.2 螺旋 */
  var GAP = [1, 3, 7, 14];
  var TIERS = {
    '1': { label: '🐦 捉虫 · 萌新', level: 't1', units: [1, 2, 3], cleanRate: 0.12 },
    '2': { label: '🐦 捉虫 · 进阶', level: 't1', units: [4, 5, 6], cleanRate: 0.2 },
    '3': { label: '🐦 捉虫 · 挑战', level: 't1', units: null, cleanRate: 0.25 },
    '4': { label: '⚗️ 炼金 · 萌新', level: 't4', t: 1 },
    '5': { label: '⚗️ 炼金 · 进阶', level: 't4', t: 2 },
    '6': { label: '⚗️ 炼金 · 挑战', level: 't4', t: 3 },
    '7': { label: '🚦 标点 · 萌新', level: 't2', t: 1 },
    '8': { label: '🚦 标点 · 进阶', level: 't2', t: 2 },
    '9': { label: '🚦 标点 · 挑战', level: 't2', t: 3 },
    '10': { label: '🔗 连词 · 萌新', level: 't3', t: 1 },
    '11': { label: '🔗 连词 · 进阶', level: 't3', t: 2 },
    '12': { label: '🔗 连词 · 挑战', level: 't3', t: 3 }
  };
  /* L2 标点小汽车托盘：萌新只考句末；进阶逗号切分；挑战全车型（多出的车是干扰） */
  var P_TRAYS = { 1: ['。', '？', '！'], 2: ['，', '。', '？'], 3: ['，', '。', '？', '！', '、'] };
  var HIST_KEYS = { t1: HIST1_KEY, t2: HIST2_KEY, t3: HIST3_KEY, t4: HIST4_KEY };
  var GROUPS = ['心情', '动作', '外貌神态', '天气季节', '景物场面'];
  var UNIT_NAMES = {};
  (D.units || []).forEach(function (u) { UNIT_NAMES[u.id] = u.name; });

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function ri(n) { return (Math.random() * n) | 0; }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = ri(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function fmt(s) { var m = (s / 60) | 0; return m + ':' + ('0' + (s % 60)).slice(-2); }
  function stars(n) { var r = ''; for (var i = 0; i < 3; i++) r += i < n ? '★' : '☆'; return r; }

  /* ---------- 存取 ---------- */
  function getKp() { return global.Store.get(KP_KEY, {}); }
  function setKp(k) { global.Store.set(KP_KEY, k); }
  function getWrong() { return global.Store.get(WRONG_KEY, []); }
  function setWrong(l) { global.Store.set(WRONG_KEY, l.slice(0, 60)); }
  function getCards() { return global.Store.get(CARDS_KEY, {}); }
  function getHist(key) { return global.Store.get(key, []); }
  function pushHist(key, rec) {
    var l = getHist(key); l.unshift(rec);
    if (l.length > 20) l.length = 20;
    global.Store.set(key, l);
  }
  function getSeen() { return global.Store.get(SEEN_KEY, {}); }
  function markSeen(side, id) {
    var s = getSeen(), l = s[side] || [];
    l.unshift(id); if (l.length > SEEN_MAX) l.length = SEEN_MAX;
    s[side] = l; global.Store.set(SEEN_KEY, s);
  }
  function bumpCount(k, n) {
    var c = global.Store.get(COUNT_KEY, {});
    c[k] = (c[k] || 0) + (n || 1);
    global.Store.set(COUNT_KEY, c);
    return c;
  }

  /* ---------- 知识点调度器（§14.2 基础版） ---------- */
  /* 优先级：未见过(0) > 低星 > 间隔到期；kid 权重 ×2 预留 */
  function kpPriority(kp, stat) {
    var w = 100;
    if (!stat) return 0;                       /* 未见过最优先 */
    w += (3 - (stat.s || 0)) * 10;             /* 低星优先 */
    var gap = GAP[Math.min(3, stat.s || 0)] * 864e5;
    var due = Date.now() - (stat.last || 0) > gap;
    if (due) w -= 60;                          /* 到期复习提前 */
    return w;
  }
  /* 一轮 8 题：不同 kp 各取 1 题（覆盖 ≥4 知识点），池不足再补；
     近期出过的题面先跳过（SEEN 去重），池耗尽才放宽 */
  function pickPool(all, tier) {
    var t = TIERS[tier];
    return all.filter(function (x) {
      if (x.u && t.units && t.units.indexOf(x.u) < 0) return false;
      if (t.t && x.t !== t.t) return false;
      return true;
    });
  }
  function pickTypos(tier) {
    var pool = pickPool(D.typos || [], tier);
    var kpMap = getKp(), seen = getSeen()['t1'] || [];
    /* 按 kp 分桶，桶内优先未见过/低星/到期/未见过的题面 */
    var buckets = {};
    pool.forEach(function (x) {
      (buckets[x.kp] = buckets[x.kp] || []).push(x);
    });
    var keys = Object.keys(buckets).sort(function (a, b) {
      return kpPriority(a, kpMap[a]) - kpPriority(b, kpMap[b]);
    });
    var fresh = keys.filter(function (k) { return !kpMap[k]; });
    var chosen = fresh.slice(0, 4);           /* 先保证 ≥4 个新知识点 */
    keys.forEach(function (k) {
      if (chosen.length >= ROUND) return;
      if (chosen.indexOf(k) < 0 && kpMap[k]) chosen.push(k);
    });
    var out = [], usedIds = [];
    chosen.forEach(function (k) {
      var arr = shuffle(buckets[k]).sort(function (a, b) {
        return seen.indexOf(a.id) >= 0 ? 1 : seen.indexOf(b.id) >= 0 ? -1 : ri(2) - 1;
      });
      var item = arr[0]; if (!item) return;
      usedIds.push(item.id);
      out.push({ kind: 'typo', d: item, variant: 'find' });
    });
    /* 无虫句体检混入（cleanRate 概率） */
    if (D.clean && D.clean.length) {
      var nClean = Math.random() < TIERS[tier].cleanRate ? 2 : 1;
      shuffle(D.clean.slice()).slice(0, nClean).forEach(function (c) {
        if (out.length < ROUND) out.splice(1 + ri(out.length), 0, { kind: 'clean', d: c, variant: 'find' });
      });
    }
    while (out.length < ROUND && pool.length) {
      var x = pool[ri(pool.length)];
      if (usedIds.indexOf(x.id) < 0) { usedIds.push(x.id); out.push({ kind: 'typo', d: x, variant: 'find' }); }
      else if (pool.every(function (p) { return usedIds.indexOf(p.id) >= 0; })) break;
    }
    out.length = Math.min(out.length, ROUND);
    return out;
  }
  /* 错字本重练：出二选一变体 */
  function pickReview() {
    var wrong = getWrong();
    if (wrong.length < 3) return null;
    return shuffle(wrong.slice()).slice(0, ROUND).map(function (w) {
      var src = (D.typos || []).filter(function (t) { return t.bug === w.word && t.fix === w.fix; })[0] ||
                { text: null, bug: w.word, fix: w.fix, kp: w.kp, hint: w.hint || '' };
      return { kind: 'typo', d: src, variant: 'choose', review: true };
    });
  }
  function pickGold(tier) {
    var pool = pickPool(D.gold || [], tier);
    var kpMap = getKp(), seen = getSeen()['t4'] || [];
    var fresh = pool.filter(function (x) { return seen.indexOf(x.id) < 0; });
    var rest = pool.filter(function (x) { return seen.indexOf(x.id) >= 0; });
    var out = shuffle(fresh).concat(shuffle(rest)).slice(0, ROUND);
    /* 多样性：一轮尽量覆盖不同 kp（target 互异） */
    var seenW = [], uniq = [];
    out.forEach(function (g) {
      if (seenW.indexOf(g.w) < 0) { seenW.push(g.w); uniq.push(g); }
    });
    out.forEach(function (g) { if (uniq.length < ROUND && seenW.indexOf(g.w) < 0) { seenW.push(g.w); uniq.push(g); } });
    return uniq.slice(0, ROUND).map(function (g) {
      var useAbb = TIERS[tier].t === 1 && g.t === 1 && Math.random() < 0.4;
      return { kind: 'gold', d: g, variant: useAbb ? 'abb' : 'mix' };
    });
  }
  function pickAbb() {
    return shuffle((D.abbs || []).slice()).slice(0, ROUND).map(function (a) {
      return { kind: 'abb', d: a, variant: 'abb' };
    });
  }
  /* L2 标点：按档取题，先出没见过的题面（题面 ≠ 知识点，§14.2） */
  function pickPuncts(tier) {
    var pool = pickPool(D.puncts || [], tier);
    var seen = getSeen()['t2'] || [];
    var fresh = pool.filter(function (x) { return seen.indexOf(x.id) < 0; });
    var out = shuffle(fresh).concat(shuffle(pool.filter(function (x) { return seen.indexOf(x.id) >= 0; }))).slice(0, ROUND2);
    return out.map(function (p) { return { kind: 'punct', d: p, variant: 'traffic' }; });
  }
  /* L3 连词：萌新配对 / 进阶填空 / 挑战「然后改造师」，一轮 6 题 */
  function pickConjs(tier) {
    var pool = pickPool(D.conjs || [], tier);
    var seen = getSeen()['t3'] || [];
    var fresh = pool.filter(function (x) { return seen.indexOf(x.id) < 0; });
    var out = shuffle(fresh).concat(shuffle(pool.filter(function (x) { return seen.indexOf(x.id) >= 0; }))).slice(0, ROUND2);
    return out.map(function (c) {
      return { kind: c.t === 1 ? 'match' : c.t === 2 ? 'conjfill' : 'rethen', d: c, variant: 'conj' };
    });
  }

  /* ---------- 词卡发放 ---------- */
  function grantCard(word, from) {
    var cards = getCards();
    if (cards[word]) return false;
    var meta = (D.cards || []).filter(function (c) { return c.w === word; })[0];
    if (!meta) return false;
    cards[word] = { s: meta.s, g: meta.g, u: meta.u, from: from || 'level', ts: Date.now() };
    global.Store.set(CARDS_KEY, cards);
    var n = Object.keys(cards).length;
    if (n >= 10) global.Store.unlockBadge('writing_alchemy');
    if (n >= 40) global.Store.unlockBadge('writing_master');
    return true;
  }

  function mount(host, api) {
    var S = null, box = null, timer = null, nextT = null, tab = 'play';

    function startTimer() {
      stopTimer();
      timer = setInterval(function () {
        if (!S || S.over) return;
        S.sec = Math.floor((Date.now() - S.t0) / 1000);
        if (tab === 'play' && S.idx < S.qs.length)
          api.status('第 ' + (S.idx + 1) + '/' + S.qs.length + ' 题 · ' + fmt(S.sec) + ' · 🔥 连对 ' + S.streak);
      }, 1000);
    }
    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

    function newRound(tier, review) {
      var qs;
      var lvl = TIERS[tier].level;
      if (lvl === 't1') {
        qs = review ? pickReview() : pickTypos(tier);
        if (!qs) { api.toast('错字本还空着，先练一轮吧！'); return; }
      } else if (lvl === 't2') {
        qs = pickPuncts(tier);
        if (!qs || !qs.length) { api.toast('题库正在补充中'); return; }
      } else if (lvl === 't3') {
        qs = pickConjs(tier);
        if (!qs || !qs.length) { api.toast('题库正在补充中'); return; }
      } else {
        /* 炼金萌新档：ABB 挖空与炼金混编，保证变体丰富 */
        if (tier === '4' && Math.random() < 0.5) {
          qs = shuffle(pickAbb().slice(0, 3).concat(pickGold(tier))).slice(0, ROUND);
        } else qs = pickGold(tier);
        if (!qs || !qs.length) { api.toast('题库正在补充中'); return; }
      }
      S = {
        tier: tier, tierLabel: TIERS[tier].label, review: !!review,
        level: review ? 't1' : lvl,
        qs: qs, idx: 0, correct: 0, marks: [], streak: 0, bestStreak: 0,
        sec: 0, t0: Date.now(), over: false, feedback: null, flash: null, fix: null,
        tried: 0, pickedWhy: null, lock: false, os: null,
        /* L2/L3 子状态（全部由渲染器从状态画，For 后缀=所属题 id 防串题）：
           pp=选中的标点车 place=空位已放标点 matched/sel/rorder/done=配对
           filled/pb/tray=填空 rq/trans=改造进度 dragged=拖拽收尾标志 */
        pp: null, place: null, placeFor: '', sel: null, matched: null, matchFor: '',
        done: 0, rorder: null, filled: null, fillFor: '', tray: null, trayFor: '',
        pb: 0, rq: 0, trans: null, rethenFor: '', dragged: false
      };
      S.qs.forEach(function (q) {
        if (q.kind === 'typo') markSeen('t1', q.d.id || (q.d.bug + q.d.fix));
        else if (q.kind === 'gold') markSeen('t4', q.d.id);
        else if (q.kind === 'punct') markSeen('t2', q.d.id);
        else markSeen('t3', q.d.id);
      });
      tab = 'play';
      build();
      startTimer();
      update();
    }

    function build() {
      box = document.createElement('div');
      box.className = 'wr-wrap';
      host.innerHTML = '';
      host.appendChild(box);
      box.innerHTML =
        '<div class="wr-tabs">' +
        '  <button type="button" class="wr-tab active" data-tab="play">✏️ 练习</button>' +
        '  <button type="button" class="wr-tab" data-tab="book">📕 错字本</button>' +
        '  <button type="button" class="wr-tab" data-tab="cards">🃏 词卡图鉴</button>' +
        '  <button type="button" class="wr-tab" data-tab="trend">📈 进步</button>' +
        '</div>' +
        '<div class="wr-pane" data-pane="play">' +
        '  <div class="wr-mode"><span class="wr-mode-label"></span>' +
        '  　<button type="button" class="wr-link" data-act="switch"></button>' +
        '  　<button type="button" class="wr-link" data-act="new">换一组</button></div>' +
        '  <div class="wr-prog"></div>' +
        '  <div class="wr-question"></div>' +
        '  <div class="wr-opts"></div>' +
        '  <div class="wr-fb" hidden></div>' +
        '  <div class="wr-result" hidden>' +
        '    <div class="wr-score"></div>' +
        '    <div class="muted wr-result-sub"></div>' +
        '    <div class="wr-again"><button type="button" class="btn primary" data-act="new">🔄 再来一轮</button></div>' +
        '  </div>' +
        '  <div class="wr-hist"></div>' +
        '</div>' +
        '<div class="wr-pane" data-pane="book" hidden></div>' +
        '<div class="wr-pane" data-pane="cards" hidden></div>' +
        '<div class="wr-pane" data-pane="trend" hidden></div>';
      bindOnce();
      render();
    }

    function bindOnce() {
      Array.prototype.forEach.call(box.querySelectorAll('.wr-tab'), function (b) {
        var hit = false;
        b.addEventListener('pointerdown', function (e) { e.preventDefault(); hit = true; goTab(b.dataset.tab); });
        b.addEventListener('click', function (e) { e.preventDefault(); if (hit) { hit = false; return; } goTab(b.dataset.tab); });
      });
      Array.prototype.forEach.call(box.querySelectorAll('[data-act]'), function (b) {
        b.addEventListener('click', function (e) { e.preventDefault(); Sfx.click(); act(b.dataset.act); });
      });
      /* 选项/文字点击用事件委托：render 只替换 .wr-opts/.wr-question 内部 */
      box.addEventListener('click', function (e) {
        if (S && S.dragged) { S.dragged = false; return; }   /* 拖拽收尾不当作点击 */
        var t = e.target.closest('[data-opt],[data-ch],[data-card],[data-unit],[data-pcar],[data-slot],[data-pair],[data-bk],[data-cj],[data-robj],[data-next]');
        if (!t || !box.contains(t)) return;
        if (t.hasAttribute('data-next')) goNext();
        else if (t.hasAttribute('data-opt')) pickOpt(t);
        else if (t.hasAttribute('data-ch')) pickChar(t);
        else if (t.hasAttribute('data-unit')) renderCards(t.getAttribute('data-unit'));
        else if (t.hasAttribute('data-card')) flipCard(t);
        else if (t.hasAttribute('data-pcar')) tapCar(t);
        else if (t.hasAttribute('data-slot')) tapSlot(t);
        else if (t.hasAttribute('data-pair')) tapPair(t);
        else if (t.hasAttribute('data-bk')) tapBlank(t);
        else if (t.hasAttribute('data-cj')) tapChip(t);
        else if (t.hasAttribute('data-robj')) tapRobj(t);
      });
      /* L2 标点拖拽：Pointer 拖动小汽车 → 悬停车位磁吸高亮 → 松手入位（点选同样可用） */
      box.addEventListener('pointerdown', function (e) {
        var car = e.target.closest('[data-pcar]');
        if (!car || !S || S.lock || S.over || S.idx >= S.qs.length) return;
        var q = S.qs[S.idx];
        if (!q || q.kind !== 'punct') return;
        var mark = car.getAttribute('data-pcar');
        var ghost = document.createElement('div');
        ghost.className = 'wr-p-ghost';
        ghost.textContent = mark;
        ghost.style.left = (e.clientX - 22) + 'px';
        ghost.style.top = (e.clientY - 26) + 'px';
        document.body.appendChild(ghost);
        var over = null;
        function move(ev) {
          ghost.style.left = (ev.clientX - 22) + 'px';
          ghost.style.top = (ev.clientY - 26) + 'px';
          ghost.style.display = 'none';
          var under = document.elementFromPoint(ev.clientX, ev.clientY);
          ghost.style.display = '';
          var slot = under && under.closest ? under.closest('.wr-slot') : null;
          if (over && over !== slot) over.classList.remove('near');
          over = slot;
          if (slot) slot.classList.add('near');
        }
        function up(ev) {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', up);
          ghost.remove();
          if (over) over.classList.remove('near');
          var slot = over;
          if (!slot) {
            var under = document.elementFromPoint(ev.clientX, ev.clientY);
            slot = under && under.closest ? under.closest('.wr-slot') : null;
          }
          if (slot) { S.dragged = true; setTimeout(function () { S.dragged = false; }, 350); placeMark(Number(slot.dataset.slot), mark); }
        }
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
      });
    }

    function goTab(name) {
      tab = name;
      Array.prototype.forEach.call(box.querySelectorAll('.wr-tab'), function (b) {
        b.className = 'wr-tab' + (b.dataset.tab === name ? ' active' : '');
      });
      Array.prototype.forEach.call(box.querySelectorAll('.wr-pane'), function (p) {
        p.hidden = p.dataset.pane !== name;
      });
      Sfx.click();
      if (name === 'book') renderBook();
      if (name === 'cards') renderCards('');
      if (name === 'trend') renderTrend();
      if (name === 'play' && S) api.status(S.over ? '完成！' : '第 ' + Math.min(S.idx + 1, S.qs.length) + '/' + S.qs.length + ' 题 · 🔥 连对 ' + S.streak);
    }

    function act(a) {
      if (a === 'new') { newRound(S.tier, false); return; }
      if (a === 'switch') { newRound(S.tier, !S.review); }
    }

    /* ---------- 渲染：只更新动态区 ---------- */
    function render() {
      if (!box || !S) return;
      var inRound = S.idx < S.qs.length;
      box.querySelector('.wr-mode-label').textContent = S.review ? '📕 错字重练' : '🎯 ' + S.tierLabel;
      box.querySelector('[data-act="switch"]').textContent = S.review ? '返回练习' : '错字重练';

      var prog = '';
      for (var i = 0; i < S.qs.length; i++)
        prog += '<i class="' + (i < S.idx ? (S.marks[i] ? 'ok' : 'no') : i === S.idx ? 'cur' : '') + '"></i>';
      box.querySelector('.wr-prog').innerHTML = prog;

      var qEl = box.querySelector('.wr-question');
      var opts = box.querySelector('.wr-opts');
      var result = box.querySelector('.wr-result');
      var q = S.qs[S.idx];
      qEl.className = 'wr-question' + (S.flash ? ' ' + S.flash : '');

      if (inRound) {
        result.hidden = true; opts.hidden = false;
        /* 讲解态：答错后停在此题，opts 换成讲解卡，点「我知道了」才进下一题（题面保持原样不清屏） */
        if (S.fix) {
          opts.innerHTML = '<div class="wr-tip">📖 别急着走，看懂讲解再前进！</div>' +
            '<div class="wr-fix">' + S.fix.msg + '</div>' +
            '<div class="wr-row center"><button type="button" class="btn primary" data-next="1">我知道了，下一题 →</button></div>';
        } else if (q.kind === 'clean') {
          qEl.innerHTML = renderBugText(q.d.text);
          opts.innerHTML = '<div class="wr-tip">🐛 逐个体检——真的没虫就点下面！</div>' +
            '<div class="wr-row"><button type="button" class="wr-opt wr-clean" data-opt="clean">✔ 这句没虫</button></div>';
        } else if (q.kind === 'typo' && (q.variant === 'choose' || !q.d.text)) {
          /* 二选一：错字/正字点选（错字本重练变体） */
          qEl.innerHTML = q.d.text ? esc(q.d.text) : '选出正确的字：';
          opts.innerHTML = '<div class="wr-tip">哪个字才对？点一点！</div><div class="wr-row">' +
            '<button type="button" class="wr-opt" data-ch="' + esc(q.d.bug) + '">' + esc(q.d.bug) + '</button>' +
            '<button type="button" class="wr-opt" data-ch="' + esc(q.d.fix) + '">' + esc(q.d.fix) + '</button></div>';
        } else if (q.kind === 'typo') {
          /* 点虫：整句每字都是热区，点错只提醒不跳题 */
          qEl.innerHTML = renderBugText(q.d.text);
          opts.innerHTML = '<div class="wr-tip">🐛 错字虫藏在句子里，点它出来！没有虫才点下面～</div><div class="wr-row">' +
            '<button type="button" class="wr-opt wr-clean" data-opt="clean">✔ 这句没虫</button></div>';
        }
        if (!S.fix) {
          if (q.kind === 'gold') renderGold(qEl, opts, q);
          else if (q.kind === 'abb') renderAbb(qEl, opts, q);
          else if (q.kind === 'punct') renderPunct(qEl, opts, q);
          else if (q.kind === 'match') renderMatch(qEl, opts, q);
          else if (q.kind === 'conjfill') renderConjFill(qEl, opts, q);
          else if (q.kind === 'rethen') renderRethen(qEl, opts, q);
        }
      } else {
        opts.hidden = true;
        var total = S.qs.length, pct = total ? Math.round(S.correct / total * 100) : 0;
        var perfect = S.correct === total;
        result.hidden = false;
        result.querySelector('.wr-score').className = 'wr-score' + (perfect ? ' perfect' : '');
        result.querySelector('.wr-score').textContent = S.correct + ' / ' + total + ' · ' + pct + '%';
        result.querySelector('.wr-result-sub').textContent =
          '用时 ' + fmt(S.sec) + ' · 最佳连对 ' + S.bestStreak + (perfect ? ' 🌟 完美全对！' : '');
      }

      var fb = box.querySelector('.wr-fb');
      if (S.feedback && inRound) { fb.hidden = false; fb.className = 'wr-fb ' + S.feedback.ok; fb.innerHTML = S.feedback.msg; }
      else fb.hidden = true;

      box.querySelector('.wr-hist').innerHTML = histHtml();
    }

    /* L1 句子渲染：每个字都是热区（只把虫字做成按钮会被点破，游戏失效） */
    function renderBugText(text) {
      var out = '';
      for (var i = 0; i < text.length; i++) {
        out += '<button type="button" class="wr-ch" data-ch="' + esc(text[i]) + '" data-i="' + i + '">' + esc(text[i]) + '</button>';
      }
      return out;
    }
    /* L4 炼金题面：目标词高亮 + 三选项 */
    function renderGold(qEl, opts, q) {
      var g = q.d;
      qEl.innerHTML = esc(g.s).replace(/【(.+?)】/, '【<b class="wr-target">$1</b>】');
      var os = shuffle(g.o.slice());
      opts.innerHTML = '<div class="wr-tip">⚗️ 把 1★ 词炼成更棒的！选出最佳升级</div><div class="wr-col">' +
        os.map(function (o, i) {
          return '<button type="button" class="wr-opt" data-opt="' + i + '">' + esc(o[0]) + '</button>';
        }).join('') + '</div>';
      S.os = os;
    }
    /* L4 ABB 挖空变体 */
    function renderAbb(qEl, opts, q) {
      var a = q.d;
      qEl.innerHTML = esc(a.s).replace('__', '<b class="wr-blank">__</b>');
      var os = shuffle(a.opts.slice());
      opts.innerHTML = '<div class="wr-tip">✨ 补全叠词，点亮句子！</div><div class="wr-row">' +
        os.map(function (o, i) {
          return '<button type="button" class="wr-opt" data-opt="' + i + '">' + esc(o) + '</button>';
        }).join('') + '</div>';
      S.os = os;
    }

    /* ---------- L2 标点小交警（PRD §6.3）：段间空位=停车位，拖/点标点车入位 ---------- */
    function renderPunct(qEl, opts, q) {
      var p = q.d, t = TIERS[S.tier].t, tray = P_TRAYS[t], i;
      if (S.placeFor !== p.id) {
        S.placeFor = p.id; S.place = []; S.pp = null;
        for (i = 0; i < p.marks.length; i++) S.place.push(null);
      }
      var html = '<div class="wr-tip">🚦 句子开进修车站啦！把标点小汽车停进空位</div><div class="wr-para">';
      for (i = 0; i < p.segs.length; i++) {
        html += '<span class="wr-seg">' + esc(p.segs[i]) + '</span>' +
          '<button type="button" class="wr-slot' + (S.place[i] ? ' fill' : '') + '" data-slot="' + i + '">' +
          (S.place[i] ? esc(S.place[i]) : '　') + '</button>';
      }
      qEl.innerHTML = html + '</div>';
      opts.innerHTML = '<div class="wr-tip">点车再点空位，或直接拖进去；停错了点空位取回</div><div class="wr-row wr-tray">' +
        tray.map(function (m) {
          return '<button type="button" class="wr-p-car' + (S.pp === m ? ' sel' : '') + '" data-pcar="' + esc(m) + '">' + esc(m) + '</button>';
        }).join('') + '</div>';
    }

    /* ---------- L3 玩法A 配对（PRD §6.4）：点左半句 → 点右半句，咔哒合体 ---------- */
    function renderMatch(qEl, opts, q) {
      var m = q.d, z;
      if (S.matchFor !== m.id) {
        S.matchFor = m.id; S.matched = []; S.sel = null; S.done = 0;
        for (z = 0; z < m.items.length; z++) S.matched.push(false);
        S.rorder = shuffle(m.items.map(function (x, i) { return i; }));
      }
      qEl.innerHTML = '<div class="wr-tip">🔗 点左边的半句，再给它找好朋友！</div><div class="wr-pair-cols">' +
        '<div class="wr-pair-col">' + m.items.map(function (it, i) {
          return '<button type="button" class="wr-pair' + (S.matched[i] ? ' done' : '') + (S.sel === i ? ' sel' : '') + '" data-pair="L" data-i="' + i + '">' + esc(it[0]) + '</button>';
        }).join('') + '</div>' +
        '<div class="wr-pair-col">' + S.rorder.map(function (r) {
          return '<button type="button" class="wr-pair' + (S.matched[r] ? ' done' : '') + '" data-pair="R" data-r="' + r + '">' + esc(m.items[r][1]) + '</button>';
        }).join('') + '</div></div>';
      opts.innerHTML = '<div class="wr-tip small muted">接对了两个半句会咔哒合体发光～</div>';
    }

    /* ---------- L3 玩法B 关联词填空：点词填进（　），全填对自动过关 ---------- */
    function renderConjFill(qEl, opts, q) {
      var c = q.d;
      if (S.fillFor !== c.id) { S.fillFor = c.id; S.filled = c.ans.map(function () { return null; }); S.pb = 0; }
      if (S.trayFor !== c.id) { S.trayFor = c.id; S.tray = shuffle(c.opts.slice()); }
      var parts = c.s.split('（　）');
      qEl.innerHTML = '<div class="wr-tip">🔗 选关联词，把句子接通顺！</div><div class="wr-para">' +
        parts.map(function (seg, i) {
          return esc(seg) + (i < parts.length - 1
            ? '<button type="button" class="wr-bk' + (S.filled[i] ? ' fill' : '') + (S.pb === i ? ' active' : '') + '" data-bk="' + i + '">' +
              (S.filled[i] ? esc(S.filled[i]) : '（　）') + '</button>'
            : '');
        }).join('') + '</div>';
      opts.innerHTML = '<div class="wr-tip">点词填进亮着的空里；点空位可以取回</div><div class="wr-row">' +
        S.tray.map(function (w) {
          return '<button type="button" class="wr-chip" data-cj="' + esc(w) + '">' + esc(w) + '</button>';
        }).join('') + '</div>';
    }

    /* ---------- L3 玩法C 然后改造师（PRD §6.4）：把口水话「然后」换掉/删掉 ----------
       数据里 qs.i 为 0 基且不覆盖全部「然后」句——留一个合法「然后」，其余才改造 */
    function renderRethen(qEl, opts, q) {
      var r = q.d, qsSet = {};
      if (S.rethenFor !== r.id) { S.rethenFor = r.id; S.trans = {}; S.rq = 0; }
      r.qs.forEach(function (x) { qsSet[x.i] = 1; });
      var cur = r.qs[S.rq];
      qEl.innerHTML = '<div class="wr-tip">🛠️ 这段话「然后」太多啦！帮每句选个好改法</div><div class="wr-para">' +
        r.s.map(function (sen, si) {
          var cls = 'wr-line', txt;
          if (S.trans.hasOwnProperty(si)) txt = S.trans[si] === '' ? '<s>' + esc(sen) + '</s>' : esc(S.trans[si]);
          else txt = esc(sen);
          if (cur && cur.i === si) cls += ' hot';
          else if (qsSet[si] && !S.trans.hasOwnProperty(si)) cls += ' then';
          return '<div class="' + cls + '">' + txt + '</div>';
        }).join('') + '</div>';
      opts.innerHTML = cur
        ? '<div class="wr-tip">第 ' + (cur.i + 1) + ' 句的「然后」怎么办？</div><div class="wr-row">' +
          cur.opts.map(function (o) {
            return '<button type="button" class="wr-chip" data-robj="' + esc(o) + '">' + (o === '删掉' ? '🗑️ 删掉' : esc(o)) + '</button>';
          }).join('') + '</div>'
        : '';
    }

    function histHtml() {
      var key = S ? (HIST_KEYS[S.level] || HIST1_KEY) : HIST1_KEY;
      var h = getHist(key).slice(0, 5);
      if (!h.length) return '<span class="muted small">完成一轮后，这里会记录你的正确率进步曲线。</span>';
      return '<b class="small">最近成绩</b> ' + h.map(function (r) {
        return '<span class="wr-hist-item">' + r.rate + '%<i>' + (TIERS[r.tier] ? TIERS[r.tier].label.slice(0, 3) : '') + '</i></span>';
      }).join('');
    }

    /* ---------- 交互：L1 点字 / L4 选项 ---------- */
    function pickChar(btn) {
      if (!S || S.over || S.lock || S.idx >= S.qs.length) return;
      var q = S.qs[S.idx];
      if (q.kind === 'typo' && (q.variant === 'choose' || !q.d.text)) {
        var ok2 = btn.getAttribute('data-ch') === q.d.fix;
        btn.classList.add(ok2 ? 'hit' : 'miss');
        resolve(ok2, q, btn);
        return;
      }
      /* 点虫 / 体检：全句热区，点错只提醒不跳题（PRD §6.1「点错摇一摇」） */
      var qEl = box.querySelector('.wr-question');
      if (q.kind === 'typo') {
        if (btn.getAttribute('data-ch') === q.d.bug &&
            q.d.text.charAt(Number(btn.getAttribute('data-i'))) === q.d.bug) {
          btn.classList.add('hit');
          resolve(true, q, btn);
        } else wrongTap(qEl);
      } else if (q.kind === 'clean') {
        wrongTap(qEl);
      }
    }
    function pickOpt(btn) {
      if (!S || S.over || S.lock || S.idx >= S.qs.length) return;
      var q = S.qs[S.idx], v = btn.getAttribute('data-opt'), ok;
      if (v === 'clean') {
        /* 体检判定：真没虫=对；句里有虫却说没虫=漏判（练「会检查」同样重要） */
        ok = q.kind === 'clean';
        btn.classList.add(ok ? 'hit' : 'miss');
        resolve(ok, q, btn);
        return;
      }
      if (q.kind === 'gold') {
        var o = S.os[Number(v)];
        if (!o) return;
        ok = o[3] === 1;
        btn.classList.add(ok ? 'hit' : (o[1] >= 2 ? 'mid' : 'miss'));
        S.pickedWhy = o;
        resolve(ok, q, btn, o);
      } else if (q.kind === 'abb') {
        ok = S.os[Number(v)] === q.d.ans;
        btn.classList.add(ok ? 'hit' : 'miss');
        resolve(ok, q, btn);
      }
    }

    /* ---------- 交互：L2 标点 / L3 连词（全对即胜，错满 3 次亮答案记漏） ---------- */
    function inPlay(kind) {
      if (!S || S.lock || S.over || S.idx >= S.qs.length || S.fix) return null;
      var q = S.qs[S.idx];
      return q.kind === kind ? q : null;
    }
    /* L2：点车选中 / 点空位入位（拖拽通道在 bindOnce 的 pointerdown 里） */
    function tapCar(btn) {
      if (!inPlay('punct')) return;
      S.pp = btn.getAttribute('data-pcar');
      Sfx.click();
      render();
    }
    function tapSlot(btn) {
      if (!inPlay('punct')) return;
      var i = Number(btn.getAttribute('data-slot'));
      if (S.place[i]) { S.place[i] = null; Sfx.click(); render(); return; }  /* 取回重停 */
      if (!S.pp) { api.toast('先点下面的标点小汽车～'); return; }
      placeMark(i, S.pp);
    }
    function placeMark(slotIdx, mark) {
      var q = S.qs[S.idx];
      S.place[slotIdx] = mark;
      S.pp = null;
      Sfx.pop();
      render();
      var full = true;
      for (var i = 0; i < S.place.length; i++) if (!S.place[i]) { full = false; break; }
      if (full) checkPunct(q);
    }
    /* 全放对 → 鸣笛出站；停错 → 弹回闪红灯；错满 3 次亮答案 */
    function checkPunct(q) {
      var bad = [];
      S.place.forEach(function (m, i) { if (m !== q.d.marks[i]) bad.push(i); });
      if (!bad.length) { resolve(true, q, null); return; }
      S.tried++;
      bad.forEach(function (i) { S.place[i] = null; });
      if (S.tried >= 3) {
        failQ('正确停站：' + esc(q.d.segs.map(function (s, i2) { return s + q.d.marks[i2]; }).join('')));
        return;
      }
      Sfx.lose();
      if (global.Fx) global.Fx.vibrate(12);
      render();
      api.toast('⛔ 停错啦！红灯亮了弹回去（还剩 ' + (3 - S.tried) + ' 次机会）');
    }
    /* L3 玩法A 配对 */
    function tapPair(btn) {
      if (!inPlay('match')) return;
      var q = S.qs[S.idx], qEl = box.querySelector('.wr-question');
      if (btn.getAttribute('data-pair') === 'L') {
        var i = Number(btn.getAttribute('data-i'));
        if (S.matched[i]) return;
        S.sel = S.sel === i ? null : i;
        Sfx.click();
        render();
        return;
      }
      var r = Number(btn.getAttribute('data-r'));
      if (S.matched[r]) return;
      if (S.sel === null) { api.toast('先点左边的半句，再点它的好朋友～'); return; }
      if (r === S.sel) {
        S.matched[r] = true; S.done++; S.sel = null;
        Sfx.pop();
        if (global.Fx) { global.Fx.vibrate(8); global.Fx.pop(qEl, 'good'); }
        render();
        if (S.done >= q.d.items.length) resolve(true, q, null);
        return;
      }
      /* 配错不跳题，错满 3 次亮答案（与 L1 同一铁律） */
      S.tried++;
      if (S.tried >= 3) {
        S.matched = q.d.items.map(function () { return true; });
        failQ('正确朋友：' + esc(q.d.items.map(function (it) { return it[0] + it[1]; }).join('　')));
        return;
      }
      Sfx.lose();
      if (global.Fx) { global.Fx.vibrate(12); global.Fx.shake(qEl); }
      S.sel = null;
      render();
      api.toast('这俩不是好朋友，再想想！（还剩 ' + (3 - S.tried) + ' 次）');
    }
    /* L3 玩法B 填空 */
    function tapBlank(btn) {
      if (!inPlay('conjfill')) return;
      var i = Number(btn.getAttribute('data-bk'));
      if (S.filled[i]) S.filled[i] = null;   /* 取回 */
      S.pb = i;
      Sfx.click();
      render();
    }
    function tapChip(btn) {
      if (!inPlay('conjfill')) return;
      var q = S.qs[S.idx], w = btn.getAttribute('data-cj');
      var i = S.pb < S.filled.length && !S.filled[S.pb] ? S.pb : S.filled.indexOf(null);
      if (i < 0) return;
      S.filled[i] = w;
      S.pb = i + 1 < S.filled.length ? i + 1 : i;
      Sfx.pop();
      render();
      var full = true;
      for (var z = 0; z < S.filled.length; z++) if (!S.filled[z]) { full = false; break; }
      if (full) checkFill(q);
    }
    function checkFill(q) {
      var bad = [];
      S.filled.forEach(function (w, i) { if (w !== q.d.ans[i]) bad.push(i); });
      if (!bad.length) { resolve(true, q, null); return; }
      S.tried++;
      bad.forEach(function (i) { S.filled[i] = null; });
      if (S.tried >= 3) {
        var reveal = q.d.s;
        q.d.ans.forEach(function (w) { reveal = reveal.replace('（　）', '「' + w + '」'); });
        failQ('正确填法：' + esc(reveal));
        return;
      }
      Sfx.lose();
      if (global.Fx) global.Fx.vibrate(12);
      render();
      api.toast('填错啦！把词放进句子读一读（还剩 ' + (3 - S.tried) + ' 次）');
    }
    /* L3 玩法C 然后改造师 */
    function tapRobj(btn) {
      if (!inPlay('rethen')) return;
      var q = S.qs[S.idx], r = q.d, cur = r.qs[S.rq];
      if (!cur) return;
      var o = btn.getAttribute('data-robj'), si = cur.i;
      if (o === cur.ans) {
        S.trans[si] = cur.ans === '删掉' ? '' : r.s[si].replace('然后', cur.ans);
        S.rq++;
        Sfx.pop();
        if (global.Fx) global.Fx.vibrate(8);
        if (S.rq >= r.qs.length) { resolve(true, q, null); return; }
        api.toast('改好啦！看看下一句～');
        render();
        return;
      }
      S.tried++;
      if (S.tried >= 3) {
        S.trans[si] = cur.ans === '删掉' ? '' : r.s[si].replace('然后', cur.ans);
        failQ('第 ' + (cur.i + 1) + ' 句应该' + (cur.ans === '删掉' ? '直接删掉「然后」' : '换成「' + cur.ans + '」') + '。' + esc(cur.why || ''));
        return;
      }
      Sfx.lose();
      if (global.Fx) { global.Fx.vibrate(12); global.Fx.shake(box.querySelector('.wr-question')); }
      api.toast('这个改法读起来不顺，再试试！（还剩 ' + (3 - S.tried) + ' 次）');
    }
    /* L2/L3 错满亮答案记漏（与 L1 wrongTap 同一规则）：停在讲解卡，点「我知道了」才走 */
    function failQ(msg) {
      var q = S.qs[S.idx];
      S.streak = 0;
      S.marks[S.idx] = false;
      applyKp(q, false);
      S.fix = { msg: msg };
      S.flash = 'bad';
      Sfx.lose();
      S.lock = true;
      S.tried = 0;
      update();
    }
    /* 讲解卡「我知道了」→ 看懂了才进下一题（最后一题则直接结算） */
    function goNext() {
      if (!S || !S.fix || S.over) return;
      S.fix = null; S.feedback = null; S.flash = null;
      S.lock = false;
      S.idx++; S.tried = 0; S.pickedWhy = null;
      Sfx.click();
      if (S.idx >= S.qs.length) { finish(); return; }
      update();
    }
    /* 点错热区：不跳题；连错 3 次（体检 2 次）自动亮答案并记漏（兑现规则文案） */
    function wrongTap(qEl) {
      if (S.lock) return;
      var q = S.qs[S.idx];
      S.tried++;
      Sfx.lose();
      if (global.Fx) { global.Fx.vibrate(12); global.Fx.shake(qEl); }
      var limit = q.kind === 'clean' ? 2 : 3;
      if (S.tried < limit) {
        api.toast(q.kind === 'clean' ? '这个字没毛病，再读读整句～' : '🐛 这只字里没虫，再找找！');
        return;
      }
      var msg;
      if (q.kind === 'typo') {
        qEl.innerHTML = esc(q.d.text).replace(q.d.bug, '<b class="wr-target">' + esc(q.d.bug) + '</b>');
        msg = '虫子在这儿！<b>' + esc(q.d.bug) + ' → ' + esc(q.d.fix) + '</b>。' + esc(q.d.hint || '');
      } else {
        msg = '其实这句没虫～点下面的「✔ 这句没虫」就算找到啦！';
      }
      S.marks[S.idx] = false;
      S.streak = 0;
      applyKp(q, false);
      if (q.kind === 'typo' && !q.review) addWrong(q.d);
      S.fix = { msg: msg };
      S.flash = 'bad';
      S.lock = true;
      S.tried = 0;
      update();
    }
    function resolve(ok, q, btn, goldOpt) {
      if (S.lock) return;
      S.lock = true;
      var qEl = box.querySelector('.wr-question');
      if (ok) {
        S.correct++; S.streak++;
        if (S.streak > S.bestStreak) S.bestStreak = S.streak;
        S.marks[S.idx] = true;
        applyKp(q, true);
        if (q.review) reviewPass(q.d);
        var cheer;
        if (S.streak === 3) cheer = '🔥 3 连对！小啄木鸟起飞！';
        else if (S.streak === 5) cheer = '⚡ 5 连对！捉虫神眼！';
        else if (S.streak >= 7) cheer = '👑 ' + S.streak + ' 连对！势如破竹！';
        else if (q.kind === 'typo') cheer = (q.review ? '放生成功！' : '捉到啦！') + '<b>' + esc(q.d.bug) + ' → ' + esc(q.d.fix) + '</b> ' + esc(q.d.hint || '');
        else if (q.kind === 'gold' && goldOpt) cheer = esc(goldOpt[0]) + '！' + esc(goldOpt[2]);
        else if (q.kind === 'abb') cheer = '「' + esc(q.d.ans) + '」，句子亮起来啦！';
        else if (q.kind === 'punct') cheer = '滴滴——标点全对，句子开走啦！🚦';
        else if (q.kind === 'match') cheer = '咔哒！全部配对成功！🔗';
        else if (q.kind === 'conjfill') cheer = '关联词各就各位，句子通顺啦！';
        else if (q.kind === 'rethen') cheer = '「然后」怪兽改造完毕，段落大变身！';
        else cheer = '答对啦！真棒 ✨';
        S.feedback = { ok: 'good', msg: cheer };
        S.flash = 'good';
        if (S.streak >= 3 && Sfx.combo) Sfx.combo(S.streak); else Sfx.pop();
        if (global.Fx) {
          global.Fx.vibrate(10);
          if (S.streak >= 2) global.Fx.combo(S.streak);
          global.Fx.floatScore('+1', undefined, undefined, 'good');
          global.Fx.pop(qEl, 'good');
          if (S.streak >= 3) global.Fx.burst(qEl, ['⭐', '✨', '🐛'][ri(3)], 8);
        }
      } else {
        S.streak = 0;
        S.marks[S.idx] = false;
        applyKp(q, false);
        var msg;
        if (q.kind === 'typo') msg = '记住：<b>' + esc(q.d.bug) + ' → ' + esc(q.d.fix) + '</b>。' + esc(q.d.hint || '');
        else if (q.kind === 'abb') msg = '正确的是「' + esc(q.d.ans) + '」，多念两遍就顺口啦！';
        else if (q.kind === 'gold') {
          var best = S.os.filter(function (o) { return o[3] === 1; })[0];
          msg = '最佳答案：「<b>' + esc(best ? best[0] : q.d.w) + '</b>」！' + esc((S.pickedWhy && S.pickedWhy[2]) || '');
        }
        else msg = '再想想：' + esc((S.pickedWhy && S.pickedWhy[2]) || '换个更具体、更有画面的词试试');
        S.fix = { msg: msg };
        S.flash = 'bad';
        Sfx.lose();
        if (global.Fx) { global.Fx.vibrate([12, 40, 12]); global.Fx.shake(qEl); }
        if (q.kind === 'typo' && !q.review) addWrong(q.d);
        update();
        return;   /* 锁在讲解卡，goNext() 里才推进 */
      }
      S.idx++;
      S.tried = 0; S.pickedWhy = null;
      update();
      nextStep(true);   /* 答对快进；答错锁在讲解卡，goNext() 手动推进 */
    }
    function nextStep() {
      clearTimeout(nextT);
      nextT = setTimeout(function () {
        if (!S) return;
        S.lock = false;
        S.feedback = null; S.flash = null;
        if (S.idx >= S.qs.length) finish();
        else { render(); api.status('第 ' + (S.idx + 1) + '/' + S.qs.length + ' 题 · ' + fmt(S.sec) + ' · 🔥 连对 ' + S.streak); }
      }, 620);
    }

    function applyKp(q, ok) {
      var kp;
      if (q.kind === 'typo') kp = q.d.kp;
      else if (q.kind === 'gold') kp = q.d.w;
      else if (q.kind === 'abb') kp = q.d.full || q.d.ans;
      else if (q.kind === 'punct') kp = ['标点·句末', '标点·切分', '标点·顿号'][Math.max(0, (TIERS[S.tier].t || 1) - 1)];
      else kp = q.d.kp || '';   /* match/conjfill/rethen 用题包 kp */
      if (!kp) return;
      var m = getKp();
      var st = m[kp] || { s: 0, seen: 0, last: 0 };
      st.seen++;
      if (ok) st.s = Math.min(3, st.s + 1);
      else st.s = 0;
      st.last = Date.now();
      m[kp] = st;
      setKp(m);
    }

    /* ---------- 错字本 ---------- */
    function addWrong(d) {
      var list = getWrong().filter(function (w) { return !(w.word === d.bug && w.fix === d.fix); });
      list.unshift({ word: d.bug, fix: d.fix, kp: d.kp || '', hint: d.hint || '', ts: Date.now(), okStreak: 0 });
      setWrong(list);
    }
    /* 复习答对 → okStreak+1，≥2 移除（PRD §6.1） */
    function reviewPass(d) {
      var list = getWrong();
      var it = list.filter(function (w) { return w.word === d.bug && w.fix === d.fix; })[0];
      if (!it) return;
      it.okStreak = (it.okStreak || 0) + 1;
      if (it.okStreak >= 2) {
        list = list.filter(function (w) { return w !== it; });
        if (!list.length) { var c = bumpCount('cleared'); if (c.cleared >= 1) global.Store.unlockBadge('writing_eye'); }
      }
      setWrong(list);
    }
    function renderBook() {
      var p = box.querySelector('[data-pane="book"]');
      var list = getWrong();
      var html = '<div class="wr-book-head"><b>📕 我的错字本</b><span class="muted small">重练答对 2 次就放走这只虫</span></div>';
      if (!list.length) html += '<div class="wr-empty">🎉 错字本空空的！句子体检全过关，太棒了！</div>';
      else html += list.slice(0, 40).map(function (w) {
        var dots = ''; for (var i = 0; i < 2; i++) dots += '<i class="' + (i < (w.okStreak || 0) ? 'on' : '') + '"></i>';
        return '<div class="wr-wrong-item"><span class="wr-wrong-word">' + esc(w.word) + ' → ' + esc(w.fix) + '</span>' +
          '<span class="muted small">' + esc(w.kp || '') + '</span><span class="wr-dots">' + dots + '</span></div>';
      }).join('');
      html += '<div class="wr-book-act"><button type="button" class="btn primary" data-book-review>📕 错字重练（' + Math.min(list.length, ROUND) + ' 题）</button></div>';
      p.innerHTML = html;
      var btn = p.querySelector('[data-book-review]');
      if (btn) btn.addEventListener('click', function () {
        if (getWrong().length < 3) { api.toast('错字本还空着，先练一轮吧！'); return; }
        Sfx.click(); newRound(S ? S.tier : '1', true);
      });
    }

    /* ---------- 词卡图鉴 ---------- */
    function renderCards(u) {
      var p = box.querySelector('[data-pane="cards"]');
      var have = getCards();
      var all = D.cards || [];
      var units = u ? [Number(u)] : [1, 2, 3, 4, 5, 6, 7, 8];
      var owned = Object.keys(have).length;
      var html = '<div class="wr-cards-head"><b>🃏 词卡图鉴</b><span class="muted small">' + owned + ' / ' + all.length + ' 张</span></div>';
      html += '<div class="wr-unit-row">' + [1, 2, 3, 4, 5, 6, 7, 8].map(function (i) {
        return '<button type="button" class="wr-unit-chip' + ((!u || Number(u) === i) ? ' active' : '') + '" data-unit="' + i + '">' + i + '</button>';
      }).join('') + '</div>';
      units.forEach(function (un) {
        html += '<div class="wr-unit-title">' + esc(UNIT_NAMES[un] || ('单元 ' + un)) + '</div><div class="wr-cards-grid">';
        all.filter(function (c) { return c.u === un; }).forEach(function (c) {
          var got = have[c.w];
          if (got) html += '<button type="button" class="wr-card got s' + c.s + '" data-card="' + esc(c.w) + '">' +
            '<b>' + esc(c.w) + '</b><i>' + stars(c.s) + '</i></button>';
          else html += '<span class="wr-card">？</span>';
        });
        html += '</div>';
      });
      p.innerHTML = html;
    }
    function flipCard(btn) {
      var w = btn.getAttribute('data-card');
      var meta = (D.cards || []).filter(function (c) { return c.w === w; })[0];
      if (!meta) return;
      api.info('<b>' + esc(meta.w) + '</b> ' + stars(meta.s) + ' · ' + esc(meta.g) +
        '<br>' + esc(meta.d) + '<br><i>' + esc(meta.e) + '</i>');
    }

    /* ---------- 进步曲线 ---------- */
    function renderTrend() {
      var p = box.querySelector('[data-pane="trend"]');
      function bars(key, name) {
        var h = getHist(key).slice(0, 10).reverse();
        if (!h.length) return '<div class="wr-trend-block"><b>' + name + '</b><div class="muted small">完成一轮后出现曲线</div></div>';
        return '<div class="wr-trend-block"><b>' + name + '</b><div class="wr-trend">' + h.map(function (r) {
          return '<i style="height:' + Math.max(8, r.rate) + '%" class="' + (r.rate >= 80 ? 'good' : '') + '"><u>' + r.rate + '</u></i>';
        }).join('') + '</div></div>';
      }
      p.innerHTML = '<div class="wr-cards-head"><b>📈 进步曲线</b><span class="muted small">每轮正确率，越高越棒</span></div>' +
        bars(HIST1_KEY, '🐦 捉虫啄木鸟') + bars(HIST4_KEY, '⚗️ 词语炼金炉') +
        bars(HIST2_KEY, '🚦 标点小交警') + bars(HIST3_KEY, '🔗 连词对对碰') +
        '<div class="wr-trend-block"><b>🏆 收集</b><div class="muted small">' +
        '词卡 ' + Object.keys(getCards()).length + ' / ' + (D.cards || []).length + ' 张 · 错字本 ' + getWrong().length + ' 只虫待捉</div></div>';
    }

    /* ---------- 结算 ---------- */
    function finish() {
      S.over = true; stopTimer();
      var total = S.qs.length, pct = total ? Math.round(S.correct / total * 100) : 0;
      var perfect = S.correct === total;
      /* PRD §5.2：L1/L4 ≥80% 判胜；L2/L3 每轮 6 题全对即胜 */
      var win = (S.level === 't2' || S.level === 't3') ? perfect : pct >= WIN_RATE * 100;
      if (win) {
        var wk = { t1: 'win1', t2: 'win2', t3: 'win3', t4: 'win4' }[S.level] || 'win1';
        var c = bumpCount(wk);
        if (S.level === 't1' && c.win1 >= 3) global.Store.unlockBadge('writing_doctor');
        if (S.level === 't2' && c.win2 >= 1) global.Store.unlockBadge('writing_police');
        /* 判胜奖励：本单元随机一张未解锁词卡（PRD §15） */
        var unit = TIERS[S.tier].units || [1, 2, 3, 4, 5, 6, 7, 8];
        var have = getCards();
        var pool = shuffle((D.cards || []).filter(function (x) {
          return (!TIERS[S.tier].t || x.g) && unit.indexOf(x.u) >= 0 && !have[x.w];
        }));
        var bonus = pool[0];
        if (bonus && grantCard(bonus.w, 'bonus')) {
          api.toast('🎁 判胜奖励：新词卡「' + bonus.w + '」入图鉴！');
          if (global.Fx) global.Fx.banner('🃏 收集词卡：' + bonus.w + ' ' + stars(bonus.s));
        }
        global.Store.addStars(perfect ? 5 : 2);
      }
      if (perfect && global.Fx) global.Fx.confetti({ count: 120 });
      pushHist(HIST_KEYS[S.level] || HIST1_KEY, { ts: Date.now(), tier: S.tier, rate: pct });
      api.over(win ? 'win' : 'lose', {
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
        '<b>' + (S.review ? '错字重练' : S.tierLabel) + '</b>　已对 <b>' + S.correct + '</b>/' + S.qs.length +
        '<br>错字本：<b>' + getWrong().length + '</b> 只虫 · 词卡 <b>' + Object.keys(getCards()).length + '</b>/' + (D.cards || []).length +
        '<br><span class="muted small">' + (S.review ? '重练答对 2 次，虫子就飞走啦！' : '答错的虫子会自动收进错字本。') + '</span>'
      );
      api.changed();
      render();
    }

    return {
      restart: function (o) {
        var tier = String(o && o.side) || (S ? S.tier : '1');
        if (!TIERS[tier]) tier = '1';
        newRound(tier, false);
      },
      restore: function (data) {
        try {
          if (!data || !TIERS[String(data.tier)] || !data.qs || !data.qs.length) return false;
          S = {
            tier: String(data.tier), tierLabel: TIERS[String(data.tier)].label,
            level: data.level || TIERS[String(data.tier)].level, review: !!data.review,
            qs: data.qs, idx: data.idx || 0, correct: data.correct || 0,
            marks: data.marks || [], streak: 0, bestStreak: data.bestStreak || 0,
            sec: data.sec || 0, t0: Date.now() - (data.sec || 0) * 1000,
            over: !!data.over, feedback: null, flash: null, fix: data.fix || null,
            tried: 0, pickedWhy: null, lock: !!data.fix, os: null,
            pp: data.pp || null, place: data.place || null, placeFor: data.placeFor || '',
            sel: data.sel === undefined ? null : data.sel,
            matched: data.matched || null, matchFor: data.matchFor || '',
            done: data.done || 0, rorder: data.rorder || null,
            filled: data.filled || null, fillFor: data.fillFor || '',
            tray: data.tray || null, trayFor: data.trayFor || '',
            pb: data.pb || 0, rq: data.rq || 0, trans: data.trans || null, rethenFor: data.rethenFor || '',
            dragged: false
          };
          build();
          if (S.over) { update(); return true; }
          startTimer(); update();
          return true;
        } catch (e) { return false; }
      },
      serialize: function () {
        if (!S) return null;
        return {
          v: 1, kind: 'writing', tier: S.tier, review: S.review, level: S.level,
          qs: S.qs, idx: S.idx, correct: S.correct, marks: S.marks,
          bestStreak: S.bestStreak,
          pp: S.pp, place: S.place, placeFor: S.placeFor, sel: S.sel,
          matched: S.matched, matchFor: S.matchFor, done: S.done, rorder: S.rorder,
          filled: S.filled, fillFor: S.fillFor, tray: S.tray, trayFor: S.trayFor,
          pb: S.pb, rq: S.rq, trans: S.trans, rethenFor: S.rethenFor,
          fix: S.fix || null,
          sec: S.over ? S.sec : Math.floor((Date.now() - S.t0) / 1000),
          over: S.over, ts: Date.now()
        };
      },
      hint: function () {
        if (!S || S.over || S.idx >= S.qs.length) return;
        var q = S.qs[S.idx];
        if (q.kind === 'typo' && q.d.text) api.toast('💡 ' + (q.d.hint || '再读一遍，找出不像话的那个字'));
        else if (q.kind === 'clean') api.toast('💡 逐字读一读，每个字都讲得通吗？');
        else if (q.kind === 'abb') api.toast('💡 想想完整叠词怎么念：' + q.d.full);
        else if (q.kind === 'punct') api.toast('💡 读出语气：问事情用「？」，真惊讶用「！」，平常说完用「。」；句中停顿用「，」，并列词之间用「、」');
        else if (q.kind === 'match') api.toast('💡 先读前半句，想想后半句说什么才连得上');
        else if (q.kind === 'conjfill') api.toast('💡 把词放进空里读一读，通顺的那个就对');
        else if (q.kind === 'rethen') api.toast('💡 「然后」太多啦——接着、最后、过了一会儿都能替它，有些直接删掉更顺');
        else api.toast('💡 选画面感最强、最具体的那个词');
      },
      redraw: function () { if (S) render(); },
      destroy: function () { stopTimer(); clearTimeout(nextT); }
    };
  }

  global.Games = global.Games || {};
  global.Games.writing = {
    stageType: 'story',
    cat: 'brain',
    emoji: '✏️',
    name: '写作乐园',
    desc: '捉错字虫 · 断句子 · 接句子 · 炼金升级词！四关小练习 + 错字本重练 + 词卡图鉴，每天几分钟把句子写得又对又美。',
    tags: ['错别字', '标点', '连词', '词语升级', '错字本', '图鉴收集'],
    rules: '① 捉虫关：点出句子里的错字虫，没有虫就点「这句没虫」，错 3 次自动亮答案；② 炼金关：把平淡的词换成最有画面感的升级词；③ 标点关：把标点小汽车拖进句子空位，全对句子就开走；④ 连词关：半句配对、关联词填空、改造「然后」口水话；⑤ 捉虫/炼金正确率 ≥80% 判胜，标点/连词全对即胜，判胜随机解锁一张词卡；⑥ 答错的虫子自动收进错字本，重练答对 2 次就放走它。',
    guide: '① 捉虫先读整句，找「讲不通」的字，再看偏旁：玩耍用「玩」，做完才用「完」；② 断句读语气：问事情用「？」，真惊讶用「！」，一般说完用「。」，句中停一停用「，」，并列词之间用「、」；③ 连词给句子牵手：同时做用「一边…一边」，讲原因结果用「因为…所以」，「然后」一段最多用一次，其余换成「接着」「最后」；④ 炼金时闭眼想画面——「金灿灿的稻田」比「黄色的稻田」亮；⑤ 每天一轮，错字本清零最有成就感。',
    tip: '错字是写作文的小虫子——当天捉、当天放，下次作文里它就不敢来了。',
    single: true,
    noLevel: true,
    dom: true,
    noUndo: true,
    noResign: true,
    noQuickActions: true,
    sideOptions: [
      ['1', '🐦 捉虫啄木鸟 · 萌新'],
      ['2', '🐦 捉虫啄木鸟 · 进阶'],
      ['3', '🐦 捉虫啄木鸟 · 挑战'],
      ['4', '⚗️ 词语炼金炉 · 萌新'],
      ['5', '⚗️ 词语炼金炉 · 进阶'],
      ['6', '⚗️ 词语炼金炉 · 挑战'],
      ['7', '🚦 标点小交警 · 萌新'],
      ['8', '🚦 标点小交警 · 进阶'],
      ['9', '🚦 标点小交警 · 挑战'],
      ['10', '🔗 连词对对碰 · 萌新'],
      ['11', '🔗 连词对对碰 · 进阶'],
      ['12', '🔗 连词对对碰 · 挑战']
    ],
    mount: mount
  };
})(window);
