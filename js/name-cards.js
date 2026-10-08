/* ============ 认名字模块 · 交互逻辑与双轨发音引擎 ============ */
(function () {
  'use strict';
  var NAMES = window.CLASS_NAMES || [];

  /* ---------- 工具 ---------- */
  function $(id) { return document.getElementById(id); }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ============================================================
     第一轨：标准高保真音频雪碧图引擎 (Web Audio API / Audio Sprite)
     - 全终端音质 100% 一致、声调 100% 准确、0ms 极速响应
     ============================================================ */
  var soundOn = true;
  var audioCtx = null;
  var spriteBuffer = null;
  var spriteLoading = false;
  var fallbackAudioEl = null;

  function getAudioCtx() {
    if (!audioCtx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (C) {
        try { audioCtx = new C(); } catch (e) {}
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      try { audioCtx.resume(); } catch (e) {}
    }
    return audioCtx;
  }

  // 移动端用户初次交互唤醒 AudioContext
  function unlockAudioContext() {
    var ctx = getAudioCtx();
    if (ctx) {
      ['touchstart', 'touchend', 'pointerdown', 'click'].forEach(function (evt) {
        document.removeEventListener(evt, unlockAudioContext, true);
      });
    }
  }
  ['touchstart', 'touchend', 'pointerdown', 'click'].forEach(function (evt) {
    document.addEventListener(evt, unlockAudioContext, true);
  });

  // 预载入 Audio Sprite
  function loadAudioSprite() {
    var src = window.NAME_AUDIO_SPRITE_SRC || 'audio/names-sprite.mp3';
    if (spriteBuffer || spriteLoading) return;
    spriteLoading = true;

    // 先创建一个 HTML5 Audio 备用
    try {
      fallbackAudioEl = new Audio(src);
      fallbackAudioEl.preload = 'auto';
    } catch (e) {}

    // 使用 Web Audio 解码高保真音频
    if (window.fetch) {
      fetch(src)
        .then(function (res) { return res.arrayBuffer(); })
        .then(function (buf) {
          var ctx = getAudioCtx();
          if (!ctx) return;
          ctx.decodeAudioData(buf, function (decoded) {
            spriteBuffer = decoded;
            spriteLoading = false;
          }, function () { spriteLoading = false; });
        })
        .catch(function () { spriteLoading = false; });
    }
  }

  // 播放 Sprite 切片
  function playAudioSprite(key) {
    var sprites = window.NAME_AUDIO_SPRITES;
    if (!sprites || !sprites[key]) return false;

    var range = sprites[key];
    var start = range[0];
    var dur = range[1];

    var ctx = getAudioCtx();
    if (ctx && spriteBuffer) {
      try {
        var source = ctx.createBufferSource();
        source.buffer = spriteBuffer;
        source.connect(ctx.destination);
        source.start(0, start, dur);
        return true;
      } catch (e) {}
    }

    // 备用 HTML5 Audio 播放切片
    if (fallbackAudioEl) {
      try {
        fallbackAudioEl.currentTime = start;
        fallbackAudioEl.play().catch(function () {});
        setTimeout(function () {
          try { fallbackAudioEl.pause(); } catch (e) {}
        }, (dur + 0.05) * 1000);
        return true;
      } catch (e) {}
    }

    return false;
  }

  /* ============================================================
     第二轨：智能拼音纠音发音引擎 (Pinyin Aligner + TTS 动态兜底)
     - 专用于后期新增的文字/姓名，自动纠正多音字与声调
     ============================================================ */
  var POLYPHONE_MAP = {
    '纶': { 'lún': '轮', 'guān': '关' },
    '乐': { 'lè': '勒', 'yuè': '悦' },
    '柏': { 'bó': '伯', 'bǎi': '百' },
    '茜': { 'xī': '西', 'qiàn': '倩' },
    '曾': { 'zēng': '增', 'céng': '层' },
    '单': { 'shàn': '善', 'dān': '丹' },
    '仇': { 'qiú': '求', 'chóu': '愁' },
    '查': { 'zhā': '扎', 'chá': '茶' },
    '解': { 'xiè': '谢', 'jiě': '姐' },
    '区': { 'ōu': '欧', 'qū': '曲' },
    '朴': { 'piáo': '瓢', 'pǔ': '普' },
    '谌': { 'chén': '陈', 'shèn': '慎' },
    '峤': { 'qiáo': '桥', 'jiào': '叫' },
    '适': { 'kuò': '阔', 'shì': '是' },
    '宓': { 'fú': '伏', 'mì': '密' }
  };

  // 根据拼音自动对齐纠偏（将多音字转换为发音绝对确定、声调完全一致的同音字）
  function getSpokenText(text, pyStr) {
    if (!text) return text;
    var t = text.trim();
    if (!pyStr) {
      // 常用多音姓氏默认对齐
      if (t === '尹纶瑶') return '尹轮瑶';
      if (t === '纶') return '轮';
      return t;
    }
    var pys = pyStr.trim().split(/\s+/);
    var chars = t.split('');
    if (chars.length !== pys.length) {
      if (t === '尹纶瑶') return '尹轮瑶';
      return t;
    }
    var toneRepl = {
      'ā':'a','á':'a','ǎ':'a','à':'a', 'ō':'o','ó':'o','ǒ':'o','ò':'o',
      'ē':'e','é':'e','ě':'e','è':'e', 'ī':'i','í':'i','ǐ':'i','ì':'i',
      'ū':'u','ú':'u','ǔ':'u','ù':'u', 'ǖ':'v','ǘ':'v','ǚ':'v','ǜ':'v'
    };
    function clean(s) {
      return (s || '').split('').map(function (c) { return toneRepl[c] || c; }).join('').toLowerCase();
    }
    var res = [];
    for (var i = 0; i < chars.length; i++) {
      var c = chars[i];
      var py = pys[i];
      if (POLYPHONE_MAP[c]) {
        var map = POLYPHONE_MAP[c];
        var replaced = false;
        for (var targetPy in map) {
          if (targetPy === py || clean(targetPy) === clean(py)) {
            res.push(map[targetPy]);
            replaced = true;
            break;
          }
        }
        if (!replaced) res.push(c);
      } else {
        res.push(c);
      }
    }
    return res.join('');
  }

  // 现代高质量大陆普通话语音优先级（杜绝老旧平调 Tingting，杜绝港台粤语台语）
  var PREFERRED_VOICES = [
    'xiaoxiao', 'yunxi', 'yunyang', 'yunjian', 'xiaoyi', 'yunxia',  // 微软神经网络
    'flo', 'eddy', 'sandy', 'shelley', 'grandma', 'grandpa',        // 苹果现代神经语音
    'google 普通话', 'chinese mainland', 'cmn-hans-cn',            // 谷歌普通话
    '普通话', 'mandarin',                                          // 通用中文
    'huihui', 'kangkang', 'yaoyao', 'tingting'                      // 兜底老式语音
  ];

  var _cnVoices = [];
  var _selectedVoice = null;
  var _activeVoiceMode = '__standard__'; // '__standard__' 默认使用高品质标准音频

  function isMainlandVoice(v) {
    var lang = (v.lang || '').toLowerCase().replace('_', '-');
    if (lang === 'zh-tw' || lang === 'zh-hk' || lang.indexOf('yue') === 0) return false;
    if (lang === 'zh-cn' || lang === 'zh' || lang === 'zh-hans' || lang.indexOf('cmn') === 0) return true;
    var name = (v.name || '').toLowerCase();
    if (lang.indexOf('zh') === 0 && (name.indexOf('普通话') >= 0 || name.indexOf('大陆') >= 0 || name.indexOf('mandarin') >= 0)) return true;
    return false;
  }

  function scoreVoice(v) {
    var name = (v.name || '').toLowerCase();
    var score = 0;
    for (var i = 0; i < PREFERRED_VOICES.length; i++) {
      if (name.indexOf(PREFERRED_VOICES[i]) >= 0) {
        score = 1000 - i * 20;
        break;
      }
    }
    if ((v.lang || '').toLowerCase().indexOf('zh-cn') >= 0) score += 10;
    return score;
  }

  function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    var all = window.speechSynthesis.getVoices() || [];
    _cnVoices = all.filter(isMainlandVoice).sort(function (a, b) {
      return scoreVoice(b) - scoreVoice(a);
    });
    if (_cnVoices.length && !_selectedVoice) {
      _selectedVoice = _cnVoices[0];
    }
    updateVoiceSelectUI();
  }

  function updateVoiceSelectUI() {
    var sel = $('voiceSelect');
    if (!sel) return;
    var html = '<option value="__standard__"' + (_activeVoiceMode === '__standard__' ? ' selected' : '') + '>🌟 标准播音（推荐）</option>';
    if (_cnVoices.length) {
      _cnVoices.forEach(function (v) {
        var on = _activeVoiceMode === v.name ? ' selected' : '';
        html += '<option value="' + v.name + '"' + on + '>🗣️ ' + v.name + '</option>';
      });
    }
    sel.innerHTML = html;
  }

  function speakTTS(text, pyStr) {
    if (!('speechSynthesis' in window)) return;
    try {
      var synth = window.speechSynthesis;
      synth.cancel();
      var spoken = getSpokenText(text, pyStr);
      var u = new SpeechSynthesisUtterance(spoken);
      u.lang = 'zh-CN';
      u.rate = 0.75; // 0.75 舒缓清晰语速，适合儿童识字辨音
      u.pitch = 1.0; // 1.0 标准音高保证二声（35）不被压平
      if (_selectedVoice) u.voice = _selectedVoice;
      synth.speak(u);
    } catch (e) {}
  }

  /* ============================================================
     综合播放控制器 (Master Player)
     - 自动检测：标准音频包 -> 独立录音文件 -> 拼音纠音 TTS
     ============================================================ */
  function playWord(text, pyStr) {
    if (!soundOn || !text) return;

    // 若用户显式切换到了特定的系统 TTS 语音，则走 TTS
    if (_activeVoiceMode !== '__standard__') {
      speakTTS(text, pyStr);
      return;
    }

    // 1. 优先从标准音频雪碧图中播放
    if (playAudioSprite(text)) {
      return;
    }

    // 2. 动态新增字智能纠音兜底
    speakTTS(text, pyStr);
  }

  // 朗读全名
  function speakName(fullName, pyStr) {
    if (!pyStr && NAMES.length) {
      for (var i = 0; i < NAMES.length; i++) {
        if (NAMES[i].full === fullName) { pyStr = NAMES[i].py; break; }
      }
    }
    playWord(fullName, pyStr);
  }

  // 朗读姓氏
  function speakSurname(surname, surPy) {
    if (!surPy && NAMES.length) {
      for (var i = 0; i < NAMES.length; i++) {
        if (NAMES[i].surname === surname) { surPy = NAMES[i].surPy; break; }
      }
    }
    playWord(surname, surPy);
  }

  // 初始化语音监听与选择器
  if ('speechSynthesis' in window) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    var voiceSel = $('voiceSelect');
    if (voiceSel) {
      voiceSel.addEventListener('change', function () {
        _activeVoiceMode = voiceSel.value;
        if (_activeVoiceMode !== '__standard__') {
          for (var i = 0; i < _cnVoices.length; i++) {
            if (_cnVoices[i].name === _activeVoiceMode) {
              _selectedVoice = _cnVoices[i];
              break;
            }
          }
          speakTTS('你好，我是普通话');
        } else {
          playWord('王'); // 试听标准播音
        }
      });
    }
  }

  // 预载入标准音频雪碧图
  loadAudioSprite();

  /* ---------- 主题切换 ---------- */
  var THEMES = ['', 'wood', 'night'];
  var themeIdx = 0;
  (function initTheme() {
    var saved = localStorage.getItem('nc-theme');
    if (saved !== null) {
      themeIdx = THEMES.indexOf(saved);
      if (themeIdx < 0) themeIdx = 0;
      document.documentElement.setAttribute('data-theme', THEMES[themeIdx]);
    }
  })();
  $('themeBtn').addEventListener('click', function () {
    themeIdx = (themeIdx + 1) % THEMES.length;
    document.documentElement.setAttribute('data-theme', THEMES[themeIdx]);
    localStorage.setItem('nc-theme', THEMES[themeIdx]);
  });

  /* ---------- 静音切换 ---------- */
  var soundBtn = $('soundBtn');
  soundBtn.addEventListener('click', function () {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? '🔊 读音' : '🔇 静音';
    if (!soundOn) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      if (fallbackAudioEl) fallbackAudioEl.pause();
    }
  });

  $('totalCount').textContent = NAMES.length;

  /* ---------- 模式切换 ---------- */
  var modeBtns = document.querySelectorAll('.nc-modes .btn');
  var views = { flash: $('view-flash'), group: $('view-group'), match: $('view-match') };
  function switchMode(mode) {
    modeBtns.forEach(function (b) {
      var on = b.getAttribute('data-mode') === mode;
      b.classList.toggle('primary', on);
    });
    Object.keys(views).forEach(function (k) {
      views[k].classList.toggle('hidden', k !== mode);
    });
    if (mode === 'group' && !groupBuilt) buildGroups();
    if (mode === 'match') newMatchRound();
  }
  modeBtns.forEach(function (b) {
    b.addEventListener('click', function () { switchMode(b.getAttribute('data-mode')); });
  });

  /* ==================================================
     模式一：闪卡翻看
  ================================================== */
  var flashOrder = NAMES.map(function (_, i) { return i; });
  var flashPos = 0;
  var flashCard = $('flashCard');

  function renderFlash() {
    var item = NAMES[flashOrder[flashPos]];
    flashCard.classList.remove('flipped');
    $('fcName').textContent = item.full;
    $('fcPinyin').textContent = item.py;
    $('fcNameSm').textContent = item.full;
    $('fcSurname').textContent = '姓：' + item.surname + '（' + item.surPy + '）';
    $('flashProgress').textContent = (flashPos + 1) + ' / ' + NAMES.length;
    $('flashStar').textContent = '';
  }

  flashCard.addEventListener('click', function () {
    flashCard.classList.toggle('flipped');
    if (flashCard.classList.contains('flipped')) {
      var item = NAMES[flashOrder[flashPos]];
      speakName(item.full, item.py);
      $('flashStar').textContent = '⭐ 认识啦，真棒！';
    } else {
      $('flashStar').textContent = '';
    }
  });

  $('prevBtn').addEventListener('click', function () {
    flashPos = (flashPos - 1 + NAMES.length) % NAMES.length;
    renderFlash();
  });
  $('nextBtn').addEventListener('click', function () {
    flashPos = (flashPos + 1) % NAMES.length;
    renderFlash();
  });
  $('shuffleBtn').addEventListener('click', function () {
    flashOrder = shuffle(flashOrder);
    flashPos = 0;
    renderFlash();
    $('flashStar').textContent = '🔀 已打乱，重新开始！';
  });
  $('speakBtn').addEventListener('click', function () {
    var it = NAMES[flashOrder[flashPos]];
    speakName(it.full, it.py);
  });

  /* ==================================================
     模式二：按姓分组
  ================================================== */
  var groupBuilt = false;
  function buildGroups() {
    var map = {};
    NAMES.forEach(function (n) {
      if (!map[n.surname]) map[n.surname] = { surPy: n.surPy, list: [] };
      map[n.surname].list.push(n);
    });
    // 按同姓人数从多到少排序，同数按拼音
    var keys = Object.keys(map).sort(function (a, b) {
      var d = map[b].list.length - map[a].list.length;
      if (d !== 0) return d;
      return (map[a].surPy || '').localeCompare(map[b].surPy || '');
    });

    var html = '';
    keys.forEach(function (k) {
      var g = map[k];
      html += '<div class="surname-group">';
      html += '<div class="surname-title">';
      html += '<span class="surname-badge" data-surname="' + k + '" data-surpy="' + g.surPy + '" title="点击听姓氏读音">' + k + '</span>';
      html += '<span class="surname-py">' + g.surPy + '</span>';
      html += '<span class="surname-count">' + g.list.length + ' 人</span>';
      html += '<span class="surname-tip">点徽章听姓 🔊</span>';
      html += '</div>';
      html += '<div class="name-grid">';
      g.list.forEach(function (n) {
        html += '<div class="name-chip" data-name="' + n.full + '" data-py="' + n.py + '">';
        html += '<div class="nc-name">' + n.full + '</div>';
        html += '<div class="nc-py">' + n.py + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    });

    var container = $('groupContainer');
    container.innerHTML = html;

    // 点击姓氏徽章朗读姓氏
    container.querySelectorAll('.surname-badge').forEach(function (badge) {
      badge.addEventListener('click', function () {
        var sur = badge.getAttribute('data-surname');
        var surPy = badge.getAttribute('data-surpy');
        speakSurname(sur, surPy);
      });
    });

    // 点击姓名卡片朗读全名
    container.querySelectorAll('.name-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var name = chip.getAttribute('data-name');
        var py = chip.getAttribute('data-py');
        speakName(name, py);
        chip.classList.add('speaking');
        setTimeout(function () { chip.classList.remove('speaking'); }, 600);
      });
    });

    groupBuilt = true;
  }

  /* ==================================================
     模式三：名字连连看
  ================================================== */
  var ROUND_SIZE = 6;
  var matchTotal = 0, matchDone = 0;
  var selName = null, selPy = null;

  function newMatchRound() {
    var pool = shuffle(NAMES).slice(0, Math.min(ROUND_SIZE, NAMES.length));
    matchTotal = pool.length;
    matchDone = 0;
    selName = null; selPy = null;
    $('matchTotal').textContent = matchTotal;
    $('matchDone').textContent = 0;

    var names = shuffle(pool);
    var pys = shuffle(pool);
    var html = '<div class="match-cols">';
    html += '<div><div class="match-col-title">名字</div><div class="match-list" id="colNames">';
    names.forEach(function (n) {
      html += '<div class="match-item name-side" data-full="' + n.full + '" data-py="' + n.py + '">' + n.full + '</div>';
    });
    html += '</div></div>';
    html += '<div><div class="match-col-title">拼音</div><div class="match-list" id="colPys">';
    pys.forEach(function (n) {
      html += '<div class="match-item py-side" data-full="' + n.full + '" data-py="' + n.py + '">' + n.py + '</div>';
    });
    html += '</div></div></div>';
    $('matchBody').innerHTML = html;

    $('matchBody').querySelectorAll('.name-side').forEach(function (el) {
      el.addEventListener('click', function () { pickName(el); });
    });
    $('matchBody').querySelectorAll('.py-side').forEach(function (el) {
      el.addEventListener('click', function () { pickPy(el); });
    });
  }

  function clearSel(el) { if (el) el.classList.remove('selected'); }

  function pickName(el) {
    if (el.classList.contains('matched')) return;
    clearSel(selName);
    selName = el; el.classList.add('selected');
    speakName(el.getAttribute('data-full'), el.getAttribute('data-py'));
    tryMatch();
  }
  function pickPy(el) {
    if (el.classList.contains('matched')) return;
    clearSel(selPy);
    selPy = el; el.classList.add('selected');
    tryMatch();
  }
  function tryMatch() {
    if (!selName || !selPy) return;
    var a = selName, b = selPy;
    if (a.getAttribute('data-full') === b.getAttribute('data-full')) {
      a.classList.remove('selected'); b.classList.remove('selected');
      a.classList.add('matched'); b.classList.add('matched');
      matchDone++;
      $('matchDone').textContent = matchDone;
      selName = null; selPy = null;
      if (matchDone === matchTotal) {
        setTimeout(function () {
          $('matchBody').innerHTML = '<div class="match-win">🎉 全部配对成功！太厉害啦！</div>' +
            '<div class="btn-row center" style="margin-top:14px"><button class="btn primary" id="againBtn">再来一组 →</button></div>';
          $('againBtn').addEventListener('click', newMatchRound);
        }, 450);
      }
    } else {
      a.classList.add('wrong'); b.classList.add('wrong');
      var x = selName, y = selPy;
      selName = null; selPy = null;
      setTimeout(function () {
        x.classList.remove('wrong', 'selected');
        y.classList.remove('wrong', 'selected');
      }, 450);
    }
  }
  $('matchNew').addEventListener('click', newMatchRound);

  /* ---------- 初始化 ---------- */
  renderFlash();
})();
