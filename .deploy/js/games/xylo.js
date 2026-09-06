/* 叮咚小木琴：8 音敲琴。
   自由弹奏模式随便敲；跟弹模式：程序演奏一首儿歌（键位逐个亮起），
   孩子照着亮起的键按下去，按错不扣分只重放，弹完整首即通关。
   音色复用 WebAudio 八音阶（与记忆亮灯同源）。 */
(function (global) {
  var BAR_COLORS = ['#ff6b6b', '#ff9f43', '#ffb02e', '#9be07a', '#39b878', '#43a7f5', '#7c5cff', '#c86bfa'];
  var SONGS = {
    tiger: { name: '两只老虎', notes: [0, 1, 2, 0, 0, 1, 2, 0, 2, 3, 4, 2, 3, 4, 4, 4, 5, 4, 4, 5, 4, 0, 0, 4, 0, 0, 4] },
    star: { name: '小星星', notes: [0, 0, 4, 4, 5, 5, 4, 3, 3, 2, 2, 1, 1, 0, 4, 4, 3, 3, 2, 2, 1, 4, 4, 3, 3, 2, 2, 1, 0, 0, 4, 4, 5, 5, 4, 3, 3, 2, 2, 1, 1, 0] },
    joy: { name: '欢乐颂', notes: [3, 3, 4, 5, 5, 4, 3, 2, 1, 1, 2, 3, 3, 2, 2, 3, 3, 4, 5, 5, 4, 3, 2, 1, 1, 2, 3, 2, 1, 1] }
  };

  function mount(host, api) {
    var G = { over: false, song: null, idx: 0, done: false, startTs: Date.now() };
    var wrap = null, bars = [], tQueue = [];

    function clearTimers() { tQueue.forEach(clearTimeout); tQueue = []; }

    function build() {
      if (wrap) wrap.remove();
      wrap = document.createElement('div');
      wrap.className = 'xy-wrap';
      var songs = document.createElement('div');
      songs.className = 'xy-songs';
      songs.innerHTML = '<span class="xy-label">🎵 跟弹模式：</span>';
      Object.keys(SONGS).forEach(function (k) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn small';
        b.textContent = SONGS[k].name;
        b.onclick = function () { startSong(k); };
        songs.appendChild(b);
      });
      var free = document.createElement('button');
      free.type = 'button';
      free.className = 'btn small ghost';
      free.textContent = '✋ 自由弹';
      free.onclick = function () { stopSong(); };
      songs.appendChild(free);
      wrap.appendChild(songs);

      var fb = document.createElement('div');
      fb.className = 'xy-fb';
      wrap.appendChild(fb);

      var rack = document.createElement('div');
      rack.className = 'xy-rack';
      for (var i = 0; i < 8; i++) {
        (function (i) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'xy-bar';
          b.style.setProperty('--bc', BAR_COLORS[i]);
          b.style.setProperty('--h', (100 - i * 7) + '%');
          b.innerHTML = '<span>' + 'CDEFGABC'[i] + '</span>';
          b.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            strike(i);
          });
          rack.appendChild(b);
          bars.push(b);
        })(i);
      }
      wrap.appendChild(rack);
      var tip = document.createElement('p');
      tip.className = 'muted small xy-tip';
      tip.textContent = '随便敲也好听！点一首儿歌，跟着亮起的琴键弹，弹完整首就通关。';
      wrap.appendChild(tip);
      host.appendChild(wrap);
      refreshFb();
    }

    function strike(i) {
      Sfx.light(i);
      Fx.vibrate(12);
      bars[i].classList.add('hit');
      global.setTimeout(function () { bars[i].classList.remove('hit'); }, 180);
      if (G.song) {
        var song = SONGS[G.song];
        if (i === song.notes[G.idx]) {
          G.idx++;
          Fx.burst(bars[i], i === song.notes.length - 1 ? '🎉' : '🎵', 3);
          refreshFb();
          if (G.idx >= song.notes.length) songDone();
          else {
            /* 演示下一个音 */
            tQueue.push(global.setTimeout(function () {
              if (G.over || !G.song) return;
              var next = song.notes[G.idx];
              bars[next].classList.add('lit');
              Sfx.light(next);
              tQueue.push(global.setTimeout(function () { bars[next].classList.remove('lit'); }, 320));
            }, 260));
          }
        } else {
          /* 幼儿友好：不扣分，重放目标音 */
          Fx.shake(bars[i]);
          var want = song.notes[G.idx];
          tQueue.push(global.setTimeout(function () {
            bars[want].classList.add('lit');
            Sfx.light(want);
            tQueue.push(global.setTimeout(function () { bars[want].classList.remove('lit'); }, 340));
          }, 200));
        }
      }
      api.changed();
    }

    function refreshFb() {
      if (!wrap) return;
      var fb = wrap.querySelector('.xy-fb');
      if (G.song) {
        var song = SONGS[G.song];
        var dots = '';
        for (var i = 0; i < song.notes.length; i++) {
          dots += '<i class="' + (i < G.idx ? 'ok' : i === G.idx ? 'cur' : '') + '"></i>';
        }
        fb.innerHTML = '🎵 ' + song.name + ' · ' + (G.idx) + ' / ' + song.notes.length + '<div class="xy-prog">' + dots + '</div>';
      } else {
        fb.textContent = '✋ 自由弹奏中——敲出你自己的旋律吧！';
      }
      api.changed();
    }

    function startSong(key) {
      clearTimers();
      G.song = key;
      G.idx = 0;
      G.over = false;
      G.startTs = Date.now();
      Sfx.combo(3);
      api.toast('跟着亮起的琴键弹《' + SONGS[key].name + '》！');
      refreshFb();
      /* 演示第一个音 */
      var first = SONGS[key].notes[0];
      tQueue.push(global.setTimeout(function () {
        bars[first].classList.add('lit');
        Sfx.light(first);
        tQueue.push(global.setTimeout(function () { bars[first].classList.remove('lit'); }, 360));
      }, 500));
      update();
    }

    function stopSong() {
      clearTimers();
      G.song = null;
      G.idx = 0;
      refreshFb();
      update();
    }

    function songDone() {
      clearTimers();
      var name = SONGS[G.song].name;
      G.done = true;
      Fx.confetti({ count: 100 });
      Sfx.win();
      api.over('win', {
        moves: SONGS[G.song].notes.length, sec: Math.round((Date.now() - G.startTs) / 1000),
        score: '弹完《' + name + '》'
      });
      update();
    }

    function update() {
      api.status(G.song ? '跟弹 · ' + SONGS[G.song].name : '自由弹奏');
      api.info(G.song
        ? '亮起的琴键就是下一个音，照着按！按错了琴键会重新演示，不扣分。'
        : '<b>8 音小木琴</b>，随便敲都好听！点上方歌名进入跟弹模式，弹完一首就能拿徽章。');
      api.changed();
    }

    return {
      restart: function (o) {
        clearTimers();
        G.song = null; G.idx = 0; G.over = false; G.done = false;
        G.startTs = Date.now();
        build();
        update();
      },
      pause: function () { clearTimers(); },
      resume: function () {
        /* 跟弹中断后重新演示当前音 */
        if (G.song && !G.over) {
          var want = SONGS[G.song].notes[G.idx];
          tQueue.push(global.setTimeout(function () {
            bars[want].classList.add('lit');
            Sfx.light(want);
            tQueue.push(global.setTimeout(function () { bars[want].classList.remove('lit'); }, 360));
          }, 400));
        }
      },
      undo: function () { api.toast('音乐没有悔棋，继续弹！'); },
      hint: function () {
        if (!G.song) { api.toast('先选一首儿歌进入跟弹模式'); return; }
        var want = SONGS[G.song].notes[G.idx];
        bars[want].classList.add('pat-hint');
        global.setTimeout(function () { bars[want].classList.remove('pat-hint'); }, 1400);
        api.toast('💡 亮一亮的琴键就是下一个音！');
      },
      resign: function () {
        if (G.over) return;
        G.over = true;
        clearTimers();
        api.over('lose', { moves: G.idx, sec: Math.round((Date.now() - G.startTs) / 1000) });
      },
      serialize: function () { return { v: 1, song: G.song, idx: G.idx, ts: G.startTs }; },
      restore: function (d) { return false; /* 音乐游戏不恢复进度 */ },
      destroy: function () { clearTimers(); if (wrap) wrap.remove(); },
      redraw: function () { refreshFb(); }
    };
  }

  global.Games = global.Games || {};
  global.Games.xylo = {
    id: 'xylo', cat: 'create', emoji: '🎵',
    name: '叮咚小木琴',
    desc: '8 音小木琴！自由弹奏随便敲，跟弹模式照着亮起的琴键弹会三首儿歌。音乐启蒙 + 听觉记忆。',
    tags: ['音乐启蒙', '听觉记忆', '3-8 岁'],
    rules: '① 自由模式：随便敲，8 个音都好听；② 跟弹模式：选一首儿歌，亮起的琴键就是下一个音，照着按；③ 按错了琴键会重新演示，不扣分；④ 弹完整首即通关，还能拿徽章！',
    guide: '① 跟弹时先听后按：听准音高再落指；② 记旋律的「形状」：上行还是下行、大跳还是级进；③ 按错会重放当前音，集中精神只改这一步；④ 弹熟一首后试着不看琴键盲弹——那是真正的音乐家！',
    tip: '跟弹时让孩子一边按一边唱出音名（do re mi），手脑耳一起动，记得最牢！',
    single: true, noLevel: true, dom: true,
    mount: mount
  };
})(window);
