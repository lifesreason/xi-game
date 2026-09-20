/* 记忆翻牌：6 / 8 / 12 对 Emoji 配对
   锻炼短时记忆与专注力，翻牌动画 + 计步计时 */
(function (global) {
  var EMOJIS = ['🍎', '🐶', '🌟', '🚗', '🎈', '🐟', '🍓', '🦋', '🌈', '⚽', '🐱', '🌻', '🎁', '🐝', '🎹', '🐘'];

  var MODES = {
    '6': { pairs: 6, cols: 4, label: '轻松 · 6 对' },
    '8': { pairs: 8, cols: 4, label: '标准 · 8 对' },
    '12': { pairs: 12, cols: 6, label: '挑战 · 12 对' }
  };

  function mount(host, api) {
    var S = null, board = null, timer = null, flipBack = null;

    function startTimer() {
      stopTimer();
      timer = setInterval(function () {
        if (!S || S.over) return;
        S.sec = Math.floor((Date.now() - S.t0) / 1000);
        update();
      }, 1000);
    }
    function stopTimer() {
      if (timer) { clearInterval(timer); timer = null; }
      if (flipBack) { clearTimeout(flipBack); flipBack = null; }
    }
    function elapsed() { return S.over ? S.sec : Math.floor((Date.now() - S.t0) / 1000); }
    function fmtTime(s) { var m = (s / 60) | 0; return m + ':' + ('0' + (s % 60)).slice(-2); }

    function shuffle(a) {
      for (var i = a.length - 1; i > 0; i--) {
        var j = (Math.random() * (i + 1)) | 0;
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }

    function newGame(pairs) {
      var m = MODES[pairs] || MODES['8'];
      var pick = shuffle(EMOJIS.slice()).slice(0, m.pairs);
      var deck = shuffle(pick.concat(pick)).map(function (e) {
        return { e: e, done: false };
      });
      S = { mode: pairs, pairs: m.pairs, cols: m.cols, label: m.label, deck: deck,
        first: -1, second: -1, lock: false, moves: 0, found: 0, sec: 0, t0: Date.now(), over: false, hist: [], streak: 0 };
      build();
      startTimer();
      update();
    }

    function build() {
      board = document.createElement('div');
      board.className = 'mem-board';
      board.style.setProperty('--cols', S.cols);
      S.deck.forEach(function (card, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'mem-card';
        b.dataset.i = i;
        b.innerHTML = '<span class="mc-inner"><span class="mc-face mc-back">❓</span>' +
          '<span class="mc-face mc-front">' + card.e + '</span></span>';
        b.onclick = function () { flip(i); };
        board.appendChild(b);
      });
      host.innerHTML = '';
      host.appendChild(board);
    }

    function refresh() {
      Array.prototype.forEach.call(board.children, function (b, i) {
        var card = S.deck[i];
        b.classList.toggle('open', card.done || i === S.first || i === S.second || (S.peek && S.peek.indexOf(i) >= 0));
        b.classList.toggle('done', card.done);
        b.disabled = card.done || S.over;
      });
    }

    function flip(i) {
      if (!S || S.over || S.lock || S.deck[i].done || i === S.first || i === S.second) return;
      Sfx.click();
      if (S.first < 0) {
        S.first = i;
        refresh();
        return;
      }
      S.moves++;
      S.hist.push([S.first, i]);
      var a = S.deck[S.first], b = S.deck[i];
      S.second = i;
      if (a.e === b.e) {
        a.done = b.done = true;
        S.first = -1; S.second = -1; S.found++;
        S.streak++;
        /* 连击反馈：连续配对不放错就有热度加成 */
        if (S.streak >= 2) {
          Sfx.combo(Math.min(5, S.streak));
          if (global.Fx) Fx.burst(board.children[i], '🔥', 3);
        } else Sfx.pop();
        if (S.streak >= 2 && global.Fx) api.toast('🔥 ' + S.streak + ' 连对！');
        refresh();
        update();
        if (S.found === S.pairs) finish();
      } else {
        S.streak = 0;
        Sfx.click();
        S.lock = true;
        refresh();
        flipBack = setTimeout(function () {
          S.first = -1; S.second = -1; S.lock = false;
          refresh();
        }, 800);
        update();
      }
    }

    function finish() {
      S.over = true; S.sec = elapsed(); stopTimer();
      refresh();
      Sfx.win();
      var isRec = global.Store && Store.setBest('memory.moves.' + S.mode, S.moves, true);
      api.over('win', {
        moves: S.moves, sec: S.sec, score: S.label,
        newRecord: isRec ? S.label + ' 最少翻牌新纪录：' + S.moves + ' 次' : ''
      });
    }

    function update() {
      if (!S) return;
      api.status(S.over ? '完成！' + S.moves + ' 次 · ' + fmtTime(S.sec)
        : '配对 ' + S.found + '/' + S.pairs + ' · ' + S.moves + ' 次 · ' + fmtTime(elapsed()));
      var best = global.Store ? Store.getBest('memory.moves.' + S.mode) : null;
      api.info(
        '模式：<b>' + S.label + '</b>　翻开：<b>' + S.moves + '</b> 次' +
        (best ? '　🏆 本机最佳：<b>' + best + '</b> 次' : '') + '<br>' +
        '一次翻两张，一样的就留下。连续配对不放错有连击加成！<br>记不住？点<b>「提示」</b>偷看一秒，但要多翻一次哦！'
      );
      api.changed();
    }

    return {
      restart: function (o) {
        var m = String((o && o.side) || (S ? S.mode : '8'));
        newGame(MODES[m] ? m : '8');
      },
      restore: function (data) {
        try {
          if (!data || !MODES[String(data.mode)] || !data.deck) return false;
          S = {
            mode: String(data.mode), pairs: MODES[String(data.mode)].pairs,
            cols: MODES[String(data.mode)].cols, label: MODES[String(data.mode)].label,
            deck: data.deck.map(function (c) { return { e: c.e, done: !!c.done }; }),
            first: -1, second: -1, lock: false, moves: data.moves || 0, streak: 0,
            found: data.deck.filter(function (c) { return c.done; }).length / 2,
            sec: data.sec || 0, over: !!data.over,
            t0: Date.now() - (data.sec || 0) * 1000, hist: []
          };
          build();
          refresh();
          if (S.over) { update(); return true; }
          startTimer();
          update();
          return true;
        } catch (e) { return false; }
      },
      serialize: function () {
        if (!S) return null;
        return { v: 1, kind: 'memory', mode: S.mode, deck: S.deck, moves: S.moves, sec: elapsed(), over: S.over, ts: Date.now() };
      },
      undo: function () {
        api.toast('翻牌游戏不能悔棋，靠记忆力赢它！');
      },
      hint: function () {
        if (!S || S.over || S.lock) return;
        var hidden = [];
        S.deck.forEach(function (c, i) { if (!c.done) hidden.push(i); });
        if (hidden.length < 2) return;
        S.peek = hidden;
        refresh();
        api.toast('偷偷看一眼，快记住位置！');
        flipBack = setTimeout(function () {
          S.peek = null;
          refresh();
        }, 900);
        S.moves++;
        update();
      },
      resign: function () {
        if (!S || S.over) return;
        S.over = true; S.sec = elapsed(); stopTimer();
        S.deck.forEach(function (c) { c.done = true; });
        refresh();
        api.over('lose', { moves: S.moves, sec: S.sec, score: S.label });
      },
      redraw: function () { if (S) refresh(); },
      destroy: function () {
        stopTimer();
      }
    };
  }

  global.Games = global.Games || {};
  global.Games.memory = {
    cat: 'puzzle',
    emoji: '🃏',
    name: '记忆翻牌',
    desc: '一次翻两张，把一样的找出来。经典记忆力训练，越玩记性越好！',
    tags: ['6/8/12 对', '记忆力', '专注力'],
    rules: '① 每次翻开两张牌：一样就配对成功并保持翻开，不一样会自动盖回；② 记住每张牌的位置，把全部卡牌配对即胜；③ 「提示」可以偷看一瞬间，用的次数越少越强。',
    guide: '① 翻牌时在心里默念「位置+图案」，例如「右上角是猫」；② 先翻开确定的新牌，把不确定的留到后面；③ 配对失败也是信息——记住两张不一样牌的位置；④ 优先收集已见过一半的配对。',
    tip: '记位置比记图案更重要：翻开新牌时，默念「第几行第几个是什么」。',
    single: true,
    noLevel: true,
    dom: true,
    sideOptions: [['6', '轻松 · 6 对'], ['8', '标准 · 8 对'], ['12', '挑战 · 12 对']],
    mount: mount
  };
})(window);
