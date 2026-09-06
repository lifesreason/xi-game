/* 推箱子：经典 Sokoban 儿童版。
   把箱子推到圆圈标记的目标点上。支持撤销、撤销不限次、滑动或方向键移动。
   关卡在加载时用 BFS 求解器验证（保证每关都可解），提示也由求解器给出下一步。
   三个关卡包：萌新 3 关 / 进阶 4 关 / 挑战 3 关，完成整个关卡包算获胜。 */
(function (global) {
  /* 关卡字符：# 墙  空地  @ 玩家  $ 箱子  . 目标  * 箱子在目标上 */
  var LEVELS = [
    /* 萌新包 */
    ['#######',
     '#     #',
     '# .$@ #',
     '#     #',
     '#######'],
    ['######',
     '#    #',
     '# $$ #',
     '# .. #',
     '#  @ #',
     '######'],
    ['#######',
     '#     #',
     '# .$. #',
     '# $@  #',
     '#     #',
     '#######'],
    ['########',
     '#      #',
     '# .$   #',
     '# $@ . #',
     '#      #',
     '########'],
    ['########',
     '#      #',
     '#  ..  #',
     '# $$@  #',
     '#      #',
     '########'],
    /* 进阶包 */
    ['#########',
     '#       #',
     '# .$ $  #',
     '#  @  . #',
     '#   #   #',
     '#########'],
    ['#########',
     '#   #   #',
     '# .$  $ #',
     '#  @ .  #',
     '#   #   #',
     '#########'],
    ['#########',
     '#  . .  #',
     '# $$  $ #',
     '#   @   #',
     '# .     #',
     '#########'],
    ['##########',
     '#        #',
     '# . . .  #',
     '# $$@ $  #',
     '#        #',
     '##########'],
    ['##########',
     '#   .    #',
     '#  $ $ $ #',
     '#   @    #',
     '#   . .  #',
     '##########'],
    /* 挑战包 */
    ['##########',
     '#..  .   #',
     '#   ##   #',
     '# $$$ @  #',
     '#        #',
     '##########'],
    ['##########',
     '#....    #',
     '#        #',
     '# $$$$ @ #',
     '#        #',
     '##########'],
    ['#########',
     '#       #',
     '# $   . #',
     '# $   . #',
     '# $ @ . #',
     '#       #',
     '#########'],
    ['##########',
     '#..    ..#',
     '#  ####  #',
     '# $$  $$ #',
     '#    @   #',
     '##########'],
    ['#########',
     '#       #',
     '# $   . #',
     '# $   . #',
     '# $ @ . #',
     '#       #',
     '#########'],
    /* 大师包 */
    ['##########',
     '#   .    #',
     '# $      #',
     '#   $ @  #',
     '# $   .  #',
     '#    .   #',
     '##########'],
    ['##########',
     '#..   .. #',
     '#        #',
     '# $$  $$ #',
     '#   @    #',
     '#        #',
     '#        #',
     '##########'],
    ['##########',
     '#   .    #',
     '#   $    #',
     '# . $ @  #',
     '#   $    #',
     '#   .    #',
     '##########'],
    ['#########',
     '#       #',
     '#  $ $  #',
     '#  $ $  #',
     '#   @   #',
     '# . .. .#',
     '#########'],
    ['##########',
     '#  .  .  #',
     '#  $  $  #',
     '#  @     #',
     '#  $  $  #',
     '#  .  .  #',
     '##########']
  ];


  var PACKS = [
    ['0', 0, 5, '萌新 · 5 关'],
    ['1', 5, 10, '进阶 · 5 关'],
    ['2', 10, 15, '挑战 · 5 关'],
    ['3', 15, 20, '大师 · 5 关']
  ];
  var DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };

  /* 解析关卡 */
  function parse(rows) {
    var walls = {}, boxes = {}, goals = {}, player = null, W = 0;
    rows.forEach(function (row, y) {
      W = Math.max(W, row.length);
      for (var x = 0; x < row.length; x++) {
        var ch = row[x], k = x + ',' + y;
        if (ch === '#') walls[k] = true;
        else if (ch === '$') boxes[k] = true;
        else if (ch === '.') goals[k] = true;
        else if (ch === '*') { boxes[k] = true; goals[k] = true; }
        else if (ch === '@') player = { x: x, y: y };
      }
    });
    return { walls: walls, boxes: boxes, goals: goals, player: player, W: W, H: rows.length };
  }

  /* BFS 求解器（整数状态 + 死角剪枝 + 父指针回溯 + 状态数上限）。
     返回移动序列；超限或无解返回 null。 */
  function solve(state, maxStates) {
    maxStates = maxStates || 120000;
    var cells = [];
    var idx = {};
    var y, x, k;
    for (y = 0; y < state.H; y++) for (x = 0; x < state.W; x++) {
      k = x + ',' + y;
      if (!state.walls[k]) { idx[k] = cells.length; cells.push({ x: x, y: y }); }
    }
    if (idx[state.player.x + ',' + state.player.y] == null) return null;
    var goalMask = cells.map(function (c) { return state.goals[c.x + ',' + c.y] ? 1 : 0; });
    /* 静态死角：非目标的墙角格子永远不能放箱 */
    var dead = cells.map(function (c, i) {
      if (goalMask[i]) return false;
      var w = function (dx, dy) { return state.walls[(c.x + dx) + ',' + (c.y + dy)]; };
      return (w(1, 0) && w(0, 1)) || (w(1, 0) && w(0, -1)) || (w(-1, 0) && w(0, 1)) || (w(-1, 0) && w(0, -1));
    });
    var DVEC = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    var DKEY = ['u', 'd', 'l', 'r'];
    var startBoxes = cells.map(function (c) { return state.boxes[c.x + ',' + c.y] ? 1 : 0; });
    var startPlayer = idx[state.player.x + ',' + state.player.y];
    var goalCells = cells.map(function (c, i) { return goalMask[i] ? i : -1; }).filter(function (i) { return i >= 0; });

    /* 启发式：每只箱子到最近目标的曼哈顿距离之和（可采纳） */
    function heuristic(b) {
      var h = 0;
      for (var i = 0; i < b.length; i++) {
        if (!b[i]) continue;
        var cx = cells[i].x, cy = cells[i].y, best = 99;
        for (var g = 0; g < goalCells.length; g++) {
          var gc = cells[goalCells[g]];
          var dd = Math.abs(cx - gc.x) + Math.abs(cy - gc.y);
          if (dd < best) best = dd;
        }
        h += best;
      }
      return h;
    }

    /* A*：二叉堆按 f = g + h 取最小 */
    var heap = [];   /* {f, g, node} */
    function heapPush(item) {
      heap.push(item);
      var i = heap.length - 1;
      while (i > 0) {
        var p = (i - 1) >> 1;
        if (heap[p].f <= heap[i].f) break;
        var t = heap[p]; heap[p] = heap[i]; heap[i] = t;
        i = p;
      }
    }
    function heapPop() {
      var top = heap[0];
      var last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        var i = 0;
        for (;;) {
          var l = i * 2 + 1, r = l + 1, m = i;
          if (l < heap.length && heap[l].f < heap[m].f) m = l;
          if (r < heap.length && heap[r].f < heap[m].f) m = r;
          if (m === i) break;
          var t2 = heap[m]; heap[m] = heap[i]; heap[i] = t2;
          i = m;
        }
      }
      return top;
    }

    var nodes = [[startPlayer, startBoxes, -1, -1]];
    var seen = {};
    var h0 = heuristic(startBoxes);
    seen[startPlayer + '|' + startBoxes.join('')] = 0;
    heapPush({ f: h0, node: 0 });
    var goalNode = -1;
    while (heap.length && nodes.length < maxStates) {
      var top = heapPop();
      var cur = nodes[top.node];
      var gCur = top.g !== undefined ? top.g : 0;
      /* 节点存 g 于第三位，父在第四位，方向第五位 */
      var forAllDone = true;
      for (var bi = 0; bi < cur[1].length; bi++) if (cur[1][bi] && !goalMask[bi]) { forAllDone = false; break; }
      if (forAllDone) { goalNode = top.node; break; }
      for (var d = 0; d < 4; d++) {
        var c0 = cells[cur[0]];
        var nx = c0.x + DVEC[d][0], ny = c0.y + DVEC[d][1];
        var nk = nx + ',' + ny;
        if (state.walls[nk]) continue;
        var ni = idx[nk];
        var nb = cur[1].slice();
        if (nb[ni]) {
          var bx = nx + DVEC[d][0], by = ny + DVEC[d][1];
          var bk = bx + ',' + by;
          if (state.walls[bk]) continue;
          var bi2 = idx[bk];
          if (nb[bi2] || dead[bi2]) continue;
          nb[ni] = 0;
          nb[bi2] = 1;
        }
        var key = ni + '|' + nb.join('');
        var ng = cur[2] + 1;
        if (seen[key] !== undefined && seen[key] <= ng) continue;
        seen[key] = ng;
        nodes.push([ni, nb, ng, top.node, d]);
        heapPush({ f: ng + heuristic(nb), g: ng, node: nodes.length - 1 });
      }
    }
    if (goalNode < 0) return null;
    /* 回溯路径 */
    var path = [];
    var n = goalNode;
    while (nodes[n][3] >= 0) {
      path.push(DKEY[nodes[n][4]]);
      n = nodes[n][3];
    }
    return path.reverse();
  }

  function mount(host, api) {
    var G = {
      pack: '0', levelIdx: 0, state: null, history: [],
      over: false, moves: 0, startTs: Date.now(), solvedInPack: 0, busy: false
    };
    /* 关卡解析（验证交由提示/测试按需进行，挂载必须瞬时完成） */
    var valid = LEVELS.map(function (rows) {
      return { rows: rows, state: parse(rows) };
    });
    var packRange = function () {
      for (var i = 0; i < PACKS.length; i++) if (PACKS[i][0] === G.pack) return PACKS[i];
      return PACKS[0];
    };

    var wrap = null, gridEl = null;

    function build() {
      if (wrap) wrap.remove();
      wrap = document.createElement('div');
      wrap.className = 'skb-wrap';
      var bar = document.createElement('div');
      bar.className = 'skb-bar';
      wrap.appendChild(bar);
      gridEl = document.createElement('div');
      gridEl.className = 'skb-grid';
      wrap.appendChild(gridEl);
      /* 方向键盘（移动端主操作） */
      var pad = document.createElement('div');
      pad.className = 'skb-pad';
      [['u', '⬆️'], ['l', '⬅️'], ['d', '⬇️'], ['r', '➡️']].forEach(function (d) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'skb-key';
        b.textContent = d[1];
        b.addEventListener('pointerdown', function (e) { e.preventDefault(); move(d[0]); });
        pad.appendChild(b);
      });
      wrap.appendChild(pad);
      var tip = document.createElement('p');
      tip.className = 'muted small skb-tip';
      tip.textContent = '方向键或直接在棋盘上滑动来推动小人；把所有箱子推到圆圈上！';
      wrap.appendChild(tip);
      host.appendChild(wrap);

      /* 滑动操作 */
      var sx = 0, sy = 0, on = false;
      gridEl.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; on = true; });
      gridEl.addEventListener('pointerup', function (e) {
        if (!on) return;
        on = false;
        var dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) + Math.abs(dy) < 24) return;
        move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u'));
      });
      render();
    }

    function render() {
      var st = G.state, lv = valid[G.levelIdx];
      var W = st.W, H = st.H;
      gridEl.style.setProperty('--w', W);
      gridEl.innerHTML = '';
      for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x++) {
          var k = x + ',' + y;
          var c = document.createElement('div');
          c.className = 'skb-cell';
          if (st.walls[k]) c.classList.add('wall');
          else {
            if (st.goals[k]) c.classList.add('goal');
            if (st.boxes[k]) { c.classList.add('box'); c.textContent = '📦'; }
            else if (st.goals[k]) c.textContent = '◯';
            if (st.player.x === x && st.player.y === y) { c.classList.add('player'); c.textContent = '🧒'; }
          }
          gridEl.appendChild(c);
        }
      }
      var pack = packRange();
      var best = Store.get('sokoban.best.' + G.levelIdx, null);
      wrap.querySelector('.skb-bar').innerHTML =
        '<span>📦 第 <b>' + (G.levelIdx - pack[1] + 1) + '</b> / ' + (pack[2] - pack[1]) + ' 关</span>' +
        '<span>👣 <b>' + G.moves + '</b> 步' + (best ? ' · 最佳 ' + best : '') + '</span>';
      api.changed();
    }

    function move(d) {
      if (G.over || G.busy) return;
      var st = G.state;
      var nx = st.player.x + DIRS[d][0], ny = st.player.y + DIRS[d][1];
      var nk = nx + ',' + ny;
      if (st.walls[nk]) return;
      var pushed = false;
      if (st.boxes[nk]) {
        var bx = nx + DIRS[d][0], by = ny + DIRS[d][1];
        var bk = bx + ',' + by;
        if (st.walls[bk] || st.boxes[bk]) return;
        st.boxes[nk] = false;
        delete st.boxes[nk];
        st.boxes[bk] = true;
        pushed = true;
      }
      G.history.push(JSON.stringify({ p: st.player, b: Object.keys(st.boxes) }));
      if (G.history.length > 300) G.history.shift();
      st.player = { x: nx, y: ny };
      G.moves++;
      pushed ? Sfx.move() : Sfx.click();
      Fx.vibrate(8);
      render();
      after();
    }

    function after() {
      var st = G.state;
      var all = Object.keys(st.goals).every(function (g) { return st.boxes[g]; });
      if (all) levelDone();
    }

    function levelDone() {
      var pack = packRange();
      /* 记录本关最佳步数 */
      var bestKey = 'sokoban.best.' + G.levelIdx;
      var prev = Store.get(bestKey, null);
      if (prev == null || G.moves < prev) Store.set(bestKey, G.moves);
      G.solvedInPack++;
      if (G.levelIdx + 1 >= pack[2]) {
        /* 关卡包全部完成 */
        G.over = true;
        Fx.confetti({ count: 110 });
        Sfx.win();
        api.over('win', {
          moves: G.moves, sec: Math.round((Date.now() - G.startTs) / 1000),
          score: pack[3] + ' · 5 关全部通关'
        });
        update();
      } else {
        Fx.burst(gridEl, '🎉', 8);
        Sfx.combo(3);
        api.toast('过关啦！下一关马上开始～');
        global.setTimeout(function () {
          G.levelIdx++;
          G.state = parse(valid[G.levelIdx].rows);
          G.history = []; G.moves = 0;
          build();
          update();
        }, 1100);
      }
    }

    function update() {
      api.status(G.over ? '通关啦！' : '推箱子 · 第 ' + (G.levelIdx + 1) + ' 关');
      api.info('<b>' + packRange()[3] + '</b>　已走 <b>' + G.moves + '</b> 步<br>' +
        '把 📦 全部推到 ◯ 圆圈上。推错了点「悔棋」退一步，卡住了点「提示」会算出最优的下一步。');
      api.changed();
    }

    /* 调试钩子（暴露求解器与状态，便于排查） */
    global.__skbDebug = {
      solve: solve,
      getState: function () { return G.state; },
      levels: valid,
      busy: function () { return G.busy; },
      over: function () { return G.over; }
    };

    return {
      restart: function (o) {
        G.pack = String((o && o.side) || G.pack || '0');
        if (!packRange()) G.pack = '0';
        var pack = packRange();
        G.levelIdx = pack[1];
        G.state = parse(valid[G.levelIdx].rows);
        G.history = []; G.moves = 0; G.over = false; G.solvedInPack = 0;
        G.startTs = Date.now();
        build();
        update();
      },
      pause: function () {},
      resume: function () {},
      undo: function () {
        if (G.over || !G.history.length) { api.toast('没有可以撤销的步子啦'); return; }
        var s = JSON.parse(G.history.pop());
        G.state.player = s.p;
        var boxes = {};
        s.b.forEach(function (k) { boxes[k] = true; });
        G.state.boxes = boxes;
        G.moves++;
        Sfx.undo();
        render();
      },
      hint: function () {
        if (G.over || G.busy) return;
        var path = solve(G.state, 250000);
        if (!path) { api.toast('当前局面有点绕，先「悔棋」几步吧'); return; }
        /* 演示 solver 的下一步（走一格）；注意先移动再置 busy，否则会被自己的守卫拦下 */
        var d = path[0];
        move(d);
        G.busy = true;
        api.toast('💡 提示：先往「' + ({ u: '上', d: '下', l: '左', r: '右' })[d] + '」走');
        global.setTimeout(function () { G.busy = false; }, 300);
      },
      resign: function () {
        if (G.over) return;
        G.over = true;
        api.over('lose', { moves: G.moves, sec: Math.round((Date.now() - G.startTs) / 1000) });
      },
      serialize: function () {
        return {
          v: 1, pack: G.pack, levelIdx: G.levelIdx, moves: G.moves,
          player: G.state.player, boxes: Object.keys(G.state.boxes), ts: G.startTs
        };
      },
      restore: function (d) {
        if (!d || !valid[d.levelIdx] || !d.player || !d.boxes) return false;
        G.pack = d.pack; G.levelIdx = d.levelIdx; G.moves = d.moves || 0;
        G.state = parse(valid[d.levelIdx].rows);
        G.state.player = d.player;
        var boxes = {};
        d.boxes.forEach(function (k) { boxes[k] = true; });
        G.state.boxes = boxes;
        G.history = []; G.over = false;
        G.startTs = d.ts || Date.now();
        build(); update();
        return true;
      },
      destroy: function () { if (wrap) wrap.remove(); },
      redraw: function () { if (gridEl) render(); }
    };
  }

  global.Games = global.Games || {};
  global.Games.sokoban = {
    id: 'sokoban', cat: 'brain', emoji: '🚜',
    name: '推箱子',
    desc: '经典推箱子儿童版！把箱子推到圆圈上，考验规划与回溯。所有关卡经求解器验证必定可解。',
    tags: ['空间规划', '回溯思维', '6-10 岁'],
    rules: '① 用方向键盘或在棋盘上滑动，控制 🧒 小人移动；② 小人推着 📦 走，箱子只能推不能拉；③ 把所有箱子推到 ◯ 圆圈上即过关；④ 推错了点「悔棋」，卡住了「提示」会给最优走法。',
    guide: '① 逆向思维：想清楚箱子最终停哪，再倒推它从哪来；② 永远别把箱子推进死角（两面墙的夹角）——除非那就是目标；③ 让小人绕到箱子正确的「推面」，走位比力气重要；④ 复杂关卡先推最靠边的箱子，空间会越来越大。',
    tip: '想让箱子往右，小人就要站到它左边。推之前先想好箱子最终停哪，别把它推进死角！',
    single: true, noLevel: true, dom: true,
    sideOptions: [['0', '萌新 · 5 关'], ['1', '进阶 · 5 关'], ['2', '挑战 · 5 关'], ['3', '大师 · 5 关']],
    mount: mount
  };
})(window);
