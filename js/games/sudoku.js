/* 数独：4×4 / 6×6 / 9×9 三种盘面 × 三档难度
   唯一解生成器 + 铅笔标注 + 冲突高亮 + 解题技巧提示（教学向） */
(function (global) {
  var BK = global.BoardKit;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  var SIZES = {
    '4': { n: 4, bw: 2, bh: 2, label: '4×4 入门' },
    '6': { n: 6, bw: 3, bh: 2, label: '6×6 进阶' },
    '9': { n: 9, bw: 3, bh: 3, label: '9×9 经典' }
  };
  /* 各盘面×难度的挖空目标格数（受唯一解约束，挖不满就取能达到的最好结果） */
  var REMOVE = {
    '4': { easy: 5, normal: 8, hard: 10 },
    '6': { easy: 12, normal: 17, hard: 21 },
    '9': { easy: 36, normal: 44, hard: 50 }
  };
  var GEN_BUDGET = 1300; /* 生成时限(ms)，超时用当前最优结果 */

  /* ---------------- 求解器工具 ---------------- */
  function makeCtx(sizeKey) {
    var s = SIZES[sizeKey], n = s.n, bw = s.bw, bh = s.bh;
    var cellBlock = new Array(n * n);
    for (var r = 0; r < n; r++)
      for (var c = 0; c < n; c++)
        cellBlock[r * n + c] = ((r / bh) | 0) * (n / bw) + ((c / bw) | 0);
    return { n: n, bw: bw, bh: bh, cellBlock: cellBlock, sizeKey: sizeKey };
  }

  function makeUsed(ctx) {
    var n = ctx.n;
    var rows = [], cols = [], blocks = [], i, d;
    for (i = 0; i < n; i++) { rows.push(new Array(n + 1)); cols.push(new Array(n + 1)); blocks.push(new Array(n + 1)); }
    for (i = 0; i < n; i++) for (d = 1; d <= n; d++) { rows[i][d] = cols[i][d] = blocks[i][d] = false; }
    return { rows: rows, cols: cols, colsN: cols, blocks: blocks };
  }

  function setCell(ctx, used, bd, i, d, on) {
    var n = ctx.n, r = (i / n) | 0, c = i % n, b = ctx.cellBlock[i];
    used.rows[r][d] = on; used.cols[c][d] = on; used.blocks[b][d] = on;
    bd[i] = on ? d : 0;
  }

  function candMask(ctx, used, i) {
    var n = ctx.n, r = (i / n) | 0, c = i % n, b = ctx.cellBlock[i], mask = 0, d;
    for (d = 1; d <= n; d++)
      if (!used.rows[r][d] && !used.cols[c][d] && !used.blocks[b][d]) mask |= (1 << d);
    return mask;
  }

  function popcount(x) { var c = 0; while (x) { x &= x - 1; c++; } return c; }

  /* 数解数（最多 limit 个即返回），MRV 剪枝 */
  function countSolutions(bd, ctx, limit) {
    var used = makeUsed(ctx), i, d;
    for (i = 0; i < bd.length; i++) if (bd[i]) setCell(ctx, used, bd, i, bd[i], true);
    /* 恢复 bd（setCell 会写回相同值，无碍） */
    var count = 0;
    function bt() {
      if (count >= limit) return;
      var best = -1, bestMask = 0, bestN = 99;
      for (var i = 0; i < bd.length; i++) {
        if (bd[i]) continue;
        var m = candMask(ctx, used, i), c = popcount(m);
        if (c === 0) return;
        if (c < bestN) { bestN = c; best = i; bestMask = m; if (c === 1) break; }
      }
      if (best < 0) { count++; return; }
      for (var d = 1; d <= ctx.n; d++) {
        if (!(bestMask & (1 << d))) continue;
        setCell(ctx, used, bd, best, d, true);
        bt();
        setCell(ctx, used, bd, best, d, false);
        if (count >= limit) return;
      }
    }
    bt();
    return count;
  }

  /* 生成一张完整终盘 */
  function genFull(ctx) {
    var n = ctx.n, bd = new Array(n * n).fill(0), used = makeUsed(ctx);
    function bt(i) {
      if (i >= n * n) return true;
      var digits = [];
      for (var d = 1; d <= n; d++) if (candMask(ctx, used, i) & (1 << d)) digits.push(d);
      shuffle(digits);
      for (var k = 0; k < digits.length; k++) {
        setCell(ctx, used, bd, i, digits[k], true);
        if (bt(i + 1)) return true;
        setCell(ctx, used, bd, i, digits[k], false);
      }
      return false;
    }
    bt(0);
    return bd;
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* 挖空：保证唯一解，达到目标格数或超时为止 */
  function generate(sizeKey, level) {
    var ctx = makeCtx(sizeKey);
    var sol = genFull(ctx);
    var bd = sol.slice();
    var target = REMOVE[sizeKey][level];
    var order = shuffle(bd.map(function (_, i) { return i; }));
    var removed = 0, t0 = Date.now();
    for (var k = 0; k < order.length && removed < target && Date.now() - t0 < GEN_BUDGET; k++) {
      var i = order[k], keep = bd[i];
      bd[i] = 0;
      if (countSolutions(bd.slice(), ctx, 2) === 1) removed++;
      else bd[i] = keep;
    }
    return { given: bd, sol: sol, blanks: removed };
  }

  /* ---------------- 技巧提示（教学核心） ---------------- */
  function unitName(ctx, kind, idx) {
    var n = ctx.n, bw = ctx.bw;
    if (kind === 'row') return '第 ' + (idx + 1) + ' 行';
    if (kind === 'col') return '第 ' + (idx + 1) + ' 列';
    return '第 ' + (idx + 1) + ' 宫';
  }

  /* 在当前盘面上寻找提示：先查错误，再依次用「唯一余数」「隐藏唯一」 */
  function findHint(ctx, cur, given, sol) {
    var n = ctx.n, i, d;
    /* 0. 已填的数有没有错 */
    for (i = 0; i < cur.length; i++)
      if (cur[i] && cur[i] !== sol[i])
        return { type: 'error', cell: i, msg: '这一格填的数和其他格子冲突了，再检查一下？' };
    /* 1. 唯一余数法：某格只剩一个候选数 */
    var used = makeUsed(ctx);
    for (i = 0; i < cur.length; i++) if (cur[i]) setCell(ctx, used, cur, i, cur[i], true);
    for (i = 0; i < cur.length; i++) {
      if (cur[i]) continue;
      var m = candMask(ctx, used, i), c = popcount(m);
      if (c === 1) {
        for (d = 1; d <= n; d++) if (m & (1 << d)) {
          return { type: 'single', cell: i, digit: d, msg: '唯一余数法：这一格所在的行、列、宫已经出现过其他所有数字，只能填 ' + d + '！' };
        }
      }
    }
    /* 2. 隐藏唯一法：某个单元里，某数只有一个位置可放 */
    var units = [];
    var r, c2, b, k;
    for (r = 0; r < n; r++) { var row = []; for (c2 = 0; c2 < n; c2++) row.push(r * n + c2); units.push({ kind: 'row', idx: r, cells: row }); }
    for (c2 = 0; c2 < n; c2++) { var col = []; for (r = 0; r < n; r++) col.push(r * n + c2); units.push({ kind: 'col', idx: c2, cells: col }); }
    var nb = (n / ctx.bw) * (n / ctx.bh);
    for (b = 0; b < nb; b++) {
      var blk = [];
      for (i = 0; i < n * n; i++) if (ctx.cellBlock[i] === b) blk.push(i);
      units.push({ kind: 'block', idx: b, cells: blk });
    }
    for (k = 0; k < units.length; k++) {
      var u = units[k], present = {}, spots = {};
      u.cells.forEach(function (ci) {
        if (cur[ci]) present[cur[ci]] = true;
        else {
          var m2 = candMask(ctx, used, ci);
          for (d = 1; d <= n; d++) if (m2 & (1 << d)) (spots[d] = spots[d] || []).push(ci);
        }
      });
      for (d = 1; d <= n; d++) {
        if (present[d] || !spots[d] || spots[d].length !== 1) continue;
        return {
          type: 'hidden', cell: spots[d][0], digit: d,
          msg: '隐藏唯一法：在' + unitName(ctx, u.kind, u.idx) + '里，数字 ' + d + ' 只能放在这一格！'
        };
      }
    }
    /* 3. 兜底：直接给一个答案格（综合排除） */
    var empties = [];
    for (i = 0; i < cur.length; i++) if (!cur[i]) empties.push(i);
    if (!empties.length) return null;
    var pick = empties[(Math.random() * empties.length) | 0];
    return { type: 'reveal', cell: pick, digit: sol[pick], msg: '这一步需要综合排除多个技巧，先帮你填上 ' + sol[pick] + '，观察一下它为什么只能在这！' };
  }

  /* ---------------- 数独学堂 ---------------- */
  /* 第 1 课用固定盘面（已验证唯一解），后续课程动态生成 */
  var L1_SOL = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1];
  var LESSONS = [
    {
      key: 'rules', emoji: '🧭', title: '认识数独', size: '4',
      desc: '先搞懂行、列、宫三条规则',
      intro: '数独规则：每一行、每一列、每个宫（粗框格）里，数字都不能重复。跟着提示把缺的数补上吧！',
      scripted: [
        { cell: 2, d: 3, hl: [0, 1, 2, 3], msg: '规则一 · 行：第一行已经有 1、2、4，还缺一个 3。点第一行的空格，填上 3！' },
        { cell: 9, d: 1, hl: [1, 5, 9, 13], msg: '规则二 · 列：第二列已经有 2、4、3，还缺一个 1。找到它，填进去！' },
        { cell: 15, d: 1, hl: [10, 11, 14, 15], msg: '规则三 · 宫：右下角的宫（粗框）里已经有 2、3、4，只缺 1。把它填上！' }
      ],
      done: '太棒了！行、列、宫都不重复——你已经学会数独的规则啦！'
    },
    { key: 'single', emoji: '🔍', title: '唯一余数法', size: '4', tech: 'single',
      desc: '一格只剩一个候选数时，答案就是它',
      intro: '看一格所在的行、列、宫：如果其他数字都出现过了，这格只能填剩下的那个。这就是「唯一余数法」！' },
    { key: 'hidden', emoji: '🕵️', title: '隐藏唯一法', size: '4', tech: 'hidden',
      desc: '一个数在某宫/行/列只有一个落脚点',
      intro: '换个角度：盯住一个数字，看它在某个宫（或行、列）里是不是只有一个位置能放——「隐藏唯一法」！' },
    { key: 'mix', emoji: '🏆', title: '小小挑战', size: '6', tech: 'both',
      desc: '6×6 实战，两种方法轮着用',
      intro: '毕业考！这盘 6×6 要把两种方法结合起来用。每一步我都会告诉你该想什么。' }
  ];

  /* 裸唯一：某空格候选只剩一个 */
  function findSingleCell(ctx, cur) {
    var used = makeUsed(ctx), i, d;
    for (i = 0; i < cur.length; i++) if (cur[i]) setCell(ctx, used, cur, i, cur[i], true);
    for (i = 0; i < cur.length; i++) {
      if (cur[i]) continue;
      var m = candMask(ctx, used, i);
      if (popcount(m) === 1) {
        for (d = 1; d <= ctx.n; d++) if (m & (1 << d)) {
          return { cell: i, digit: d, hl: peersOf(ctx, i),
            msg: '唯一余数法：这一格所在的行、列、宫已经出现过其他所有数字，只能填 ' + d + '！' };
        }
      }
    }
    return null;
  }

  function peersOf(ctx, i) {
    var n = ctx.n, r = (i / n) | 0, c = i % n, b = ctx.cellBlock[i], out = [], j, k;
    for (j = 0; j < n; j++) { out.push(r * n + j); out.push(j * n + c); }
    for (k = 0; k < n * n; k++) if (ctx.cellBlock[k] === b) out.push(k);
    return out;
  }

  /* 隐藏唯一：某单元里数字 d 只剩一个位置（且该格不止一个候选，才是"隐藏"的） */
  function findHiddenCell(ctx, cur) {
    var n = ctx.n, used = makeUsed(ctx), i, d;
    for (i = 0; i < cur.length; i++) if (cur[i]) setCell(ctx, used, cur, i, cur[i], true);
    var units = [], r, c2, b, k;
    for (r = 0; r < n; r++) { var row = []; for (c2 = 0; c2 < n; c2++) row.push(r * n + c2); units.push({ kind: '行', idx: r, cells: row }); }
    for (c2 = 0; c2 < n; c2++) { var col = []; for (r = 0; r < n; r++) col.push(r * n + c2); units.push({ kind: '列', idx: c2, cells: col }); }
    var nb = (n / ctx.bw) * (n / ctx.bh);
    for (b = 0; b < nb; b++) {
      var blk = [];
      for (i = 0; i < n * n; i++) if (ctx.cellBlock[i] === b) blk.push(i);
      units.push({ kind: '宫', idx: b, cells: blk });
    }
    for (k = 0; k < units.length; k++) {
      var u = units[k], present = {}, spots = {};
      u.cells.forEach(function (ci) {
        if (cur[ci]) present[cur[ci]] = true;
        else {
          var m2 = candMask(ctx, used, ci);
          for (d = 1; d <= n; d++) if (m2 & (1 << d)) (spots[d] = spots[d] || []).push(ci);
        }
      });
      for (d = 1; d <= n; d++) {
        if (present[d] || !spots[d] || spots[d].length !== 1) continue;
        var cell = spots[d][0];
        if (popcount(candMask(ctx, used, cell)) < 2) continue; /* 单候选格交给唯一余数法讲 */
        return { cell: cell, digit: d, hl: u.cells,
          msg: '隐藏唯一法：在' + unitName(ctx, u.kind === '行' ? 'row' : u.kind === '列' ? 'col' : 'block', u.idx) + '里，数字 ' + d + ' 只能放在这一格！' };
      }
    }
    return null;
  }

  /* ---------------- 游戏实例 ---------------- */
  function mount(host, api) {
    var S = null, bk = null, pad = null, timer = null;
    var root = host;
    var T = null, banner = null, overlay = null; /* 学堂状态 */
    var PRAISE = ['太棒了，就是这样！', '完全正确！', '厉害，继续！', '答对啦，你越来越强了！'];

    function sizeOf() { return S ? SIZES[S.sizeKey] : SIZES['4']; }

    function newGame(sizeKey, level) {
      var ctx = makeCtx(sizeKey);
      var p = generate(sizeKey, level);
      S = {
        sizeKey: sizeKey, n: ctx.n, ctx: ctx,
        given: p.given, sol: p.sol,
        cur: p.given.slice(),
        notes: new Array(p.given.length).fill(0),
        sel: -1, notesMode: false, hintCell: -1,
        errors: 0, placed: 0, filled: p.given.filter(function (v) { return v; }).length,
        sec: 0, t0: Date.now(), over: false, hist: []
      };
      S.blanks = p.blanks;
      buildPad();
      startTimer();
      update();
    }

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

    function snapshot() {
      S.hist.push({
        cur: S.cur.slice(), notes: S.notes.slice(),
        errors: S.errors, placed: S.placed, filled: S.filled
      });
      if (S.hist.length > 400) S.hist.shift();
    }

    function peers(i) {
      var n = S.n, r = (i / n) | 0, c = i % n, b = S.ctx.cellBlock[i], out = [], j, k;
      for (j = 0; j < n; j++) { out.push(r * n + j); out.push(j * n + c); }
      for (k = 0; k < n * n; k++) if (S.ctx.cellBlock[k] === b) out.push(k);
      return out;
    }

    function place(i, d) {
      if (T) { tutPlace(i, d); return; }
      if (S.over || !d || S.given[i]) return;
      if (S.cur[i] === d) { erase(i); return; }
      snapshot();
      if (S.cur[i] === 0) S.filled++;
      S.cur[i] = d;
      S.placed++;
      if (d !== S.sol[i]) S.errors++;
      var bit = 1 << d;
      peers(i).forEach(function (p) { S.notes[p] &= ~bit; });
      S.notes[i] = 0;
      S.hintCell = -1;
      Sfx.click();
      after();
    }

    function erase(i) {
      if (T) { tutErase(i); return; }
      if (S.over || S.given[i]) return;
      /* 格子上没数字但有笔记：擦除 = 清掉这格的笔记 */
      if (!S.cur[i]) {
        if (S.notes[i]) {
          snapshot();
          S.notes[i] = 0;
          Sfx.click();
          api.changed();
          bk.redraw();
        }
        return;
      }
      snapshot();
      S.cur[i] = 0; S.filled--;
      S.hintCell = -1;
      Sfx.click();
      refreshTools();
      after();
    }

    function toggleNote(i, d) {
      if (T) { api.toast('学堂里不用记笔记，跟着提示填就好'); return; }
      if (S.over || S.given[i] || S.cur[i]) return;
      snapshot();
      S.notes[i] ^= (1 << d);
      Sfx.click();
      api.changed();
      bk.redraw();
    }

    function after() {
      update();
      if (S.filled === S.n * S.n) {
        var ok = true, i;
        for (i = 0; i < S.cur.length; i++) if (S.cur[i] !== S.sol[i]) { ok = false; break; }
        if (ok) {
          S.over = true; S.sec = elapsed(); stopTimer();
          api.over('win', { moves: S.placed, sec: S.sec, score: sizeLabel() + ' · ' + gradeText() });
        } else {
          api.toast('盘面填满了，但还有错误的地方，用「检查」看看！');
        }
      }
    }

    function gradeText() {
      return { easy: '简单', normal: '一般', hard: '困难' }[S.level || 'normal'];
    }
    function sizeLabel() { return SIZES[S.sizeKey].label; }

    function update() {
      if (T) { tutUpdate(); return; }
      if (!S) return;
      var left = S.n * S.n - S.filled;
      /* 错误数实时统计：填错的格被擦掉后立即回退 */
      var bad = 0;
      for (var i = 0; i < S.cur.length; i++) if (S.cur[i] && S.cur[i] !== S.sol[i]) bad++;
      api.status(S.over ? '完成！用时 ' + S.sec + ' 秒' : '剩余 ' + left + ' 格 · ' + fmtTime(elapsed()));
      api.info(
        '盘面：<b>' + sizeLabel() + '</b>　进度：<b>' + Math.round(S.filled / (S.n * S.n) * 100) + '%</b><br>' +
        '错误：<b>' + bad + '</b> 处　挖空：<b>' + S.blanks + '</b> 格' +
        (S.notesMode ? '<br>✏️ <b>笔记模式</b>：点下方数字会记成候选小字，再点一次取消。' : '') +
        '<br>先选中一格，再点下方数字填入。'
      );
      api.changed();
      if (bk) bk.redraw();
    }

    function fmtTime(s) {
      var m = (s / 60) | 0;
      return m + ':' + ('0' + (s % 60)).slice(-2);
    }

    /* ---------------- 绘制 ---------------- */
    function draw(ctx2d, W, H, C) {
      if (T) return drawTutor(ctx2d, W, H, C);
      if (!S) return;
      var n = S.n, cell = W / n, i;
      /* 选中格 / 同数高亮 */
      var selVal = S.sel >= 0 ? S.cur[S.sel] : 0;
      for (i = 0; i < n * n; i++) {
        var r = (i / n) | 0, c = i % n, x = c * cell, y = r * cell;
        var v = S.cur[i];
        if (i === S.sel) { ctx2d.fillStyle = 'rgba(66,150,235,.20)'; ctx2d.fillRect(x, y, cell, cell); }
        else if (selVal && v === selVal) { ctx2d.fillStyle = 'rgba(66,150,235,.10)'; ctx2d.fillRect(x, y, cell, cell); }
        if (v && v !== S.sol[i]) { ctx2d.fillStyle = 'rgba(255,107,107,.13)'; ctx2d.fillRect(x, y, cell, cell); }
      }
      /* 提示格 */
      if (S.hintCell >= 0) {
        var hr = (S.hintCell / n) | 0, hc = S.hintCell % n;
        ctx2d.lineWidth = Math.max(2.5, cell * 0.07);
        ctx2d.strokeStyle = C.mark;
        ctx2d.strokeRect(hc * cell + 2, hr * cell + 2, cell - 4, cell - 4);
      }
      /* 数字与笔记 */
      for (i = 0; i < n * n; i++) {
        var r2 = (i / n) | 0, c2 = i % n, cx = c2 * cell + cell / 2, cy = r2 * cell + cell / 2;
        var v2 = S.cur[i];
        if (v2) {
          var wrong = v2 !== S.sol[i];
          ctx2d.fillStyle = S.given[i] ? C.text : (wrong ? C.mark : C.blue);
          ctx2d.font = '700 ' + Math.round(cell * (S.given[i] ? 0.56 : 0.52)) + 'px "PingFang SC","Microsoft YaHei",sans-serif';
          ctx2d.textAlign = 'center'; ctx2d.textBaseline = 'middle';
          ctx2d.fillText(String(v2), cx, cy + cell * 0.02);
        } else if (S.notes[i]) {
          var cols = S.ctx.bw, rowsN = S.ctx.bh;
          ctx2d.fillStyle = C.text;
          ctx2d.font = Math.max(7, Math.round(cell * (n === 9 ? 0.2 : 0.26))) + 'px "PingFang SC",sans-serif';
          ctx2d.textAlign = 'center'; ctx2d.textBaseline = 'middle';
          for (var d = 1; d <= n; d++) {
            if (!(S.notes[i] & (1 << d))) continue;
            var di = d - 1, nc = di % cols, nr = (di / cols) | 0;
            ctx2d.fillText(String(d),
              c2 * cell + cell * (nc + 0.5) / cols,
              r2 * cell + cell * (nr + 0.5) / rowsN);
          }
        }
      }
      /* 网格线：宫线粗、细线细 */
      /* 细线 */
      ctx2d.lineWidth = 0.8; ctx2d.strokeStyle = C.grid;
      ctx2d.beginPath();
      for (i = 0; i <= n; i++) {
        if (i % S.ctx.bw !== 0) { ctx2d.moveTo(i * cell, 0); ctx2d.lineTo(i * cell, H); }
        if (i % S.ctx.bh !== 0) { ctx2d.moveTo(0, i * cell); ctx2d.lineTo(W, i * cell); }
      }
      ctx2d.stroke();
      /* 宫线粗线：竖线按宫宽 bw，横线按宫高 bh */
      ctx2d.lineWidth = Math.max(2, cell * 0.075);
      ctx2d.beginPath();
      for (i = 0; i <= n; i++) {
        if (i % S.ctx.bw === 0) { ctx2d.moveTo(i * cell, 0); ctx2d.lineTo(i * cell, H); }
        if (i % S.ctx.bh === 0) { ctx2d.moveTo(0, i * cell); ctx2d.lineTo(W, i * cell); }
      }
      ctx2d.stroke();
      /* 外框：画成与画布 CSS 圆角吻合的圆角矩形，四角才不会出现缺口 */
      var fr = Math.max(2.5, cell * 0.09), inset = fr / 2 + 0.5;
      ctx2d.lineWidth = fr;
      ctx2d.strokeStyle = C.grid;
      BoardKit.roundRect(ctx2d, inset, inset, W - inset * 2, H - inset * 2, 13);
      ctx2d.stroke();
    }

    /* ---------------- 数字键盘 ---------------- */
    function buildPad() {
      if (pad) pad.remove();
      var n = S.n;
      pad = document.createElement('div');
      pad.className = 'sdk-pad';
      var tools = document.createElement('div');
      tools.className = 'sdk-tools';
      [['✏️ 笔记', function () {
        if (T) { api.toast('学堂里不用记笔记哦'); return; }
        S.notesMode = !S.notesMode;
        refreshTools();
        api.toast(S.notesMode ? '笔记模式：点数字会记成候选小字' : '已退出笔记模式');
      }, 'sdk-notes'],
      ['🧽 擦除', function () { var i = curSel(); if (i >= 0) erase(i); }, ''],
      ['📖 学堂', function () { Sfx.click(); openLessonList(); }, 'sdk-tutor-btn'],
      ['👀 检查', function () { checkNow(); }, '']].forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'btn ' + t[2]; b.textContent = t[0];
        b.onclick = function () { t[1](); };
        tools.appendChild(b);
      });
      var digits = document.createElement('div');
      digits.className = 'sdk-digits';
      digits.style.setProperty('--n', n);
      var left = {};
      for (var d = 1; d <= n; d++) left[d] = n - countIn(S.cur, d);
      for (d = 1; d <= n; d++) {
        (function (d) {
          var b2 = document.createElement('button');
          b2.type = 'button'; b2.className = 'sdk-digit';
          b2.innerHTML = '<b>' + d + '</b><span>' + left[d] + '</span>';
          b2.dataset.d = d;
          b2.onclick = function () {
            var sv = curSel();
            if (sv < 0) { api.toast('先在棋盘上选一格'); return; }
            /* 笔记模式下点数字 = 记候选小字（触屏唯一入口，必须判断） */
            if (!T && S.notesMode) toggleNote(sv, d);
            else place(sv, d);
            refreshTools();
          };
          digits.appendChild(b2);
        })(d);
      }
      pad.appendChild(tools); pad.appendChild(digits);
      root.parentNode.insertBefore(pad, root.nextSibling);
      refreshTools();
    }

    function countIn(arr, d) { var c = 0; for (var i = 0; i < arr.length; i++) if (arr[i] === d) c++; return c; }

    function curSel() { return T ? T.sel : (S ? S.sel : -1); }

    function refreshTools() {
      if (!pad || !S) return;
      pad.querySelector('.sdk-notes').classList.toggle('active', S.notesMode);
      /* 笔记模式时给数字键盘加视觉状态 */
      var digitsBox = pad.querySelector('.sdk-digits');
      if (digitsBox) digitsBox.classList.toggle('notes-on', !!S.notesMode);
      var left = {};
      for (var d = 1; d <= S.n; d++) left[d] = S.n - countIn(S.cur, d);
      Array.prototype.forEach.call(pad.querySelectorAll('.sdk-digit'), function (b) {
        var d = Number(b.dataset.d);
        b.querySelector('span').textContent = left[d];
        b.classList.toggle('done', left[d] === 0);
      });
    }

    function checkNow() {
      if (!S || S.over) return;
      var bad = 0, i;
      for (i = 0; i < S.cur.length; i++) if (S.cur[i] && S.cur[i] !== S.sol[i]) bad++;
      if (bad) api.toast('发现有 ' + bad + ' 处错误，已用红色标出，改过来就好！');
      else if (S.filled === S.n * S.n) { /* 在 after() 已处理 */ }
      else api.toast('到目前为止都正确，继续加油！');
    }

    /* ---------------- 数独学堂运行时 ---------------- */
    function startLesson(li) {
      var L = LESSONS[li];
      var p;
      if (L.scripted) {
        var given = L1_SOL.slice();
        L.scripted.forEach(function (s) { given[s.cell] = 0; });
        p = { given: given, sol: L1_SOL };
      } else {
        p = generate(L.size, 'easy');
      }
      var paused = 0;
      if (S && !S.over) { paused = elapsed(); stopTimer(); }
      T = {
        li: li, L: L, sizeKey: L.size, n: SIZES[L.size].n, ctx: makeCtx(L.size),
        given: p.given, sol: p.sol, cur: p.given.slice(),
        sel: -1, step: 0, errs: 0, hl: [], target: -1, expect: 0,
        msg: L.intro, paused: paused
      };
      buildBanner();
      tutAdvance();
      api.toast('进入学堂：' + L.title);
    }

    function tutAdvance() {
      var L = T.L;
      var full = true, i;
      for (i = 0; i < T.cur.length; i++) if (!T.cur[i]) { full = false; break; }
      if (full || (L.scripted && T.step >= L.scripted.length)) { tutFinish(); return; }
      if (L.scripted) {
        var sc = L.scripted[T.step];
        T.target = sc.cell; T.hl = sc.hl.slice(); T.msg = sc.msg; T.expect = sc.d;
      } else {
        var f = null;
        if (L.tech === 'single') f = findSingleCell(T.ctx, T.cur);
        else if (L.tech === 'hidden') f = findHiddenCell(T.ctx, T.cur) || findSingleCell(T.ctx, T.cur);
        else f = findSingleCell(T.ctx, T.cur) || findHiddenCell(T.ctx, T.cur);
        if (!f) {
          var empt = [];
          for (i = 0; i < T.cur.length; i++) if (!T.cur[i]) empt.push(i);
          var pick = empt[0];
          f = { cell: pick, digit: T.sol[pick], hl: peersOf(T.ctx, pick),
            msg: '这格要用综合排除：把这一行、列、宫里出现过的数都划掉，剩下的就是答案——填 ' + T.sol[pick] + '！' };
        }
        T.target = f.cell; T.hl = f.hl; T.msg = f.msg; T.expect = f.digit;
      }
      T.sel = T.target;
      refreshBanner();
      api.changed();
      bk.redraw();
    }

    function tutPlace(cell, d) {
      if (T.given[cell]) { api.toast('这是题目给出的数字，不能改哦'); return; }
      if (T.cur[cell] === d) return;
      if (d === T.sol[cell]) {
        T.cur[cell] = d;
        Sfx.click();
        api.toast(PRAISE[(Math.random() * PRAISE.length) | 0]);
        T.step++;
        tutAdvance();
      } else {
        T.errs++;
        Sfx.click();
        api.toast('嗯…再想一想：' + T.msg);
      }
    }

    function tutErase(cell) {
      if (T.given[cell] || !T.cur[cell]) return;
      T.cur[cell] = 0;
      Sfx.click();
      bk.redraw();
    }

    function tutSkip() {
      if (T.cur[T.target]) { tutAdvance(); return; }
      T.cur[T.target] = T.expect;
      T.step++;
      api.toast('没关系，看：' + T.msg);
      tutAdvance();
    }

    function tutFinish() {
      T.target = -1; T.hl = []; T.msg = T.L.done ||
        '🎉 课程完成！一共 ' + T.step + ' 步' + (T.errs ? '，答错 ' + T.errs + ' 次（没关系，错错更聪明）' : '，一次都没错，太厉害了！');
      T.sel = -1;
      refreshBanner(true);
      Sfx.win();
      api.changed();
      bk.redraw();
    }

    function endLesson() {
      var paused = T ? T.paused : 0;
      if (banner) { banner.remove(); banner = null; }
      T = null;
      if (S && !S.over) { S.t0 = Date.now() - paused * 1000; startTimer(); }
      update();
    }

    function cleanupT() {
      if (banner) { banner.remove(); banner = null; }
      T = null;
    }

    function buildBanner() {
      if (banner) banner.remove();
      banner = document.createElement('div');
      banner.className = 'sdk-tutor';
      root.parentNode.insertBefore(banner, root.nextSibling);
      refreshBanner();
    }

    function refreshBanner(finished) {
      if (!banner || !T) return;
      var L = T.L;
      var total = L.scripted ? L.scripted.length : T.cur.filter(function (v) { return !v; }).length + (finished ? 0 : T.step);
      var html =
        '<div class="st-head"><span class="st-title">📖 第 ' + (T.li + 1) + ' 课 · ' + esc(L.title) + '</span>' +
        '<button type="button" class="btn small st-exit">退出学堂</button></div>' +
        '<div class="st-msg">' + esc(T.msg) + '</div>';
      if (!finished) {
        html += '<div class="st-foot"><span class="st-prog">第 ' + (T.step + 1) + ' 步' + (total ? ' / 约 ' + total + ' 步' : '') + ' · 答错 ' + T.errs + ' 次</span>' +
          '<button type="button" class="btn small st-skip">看答案</button></div>';
      } else {
        html += '<div class="st-foot"><button type="button" class="btn small primary st-again">再学一课</button>' +
          '<button type="button" class="btn small st-done">回到练习</button></div>';
      }
      banner.innerHTML = html;
      banner.querySelector('.st-exit').onclick = function () { Sfx.click(); endLesson(); };
      var sk = banner.querySelector('.st-skip');
      if (sk) sk.onclick = function () { Sfx.click(); tutSkip(); };
      var ag = banner.querySelector('.st-again');
      if (ag) ag.onclick = function () { Sfx.click(); banner.remove(); banner = null; T = null; openLessonList(); };
      var dn = banner.querySelector('.st-done');
      if (dn) dn.onclick = function () { Sfx.click(); endLesson(); };
    }

    function openLessonList() {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sdk-lesson-mask';
        document.body.appendChild(overlay);
      }
      var html = '<div class="sdk-lesson"><div class="sl-head"><b>📖 数独学堂</b>' +
        '<button type="button" class="btn small sl-close">✕</button></div>' +
        '<p class="muted small">像小老师一样，一步步带你从零基础到独立解题。</p>';
      LESSONS.forEach(function (L, i) {
        html += '<button type="button" class="sl-item" data-li="' + i + '">' +
          '<span class="sl-emoji">' + L.emoji + '</span>' +
          '<span class="sl-txt"><b>第 ' + (i + 1) + ' 课 · ' + esc(L.title) + '</b>' +
          '<i>' + esc(L.desc) + ' · ' + SIZES[L.size].label + '</i></span>' +
          '<span class="sl-go">开始 →</span></button>';
      });
      overlay.innerHTML = html + '</div>';
      overlay.classList.remove('hidden');
      overlay.querySelector('.sl-close').onclick = function () { Sfx.click(); overlay.classList.add('hidden'); };
      Array.prototype.forEach.call(overlay.querySelectorAll('.sl-item'), function (b) {
        b.onclick = function () {
          Sfx.click();
          overlay.classList.add('hidden');
          startLesson(Number(b.dataset.li));
        };
      });
    }

    function drawTutor(g, W, H, C) {
      var n = T.n, cell = W / n, i;
      for (i = 0; i < n * n; i++) {
        var r = (i / n) | 0, c = i % n, x = c * cell, y = r * cell;
        if (T.hl.indexOf(i) >= 0 && i !== T.target && i !== T.sel) {
          g.fillStyle = 'rgba(255,176,46,.15)'; g.fillRect(x, y, cell, cell);
        }
        if (i === T.sel) { g.fillStyle = 'rgba(66,150,235,.20)'; g.fillRect(x, y, cell, cell); }
      }
      if (T.target >= 0) {
        var tr = (T.target / n) | 0, tc = T.target % n;
        g.lineWidth = Math.max(2.5, cell * 0.07);
        g.strokeStyle = '#ff9800';
        g.strokeRect(tc * cell + 2, tr * cell + 2, cell - 4, cell - 4);
      }
      for (i = 0; i < n * n; i++) {
        var v = T.cur[i];
        if (!v) continue;
        var cx = (i % n) * cell + cell / 2, cy = ((i / n) | 0) * cell + cell / 2;
        g.fillStyle = T.given[i] ? C.text : C.blue;
        g.font = '700 ' + Math.round(cell * (T.given[i] ? 0.56 : 0.52)) + 'px "PingFang SC","Microsoft YaHei",sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(v), cx, cy + cell * 0.02);
      }
      g.lineWidth = 0.8; g.strokeStyle = C.grid;
      g.beginPath();
      for (i = 0; i <= n; i++) {
        if (i % T.ctx.bw !== 0) { g.moveTo(i * cell, 0); g.lineTo(i * cell, H); }
        if (i % T.ctx.bh !== 0) { g.moveTo(0, i * cell); g.lineTo(W, i * cell); }
      }
      g.stroke();
      g.lineWidth = Math.max(2, cell * 0.075);
      g.beginPath();
      for (i = 0; i <= n; i++) {
        if (i % T.ctx.bw === 0) { g.moveTo(i * cell, 0); g.lineTo(i * cell, H); }
        if (i % T.ctx.bh === 0) { g.moveTo(0, i * cell); g.lineTo(W, i * cell); }
      }
      g.stroke();
      /* 外框：圆角矩形，与画布圆角吻合 */
      var tfr = Math.max(2.5, cell * 0.09), tinset = tfr / 2 + 0.5;
      g.lineWidth = tfr;
      g.strokeStyle = C.grid;
      BoardKit.roundRect(g, tinset, tinset, W - tinset * 2, H - tinset * 2, 13);
      g.stroke();
    }

    function tutUpdate() {
      api.status('📖 学堂 · ' + T.L.title);
      api.info('<b>' + T.L.emoji + ' ' + T.L.title + '</b><br>' + esc(T.msg) +
        '<br><span class="muted small">跟着橙色框走，点错也没关系，我会一直陪着你。</span>');
      api.changed();
      bk.redraw();
    }

    /* ---------------- 对外接口 ---------------- */
    bk = BK.create(root, {
      aspect: 1,
      draw: draw,
      click: function (x, y, W) {
        var st = T || S;
        if (!st || st.over) return;
        var cell = W / st.n, c = (x / cell) | 0, r = (y / cell) | 0;
        if (c < 0 || r < 0 || c >= st.n || r >= st.n) return;
        st.sel = r * st.n + c;
        Sfx.click();
        bk.redraw();
      }
    });

    function onKey(e) {
      /* 焦点在下拉框/输入框时不要把按键当作填数 */
      if (e.target && /SELECT|INPUT|TEXTAREA/.test(e.target.tagName)) return;
      var st = T || S;
      if (!st || st.over) return;
      var n = st.n;
      if (e.key >= '1' && e.key <= String(n)) {
        var d = Number(e.key);
        var sv = curSel();
        if (sv < 0) return;
        if (!T && S.notesMode) toggleNote(sv, d); else place(sv, d);
        refreshTools();
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        if (curSel() >= 0) { erase(curSel()); refreshTools(); }
      } else if (e.key.indexOf('Arrow') === 0 && curSel() >= 0) {
        var r = (curSel() / n) | 0, c = curSel() % n;
        if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
        if (e.key === 'ArrowDown') r = Math.min(n - 1, r + 1);
        if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
        if (e.key === 'ArrowRight') c = Math.min(n - 1, c + 1);
        st.sel = r * n + c;
        bk.redraw();
        e.preventDefault();
      } else if (e.key.toLowerCase() === 'n') {
        if (T) { api.toast('学堂里不用记笔记哦'); return; }
        S.notesMode = !S.notesMode; refreshTools();
      }
    }
    global.addEventListener('keydown', onKey);

    update();

    return {
      restart: function (o) {
        cleanupT();
        var sizeKey = (o && SIZES[String(o.side)]) ? String(o.side) : (S ? S.sizeKey : '4');
        var level = (o && o.level) || 'normal';
        S = null;
        newGame(sizeKey, level);
        S.level = level;
        update();
      },
      setLevel: function (lv) { if (S) S.level = lv; },
      restore: function (data) {
        try {
          cleanupT();
          if (!data || !SIZES[String(data.size)] || !data.given || data.given.length !== SIZES[String(data.size)].n * SIZES[String(data.size)].n) return false;
          var ctx = makeCtx(String(data.size));
          S = {
            sizeKey: String(data.size), n: ctx.n, ctx: ctx,
            given: data.given.slice(), sol: data.sol.slice(),
            cur: data.cur.slice(), notes: data.notes.slice(),
            sel: -1, notesMode: false, hintCell: -1,
            errors: data.errors || 0, placed: data.placed || 0,
            filled: data.cur.filter(function (v) { return v; }).length,
            level: data.level || 'normal',
            sec: data.sec || 0, t0: Date.now() - (data.sec || 0) * 1000,
            over: !!data.over, hist: [], blanks: data.blanks || 0
          };
          if (S.over) { update(); return true; }
          buildPad();
          startTimer();
          update();
          return true;
        } catch (e) { return false; }
      },
      serialize: function () {
        if (!S) return null;
        return {
          v: 1, kind: 'sudoku', size: S.sizeKey, level: S.level,
          given: S.given, sol: S.sol, cur: S.cur, notes: S.notes,
          errors: S.errors, placed: S.placed, blanks: S.blanks,
          sec: elapsed(), over: S.over, ts: Date.now()
        };
      },
      undo: function () {
        if (T) { api.toast('学堂进行中，先点「退出学堂」'); return; }
        if (!S || S.over || !S.hist.length) return;
        var s = S.hist.pop();
        S.cur = s.cur; S.notes = s.notes;
        S.errors = s.errors; S.placed = s.placed; S.filled = s.filled;
        S.hintCell = -1;
        Sfx.click();
        refreshTools();
        update();
      },
      hint: function () {
        if (T) { api.toast('学堂里有逐步讲解，不用提示按钮哦'); return; }
        if (!S || S.over) return;
        var h = findHint(S.ctx, S.cur, S.given, S.sol);
        if (!h) return;
        S.hintCell = h.cell;
        S.sel = h.cell;
        api.toast(h.msg);
        bk.redraw();
      },
      resign: function () {
        if (T) { api.toast('学堂进行中，先点「退出学堂」'); return; }
        if (!S || S.over) return;
        S.over = true; S.sec = elapsed(); stopTimer();
        for (var i = 0; i < S.cur.length; i++) S.cur[i] = S.sol[i];
        S.filled = S.cur.length;
        update();
        api.over('lose', { moves: S.placed, sec: S.sec, score: sizeLabel() + ' · ' + gradeText() });
      },
      redraw: function () { if (bk) bk.redraw(); },
      destroy: function () {
        stopTimer();
        cleanupT();
        global.removeEventListener('keydown', onKey);
        if (overlay) { overlay.remove(); overlay = null; }
        if (pad) { pad.remove(); pad = null; }
        if (bk) { try { bk.destroy(); } catch (e) {} bk = null; }
      }
    };
  }

  global.Games = global.Games || {};
  global.Games.sudoku = {
    cat: 'board',
    emoji: '🔢',
    name: '数独',
    desc: '从 4×4 一路练到 9×9！铅笔标注、错误检查、解题技巧提示，一步步成为数独高手。',
    tags: ['4×4/6×6/9×9', '唯一解题库', '技巧教学'],
    rules: '① 每行、每列、每个粗框宫里，数字都不能重复；② 先点格子，再点下方数字填入，再点一次可取消；③ ✏️ 笔记模式点数字会记成候选小字；④ 填满且全部正确即通关，「检查」随时帮你纠错。',
    guide: '① 先做「唯一余数法」：某格只剩一个能填的数就填它；② 再用「隐藏唯一法」：某数字在某行/宫只剩一个位置；③ 笔记模式把候选数都标出来，排除法一目了然；④ 卡住时从数字出现最多的行/宫入手。',
    tip: '先找只剩一个空位的行、列或宫——「隐藏唯一」是数独最常用的突破口。',
    single: true,
    sideOptions: [['4', '4×4 入门'], ['6', '6×6 进阶'], ['9', '9×9 经典']],
    mount: mount
  };
})(window);
