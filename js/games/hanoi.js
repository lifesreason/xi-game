/* 魔法汉诺塔：经典递归与逆向规划思维训练
   3~6 层阶梯难度、最少步数提示、智能单步演示与流畅升降动效 */
(function (global) {
  var TIERS = {
    '3': { n: 3, min: 7, label: '入门 · 3 层 (最少 7 步)' },
    '4': { n: 4, min: 15, label: '进阶 · 4 层 (最少 15 步)' },
    '5': { n: 5, min: 31, label: '挑战 · 5 层 (最少 31 步)' },
    '6': { n: 6, min: 63, label: '大师 · 6 层 (最少 63 步)' }
  };

  /* 彩虹环配色 */
  var RING_COLORS = [
    'linear-gradient(135deg, #ff7675, #d63031)',
    'linear-gradient(135deg, #fdcb6e, #e17055)',
    'linear-gradient(135deg, #ffeaa7, #fdcb6e)',
    'linear-gradient(135deg, #55efc4, #00b894)',
    'linear-gradient(135deg, #74b9ff, #0984e3)',
    'linear-gradient(135deg, #a29bfe, #6c5ce7)'
  ];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* 生成完整递归解法序列 [{from:0, to:2}] */
  function getOptimalSolution(n, from, to, aux) {
    var moves = [];
    function solve(count, f, t, a) {
      if (count === 1) {
        moves.push({ from: f, to: t });
        return;
      }
      solve(count - 1, f, a, t);
      moves.push({ from: f, to: t });
      solve(count - 1, a, t, f);
    }
    solve(n, from, to, aux);
    return moves;
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
    function fmt(s) { var m = (s / 60) | 0; return m + ':' + ('0' + (s % 60)).slice(-2); }

    function newGame(tierKey) {
      var tier = TIERS[tierKey] || TIERS['3'];
      var n = tier.n;
      var pegs = [[], [], []];
      for (var i = n; i >= 1; i--) pegs[0].push(i);

      S = {
        tierKey: tierKey,
        n: n,
        minMoves: tier.min,
        pegs: pegs,
        selectedPeg: -1,
        moves: 0,
        hist: [],
        sec: 0,
        t0: Date.now(),
        over: false
      };

      build();
      startTimer();
      update();
    }

    function build() {
      box = document.createElement('div');
      box.className = 'hanoi-wrap';
      host.innerHTML = '';
      host.appendChild(box);
      render();
    }

    function render() {
      if (!S) return;
      var html = '<div class="hanoi-board">';
      var pegNames = ['A 柱', 'B 柱', 'C 柱 (目标)'];

      for (var p = 0; p < 3; p++) {
        var isSel = S.selectedPeg === p;
        var rings = S.pegs[p];
        html += '<div class="hanoi-peg-col' + (isSel ? ' sel' : '') + '" data-peg="' + p + '">';
        html += '  <div class="hanoi-pillar"></div>';
        html += '  <div class="hanoi-rings">';

        for (var r = 0; r < rings.length; r++) {
          var size = rings[r];
          var isTop = (r === rings.length - 1);
          var isFloating = isSel && isTop;
          var widthPct = 28 + (size / S.n) * 64;
          var bg = RING_COLORS[(size - 1) % RING_COLORS.length];
          html += '<div class="hanoi-ring' + (isFloating ? ' floating' : '') + '" style="width:' + widthPct + '%;background:' + bg + ';" data-size="' + size + '">';
          html += '  <span>' + size + '</span>';
          html += '</div>';
        }

        html += '  </div>';
        html += '  <div class="hanoi-base"><span class="hanoi-pname">' + pegNames[p] + '</span></div>';
        html += '</div>';
      }
      html += '</div>';

      html += '<div class="hanoi-status-bar">';
      html += '  <span class="hanoi-step-stat">步数: <b>' + S.moves + '</b> / 理论最少 <b>' + S.minMoves + '</b></span>';
      html += '  <span class="hanoi-tip-txt">' + (S.selectedPeg >= 0 ? '已选中，轻点目标柱放下' : '点选柱子拿起最上面的圆环') + '</span>';
      html += '</div>';

      box.innerHTML = html;

      Array.prototype.forEach.call(box.querySelectorAll('.hanoi-peg-col'), function (col) {
        col.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          onPegClick(Number(col.dataset.peg), e.clientX, e.clientY, col);
        });
      });
    }

    function onPegClick(p, cx, cy, el) {
      if (!S || S.over) return;
      if (global.Fx) {
        global.Fx.vibrate(10);
        if (el && cx && cy) global.Fx.ripple(el, cx, cy);
      }

      if (S.selectedPeg < 0) {
        /* 拿起选中柱子顶端的环 */
        if (S.pegs[p].length === 0) {
          if (global.Fx) global.Fx.shake(el);
          api.toast('这根柱子没有圆环可以拿哦');
          return;
        }
        S.selectedPeg = p;
        if (global.Sfx && global.Sfx.pop) global.Sfx.pop();
        else Sfx.click();
        render();
      } else if (S.selectedPeg === p) {
        /* 再次点击同一根柱子：取消拿起 */
        S.selectedPeg = -1;
        Sfx.click();
        render();
      } else {
        /* 移动到目标柱子 */
        var fromPeg = S.selectedPeg;
        var toPeg = p;
        var fromRings = S.pegs[fromPeg];
        var toRings = S.pegs[toPeg];
        var ringToMove = fromRings[fromRings.length - 1];

        if (toRings.length > 0 && toRings[toRings.length - 1] < ringToMove) {
          /* 非法操作：大环压小环 */
          if (global.Fx) global.Fx.shake(el);
          Sfx.lose();
          api.toast('规则注意：大圆环不能放在小圆环上面哦！');
          return;
        }

        /* 合法移动 */
        S.hist.push({ from: fromPeg, to: toPeg });
        fromRings.pop();
        toRings.push(ringToMove);
        S.selectedPeg = -1;
        S.moves++;

        if (global.Sfx && global.Sfx.ring) global.Sfx.ring();
        else Sfx.place();

        render();
        update();
        checkWin();
      }
    }

    function checkWin() {
      if (S.pegs[2].length === S.n) {
        S.over = true;
        stopTimer();
        var perfect = S.moves <= S.minMoves;
        if (global.Fx) {
          global.Fx.confetti({ count: 120 });
          if (perfect) global.Fx.starFountain(null, null, 16);
        }
        if (global.Store) {
          global.Store.addStars(perfect ? 5 : 3);
          global.Store.unlockBadge('hanoi_3');
          if (S.n >= 5) global.Store.unlockBadge('hanoi_master');
        }
        var isRec = global.Store && Store.setBest('hanoi.moves.' + S.n, S.moves, true);
        api.over('win', {
          moves: S.moves,
          sec: S.sec,
          perfect: perfect,
          score: S.moves + '步 (最少' + S.minMoves + ')',
          newRecord: isRec ? S.n + ' 层最少步数新纪录：' + S.moves + ' 步' : ''
        });
      }
    }

    function update() {
      if (!S) return;
      api.status(S.over
        ? '通关！用时 ' + fmt(S.sec) + ' · 步数 ' + S.moves
        : S.n + '层 · 步数 ' + S.moves + '/' + S.minMoves + ' · ' + fmt(S.sec));
      api.info(
        '<b>魔法汉诺塔 · ' + S.n + ' 层</b><br>' +
        '目标：把所有圆环从 <b>A 柱</b> 移动到 <b>C 柱</b>。<br>' +
        '规则：每次只能挪动最顶上一个环，<b>大环绝对不能压在小环上面</b>。<br>' +
        '已走 <b>' + S.moves + '</b> 步（理论最少 <b>' + S.minMoves + '</b> 步）。'
      );
      api.changed();
    }

    return {
      restart: function (o) {
        var tier = (o && o.side) || (S ? S.tierKey : '3');
        if (!TIERS[tier]) tier = '3';
        newGame(tier);
      },
      restore: function (data) {
        try {
          if (!data || !TIERS[String(data.tierKey)] || !data.pegs) return false;
          S = {
            tierKey: String(data.tierKey),
            n: Number(data.n),
            minMoves: Number(data.minMoves),
            pegs: data.pegs.map(function (arr) { return arr.slice(); }),
            selectedPeg: -1,
            moves: data.moves || 0,
            hist: data.hist || [],
            sec: data.sec || 0,
            t0: Date.now() - (data.sec || 0) * 1000,
            over: !!data.over
          };
          build();
          if (!S.over) startTimer();
          update();
          return true;
        } catch (e) { return false; }
      },
      serialize: function () {
        if (!S) return null;
        return {
          v: 1, kind: 'hanoi', tierKey: S.tierKey, n: S.n,
          minMoves: S.minMoves, pegs: S.pegs, moves: S.moves,
          hist: S.hist, sec: S.over ? S.sec : Math.floor((Date.now() - S.t0) / 1000),
          over: S.over, ts: Date.now()
        };
      },
      undo: function () {
        if (!S || S.over || !S.hist.length) {
          api.toast('还没有可以悔棋的步骤');
          return;
        }
        var last = S.hist.pop();
        var ring = S.pegs[last.to].pop();
        S.pegs[last.from].push(ring);
        S.moves = Math.max(0, S.moves - 1);
        S.selectedPeg = -1;
        if (global.Sfx && global.Sfx.undo) global.Sfx.undo();
        else Sfx.click();
        render();
        update();
      },
      hint: function () {
        if (!S || S.over) return;
        /* 从初始到目标的全部解法序列中找启示 */
        var fullSol = getOptimalSolution(S.n, 0, 2, 1);
        var curIdx = S.moves;
        if (curIdx < fullSol.length) {
          var step = fullSol[curIdx];
          var names = ['A', 'B', 'C'];
          api.toast('💡 经典推演建议：尝试把圆环从 ' + names[step.from] + ' 柱移至 ' + names[step.to] + ' 柱');
        } else {
          api.toast('💡 先把较小的环移到辅助柱，为大环挪出通往 C 柱的空间！');
        }
      },
      resign: function () {
        if (!S || S.over) return;
        api.toast('这局重新想想看，换个思路一定能解开！');
        newGame(S.tierKey);
      },
      redraw: function () { if (S) render(); },
      destroy: function () { stopTimer(); }
    };
  }

  global.Games = global.Games || {};
  global.Games.hanoi = {
    stageType: 'puzzle',
    cat: 'puzzle',
    emoji: '🗼',
    name: '魔法汉诺塔',
    desc: '世界经典益智谜题！挪动七彩圆环，大环不压小环，从 A 柱挪到 C 柱，极力锻炼空间逆向思考与规划能力。',
    tags: ['逆向思维', '空间规划', '经典数学'],
    rules: '① 把左柱的塔全部搬到右柱；② 每次只能移动最上面的一片，大环不能压在小环上；③ 先点要拿的柱，再点要放的柱；④ 层数越多越难，理论最少步数是 2ⁿ−1，看看你能逼近多少！',
    guide: '① 递归思想：先把上面 n−1 片搬到中转柱，再搬最大片，最后把 n−1 片压上来；② 三片的奇偶决定第一步方向；③ 永远别把同一片来回移动两次；④ 看提示时会演示正确的一步，跟着走并记住思路。',
    tip: '化整为零：要把最大的环移到底部，必须先把上面所有的环挪到辅助柱上！',
    single: true,
    noLevel: true,
    dom: true,
    sideOptions: [
      ['3', '入门 · 3 层 (7步)'],
      ['4', '进阶 · 4 层 (15步)'],
      ['5', '挑战 · 5 层 (31步)'],
      ['6', '大师 · 6 层 (63步)']
    ],
    mount: mount
  };
})(window);
