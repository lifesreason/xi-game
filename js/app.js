/* 应用外壳：视图路由、对局控制、战绩、设置、离线缓存 */
(function (global) {
  var GAMES = ['gomoku', 'go', 'checkers', 'xiangqi', 'sudoku'];
  var LEVEL_NAME = { easy: '简单', normal: '一般', hard: '困难' };
  var RESULT_NAME = { win: '胜', lose: '负', draw: '和' };
  var STORE_KEY = 'kidboard.v1.save.';

  var settings = Store.getSettings();
  if (!settings.sizes) settings.sizes = {}; /* 各游戏自定义档位（数独盘面大小等） */
  var currentId = null, inst = null;
  var els = {};

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  var toastTimer = null;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.classList.remove('show'); }, 1900);
  }

  /* ---------------- 视图 ---------------- */
  function showView(name) {
    ['home', 'play', 'records', 'settings'].forEach(function (v) {
      $('view-' + v).classList.toggle('hidden', v !== name);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.classList.toggle('active', t.dataset.view === name);
    });
    if (name === 'home') renderHome();
    if (name === 'records') renderRecords();
    if (name === 'play' && inst && inst.redraw) inst.redraw();
    global.scrollTo(0, 0);
  }

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    var grid = $('game-grid');
    grid.innerHTML = '';
    GAMES.forEach(function (id) {
      var g = global.Games[id];
      var card = el('button', 'game-card');
      card.type = 'button';
      card.innerHTML =
        '<div class="gc-emoji">' + g.emoji + '</div>' +
        '<div class="gc-name">' + esc(g.name) + '</div>' +
        '<div class="gc-desc">' + esc(g.desc) + '</div>' +
        '<div class="gc-tags">' + g.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
        '<div class="gc-go">开始游戏 →</div>';
      card.onclick = function () { Sfx.click(); openGame(id); };
      grid.appendChild(card);
    });

    /* 未完成的对局 */
    var saved = null, savedId = null;
    GAMES.forEach(function (id) {
      var d = Store.loadGame(id);
      if (d && d.data && !d.finished) { saved = d; savedId = id; }
    });
    var cc = $('continue-card');
    if (saved) {
      var sg = global.Games[savedId];
      cc.hidden = false;
      $('continue-txt').textContent = sg.name + ' · ' +
        (sg.sideOptions
          ? '盘面 ' + (saved.opts && saved.opts.side) + ' · ' + LEVEL_NAME[saved.opts.level || 'normal']
          : (saved.opts && saved.opts.mode === 'pvp' ? '双人对战' : '人机 ' + LEVEL_NAME[saved.opts.level])) +
        ' · ' + new Date(saved.data.ts || Date.now()).toLocaleString('zh-CN');
      $('btn-continue').onclick = function () { Sfx.click(); openGame(savedId, true); };
    } else cc.hidden = true;

    /* 战绩 */
    var st = Store.getStats(), box = $('home-stats');
    box.innerHTML = '';
    var w = 0, l = 0, d = 0;
    GAMES.forEach(function (id) { var s = st[id] || {}; w += s.win || 0; l += s.lose || 0; d += s.draw || 0; });
    [['胜', w, 'w'], ['负', l, 'l'], ['和', d, 'd']].forEach(function (a) {
      var s = el('div', 'stat ' + a[2]);
      s.innerHTML = '<b>' + a[1] + '</b><span>' + a[0] + '</span>';
      box.appendChild(s);
    });
  }

  /* ---------------- 对局 ---------------- */
  function apiFactory(id) {
    return {
      getMode: function () { return settings.mode; },
      getLevel: function () { return settings.levels[id] || 'normal'; },
      getSide: function () { return settings.side; },
      getOption: function (k) { return settings[k]; },
      status: function (t) { els.status.textContent = t; },
      info: function (h) { els.info.innerHTML = h; },
      toast: toast,
      busy: function (on) {
        ['btn-undo', 'btn-hint', 'btn-restart', 'btn-resign'].forEach(function (b) { $(b).disabled = !!on; });
        els.status.classList.toggle('think', !!on);
      },
      changed: function () { saveCurrent(); },
      over: function (result, info) { onGameOver(id, result, info); }
    };
  }

  function saveCurrent() {
    if (!currentId || !inst) return;
    var d = inst.serialize();
    var moves = (d.h && d.h.length) || (d.history && d.history.length) || 0;
    Store.saveGame(currentId, {
      opts: { mode: settings.mode, level: settings.levels[currentId], side: restartOpts().side },
      data: d, moves: moves, ts: Date.now()
    });
  }

  /* 组装重启参数：普通棋类用全局先后手；数独等 sideOptions 游戏用各自的档位值 */
  function restartOpts() {
    var g = global.Games[currentId];
    return {
      mode: settings.mode,
      level: settings.levels[currentId] || 'normal',
      side: (g && g.sideOptions)
        ? (settings.sizes[currentId] || g.sideOptions[0][0])
        : settings.side
    };
  }

  function openGame(id, keep) {
    currentId = id;
    var g = global.Games[id];
    $('play-title').textContent = g.emoji + ' ' + g.name;

    /* 侧栏初始值 */
    els.selMode.value = settings.mode;
    els.selLevel.value = settings.levels[id] || 'normal';
    refreshSideOptions(id);

    showView('play');

    if (inst) { try { inst.destroy(); } catch (e) {} inst = null; }
    $('board-host').innerHTML = '';
    inst = g.mount($('board-host'), apiFactory(id));

    var restored = false;
    if (keep !== false) {
      var saved = Store.loadGame(id);
      if (saved && saved.data) restored = inst.restore(saved.data);
    }
    if (!restored) {
      inst.restart(restartOpts());
    }
    renderExtra(id);
    if (restored) toast('已恢复上次未下完的对局');
  }

  function refreshSideOptions(id) {
    var g = global.Games[id];
    var sel = els.selSide;
    sel.innerHTML = '';
    if (g.sideOptions) {
      /* 数独等游戏：档位选择器用于切换盘面大小 */
      g.sideOptions.forEach(function (o) {
        var x = el('option', null, o[1]);
        x.value = o[0];
        sel.appendChild(x);
      });
      sel.value = settings.sizes[id] || g.sideOptions[0][0];
    } else {
      (g.sides || ['先手', '后手']).forEach(function (s, i) {
        var o = el('option', null, s);
        o.value = String(i + 1);
        sel.appendChild(o);
      });
      sel.value = String(settings.side);
    }
    els.selMode.parentNode.style.display = g.single ? 'none' : '';
    $('field-level').style.display = (g.single || settings.mode === 'pve') ? '' : 'none';
    $('field-side').style.display = (g.single || settings.mode === 'pve') ? '' : 'none';
    els.selLevel.value = settings.levels[id] || 'normal';
  }

  function renderExtra(id) {
    /* 游戏自定义按钮（如围棋“停一手”） */
    var box = $('extra-btns');
    if (!inst || !inst.extra) { if (box) box.innerHTML = ''; return; }
    box.innerHTML = '';
    inst.extra.forEach(function (b) {
      var btn = el('button', 'btn', b.label);
      btn.onclick = function () { Sfx.click(); b.fn(); };
      box.appendChild(btn);
    });
  }

  function onGameOver(id, result, info) {
    Store.addResult(id, result);
    Store.addRecord({
      game: id, name: global.Games[id].name, result: result,
      level: settings.levels[id] || 'normal', mode: settings.mode,
      moves: info.moves || 0, sec: info.sec || 0, ts: Date.now(),
      score: info.score || ''
    });
    Store.clearGame(id);
    if (result === 'win') Sfx.win();
    else if (result === 'lose') Sfx.lose();
    else Sfx.draw();

    var m = $('result-modal');
    $('result-emoji').textContent = result === 'win' ? '🎉' : result === 'lose' ? '💪' : '🤝';
    $('result-title').textContent =
      result === 'win' ? '你赢啦！' : result === 'lose' ? '这局输了' : '和棋';
    $('result-sub').textContent = global.Games[id].name + ' · ' +
      (settings.mode === 'pvp' ? '双人' : LEVEL_NAME[settings.levels[id]]) +
      ' · ' + (info.moves || 0) + ' 手 · ' + (info.sec || 0) + ' 秒' +
      (info.score ? ' · ' + info.score : '');
    m.classList.remove('hidden');
  }

  /* ---------------- 战绩 ---------------- */
  function renderRecords() {
    var st = Store.getStats(), box = $('records-summary');
    box.innerHTML = '';
    var tw = 0, tl = 0, td = 0;
    GAMES.forEach(function (id) {
      var s = st[id] || { win: 0, lose: 0, draw: 0 };
      tw += s.win; tl += s.lose; td += s.draw;
      var d = el('div', 'stat');
      d.innerHTML = '<b>' + global.Games[id].emoji + ' ' + (s.win || 0) + '/' + (s.lose || 0) + '/' + (s.draw || 0) +
        '</b><span>' + global.Games[id].name + ' 胜/负/和</span>';
      box.appendChild(d);
    });
    var total = el('div', 'stat');
    total.innerHTML = '<b>' + (tw + tl ? Math.round(tw / (tw + tl) * 100) : 0) + '%</b><span>总胜率（' + (tw + tl + td) + ' 局）</span>';
    box.appendChild(total);

    var list = Store.getRecords();
    var tb = $('records-table').querySelector('tbody');
    tb.innerHTML = '';
    $('records-empty').style.display = list.length ? 'none' : '';
    list.slice(0, 100).forEach(function (r) {
      var tr = el('tr');
      var color = r.result === 'win' ? 'var(--good)' : r.result === 'lose' ? 'var(--bad)' : 'var(--warn)';
      tr.innerHTML =
        '<td>' + esc(r.name || '') + '</td>' +
        '<td style="color:' + color + ';font-weight:700">' + RESULT_NAME[r.result] + '</td>' +
        '<td>' + (r.mode === 'pvp' ? '双人' : LEVEL_NAME[r.level]) + '</td>' +
        '<td>' + (r.moves || 0) + '</td>' +
        '<td>' + (r.sec || 0) + 's</td>' +
        '<td>' + new Date(r.ts).toLocaleString('zh-CN') + '</td>' +
        '<td><span class="del" data-ts="' + r.ts + '">✕</span></td>';
      tb.appendChild(tr);
    });
    Array.prototype.forEach.call(tb.querySelectorAll('.del'), function (s) {
      s.onclick = function () {
        Store.delRecord(Number(s.dataset.ts));
        renderRecords();
      };
    });
  }

  /* ---------------- 设置 ---------------- */
  function applySettings() {
    document.documentElement.setAttribute('data-theme', settings.theme);
    Sfx.setEnabled(settings.sound);
    Store.saveSettings(settings);
    if (inst && inst.redraw) inst.redraw();
  }

  function renderSettings() {
    $('set-theme').value = settings.theme;
    $('set-sound').checked = !!settings.sound;
    $('set-coords').checked = !!settings.coords;

    var box = $('level-presets');
    box.innerHTML = '';
    GAMES.forEach(function (id) {
      var g = global.Games[id];
      var d = el('div', 'preset');
      var name = el('div', 'pn', g.emoji + ' ' + g.name);
      var sel = el('select');
      [['easy', '🐣 简单'], ['normal', '🙂 一般'], ['hard', '🔥 困难']].forEach(function (o) {
        var op = el('option', null, o[1]); op.value = o[0]; sel.appendChild(op);
      });
      sel.value = settings.levels[id] || 'normal';
      sel.onchange = function () {
        settings.levels[id] = sel.value;
        Store.saveSettings(settings);
        if (currentId === id && inst && inst.setLevel) inst.setLevel(sel.value);
        toast(g.name + '默认难度：' + LEVEL_NAME[sel.value]);
      };
      d.appendChild(name); d.appendChild(sel);
      box.appendChild(d);
    });

    var tips = $('tips-list');
    tips.innerHTML = '';
    GAMES.forEach(function (id) {
      var li = el('li', null, global.Games[id].name + '：' + global.Games[id].tip);
      tips.appendChild(li);
    });

    var st = $('offline-state');
    var sw = ('serviceWorker' in navigator) && navigator.serviceWorker.controller;
    st.textContent = '存储：' + (Store.persistent ? '本机浏览器可用 ✅' : '当前环境不可用（仅临时内存）⚠️') +
      '　离线缓存：' + (sw ? '已启用 ✅（断网也能打开）' :
        (location.protocol === 'file:' ? '用本地文件方式打开，直接可用（无需缓存）' : '首次访问后自动生效'));
  }

  /* ---------------- 导出 / 导入 ---------------- */
  function doExport() {
    var data = Store.exportAll();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '小小棋盘-备份-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('已导出备份文件');
  }
  function doImport() {
    els.file.value = '';
    els.file.click();
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    els.toast = $('toast');
    els.status = $('play-status');
    els.info = $('game-info');
    els.selMode = $('sel-mode');
    els.selLevel = $('sel-level');
    els.selSide = $('sel-side');
    els.file = $('file-input');

    /* 操作卡片里插入一个自定义按钮容器 */
    var ops = $('btn-resign').parentNode;
    var extra = el('div', 'btn-col');
    extra.id = 'extra-btns';
    extra.style.marginTop = '8px';
    ops.appendChild(extra);

    applySettings();
    renderSettings();
    renderHome();

    /* 导航 */
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.onclick = function () { Sfx.click(); showView(t.dataset.view); };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-goto]'), function (b) {
      b.onclick = function () { Sfx.click(); showView(b.dataset.goto); };
    });

    $('btn-back').onclick = function () { Sfx.click(); showView('home'); };
    $('btn-restart').onclick = function () {
      Sfx.click();
      if (inst) inst.restart(restartOpts());
      Store.clearGame(currentId);
      toast('已重新开始');
    };
    $('btn-undo').onclick = function () { Sfx.click(); if (inst) inst.undo(); };
    $('btn-hint').onclick = function () { Sfx.click(); if (inst) inst.hint(); };
    $('btn-resign').onclick = function () {
      Sfx.click();
      if (settings.mode === 'pvp') { toast('双人模式下请继续下棋'); return; }
      if (inst) inst.resign();
    };

    els.selMode.onchange = function () {
      settings.mode = els.selMode.value;
      Store.saveSettings(settings);
      refreshSideOptions(currentId);
      if (inst) inst.restart(restartOpts());
      Store.clearGame(currentId);
      toast(els.selMode.value === 'pvp' ? '已切换为双人对战' : '已切换为人机对战');
    };
    els.selLevel.onchange = function () {
      settings.levels[currentId] = els.selLevel.value;
      Store.saveSettings(settings);
      if (inst && inst.setLevel) inst.setLevel(els.selLevel.value);
      refreshSettingsPresets();
      toast('难度已切换为「' + LEVEL_NAME[els.selLevel.value] + '」，下一手生效');
    };
    els.selSide.onchange = function () {
      Sfx.click();
      var g = global.Games[currentId];
      if (g && g.sideOptions) {
        settings.sizes[currentId] = els.selSide.value;
        Store.saveSettings(settings);
        if (inst) inst.restart(restartOpts());
        Store.clearGame(currentId);
        toast('盘面已切换为「' + els.selSide.value + '」，重新开始');
        return;
      }
      settings.side = Number(els.selSide.value);
      Store.saveSettings(settings);
      if (inst) inst.restart(restartOpts());
      Store.clearGame(currentId);
      toast('已交换先后手，重新开局');
    };

    $('btn-again').onclick = function () {
      Sfx.click();
      $('result-modal').classList.add('hidden');
      if (inst) inst.restart(restartOpts());
      Store.clearGame(currentId);
    };
    $('btn-result-home').onclick = function () {
      Sfx.click();
      $('result-modal').classList.add('hidden');
      showView('home');
    };

    /* 设置项 */
    $('set-theme').onchange = function () { settings.theme = this.value; applySettings(); };
    $('set-sound').onchange = function () { settings.sound = this.checked; applySettings(); Sfx.click(); };
    $('set-coords').onchange = function () { settings.coords = this.checked; applySettings(); };

    $('btn-clear-records').onclick = function () {
      if (global.confirm('确定清空所有对局记录吗？')) { Store.clearRecords(); renderRecords(); toast('记录已清空'); }
    };
    $('btn-export').onclick = doExport;
    $('btn-export2').onclick = doExport;
    $('btn-import').onclick = doImport;
    $('btn-import2').onclick = doImport;
    els.file.onchange = function () {
      var f = this.files && this.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          if (Store.importAll(JSON.parse(fr.result))) {
            settings = Store.getSettings();
            applySettings(); renderSettings(); renderRecords(); renderHome();
            toast('数据已导入');
          } else toast('文件格式不对');
        } catch (e) { toast('导入失败：' + e.message); }
      };
      fr.readAsText(f);
    };
    $('btn-clear-all').onclick = function () {
      if (global.confirm('这会清空全部记录、设置和存档，确定吗？')) {
        Store.clearAll();
        settings = Store.getSettings();
        applySettings(); renderSettings(); renderRecords(); renderHome();
        toast('已清空全部数据');
      }
    };

    /* 离线缓存 */
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      global.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () { /* file:// 或不支持时忽略 */ });
      });
    }

    global.addEventListener('beforeunload', saveCurrent);
  }

  function refreshSettingsPresets() {
    var sels = $('level-presets').querySelectorAll('select');
    GAMES.forEach(function (id, i) { if (sels[i]) sels[i].value = settings.levels[id] || 'normal'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
