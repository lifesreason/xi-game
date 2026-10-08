/* 平衡天平：代数思维启蒙。
   左盘是目标重量，从下面挑几个砝码放进右盘，让天平平衡！
   每题保证有解（先选解再加干扰砝码）。连续答对 5 题即通关。
   三档：数字范围与砝码数量递增。 */
(function (global) {
  var ROUND = 5;
  var LEVELS = {
    '1': { label: '萌新 · 10~15', min: 10, max: 15, nW: 5, solMin: 2, solMax: 3 },
    '2': { label: '进阶 · 16~24', min: 16, max: 24, nW: 6, solMin: 3, solMax: 4 },
    '3': { label: '挑战 · 25~40', min: 25, max: 40, nW: 7, solMin: 3, solMax: 5 }
  };

  function ri(n) { return (Math.random() * n) | 0; }

  function mount(host, api) {
    var G = {
      level: '1', target: 0, weights: [], picked: {},
      round: 0, over: false, startTs: Date.now(), locked: false
    };
    var wrap = null, beamEl = null, rightEl = null, poolEl = null, fbEl = null;

    function makePuzzle() {
      var lv = LEVELS[G.level];
      var target = lv.min + ri(lv.max - lv.min + 1);
      /* 从 1~target-1 里取 solMin~solMax 个不同的数凑成 target（保证有解） */
      var sol = null, guard = 0;
      while (!sol && guard < 300) {
        guard++;
        var k = lv.solMin + ri(lv.solMax - lv.solMin + 1);
        var pool = [];
        for (var w = 1; w <= target - 1; w++) pool.push(w);
        var picked = [];
        var sum = 0, tries = 0;
        while (picked.length < k && tries < 60) {
          tries++;
          var cand = pool[ri(pool.length)];
          if (picked.indexOf(cand) >= 0) continue;
          if (sum + cand > target) continue;
          picked.push(cand);
          sum += cand;
        }
        if (sum === target) sol = picked;
      }
      if (!sol) sol = [target]; /* 兜底：直接一块 */
      /* 干扰砝码：不改变解的存在性，数量凑满 nW */
      var weights = sol.slice();
      var w = 1;
      while (weights.length < lv.nW) {
        if (w > target) break;
        if (weights.indexOf(w) < 0 && sol.indexOf(w) < 0) weights.push(w);
        w++;
      }
      weights.sort(function (a, b) { return 0.5 - Math.random(); });
      G.target = target;
      G.weights = weights;
      G.picked = {};
    }

    function build() {
      if (wrap) wrap.remove();
      wrap = document.createElement('div');
      wrap.className = 'bl-wrap';
      wrap.innerHTML =
        '<div class="bl-scale">' +
        '  <div class="bl-beam"></div>' +
        '  <div class="bl-pan bl-left"><div class="bl-panlabel">目标</div><div class="bl-weight big">🎯 ' + G.target + '</div></div>' +
        '  <div class="bl-pillar"></div>' +
        '  <div class="bl-pan bl-right"></div>' +
        '</div>' +
        '<div class="bl-status"></div>' +
        '<div class="bl-pool"></div>' +
        '<div class="bl-fb"></div>';
      host.appendChild(wrap);
      beamEl = wrap.querySelector('.bl-scale');
      rightEl = wrap.querySelector('.bl-right');
      poolEl = wrap.querySelector('.bl-pool');
      fbEl = wrap.querySelector('.bl-fb');
      renderWeights();
      renderPool();
    }

    function renderWeights() {
      rightEl.innerHTML = '<div class="bl-panlabel">你放的</div>';
      var sum = 0;
      G.weights.forEach(function (w) {
        if (!G.picked[w]) return;
        sum += w;
        var d = document.createElement('div');
        d.className = 'bl-weight';
        d.textContent = w;
        rightEl.appendChild(d);
      });
      if (!sum) {
        var hint = document.createElement('div');
        hint.className = 'bl-weight empty';
        hint.textContent = '点下面砝码放上来';
        rightEl.appendChild(hint);
      }
      var diff = sum - G.target;
      beamEl.style.setProperty('--tilt', Math.max(-8, Math.min(8, diff * 1.4)) + 'deg');
      var balanced = sum === G.target && Object.keys(G.picked).length > 0;
      beamEl.classList.toggle('balanced', balanced);
      wrap.querySelector('.bl-status').innerHTML =
        '右盘合计 <b>' + sum + '</b> · 目标 <b>' + G.target + '</b>' + (balanced ? ' · ⚖️ 平衡啦！' : '');
      return { sum: sum, balanced: balanced };
    }

    function renderPool() {
      poolEl.innerHTML = '';
      G.weights.forEach(function (w) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'bl-weight-btn' + (G.picked[w] ? ' used' : '');
        b.innerHTML = '<b>' + w + '</b><span>kg</span>';
        b.onclick = function () { toggle(w); };
        poolEl.appendChild(b);
      });
    }

    function toggle(w) {
      if (G.over || G.locked) return;
      if (G.picked[w]) {
        delete G.picked[w];
        Sfx.undo();
      } else {
        G.picked[w] = true;
        Sfx.place();
      }
      Fx.vibrate(10);
      renderWeights();
      renderPool();
      var r = renderWeights();
      if (r.balanced) puzzleDone();
    }

    function puzzleDone() {
      G.locked = true;
      G.round++;
      Sfx.combo(G.round + 2);
      Fx.burst(beamEl.querySelector('.bl-right'), '⭐', 6);
      fbEl.textContent = ['平衡啦，你真棒！', '等式成立！', '小数学家就是你！', '又平啦，继续！'][ri(4)];
      global.setTimeout(function () {
        G.locked = false;
        if (G.round >= ROUND) {
          G.over = true;
          Fx.confetti({ count: 100 });
          Sfx.win();
          api.over('win', {
            moves: ROUND, sec: Math.round((Date.now() - G.startTs) / 1000),
            score: LEVELS[G.level].label + ' · ' + ROUND + ' 题'
          });
          update();
        } else {
          makePuzzle();
          build();
          update();
        }
      }, 1000);
    }

    function update() {
      api.status(G.over ? '通关！' : '第 ' + (G.round + 1) + ' / ' + ROUND + ' 题');
      api.info('<b>' + LEVELS[G.level].label + '</b>　已完成 <b>' + G.round + '</b> 题<br>' +
        '左盘是目标重量，点下面的砝码放到右盘，让两边刚好平衡。点错的砝码再点一下就取下来。');
      api.changed();
    }

    return {
      restart: function (o) {
        G.level = String((o && o.side) || G.level || '1');
        if (!LEVELS[G.level]) G.level = '1';
        G.round = 0; G.over = false; G.locked = false;
        G.startTs = Date.now();
        makePuzzle();
        build();
        update();
      },
      pause: function () {},
      resume: function () {},
      undo: function () {
        if (G.over || G.locked) return;
        var any = Object.keys(G.picked)[0];
        if (any == null) { api.toast('右盘还是空的'); return; }
        delete G.picked[any];
        Sfx.undo();
        renderWeights(); renderPool();
      },
      hint: function () {
        if (G.over || G.locked) return;
        /* 提示：用子集和 DP 挑一个"放了之后仍可恰好凑成目标"的砝码，保证提示永远走得通 */
        var sum = 0, k;
        for (k in G.picked) sum += Number(k);
        var need = G.target - sum;
        var avail = G.weights.filter(function (w) { return !G.picked[w]; });
        function canForm(n, arr) {
          if (n === 0) return true;
          if (n < 0) return false;
          var dp = new Array(n + 1).fill(false);
          dp[0] = true;
          arr.forEach(function (w) {
            for (var v = n; v >= w; v--) if (dp[v - w]) dp[v] = true;
          });
          return dp[n];
        }
        var cands = avail.filter(function (w) {
          if (w > need) return false;
          var rest = avail.filter(function (x) { return x !== w; });
          return canForm(need - w, rest);
        });
        if (!cands.length) { api.toast('先把放上去的砝码取下来几个试试'); return; }
        var best = cands.sort(function (a, b) { return b - a; })[0];
        var btn = poolEl.querySelectorAll('.bl-weight-btn')[G.weights.indexOf(best)];
        if (btn) btn.classList.add('pat-hint');
        global.setTimeout(function () {
          var b2 = poolEl.querySelectorAll('.bl-weight-btn')[G.weights.indexOf(best)];
          if (b2) b2.classList.remove('pat-hint');
        }, 1800);
        api.toast('💡 试试 ' + best + ' kg！');
      },
      resign: function () {
        if (G.over) return;
        G.over = true;
        api.over('lose', { moves: G.round, sec: Math.round((Date.now() - G.startTs) / 1000) });
      },
      serialize: function () { return { v: 1, lv: G.level, round: G.round, ts: G.startTs }; },
      restore: function (d) { return false; },
      destroy: function () { if (wrap) wrap.remove(); },
      redraw: function () { if (wrap) renderWeights(); }
    };
  }

  global.Games = global.Games || {};
  global.Games.balance = {
    stageType: 'puzzle',
    id: 'balance', cat: 'puzzle', emoji: '⚖️',
    name: '平衡天平',
    desc: '代数思维启蒙！左盘是目标重量，挑砝码放进右盘让天平平衡。看得见的等式，适合 5-9 岁。',
    tags: ['等式启蒙', '加法凑数', '5-9 岁'],
    rules: '① 左盘是目标重量；② 点下方砝码把它放上右盘，再点一下取下来；③ 右盘合计正好等于目标时，天平就平衡啦；④ 连续平衡 5 题即通关，提示永远给你走得通的下一步。',
    guide: '① 从最大砝码开始试，看差值再补小砝码（贪心策略）；② 差值正好等于某个砝码时直接放上去；③ 放错不扣分——大胆组合，用天平的倾斜方向当反馈；④ 试着心算「目标 − 已放 = 还差多少」，把等式写在脑子里。',
    tip: '从大砝码开始试：先放最大的，看差多少再用小砝码补——这就是"贪心"策略！',
    single: true, noLevel: true, dom: true,
    sideOptions: [['1', '萌新 · 10~15'], ['2', '进阶 · 16~24'], ['3', '挑战 · 25~40']],
    mount: mount
  };
})(window);
