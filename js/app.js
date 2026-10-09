/* 应用外壳：视图路由、对局控制、战绩、设置、离线缓存 */
(function (global) {
  var GAMES = ['gomoku', 'go', 'checkers', 'xiangqi', 'sudoku', 'slide', 'memory', 'game24', 'mathcamp', 'english', 'hanoi', 'lightsout', 'nonogram', 'mastermind', 'pattern', 'shadow', 'mole', 'catch', 'puzzle', 'diff', 'simon', 'slidepic', 'dragpuzzle', 'sokoban', 'pipes', 'mines', 'balance', 'xylo', 'paint'];
  /* 首页分类筛选：对弈 / 益智 / 数字 / 启蒙 */
  var CATS = [
    { key: 'all', label: '全部' },
    { key: 'board', label: '♟️ 棋类对弈' },
    { key: 'puzzle', label: '🧩 益智解谜' },
    { key: 'number', label: '🔢 数字思维' },
    { key: 'kids', label: '🌱 启蒙乐园' },
    { key: 'brain', label: '🧠 思维进阶' },
    { key: 'create', label: '🎨 创意音乐' }
  ];
  var catFilter = 'all';
  var LEVEL_NAME = { easy: '简单', normal: '一般', hard: '困难' };
  var RESULT_NAME = { win: '胜', lose: '负', draw: '和' };
  var STORE_KEY = 'kidboard.v1.save.';

  var settings = Store.getSettings();
  if (!settings.sizes) settings.sizes = {}; /* 各游戏自定义档位（数独盘面大小等） */
  var currentId = null, inst = null, currentFinished = false;
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
    /* 任何视图切换都收掉浮层弹窗，避免旧弹窗挡住新页面 */
    $('rules-modal').classList.add('hidden');
    var drawerEl = $('settings-drawer'); if (drawerEl) drawerEl.classList.add('hidden');
    var drawerOverlay = $('drawer-overlay'); if (drawerOverlay) drawerOverlay.classList.add('hidden');

    Array.prototype.forEach.call(document.querySelectorAll('.tab, .b-tab'), function (t) {
      t.classList.toggle('active', t.dataset.view === name);
    });
    if (name === 'home') renderHome();
    if (name === 'records') renderRecords();
    /* 离开游戏视图时恢复舞台容器样式 */
    if (name !== 'play') {
      document.body.classList.remove('standalone-active');
      var appEl = document.querySelector('.app');
      if (appEl) appEl.classList.remove('standalone-active');
      var viewPlayEl = $('view-play');
      if (viewPlayEl) {
        viewPlayEl.classList.remove('standalone-mode');
        ['stage-board', 'stage-puzzle', 'stage-arcade', 'stage-story'].forEach(function (c) {
          viewPlayEl.classList.remove(c);
        });
      }
      var stageViewportEl = $('stage-viewport') || document.querySelector('.board-panel');
      if (stageViewportEl) {
        stageViewportEl.classList.remove('standalone-mode');
        ['stage-board', 'stage-puzzle', 'stage-arcade', 'stage-story'].forEach(function (c) {
          stageViewportEl.classList.remove(c);
        });
      }
      var quickActionsEl = $('board-quick-actions');
      if (quickActionsEl) quickActionsEl.style.display = '';
      var sidePanelEl = $('side-panel') || document.querySelector('.side-panel');
      if (sidePanelEl) sidePanelEl.style.display = '';
      var playStatusEl = $('play-status');
      if (playStatusEl) playStatusEl.style.display = '';
      var turnTipEl = $('turn-tip');
      if (turnTipEl) turnTipEl.style.display = '';
      var boardFootEl = $('board-foot') || document.querySelector('.board-foot');
      if (boardFootEl) boardFootEl.style.display = '';
      var btnRulesEl = $('btn-rules');
      if (btnRulesEl) btnRulesEl.textContent = '❓ 玩法';
    }
    /* 计时类游戏：离开对局页自动暂停，回来继续 */
    if (name === 'play') { if (inst && inst.resume) inst.resume(); if (inst && inst.redraw) inst.redraw(); }
    else if (inst && inst.pause) inst.pause();
    global.scrollTo(0, 0);
  }

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    /* 智慧之星与成长激励 */
    var stars = Store.getStars();
    var starsEl = $('home-stars-count');
    if (starsEl) starsEl.textContent = stars;
    var starsTxt = $('home-stars-txt');
    if (starsTxt) {
      var msg = '多动脑、快成长，收集智慧之星解开宝藏徽章！';
      if (stars >= 40) msg = '🌟 太厉害了！已经拥有 ' + stars + ' 颗智慧之星，是无可争议的脑力王者！';
      else if (stars >= 15) msg = '🔥 渐入佳境！智慧之星正在飞速增加，思维越来越敏捷！';
      else if (stars >= 5) msg = '✨ 很棒的起点！继续探索，每一盘棋都能让你更聪明！';
      starsTxt.textContent = msg;
    }

    /* 星星进度条：向下一个里程碑前进 */
    var prog = $('star-progress'), progTxt = $('star-progress-txt');
    if (prog && progTxt) {
      var miles = [5, 15, 40, 80];
      var next = miles.find(function (m) { return stars < m; });
      if (next) {
        var prev = 0;
        miles.forEach(function (m) { if (stars >= m) prev = m; });
        prog.style.width = Math.round((stars - prev) / (next - prev) * 100) + '%';
        progTxt.textContent = '再赢 ' + (next - stars) + ' 星解锁「' + (next >= 40 ? '脑力王者' : next >= 15 ? '渐入佳境' : '很棒的起点') + '」称号';
      } else {
        prog.style.width = '100%';
        progTxt.textContent = '已达成全部称号，你就是脑力王者！';
      }
    }

    var grid = $('game-grid');
    grid.innerHTML = '';

    /* 分类筛选标签 */
    var catRow = $('cat-row');
    if (catRow) {
      catRow.innerHTML = '';
      CATS.forEach(function (c) {
        var chip = el('button', 'cat-chip' + (catFilter === c.key ? ' active' : ''), c.label);
        chip.type = 'button';
        chip.onclick = function () {
          if (catFilter === c.key) return;
          Sfx.click();
          catFilter = c.key;
          renderHome();
        };
        catRow.appendChild(chip);
      });
    }

    var idx = 0;
    GAMES.forEach(function (id) {
      var g = global.Games[id];
      if (catFilter !== 'all' && g.cat !== catFilter) return;
      var card = el('button', 'game-card');
      card.type = 'button';
      card.dataset.cat = g.cat || 'puzzle';
      card.style.setProperty('--i', idx++);
      card.innerHTML =
        '<div class="gc-emoji">' + g.emoji + '</div>' +
        '<div class="gc-name">' + esc(g.name) + '</div>' +
        '<div class="gc-desc">' + esc(g.desc) + '</div>' +
        '<div class="gc-tags">' + g.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
        '<div class="gc-go">开始游戏 <span class="gc-arrow">→</span></div>';
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
          : (saved.opts && saved.opts.mode === 'pvp' ? '双人对战' : '人机 ' + LEVEL_NAME[saved.opts.level || 'normal'])) +
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
        ['btn-undo', 'btn-hint', 'btn-restart', 'btn-resign',
         'btn-quick-undo', 'btn-quick-hint', 'btn-quick-restart', 'btn-quick-resign'].forEach(function (b) {
          var node = $(b);
          if (node) node.disabled = !!on;
        });
        els.status.classList.toggle('think', !!on);
      },
      changed: function () { saveCurrent(); },
      over: function (result, info) { onGameOver(id, result, info); }
    };
  }

  function saveCurrent() {
    if (!currentId || !inst || currentFinished) return;
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

  /* 4 大沉浸式交互舞台分类映射 */
  var STAGE_MAP = {
    gomoku: 'board', go: 'board', checkers: 'board', xiangqi: 'board',
    sudoku: 'puzzle', slide: 'puzzle', game24: 'puzzle', hanoi: 'puzzle',
    sokoban: 'puzzle', lightsout: 'puzzle', mines: 'puzzle', nonogram: 'puzzle',
    pipes: 'puzzle', mastermind: 'puzzle', balance: 'puzzle',
    mole: 'arcade', catch: 'arcade', xylo: 'arcade', paint: 'arcade',
    diff: 'arcade', puzzle: 'arcade', slidepic: 'arcade', dragpuzzle: 'arcade',
    shadow: 'arcade', pattern: 'arcade', simon: 'arcade', memory: 'arcade',
    english: 'story', mathcamp: 'story'
  };

  function applyStage(stageType, g, id) {
    var viewPlayEl = $('view-play');
    var stageViewportEl = $('stage-viewport') || document.querySelector('.board-panel');
    var sidePanelEl = $('side-panel') || document.querySelector('.side-panel');
    var quickActionsEl = $('board-quick-actions');
    var playStatusEl = $('play-status');
    var turnTipEl = $('turn-tip');
    var boardFootEl = $('board-foot') || document.querySelector('.board-foot');
    var btnRulesEl = $('btn-rules');
    var btnSettingsDrawer = $('btn-settings-drawer');
    var sideSettingsCard = $('side-settings-card');
    var sideActionsCard = $('side-actions-card');
    var sideInfoCard = $('side-info-card');

    /* 清除旧 stage 类 */
    ['stage-board', 'stage-puzzle', 'stage-arcade', 'stage-story', 'standalone-mode'].forEach(function (c) {
      if (viewPlayEl) viewPlayEl.classList.remove(c);
      if (stageViewportEl) stageViewportEl.classList.remove(c);
    });
    document.body.classList.remove('standalone-active');
    var appEl = document.querySelector('.app');
    if (appEl) appEl.classList.remove('standalone-active');

    if (viewPlayEl) viewPlayEl.classList.add('stage-' + stageType);
    if (stageViewportEl) stageViewportEl.classList.add('stage-' + stageType);

    /* 默认可见性复位 */
    if (playStatusEl) playStatusEl.style.display = '';
    if (turnTipEl) turnTipEl.style.display = '';
    if (boardFootEl) boardFootEl.style.display = '';
    if (btnRulesEl) btnRulesEl.textContent = (id === 'english') ? '💡 拼读秘籍' : '❓ 玩法';
    if (btnSettingsDrawer) btnSettingsDrawer.style.display = '';

    /* 快捷操作栏按钮重置 */
    var btnUndo = $('btn-quick-undo');
    var btnHint = $('btn-quick-hint');
    var btnRestart = $('btn-quick-restart');
    var btnResign = $('btn-quick-resign');

    if (stageType === 'board') {
      /* 传统棋类：完整对弈界面 */
      if (sidePanelEl) sidePanelEl.style.display = '';
      if (sideSettingsCard) sideSettingsCard.style.display = '';
      if (sideActionsCard) sideActionsCard.style.display = '';
      if (sideInfoCard) sideInfoCard.style.display = '';
      if (quickActionsEl) quickActionsEl.style.display = '';
      if (btnUndo) { btnUndo.style.display = ''; btnUndo.textContent = '↩️ 悔棋'; }
      if (btnHint) { btnHint.style.display = ''; btnHint.textContent = '💡 提示'; }
      if (btnRestart) { btnRestart.style.display = ''; btnRestart.textContent = '🔄 重开'; }
      if (btnResign) { btnResign.style.display = ''; btnResign.textContent = '🏳️ 认输'; }
    } else if (stageType === 'puzzle') {
      /* 逻辑解谜：无认输、无PVE/PVP对手、无先后手（保留档位） */
      if (sidePanelEl) sidePanelEl.style.display = '';
      if (sideSettingsCard) sideSettingsCard.style.display = (g.sideOptions ? '' : 'none');
      if (sideActionsCard) sideActionsCard.style.display = 'none';
      if (sideInfoCard) sideInfoCard.style.display = '';
      if (quickActionsEl) quickActionsEl.style.display = '';
      if (btnUndo) { btnUndo.style.display = (g.noUndo ? 'none' : ''); btnUndo.textContent = '↩️ 撤销'; }
      if (btnHint) { btnHint.style.display = (g.noHint ? 'none' : ''); btnHint.textContent = '💡 提示'; }
      if (btnRestart) { btnRestart.style.display = ''; btnRestart.textContent = '🔄 重置'; }
      if (btnResign) btnResign.style.display = 'none'; // 彻底隐藏认输
    } else if (stageType === 'arcade') {
      /* 动感感官：全屏沉浸，隐藏侧边栏与棋类对弈按键 */
      if (sidePanelEl) sidePanelEl.style.display = 'none';
      if (sideSettingsCard) sideSettingsCard.style.display = 'none';
      if (sideActionsCard) sideActionsCard.style.display = 'none';
      if (turnTipEl) turnTipEl.style.display = 'none';
      if (boardFootEl) boardFootEl.style.display = 'none';
      if (g.noQuickActions || id === 'xylo' || id === 'paint') {
        if (quickActionsEl) quickActionsEl.style.display = 'none';
      } else {
        if (quickActionsEl) quickActionsEl.style.display = '';
        if (btnUndo) btnUndo.style.display = 'none';
        if (btnHint) btnHint.style.display = (g.hasHint ? '' : 'none');
        if (btnRestart) { btnRestart.style.display = ''; btnRestart.textContent = '🔄 重玩'; }
        if (btnResign) btnResign.style.display = 'none';
      }
    } else if (stageType === 'story') {
      /* 情景伴学：全屏满幅、独立剧场 */
      document.body.classList.add('standalone-active');
      if (appEl) appEl.classList.add('standalone-active');
      if (viewPlayEl) viewPlayEl.classList.add('standalone-mode');
      if (stageViewportEl) stageViewportEl.classList.add('standalone-mode');
      if (sidePanelEl) sidePanelEl.style.display = 'none';
      if (quickActionsEl) quickActionsEl.style.display = 'none';
      if (turnTipEl) turnTipEl.style.display = 'none';
      if (boardFootEl) boardFootEl.style.display = 'none';
      if (playStatusEl) playStatusEl.style.display = (id === 'mathcamp' ? '' : 'none');
    }
  }

  function openGame(id, keep) {
    currentId = id;
    currentFinished = false;
    $('result-modal').classList.add('hidden'); /* 切换游戏时收掉旧结算弹窗 */
    var g = global.Games[id];
    var stageType = g.stageType || STAGE_MAP[id] || (g.cat === 'board' ? 'board' : 'puzzle');

    $('play-title').textContent = g.emoji + ' ' + g.name;
    /* 规则说明：弹窗内容按游戏填充 */
    $('rules-title').textContent = g.emoji + ' ' + g.name + ' · 玩法说明';
    $('rules-intro').textContent = g.desc || '';
    $('rules-body').innerHTML = g.rules || '打开后随意体验，没有固定规则～';
    $('rules-tip').textContent = g.tip ? '💡 小贴士：' + g.tip : '';
    $('rules-guide').innerHTML = g.guide || '';

    /* 侧栏初始值 */
    els.selMode.value = settings.mode;
    els.selLevel.value = settings.levels[id] || 'normal';
    refreshSideOptions(id);

    /* 接入 4 大舞台系统规范 */
    applyStage(stageType, g, id);

    showView('play');
    var panelEl = document.querySelector('.board-panel');
    if (panelEl) { panelEl.classList.remove('panel-in'); void panelEl.offsetWidth; panelEl.classList.add('panel-in'); }

    if (inst) { try { inst.destroy(); } catch (e) {} inst = null; }
    var hostEl = $('board-host');
    /* DOM 型游戏彻底重置旧高度，按内容自适应撑高 */
    hostEl.style.height = '';
    hostEl.classList.toggle('dom-fit', !!g.dom);
    hostEl.innerHTML = '';
    inst = g.mount(hostEl, apiFactory(id));

    var restored = false;
    if (keep !== false) {
      var saved = Store.loadGame(id);
      if (saved && saved.data) restored = inst.restore(saved.data);
    }
    if (!restored) {
      inst.restart(restartOpts());
    }
    renderExtra(id);
    if (restored) toast('已恢复上次未完成的对局');
    /* 每款游戏第一次玩时自动展示玩法说明 */
    if (!Store.get('rules.seen.' + id)) {
      Store.set('rules.seen.' + id, true);
      $('rules-modal').classList.remove('hidden');
    }
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
    $('field-level').style.display = g.noLevel ? 'none' : ((g.single || settings.mode === 'pve') ? '' : 'none');
    $('field-side').style.display = (g.single || settings.mode === 'pve') ? '' : 'none';
    els.selLevel.value = settings.levels[id] || 'normal';
  }

  function renderExtra(id) {
    /* 游戏自定义按钮（如围棋“停一手”） */
    var box = $('extra-btns');
    if (box) box.innerHTML = '';
    var quickBox = $('board-quick-actions');
    /* 清理旧的快速额外按钮 */
    var oldExtras = document.querySelectorAll('.q-extra-btn');
    Array.prototype.forEach.call(oldExtras, function (b) { b.remove(); });

    if (!inst || !inst.extra) return;
    inst.extra.forEach(function (b) {
      if (box) {
        var btn = el('button', 'btn', b.label);
        btn.onclick = function () { Sfx.click(); b.fn(); };
        box.appendChild(btn);
      }
      if (quickBox) {
        var qBtn = el('button', 'btn small q-btn q-extra-btn', b.label);
        qBtn.type = 'button';
        qBtn.onclick = function () { Sfx.click(); b.fn(); };
        var btnResign = $('btn-quick-resign');
        if (btnResign) quickBox.insertBefore(qBtn, btnResign);
        else quickBox.appendChild(qBtn);
      }
    });
  }

  function onGameOver(id, result, info) {
    currentFinished = true;
    Store.addResult(id, result);
    var newBadges = [];
    var starsBox = $('result-stars');
    if (starsBox) starsBox.innerHTML = '';
    var recordBox = $('result-record');
    if (recordBox) { recordBox.textContent = ''; recordBox.style.display = 'none'; }

    if (result === 'win') {
      if (Store.unlockBadge('first_win')) newBadges.push('first_win');
      var earned = info && info.perfect ? 4 : 2;
      Store.addStars(earned);

      /* 累计胜利统计 */
      var st = Store.getStats(), totalWins = 0;
      GAMES.forEach(function (gid) { totalWins += (st[gid] && st[gid].win) || 0; });
      if (totalWins >= 10 && Store.unlockBadge('win_10')) newBadges.push('win_10');
      if (totalWins >= 30 && Store.unlockBadge('win_30')) newBadges.push('win_30');

      /* 各游戏专属成就 */
      if (id === 'slide' && Store.unlockBadge('slide_solved')) newBadges.push('slide_solved');
      if (id === 'memory' && Store.unlockBadge('memory_champ')) newBadges.push('memory_champ');
      if (id === 'game24' && Store.unlockBadge('game24_pro')) newBadges.push('game24_pro');
      if (id === 'hanoi' && Store.unlockBadge('hanoi_3')) newBadges.push('hanoi_3');
      if (id === 'lightsout' && Store.unlockBadge('lights_novice')) newBadges.push('lights_novice');
      if (id === 'nonogram' && Store.unlockBadge('nonogram_clear')) newBadges.push('nonogram_clear');
      if (id === 'nonogram' && (info && info.score || '').indexOf('10×10') >= 0 && Store.unlockBadge('nonogram_pro')) newBadges.push('nonogram_pro');
      if (id === 'mastermind' && Store.unlockBadge('mastermind_crack')) newBadges.push('mastermind_crack');
      if (id === 'mastermind' && (info && info.moves || 99) <= 4 && Store.unlockBadge('mastermind_fast')) newBadges.push('mastermind_fast');
      if (id === 'pattern' && info && info.perfect && Store.unlockBadge('pattern_brain')) newBadges.push('pattern_brain');
      if (id === 'shadow' && info && info.perfect && Store.unlockBadge('shadow_eagle')) newBadges.push('shadow_eagle');
      if (id === 'mole' && result === 'win' && Store.unlockBadge('mole_hammer')) newBadges.push('mole_hammer');
      if (id === 'catch' && result === 'win' && Store.unlockBadge('catch_star')) newBadges.push('catch_star');
      if (id === 'puzzle' && result === 'win' && Store.unlockBadge('puzzle_star')) newBadges.push('puzzle_star');
      if (id === 'diff' && result === 'win' && Store.unlockBadge('diff_master')) newBadges.push('diff_master');
      if (id === 'simon' && result === 'win' && Store.unlockBadge('simon_brain')) newBadges.push('simon_brain');
      if (id === 'slidepic' && result === 'win' && Store.unlockBadge('slide_pilot')) newBadges.push('slide_pilot');
      if (id === 'dragpuzzle' && result === 'win' && Store.unlockBadge('drag_ninja')) newBadges.push('drag_ninja');
      if (id === 'sokoban' && result === 'win' && Store.unlockBadge('sokoban_brain')) newBadges.push('sokoban_brain');
      if (id === 'pipes' && result === 'win' && Store.unlockBadge('pipes_flow')) newBadges.push('pipes_flow');
      if (id === 'mines' && result === 'win' && Store.unlockBadge('mines_digger')) newBadges.push('mines_digger');
      if (id === 'balance' && result === 'win' && Store.unlockBadge('balance_angel')) newBadges.push('balance_angel');
      if (id === 'xylo' && result === 'win' && Store.unlockBadge('music_star')) newBadges.push('music_star');
      if (id === 'paint' && result === 'win') newBadges.push('paint_master');

      var starsEl = $('result-stars');
      if (starsEl) {
        var starHtml = '';
        for (var si = 0; si < earned; si++) starHtml += '<span class="rs-star" style="animation-delay:' + (0.1 + si * 0.15) + 's">⭐</span>';
        starsEl.innerHTML = starHtml + '<span class="rs-label">获得 ' + earned + ' 颗智慧之星</span>';
      }
    }

    if (global.Fx) {
      if (result === 'win') {
        global.Fx.confetti(info && info.perfect ? { count: 140 } : { count: 90 });
        if (newBadges.length > 0) global.Fx.starFountain(null, null, 15);
      } else if (result === 'lose') {
        global.Fx.banner('继续加油！下次准行～', 'soft');
      }
    }

    Store.addRecord({
      game: id, name: global.Games[id].name, result: result,
      level: settings.levels[id] || 'normal', mode: settings.mode,
      moves: info.moves || 0, sec: info.sec || 0, ts: Date.now(),
      score: info.score || ''
    });
    Store.clearGame(id);

    if (result === 'win') {
      if (newBadges.length > 0 && Sfx.badge) Sfx.badge();
      else Sfx.win();
    } else if (result === 'lose') {
      Sfx.lose();
    } else {
      Sfx.draw();
    }

    var m = $('result-modal');
    $('result-emoji').textContent = result === 'win' ? '🎉' : result === 'lose' ? '💪' : '🤝';
    $('result-title').textContent =
      result === 'win' ? (newBadges.length > 0 ? '大获全胜！解锁新成就' : '你赢啦！真棒') : result === 'lose' ? '差一点点，再试一次！' : '旗鼓相当，和棋！';
    $('result-sub').textContent = global.Games[id].name + ' · ' +
      (settings.mode === 'pvp' ? '双人' : (global.Games[id].noLevel ? '挑战' : LEVEL_NAME[settings.levels[id]])) +
      ' · ' + (info.moves || 0) + ' 手 · ' + (info.sec || 0) + ' 秒' +
      (info.score ? ' · ' + info.score : '');
    if (info.newRecord && recordBox) {
      recordBox.textContent = '🏆 ' + info.newRecord;
      recordBox.style.display = '';
    }
    m.classList.remove('hidden');
    if (global.Fx) global.Fx.pop($('result-emoji'));

    if (newBadges.length > 0) {
      setTimeout(function () {
        toast('🏅 恭喜解锁新成就徽章！快去战绩页查看吧～');
      }, 1500);
    }
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

    /* 渲染徽章墙 */
    var bg = $('badge-grid');
    if (bg) {
      bg.innerHTML = '';
      var badges = Store.getAllBadges();
      badges.forEach(function (b) {
        var card = el('div', 'badge-item' + (b.unlocked ? ' unlocked' : ' locked'));
        card.innerHTML =
          '<div class="badge-icon">' + b.emoji + '</div>' +
          '<div class="badge-name">' + esc(b.name) + '</div>' +
          '<div class="badge-desc">' + esc(b.desc) + '</div>' +
          '<div class="badge-tag">' + (b.unlocked ? '✨ 已解锁' : '🔒 待探索') + '</div>';
        bg.appendChild(card);
      });
    }

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
        '<td>' + (r.mode === 'pvp' ? '双人' : (global.Games[r.game] && global.Games[r.game].noLevel ? '挑战' : LEVEL_NAME[r.level])) + '</td>' +
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
      if (g.noLevel) return; /* 益智小游戏没有难度档，跳过预设卡片 */
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

    /* 人教版英语专属设置：语速 */
    var setEngRate = $('set-english-rate');
    if (setEngRate) {
      var curEngRate = Store.get('pep_rate_level', 'medium');
      setEngRate.value = curEngRate;
      setEngRate.onchange = function () {
        var lvl = this.value;
        Store.set('pep_rate_level', lvl);
        if (currentId === 'english' && inst && inst.setSpeechRate) {
          inst.setSpeechRate(lvl);
        }
        var labelMap = { slow: '慢速跟读', medium: '课本伴学', normal: '流利原速' };
        toast('人教英语语速已设为「' + (labelMap[lvl] || lvl) + '」');
      };
    }

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

  /* ---------------- 移动端底部设置抽屉 ---------------- */
  function renderDrawerContent() {
    var db = $('drawer-body');
    if (!db) return;
    db.innerHTML = '';
    var g = global.Games[currentId];
    if (!g) return;
    var stageType = g.stageType || STAGE_MAP[currentId] || 'board';

    var headWrap = el('div', 'drawer-game-info');
    headWrap.innerHTML = '<b>' + g.emoji + ' ' + g.name + '</b><span class="muted small">' + (g.desc || '') + '</span>';
    db.appendChild(headWrap);

    /* 英语小游戏专属设置：朗读语速 */
    if (currentId === 'english') {
      var rateGroup = el('div', 'drawer-field');
      rateGroup.innerHTML = '<label>英语朗读语速</label>';
      var rateSelect = el('select', 'drawer-select');
      var curRateLvl = Store.get('pep_rate_level', 'medium');
      [
        ['slow', '🐢 慢速跟读 (约75~85词/分)'],
        ['medium', '📖 课本伴学 (约90~105词/分)'],
        ['normal', '🐰 流利原速 (约125~135词/分)']
      ].forEach(function (opt) {
        var op = el('option', null, opt[1]);
        op.value = opt[0];
        if (opt[0] === curRateLvl) op.selected = true;
        rateSelect.appendChild(op);
      });
      rateSelect.onchange = function () {
        var lvl = this.value;
        Store.set('pep_rate_level', lvl);
        if (inst && inst.setSpeechRate) {
          inst.setSpeechRate(lvl);
        } else if (inst && inst.redraw) {
          inst.redraw();
        }
        closeDrawer();
        var labelMap = { slow: '慢速跟读', medium: '课本伴学', normal: '流利原速' };
        toast('英语语速已设置为「' + (labelMap[lvl] || lvl) + '」');
      };
      rateGroup.appendChild(rateSelect);
      db.appendChild(rateGroup);
    }

    /* 棋类/对弈设置 */
    if (stageType === 'board' && !g.single) {
      var modeGroup = el('div', 'drawer-field');
      modeGroup.innerHTML = '<label>对手模式</label>';
      var modeSelect = el('select', 'drawer-select');
      modeSelect.innerHTML = '<option value="pve"' + (settings.mode === 'pve' ? ' selected' : '') + '>🤖 人机对战</option>' +
                             '<option value="pvp"' + (settings.mode === 'pvp' ? ' selected' : '') + '>👫 双人对战</option>';
      modeSelect.onchange = function () {
        settings.mode = this.value;
        Store.saveSettings(settings);
        els.selMode.value = this.value;
        refreshSideOptions(currentId);
        currentFinished = false;
        if (inst) inst.restart(restartOpts());
        Store.clearGame(currentId);
        closeDrawer();
        toast(this.value === 'pvp' ? '已切换为双人对战' : '已切换为人机对战');
      };
      modeGroup.appendChild(modeSelect);
      db.appendChild(modeGroup);
    }

    /* 难度选择 */
    if (!g.noLevel && (stageType === 'board' ? (g.single || settings.mode === 'pve') : true)) {
      var lvlGroup = el('div', 'drawer-field');
      lvlGroup.innerHTML = '<label>难度选择</label>';
      var lvlSelect = el('select', 'drawer-select');
      var curLvl = settings.levels[currentId] || 'normal';
      lvlSelect.innerHTML = '<option value="easy"' + (curLvl === 'easy' ? ' selected' : '') + '>🐣 简单</option>' +
                            '<option value="normal"' + (curLvl === 'normal' ? ' selected' : '') + '>🙂 一般</option>' +
                            '<option value="hard"' + (curLvl === 'hard' ? ' selected' : '') + '>🔥 困难</option>';
      lvlSelect.onchange = function () {
        settings.levels[currentId] = this.value;
        Store.saveSettings(settings);
        els.selLevel.value = this.value;
        if (inst && inst.setLevel) inst.setLevel(this.value);
        closeDrawer();
        toast('难度已切换为「' + LEVEL_NAME[this.value] + '」');
      };
      lvlGroup.appendChild(lvlSelect);
      db.appendChild(lvlGroup);
    }

    /* 盘面档位 / 我执选择 */
    if (g.sideOptions) {
      var sizeGroup = el('div', 'drawer-field');
      sizeGroup.innerHTML = '<label>盘面档位</label>';
      var sizeSelect = el('select', 'drawer-select');
      var curSize = settings.sizes[currentId] || g.sideOptions[0][0];
      g.sideOptions.forEach(function (opt) {
        var op = el('option', null, opt[1]);
        op.value = opt[0];
        if (opt[0] === curSize) op.selected = true;
        sizeSelect.appendChild(op);
      });
      sizeSelect.onchange = function () {
        settings.sizes[currentId] = this.value;
        Store.saveSettings(settings);
        els.selSide.value = this.value;
        currentFinished = false;
        if (inst) inst.restart(restartOpts());
        Store.clearGame(currentId);
        closeDrawer();
        toast('盘面已切换为「' + this.value + '」');
      };
      sizeGroup.appendChild(sizeSelect);
      db.appendChild(sizeGroup);
    } else if (stageType === 'board' && settings.mode === 'pve') {
      var sideGroup = el('div', 'drawer-field');
      sideGroup.innerHTML = '<label>先后手我执</label>';
      var sideSelect = el('select', 'drawer-select');
      (g.sides || ['先手', '后手']).forEach(function (s, i) {
        var op = el('option', null, s);
        op.value = String(i + 1);
        if (String(settings.side) === String(i + 1)) op.selected = true;
        sideSelect.appendChild(op);
      });
      sideSelect.onchange = function () {
        settings.side = Number(this.value);
        Store.saveSettings(settings);
        els.selSide.value = this.value;
        currentFinished = false;
        if (inst) inst.restart(restartOpts());
        Store.clearGame(currentId);
        closeDrawer();
        toast('已交换先后手，重新开局');
      };
      sideGroup.appendChild(sideSelect);
      db.appendChild(sideGroup);
    }

    /* 快捷功能按钮组 */
    var btnRow = el('div', 'drawer-btn-row');
    var btnRules = el('button', 'btn small', '❓ 玩法说明');
    btnRules.onclick = function () {
      closeDrawer();
      $('rules-modal').classList.remove('hidden');
    };
    btnRow.appendChild(btnRules);

    var btnSound = el('button', 'btn small ghost', settings.sound ? '🔊 音效：开' : '🔇 音效：关');
    btnSound.onclick = function () {
      settings.sound = !settings.sound;
      Store.saveSettings(settings);
      this.textContent = settings.sound ? '🔊 音效：开' : '🔇 音效：关';
      applySettings();
      if (settings.sound && global.Sfx) Sfx.click();
      toast(settings.sound ? '音效已开启' : '音效已静音');
    };
    btnRow.appendChild(btnSound);
    db.appendChild(btnRow);
  }

  var drawerOverlay = null, drawerEl = null;
  function openDrawer() {
    drawerOverlay = $('drawer-overlay');
    drawerEl = $('settings-drawer');
    if (!drawerEl || !drawerOverlay) return;
    renderDrawerContent();
    drawerOverlay.classList.remove('hidden');
    drawerEl.classList.remove('hidden');
    void drawerEl.offsetWidth;
    drawerEl.classList.add('open');
    drawerOverlay.classList.add('open');
  }

  function closeDrawer() {
    drawerOverlay = $('drawer-overlay');
    drawerEl = $('settings-drawer');
    if (!drawerEl || !drawerOverlay) return;
    drawerEl.classList.remove('open');
    drawerOverlay.classList.remove('open');
    setTimeout(function () {
      if (drawerEl) drawerEl.classList.add('hidden');
      if (drawerOverlay) drawerOverlay.classList.add('hidden');
    }, 240);
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

    /* 移动端设置抽屉开关 */
    var btnDrawer = $('btn-settings-drawer');
    var btnDrawerClose = $('btn-drawer-close');
    var dOverlay = $('drawer-overlay');
    if (btnDrawer) btnDrawer.onclick = function () { Sfx.click(); openDrawer(); };
    if (btnDrawerClose) btnDrawerClose.onclick = function () { Sfx.click(); closeDrawer(); };
    if (dOverlay) dOverlay.onclick = closeDrawer;

    /* 操作卡片里插入一个自定义按钮容器 */
    var ops = $('btn-resign').parentNode;
    var extra = el('div', 'btn-col');
    extra.id = 'extra-btns';
    extra.style.marginTop = '8px';
    ops.appendChild(extra);

    applySettings();
    renderSettings();
    renderHome();

    /* 顶部与底部导航 */
    Array.prototype.forEach.call(document.querySelectorAll('.tab, .b-tab'), function (t) {
      t.onclick = function () { Sfx.click(); showView(t.dataset.view); };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-goto]'), function (b) {
      b.onclick = function () { Sfx.click(); showView(b.dataset.goto); };
    });

    $('btn-back').onclick = function () { Sfx.click(); showView('home'); };

    /* 玩法说明弹窗 */
    $('btn-rules').onclick = function () { Sfx.click(); $('rules-modal').classList.remove('hidden'); };
    $('btn-rules-close').onclick = function () { Sfx.click(); $('rules-modal').classList.add('hidden'); };
    $('btn-rules-ok').onclick = function () { Sfx.click(); $('rules-modal').classList.add('hidden'); };

    /* 侧栏常规操作与棋盘下方快捷操作同时绑定 */
    function doRestart() {
      Sfx.click();
      $('result-modal').classList.add('hidden'); /* 重开时收掉结算弹窗 */
      currentFinished = false;
      if (inst) inst.restart(restartOpts());
      Store.clearGame(currentId);
      toast('已重新开始');
    }
    function doUndo() { Sfx.click(); if (inst) inst.undo(); }
    function doHint() { Sfx.click(); if (inst) inst.hint(); }
    function doResign() {
      Sfx.click();
      if (settings.mode === 'pvp') { toast('双人模式下请继续下棋'); return; }
      if (inst) inst.resign();
    }

    $('btn-restart').onclick = doRestart;
    $('btn-undo').onclick = doUndo;
    $('btn-hint').onclick = doHint;
    $('btn-resign').onclick = doResign;

    var qUndo = $('btn-quick-undo'); if (qUndo) qUndo.onclick = doUndo;
    var qHint = $('btn-quick-hint'); if (qHint) qHint.onclick = doHint;
    var qRestart = $('btn-quick-restart'); if (qRestart) qRestart.onclick = doRestart;
    var qResign = $('btn-quick-resign'); if (qResign) qResign.onclick = doResign;

    els.selMode.onchange = function () {
      settings.mode = els.selMode.value;
      Store.saveSettings(settings);
      refreshSideOptions(currentId);
      currentFinished = false;
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
        currentFinished = false;
      if (inst) inst.restart(restartOpts());
        Store.clearGame(currentId);
        toast('盘面已切换为「' + els.selSide.value + '」，重新开始');
        return;
      }
      settings.side = Number(els.selSide.value);
      Store.saveSettings(settings);
      currentFinished = false;
      if (inst) inst.restart(restartOpts());
      Store.clearGame(currentId);
      toast('已交换先后手，重新开局');
    };

    $('btn-again').onclick = function () {
      Sfx.click();
      $('result-modal').classList.add('hidden');
      currentFinished = false;
      if (inst) inst.restart(restartOpts());
      Store.clearGame(currentId);
    };
    $('btn-result-home').onclick = function () {
      Sfx.click();
      $('result-modal').classList.add('hidden');
      showView('home');
    };

    /* 首页人教版英语卡片入口 */
    var pepCard = $('home-pep-card');
    if (pepCard) {
      pepCard.onclick = function (e) {
        e.preventDefault();
        Sfx.click();
        openGame('english');
      };
    }

    /* 设置项 */
    $('set-theme').onchange = function () { settings.theme = this.value; applySettings(); };
    $('set-sound').onchange = function () { settings.sound = this.checked; applySettings(); Sfx.click(); };
    $('set-coords').onchange = function () { settings.coords = this.checked; applySettings(); };

    $('btn-clear-records').onclick = function () {
      if (global.confirm('确定清空所有对局记录吗？')) { Store.clearRecords(); renderRecords(); toast('记录已清空'); }
    };
    $('btn-check-update').onclick = function () { Sfx.click(); checkUpdate(false); };
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

    /* 离线缓存 + 联网自动更新 */
    initServiceWorker();

    /* 全局按键涟漪：所有按钮/标签按下都有水波反馈 */
    document.addEventListener('pointerdown', function (e) {
      var t = e.target.closest('.btn, .cat-chip, .tab, .b-tab, .q-btn, .mm-color, .mc-key, .sdk-digit');
      if (t && global.Fx) Fx.ripple(t, e.clientX, e.clientY);
    });

    global.addEventListener('beforeunload', saveCurrent);
  }

  /* ---------------- 离线缓存与自动更新 ---------------- */
  /* 联网打开页面时：SW 脚本变更 → 新版本安装 → 保存当前进度 → 自动刷新到最新版 */
  var swReg = null, swReloading = false, swFirstClaim = !navigator.serviceWorker.controller;

  function initServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol.indexOf('http') !== 0) return;
    global.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        swReg = reg;
        if (!reg) return;
        /* 发现新版本：等它装好就更新 */
        reg.addEventListener('updatefound', function () {
          var nw = reg.installing || reg.waiting;
          if (!nw) return;
          nw.addEventListener('statechange', function () {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) applyUpdate();
          });
        });
        /* 已在等待中的新版本（上次打开时装好但没生效） */
        if (reg.waiting && navigator.serviceWorker.controller) applyUpdate();
      }).catch(function () { /* 不支持时忽略 */ });
    });

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      /* 首次安装时的「接管」不算更新，跳过；之后每次换人都是真有新版本 */
      if (swFirstClaim) { swFirstClaim = false; return; }
      applyUpdate();
    });

    /* 回到前台 / 每 30 分钟静默检查一次，联网就能拿到新版本 */
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) checkUpdate(true);
    });
    global.setInterval(function () { if (!document.hidden) checkUpdate(true); }, 30 * 60 * 1000);
  }

  /* 手动检查更新（设置页按钮 / 定时轮询 / 页面重新可见时） */
  function checkUpdate(silent) {
    if (!swReg) { if (!silent) toast('当前环境未启用离线缓存'); return; }
    swReg.update().then(function () {
      if (silent) return;
      if (swReg.waiting) applyUpdate();
      else toast('已是最新版本 ✅');
    }).catch(function () {
      if (!silent) toast('检查更新失败，可能处于离线状态');
    });
  }

  function applyUpdate() {
    if (swReloading) return;
    swReloading = true;
    if (global.Fx) global.Fx.banner('✨ 新版本到啦', 'soft');
    toast('✨ 发现新版本，正在更新…');
    try { saveCurrent(); } catch (e) {}
    /* 给一小段时间让提示露脸、进度落盘，再刷新加载新版 */
    setTimeout(function () { global.location.reload(); }, 1200);
    /* 兜底：若 8 秒内 controllerchange 没触发（旧 SW 未释放），也强制刷新 */
    setTimeout(function () { global.location.reload(); }, 8000);
  }

  function refreshSettingsPresets() {
    var sels = $('level-presets').querySelectorAll('select');
    var k = 0;
    GAMES.forEach(function (id) {
      if (global.Games[id].noLevel) return;
      if (sels[k]) sels[k].value = settings.levels[id] || 'normal';
      k++;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
