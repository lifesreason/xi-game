/* ============================================================
   人教版 PEP 三年级英语 · 自然拼读与抗遗忘读音大闯关
   - 对标人教版 PEP 3A 上册 / 3B 下册 Letters and Sounds 官方教学体系
   - 核心教学功能：
     1. 音素拆读机 (Phonics Sound-Out Blending Machine)：单个音素拆解 + 一键滑读拼音
     2. 词族滑轨推导 (Word Family Train)：拖动首辅音撞击词尾，推导拼读公式
     3. 昨日温故唤醒舱 (Spaced Repetition Review)：艾宾浩斯抗遗忘追踪 + 易错红旗
     4. 人教版官方题型闯关：Listen and Circle 易混辨音、缺元音填空、听音拼词
     5. 三日稳固金银铜星勋章系统
   ============================================================ */
(function (global) {
  'use strict';

  var Sfx = global.Sfx || {
    click: function () {}, win: function () {}, lose: function () {}, pop: function () {}
  };
  var Store = global.Store || {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------------- 工具函数 ---------------- */
  function $(id) { return document.getElementById(id); }
  function ri(n) { return (Math.random() * n) | 0; }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function esc(s) {
    return String(s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ============================================================
     跨设备少儿英语智能语速校准引擎 (Cross-Platform Speech Rate Calibrator)
     - 彻底解决 iOS WebKit / Android 系统原生 TTS 语速过快的问题
     - 针对小学低年级人教版 (PEP) 课本听感进行深度标定（约 90-105 WPM）
     - 三档沉浸语速：
       * slow   : 🐢 慢速跟读 (清晰拆音、逐字跟读，适合初学)
       * medium : 📖 课本伴学 (★ 默认标准，磁带点读笔原版慢速伴读节奏)
       * normal : 🐰 流利原速 (自然对话速度)
     ============================================================ */
  var _isMobile = (function () {
    if (typeof navigator === 'undefined') return false;
    var ua = navigator.userAgent || '';
    var isTouchMac = (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
    return /Android|iPhone|iPad|iPod|Mobile|Silk|BlackBerry/i.test(ua) || isTouchMac;
  })();

  var _isIOS = (function () {
    if (typeof navigator === 'undefined') return false;
    var ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  })();

  var _isAndroid = (function () {
    if (typeof navigator === 'undefined') return false;
    var ua = navigator.userAgent || '';
    return /Android/i.test(ua);
  })();

  // 跨平台语速标定对照表 (经过低幼儿童听感反复标定)
  // iOS 针对 WebKit 加速进行严格比例压缩，Android 进行适度衰减，电脑端降至舒适教学慢速
  var RATE_PROFILES = {
    slow:   { ios: 0.35, android: 0.45, desktop: 0.50, label: '🐢 慢速跟读' },
    medium: { ios: 0.42, android: 0.52, desktop: 0.62, label: '📖 课本伴学' },
    normal: { ios: 0.52, android: 0.65, desktop: 0.76, label: '🐰 流利原速' }
  };

  var speechRateLevel = (typeof Store !== 'undefined' && Store.get) ? Store.get('pep_rate_level', 'medium') : 'medium';
  if (!RATE_PROFILES[speechRateLevel]) speechRateLevel = 'medium';

  // 保持 speechRate 变量向后兼容（指向当前等级名）
  var speechRate = speechRateLevel;

  function getCalibratedRate(rateOrLevel) {
    var lvl = (typeof rateOrLevel === 'string') ? rateOrLevel : speechRateLevel;
    if (RATE_PROFILES[lvl]) {
      var prof = RATE_PROFILES[lvl];
      if (_isIOS) return prof.ios;
      if (_isAndroid) return prof.android;
      return prof.desktop;
    }
    if (typeof rateOrLevel === 'number' && !isNaN(rateOrLevel)) {
      var target = rateOrLevel;
      if (_isIOS) {
        target = target * 0.52; // iOS 强制压缩 48%
      } else if (_isAndroid) {
        target = target * 0.70; // 安卓压缩 30%
      } else {
        target = target * 0.78; // 桌面端压缩 22%
      }
      return Math.max(0.25, Math.min(0.85, Math.round(target * 100) / 100));
    }
    var defProf = RATE_PROFILES[speechRateLevel] || RATE_PROFILES.medium;
    if (_isIOS) return defProf.ios;
    if (_isAndroid) return defProf.android;
    return defProf.desktop;
  }

  var _preferredVoice = null;
  var _voicesLoaded = false;

  function initVoices() {
    if (!('speechSynthesis' in window)) return;
    var all = window.speechSynthesis.getVoices() || [];
    if (!all.length) return;
    _voicesLoaded = true;

    // 优选优先级：Edge Natural (Jenny, Aria), Google US English, Samantha, Ava, Alex, en-US / en-GB
    var targets = ['jenny', 'aria', 'natural', 'google us english', 'google english', 'samantha', 'ava', 'allison', 'alex', 'victoria', 'karen', 'daniel', 'serena', 'zira', 'david'];
    for (var i = 0; i < targets.length; i++) {
      for (var j = 0; j < all.length; j++) {
        var v = all[j];
        var n = (v.name || '').toLowerCase();
        if (n.indexOf(targets[i]) >= 0 && (v.lang || '').toLowerCase().indexOf('en') >= 0) {
          _preferredVoice = v;
          return;
        }
      }
    }
    // 兜底找任意 en-US 或 en
    for (var k = 0; k < all.length; k++) {
      var lang = (all[k].lang || '').toLowerCase();
      if (lang === 'en-us' || lang.indexOf('en') === 0) {
        _preferredVoice = all[k];
        return;
      }
    }
  }

  if ('speechSynthesis' in window) {
    initVoices();
    window.speechSynthesis.onvoiceschanged = initVoices;
  }

  /* ============================================================
     防重复与防抖控制器 (Token Sequencer & Debounce)
     - utteranceToken: 单个语音唯一性，cancel 中断不触发回调
     - sequenceToken: 交互序列控制器 (小火车、拼读碰撞)，区分独立操作
     - 彻底杜绝 cancel 误触发与序列自杀式提前终止问题
     ============================================================ */
  var utteranceToken = 0;
  var sequenceToken = 0;
  var lastActionTs = 0;

  function isDebounced(ms) {
    var now = Date.now();
    if (now - lastActionTs < (ms || 280)) return true;
    lastActionTs = now;
    return false;
  }

  function startSequence() {
    sequenceToken++;
    stopSpeech();
    return sequenceToken;
  }

  function stopSpeech() {
    utteranceToken++;
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
  }

  // 针对移动端 Web Speech API 对中文拼音/人名的发音优化：
  // 许多手机 TTS（如 iOS Safari / 安卓 Chrome / 小爱 / 讯飞 / 华为语音）
  // 在英文朗读模式遇到中式拼音人名（如 Wu, Binbin, BinBin, Jie, Qiqi, Duoduo）时，
  // 因为不是原生英文词汇或由于大写/驼峰结构，会降级为一个一个字母拼读（如 W-U, B-I-N-B-I-N, J-I-E）。
  // 此处将拼音人名转化为英语 TTS 引擎 100% 能够自然连读的拟音词串，同时在屏幕 UI 上保持纯正教材原貌。
  function prepareSpeechText(text) {
    if (!text) return '';
    var s = String(text);

    // 1. 拆分复合驼峰词（例如 Wu BinBin -> Wu Bin Bin, MingMing -> Ming Ming），避免移动端引擎识别为未知缩写而逐字母拼读
    s = s.replace(/([a-z])([A-Z])/g, '$1 $2');

    // 2. 教材常见人名核心拟音映射表 (确保英语 TTS 发出纯正流畅的词汇级连读音)
    // - Wu Binbin -> Woo Bin bin (Woo=/wuː/, Bin=/bɪn/，两个高频英语词，连贯读出“吴斌斌”)
    s = s.replace(/\bWu\s+Bin\s*bin\b/gi, 'Woo Bin bin');
    s = s.replace(/\bBin\s*bin\b/gi, 'Bin bin');
    s = s.replace(/\bWu\b/g, 'Woo'); // 孤立的 Wu 姓氏读 Woo，防止被读成字母 W-U

    // - Chen Jie -> Chen Jay (Jie 在英文无对应发音常被读成 J-I-E，Jay 还原标准教材课标磁带外教读音)
    s = s.replace(/\bChen\s+Jie\b/gi, 'Chen Jay');
    s = s.replace(/\bJie\b/g, 'Jay');

    // - Zhang Peng -> Jang Peng (Zhang 常被英语引擎逐字母拼读为 Z-H-A-N-G)
    s = s.replace(/\bZhang\s+Peng\b/gi, 'Jang Peng');

    // - Duoduo -> Duo duo (duo 为现成英文单词，拆开后自然读出“多多”)
    s = s.replace(/\bDuo\s*duo\b/gi, 'Duo duo');

    // - Qiqi -> Chee chee (英文无 qi 单字，易被拼为 Q-I-Q-I，Chee chee 准确发出“琪琪”)
    s = s.replace(/\bQi\s*qi\b/gi, 'Chee chee');

    // 扩充全国小学常用教材人物（李明、韩梅梅等）
    s = s.replace(/\bLi\s+Ming\b/gi, 'Lee Ming');
    s = s.replace(/\bLi\s+Lei\b/gi, 'Lee Lay');
    s = s.replace(/\bHan\s+Mei\s*mei\b/gi, 'Hahn May may');
    s = s.replace(/\bMei\s*mei\b/gi, 'May may');
    s = s.replace(/\bLing\s*ling\b/gi, 'Ling ling');
    s = s.replace(/\bDa\s*ming\b/gi, 'Dah ming');
    s = s.replace(/\bXiao\s*ming\b/gi, 'Xiao ming');
    s = s.replace(/\bXiao\s*hua\b/gi, 'Xiao hua');
    s = s.replace(/\bTian\s*tian\b/gi, 'Tian tian');

    return s;
  }

  // 纯正朗读英文单词 (带 Token 唯一有效锁，彻底杜绝发两次音与语速失控)
  function speakWord(text, customRate, onEnd) {
    if (!('speechSynthesis' in window) || !text) {
      if (onEnd) onEnd();
      return;
    }
    stopSpeech();
    var thisUtterance = utteranceToken;

    try {
      var synth = window.speechSynthesis;
      var cleanText = prepareSpeechText(String(text).trim());
      var u = new SpeechSynthesisUtterance(cleanText);
      u.lang = 'en-US';
      u.rate = getCalibratedRate(customRate);
      u.pitch = 1.02; // 亲和自然伴读音调
      if (!_preferredVoice) initVoices();
      if (_preferredVoice) u.voice = _preferredVoice;

      var finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        // 只有当前任务未被新语音打断时，才允许执行回调
        if (onEnd && thisUtterance === utteranceToken) {
          onEnd();
        }
      }

      u.onend = finish;
      u.onerror = function (ev) {
        // 关键修复：如果是 cancel 中断引起的，坚决不触发下一次回调！防止双重循环！
        if (ev && (ev.error === 'canceled' || ev.error === 'interrupted')) return;
        finish();
      };
      synth.speak(u);
    } catch (e) {
      if (onEnd && thisUtterance === utteranceToken) onEnd();
    }
  }

  // 点击单音素积木发音：纯净朗读字母或音素本身，绝不追加任何不相干单词（杜绝突兀感）
  function speakPhonicsSound(part, currentWord, onEnd) {
    if (typeof currentWord === 'function') {
      onEnd = currentWord;
      currentWord = null;
    }
    var p = (part || '').trim();
    if (!p) {
      if (onEnd) onEnd();
      return;
    }
    speakWord(p, 'slow', onEnd); // 音素单拆朗读采用清晰慢速
  }

  /* ============================================================
     人教版 PEP 三年级词库数据库 (PEP Grade 3 Database)
     - 涵盖 PEP 3A 6大单元与 3B 5大短元音 CVC 核心词
     ============================================================ */
  var WORDS = [
  {
    "id": "u1_and",
    "word": "and",
    "ipa": "/ænd/",
    "ipas": [
      "/æ/",
      "/n/",
      "/d/"
    ],
    "phonics": [
      "a",
      "n",
      "d"
    ],
    "cn": "和；与",
    "emoji": "🤝",
    "unit": "u1",
    "family": "-and",
    "onset": "",
    "rime": "and",
    "magicTip": "字母 a 像苹果，d 像小碗，苹果“和”小碗放在一起。",
    "tpr": "拉起小伙伴的手：You and me!",
    "tip": "连词，连接两个朋友或物品"
  },
  {
    "id": "u1_arm",
    "word": "arm",
    "ipa": "/ɑːm/",
    "ipas": [
      "/ɑː/",
      "/m/"
    ],
    "phonics": [
      "ar",
      "m"
    ],
    "cn": "胳膊；手臂",
    "emoji": "💪",
    "unit": "u1",
    "family": "-arm",
    "onset": "",
    "rime": "arm",
    "magicTip": "字母 a 像肩膀，r 像手肘弯曲，m 像握拳的肌肉，合起来就是胳膊！",
    "tpr": "Touch your arm! 拍拍你的小胳膊",
    "tip": "身体部位词，用来拥抱和展示力量"
  },
  {
    "id": "u1_can",
    "word": "can",
    "ipa": "/kæn/",
    "ipas": [
      "/k/",
      "/æ/",
      "/n/"
    ],
    "phonics": [
      "c",
      "a",
      "n"
    ],
    "cn": "可以；能",
    "emoji": "🙋",
    "unit": "u1",
    "family": "-an",
    "onset": "c",
    "rime": "an",
    "magicTip": "小猫 cat 换掉 t 变成 n，我有能耐我“可以”！",
    "tpr": "自信点头：Yes, I can!",
    "tip": "情态动词：We can share."
  },
  {
    "id": "u1_ear",
    "word": "ear",
    "ipa": "/ɪə(r)/",
    "ipas": [
      "/ɪə/"
    ],
    "phonics": [
      "ear"
    ],
    "cn": "耳朵",
    "emoji": "👂",
    "unit": "u1",
    "family": "-ear",
    "onset": "",
    "rime": "ear",
    "magicTip": "藏在 hear（听）里面，长在脑袋两边专门用来倾听伙伴。",
    "tpr": "Touch your ear! 摸摸小耳朵认真倾听",
    "tip": "身体部位词：I listen with care."
  },
  {
    "id": "u1_eye",
    "word": "eye",
    "ipa": "/aɪ/",
    "ipas": [
      "/aɪ/"
    ],
    "phonics": [
      "e",
      "y",
      "e"
    ],
    "cn": "眼睛",
    "emoji": "👁️",
    "unit": "u1",
    "family": "",
    "onset": "",
    "rime": "",
    "magicTip": "两个 e 是两只圆溜溜的大眼睛，中间的 y 是小鼻子，看一眼就记住！",
    "tpr": "Look into my eyes! 看着我的眼睛真诚微笑",
    "tip": "身体部位词：用眼睛注视朋友"
  },
  {
    "id": "u1_friend",
    "word": "friend",
    "ipa": "/frend/",
    "ipas": [
      "/f/",
      "/r/",
      "/e/",
      "/n/",
      "/d/"
    ],
    "phonics": [
      "fr",
      "ie",
      "nd"
    ],
    "cn": "朋友",
    "emoji": "🧑‍🤝‍🧑",
    "unit": "u1",
    "family": "-end",
    "onset": "fr",
    "rime": "end",
    "magicTip": "分享（free）玩到最后（end）的人，就是一辈子的真“朋友”！",
    "tpr": "搂住肩膀：You are my friend!",
    "tip": "第一单元核心主题词汇"
  },
  {
    "id": "u1_good",
    "word": "good",
    "ipa": "/ɡʊd/",
    "ipas": [
      "/ɡ/",
      "/ʊ/",
      "/d/"
    ],
    "phonics": [
      "g",
      "oo",
      "d"
    ],
    "cn": "好的；优良的",
    "emoji": "👍",
    "unit": "u1",
    "family": "-ood",
    "onset": "g",
    "rime": "ood",
    "magicTip": "两个 oo 像一双大眼睛，看到很“好”的东西笑眯眯竖大拇指。",
    "tpr": "竖起大拇指：Very good!",
    "tip": "常用于问候：Good morning / good friend"
  },
  {
    "id": "u1_goodbye",
    "word": "goodbye",
    "ipa": "/ˌɡʊdˈbaɪ/",
    "ipas": [
      "/ɡʊd/",
      "/baɪ/"
    ],
    "phonics": [
      "good",
      "bye"
    ],
    "cn": "再见",
    "emoji": "👋",
    "unit": "u1",
    "family": "",
    "onset": "",
    "rime": "",
    "magicTip": "好的（good）拜拜（bye），放学挥手礼貌说“再见”！",
    "tpr": "挥动小手：Goodbye, see you tomorrow!",
    "tip": "礼貌道别日常用语"
  },
  {
    "id": "u1_hand",
    "word": "hand",
    "ipa": "/hænd/",
    "ipas": [
      "/h/",
      "/æ/",
      "/n/",
      "/d/"
    ],
    "phonics": [
      "h",
      "a",
      "n",
      "d"
    ],
    "cn": "手",
    "emoji": "✋",
    "unit": "u1",
    "family": "-and",
    "onset": "h",
    "rime": "and",
    "magicTip": "帽子 hat 遇到 nd，伸出小“手”来和新同学握握手。",
    "tpr": "Wave your hand! 挥挥手打招呼",
    "tip": "身体部位词：Wave your hand."
  },
  {
    "id": "u1_help",
    "word": "help",
    "ipa": "/help/",
    "ipas": [
      "/h/",
      "/e/",
      "/l/",
      "/p/"
    ],
    "phonics": [
      "h",
      "e",
      "l",
      "p"
    ],
    "cn": "帮助",
    "emoji": "🆘",
    "unit": "u1",
    "family": "-elp",
    "onset": "h",
    "rime": "elp",
    "magicTip": "和伙伴碰一碰头，伸出热情的双手来“帮助”。",
    "tpr": "伸出双手做搀扶动作：Friends help each other!",
    "tip": "友谊美德词：互相帮助"
  },
  {
    "id": "u1_listen",
    "word": "listen",
    "ipa": "/ˈlɪsn/",
    "ipas": [
      "/l/",
      "/ɪ/",
      "/s/",
      "/n/"
    ],
    "phonics": [
      "l",
      "i",
      "s",
      "ten"
    ],
    "cn": "听；倾听",
    "emoji": "👂",
    "unit": "u1",
    "family": "",
    "onset": "l",
    "rime": "isten",
    "magicTip": "竖起耳朵 l，安静听 i，认真“倾听”不吵闹，字母 t 不发音哦！",
    "tpr": "把手放在耳旁倾听：Listen with care!",
    "tip": "交友法则：认真倾听朋友讲话"
  },
  {
    "id": "u1_mouth",
    "word": "mouth",
    "ipa": "/maʊθ/",
    "ipas": [
      "/m/",
      "/aʊ/",
      "/θ/"
    ],
    "phonics": [
      "m",
      "ou",
      "th"
    ],
    "cn": "嘴；口",
    "emoji": "👄",
    "unit": "u1",
    "family": "",
    "onset": "m",
    "rime": "outh",
    "magicTip": "两个嘴唇 m，张大嘴巴 ou，咬咬舌尖 th，这就是说话微笑的“嘴巴”！",
    "tpr": "指指嘴巴微微笑：Point to your mouth and smile!",
    "tip": "身体部位词：Smile with mouth"
  },
  {
    "id": "u1_nice",
    "word": "nice",
    "ipa": "/naɪs/",
    "ipas": [
      "/n/",
      "/aɪ/",
      "/s/"
    ],
    "phonics": [
      "n",
      "i",
      "ce"
    ],
    "cn": "令人愉快的；友好的",
    "emoji": "😊",
    "unit": "u1",
    "family": "-ice",
    "onset": "n",
    "rime": "ice",
    "magicTip": "数字九 nine 遇到冰 ice，大家友好友善真“美好”！",
    "tpr": "友好握手：Nice to meet you!",
    "tip": "见面礼貌表达核心词"
  },
  {
    "id": "u1_say",
    "word": "say",
    "ipa": "/seɪ/",
    "ipas": [
      "/s/",
      "/eɪ/"
    ],
    "phonics": [
      "s",
      "ay"
    ],
    "cn": "说；讲",
    "emoji": "🗣️",
    "unit": "u1",
    "family": "-ay",
    "onset": "s",
    "rime": "ay",
    "magicTip": "太阳 sun 下 ay 发双元音，张开小嘴大声“说”。",
    "tpr": "手放嘴边做喇叭状：Say hello!",
    "tip": "口语指令：Say hello / say hi"
  },
  {
    "id": "u1_share",
    "word": "share",
    "ipa": "/ʃeə(r)/",
    "ipas": [
      "/ʃ/",
      "/eə/"
    ],
    "phonics": [
      "sh",
      "are"
    ],
    "cn": "分享",
    "emoji": "🎁",
    "unit": "u1",
    "family": "-are",
    "onset": "sh",
    "rime": "are",
    "magicTip": "嘘 sh，玩具大家 are 一起玩，这就是最棒的“分享”！",
    "tpr": "双手递出物品：We can share!",
    "tip": "Part B核心交友美德：乐于分享"
  },
  {
    "id": "u1_smile",
    "word": "smile",
    "ipa": "/smaɪl/",
    "ipas": [
      "/s/",
      "/m/",
      "/aɪ/",
      "/l/"
    ],
    "phonics": [
      "sm",
      "i",
      "le"
    ],
    "cn": "微笑",
    "emoji": "😄",
    "unit": "u1",
    "family": "-ile",
    "onset": "sm",
    "rime": "ile",
    "magicTip": "里面藏着 mile（英里），给朋友一个微笑，快乐能传一英里！",
    "tpr": "双手食指轻点嘴角微笑：Smile to your friends!",
    "tip": "礼仪动作：微笑交友"
  },
  {
    "id": "u1_toy",
    "word": "toy",
    "ipa": "/tɔɪ/",
    "ipas": [
      "/t/",
      "/ɔɪ/"
    ],
    "phonics": [
      "t",
      "oy"
    ],
    "cn": "玩具",
    "emoji": "🧸",
    "unit": "u1",
    "family": "-oy",
    "onset": "t",
    "rime": "oy",
    "magicTip": "小男孩 boy 把 b 换成 t，手里拿着最爱的毛绒小“玩具”！",
    "tpr": "怀抱小熊：Share our toys!",
    "tip": "物品词：Share your toy"
  },
  {
    "id": "u2_aunt",
    "word": "aunt",
    "ipa": "/ɑːnt/",
    "ipas": [
      "/ɑː/",
      "/n/",
      "/t/"
    ],
    "phonics": [
      "au",
      "n",
      "t"
    ],
    "cn": "姑母；姨母；婶母；伯母；舅母",
    "emoji": "👩",
    "unit": "u2",
    "family": "",
    "onset": "",
    "rime": "aunt",
    "magicTip": "小蚂蚁 ant 前面加个 u，笑盈盈的亲切阿姨来做客。",
    "pair": "uncle",
    "tip": "家庭亲属称谓"
  },
  {
    "id": "u2_baby",
    "word": "baby",
    "ipa": "/ˈbeɪbi/",
    "ipas": [
      "/b/",
      "/eɪ/",
      "/b/",
      "/i/"
    ],
    "phonics": [
      "ba",
      "by"
    ],
    "cn": "婴儿；幼兽",
    "emoji": "👶",
    "unit": "u2",
    "family": "",
    "onset": "b",
    "rime": "aby",
    "magicTip": "两个小 b 像圆滚滚的胖肚皮，摇篮里睡觉的可人儿小“婴儿”。",
    "tip": "家庭成员：baby brother / cousin"
  },
  {
    "id": "u2_big",
    "word": "big",
    "ipa": "/bɪɡ/",
    "ipas": [
      "/b/",
      "/ɪ/",
      "/ɡ/"
    ],
    "phonics": [
      "b",
      "i",
      "g"
    ],
    "cn": "大的",
    "emoji": "🐘",
    "unit": "u2",
    "family": "-ig",
    "onset": "b",
    "rime": "ig",
    "magicTip": "字母 b 挺着大大的将军肚，大象一样威风又巨“大”！",
    "pair": "small",
    "tip": "形容词：反义词是 small"
  },
  {
    "id": "u2_brother",
    "word": "brother",
    "ipa": "/ˈbrʌðə(r)/",
    "ipas": [
      "/b/",
      "/r/",
      "/ʌ/",
      "/ð/",
      "/ə/"
    ],
    "phonics": [
      "br",
      "o",
      "ther"
    ],
    "cn": "兄；弟",
    "emoji": "👦",
    "unit": "u2",
    "family": "",
    "onset": "br",
    "rime": "other",
    "magicTip": "骑着扫帚 broom 陪我一起在操场奔跑追逐的亲密好“兄弟”！",
    "pair": "sister",
    "tip": "家庭成员称谓"
  },
  {
    "id": "u2_cousin",
    "word": "cousin",
    "ipa": "/ˈkʌzn/",
    "ipas": [
      "/k/",
      "/ʌ/",
      "/z/",
      "/n/"
    ],
    "phonics": [
      "cou",
      "sin"
    ],
    "cn": "堂(表)兄弟；堂(表)姐妹",
    "emoji": "🧒",
    "unit": "u2",
    "family": "",
    "onset": "c",
    "rime": "ousin",
    "magicTip": "带来灿烂阳光 sun，周末一起搭积木的“堂表亲戚小伙伴”！",
    "tip": "家庭成员：This is my cousin."
  },
  {
    "id": "u2_dad",
    "word": "dad",
    "ipa": "/dæd/",
    "ipas": [
      "/d/",
      "/æ/",
      "/d/"
    ],
    "phonics": [
      "d",
      "a",
      "d"
    ],
    "cn": "（口语）爸爸",
    "emoji": "👨",
    "unit": "u2",
    "family": "-ad",
    "onset": "d",
    "rime": "ad",
    "magicTip": "左右各有一根挺拔大扁担，中间站着顶天立地的好“爸爸”！",
    "pair": "mum",
    "tip": "口语称谓，等同于 father"
  },
  {
    "id": "u2_family",
    "word": "family",
    "ipa": "/ˈfæməli/",
    "ipas": [
      "/f/",
      "/æ/",
      "/m/",
      "/ə/",
      "/l/",
      "/i/"
    ],
    "phonics": [
      "fa",
      "mi",
      "ly"
    ],
    "cn": "家；家庭",
    "emoji": "👨‍👩‍👧‍👦",
    "unit": "u2",
    "family": "",
    "onset": "",
    "rime": "",
    "magicTip": "Father And Mother I Love You（爸爸妈妈我爱你们）！",
    "tip": "第二单元核心主题词汇"
  },
  {
    "id": "u2_father",
    "word": "father",
    "ipa": "/ˈfɑːðə(r)/",
    "ipas": [
      "/f/",
      "/ɑː/",
      "/ð/",
      "/ə/"
    ],
    "phonics": [
      "fa",
      "ther"
    ],
    "cn": "父亲；爸爸",
    "emoji": "🧔",
    "unit": "u2",
    "family": "",
    "onset": "f",
    "rime": "ather",
    "magicTip": "胖胖的 fa，亲切的 ther，高大伟岸保护全家的“父亲”！",
    "pair": "mother",
    "tip": "书面语称谓"
  },
  {
    "id": "u2_grandfather",
    "word": "grandfather",
    "ipa": "/ˈɡrænfɑːðə(r)/",
    "ipas": [
      "/ɡrænd/",
      "/fɑːðə/"
    ],
    "phonics": [
      "grand",
      "father"
    ],
    "cn": "（外）祖父；爷爷；外公",
    "emoji": "👴",
    "unit": "u2",
    "family": "",
    "onset": "",
    "rime": "",
    "magicTip": "宏大慈祥 grand 加爸爸 father，就是最和蔼的“爷爷/外公”！",
    "pair": "grandmother",
    "tip": "长辈称谓"
  },
  {
    "id": "u2_grandma",
    "word": "grandma",
    "ipa": "/ˈɡrænmɑː/",
    "ipas": [
      "/ɡræn/",
      "/mɑː/"
    ],
    "phonics": [
      "grand",
      "ma"
    ],
    "cn": "（口语）(外)祖母；奶奶；外婆",
    "emoji": "👵",
    "unit": "u2",
    "family": "",
    "onset": "",
    "rime": "",
    "magicTip": "奶奶外婆口语称呼，ma ma 的怀抱总是像春风一样温暖。",
    "pair": "grandpa",
    "tip": "长辈口语称谓"
  },
  {
    "id": "u2_grandmother",
    "word": "grandmother",
    "ipa": "/ˈɡrænmʌðə(r)/",
    "ipas": [
      "/ɡrænd/",
      "/mʌðə/"
    ],
    "phonics": [
      "grand",
      "mother"
    ],
    "cn": "（外）祖母；奶奶；外婆",
    "emoji": "👵",
    "unit": "u2",
    "family": "",
    "onset": "",
    "rime": "",
    "magicTip": "伟大慈爱 grand 加妈妈 mother，就是最疼爱我们的“奶奶/外婆”！",
    "pair": "grandfather",
    "tip": "长辈书面称谓"
  },
  {
    "id": "u2_grandpa",
    "word": "grandpa",
    "ipa": "/ˈɡrænpɑː/",
    "ipas": [
      "/ɡræn/",
      "/pɑː/"
    ],
    "phonics": [
      "grand",
      "pa"
    ],
    "cn": "（口语）(外)祖父；爷爷；外公",
    "emoji": "👴",
    "unit": "u2",
    "family": "",
    "onset": "",
    "rime": "",
    "magicTip": "爷爷外公亲切叫法，pa pa 叫着真亲近，白胡须翘翘笑哈哈。",
    "pair": "grandma",
    "tip": "长辈口语称谓"
  },
  {
    "id": "u2_have",
    "word": "have",
    "ipa": "/hæv/",
    "ipas": [
      "/h/",
      "/æ/",
      "/v/"
    ],
    "phonics": [
      "h",
      "a",
      "ve"
    ],
    "cn": "有；拥有",
    "emoji": "🤲",
    "unit": "u2",
    "family": "",
    "onset": "h",
    "rime": "ave",
    "magicTip": "手里拿着温暖的帽子 hat，张开双臂我“拥有”一个幸福的家！",
    "tip": "核心动词：I have a big family."
  },
  {
    "id": "u2_me",
    "word": "me",
    "ipa": "/miː/",
    "ipas": [
      "/m/",
      "/iː/"
    ],
    "phonics": [
      "m",
      "e"
    ],
    "cn": "我（宾格）",
    "emoji": "🧒",
    "unit": "u2",
    "family": "-e",
    "onset": "m",
    "rime": "e",
    "magicTip": "妈妈 mum 把 um 换成字母 e，就是最特别、充满自信的“我”！",
    "tip": "代词：This is me!"
  },
  {
    "id": "u2_mother",
    "word": "mother",
    "ipa": "/ˈmʌðə(r)/",
    "ipas": [
      "/m/",
      "/ʌ/",
      "/ð/",
      "/ə/"
    ],
    "phonics": [
      "mo",
      "ther"
    ],
    "cn": "母亲；妈妈",
    "emoji": "👩",
    "unit": "u2",
    "family": "",
    "onset": "m",
    "rime": "other",
    "magicTip": "像早晨的朝阳一样温暖轻柔照拂我成长的好“母亲”！",
    "pair": "father",
    "tip": "书面语称谓"
  },
  {
    "id": "u2_mum",
    "word": "mum",
    "ipa": "/mʌm/",
    "ipas": [
      "/m/",
      "/ʌ/",
      "/m/"
    ],
    "phonics": [
      "m",
      "u",
      "m"
    ],
    "cn": "（口语）妈妈",
    "emoji": "👩",
    "unit": "u2",
    "family": "-um",
    "onset": "m",
    "rime": "um",
    "magicTip": "两个手臂 m 像亲热的拥抱，中间一个 u，口语亲热叫“妈妈”！",
    "pair": "dad",
    "tip": "英式/日常口语称谓"
  },
  {
    "id": "u2_sister",
    "word": "sister",
    "ipa": "/ˈsɪstə(r)/",
    "ipas": [
      "/s/",
      "/ɪ/",
      "/s/",
      "/t/",
      "/ə/"
    ],
    "phonics": [
      "sis",
      "ter"
    ],
    "cn": "姐；妹",
    "emoji": "👧",
    "unit": "u2",
    "family": "",
    "onset": "s",
    "rime": "ister",
    "magicTip": "两个小 s 像两条翘翘的可爱小辫子，笑盈盈的好“姐妹”！",
    "pair": "brother",
    "tip": "家庭成员称谓"
  },
  {
    "id": "u2_small",
    "word": "small",
    "ipa": "/smɔːl/",
    "ipas": [
      "/s/",
      "/m/",
      "/ɔː/",
      "/l/"
    ],
    "phonics": [
      "sm",
      "all"
    ],
    "cn": "小的",
    "emoji": "🐭",
    "unit": "u2",
    "family": "-all",
    "onset": "sm",
    "rime": "all",
    "magicTip": "所有的 all 东西缩进小小的 s，像小老鼠一样精致小巧！",
    "pair": "big",
    "tip": "形容词：反义词是 big"
  },
  {
    "id": "u2_some",
    "word": "some",
    "ipa": "/sʌm/",
    "ipas": [
      "/s/",
      "/ʌ/",
      "/m/"
    ],
    "phonics": [
      "s",
      "o",
      "me"
    ],
    "cn": "一些；若干",
    "emoji": "🍬",
    "unit": "u2",
    "family": "",
    "onset": "s",
    "rime": "ome",
    "magicTip": "一起 come 换成 s，桌上放着“一些”美味小糖果大家吃！",
    "tip": "数量词：some fruits"
  },
  {
    "id": "u2_uncle",
    "word": "uncle",
    "ipa": "/ˈʌŋkl/",
    "ipas": [
      "/ʌ/",
      "/ŋ/",
      "/k/",
      "/l/"
    ],
    "phonics": [
      "un",
      "cle"
    ],
    "cn": "舅父；叔父；伯父；姑父；姨父",
    "emoji": "👨",
    "unit": "u2",
    "family": "",
    "onset": "",
    "rime": "uncle",
    "magicTip": "撑着伞 umbrella 走来的帅气男子，风趣幽默的好“叔叔/舅舅”！",
    "pair": "aunt",
    "tip": "家庭亲属称谓"
  },
  {
    "id": "u3_bird",
    "word": "bird",
    "ipa": "/bɜːd/",
    "ipas": [
      "/b/",
      "/ɜː/",
      "/d/"
    ],
    "phonics": [
      "b",
      "ir",
      "d"
    ],
    "cn": "鸟",
    "emoji": "🐦",
    "unit": "u3",
    "family": "-ird",
    "onset": "b",
    "rime": "ird",
    "magicTip": "字母 b 像鸟窝，ir 像两只翅膀拍呀拍，飞向蓝天的小“鸟”。",
    "tip": "动物词汇：It can fly and sing."
  },
  {
    "id": "u3_cat",
    "word": "cat",
    "ipa": "/kæt/",
    "ipas": [
      "/k/",
      "/æ/",
      "/t/"
    ],
    "phonics": [
      "c",
      "a",
      "t"
    ],
    "cn": "猫",
    "emoji": "🐱",
    "unit": "u3",
    "family": "-at",
    "onset": "c",
    "rime": "at",
    "magicTip": "抓猫爪板 c，圆圆猫脸 a，翘起猫尾巴 t，喵喵叫的“猫”！",
    "tip": "核心短元音 a 代表词"
  },
  {
    "id": "u3_cute",
    "word": "cute",
    "ipa": "/kjuːt/",
    "ipas": [
      "/k/",
      "/j/",
      "/uː/",
      "/t/"
    ],
    "phonics": [
      "c",
      "u",
      "te"
    ],
    "cn": "可爱的",
    "emoji": "🥰",
    "unit": "u3",
    "family": "-ute",
    "onset": "c",
    "rime": "ute",
    "magicTip": "看见萌萌的小猫咪，双手捧着小脸蛋喊“Q”，真“可爱”！",
    "tip": "描述词：The panda is cute."
  },
  {
    "id": "u3_dog",
    "word": "dog",
    "ipa": "/dɒɡ/",
    "ipas": [
      "/d/",
      "/ɒ/",
      "/ɡ/"
    ],
    "phonics": [
      "d",
      "o",
      "g"
    ],
    "cn": "狗",
    "emoji": "🐶",
    "unit": "u3",
    "family": "-og",
    "onset": "d",
    "rime": "og",
    "magicTip": "字母 d 像耳朵耷拉，o 像圆湿鼻，g 像卷尾巴摇摆的“小狗”。",
    "tip": "常见宠物核心词"
  },
  {
    "id": "u3_elephant",
    "word": "elephant",
    "ipa": "/ˈelɪfənt/",
    "ipas": [
      "/e/",
      "/l/",
      "/ɪ/",
      "/f/",
      "/ə/",
      "/n/",
      "/t/"
    ],
    "phonics": [
      "e",
      "le",
      "phant"
    ],
    "cn": "大象",
    "emoji": "🐘",
    "unit": "u3",
    "family": "",
    "onset": "",
    "rime": "",
    "magicTip": "大象鼻子长又长，长得巨型像座山，两只大耳像蒲扇！",
    "tip": "野生动物：It is big."
  },
  {
    "id": "u3_fast",
    "word": "fast",
    "ipa": "/fɑːst/",
    "ipas": [
      "/f/",
      "/ɑː/",
      "/s/",
      "/t/"
    ],
    "phonics": [
      "f",
      "a",
      "st"
    ],
    "cn": "快的；快地",
    "emoji": "⚡",
    "unit": "u3",
    "family": "-ast",
    "onset": "f",
    "rime": "ast",
    "magicTip": "一阵风 f 吹过抢先拿到第一名 first，猎豹奔跑飞一样“快”！",
    "pair": "slow",
    "tip": "副词/形容词：run fast"
  },
  {
    "id": "u3_fish",
    "word": "fish",
    "ipa": "/fɪʃ/",
    "ipas": [
      "/f/",
      "/ɪ/",
      "/ʃ/"
    ],
    "phonics": [
      "f",
      "i",
      "sh"
    ],
    "cn": "鱼",
    "emoji": "🐟",
    "unit": "u3",
    "family": "-ish",
    "onset": "f",
    "rime": "ish",
    "magicTip": "字母 f 像鱼钩，sh 像鱼鳞甩起一串小水花，欢快游动的小“鱼”。",
    "tip": "动物词汇：It can swim."
  },
  {
    "id": "u3_fox",
    "word": "fox",
    "ipa": "/fɒks/",
    "ipas": [
      "/f/",
      "/ɒ/",
      "/k/",
      "/s/"
    ],
    "phonics": [
      "f",
      "o",
      "x"
    ],
    "cn": "狐狸",
    "emoji": "🦊",
    "unit": "u3",
    "family": "-ox",
    "onset": "f",
    "rime": "ox",
    "magicTip": "盒子 box 把 b 换成 f，拖着蓬松火红大尾巴的聪明“狐狸”！",
    "tip": "野生动物词汇"
  },
  {
    "id": "u3_giraffe",
    "word": "giraffe",
    "ipa": "/dʒəˈrɑːf/",
    "ipas": [
      "/dʒ/",
      "/ə/",
      "/r/",
      "/ɑː/",
      "/f/"
    ],
    "phonics": [
      "gi",
      "raffe"
    ],
    "cn": "长颈鹿",
    "emoji": "🦒",
    "unit": "u3",
    "family": "",
    "onset": "",
    "rime": "",
    "magicTip": "脖子拉得老长老长，站在树顶优雅吃嫩树叶的“长颈鹿”。",
    "tip": "野生动物：The giraffe is tall."
  },
  {
    "id": "u3_go",
    "word": "go",
    "ipa": "/ɡəʊ/",
    "ipas": [
      "/ɡ/",
      "/əʊ/"
    ],
    "phonics": [
      "g",
      "o"
    ],
    "cn": "去；走",
    "emoji": "🏃",
    "unit": "u3",
    "family": "-o",
    "onset": "g",
    "rime": "o",
    "magicTip": "绿灯 green 亮起小人儿开跑 o，背好行囊我们“出发/去”！",
    "tip": "高频动作动词：Let's go!"
  },
  {
    "id": "u3_like",
    "word": "like",
    "ipa": "/laɪk/",
    "ipas": [
      "/l/",
      "/aɪ/",
      "/k/"
    ],
    "phonics": [
      "l",
      "i",
      "ke"
    ],
    "cn": "喜欢",
    "emoji": "❤️",
    "unit": "u3",
    "family": "-ike",
    "onset": "l",
    "rime": "ike",
    "magicTip": "竖起大拇指像字母 l，心里满心欢喜，真心“喜欢”！",
    "tip": "表达喜好：I like pandas."
  },
  {
    "id": "u3_lion",
    "word": "lion",
    "ipa": "/ˈlaɪən/",
    "ipas": [
      "/l/",
      "/aɪ/",
      "/ə/",
      "/n/"
    ],
    "phonics": [
      "li",
      "on"
    ],
    "cn": "狮子",
    "emoji": "🦁",
    "unit": "u3",
    "family": "",
    "onset": "l",
    "rime": "ion",
    "magicTip": "狮子傲然站在石头 on 上昂首长啸，威震百兽的威猛“狮子”。",
    "tip": "野生动物：King of the jungle"
  },
  {
    "id": "u3_Miss",
    "word": "Miss",
    "ipa": "/mɪs/",
    "ipas": [
      "/m/",
      "/ɪ/",
      "/s/"
    ],
    "phonics": [
      "M",
      "i",
      "ss"
    ],
    "cn": "小姐（对女教师等的尊称）",
    "emoji": "👩‍🏫",
    "unit": "u3",
    "family": "-iss",
    "onset": "m",
    "rime": "iss",
    "magicTip": "双写 ss 像漂亮身姿，小朋友们礼貌向怀特老师问好！",
    "tip": "称谓：Miss White"
  },
  {
    "id": "u3_monkey",
    "word": "monkey",
    "ipa": "/ˈmʌŋki/",
    "ipas": [
      "/m/",
      "/ʌ/",
      "/ŋ/",
      "/k/",
      "/i/"
    ],
    "phonics": [
      "mon",
      "key"
    ],
    "cn": "猴子",
    "emoji": "🐒",
    "unit": "u3",
    "family": "",
    "onset": "m",
    "rime": "onkey",
    "magicTip": "机灵小猴手里拿着金钥匙 key，在茂密树枝间荡秋千的“猴子”。",
    "tip": "动物词汇：It is fast."
  },
  {
    "id": "u3_panda",
    "word": "panda",
    "ipa": "/ˈpændə/",
    "ipas": [
      "/p/",
      "/æ/",
      "/n/",
      "/d/",
      "/ə/"
    ],
    "phonics": [
      "pan",
      "da"
    ],
    "cn": "大熊猫",
    "emoji": "🐼",
    "unit": "u3",
    "family": "",
    "onset": "p",
    "rime": "anda",
    "magicTip": "抱着平底锅 pan 啃新鲜竹子，圆滚滚的中国国宝大可爱！",
    "tip": "国宝动物：The panda is cute."
  },
  {
    "id": "u3_pet",
    "word": "pet",
    "ipa": "/pet/",
    "ipas": [
      "/p/",
      "/e/",
      "/t/"
    ],
    "phonics": [
      "p",
      "e",
      "t"
    ],
    "cn": "宠物",
    "emoji": "🐕",
    "unit": "u3",
    "family": "-et",
    "onset": "p",
    "rime": "et",
    "magicTip": "钢笔 pen 把 n 换成 t，家里细心陪伴抚摸的暖心小“宠物”。",
    "tip": "第三单元核心概念词"
  },
  {
    "id": "u3_rabbit",
    "word": "rabbit",
    "ipa": "/ˈræbɪt/",
    "ipas": [
      "/r/",
      "/æ/",
      "/b/",
      "/ɪ/",
      "/t/"
    ],
    "phonics": [
      "rab",
      "bit"
    ],
    "cn": "兔子",
    "emoji": "🐰",
    "unit": "u3",
    "family": "",
    "onset": "r",
    "rime": "abbit",
    "magicTip": "两个 b 像两只高高竖起来的长耳朵，爱吃胡萝卜蹦跳的“兔子”！",
    "tip": "萌宠词汇：white rabbit"
  },
  {
    "id": "u3_red_panda",
    "word": "red panda",
    "ipa": "/red ˈpændə/",
    "ipas": [
      "/red/",
      "/pændə/"
    ],
    "phonics": [
      "red",
      "panda"
    ],
    "cn": "小熊猫",
    "emoji": "🐾",
    "unit": "u3",
    "family": "",
    "onset": "",
    "rime": "",
    "magicTip": "身上披着漂亮的红棕色毛发，拖着环状斑纹大尾巴的小熊猫。",
    "tip": "课本新教材特色野生动物"
  },
  {
    "id": "u3_tall",
    "word": "tall",
    "ipa": "/tɔːl/",
    "ipas": [
      "/t/",
      "/ɔː/",
      "/l/"
    ],
    "phonics": [
      "t",
      "all"
    ],
    "cn": "高的",
    "emoji": "🦒",
    "unit": "u3",
    "family": "-all",
    "onset": "t",
    "rime": "all",
    "magicTip": "所有的 all 都在顶端 t 上立起来，像长颈鹿和电线杆那么“高”！",
    "pair": "short",
    "tip": "形容词：The giraffe is tall."
  },
  {
    "id": "u3_tiger",
    "word": "tiger",
    "ipa": "/ˈtaɪɡə(r)/",
    "ipas": [
      "/t/",
      "/aɪ/",
      "/ɡ/",
      "/ə/"
    ],
    "phonics": [
      "ti",
      "ger"
    ],
    "cn": "老虎",
    "emoji": "🐯",
    "unit": "u3",
    "family": "",
    "onset": "t",
    "rime": "iger",
    "magicTip": "额头上威风顶着一个大王字 T，嗷呜怒吼的森林之王“老虎”。",
    "tip": "野生猛兽词汇"
  },
  {
    "id": "u4_apple",
    "word": "apple",
    "ipa": "/ˈæpl/",
    "ipas": [
      "/æ/",
      "/p/",
      "/l/"
    ],
    "phonics": [
      "a",
      "p",
      "ple"
    ],
    "cn": "苹果",
    "emoji": "🍎",
    "unit": "u4",
    "family": "-ple",
    "onset": "ap",
    "rime": "ple",
    "magicTip": "字母 a 像圆圆的大苹果，咔嚓咬一口果汁喷出来甜滋滋！",
    "tip": "常见水果词：Do you like apples?"
  },
  {
    "id": "u4_banana",
    "word": "banana",
    "ipa": "/bəˈnɑːnə/",
    "ipas": [
      "/b/",
      "/ə/",
      "/n/",
      "/ɑː/",
      "/n/",
      "/ə/"
    ],
    "phonics": [
      "ba",
      "na",
      "na"
    ],
    "cn": "香蕉",
    "emoji": "🍌",
    "unit": "u4",
    "family": "",
    "onset": "b",
    "rime": "anana",
    "magicTip": "三个 a 像三根弯弯金黄的香蕉，剥开软糯香甜可口！",
    "tip": "常见水果：I like bananas."
  },
  {
    "id": "u4_farm",
    "word": "farm",
    "ipa": "/fɑːm/",
    "ipas": [
      "/f/",
      "/ɑː/",
      "/m/"
    ],
    "phonics": [
      "f",
      "ar",
      "m"
    ],
    "cn": "农场",
    "emoji": "🚜",
    "unit": "u4",
    "family": "-arm",
    "onset": "f",
    "rime": "arm",
    "magicTip": "胳膊 arm 加个飞翔的 f，在广阔的大“农场”里播种收获粮食。",
    "tip": "自然场景词：Welcome to the farm!"
  },
  {
    "id": "u4_air",
    "word": "air",
    "ipa": "/eə(r)/",
    "ipas": [
      "/eə/"
    ],
    "phonics": [
      "air"
    ],
    "cn": "空气",
    "emoji": "💨",
    "unit": "u4",
    "family": "-air",
    "onset": "",
    "rime": "air",
    "magicTip": "风一样清爽无形，大自然深吸一口多么新鲜甜润的“空气”！",
    "tip": "生命要素：fresh air"
  },
  {
    "id": "u4_orange",
    "word": "orange",
    "ipa": "/ˈɒrɪndʒ/",
    "ipas": [
      "/ɒ/",
      "/r/",
      "/ɪ/",
      "/n/",
      "/dʒ/"
    ],
    "phonics": [
      "o",
      "ran",
      "ge"
    ],
    "cn": "橙子；柑橘",
    "emoji": "🍊",
    "unit": "u4",
    "family": "",
    "onset": "o",
    "rime": "range",
    "magicTip": "字母 o 像圆滚滚的果实，剥开皮闻到香喷喷的“橙子”。",
    "tip": "水果兼颜色词"
  },
  {
    "id": "u4_grape",
    "word": "grape",
    "ipa": "/ɡreɪp/",
    "ipas": [
      "/ɡ/",
      "/r/",
      "/eɪ/",
      "/p/"
    ],
    "phonics": [
      "gr",
      "a",
      "pe"
    ],
    "cn": "葡萄",
    "emoji": "🍇",
    "unit": "u4",
    "family": "-ape",
    "onset": "gr",
    "rime": "ape",
    "magicTip": "机灵小猴 ape 提着一串绿色 g，晶莹剔透酸甜水灵的“葡萄”！",
    "tip": "水果词：sweet grapes"
  },
  {
    "id": "u4_school",
    "word": "school",
    "ipa": "/skuːl/",
    "ipas": [
      "/s/",
      "/k/",
      "/uː/",
      "/l/"
    ],
    "phonics": [
      "sch",
      "oo",
      "l"
    ],
    "cn": "学校",
    "emoji": "🏫",
    "unit": "u4",
    "family": "-ool",
    "onset": "sch",
    "rime": "ool",
    "magicTip": "两个 oo 像戴着大眼镜认真学习，充满欢歌笑语的“学校”。",
    "tip": "场所词汇：school garden"
  },
  {
    "id": "u4_garden",
    "word": "garden",
    "ipa": "/ˈɡɑːdn/",
    "ipas": [
      "/ɡ/",
      "/ɑː/",
      "/d/",
      "/n/"
    ],
    "phonics": [
      "gar",
      "den"
    ],
    "cn": "花园；菜园",
    "emoji": "🏡",
    "unit": "u4",
    "family": "",
    "onset": "g",
    "rime": "arden",
    "magicTip": "护卫 guard 各种植物的花香天地，蝴蝶翩翩飞舞的美丽“花园”。",
    "tip": "场所词：Look at the school garden!"
  },
  {
    "id": "u4_need",
    "word": "need",
    "ipa": "/niːd/",
    "ipas": [
      "/n/",
      "/iː/",
      "/d/"
    ],
    "phonics": [
      "n",
      "ee",
      "d"
    ],
    "cn": "需要",
    "emoji": "🌱",
    "unit": "u4",
    "family": "-eed",
    "onset": "n",
    "rime": "eed",
    "magicTip": "两个 ee 像干旱的小禾苗仰望天空等雨水，花草真“需要”。",
    "tip": "动词：Plants need water."
  },
  {
    "id": "u4_water",
    "word": "water",
    "ipa": "/ˈwɔːtə(r)/",
    "ipas": [
      "/w/",
      "/ɔː/",
      "/t/",
      "/ə/"
    ],
    "phonics": [
      "wa",
      "ter"
    ],
    "cn": "水；给……浇水",
    "emoji": "💧",
    "unit": "u4",
    "family": "",
    "onset": "w",
    "rime": "ater",
    "magicTip": "波浪起伏 w，哗啦啦流淌来滋润幼苗的甘甜“水/浇水”。",
    "tip": "名词也是动词：Water the flowers!"
  },
  {
    "id": "u4_flower",
    "word": "flower",
    "ipa": "/ˈflaʊə(r)/",
    "ipas": [
      "/f/",
      "/l/",
      "/aʊ/",
      "/ə/"
    ],
    "phonics": [
      "fl",
      "ow",
      "er"
    ],
    "cn": "花；花朵",
    "emoji": "🌸",
    "unit": "u4",
    "family": "-ower",
    "onset": "fl",
    "rime": "ower",
    "magicTip": "随风飞翔 fly 盛开出五彩花瓣，香气扑鼻娇艳美丽的“花朵”。",
    "tip": "植物部位：colourful flowers"
  },
  {
    "id": "u4_grass",
    "word": "grass",
    "ipa": "/ɡrɑːs/",
    "ipas": [
      "/ɡ/",
      "/r/",
      "/ɑː/",
      "/s/"
    ],
    "phonics": [
      "gr",
      "a",
      "ss"
    ],
    "cn": "草；草地",
    "emoji": "🌿",
    "unit": "u4",
    "family": "-ass",
    "onset": "gr",
    "rime": "ass",
    "magicTip": "绿色 green 双写 ss 铺满起伏山坡，绿油油松软柔软的“草地”。",
    "tip": "植物词汇：Green grass"
  },
  {
    "id": "u4_plant",
    "word": "plant",
    "ipa": "/plɑːnt/",
    "ipas": [
      "/p/",
      "/l/",
      "/ɑː/",
      "/n/",
      "/t/"
    ],
    "phonics": [
      "pl",
      "an",
      "t"
    ],
    "cn": "植物；种植",
    "emoji": "🪴",
    "unit": "u4",
    "family": "-ant",
    "onset": "pl",
    "rime": "ant",
    "magicTip": "制定小计划 plan 栽下一株幼苗 t，绿意盎然生机勃勃的“植物”！",
    "tip": "第四单元核心主题词"
  },
  {
    "id": "u4_new",
    "word": "new",
    "ipa": "/njuː/",
    "ipas": [
      "/n/",
      "/juː/"
    ],
    "phonics": [
      "n",
      "ew"
    ],
    "cn": "新的",
    "emoji": "✨",
    "unit": "u4",
    "family": "-ew",
    "onset": "n",
    "rime": "ew",
    "magicTip": "春天枝头刚萌出的小绿芽，生机盎然刚刚长出来的“新”叶子！",
    "pair": "old",
    "tip": "形容词：new tree"
  },
  {
    "id": "u4_tree",
    "word": "tree",
    "ipa": "/triː/",
    "ipas": [
      "/t/",
      "/r/",
      "/iː/"
    ],
    "phonics": [
      "t",
      "r",
      "ee"
    ],
    "cn": "树",
    "emoji": "🌳",
    "unit": "u4",
    "family": "-ee",
    "onset": "tr",
    "rime": "ee",
    "magicTip": "字母 t 像笔直树干，双写 ee 像繁茂绿叶盖，撑起绿伞的大“树”。",
    "tip": "植物核心词：Plant a tree"
  },
  {
    "id": "u4_sun",
    "word": "sun",
    "ipa": "/sʌn/",
    "ipas": [
      "/s/",
      "/ʌ/",
      "/n/"
    ],
    "phonics": [
      "s",
      "u",
      "n"
    ],
    "cn": "太阳；阳光",
    "emoji": "☀️",
    "unit": "u4",
    "family": "-un",
    "onset": "s",
    "rime": "un",
    "magicTip": "字母 s 像温暖散发的光芒，天空照耀大地的大“太阳”。",
    "tip": "大自然元素：Plants need sun."
  },
  {
    "id": "u4_give",
    "word": "give",
    "ipa": "/ɡɪv/",
    "ipas": [
      "/ɡ/",
      "/ɪ/",
      "/v/"
    ],
    "phonics": [
      "g",
      "i",
      "ve"
    ],
    "cn": "给；给予",
    "emoji": "🎁",
    "unit": "u4",
    "family": "-ive",
    "onset": "g",
    "rime": "ive",
    "magicTip": "伸出慷慨的双臂，植物把香甜的果实和新鲜空气“给”我们。",
    "tip": "核心动词：Plants give us food."
  },
  {
    "id": "u4_us",
    "word": "us",
    "ipa": "/ʌs/",
    "ipas": [
      "/ʌ/",
      "/s/"
    ],
    "phonics": [
      "u",
      "s"
    ],
    "cn": "我们（宾格）",
    "emoji": "👫",
    "unit": "u4",
    "family": "-us",
    "onset": "",
    "rime": "us",
    "magicTip": "阳光照着你 u 和我 s，大家欢聚在一起就是温暖的“我们”！",
    "tip": "人称代词宾格：give us fresh air"
  },
  {
    "id": "u4_them",
    "word": "them",
    "ipa": "/ðem/",
    "ipas": [
      "/ð/",
      "/e/",
      "/m/"
    ],
    "phonics": [
      "th",
      "e",
      "m"
    ],
    "cn": "它们；他们；她们（宾格）",
    "emoji": "👥",
    "unit": "u4",
    "family": "-em",
    "onset": "th",
    "rime": "em",
    "magicTip": "咬着舌尖 th 指向满园花草，让我们用心呵护“它们”！",
    "tip": "代词：Help them grow."
  },
  {
    "id": "u5_colour",
    "word": "colour",
    "ipa": "/ˈkʌlə(r)/",
    "ipas": [
      "/k/",
      "/ʌ/",
      "/l/",
      "/ə/"
    ],
    "phonics": [
      "col",
      "our"
    ],
    "cn": "颜色",
    "emoji": "🎨",
    "unit": "u5",
    "family": "",
    "onset": "",
    "rime": "",
    "magicTip": "在我们 our 的水彩调色盘上，装满绚丽多彩缤纷的“颜色”！",
    "tip": "第五单元核心主题词"
  },
  {
    "id": "u5_orange",
    "word": "orange",
    "ipa": "/ˈɒrɪndʒ/",
    "ipas": [
      "/ɒ/",
      "/r/",
      "/ɪ/",
      "/n/",
      "/dʒ/"
    ],
    "phonics": [
      "o",
      "ran",
      "ge"
    ],
    "cn": "橙红色的；橙色",
    "emoji": "🟠",
    "unit": "u5",
    "family": "",
    "onset": "o",
    "rime": "range",
    "magicTip": "既是多汁蜜橘，也是落日晚霞一样温暖灿烂明亮的“橙色”。",
    "tip": "颜色词：It's orange."
  },
  {
    "id": "u5_green",
    "word": "green",
    "ipa": "/ɡriːn/",
    "ipas": [
      "/ɡ/",
      "/r/",
      "/iː/",
      "/n/"
    ],
    "phonics": [
      "gr",
      "ee",
      "n"
    ],
    "cn": "绿色；绿色的",
    "emoji": "🟢",
    "unit": "u5",
    "family": "-een",
    "onset": "gr",
    "rime": "een",
    "magicTip": "大树和青草的盛装，大自然春天最清新充满生命力的“绿色”。",
    "tip": "颜色词：Blue and yellow make green."
  },
  {
    "id": "u5_red",
    "word": "red",
    "ipa": "/red/",
    "ipas": [
      "/r/",
      "/e/",
      "/d/"
    ],
    "phonics": [
      "r",
      "e",
      "d"
    ],
    "cn": "红色；红色的",
    "emoji": "🔴",
    "unit": "u5",
    "family": "-ed",
    "onset": "r",
    "rime": "ed",
    "magicTip": "小床 bed 把 b 换成 r，成熟大苹果一样红艳艳喜庆的“红色”。",
    "tip": "颜色核心词：Red apple"
  },
  {
    "id": "u5_blue",
    "word": "blue",
    "ipa": "/bluː/",
    "ipas": [
      "/b/",
      "/l/",
      "/uː/"
    ],
    "phonics": [
      "bl",
      "ue"
    ],
    "cn": "蓝色；蓝色的",
    "emoji": "🔵",
    "unit": "u5",
    "family": "-ue",
    "onset": "bl",
    "rime": "ue",
    "magicTip": "蓝天白云大海边，澄澈辽阔如海浪翻涌的大自然“蓝色”。",
    "tip": "颜色核心词：Blue sky"
  },
  {
    "id": "u5_make",
    "word": "make",
    "ipa": "/meɪk/",
    "ipas": [
      "/m/",
      "/eɪ/",
      "/k/"
    ],
    "phonics": [
      "m",
      "a",
      "ke"
    ],
    "cn": "使出现；调配；制作",
    "emoji": "✨",
    "unit": "u5",
    "family": "-ake",
    "onset": "m",
    "rime": "ake",
    "magicTip": "做蛋糕 cake 把 c 换成 m，红加蓝“神奇调配制成”新色彩！",
    "tip": "调色动词：Red and blue make purple."
  },
  {
    "id": "u5_purple",
    "word": "purple",
    "ipa": "/ˈpɜːpl/",
    "ipas": [
      "/p/",
      "/ɜː/",
      "/p/",
      "/l/"
    ],
    "phonics": [
      "pur",
      "ple"
    ],
    "cn": "紫色；紫色的",
    "emoji": "🟣",
    "unit": "u5",
    "family": "-ple",
    "onset": "pur",
    "rime": "ple",
    "magicTip": "红加蓝神奇大变身，像晶莹剔透的水灵大葡萄一样神秘的“紫色”。",
    "tip": "变色结果词"
  },
  {
    "id": "u5_brown",
    "word": "brown",
    "ipa": "/braʊn/",
    "ipas": [
      "/b/",
      "/r/",
      "/aʊ/",
      "/n/"
    ],
    "phonics": [
      "br",
      "own"
    ],
    "cn": "棕色；棕色的",
    "emoji": "🟤",
    "unit": "u5",
    "family": "-own",
    "onset": "br",
    "rime": "own",
    "magicTip": "树皮和大地的厚重质感，大棕熊厚实毛发一样暖洋洋的“棕色”。",
    "tip": "颜色词：brown bear"
  },
  {
    "id": "u5_bear",
    "word": "bear",
    "ipa": "/beə(r)/",
    "ipas": [
      "/b/",
      "/eə/"
    ],
    "phonics": [
      "b",
      "ear"
    ],
    "cn": "熊",
    "emoji": "🐻",
    "unit": "u5",
    "family": "-ear",
    "onset": "b",
    "rime": "ear",
    "magicTip": "圆耳朵 ear 加个胖胖的 b，憨态可掬爱吃蜂蜜的大黑“熊”。",
    "tip": "动物词汇：I see a brown bear."
  },
  {
    "id": "u5_yellow",
    "word": "yellow",
    "ipa": "/ˈjeləʊ/",
    "ipas": [
      "/j/",
      "/e/",
      "/l/",
      "/əʊ/"
    ],
    "phonics": [
      "yel",
      "low"
    ],
    "cn": "黄色；黄色的",
    "emoji": "🟡",
    "unit": "u5",
    "family": "",
    "onset": "y",
    "rime": "ellow",
    "magicTip": "鸭子嘎嘎 yell，像向日葵与香蕉一样阳光灿烂闪亮的“黄色”。",
    "tip": "三原色核心词"
  },
  {
    "id": "u5_duck",
    "word": "duck",
    "ipa": "/dʌk/",
    "ipas": [
      "/d/",
      "/ʌ/",
      "/k/"
    ],
    "phonics": [
      "d",
      "u",
      "ck"
    ],
    "cn": "鸭",
    "emoji": "🦆",
    "unit": "u5",
    "family": "-uck",
    "onset": "d",
    "rime": "uck",
    "magicTip": "扁扁黄嘴巴 ck，在清凉池塘里摇摇摆摆游泳欢唱的小“鸭子”。",
    "tip": "动物词汇：pink duck"
  },
  {
    "id": "u5_sea",
    "word": "sea",
    "ipa": "/siː/",
    "ipas": [
      "/s/",
      "/iː/"
    ],
    "phonics": [
      "s",
      "ea"
    ],
    "cn": "海；海洋",
    "emoji": "🌊",
    "unit": "u5",
    "family": "-ea",
    "onset": "s",
    "rime": "ea",
    "magicTip": "眼睛 see 到远方无边无际、蓝色波浪翻滚的蔚蓝大“海”！",
    "tip": "景观词：Blue like the sea"
  },
  {
    "id": "u5_pink",
    "word": "pink",
    "ipa": "/pɪŋk/",
    "ipas": [
      "/p/",
      "/ɪ/",
      "/ŋ/",
      "/k/"
    ],
    "phonics": [
      "p",
      "i",
      "nk"
    ],
    "cn": "粉色；粉色的",
    "emoji": "🌸",
    "unit": "u5",
    "family": "-ink",
    "onset": "p",
    "rime": "ink",
    "magicTip": "墨水 ink 加个俏皮的 p，桃花盛开般娇嫩可爱甜美的“粉红色”。",
    "tip": "颜色词：Draw a pink duck."
  },
  {
    "id": "u5_draw",
    "word": "draw",
    "ipa": "/drɔː/",
    "ipas": [
      "/d/",
      "/r/",
      "/ɔː/"
    ],
    "phonics": [
      "dr",
      "aw"
    ],
    "cn": "画",
    "emoji": "🖍️",
    "unit": "u5",
    "family": "-aw",
    "onset": "dr",
    "rime": "aw",
    "magicTip": "拿起画笔拉出线条，在洁白的画纸上尽情涂抹“画”下美丽画卷！",
    "tip": "艺术动词：Draw a rainbow."
  },
  {
    "id": "u5_white",
    "word": "white",
    "ipa": "/waɪt/",
    "ipas": [
      "/w/",
      "/aɪ/",
      "/t/"
    ],
    "phonics": [
      "wh",
      "i",
      "te"
    ],
    "cn": "白色；白色的",
    "emoji": "⚪",
    "unit": "u5",
    "family": "-ite",
    "onset": "wh",
    "rime": "ite",
    "magicTip": "冬天漫天纷飞的轻柔雪花，纯洁无瑕干干净净亮晶晶的“白色”。",
    "pair": "black",
    "tip": "颜色词：White snow"
  },
  {
    "id": "u5_black",
    "word": "black",
    "ipa": "/blæk/",
    "ipas": [
      "/b/",
      "/l/",
      "/æ/",
      "/k/"
    ],
    "phonics": [
      "bl",
      "a",
      "ck"
    ],
    "cn": "黑色；黑色的",
    "emoji": "⚫",
    "unit": "u5",
    "family": "-ack",
    "onset": "bl",
    "rime": "ack",
    "magicTip": "关上电灯黑漆漆，像深邃夜空和黑板一样乌黑沉稳的“黑色”。",
    "pair": "white",
    "tip": "颜色词：Black night"
  },
  {
    "id": "u6_old",
    "word": "old",
    "ipa": "/əʊld/",
    "ipas": [
      "/əʊ/",
      "/l/",
      "/d/"
    ],
    "phonics": [
      "o",
      "l",
      "d"
    ],
    "cn": "（多少）岁；年纪；旧的",
    "emoji": "🎂",
    "unit": "u6",
    "family": "-old",
    "onset": "",
    "rime": "old",
    "magicTip": "岁月一圈圈 o，爷爷白胡须飘飘，询问小朋友几“岁/年纪大”。",
    "tip": "年龄核心问句：How old are you?"
  },
  {
    "id": "u6_five",
    "word": "five",
    "ipa": "/faɪv/",
    "ipas": [
      "/f/",
      "/aɪ/",
      "/v/"
    ],
    "phonics": [
      "f",
      "i",
      "ve"
    ],
    "cn": "五",
    "emoji": "5️⃣",
    "unit": "u6",
    "family": "-ive",
    "onset": "f",
    "rime": "ive",
    "magicTip": "伸出一整只小手掌，五根手指齐齐亮出代表数字“五”。",
    "tip": "基数词：I'm five years old."
  },
  {
    "id": "u6_year",
    "word": "year",
    "ipa": "/jɪə(r)/",
    "ipas": [
      "/j/",
      "/ɪə/"
    ],
    "phonics": [
      "y",
      "ear"
    ],
    "cn": "年纪；岁；年",
    "emoji": "📅",
    "unit": "u6",
    "family": "-ear",
    "onset": "y",
    "rime": "ear",
    "magicTip": "耳朵 ear 听新年钟声当当响，春夏秋冬过完我们又长大一“岁/年”。",
    "tip": "年龄词：eight years old"
  },
  {
    "id": "u6_one",
    "word": "one",
    "ipa": "/wʌn/",
    "ipas": [
      "/w/",
      "/ʌ/",
      "/n/"
    ],
    "phonics": [
      "o",
      "n",
      "e"
    ],
    "cn": "一",
    "emoji": "1️⃣",
    "unit": "u6",
    "family": "",
    "onset": "",
    "rime": "",
    "magicTip": "红红太阳独一无二高高挂，竖起一根食指代表数字“一”。",
    "tip": "基数词：One, two, three"
  },
  {
    "id": "u6_two",
    "word": "two",
    "ipa": "/tuː/",
    "ipas": [
      "/t/",
      "/uː/"
    ],
    "phonics": [
      "t",
      "w",
      "o"
    ],
    "cn": "二",
    "emoji": "2️⃣",
    "unit": "u6",
    "family": "",
    "onset": "tw",
    "rime": "o",
    "magicTip": "两只美丽白天鹅在碧波中游，小朋友比划胜利剪刀手代表“二”。",
    "tip": "基数词"
  },
  {
    "id": "u6_three",
    "word": "three",
    "ipa": "/θriː/",
    "ipas": [
      "/θ/",
      "/r/",
      "/iː/"
    ],
    "phonics": [
      "th",
      "r",
      "ee"
    ],
    "cn": "三",
    "emoji": "3️⃣",
    "unit": "u6",
    "family": "-ee",
    "onset": "thr",
    "rime": "ee",
    "magicTip": "咬着舌尖 th，茂盛大树 tree 去掉 t，三颗闪烁小星代表“三”。",
    "tip": "基数词"
  },
  {
    "id": "u6_four",
    "word": "four",
    "ipa": "/fɔː(r)/",
    "ipas": [
      "/f/",
      "/ɔː/"
    ],
    "phonics": [
      "f",
      "ou",
      "r"
    ],
    "cn": "四",
    "emoji": "4️⃣",
    "unit": "u6",
    "family": "-our",
    "onset": "f",
    "rime": "our",
    "magicTip": "小板凳稳稳当当四条腿，正方形四个整齐直角代表“四”。",
    "tip": "基数词：four o'clock"
  },
  {
    "id": "u6_ten",
    "word": "ten",
    "ipa": "/ten/",
    "ipas": [
      "/t/",
      "/e/",
      "/n/"
    ],
    "phonics": [
      "t",
      "e",
      "n"
    ],
    "cn": "十",
    "emoji": "🔟",
    "unit": "u6",
    "family": "-en",
    "onset": "t",
    "rime": "en",
    "magicTip": "钢笔 pen 换个字母 t，张开双手十根手指全部点赞代表“十”。",
    "tip": "基数词：ten candles"
  },
  {
    "id": "u6_six",
    "word": "six",
    "ipa": "/sɪks/",
    "ipas": [
      "/s/",
      "/ɪ/",
      "/k/",
      "/s/"
    ],
    "phonics": [
      "s",
      "i",
      "x"
    ],
    "cn": "六",
    "emoji": "6️⃣",
    "unit": "u6",
    "family": "-ix",
    "onset": "s",
    "rime": "ix",
    "magicTip": "字母 x 像交叉的小木棍，点一点骰子六个圆点代表数字“六”。",
    "tip": "基数词"
  },
  {
    "id": "u6_seven",
    "word": "seven",
    "ipa": "/ˈsevn/",
    "ipas": [
      "/s/",
      "/e/",
      "/v/",
      "/n/"
    ],
    "phonics": [
      "se",
      "ven"
    ],
    "cn": "七",
    "emoji": "7️⃣",
    "unit": "u6",
    "family": "",
    "onset": "s",
    "rime": "even",
    "magicTip": "天空雨后出现七色美丽彩虹，像爷爷手里的弯弯小拐杖代表“七”。",
    "tip": "基数词"
  },
  {
    "id": "u6_eight",
    "word": "eight",
    "ipa": "/eɪt/",
    "ipas": [
      "/eɪ/",
      "/t/"
    ],
    "phonics": [
      "eigh",
      "t"
    ],
    "cn": "八",
    "emoji": "8️⃣",
    "unit": "u6",
    "family": "-eight",
    "onset": "",
    "rime": "eight",
    "magicTip": "像两个滚圆的小雪人叠在一起，大吉大利代表数字“八”。",
    "tip": "基数词：eight years old"
  },
  {
    "id": "u6_nine",
    "word": "nine",
    "ipa": "/naɪn/",
    "ipas": [
      "/n/",
      "/aɪ/",
      "/n/"
    ],
    "phonics": [
      "n",
      "i",
      "ne"
    ],
    "cn": "九",
    "emoji": "9️⃣",
    "unit": "u6",
    "family": "-ine",
    "onset": "n",
    "rime": "ine",
    "magicTip": "气球底下系着一根长细线，十个减去一个刚好等于数字“九”。",
    "tip": "基数词"
  },
  {
    "id": "u6_oclock",
    "word": "o'clock",
    "ipa": "/əˈklɒk/",
    "ipas": [
      "/ə/",
      "/k/",
      "/l/",
      "/ɒ/",
      "/k/"
    ],
    "phonics": [
      "o'",
      "clock"
    ],
    "cn": "（表示整点）……点钟",
    "emoji": "⏰",
    "unit": "u6",
    "family": "",
    "onset": "",
    "rime": "clock",
    "magicTip": "圆圆大时钟 clock 上分针长针笔直指向十二，表示整点“……点钟”。",
    "tip": "时间表达：It's four o'clock."
  },
  {
    "id": "u6_cut",
    "word": "cut",
    "ipa": "/kʌt/",
    "ipas": [
      "/k/",
      "/ʌ/",
      "/t/"
    ],
    "phonics": [
      "c",
      "u",
      "t"
    ],
    "cn": "切；剪",
    "emoji": "✂️",
    "unit": "u6",
    "family": "-ut",
    "onset": "c",
    "rime": "ut",
    "magicTip": "咔嚓咔嚓一剪刀，香喷喷的生日蛋糕平分快快“切开”！",
    "tip": "动作词：Cut the cake."
  },
  {
    "id": "u6_eat",
    "word": "eat",
    "ipa": "/iːt/",
    "ipas": [
      "/iː/",
      "/t/"
    ],
    "phonics": [
      "ea",
      "t"
    ],
    "cn": "吃",
    "emoji": "😋",
    "unit": "u6",
    "family": "-eat",
    "onset": "",
    "rime": "eat",
    "magicTip": "张开贪吃的小嘴巴大口品尝香甜生日蛋糕，大口大口“吃”！",
    "tip": "动作词：Eat the cake."
  },
  {
    "id": "u6_cake",
    "word": "cake",
    "ipa": "/keɪk/",
    "ipas": [
      "/k/",
      "/eɪ/",
      "/k/"
    ],
    "phonics": [
      "c",
      "a",
      "ke"
    ],
    "cn": "蛋糕",
    "emoji": "🎂",
    "unit": "u6",
    "family": "-ake",
    "onset": "c",
    "rime": "ake",
    "magicTip": "蜡烛插在圆圆甜美的奶油面饼上，香甜诱人的生日派对大“蛋糕”！",
    "tip": "生日核心词：birthday cake"
  },
  {
    "id": "cat",
    "word": "cat",
    "phonics": [
      "c",
      "a",
      "t"
    ],
    "ipa": "/kæt/",
    "ipas": [
      "/k/",
      "/æ/",
      "/t/"
    ],
    "cn": "小猫",
    "emoji": "🐱",
    "unit": "sa",
    "family": "-at",
    "onset": "c",
    "rime": "at",
    "tip": "短元音 a 嘴巴张大两指宽，发 /æ/"
  },
  {
    "id": "bat",
    "word": "bat",
    "phonics": [
      "b",
      "a",
      "t"
    ],
    "ipa": "/bæt/",
    "ipas": [
      "/b/",
      "/æ/",
      "/t/"
    ],
    "cn": "蝙蝠/球棒",
    "emoji": "🦇",
    "unit": "sa",
    "family": "-at",
    "onset": "b",
    "rime": "at",
    "tip": "b 碰上 at ➔ bat"
  },
  {
    "id": "hat",
    "word": "hat",
    "phonics": [
      "h",
      "a",
      "t"
    ],
    "ipa": "/hæt/",
    "ipas": [
      "/h/",
      "/æ/",
      "/t/"
    ],
    "cn": "帽子",
    "emoji": "🎩",
    "unit": "sa",
    "family": "-at",
    "onset": "h",
    "rime": "at",
    "tip": "h 轻轻哈气 ➔ hat"
  },
  {
    "id": "fat",
    "word": "fat",
    "phonics": [
      "f",
      "a",
      "t"
    ],
    "ipa": "/fæt/",
    "ipas": [
      "/f/",
      "/æ/",
      "/t/"
    ],
    "cn": "胖的",
    "emoji": "🐷",
    "unit": "sa",
    "family": "-at",
    "onset": "f",
    "rime": "at",
    "tip": "f 咬住下唇 ➔ fat"
  },
  {
    "id": "mat",
    "word": "mat",
    "phonics": [
      "m",
      "a",
      "t"
    ],
    "ipa": "/mæt/",
    "ipas": [
      "/m/",
      "/æ/",
      "/t/"
    ],
    "cn": "垫子/地垫",
    "emoji": "🧘",
    "unit": "sa",
    "family": "-at",
    "onset": "m",
    "rime": "at",
    "tip": "m 闭唇 ➔ mat"
  },
  {
    "id": "rat",
    "word": "rat",
    "phonics": [
      "r",
      "a",
      "t"
    ],
    "ipa": "/ræt/",
    "ipas": [
      "/r/",
      "/æ/",
      "/t/"
    ],
    "cn": "大老鼠",
    "emoji": "🐀",
    "unit": "sa",
    "family": "-at",
    "onset": "r",
    "rime": "at",
    "tip": "r 卷舌 ➔ rat"
  },
  {
    "id": "bag",
    "word": "bag",
    "phonics": [
      "b",
      "a",
      "g"
    ],
    "ipa": "/bæɡ/",
    "ipas": [
      "/b/",
      "/æ/",
      "/ɡ/"
    ],
    "cn": "书包/包",
    "emoji": "🎒",
    "unit": "sa",
    "family": "-ag",
    "onset": "b",
    "rime": "ag",
    "tip": "b + ag ➔ bag"
  },
  {
    "id": "tag",
    "word": "tag",
    "phonics": [
      "t",
      "a",
      "g"
    ],
    "ipa": "/tæɡ/",
    "ipas": [
      "/t/",
      "/æ/",
      "/ɡ/"
    ],
    "cn": "标签",
    "emoji": "🏷️",
    "unit": "sa",
    "family": "-ag",
    "onset": "t",
    "rime": "ag",
    "tip": "t 爆破音 ➔ tag"
  },
  {
    "id": "rag",
    "word": "rag",
    "phonics": [
      "r",
      "a",
      "g"
    ],
    "ipa": "/ræɡ/",
    "ipas": [
      "/r/",
      "/æ/",
      "/ɡ/"
    ],
    "cn": "抹布/破布",
    "emoji": "🧻",
    "unit": "sa",
    "family": "-ag",
    "onset": "r",
    "rime": "ag",
    "tip": "r + ag ➔ rag"
  },
  {
    "id": "dad",
    "word": "dad",
    "phonics": [
      "d",
      "a",
      "d"
    ],
    "ipa": "/dæd/",
    "ipas": [
      "/d/",
      "/æ/",
      "/d/"
    ],
    "cn": "爸爸",
    "emoji": "👨",
    "unit": "sa",
    "family": "-ad",
    "onset": "d",
    "rime": "ad",
    "tip": "首尾都是 d ➔ dad"
  },
  {
    "id": "bad",
    "word": "bad",
    "phonics": [
      "b",
      "a",
      "d"
    ],
    "ipa": "/bæd/",
    "ipas": [
      "/b/",
      "/æ/",
      "/d/"
    ],
    "cn": "坏的/差的",
    "emoji": "👎",
    "unit": "sa",
    "family": "-ad",
    "onset": "b",
    "rime": "ad",
    "tip": "b + ad ➔ bad"
  },
  {
    "id": "sad",
    "word": "sad",
    "phonics": [
      "s",
      "a",
      "d"
    ],
    "ipa": "/sæd/",
    "ipas": [
      "/s/",
      "/æ/",
      "/d/"
    ],
    "cn": "难过的",
    "emoji": "😢",
    "unit": "sa",
    "family": "-ad",
    "onset": "s",
    "rime": "ad",
    "tip": "s 吐气 + ad ➔ sad"
  },
  {
    "id": "pan",
    "word": "pan",
    "phonics": [
      "p",
      "a",
      "n"
    ],
    "ipa": "/pæn/",
    "ipas": [
      "/p/",
      "/æ/",
      "/n/"
    ],
    "cn": "平底锅",
    "emoji": "🍳",
    "unit": "sa",
    "family": "-an",
    "onset": "p",
    "rime": "an",
    "tip": "p 爆破气流 ➔ pan"
  },
  {
    "id": "can",
    "word": "can",
    "phonics": [
      "c",
      "a",
      "n"
    ],
    "ipa": "/kæn/",
    "ipas": [
      "/k/",
      "/æ/",
      "/n/"
    ],
    "cn": "易拉罐/能",
    "emoji": "🥫",
    "unit": "sa",
    "family": "-an",
    "onset": "c",
    "rime": "an",
    "tip": "c 发 /k/ ➔ can"
  },
  {
    "id": "fan",
    "word": "fan",
    "phonics": [
      "f",
      "a",
      "n"
    ],
    "ipa": "/fæn/",
    "ipas": [
      "/f/",
      "/æ/",
      "/n/"
    ],
    "cn": "风扇/扇子",
    "emoji": "🪭",
    "unit": "sa",
    "family": "-an",
    "onset": "f",
    "rime": "an",
    "tip": "f 咬唇 + an ➔ fan"
  },
  {
    "id": "man",
    "word": "man",
    "phonics": [
      "m",
      "a",
      "n"
    ],
    "ipa": "/mæn/",
    "ipas": [
      "/m/",
      "/æ/",
      "/n/"
    ],
    "cn": "男人",
    "emoji": "👨",
    "unit": "sa",
    "family": "-an",
    "onset": "m",
    "rime": "an",
    "tip": "m + an ➔ man"
  },
  {
    "id": "cap",
    "word": "cap",
    "phonics": [
      "c",
      "a",
      "p"
    ],
    "ipa": "/kæp/",
    "ipas": [
      "/k/",
      "/æ/",
      "/p/"
    ],
    "cn": "帽子/鸭舌帽",
    "emoji": "🧢",
    "unit": "sa",
    "family": "-ap",
    "onset": "c",
    "rime": "ap",
    "tip": "c + ap ➔ cap"
  },
  {
    "id": "map",
    "word": "map",
    "phonics": [
      "m",
      "a",
      "p"
    ],
    "ipa": "/mæp/",
    "ipas": [
      "/m/",
      "/æ/",
      "/p/"
    ],
    "cn": "地图",
    "emoji": "🗺️",
    "unit": "sa",
    "family": "-ap",
    "onset": "m",
    "rime": "ap",
    "tip": "m + ap ➔ map"
  },
  {
    "id": "hand",
    "word": "hand",
    "phonics": [
      "h",
      "a",
      "n",
      "d"
    ],
    "ipa": "/hænd/",
    "ipas": [
      "/h/",
      "/æ/",
      "/n/",
      "/d/"
    ],
    "cn": "手",
    "emoji": "✋",
    "unit": "sa",
    "family": "-and",
    "onset": "h",
    "rime": "and",
    "tip": "3B Unit 1 课本核心词"
  },
  {
    "id": "pen",
    "word": "pen",
    "phonics": [
      "p",
      "e",
      "n"
    ],
    "ipa": "/pɛn/",
    "ipas": [
      "/p/",
      "/e/",
      "/n/"
    ],
    "cn": "钢笔",
    "emoji": "🖊️",
    "unit": "se",
    "family": "-en",
    "onset": "p",
    "rime": "en",
    "tip": "短元音 e 嘴张开一指宽，发 /e/"
  },
  {
    "id": "ten",
    "word": "ten",
    "phonics": [
      "t",
      "e",
      "n"
    ],
    "ipa": "/tɛn/",
    "ipas": [
      "/t/",
      "/e/",
      "/n/"
    ],
    "cn": "数字十",
    "emoji": "🔟",
    "unit": "se",
    "family": "-en",
    "onset": "t",
    "rime": "en",
    "tip": "t 碰到 en ➔ ten"
  },
  {
    "id": "hen",
    "word": "hen",
    "phonics": [
      "h",
      "e",
      "n"
    ],
    "ipa": "/hɛn/",
    "ipas": [
      "/h/",
      "/e/",
      "/n/"
    ],
    "cn": "母鸡",
    "emoji": "🐔",
    "unit": "se",
    "family": "-en",
    "onset": "h",
    "rime": "en",
    "tip": "h 哈气 ➔ hen"
  },
  {
    "id": "men",
    "word": "men",
    "phonics": [
      "m",
      "e",
      "n"
    ],
    "ipa": "/mɛn/",
    "ipas": [
      "/m/",
      "/e/",
      "/n/"
    ],
    "cn": "男人们",
    "emoji": "👨‍🦱",
    "unit": "se",
    "family": "-en",
    "onset": "m",
    "rime": "en",
    "tip": "man 的复数形式"
  },
  {
    "id": "den",
    "word": "den",
    "phonics": [
      "d",
      "e",
      "n"
    ],
    "ipa": "/dɛn/",
    "ipas": [
      "/d/",
      "/e/",
      "/n/"
    ],
    "cn": "兽穴/窝",
    "emoji": "🐻",
    "unit": "se",
    "family": "-en",
    "onset": "d",
    "rime": "en",
    "tip": "d + en ➔ den"
  },
  {
    "id": "leg",
    "word": "leg",
    "phonics": [
      "l",
      "e",
      "g"
    ],
    "ipa": "/lɛɡ/",
    "ipas": [
      "/l/",
      "/e/",
      "/ɡ/"
    ],
    "cn": "腿",
    "emoji": "🦵",
    "unit": "se",
    "family": "-eg",
    "onset": "l",
    "rime": "eg",
    "tip": "l 舌尖顶上齿龈 ➔ leg"
  },
  {
    "id": "peg",
    "word": "peg",
    "phonics": [
      "p",
      "e",
      "g"
    ],
    "ipa": "/pɛɡ/",
    "ipas": [
      "/p/",
      "/e/",
      "/ɡ/"
    ],
    "cn": "木夹/衣夹",
    "emoji": "🪵",
    "unit": "se",
    "family": "-eg",
    "onset": "p",
    "rime": "eg",
    "tip": "p + eg ➔ peg"
  },
  {
    "id": "red",
    "word": "red",
    "phonics": [
      "r",
      "e",
      "d"
    ],
    "ipa": "/rɛd/",
    "ipas": [
      "/r/",
      "/e/",
      "/d/"
    ],
    "cn": "红色",
    "emoji": "🔴",
    "unit": "se",
    "family": "-ed",
    "onset": "r",
    "rime": "ed",
    "tip": "r 卷舌 ➔ red"
  },
  {
    "id": "bed",
    "word": "bed",
    "phonics": [
      "b",
      "e",
      "d"
    ],
    "ipa": "/bɛd/",
    "ipas": [
      "/b/",
      "/e/",
      "/d/"
    ],
    "cn": "小床",
    "emoji": "🛏️",
    "unit": "se",
    "family": "-ed",
    "onset": "b",
    "rime": "ed",
    "tip": "b 双唇碰 ➔ bed"
  },
  {
    "id": "pet",
    "word": "pet",
    "phonics": [
      "p",
      "e",
      "t"
    ],
    "ipa": "/pɛt/",
    "ipas": [
      "/p/",
      "/e/",
      "/t/"
    ],
    "cn": "宠物",
    "emoji": "🐶",
    "unit": "se",
    "family": "-et",
    "onset": "p",
    "rime": "et",
    "tip": "p 爆破 + et ➔ pet"
  },
  {
    "id": "net",
    "word": "net",
    "phonics": [
      "n",
      "e",
      "t"
    ],
    "ipa": "/nɛt/",
    "ipas": [
      "/n/",
      "/e/",
      "/t/"
    ],
    "cn": "网",
    "emoji": "🕸️",
    "unit": "se",
    "family": "-et",
    "onset": "n",
    "rime": "et",
    "tip": "n 鼻音 ➔ net"
  },
  {
    "id": "wet",
    "word": "wet",
    "phonics": [
      "w",
      "e",
      "t"
    ],
    "ipa": "/wɛt/",
    "ipas": [
      "/w/",
      "/e/",
      "/t/"
    ],
    "cn": "湿的",
    "emoji": "💧",
    "unit": "se",
    "family": "-et",
    "onset": "w",
    "rime": "et",
    "tip": "w 嘟嘴 + et ➔ wet"
  },
  {
    "id": "jet",
    "word": "jet",
    "phonics": [
      "j",
      "e",
      "t"
    ],
    "ipa": "/dʒɛt/",
    "ipas": [
      "/dʒ/",
      "/e/",
      "/t/"
    ],
    "cn": "喷气式飞机",
    "emoji": "✈️",
    "unit": "se",
    "family": "-et",
    "onset": "j",
    "rime": "et",
    "tip": "j + et ➔ jet"
  },
  {
    "id": "vet",
    "word": "vet",
    "phonics": [
      "v",
      "e",
      "t"
    ],
    "ipa": "/vɛt/",
    "ipas": [
      "/v/",
      "/e/",
      "/t/"
    ],
    "cn": "兽医",
    "emoji": "🩺",
    "unit": "se",
    "family": "-et",
    "onset": "v",
    "rime": "et",
    "tip": "v 咬唇震动 ➔ vet"
  },
  {
    "id": "get",
    "word": "get",
    "phonics": [
      "g",
      "e",
      "t"
    ],
    "ipa": "/ɡɛt/",
    "ipas": [
      "/ɡ/",
      "/e/",
      "/t/"
    ],
    "cn": "得到",
    "emoji": "🎁",
    "unit": "se",
    "family": "-et",
    "onset": "g",
    "rime": "et",
    "tip": "g + et ➔ get"
  },
  {
    "id": "bell",
    "word": "bell",
    "phonics": [
      "b",
      "e",
      "ll"
    ],
    "ipa": "/bɛl/",
    "ipas": [
      "/b/",
      "/e/",
      "/l/"
    ],
    "cn": "铃铛",
    "emoji": "🔔",
    "unit": "se",
    "family": "-ell",
    "onset": "b",
    "rime": "ell",
    "tip": "ll 发舌边音 /l/"
  },
  {
    "id": "egg",
    "word": "egg",
    "phonics": [
      "e",
      "gg"
    ],
    "ipa": "/ɛɡ/",
    "ipas": [
      "/e/",
      "/ɡ/"
    ],
    "cn": "鸡蛋",
    "emoji": "🥚",
    "unit": "se",
    "family": "",
    "onset": "",
    "rime": "",
    "tip": "3A 字母 Ee 代表词"
  },
  {
    "id": "pig",
    "word": "pig",
    "phonics": [
      "p",
      "i",
      "g"
    ],
    "ipa": "/pɪɡ/",
    "ipas": [
      "/p/",
      "/ɪ/",
      "/ɡ/"
    ],
    "cn": "小猪",
    "emoji": "🐷",
    "unit": "si",
    "family": "-ig",
    "onset": "p",
    "rime": "ig",
    "tip": "短元音 i 嘴角微向两边，短促发 /ɪ/"
  },
  {
    "id": "big",
    "word": "big",
    "phonics": [
      "b",
      "i",
      "g"
    ],
    "ipa": "/bɪɡ/",
    "ipas": [
      "/b/",
      "/ɪ/",
      "/ɡ/"
    ],
    "cn": "大的",
    "emoji": "🐘",
    "unit": "si",
    "family": "-ig",
    "onset": "b",
    "rime": "ig",
    "tip": "b + ig ➔ big"
  },
  {
    "id": "dig",
    "word": "dig",
    "phonics": [
      "d",
      "i",
      "g"
    ],
    "ipa": "/dɪɡ/",
    "ipas": [
      "/d/",
      "/ɪ/",
      "/ɡ/"
    ],
    "cn": "挖洞",
    "emoji": "⛏️",
    "unit": "si",
    "family": "-ig",
    "onset": "d",
    "rime": "ig",
    "tip": "d 舌尖轻弹 ➔ dig"
  },
  {
    "id": "wig",
    "word": "wig",
    "phonics": [
      "w",
      "i",
      "g"
    ],
    "ipa": "/wɪɡ/",
    "ipas": [
      "/w/",
      "/ɪ/",
      "/ɡ/"
    ],
    "cn": "假发",
    "emoji": "🧑‍🦰",
    "unit": "si",
    "family": "-ig",
    "onset": "w",
    "rime": "ig",
    "tip": "w + ig ➔ wig"
  },
  {
    "id": "six",
    "word": "six",
    "phonics": [
      "s",
      "i",
      "x"
    ],
    "ipa": "/sɪks/",
    "ipas": [
      "/s/",
      "/ɪ/",
      "/ks/"
    ],
    "cn": "数字六",
    "emoji": "6️⃣",
    "unit": "si",
    "family": "-ix",
    "onset": "s",
    "rime": "ix",
    "tip": "x 发 /ks/ ➔ six"
  },
  {
    "id": "pin",
    "word": "pin",
    "phonics": [
      "p",
      "i",
      "n"
    ],
    "ipa": "/pɪn/",
    "ipas": [
      "/p/",
      "/ɪ/",
      "/n/"
    ],
    "cn": "大头针",
    "emoji": "📌",
    "unit": "si",
    "family": "-in",
    "onset": "p",
    "rime": "in",
    "tip": "易混注意：pin vs pen"
  },
  {
    "id": "bin",
    "word": "bin",
    "phonics": [
      "b",
      "i",
      "n"
    ],
    "ipa": "/bɪn/",
    "ipas": [
      "/b/",
      "/ɪ/",
      "/n/"
    ],
    "cn": "垃圾桶/箱",
    "emoji": "🗑️",
    "unit": "si",
    "family": "-in",
    "onset": "b",
    "rime": "in",
    "tip": "b + in ➔ bin"
  },
  {
    "id": "win",
    "word": "win",
    "phonics": [
      "w",
      "i",
      "n"
    ],
    "ipa": "/wɪn/",
    "ipas": [
      "/w/",
      "/ɪ/",
      "/n/"
    ],
    "cn": "获胜/赢",
    "emoji": "🏆",
    "unit": "si",
    "family": "-in",
    "onset": "w",
    "rime": "in",
    "tip": "w + in ➔ win"
  },
  {
    "id": "tin",
    "word": "tin",
    "phonics": [
      "t",
      "i",
      "n"
    ],
    "ipa": "/tɪn/",
    "ipas": [
      "/t/",
      "/ɪ/",
      "/n/"
    ],
    "cn": "铁罐/听头",
    "emoji": "🥫",
    "unit": "si",
    "family": "-in",
    "onset": "t",
    "rime": "in",
    "tip": "t + in ➔ tin"
  },
  {
    "id": "lip",
    "word": "lip",
    "phonics": [
      "l",
      "i",
      "p"
    ],
    "ipa": "/lɪp/",
    "ipas": [
      "/l/",
      "/ɪ/",
      "/p/"
    ],
    "cn": "嘴唇",
    "emoji": "👄",
    "unit": "si",
    "family": "-ip",
    "onset": "l",
    "rime": "ip",
    "tip": "l 顶牙龈 ➔ lip"
  },
  {
    "id": "zip",
    "word": "zip",
    "phonics": [
      "z",
      "i",
      "p"
    ],
    "ipa": "/zɪp/",
    "ipas": [
      "/z/",
      "/ɪ/",
      "/p/"
    ],
    "cn": "拉链",
    "emoji": "🤐",
    "unit": "si",
    "family": "-ip",
    "onset": "z",
    "rime": "ip",
    "tip": "z 蜜蜂嗡嗡震动 ➔ zip"
  },
  {
    "id": "tip",
    "word": "tip",
    "phonics": [
      "t",
      "i",
      "p"
    ],
    "ipa": "/tɪp/",
    "ipas": [
      "/t/",
      "/ɪ/",
      "/p/"
    ],
    "cn": "顶端/提示",
    "emoji": "💡",
    "unit": "si",
    "family": "-ip",
    "onset": "t",
    "rime": "ip",
    "tip": "t + ip ➔ tip"
  },
  {
    "id": "sit",
    "word": "sit",
    "phonics": [
      "s",
      "i",
      "t"
    ],
    "ipa": "/sɪt/",
    "ipas": [
      "/s/",
      "/ɪ/",
      "/t/"
    ],
    "cn": "坐下",
    "emoji": "🪑",
    "unit": "si",
    "family": "-it",
    "onset": "s",
    "rime": "it",
    "tip": "s + it ➔ sit"
  },
  {
    "id": "hit",
    "word": "hit",
    "phonics": [
      "h",
      "i",
      "t"
    ],
    "ipa": "/hɪt/",
    "ipas": [
      "/h/",
      "/ɪ/",
      "/t/"
    ],
    "cn": "击打",
    "emoji": "🏏",
    "unit": "si",
    "family": "-it",
    "onset": "h",
    "rime": "it",
    "tip": "h + it ➔ hit"
  },
  {
    "id": "fit",
    "word": "fit",
    "phonics": [
      "f",
      "i",
      "t"
    ],
    "ipa": "/fɪt/",
    "ipas": [
      "/f/",
      "/ɪ/",
      "/t/"
    ],
    "cn": "合身",
    "emoji": "👕",
    "unit": "si",
    "family": "-it",
    "onset": "f",
    "rime": "it",
    "tip": "f + it ➔ fit"
  },
  {
    "id": "kid",
    "word": "kid",
    "phonics": [
      "k",
      "i",
      "d"
    ],
    "ipa": "/kɪd/",
    "ipas": [
      "/k/",
      "/ɪ/",
      "/d/"
    ],
    "cn": "小孩",
    "emoji": "🧒",
    "unit": "si",
    "family": "-id",
    "onset": "k",
    "rime": "id",
    "tip": "k + id ➔ kid"
  },
  {
    "id": "lid",
    "word": "lid",
    "phonics": [
      "l",
      "i",
      "d"
    ],
    "ipa": "/lɪd/",
    "ipas": [
      "/l/",
      "/ɪ/",
      "/d/"
    ],
    "cn": "锅盖",
    "emoji": "🍲",
    "unit": "si",
    "family": "-id",
    "onset": "l",
    "rime": "id",
    "tip": "l + id ➔ lid"
  },
  {
    "id": "milk",
    "word": "milk",
    "phonics": [
      "m",
      "i",
      "l",
      "k"
    ],
    "ipa": "/mɪlk/",
    "ipas": [
      "/m/",
      "/ɪ/",
      "/l/",
      "/k/"
    ],
    "cn": "牛奶",
    "emoji": "🥛",
    "unit": "si",
    "family": "-ilk",
    "onset": "m",
    "rime": "ilk",
    "tip": "3B Unit 3 核心词"
  },
  {
    "id": "dog",
    "word": "dog",
    "phonics": [
      "d",
      "o",
      "g"
    ],
    "ipa": "/dɒɡ/",
    "ipas": [
      "/d/",
      "/ɒ/",
      "/ɡ/"
    ],
    "cn": "小狗",
    "emoji": "🐶",
    "unit": "so",
    "family": "-og",
    "onset": "d",
    "rime": "og",
    "tip": "短元音 o 口形圆圆，短促发 /ɒ/"
  },
  {
    "id": "log",
    "word": "log",
    "phonics": [
      "l",
      "o",
      "g"
    ],
    "ipa": "/lɒɡ/",
    "ipas": [
      "/l/",
      "/ɒ/",
      "/ɡ/"
    ],
    "cn": "圆木",
    "emoji": "🪵",
    "unit": "so",
    "family": "-og",
    "onset": "l",
    "rime": "og",
    "tip": "l + og ➔ log"
  },
  {
    "id": "fog",
    "word": "fog",
    "phonics": [
      "f",
      "o",
      "g"
    ],
    "ipa": "/fɒɡ/",
    "ipas": [
      "/f/",
      "/ɒ/",
      "/ɡ/"
    ],
    "cn": "大雾",
    "emoji": "🌫️",
    "unit": "so",
    "family": "-og",
    "onset": "f",
    "rime": "og",
    "tip": "f + og ➔ fog"
  },
  {
    "id": "box",
    "word": "box",
    "phonics": [
      "b",
      "o",
      "x"
    ],
    "ipa": "/bɒks/",
    "ipas": [
      "/b/",
      "/ɒ/",
      "/ks/"
    ],
    "cn": "盒子/箱子",
    "emoji": "📦",
    "unit": "so",
    "family": "-ox",
    "onset": "b",
    "rime": "ox",
    "tip": "x 包含 /ks/ ➔ box"
  },
  {
    "id": "fox",
    "word": "fox",
    "phonics": [
      "f",
      "o",
      "x"
    ],
    "ipa": "/fɒks/",
    "ipas": [
      "/f/",
      "/ɒ/",
      "/ks/"
    ],
    "cn": "狐狸",
    "emoji": "🦊",
    "unit": "so",
    "family": "-ox",
    "onset": "f",
    "rime": "ox",
    "tip": "f + ox ➔ fox"
  },
  {
    "id": "ox",
    "word": "ox",
    "phonics": [
      "o",
      "x"
    ],
    "ipa": "/ɒks/",
    "ipas": [
      "/ɒ/",
      "/ks/"
    ],
    "cn": "公牛",
    "emoji": "🐂",
    "unit": "so",
    "family": "-ox",
    "onset": "",
    "rime": "ox",
    "tip": "短元音 o + x ➔ ox"
  },
  {
    "id": "hot",
    "word": "hot",
    "phonics": [
      "h",
      "o",
      "t"
    ],
    "ipa": "/hɒt/",
    "ipas": [
      "/h/",
      "/ɒ/",
      "/t/"
    ],
    "cn": "热的",
    "emoji": "🔥",
    "unit": "so",
    "family": "-ot",
    "onset": "h",
    "rime": "ot",
    "tip": "h + ot ➔ hot"
  },
  {
    "id": "pot",
    "word": "pot",
    "phonics": [
      "p",
      "o",
      "t"
    ],
    "ipa": "/pɒt/",
    "ipas": [
      "/p/",
      "/ɒ/",
      "/t/"
    ],
    "cn": "锅/罐",
    "emoji": "🍲",
    "unit": "so",
    "family": "-ot",
    "onset": "p",
    "rime": "ot",
    "tip": "p + ot ➔ pot"
  },
  {
    "id": "dot",
    "word": "dot",
    "phonics": [
      "d",
      "o",
      "t"
    ],
    "ipa": "/dɒt/",
    "ipas": [
      "/d/",
      "/ɒ/",
      "/t/"
    ],
    "cn": "圆点",
    "emoji": "⚫",
    "unit": "so",
    "family": "-ot",
    "onset": "d",
    "rime": "ot",
    "tip": "d + ot ➔ dot"
  },
  {
    "id": "lot",
    "word": "lot",
    "phonics": [
      "l",
      "o",
      "t"
    ],
    "ipa": "/lɒt/",
    "ipas": [
      "/l/",
      "/ɒ/",
      "/t/"
    ],
    "cn": "很多/批次",
    "emoji": "📦",
    "unit": "so",
    "family": "-ot",
    "onset": "l",
    "rime": "ot",
    "tip": "l + ot ➔ lot"
  },
  {
    "id": "not",
    "word": "not",
    "phonics": [
      "n",
      "o",
      "t"
    ],
    "ipa": "/nɒt/",
    "ipas": [
      "/n/",
      "/ɒ/",
      "/t/"
    ],
    "cn": "不/不是",
    "emoji": "❌",
    "unit": "so",
    "family": "-ot",
    "onset": "n",
    "rime": "ot",
    "tip": "n + ot ➔ not"
  },
  {
    "id": "mop",
    "word": "mop",
    "phonics": [
      "m",
      "o",
      "p"
    ],
    "ipa": "/mɒp/",
    "ipas": [
      "/m/",
      "/ɒ/",
      "/p/"
    ],
    "cn": "拖把",
    "emoji": "🧹",
    "unit": "so",
    "family": "-op",
    "onset": "m",
    "rime": "op",
    "tip": "m + op ➔ mop"
  },
  {
    "id": "top",
    "word": "top",
    "phonics": [
      "t",
      "o",
      "p"
    ],
    "ipa": "/tɒp/",
    "ipas": [
      "/t/",
      "/ɒ/",
      "/p/"
    ],
    "cn": "顶部/陀螺",
    "emoji": "🔝",
    "unit": "so",
    "family": "-op",
    "onset": "t",
    "rime": "op",
    "tip": "t + op ➔ top"
  },
  {
    "id": "hop",
    "word": "hop",
    "phonics": [
      "h",
      "o",
      "p"
    ],
    "ipa": "/hɒp/",
    "ipas": [
      "/h/",
      "/ɒ/",
      "/p/"
    ],
    "cn": "单脚跳",
    "emoji": "🦘",
    "unit": "so",
    "family": "-op",
    "onset": "h",
    "rime": "op",
    "tip": "h + op ➔ hop"
  },
  {
    "id": "body",
    "word": "body",
    "phonics": [
      "b",
      "o",
      "d",
      "y"
    ],
    "ipa": "/ˈbɒdi/",
    "ipas": [
      "/b/",
      "/ɒ/",
      "/d/",
      "/i/"
    ],
    "cn": "身体",
    "emoji": "🧍",
    "unit": "so",
    "family": "",
    "onset": "b",
    "rime": "ody",
    "tip": "PEP 3A 身体重点词"
  },
  {
    "id": "orange",
    "word": "orange",
    "phonics": [
      "o",
      "r",
      "a",
      "n",
      "g",
      "e"
    ],
    "ipa": "/ˈɒrɪndʒ/",
    "ipas": [
      "/ɒ/",
      "/r/",
      "/ɪ/",
      "/n/",
      "/dʒ/"
    ],
    "cn": "橙子/橙色",
    "emoji": "🍊",
    "unit": "so",
    "family": "",
    "onset": "o",
    "rime": "range",
    "tip": "3B Unit 4 核心词"
  },
  {
    "id": "fun",
    "word": "fun",
    "phonics": [
      "f",
      "u",
      "n"
    ],
    "ipa": "/fʌn/",
    "ipas": [
      "/f/",
      "/ʌ/",
      "/n/"
    ],
    "cn": "乐趣/好玩的",
    "emoji": "🎉",
    "unit": "su",
    "family": "-un",
    "onset": "f",
    "rime": "un",
    "tip": "短元音 u 嘴唇自然放松半开，发 /ʌ/"
  },
  {
    "id": "run",
    "word": "run",
    "phonics": [
      "r",
      "u",
      "n"
    ],
    "ipa": "/rʌn/",
    "ipas": [
      "/r/",
      "/ʌ/",
      "/n/"
    ],
    "cn": "跑步",
    "emoji": "🏃",
    "unit": "su",
    "family": "-un",
    "onset": "r",
    "rime": "un",
    "tip": "r + un ➔ run"
  },
  {
    "id": "sun",
    "word": "sun",
    "phonics": [
      "s",
      "u",
      "n"
    ],
    "ipa": "/sʌn/",
    "ipas": [
      "/s/",
      "/ʌ/",
      "/n/"
    ],
    "cn": "太阳",
    "emoji": "☀️",
    "unit": "su",
    "family": "-un",
    "onset": "s",
    "rime": "un",
    "tip": "s 吐气 ➔ sun"
  },
  {
    "id": "bun",
    "word": "bun",
    "phonics": [
      "b",
      "u",
      "n"
    ],
    "ipa": "/bʌn/",
    "ipas": [
      "/b/",
      "/ʌ/",
      "/n/"
    ],
    "cn": "小圆面包",
    "emoji": "🍞",
    "unit": "su",
    "family": "-un",
    "onset": "b",
    "rime": "un",
    "tip": "b + un ➔ bun"
  },
  {
    "id": "bug",
    "word": "bug",
    "phonics": [
      "b",
      "u",
      "g"
    ],
    "ipa": "/bʌɡ/",
    "ipas": [
      "/b/",
      "/ʌ/",
      "/ɡ/"
    ],
    "cn": "小虫子",
    "emoji": "🐛",
    "unit": "su",
    "family": "-ug",
    "onset": "b",
    "rime": "ug",
    "tip": "b + ug ➔ bug"
  },
  {
    "id": "mug",
    "word": "mug",
    "phonics": [
      "m",
      "u",
      "g"
    ],
    "ipa": "/mʌɡ/",
    "ipas": [
      "/m/",
      "/ʌ/",
      "/ɡ/"
    ],
    "cn": "马克杯",
    "emoji": "🍺",
    "unit": "su",
    "family": "-ug",
    "onset": "m",
    "rime": "ug",
    "tip": "m 闭唇 ➔ mug"
  },
  {
    "id": "hug",
    "word": "hug",
    "phonics": [
      "h",
      "u",
      "g"
    ],
    "ipa": "/hʌɡ/",
    "ipas": [
      "/h/",
      "/ʌ/",
      "/ɡ/"
    ],
    "cn": "拥抱",
    "emoji": "🤗",
    "unit": "su",
    "family": "-ug",
    "onset": "h",
    "rime": "ug",
    "tip": "h + ug ➔ hug"
  },
  {
    "id": "jug",
    "word": "jug",
    "phonics": [
      "j",
      "u",
      "g"
    ],
    "ipa": "/dʒʌɡ/",
    "ipas": [
      "/dʒ/",
      "/ʌ/",
      "/ɡ/"
    ],
    "cn": "大水壶/罐子",
    "emoji": "🏺",
    "unit": "su",
    "family": "-ug",
    "onset": "j",
    "rime": "ug",
    "tip": "j + ug ➔ jug"
  },
  {
    "id": "cup",
    "word": "cup",
    "phonics": [
      "c",
      "u",
      "p"
    ],
    "ipa": "/kʌp/",
    "ipas": [
      "/k/",
      "/ʌ/",
      "/p/"
    ],
    "cn": "杯子",
    "emoji": "🥤",
    "unit": "su",
    "family": "-up",
    "onset": "c",
    "rime": "up",
    "tip": "易混注意：cup vs cap"
  },
  {
    "id": "pup",
    "word": "pup",
    "phonics": [
      "p",
      "u",
      "p"
    ],
    "ipa": "/pʌp/",
    "ipas": [
      "/p/",
      "/ʌ/",
      "/p/"
    ],
    "cn": "小狗幼崽",
    "emoji": "🐶",
    "unit": "su",
    "family": "-up",
    "onset": "p",
    "rime": "up",
    "tip": "p + up ➔ pup"
  },
  {
    "id": "bus",
    "word": "bus",
    "phonics": [
      "b",
      "u",
      "s"
    ],
    "ipa": "/bʌs/",
    "ipas": [
      "/b/",
      "/ʌ/",
      "/s/"
    ],
    "cn": "公共汽车",
    "emoji": "🚌",
    "unit": "su",
    "family": "-us",
    "onset": "b",
    "rime": "us",
    "tip": "b + us ➔ bus"
  },
  {
    "id": "nut",
    "word": "nut",
    "phonics": [
      "n",
      "u",
      "t"
    ],
    "ipa": "/nʌt/",
    "ipas": [
      "/n/",
      "/ʌ/",
      "/t/"
    ],
    "cn": "坚果",
    "emoji": "🥜",
    "unit": "su",
    "family": "-ut",
    "onset": "n",
    "rime": "ut",
    "tip": "n + ut ➔ nut"
  },
  {
    "id": "hut",
    "word": "hut",
    "phonics": [
      "h",
      "u",
      "t"
    ],
    "ipa": "/hʌt/",
    "ipas": [
      "/h/",
      "/ʌ/",
      "/t/"
    ],
    "cn": "小木屋/茅舍",
    "emoji": "🛖",
    "unit": "su",
    "family": "-ut",
    "onset": "h",
    "rime": "ut",
    "tip": "h + ut ➔ hut"
  },
  {
    "id": "cut",
    "word": "cut",
    "phonics": [
      "c",
      "u",
      "t"
    ],
    "ipa": "/kʌt/",
    "ipas": [
      "/k/",
      "/ʌ/",
      "/t/"
    ],
    "cn": "剪/切",
    "emoji": "✂️",
    "unit": "su",
    "family": "-ut",
    "onset": "c",
    "rime": "ut",
    "tip": "c + ut ➔ cut"
  },
  {
    "id": "tub",
    "word": "tub",
    "phonics": [
      "t",
      "u",
      "b"
    ],
    "ipa": "/tʌb/",
    "ipas": [
      "/t/",
      "/ʌ/",
      "/b/"
    ],
    "cn": "浴缸/木盆",
    "emoji": "🛁",
    "unit": "su",
    "family": "-ub",
    "onset": "t",
    "rime": "ub",
    "tip": "t + ub ➔ tub"
  },
  {
    "id": "duck",
    "word": "duck",
    "phonics": [
      "d",
      "u",
      "ck"
    ],
    "ipa": "/dʌk/",
    "ipas": [
      "/d/",
      "/ʌ/",
      "/k/"
    ],
    "cn": "鸭子",
    "emoji": "🦆",
    "unit": "su",
    "family": "-uck",
    "onset": "d",
    "rime": "uck",
    "tip": "ck 组合发 /k/"
  }
];

  var UNITS = {
  "u1": {
    "label": "🤝 3A Unit 1 · Making friends",
    "desc": "交友礼仪 · 自我介绍 · 倾听与分享 (17词)",
    "cat": "textbook_2024",
    "grade": "3A"
  },
  "u2": {
    "label": "👨‍👩‍👧‍👦 3A Unit 2 · Different families",
    "desc": "认识家人 · 亲戚称谓 · 家庭的爱 (20词)",
    "cat": "textbook_2024",
    "grade": "3A"
  },
  "u3": {
    "label": "🐼 3A Unit 3 · Amazing animals",
    "desc": "可爱萌宠 · 野生动物 · 奇妙特征 (20词)",
    "cat": "textbook_2024",
    "grade": "3A"
  },
  "u4": {
    "label": "🍎 3A Unit 4 · Plants around us",
    "desc": "新鲜水果 · 自然植物 · 呵护花草 (19词)",
    "cat": "textbook_2024",
    "grade": "3A"
  },
  "u5": {
    "label": "🎨 3A Unit 5 · The colourful world",
    "desc": "绚丽色彩 · 调色魔法 · 缤纷世界 (16词)",
    "cat": "textbook_2024",
    "grade": "3A"
  },
  "u6": {
    "label": "🔢 3A Unit 6 · Useful numbers",
    "desc": "生活数字 · 年龄时间 · 生日切蛋糕 (16词)",
    "cat": "textbook_2024",
    "grade": "3A"
  },
  "sa": {
    "label": "🌱 拼读专项 · 短元音 a /æ/",
    "desc": "cat, bag, dad, hand, map, pan... 嘴张两指宽",
    "cat": "phonics"
  },
  "se": {
    "label": "🌿 拼读专项 · 短元音 e /e/",
    "desc": "pen, ten, leg, red, bed, pet... 微笑开口一指宽",
    "cat": "phonics"
  },
  "si": {
    "label": "🌾 拼读专项 · 短元音 i /ɪ/",
    "desc": "big, pig, six, fish, win, sit... 短促清脆",
    "cat": "phonics"
  },
  "so": {
    "label": "🍁 拼读专项 · 短元音 o /ɒ/",
    "desc": "dog, box, fox, hot, pot, orange... 嘴巴圆圆",
    "cat": "phonics"
  },
  "su": {
    "label": "🌻 拼读专项 · 短元音 u /ʌ/",
    "desc": "sun, duck, run, fun, cut, cup... 短促轻快",
    "cat": "phonics"
  }
};;

  var MINIMAL_PAIRS = [
  {
    "a": "bag",
    "b": "beg",
    "target": "bag",
    "audioText": "bag",
    "tip": "仔细听：bag (/æ/ 大嘴) 还是 beg (/e/ 小嘴)？"
  },
  {
    "a": "pan",
    "b": "pen",
    "target": "pen",
    "audioText": "pen",
    "tip": "仔细听：pan (/æ/ 锅) 还是 pen (/e/ 钢笔)？"
  },
  {
    "a": "bad",
    "b": "bed",
    "target": "bed",
    "audioText": "bed",
    "tip": "仔细听：bad (/æ/ 坏) 还是 bed (/e/ 床)？"
  },
  {
    "a": "bat",
    "b": "bet",
    "target": "bat",
    "audioText": "bat",
    "tip": "仔细听：bat (/æ/ 蝙蝠) 还是 bet (/e/ 打赌)？"
  },
  {
    "a": "man",
    "b": "men",
    "target": "man",
    "audioText": "man",
    "tip": "仔细听：man (单数男人) 还是 men (复数男人们)？"
  },
  {
    "a": "pat",
    "b": "pet",
    "target": "pet",
    "audioText": "pet",
    "tip": "仔细听：pat (/æ/ 轻拍) 还是 pet (/e/ 宠物)？"
  },
  {
    "a": "tan",
    "b": "ten",
    "target": "ten",
    "audioText": "ten",
    "tip": "仔细听：tan (晒黑) 还是 ten (/e/ 数字十)？"
  },
  {
    "a": "mat",
    "b": "met",
    "target": "mat",
    "audioText": "mat",
    "tip": "仔细听：mat (/æ/ 垫子) 还是 met (/e/ 遇见)？"
  },
  {
    "a": "pin",
    "b": "pen",
    "target": "pin",
    "audioText": "pin",
    "tip": "仔细听：pin (/ɪ/ 别针) 还是 pen (/e/ 钢笔)？"
  },
  {
    "a": "bed",
    "b": "bid",
    "target": "bed",
    "audioText": "bed",
    "tip": "仔细听：bed (/e/ 床) 还是 bid (/ɪ/ 出价)？"
  },
  {
    "a": "ten",
    "b": "tin",
    "target": "ten",
    "audioText": "ten",
    "tip": "仔细听：ten (/e/ 数字十) 还是 tin (/ɪ/ 铁罐)？"
  },
  {
    "a": "pet",
    "b": "pit",
    "target": "pet",
    "audioText": "pet",
    "tip": "仔细听：pet (/e/ 宠物) 还是 pit (/ɪ/ 深坑)？"
  },
  {
    "a": "net",
    "b": "knit",
    "target": "net",
    "audioText": "net",
    "tip": "仔细听：net (/e/ 渔网) 还是 knit (/ɪ/ 编织)？"
  },
  {
    "a": "bell",
    "b": "bill",
    "target": "bell",
    "audioText": "bell",
    "tip": "仔细听：bell (/e/ 铃铛) 还是 bill (/ɪ/ 账单)？"
  },
  {
    "a": "set",
    "b": "sit",
    "target": "sit",
    "audioText": "sit",
    "tip": "仔细听：set (/e/ 放置) 还是 sit (/ɪ/ 坐下)？"
  },
  {
    "a": "big",
    "b": "bag",
    "target": "big",
    "audioText": "big",
    "tip": "仔细听：big (/ɪ/ 大的) 还是 bag (/æ/ 书包)？"
  },
  {
    "a": "pig",
    "b": "peg",
    "target": "pig",
    "audioText": "pig",
    "tip": "仔细听：pig (/ɪ/ 小猪) 还是 peg (/e/ 木夹)？"
  },
  {
    "a": "six",
    "b": "sax",
    "target": "six",
    "audioText": "six",
    "tip": "仔细听：six (/ɪ/ 数字六) 还是 sax？"
  },
  {
    "a": "hit",
    "b": "hat",
    "target": "hat",
    "audioText": "hat",
    "tip": "仔细听：hit (/ɪ/ 击打) 还是 hat (/æ/ 帽子)？"
  },
  {
    "a": "pin",
    "b": "pan",
    "target": "pan",
    "audioText": "pan",
    "tip": "仔细听：pin (/ɪ/ 别针) 还是 pan (/æ/ 平底锅)？"
  },
  {
    "a": "bin",
    "b": "ban",
    "target": "bin",
    "audioText": "bin",
    "tip": "仔细听：bin (/ɪ/ 垃圾箱) 还是 ban (/æ/ 禁止)？"
  },
  {
    "a": "dog",
    "b": "duck",
    "target": "duck",
    "audioText": "duck",
    "tip": "仔细听：dog (/ɒ/ 狗) 还是 duck (/ʌ/ 鸭子)？"
  },
  {
    "a": "hot",
    "b": "hut",
    "target": "hot",
    "audioText": "hot",
    "tip": "仔细听：hot (/ɒ/ 炎热) 还是 hut (/ʌ/ 茅屋)？"
  },
  {
    "a": "cot",
    "b": "cut",
    "target": "cut",
    "audioText": "cut",
    "tip": "仔细听：cot (/ɒ/ 小床) 还是 cut (/ʌ/ 剪切)？"
  },
  {
    "a": "pot",
    "b": "pup",
    "target": "pot",
    "audioText": "pot",
    "tip": "仔细听：pot (/ɒ/ 罐子) 还是 pup (/ʌ/ 幼犬)？"
  },
  {
    "a": "not",
    "b": "nut",
    "target": "nut",
    "audioText": "nut",
    "tip": "仔细听：not (/ɒ/ 不是) 还是 nut (/ʌ/ 坚果)？"
  },
  {
    "a": "cop",
    "b": "cup",
    "target": "cup",
    "audioText": "cup",
    "tip": "仔细听：cop (/ɒ/ 警察) 还是 cup (/ʌ/ 杯子)？"
  },
  {
    "a": "box",
    "b": "bus",
    "target": "bus",
    "audioText": "bus",
    "tip": "仔细听：box (/ɒ/ 盒子) 还是 bus (/ʌ/ 公交车)？"
  },
  {
    "a": "cap",
    "b": "cup",
    "target": "cup",
    "audioText": "cup",
    "tip": "仔细听：cap (/æ/ 帽子) 还是 cup (/ʌ/ 杯子)？"
  },
  {
    "a": "cat",
    "b": "cut",
    "target": "cat",
    "audioText": "cat",
    "tip": "仔细听：cat (/æ/ 小猫) 还是 cut (/ʌ/ 切割)？"
  },
  {
    "a": "hat",
    "b": "hut",
    "target": "hat",
    "audioText": "hat",
    "tip": "仔细听：hat (/æ/ 帽子) 还是 hut (/ʌ/ 茅舍)？"
  },
  {
    "a": "bag",
    "b": "bug",
    "target": "bug",
    "audioText": "bug",
    "tip": "仔细听：bag (/æ/ 书包) 还是 bug (/ʌ/ 虫子)？"
  },
  {
    "a": "rag",
    "b": "rug",
    "target": "rug",
    "audioText": "rug",
    "tip": "仔细听：rag (/æ/ 破布) 还是 rug (/ʌ/ 地毯)？"
  },
  {
    "a": "bat",
    "b": "but",
    "target": "bat",
    "audioText": "bat",
    "tip": "仔细听：bat (/æ/ 蝙蝠) 还是 but (/ʌ/ 但是)？"
  },
  {
    "a": "fan",
    "b": "fun",
    "target": "fun",
    "audioText": "fun",
    "tip": "仔细听：fan (/æ/ 风扇) 还是 fun (/ʌ/ 乐趣)？"
  },
  {
    "a": "hot",
    "b": "hat",
    "target": "hot",
    "audioText": "hot",
    "tip": "仔细听：hot (/ɒ/ 炎热) 还是 hat (/æ/ 帽子)？"
  },
  {
    "a": "pot",
    "b": "pat",
    "target": "pot",
    "audioText": "pot",
    "tip": "仔细听：pot (/ɒ/ 锅罐) 还是 pat (/æ/ 轻拍)？"
  },
  {
    "a": "top",
    "b": "tap",
    "target": "top",
    "audioText": "top",
    "tip": "仔细听：top (/ɒ/ 顶部) 还是 tap (/æ/ 水龙头)？"
  },
  {
    "a": "fox",
    "b": "fix",
    "target": "fox",
    "audioText": "fox",
    "tip": "仔细听：fox (/ɒ/ 狐狸) 还是 fix (/ɪ/ 修理)？"
  }
];

  var WORD_FAMILIES = [
  {
    "id": "-at",
    "vowel": "a",
    "label": "-at 家族",
    "rime": "at",
    "rimeIpa": "/æt/",
    "onsets": [
      {
        "onset": "c",
        "word": "cat",
        "cn": "小猫",
        "emoji": "🐱"
      },
      {
        "onset": "b",
        "word": "bat",
        "cn": "蝙蝠/球棒",
        "emoji": "🦇"
      },
      {
        "onset": "h",
        "word": "hat",
        "cn": "帽子",
        "emoji": "🎩"
      },
      {
        "onset": "f",
        "word": "fat",
        "cn": "胖的",
        "emoji": "🐷"
      },
      {
        "onset": "m",
        "word": "mat",
        "cn": "垫子",
        "emoji": "🧘"
      },
      {
        "onset": "r",
        "word": "rat",
        "cn": "大老鼠",
        "emoji": "🐀"
      },
      {
        "onset": "s",
        "word": "sat",
        "cn": "坐下(过去式)",
        "emoji": "🪑"
      },
      {
        "onset": "p",
        "word": "pat",
        "cn": "轻拍",
        "emoji": "👋"
      }
    ]
  },
  {
    "id": "-an",
    "vowel": "a",
    "label": "-an 家族",
    "rime": "an",
    "rimeIpa": "/æn/",
    "onsets": [
      {
        "onset": "p",
        "word": "pan",
        "cn": "平底锅",
        "emoji": "🍳"
      },
      {
        "onset": "c",
        "word": "can",
        "cn": "易拉罐/能",
        "emoji": "🥫"
      },
      {
        "onset": "f",
        "word": "fan",
        "cn": "风扇/扇子",
        "emoji": "🪭"
      },
      {
        "onset": "m",
        "word": "man",
        "cn": "男人",
        "emoji": "👨"
      },
      {
        "onset": "v",
        "word": "van",
        "cn": "货车/面包车",
        "emoji": "🚐"
      },
      {
        "onset": "r",
        "word": "ran",
        "cn": "跑(过去式)",
        "emoji": "🏃"
      }
    ]
  },
  {
    "id": "-ag",
    "vowel": "a",
    "label": "-ag 家族",
    "rime": "ag",
    "rimeIpa": "/æɡ/",
    "onsets": [
      {
        "onset": "b",
        "word": "bag",
        "cn": "书包/提包",
        "emoji": "🎒"
      },
      {
        "onset": "t",
        "word": "tag",
        "cn": "标签",
        "emoji": "🏷️"
      },
      {
        "onset": "r",
        "word": "rag",
        "cn": "抹布/破布",
        "emoji": "🧻"
      },
      {
        "onset": "w",
        "word": "wag",
        "cn": "摇尾巴",
        "emoji": "🐕"
      }
    ]
  },
  {
    "id": "-ad",
    "vowel": "a",
    "label": "-ad 家族",
    "rime": "ad",
    "rimeIpa": "/æd/",
    "onsets": [
      {
        "onset": "d",
        "word": "dad",
        "cn": "爸爸",
        "emoji": "👨"
      },
      {
        "onset": "b",
        "word": "bad",
        "cn": "坏的/差的",
        "emoji": "👎"
      },
      {
        "onset": "m",
        "word": "mad",
        "cn": "生气的/疯狂的",
        "emoji": "😡"
      },
      {
        "onset": "s",
        "word": "sad",
        "cn": "难过的/悲伤的",
        "emoji": "😢"
      },
      {
        "onset": "p",
        "word": "pad",
        "cn": "便笺本/护垫",
        "emoji": "📝"
      }
    ]
  },
  {
    "id": "-ap",
    "vowel": "a",
    "label": "-ap 家族",
    "rime": "ap",
    "rimeIpa": "/æp/",
    "onsets": [
      {
        "onset": "c",
        "word": "cap",
        "cn": "便帽/鸭舌帽",
        "emoji": "🧢"
      },
      {
        "onset": "m",
        "word": "map",
        "cn": "地图",
        "emoji": "🗺️"
      },
      {
        "onset": "t",
        "word": "tap",
        "cn": "水龙头/轻敲",
        "emoji": "🚰"
      },
      {
        "onset": "n",
        "word": "nap",
        "cn": "小睡/打盹",
        "emoji": "😴"
      },
      {
        "onset": "l",
        "word": "lap",
        "cn": "大腿/膝部",
        "emoji": "🦵"
      }
    ]
  },
  {
    "id": "-en",
    "vowel": "e",
    "label": "-en 家族",
    "rime": "en",
    "rimeIpa": "/ɛn/",
    "onsets": [
      {
        "onset": "p",
        "word": "pen",
        "cn": "钢笔",
        "emoji": "🖊️"
      },
      {
        "onset": "t",
        "word": "ten",
        "cn": "数字十",
        "emoji": "🔟"
      },
      {
        "onset": "h",
        "word": "hen",
        "cn": "母鸡",
        "emoji": "🐔"
      },
      {
        "onset": "m",
        "word": "men",
        "cn": "男人们",
        "emoji": "👨‍🦱"
      },
      {
        "onset": "d",
        "word": "den",
        "cn": "兽穴/巢穴",
        "emoji": "🐻"
      }
    ]
  },
  {
    "id": "-ed",
    "vowel": "e",
    "label": "-ed 家族",
    "rime": "ed",
    "rimeIpa": "/ɛd/",
    "onsets": [
      {
        "onset": "r",
        "word": "red",
        "cn": "红色",
        "emoji": "🔴"
      },
      {
        "onset": "b",
        "word": "bed",
        "cn": "小床",
        "emoji": "🛏️"
      },
      {
        "onset": "f",
        "word": "fed",
        "cn": "喂食(过去式)",
        "emoji": "🥣"
      },
      {
        "onset": "l",
        "word": "led",
        "cn": "带路(过去式)",
        "emoji": "🔦"
      },
      {
        "onset": "w",
        "word": "wed",
        "cn": "结婚",
        "emoji": "💍"
      }
    ]
  },
  {
    "id": "-et",
    "vowel": "e",
    "label": "-et 家族",
    "rime": "et",
    "rimeIpa": "/ɛt/",
    "onsets": [
      {
        "onset": "p",
        "word": "pet",
        "cn": "宠物",
        "emoji": "🐶"
      },
      {
        "onset": "n",
        "word": "net",
        "cn": "渔网/球网",
        "emoji": "🕸️"
      },
      {
        "onset": "w",
        "word": "wet",
        "cn": "潮湿的",
        "emoji": "💧"
      },
      {
        "onset": "j",
        "word": "jet",
        "cn": "喷气式飞机",
        "emoji": "✈️"
      },
      {
        "onset": "g",
        "word": "get",
        "cn": "得到/获得",
        "emoji": "🎁"
      },
      {
        "onset": "v",
        "word": "vet",
        "cn": "兽医",
        "emoji": "🩺"
      },
      {
        "onset": "l",
        "word": "let",
        "cn": "让/允许",
        "emoji": "🚪"
      },
      {
        "onset": "s",
        "word": "set",
        "cn": "一套/放置",
        "emoji": "📦"
      }
    ]
  },
  {
    "id": "-eg",
    "vowel": "e",
    "label": "-eg 家族",
    "rime": "eg",
    "rimeIpa": "/ɛɡ/",
    "onsets": [
      {
        "onset": "l",
        "word": "leg",
        "cn": "腿",
        "emoji": "🦵"
      },
      {
        "onset": "p",
        "word": "peg",
        "cn": "木夹/衣夹",
        "emoji": "🪵"
      },
      {
        "onset": "b",
        "word": "beg",
        "cn": "乞求/恳求",
        "emoji": "🙏"
      }
    ]
  },
  {
    "id": "-ell",
    "vowel": "e",
    "label": "-ell 家族",
    "rime": "ell",
    "rimeIpa": "/ɛl/",
    "onsets": [
      {
        "onset": "b",
        "word": "bell",
        "cn": "铃铛/钟声",
        "emoji": "🔔"
      },
      {
        "onset": "t",
        "word": "tell",
        "cn": "告诉/讲述",
        "emoji": "🗣️"
      },
      {
        "onset": "y",
        "word": "yell",
        "cn": "大声叫喊",
        "emoji": "📢"
      },
      {
        "onset": "w",
        "word": "well",
        "cn": "很好/水井",
        "emoji": "💧"
      },
      {
        "onset": "s",
        "word": "sell",
        "cn": "售卖/销售",
        "emoji": "🏷️"
      }
    ]
  },
  {
    "id": "-ig",
    "vowel": "i",
    "label": "-ig 家族",
    "rime": "ig",
    "rimeIpa": "/ɪɡ/",
    "onsets": [
      {
        "onset": "p",
        "word": "pig",
        "cn": "小猪",
        "emoji": "🐷"
      },
      {
        "onset": "b",
        "word": "big",
        "cn": "大的",
        "emoji": "🐘"
      },
      {
        "onset": "d",
        "word": "dig",
        "cn": "挖洞",
        "emoji": "⛏️"
      },
      {
        "onset": "w",
        "word": "wig",
        "cn": "假发",
        "emoji": "🧑‍🦰"
      },
      {
        "onset": "f",
        "word": "fig",
        "cn": "无花果",
        "emoji": "🍈"
      }
    ]
  },
  {
    "id": "-in",
    "vowel": "i",
    "label": "-in 家族",
    "rime": "in",
    "rimeIpa": "/ɪn/",
    "onsets": [
      {
        "onset": "p",
        "word": "pin",
        "cn": "大头针/别针",
        "emoji": "📌"
      },
      {
        "onset": "b",
        "word": "bin",
        "cn": "垃圾箱/储物箱",
        "emoji": "🗑️"
      },
      {
        "onset": "w",
        "word": "win",
        "cn": "获胜/赢",
        "emoji": "🏆"
      },
      {
        "onset": "t",
        "word": "tin",
        "cn": "铁罐/听头",
        "emoji": "🥫"
      },
      {
        "onset": "f",
        "word": "fin",
        "cn": "鱼鳍",
        "emoji": "🦈"
      }
    ]
  },
  {
    "id": "-ip",
    "vowel": "i",
    "label": "-ip 家族",
    "rime": "ip",
    "rimeIpa": "/ɪp/",
    "onsets": [
      {
        "onset": "l",
        "word": "lip",
        "cn": "嘴唇",
        "emoji": "👄"
      },
      {
        "onset": "z",
        "word": "zip",
        "cn": "拉链",
        "emoji": "🤐"
      },
      {
        "onset": "t",
        "word": "tip",
        "cn": "顶端/提示",
        "emoji": "💡"
      },
      {
        "onset": "d",
        "word": "dip",
        "cn": "浸蘸",
        "emoji": "🍯"
      },
      {
        "onset": "r",
        "word": "rip",
        "cn": "撕扯",
        "emoji": "✂️"
      },
      {
        "onset": "s",
        "word": "sip",
        "cn": "小口喝",
        "emoji": "🥤"
      }
    ]
  },
  {
    "id": "-it",
    "vowel": "i",
    "label": "-it 家族",
    "rime": "it",
    "rimeIpa": "/ɪt/",
    "onsets": [
      {
        "onset": "s",
        "word": "sit",
        "cn": "坐下",
        "emoji": "🪑"
      },
      {
        "onset": "h",
        "word": "hit",
        "cn": "击打/碰撞",
        "emoji": "🏏"
      },
      {
        "onset": "f",
        "word": "fit",
        "cn": "合身/健康的",
        "emoji": "👕"
      },
      {
        "onset": "b",
        "word": "bit",
        "cn": "一点点",
        "emoji": "🍪"
      },
      {
        "onset": "p",
        "word": "pit",
        "cn": "大坑/深凹",
        "emoji": "🕳️"
      }
    ]
  },
  {
    "id": "-id",
    "vowel": "i",
    "label": "-id 家族",
    "rime": "id",
    "rimeIpa": "/ɪd/",
    "onsets": [
      {
        "onset": "k",
        "word": "kid",
        "cn": "小孩",
        "emoji": "🧒"
      },
      {
        "onset": "l",
        "word": "lid",
        "cn": "盖子",
        "emoji": "🍲"
      },
      {
        "onset": "h",
        "word": "hid",
        "cn": "藏起来(过去式)",
        "emoji": "🙈"
      },
      {
        "onset": "b",
        "word": "bid",
        "cn": "出价/努力争取",
        "emoji": "🙋"
      }
    ]
  },
  {
    "id": "-og",
    "vowel": "o",
    "label": "-og 家族",
    "rime": "og",
    "rimeIpa": "/ɒɡ/",
    "onsets": [
      {
        "onset": "d",
        "word": "dog",
        "cn": "小狗",
        "emoji": "🐶"
      },
      {
        "onset": "l",
        "word": "log",
        "cn": "圆木",
        "emoji": "🪵"
      },
      {
        "onset": "f",
        "word": "fog",
        "cn": "大雾",
        "emoji": "🌫️"
      },
      {
        "onset": "j",
        "word": "jog",
        "cn": "慢跑",
        "emoji": "🏃"
      }
    ]
  },
  {
    "id": "-ot",
    "vowel": "o",
    "label": "-ot 家族",
    "rime": "ot",
    "rimeIpa": "/ɒt/",
    "onsets": [
      {
        "onset": "h",
        "word": "hot",
        "cn": "热的/烫的",
        "emoji": "🔥"
      },
      {
        "onset": "p",
        "word": "pot",
        "cn": "锅/罐",
        "emoji": "🍲"
      },
      {
        "onset": "d",
        "word": "dot",
        "cn": "圆点/点子",
        "emoji": "⚫"
      },
      {
        "onset": "l",
        "word": "lot",
        "cn": "很多/批次",
        "emoji": "📦"
      },
      {
        "onset": "n",
        "word": "not",
        "cn": "不/不是",
        "emoji": "❌"
      },
      {
        "onset": "c",
        "word": "cot",
        "cn": "轻便小床",
        "emoji": "🛏️"
      }
    ]
  },
  {
    "id": "-op",
    "vowel": "o",
    "label": "-op 家族",
    "rime": "op",
    "rimeIpa": "/ɒp/",
    "onsets": [
      {
        "onset": "m",
        "word": "mop",
        "cn": "拖把",
        "emoji": "🧹"
      },
      {
        "onset": "t",
        "word": "top",
        "cn": "顶部/陀螺",
        "emoji": "🔝"
      },
      {
        "onset": "h",
        "word": "hop",
        "cn": "单脚跳",
        "emoji": "🦘"
      },
      {
        "onset": "p",
        "word": "pop",
        "cn": "爆裂/爆米花",
        "emoji": "🍿"
      },
      {
        "onset": "c",
        "word": "cop",
        "cn": "警察",
        "emoji": "👮"
      }
    ]
  },
  {
    "id": "-ox",
    "vowel": "o",
    "label": "-ox 家族",
    "rime": "ox",
    "rimeIpa": "/ɒks/",
    "onsets": [
      {
        "onset": "b",
        "word": "box",
        "cn": "盒子/箱子",
        "emoji": "📦"
      },
      {
        "onset": "f",
        "word": "fox",
        "cn": "狐狸",
        "emoji": "🦊"
      },
      {
        "onset": "o",
        "word": "ox",
        "cn": "公牛",
        "emoji": "🐂"
      }
    ]
  },
  {
    "id": "-ob",
    "vowel": "o",
    "label": "-ob 家族",
    "rime": "ob",
    "rimeIpa": "/ɒb/",
    "onsets": [
      {
        "onset": "j",
        "word": "job",
        "cn": "工作/职业",
        "emoji": "💼"
      },
      {
        "onset": "r",
        "word": "rob",
        "cn": "抢劫",
        "emoji": "🦹"
      },
      {
        "onset": "s",
        "word": "sob",
        "cn": "抽泣/呜咽",
        "emoji": "😭"
      },
      {
        "onset": "m",
        "word": "mob",
        "cn": "人群/暴民",
        "emoji": "👥"
      }
    ]
  },
  {
    "id": "-un",
    "vowel": "u",
    "label": "-un 家族",
    "rime": "un",
    "rimeIpa": "/ʌn/",
    "onsets": [
      {
        "onset": "f",
        "word": "fun",
        "cn": "乐趣/好玩的",
        "emoji": "🎉"
      },
      {
        "onset": "r",
        "word": "run",
        "cn": "跑步",
        "emoji": "🏃"
      },
      {
        "onset": "s",
        "word": "sun",
        "cn": "太阳",
        "emoji": "☀️"
      },
      {
        "onset": "b",
        "word": "bun",
        "cn": "小圆面包",
        "emoji": "🍞"
      },
      {
        "onset": "n",
        "word": "nun",
        "cn": "修女",
        "emoji": "⛪"
      }
    ]
  },
  {
    "id": "-ug",
    "vowel": "u",
    "label": "-ug 家族",
    "rime": "ug",
    "rimeIpa": "/ʌɡ/",
    "onsets": [
      {
        "onset": "b",
        "word": "bug",
        "cn": "小虫子",
        "emoji": "🐛"
      },
      {
        "onset": "m",
        "word": "mug",
        "cn": "马克杯",
        "emoji": "🍺"
      },
      {
        "onset": "h",
        "word": "hug",
        "cn": "拥抱",
        "emoji": "🤗"
      },
      {
        "onset": "j",
        "word": "jug",
        "cn": "大水壶/罐子",
        "emoji": "🏺"
      },
      {
        "onset": "r",
        "word": "rug",
        "cn": "小地毯",
        "emoji": "🧶"
      },
      {
        "onset": "t",
        "word": "tug",
        "cn": "用力拉/拖",
        "emoji": "🪢"
      }
    ]
  },
  {
    "id": "-up",
    "vowel": "u",
    "label": "-up 家族",
    "rime": "up",
    "rimeIpa": "/ʌp/",
    "onsets": [
      {
        "onset": "c",
        "word": "cup",
        "cn": "茶杯/奖杯",
        "emoji": "🥤"
      },
      {
        "onset": "p",
        "word": "pup",
        "cn": "小狗幼崽",
        "emoji": "🐶"
      }
    ]
  },
  {
    "id": "-ut",
    "vowel": "u",
    "label": "-ut 家族",
    "rime": "ut",
    "rimeIpa": "/ʌt/",
    "onsets": [
      {
        "onset": "n",
        "word": "nut",
        "cn": "坚果",
        "emoji": "🥜"
      },
      {
        "onset": "h",
        "word": "hut",
        "cn": "小木屋/茅舍",
        "emoji": "🛖"
      },
      {
        "onset": "c",
        "word": "cut",
        "cn": "剪/切",
        "emoji": "✂️"
      },
      {
        "onset": "b",
        "word": "but",
        "cn": "但是",
        "emoji": "🔄"
      }
    ]
  },
  {
    "id": "-ub",
    "vowel": "u",
    "label": "-ub 家族",
    "rime": "ub",
    "rimeIpa": "/ʌb/",
    "onsets": [
      {
        "onset": "t",
        "word": "tub",
        "cn": "浴缸/木盆",
        "emoji": "🛁"
      },
      {
        "onset": "c",
        "word": "cub",
        "cn": "幼兽/幼崽",
        "emoji": "🐻"
      },
      {
        "onset": "r",
        "word": "rub",
        "cn": "搓揉/擦拭",
        "emoji": "🧼"
      },
      {
        "onset": "s",
        "word": "sub",
        "cn": "潜水艇/潜艇堡",
        "emoji": "🚇"
      }
    ]
  }
];

  /* ============================================================
     人教版三年级教材同步课程库 (PEP Grade 3 Textbook Lessons)
     - 覆盖 3A 6大单元、3B 6大单元、5大自然拼读专项全17单元
     - 每单元包含：Let's talk 对话、Let's learn 词汇、Let's chant 歌谣、课标考点金句
     ============================================================ */
  var LESSON_DATA = {
  "u1": {
    "book": "人教版 3A 上册 (2024新课标版)",
    "title": "Unit 1 · Making friends 结交朋友",
    "sub": "见面问候 · 肢体礼仪 · 友好分享",
    "acts": [
      { "id": 0, "title": "第1幕 · 校门问候", "desc": "清晨校园校门口，阳光灿烂，Mike 与吴斌斌相遇挥手打招呼", "range": [0, 1] },
      { "id": 1, "title": "第2幕 · 礼貌握手", "desc": "绿茵草坪上，新朋友微笑握手，表达 Nice to meet you 相识的喜悦", "range": [2, 3] },
      { "id": 2, "title": "第3幕 · 教室新朋", "desc": "明亮教室黑板前，Sarah 与 John 自我介绍相识", "range": [4, 5] },
      { "id": 3, "title": "第4幕 · 课桌分享", "desc": "课桌前忘带文具，Sarah 主动分享彩色文具，好朋友互相帮助", "range": [6, 9] }
    ],
    "dialogues": [
      {
        "role": "Mike",
        "speaker": "迈克",
        "avatar": "🧑",
        "act": 0,
        "en": "Hello! I'm Mike Black.",
        "cn": "你好！我是迈克·布莱克。"
      },
      {
        "role": "Wu Binbin",
        "speaker": "吴斌斌",
        "avatar": "👦",
        "act": 0,
        "en": "Hi! My name is Wu Binbin.",
        "cn": "嗨！我叫吴斌斌。"
      },
      {
        "role": "Mike",
        "speaker": "迈克",
        "avatar": "🧑",
        "act": 1,
        "en": "Nice to meet you.",
        "cn": "见到你很高兴。"
      },
      {
        "role": "Wu Binbin",
        "speaker": "吴斌斌",
        "avatar": "👦",
        "act": 1,
        "en": "Nice to meet you, too.",
        "cn": "见到你我也很高兴。"
      },
      {
        "role": "Sarah",
        "speaker": "萨拉",
        "avatar": "👧",
        "act": 2,
        "en": "Hello! My name is Sarah.",
        "cn": "你好！我叫萨拉。"
      },
      {
        "role": "John",
        "speaker": "约翰",
        "avatar": "👦",
        "act": 2,
        "en": "Hi! I'm John.",
        "cn": "嗨！我是约翰。"
      },
      {
        "role": "Chen Jie",
        "speaker": "陈杰",
        "avatar": "👧",
        "act": 3,
        "en": "Oh no!",
        "cn": "噢，不！（我的玩具/文具忘带了）"
      },
      {
        "role": "Sarah",
        "speaker": "萨拉",
        "avatar": "👧",
        "act": 3,
        "en": "It's OK, Chen Jie. We can share.",
        "cn": "没关系，陈杰。我们可以一起分享。"
      },
      {
        "role": "Chen Jie",
        "speaker": "陈杰",
        "avatar": "👧",
        "act": 3,
        "en": "Thank you, Sarah!",
        "cn": "谢谢你，萨拉！"
      },
      {
        "role": "Sarah",
        "speaker": "萨拉",
        "avatar": "👧",
        "act": 3,
        "en": "You're welcome. Friends help each other.",
        "cn": "不客气。好朋友互相帮助。"
      }
    ],
    "chant": [
      {
        "en": "Wave your hand, say hello!",
        "cn": "挥挥小手，说你好！"
      },
      {
        "en": "Look at my eyes, smile so bright!",
        "cn": "看着我的眼睛，灿烂微笑！"
      },
      {
        "en": "Listen with care, share our toys!",
        "cn": "认真倾听，分享玩具！"
      },
      {
        "en": "We are good friends, girls and boys!",
        "cn": "我们是好朋友，快乐常在！"
      }
    ],
    "keyPatterns": [
      {
        "pattern": "Hello, I'm [名字] / My name is [名字].",
        "example": "Hello, I'm Mike Black. My name is Wu Binbin.",
        "cn": "你好，我是迈克·布莱克。我叫吴斌斌。",
        "tip": "新学期向新同学自我介绍的黄金句型。"
      },
      {
        "pattern": "Nice to meet you. / Nice to meet you, too.",
        "example": "Nice to meet you. — Nice to meet you, too.",
        "cn": "见到你很高兴。—— 见到你我也很高兴。",
        "tip": "初次相识最礼貌的社交问候。"
      },
      {
        "pattern": "We can share. / Friends help each other.",
        "example": "It's OK, Chen Jie. We can share.",
        "cn": "没关系，陈杰。我们可以一起分享。",
        "tip": "主动关照伙伴、乐于分享的温暖表达。"
      }
    ],
    "phonics": "Aa /æ/ (apple), Bb /b/ (bag), Cc /k/ (cat), Dd /d/ (dog)"
  },
  "u2": {
    "book": "人教版 3A 上册 (2024新课标版)",
    "title": "Unit 2 · Different families 不同的家庭",
    "sub": "介绍家人 · 认识亲戚 · 感受家庭的爱",
    "target": "学会用 This is my... 介绍家庭成员（father, mother, brother, sister, grandpa, grandma, uncle, aunt, cousin）；能用 Who is this? 询问人物身份；理解大家庭与小家庭的爱与温暖。",
    "dialogues": [
      {
        "role": "Chen Jie",
        "speaker": "陈杰",
        "avatar": "👧",
        "en": "The rain is heavy. Let's go to my home. It's near.",
        "cn": "雨下得好大。去我家吧，很近。"
      },
      {
        "role": "Sarah",
        "speaker": "萨拉",
        "avatar": "👧",
        "en": "OK!",
        "cn": "好的！"
      },
      {
        "role": "Sarah",
        "speaker": "萨拉",
        "avatar": "👧",
        "en": "Wow! So many family members. Who are they?",
        "cn": "哇！好多家庭成员呀。他们是谁呢？"
      },
      {
        "role": "Chen Jie",
        "speaker": "陈杰",
        "avatar": "👧",
        "en": "Mum! Dad! This is my friend Sarah Miller.",
        "cn": "妈妈！爸爸！这是我的好朋友萨拉·米勒。"
      },
      {
        "role": "Chen Jie",
        "speaker": "陈杰",
        "avatar": "👧",
        "en": "This is my grandpa. This is my grandma.",
        "cn": "这是我爷爷。这是我奶奶。"
      },
      {
        "role": "Grandparents",
        "speaker": "爷爷奶奶",
        "avatar": "👴👵",
        "en": "Hi, Sarah. Nice to meet you.",
        "cn": "你好，萨拉。很高兴认识你。"
      },
      {
        "role": "Sarah",
        "speaker": "萨拉",
        "avatar": "👧",
        "en": "Nice to meet you, too!",
        "cn": "我也很高兴认识你们！"
      },
      {
        "role": "Sarah",
        "speaker": "萨拉",
        "avatar": "👧",
        "en": "Who is this? Is this your uncle?",
        "cn": "这是谁呀？这是你叔叔吗？"
      },
      {
        "role": "Chen Jie",
        "speaker": "陈杰",
        "avatar": "👧",
        "en": "Yes, it is. And this is my aunt.",
        "cn": "是的。这位是我阿姨。"
      },
      {
        "role": "Sarah",
        "speaker": "萨拉",
        "avatar": "👧",
        "en": "And who is the baby?",
        "cn": "那这个小宝宝是谁呢？"
      },
      {
        "role": "Chen Jie",
        "speaker": "陈杰",
        "avatar": "👧",
        "en": "This is my baby cousin! I have a big family.",
        "cn": "这是我的小堂弟！我有一个大家庭。"
      },
      {
        "role": "Sarah",
        "speaker": "萨拉",
        "avatar": "👧",
        "en": "I have a small family. But I love my family!",
        "cn": "我的是小家庭。但我非常爱我的家！"
      }
    ],
    "chant": [
      {
        "en": "Father and mother, I love you!",
        "cn": "爸爸和妈妈，我爱你们！"
      },
      {
        "en": "Grandpa, grandma, love me too!",
        "cn": "爷爷和奶奶，也爱着我！"
      },
      {
        "en": "Brother and sister, jump and run!",
        "cn": "兄弟和姐妹，欢跳奔跑！"
      },
      {
        "en": "Big or small, our family is full of fun!",
        "cn": "大或小家庭，处处充满欢笑！"
      }
    ],
    "keyPatterns": [
      {
        "pattern": "This is my [家庭成员].",
        "example": "This is my father. This is my friend Sarah.",
        "cn": "这是我的爸爸。这是我的朋友萨拉。",
        "tip": "向他人介绍身边家人的必备句型。"
      },
      {
        "pattern": "Who is this? — It's my [家庭成员].",
        "example": "Who is this? — It's my cousin.",
        "cn": "这是谁？—— 这是我的堂弟。",
        "tip": "询问照片或眼前人物身份的核心问句。"
      },
      {
        "pattern": "I have a big / small family. I love my family.",
        "example": "I have a big family. I love my family!",
        "cn": "我有一个大家庭。我爱我的家！",
        "tip": "表达家庭规模与家庭情感的课标金句。"
      }
    ],
    "phonics": "Ee /e/ (egg, elephant), Ff /f/ (fish, face), Gg /ɡ/ (girl, gift)"
  },
  "u3": {
    "book": "人教版 3A 上册 (2024新课标版)",
    "title": "Unit 3 · Amazing animals 神奇的动物",
    "sub": "可爱萌宠 · 野生动物 · 奇妙特征",
    "target": "认识常见宠物与野生动物（cat, dog, bird, rabbit, panda, monkey, tiger, elephant, giraffe）；能用 What's this / that? 询问动物；学会用 Do you have a pet? 交流宠物；用 cute, fast, tall 描述动物特征。",
    "dialogues": [
      {
        "role": "Qiqi",
        "speaker": "琪琪",
        "avatar": "👧",
        "en": "Good morning, Duoduo. Your rabbit is so cute!",
        "cn": "早上好，多多。你的小兔子太可爱了！"
      },
      {
        "role": "Duoduo",
        "speaker": "多多",
        "avatar": "👦",
        "en": "Good morning, Qiqi. Come in, please. Do you have a pet now?",
        "cn": "早上好，琪琪。快请进。你现在有宠物吗？"
      },
      {
        "role": "Qiqi",
        "speaker": "琪琪",
        "avatar": "👧",
        "en": "Yes, I do! Look, it's singing.",
        "cn": "有的！你看，它在唱歌呢。"
      },
      {
        "role": "Duoduo",
        "speaker": "多多",
        "avatar": "👦",
        "en": "Wow, it's a bird! What's its name?",
        "cn": "哇，是一只小鸟！它叫什么名字呀？"
      },
      {
        "role": "Qiqi",
        "speaker": "琪琪",
        "avatar": "👧",
        "en": "Its name is Apple.",
        "cn": "它的名字叫“苹果”。"
      },
      {
        "role": "Apple",
        "speaker": "宠物鸟苹果",
        "avatar": "🐦",
        "en": "Hello! Hello!",
        "cn": "你好！你好！"
      },
      {
        "role": "Duoduo",
        "speaker": "多多",
        "avatar": "👦",
        "en": "Wow! It can talk!",
        "cn": "哇！它竟然会说话！"
      },
      {
        "role": "Mike",
        "speaker": "迈克",
        "avatar": "🧑",
        "en": "Look at the animals over there! What is that?",
        "cn": "看那边的动物！那是什么？"
      },
      {
        "role": "Chen Jie",
        "speaker": "陈杰",
        "avatar": "👧",
        "en": "It's a red panda! It is so cute.",
        "cn": "那是一只小熊猫！好可爱呀。"
      },
      {
        "role": "Mike",
        "speaker": "迈克",
        "avatar": "🧑",
        "en": "Look at the giraffe! It's so tall.",
        "cn": "看那只长颈鹿！它好高呀。"
      },
      {
        "role": "Chen Jie",
        "speaker": "陈杰",
        "avatar": "👧",
        "en": "Yes! And the tiger can run so fast. Animals are amazing!",
        "cn": "是呀！老虎跑得好快。动物们真奇妙！"
      }
    ],
    "chant": [
      {
        "en": "Cat and dog, rabbit and bird,",
        "cn": "小猫小狗，小兔小鸟，"
      },
      {
        "en": "Sweetest pets in the whole wide world!",
        "cn": "世界上最最可爱的宠物！"
      },
      {
        "en": "Panda is cute, giraffe is tall,",
        "cn": "大熊猫真可爱，长颈鹿长得高，"
      },
      {
        "en": "Amazing animals, we love them all!",
        "cn": "神奇的动物们，我们都爱它！"
      }
    ],
    "keyPatterns": [
      {
        "pattern": "What's this / that? — It's a [动物].",
        "example": "What's this? — It's a red panda.",
        "cn": "这是什么？—— 这是一只小熊猫。",
        "tip": "询问近处或远处不认识动物的句型。"
      },
      {
        "pattern": "Do you have a pet? — Yes, I do. / I have a [动物].",
        "example": "Do you have a pet? — Yes, I have a dog.",
        "cn": "你有宠物吗？—— 有的，我有一只狗。",
        "tip": "调查和交流宠物的经典对话。"
      },
      {
        "pattern": "Look at the [动物], it is [特征].",
        "example": "Look at the giraffe! It's so tall.",
        "cn": "看长颈鹿！它好高呀。",
        "tip": "描述动物外貌特征与本领的句型。"
      }
    ],
    "phonics": "Hh /h/ (hat, hand), Ii /ɪ/ (ink, pig), Jj /dʒ/ (jet, jump), Kk /k/ (kite, kid)"
  },
  "u4": {
    "book": "人教版 3A 上册 (2024新课标版)",
    "title": "Unit 4 · Plants around us 身边的植物",
    "sub": "水果果园 · 植物作用 · 爱护花草",
    "target": "认识身边的植物与水果（apple, banana, orange, grape, tree, flower, grass）；掌握 Do you like...? 问答水果喜好；了解植物需要阳光、水分和空气（Plants need sun, water and air）；树立爱护植物与大自然的意识。",
    "dialogues": [
      {
        "role": "Miss White",
        "speaker": "怀特老师",
        "avatar": "👩‍🏫",
        "en": "Welcome to the farm! Mike, do you like apples?",
        "cn": "欢迎来到农场！迈克，你喜欢苹果吗？"
      },
      {
        "role": "Mike",
        "speaker": "迈克",
        "avatar": "🧑",
        "en": "Yes, I do. They are sweet. And you, John?",
        "cn": "是的，我喜欢，它们很甜。你呢，约翰？"
      },
      {
        "role": "John",
        "speaker": "约翰",
        "avatar": "👦",
        "en": "No, I don't. I like bananas and oranges.",
        "cn": "我不喜欢，我喜欢香蕉和橙子。"
      },
      {
        "role": "Miss White",
        "speaker": "怀特老师",
        "avatar": "👩‍🏫",
        "en": "Do you like the farm?",
        "cn": "你们喜欢农场吗？"
      },
      {
        "role": "Mike & John",
        "speaker": "迈克和约翰",
        "avatar": "🧑👦",
        "en": "Yes, Miss White! I like the fresh air here.",
        "cn": "喜欢，怀特老师！我喜欢这里清新的空气。"
      },
      {
        "role": "Sarah",
        "speaker": "萨拉",
        "avatar": "👧",
        "en": "Look at the school garden! The flowers need water.",
        "cn": "看学校的花园！花朵需要水了。"
      },
      {
        "role": "Wu Binbin",
        "speaker": "吴斌斌",
        "avatar": "👦",
        "en": "Let's water the flowers together.",
        "cn": "让我们一起给花浇水吧。"
      },
      {
        "role": "Sarah",
        "speaker": "萨拉",
        "avatar": "👧",
        "en": "Plants give us fresh air and flowers.",
        "cn": "植物给我们新鲜的空气和花朵。"
      },
      {
        "role": "Wu Binbin",
        "speaker": "吴斌斌",
        "avatar": "👦",
        "en": "Yes, plants need sun, water and air to grow.",
        "cn": "是的，植物需要阳光、水和空气才能长大。"
      }
    ],
    "chant": [
      {
        "en": "Apples, bananas, sweet and nice,",
        "cn": "红苹果香香蕉，甜蜜可口，"
      },
      {
        "en": "Oranges, grapes, fresh and bright!",
        "cn": "大橙子水葡萄，新鲜又亮丽！"
      },
      {
        "en": "Sun and water help plants grow,",
        "cn": "阳光和雨露帮助植物生长，"
      },
      {
        "en": "Water the flowers, watch them glow!",
        "cn": "给花儿浇浇水，看它们美丽绽放！"
      }
    ],
    "keyPatterns": [
      {
        "pattern": "Do you like [水果]? — Yes, I do. / No, I don't.",
        "example": "Do you like apples? — Yes, I do.",
        "cn": "你喜欢苹果吗？—— 是的，我喜欢。",
        "tip": "询问对方喜好的基础交际句型。"
      },
      {
        "pattern": "Plants need [需求] to grow.",
        "example": "Plants need air, water and sun.",
        "cn": "植物需要空气、水和阳光才能生长。",
        "tip": "科普植物生长三要素的跨学科核心句。"
      },
      {
        "pattern": "Plants give us [益处]. / Let's [行动].",
        "example": "Plants give us fresh air. Let's water the flowers.",
        "cn": "植物给我们新鲜空气。让我们给花浇水吧。",
        "tip": "爱护身边大自然的行动号召句。"
      }
    ],
    "phonics": "Ll /l/ (leg, lion), Mm /m/ (mum, monkey), Nn /n/ (nose, net)"
  },
  "u5": {
    "book": "人教版 3A 上册 (2024新课标版)",
    "title": "Unit 5 · The colourful world 多彩的世界",
    "sub": "缤纷色彩 · 调色魔法 · 观察生活",
    "target": "掌握所有常见颜色词（red, green, blue, yellow, orange, purple, brown, white, black, pink）；能用 What colour is it? 询问颜色并回答；掌握颜色混合变色魔法（Red and blue make purple）；体会色彩丰富的美丽大自然。",
    "dialogues": [
      {
        "role": "Sarah",
        "speaker": "萨拉",
        "avatar": "👧",
        "en": "Look at my picture! What colour is it?",
        "cn": "看我的画！它是什么颜色？"
      },
      {
        "role": "Mike",
        "speaker": "迈克",
        "avatar": "🧑",
        "en": "It's blue. Blue like the sea.",
        "cn": "是蓝色的。像大海一样蓝。"
      },
      {
        "role": "Sarah",
        "speaker": "萨拉",
        "avatar": "👧",
        "en": "What colours do you like?",
        "cn": "你喜欢什么颜色呢？"
      },
      {
        "role": "Mike",
        "speaker": "迈克",
        "avatar": "🧑",
        "en": "I like green and yellow. Green trees and yellow sun!",
        "cn": "我喜欢绿色和黄色。绿色的树和黄色的太阳！"
      },
      {
        "role": "Miss White",
        "speaker": "怀特老师",
        "avatar": "👩‍🏫",
        "en": "Let's paint together! What happens if we mix colours?",
        "cn": "我们一起画画吧！如果把颜色混合会怎样？"
      },
      {
        "role": "John",
        "speaker": "约翰",
        "avatar": "👦",
        "en": "Look! Red and blue make purple!",
        "cn": "快看！红加蓝变成了紫色！"
      },
      {
        "role": "Sarah",
        "speaker": "萨拉",
        "avatar": "👧",
        "en": "And blue and yellow make green!",
        "cn": "还有，蓝加黄变成了绿色！"
      },
      {
        "role": "Miss White",
        "speaker": "怀特老师",
        "avatar": "👩‍🏫",
        "en": "Great job! Our world is so colourful!",
        "cn": "太棒了！我们的世界真是色彩斑斓！"
      }
    ],
    "chant": [
      {
        "en": "Red and yellow, orange bright,",
        "cn": "红加黄，橙色亮，"
      },
      {
        "en": "Blue and yellow, green in sight!",
        "cn": "蓝加黄，绿莹莹！"
      },
      {
        "en": "Red and blue make purple sky,",
        "cn": "红加蓝调出紫色天空，"
      },
      {
        "en": "Colourful rainbow way up high!",
        "cn": "七色彩虹高高挂在云端！"
      }
    ],
    "keyPatterns": [
      {
        "pattern": "What colour is it? — It's [颜色].",
        "example": "What colour is it? — It's blue.",
        "cn": "它是什么颜色？—— 是蓝色的。",
        "tip": "询问物品颜色的黄金必考句。"
      },
      {
        "pattern": "[颜色1] and [颜色2] make [新颜色].",
        "example": "Red and blue make purple.",
        "cn": "红色和蓝色调配出紫色。",
        "tip": "2024新版特色：跨学科神奇调色公式。"
      },
      {
        "pattern": "I see a [颜色] [物品].",
        "example": "I see a brown bear and a pink duck.",
        "cn": "我看见一只棕熊和一只粉色鸭子。",
        "tip": "描述身边缤纷世界与动物的表达。"
      }
    ],
    "phonics": "Oo /ɒ/ (orange, ox), Pp /p/ (pen, pig), Qq /kw/ (queen, quiet), Rr /r/ (red, rabbit), Ss /s/ (sun, six), Tt /t/ (tiger, ten)"
  },
  "u6": {
    "book": "人教版 3A 上册 (2024新课标版)",
    "title": "Unit 6 · Useful numbers 生活中的数字",
    "sub": "数字1-10 · 年龄生日 · 时间计数",
    "target": "掌握基数词 one 到 ten；学会用 How old are you? 询问年龄；学会用 How many...? 计数生活物品；认识生活中的整点时间（o'clock）；掌握在生日派对中的快乐庆祝表达（cut the cake, eat the cake）。",
    "dialogues": [
      {
        "role": "Wu Binbin",
        "speaker": "吴斌斌",
        "avatar": "👦",
        "en": "Mike, this is my brother, Sam.",
        "cn": "迈克，这是我的弟弟，萨姆。"
      },
      {
        "role": "Mike",
        "speaker": "迈克",
        "avatar": "🧑",
        "en": "Hi, Sam! Nice to meet you. How old are you?",
        "cn": "你好，萨姆！很高兴认识你。你几岁啦？"
      },
      {
        "role": "Sam",
        "speaker": "萨姆",
        "avatar": "🧒",
        "en": "I'm five years old.",
        "cn": "我五岁了。"
      },
      {
        "role": "Mike",
        "speaker": "迈克",
        "avatar": "🧑",
        "en": "And how old are you, Binbin?",
        "cn": "那你呢，彬彬？你几岁了？"
      },
      {
        "role": "Wu Binbin",
        "speaker": "吴斌斌",
        "avatar": "👦",
        "en": "I'm eight years old.",
        "cn": "我八岁啦。"
      },
      {
        "role": "Chen Jie",
        "speaker": "陈杰",
        "avatar": "👧",
        "en": "Look at the birthday cake! How many candles?",
        "cn": "看生日蛋糕！有多少根蜡烛？"
      },
      {
        "role": "Sarah",
        "speaker": "萨拉",
        "avatar": "👧",
        "en": "Let's count: one, two, three, four, five, six, seven, eight!",
        "cn": "我们数一数：1、2、3、4、5、6、7、8！"
      },
      {
        "role": "Sarah",
        "speaker": "萨拉",
        "avatar": "👧",
        "en": "Eight candles! Happy birthday, Binbin!",
        "cn": "八根蜡烛！生日快乐，彬彬！"
      },
      {
        "role": "Wu Binbin",
        "speaker": "吴斌斌",
        "avatar": "👦",
        "en": "Thank you, everyone!",
        "cn": "谢谢大家！"
      },
      {
        "role": "Chen Jie",
        "speaker": "陈杰",
        "avatar": "👧",
        "en": "Look at the clock. It's four o'clock. Let's cut the cake!",
        "cn": "看时钟，现在四点整啦。我们切蛋糕吧！"
      }
    ],
    "chant": [
      {
        "en": "One, two, three, jump with me!",
        "cn": "一、二、三，跟我一起跳！"
      },
      {
        "en": "Four, five, six, count the bricks!",
        "cn": "四、五、六，数数积木块！"
      },
      {
        "en": "Seven, eight, nine, feeling fine!",
        "cn": "七、八、九，心情真愉快！"
      },
      {
        "en": "Ten big candles on the cake, shine, shine, shine!",
        "cn": "蛋糕上十根蜡烛闪闪发光！"
      }
    ],
    "keyPatterns": [
      {
        "pattern": "How old are you? — I'm [数字] years old.",
        "example": "How old are you? — I'm eight years old.",
        "cn": "你几岁了？—— 我八岁了。",
        "tip": "询问和回答年龄的核心必背句型。"
      },
      {
        "pattern": "How many [复数名词]? — [数字].",
        "example": "How many candles? — Eight candles.",
        "cn": "有多少根蜡烛？—— 八根蜡烛。",
        "tip": "询问数量及生活点数的经典句型。"
      },
      {
        "pattern": "It's [数字] o'clock. Let's [行动]!",
        "example": "It's four o'clock. Let's cut the cake!",
        "cn": "现在是四点整。我们切蛋糕吧！",
        "tip": "认识整点时间并提出建议的实用句型。"
      }
    ],
    "phonics": "Uu /ʌ/ (under, umbrella), Vv /v/ (van, vest), Ww /w/ (water, win), Xx /ks/ (box, fox), Yy /j/ (yellow, yo-yo), Zz /z/ (zoo, zip)"
  },
  "sa": {
    "book": "3B 拼读专项",
    "title": "Phonics a · 短元音 /æ/ 专项助教",
    "sub": "发音公式：嘴巴大张两指宽，下巴放松短促清脆发 /æ/",
    "target": "突破三年级下册核心短元音 a (/æ/)；掌握 -at, -an, -ag, -ad, -ap 等核心词族公式；熟练拼读 cat, bag, dad, hand, map 等单词。",
    "dialogues": [
      {
        "speaker": "Teacher",
        "role": "拼读老师",
        "avatar": "👩‍🏫",
        "en": "Open your mouth wide! Two fingers wide, say /æ/!",
        "cn": "嘴巴张大！两指宽，发短元音 /æ/！"
      },
      {
        "speaker": "Kids",
        "role": "小朋友们",
        "avatar": "👧👦",
        "en": "/æ/, /æ/, /æ/!",
        "cn": "/æ/, /æ/, /æ/！"
      },
      {
        "speaker": "Teacher",
        "role": "拼读老师",
        "avatar": "👩‍🏫",
        "en": "c - a - t ➔ cat! The cat is on the mat.",
        "cn": "c - a - t ➔ cat！小猫坐在垫子上。"
      },
      {
        "speaker": "Kids",
        "role": "小朋友们",
        "avatar": "👧👦",
        "en": "A fat cat in a black bag!",
        "cn": "一只肥猫装在黑色书包里！"
      }
    ],
    "chant": [
      {
        "en": "A is for apple, /æ/, /æ/, apple.",
        "cn": "A 带来苹果，/æ/, /æ/, 苹果。"
      },
      {
        "en": "Cat, cat, the cat is fat.",
        "cn": "小猫，小猫，小猫胖乎乎。"
      },
      {
        "en": "Bag, bag, a fat cat in the bag.",
        "cn": "书包，书包，一只肥猫坐在书包里。"
      },
      {
        "en": "Dad has a pan, /æ/, /æ/, pan!",
        "cn": "爸爸拿着平底锅，/æ/, /æ/, 平底锅！"
      }
    ],
    "keyPatterns": [
      {
        "pattern": "字母 a 在闭音节中发短元音 /æ/。",
        "example": "c-a-t ➔ cat, b-a-g ➔ bag",
        "cn": "口型口诀：嘴张大两指宽，舌尖抵下齿龈。",
        "tip": "易混提醒：注意区分 a(/æ/大嘴) 和 e(/e/小嘴)。"
      }
    ]
  },
  "se": {
    "book": "3B 拼读专项",
    "title": "Phonics e · 短元音 /e/ 专项助教",
    "sub": "发音公式：嘴角自然向两边裂开一指宽，短促轻快发 /e/",
    "target": "突破三年级下册短元音 e (/e/)；掌握 -en, -ed, -et, -eg 等词族公式；掌握 pen, ten, leg, red, bed 等重点词汇。",
    "dialogues": [
      {
        "speaker": "Teacher",
        "role": "拼读老师",
        "avatar": "👩‍🏫",
        "en": "Smile a little! One finger wide, say /e/!",
        "cn": "微笑一点点！嘴角开一指宽，短促发 /e/！"
      },
      {
        "speaker": "Kids",
        "role": "小朋友们",
        "avatar": "👧👦",
        "en": "/e/, /e/, /e/!",
        "cn": "/e/, /e/, /e/！"
      },
      {
        "speaker": "Teacher",
        "role": "拼读老师",
        "avatar": "👩‍🏫",
        "en": "p - e - n ➔ pen! t - e - n ➔ ten!",
        "cn": "p - e - n ➔ 钢笔！t - e - n ➔ 数字十！"
      },
      {
        "speaker": "Kids",
        "role": "小朋友们",
        "avatar": "👧👦",
        "en": "Ten red pens on the bed!",
        "cn": "十支红钢笔放在床上！"
      }
    ],
    "chant": [
      {
        "en": "E is for egg, /e/, /e/, egg.",
        "cn": "E 带来鸡蛋，/e/, /e/, 鸡蛋。"
      },
      {
        "en": "Pen, pen, ten red pens.",
        "cn": "钢笔，钢笔，十支红色的钢笔。"
      },
      {
        "en": "Leg, leg, bend your leg.",
        "cn": "大腿，大腿，弯曲你的大腿。"
      },
      {
        "en": "Bed, bed, a pet on the bed!",
        "cn": "床，床，小宠物坐在小床上！"
      }
    ],
    "keyPatterns": [
      {
        "pattern": "字母 e 在闭音节中发短元音 /e/。",
        "example": "p-e-n ➔ pen, r-e-d ➔ red",
        "cn": "口型口诀：微笑一指宽，上下齿微微张开。",
        "tip": "易混提醒：pen (钢笔 /e/) vs pin (大头针 /ɪ/)。"
      }
    ]
  },
  "si": {
    "book": "3B 拼读专项",
    "title": "Phonics i · 短元音 /ɪ/ 专项助教",
    "sub": "发音公式：嘴角微缩微露牙齿，极短促有力发 /ɪ/",
    "target": "突破三年级短元音 i (/ɪ/)；掌握 -ig, -in, -ip, -it, -id 等词族；掌握 pig, big, six, milk, pin, sit, kid 等高频词。",
    "dialogues": [
      {
        "speaker": "Teacher",
        "role": "拼读老师",
        "avatar": "👩‍🏫",
        "en": "Show your teeth a little! Short and crisp /ɪ/!",
        "cn": "稍微露一点牙齿！短促清脆发 /ɪ/！"
      },
      {
        "speaker": "Kids",
        "role": "小朋友们",
        "avatar": "👧👦",
        "en": "/ɪ/, /ɪ/, /ɪ/!",
        "cn": "/ɪ/, /ɪ/, /ɪ/！"
      },
      {
        "speaker": "Teacher",
        "role": "拼读老师",
        "avatar": "👩‍🏫",
        "en": "p - i - g ➔ pig! b - i - g ➔ big!",
        "cn": "小猪 pig，大的 big！"
      },
      {
        "speaker": "Kids",
        "role": "小朋友们",
        "avatar": "👧👦",
        "en": "A big pig drinks milk and digs!",
        "cn": "一只大胖猪喝着牛奶挖着洞！"
      }
    ],
    "chant": [
      {
        "en": "I is for ink, /ɪ/, /ɪ/, ink.",
        "cn": "I 带来墨水，/ɪ/, /ɪ/, 墨水。"
      },
      {
        "en": "Pig, pig, a big fat pig.",
        "cn": "小猪，小猪，一只肥嘟嘟的大猪。"
      },
      {
        "en": "Six, six, six little pigs.",
        "cn": "六，六，六只可爱的小猪。"
      },
      {
        "en": "Zip, zip, zip up your lip!",
        "cn": "拉链，拉链，拉好你的拉链！"
      }
    ],
    "keyPatterns": [
      {
        "pattern": "字母 i 在闭音节中发短元音 /ɪ/。",
        "example": "p-i-g ➔ pig, s-i-x ➔ six",
        "cn": "口型口诀：嘴角微收露小齿，急短发音别拖长。",
        "tip": "易混提醒：big (/ɪ/) vs bag (/æ/)；sit (/ɪ/) vs set (/e/)。"
      }
    ]
  },
  "so": {
    "book": "3B 拼读专项",
    "title": "Phonics o · 短元音 /ɒ/ 专项助教",
    "sub": "发音公式：嘴唇撮成圆圆的小圈，短促发 /ɒ/",
    "target": "突破三年级短元音 o (/ɒ/)；掌握 -og, -ot, -op, -ox, -ob 词族；熟练拼读 dog, box, hot, top, fox, orange 等。",
    "dialogues": [
      {
        "speaker": "Teacher",
        "role": "拼读老师",
        "avatar": "👩‍🏫",
        "en": "Round your lips! Make a small circle /ɒ/!",
        "cn": "嘴唇圆起来！撮成小圆圈发 /ɒ/！"
      },
      {
        "speaker": "Kids",
        "role": "小朋友们",
        "avatar": "👧👦",
        "en": "/ɒ/, /ɒ/, /ɒ/!",
        "cn": "/ɒ/, /ɒ/, /ɒ/！"
      },
      {
        "speaker": "Teacher",
        "role": "拼读老师",
        "avatar": "👩‍🏫",
        "en": "d - o - g ➔ dog! b - o - x ➔ box!",
        "cn": "小狗 dog，箱子 box！"
      },
      {
        "speaker": "Kids",
        "role": "小朋友们",
        "avatar": "👧👦",
        "en": "A fox and a dog on a hot log!",
        "cn": "一只狐狸和一只小狗坐在滚烫的圆木上！"
      }
    ],
    "chant": [
      {
        "en": "O is for orange, /ɒ/, /ɒ/, orange.",
        "cn": "O 带来橙子，/ɒ/, /ɒ/, 橙子。"
      },
      {
        "en": "Dog, dog, a dog on the log.",
        "cn": "小狗，小狗，坐在木头上的小狗。"
      },
      {
        "en": "Box, box, a fox in the box.",
        "cn": "箱子，箱子，箱子里藏着一只狐狸。"
      },
      {
        "en": "Hot, hot, the soup is hot!",
        "cn": "好烫，好烫，小锅里的热汤好烫！"
      }
    ],
    "keyPatterns": [
      {
        "pattern": "字母 o 在闭音节中发短元音 /ɒ/。",
        "example": "d-o-g ➔ dog, h-o-t ➔ hot",
        "cn": "口型口诀：双唇圆圆短促声，声带振动下颌降。",
        "tip": "易混提醒：hot (/ɒ/ 烫) vs hut (/ʌ/ 茅舍)；dog (/ɒ/) vs duck (/ʌ/)。"
      }
    ]
  },
  "su": {
    "book": "3B 拼读专项",
    "title": "Phonics u · 短元音 /ʌ/ 专项助教",
    "sub": "发音公式：嘴唇自然半放松微开，短促爆发发 /ʌ/",
    "target": "突破三年级短元音 u (/ʌ/)；掌握 -un, -ug, -up, -ut, -ub 词族；掌握 fun, run, duck, sun, cup, bus 等高频词。",
    "dialogues": [
      {
        "speaker": "Teacher",
        "role": "拼读老师",
        "avatar": "👩‍🏫",
        "en": "Relax your mouth! Half open, say /ʌ/!",
        "cn": "嘴唇完全自然放松！半张开，发 /ʌ/！"
      },
      {
        "speaker": "Kids",
        "role": "小朋友们",
        "avatar": "👧👦",
        "en": "/ʌ/, /ʌ/, /ʌ/!",
        "cn": "/ʌ/, /ʌ/, /ʌ/！"
      },
      {
        "speaker": "Teacher",
        "role": "拼读老师",
        "avatar": "👩‍🏫",
        "en": "f - u - n ➔ fun! r - u - n ➔ run!",
        "cn": "好玩的 fun！跑步 run！"
      },
      {
        "speaker": "Kids",
        "role": "小朋友们",
        "avatar": "👧👦",
        "en": "Run in the sun, have lots of fun!",
        "cn": "在太阳下欢快奔跑，乐趣无限多！"
      }
    ],
    "chant": [
      {
        "en": "U is for umbrella, /ʌ/, /ʌ/, umbrella.",
        "cn": "U 带来雨伞，/ʌ/, /ʌ/, 雨伞。"
      },
      {
        "en": "Fun, fun, run in the sun.",
        "cn": "乐趣，乐趣，阳光下开心奔跑。"
      },
      {
        "en": "Duck, duck, a cute little duck.",
        "cn": "鸭子，鸭子，一只可爱的小鸭子。"
      },
      {
        "en": "Cup, cup, drink it all up!",
        "cn": "水杯，水杯，仰头全部喝个精光！"
      }
    ],
    "keyPatterns": [
      {
        "pattern": "字母 u 在闭音节中发短元音 /ʌ/。",
        "example": "s-u-n ➔ sun, d-u-ck ➔ duck",
        "cn": "口型口诀：嘴唇放松半张口，舌身平放轻短发。",
        "tip": "易混提醒：cup (/ʌ/ 杯子) vs cap (/æ/ 帽子)；cat (/æ/) vs cut (/ʌ/)。"
      }
    ]
  }
};

  /* ============================================================
     抗遗忘记忆追踪系统 (Spaced Repetition & Memory Progress)
     - 记录单词上次复习时间、连对次数、错题标记
     - 金银铜三星记忆评级：
       * bronze 🥉: 当天新学会
       * silver 🥈: 隔天温故再次正确
       * gold   🥇: 连续3次主动提取正确，锁入永久词汇库
     ============================================================ */
  var MEMORY_KEY = 'pep3.english.memory.v1';

  function getMemoryMap() {
    return Store.get(MEMORY_KEY, {});
  }
  function saveMemoryMap(map) {
    Store.set(MEMORY_KEY, map);
  }

  // 记录单词学习/答对
  function recordWordPass(wordId) {
    var map = getMemoryMap();
    var now = Date.now();
    var item = map[wordId] || { count: 0, streak: 0, wrong: 0, lastTs: 0, star: 'bronze', flag: false };
    item.count++;
    item.streak++;
    item.lastTs = now;
    item.flag = false; // 答对移除生词小红旗
    if (item.streak >= 3) item.star = 'gold';
    else if (item.streak >= 2) item.star = 'silver';
    else item.star = 'bronze';
    map[wordId] = item;
    saveMemoryMap(map);
    return item;
  }

  // 记录单词答错/存疑
  function recordWordFail(wordId) {
    var map = getMemoryMap();
    var item = map[wordId] || { count: 0, streak: 0, wrong: 0, lastTs: 0, star: 'none', flag: true };
    item.wrong++;
    item.streak = 0; // 连击清零
    item.flag = true; // 自动标上重点小红旗 🚩
    if (item.star === 'gold') item.star = 'silver';
    map[wordId] = item;
    saveMemoryMap(map);
    return item;
  }

  // 找出需要“昨日温故”唤醒的单词列表 (昨日学过或带有红旗)
  function getReviewDueWords() {
    var map = getMemoryMap();
    var now = Date.now();
    var oneDayMs = 20 * 3600 * 1000; // 20小时以上算隔天
    var due = [];
    var flagged = [];

    WORDS.forEach(function (w) {
      var m = map[w.id];
      if (!m) return;
      if (m.flag) {
        flagged.push(w);
      } else if (now - m.lastTs >= oneDayMs && m.star !== 'gold') {
        due.push(w);
      }
    });

    // 优先红旗，再是隔天未达金星的词
    var combined = flagged.concat(due);
    var seen = {};
    return combined.filter(function (x) {
      if (seen[x.id]) return false;
      seen[x.id] = true;
      return true;
    }).slice(0, 8); // 每次温故 5~8 个词，防止负担过重
  }

  /* ============================================================
     游戏主控制器 (Mounting Implementation)
     - 接入小小棋盘 Game 框架
     ============================================================ */
  function mount(host, api) {
    var S = null; // 当前状态
    var blendTimer = null;

    // 系统化三大主学习模式：
    // mainMode: 'lesson' (📖 课本同步课堂) | 'phonics' (🚂 自然拼读小火车) | 'practice' (🎯 闯关与抗遗忘)
    // 次级工具分段：
    // phonicsTab: 'train' (碰头拼读小火车) | 'soundout' (单词音素拆读机)
    // practiceTab: 'quiz' (听音辨音大闯关) | 'review' (昨日温故唤醒舱)
    function newGame(unitKey, mainMode, subTab, specificWordIdx) {
      startSequence();
      unitKey = unitKey || (S ? S.unit : 'u1');
      mainMode = mainMode || (S ? S.mainMode : 'lesson');

      var lessonTab = (mainMode === 'lesson')
        ? (subTab || (S && S.lessonTab ? S.lessonTab : 'dialogue'))
        : ((S && S.lessonTab) || 'dialogue');
      var phonicsTab = (mainMode === 'phonics') ? (subTab || (S && S.phonicsTab ? S.phonicsTab : 'train')) : (S ? S.phonicsTab : 'train');
      var practiceTab = (mainMode === 'practice') ? (subTab || (S && S.practiceTab ? S.practiceTab : 'quiz')) : (S ? S.practiceTab : 'quiz');

      var wordList = [];
      if (mainMode === 'practice' && practiceTab === 'review') {
        wordList = getReviewDueWords();
        if (!wordList.length) {
          wordList = WORDS.filter(function (w) { return w.unit === unitKey; }).slice(0, 6);
        }
      } else {
        wordList = WORDS.filter(function (w) { return w.unit === unitKey; });
        if (!wordList.length) wordList = WORDS.filter(function (w) { return w.unit === 'sa'; });
      }

      var wordIdx = (typeof specificWordIdx === 'number') ? specificWordIdx : (mainMode === 'phonics' && subTab === 'soundout' && S ? S.idx : 0);
      if (wordIdx >= wordList.length) wordIdx = 0;

      S = {
        unit: unitKey,
        mainMode: mainMode,
        lessonTab: lessonTab,
        vocabMode: (S && S.vocabMode) || 'grid',
        vocabHeroIdx: (S && S.vocabHeroIdx) || 0,
        phonicsTab: phonicsTab,
        practiceTab: practiceTab,
        words: wordList,
        idx: wordIdx,
        subMode: 'circle',
        hidden: false,
        trainVowel: (S && S.trainVowel) || 'all',
        trainFamilyIdx: (S && S.trainFamilyIdx) || 0,
        trainOnsetIdx: (S && S.trainOnsetIdx) || 0,
        score: 0,
        totalQuiz: 8,
        quizDone: 0,
        streak: 0,
        over: false
      };

      render();
      if (mainMode === 'phonics' && phonicsTab === 'soundout' && S.words.length) {
        speakWord(S.words[S.idx].word);
      }
      updateStatus();
    }

    function updateStatus() {
      if (!api || !S) return;
      var unitInfo = UNITS[S.unit] || UNITS['u1'];
      if (S.mainMode === 'lesson') {
        var les = LESSON_DATA[S.unit] || LESSON_DATA['u1'];
        api.status('📖 课本同步 · ' + les.book + ' · ' + les.title);
      } else if (S.mainMode === 'phonics') {
        if (S.phonicsTab === 'train') {
          var fam = WORD_FAMILIES[S.trainFamilyIdx] || WORD_FAMILIES[0];
          api.status('🚂 碰头小火车 · ' + fam.label);
        } else {
          api.status('🧩 音素拆读机 · 第 ' + (S.idx + 1) + ' / ' + S.words.length + ' 词 · ' + unitInfo.label);
        }
      } else if (S.mainMode === 'practice') {
        if (S.practiceTab === 'quiz') {
          api.status('🎯 听音辨音大闯关 · 得分: ' + S.score + ' · 连对: ' + S.streak + ' ⭐');
        } else {
          api.status('🌅 昨日温故唤醒舱 · 抗遗忘强化中');
        }
      }
      api.changed();
    }

    /* ---------------- 界面主渲染 ---------------- */
    function render() {
      if (!host || !S) return;

      var dueList = getReviewDueWords();

      var html = '<div class="pep-wrap">';

      // 🌟 三大系统化核心主导航条 (大卡片式触控，杜绝小按钮拥挤)
      html += '<div class="pep-main-nav">' +
        '<button type="button" class="pep-main-tab ' + (S.mainMode === 'lesson' ? 'active' : '') + '" data-main="lesson">' +
          '<span class="pmt-icon">📖</span>' +
          '<span class="pmt-title">课本同步课堂</span>' +
          '<span class="pmt-sub">人教 3A 课文点读</span>' +
        '</button>' +
        '<button type="button" class="pep-main-tab ' + (S.mainMode === 'phonics' ? 'active' : '') + '" data-main="phonics">' +
          '<span class="pmt-icon">🚂</span>' +
          '<span class="pmt-title">自然拼读小火车</span>' +
          '<span class="pmt-sub">碰头拼读 · 音素拆解</span>' +
        '</button>' +
        '<button type="button" class="pep-main-tab ' + (S.mainMode === 'practice' ? 'active' : '') + '" data-main="practice">' +
          '<span class="pmt-icon">🎯</span>' +
          '<span class="pmt-title">闯关与抗遗忘</span>' +
          '<span class="pmt-sub">听音辨音 · 昨日温故</span>' +
          (dueList.length > 0 ? '<span class="pmt-badge">' + dueList.length + '</span>' : '') +
        '</button>' +
      '</div>';

      // 针对自然拼读 / 闯关模式的次级工具分段条
      if (S.mainMode === 'phonics') {
        html += '<div class="pep-sub-nav">' +
          '<button type="button" class="pep-sub-btn ' + (S.phonicsTab === 'train' ? 'active' : '') + '" data-sub="train">🚂 碰头拼读小火车 (词族公式推导)</button>' +
          '<button type="button" class="pep-sub-btn ' + (S.phonicsTab === 'soundout' ? 'active' : '') + '" data-sub="soundout">🧩 单词音素拆读机 (逐音拆解自测)</button>' +
        '</div>';
      } else if (S.mainMode === 'practice') {
        html += '<div class="pep-sub-nav">' +
          '<button type="button" class="pep-sub-btn ' + (S.practiceTab === 'quiz' ? 'active' : '') + '" data-sub="quiz">🎮 听音辨音大闯关 (易混听力测验)</button>' +
          '<button type="button" class="pep-sub-btn ' + (S.practiceTab === 'review' ? 'active' : '') + '" data-sub="review">🌅 昨日温故唤醒舱 (' + dueList.length + ' 词待温故)</button>' +
        '</div>';
      }

      // 各自模式的主视图渲染
      if (S.mainMode === 'lesson') {
        html += renderLessonView();
      } else if (S.mainMode === 'phonics') {
        if (S.phonicsTab === 'train') {
          html += renderTrainView();
        } else {
          html += renderSoundOutView();
        }
      } else if (S.mainMode === 'practice') {
        if (S.practiceTab === 'quiz') {
          html += renderQuizView();
        } else {
          html += renderReviewHomeView(dueList);
        }
      }

      html += '</div>';
      host.innerHTML = html;
      bindEvents();
    }

    /* ============================================================
       PEP 人教版矢量绘本插画系统 (100% 离线、高清不失真矢量 SVG)
       - 课文情景大图 (Let's talk 真实教材情景还原)
       - 核心生词图文闪卡 (Let's learn 专属视觉记忆锚点)
       - 课标金句情景徽章 (Key Patterns 语境微插画)
       - 趣味歌谣律动横幅 (Let's chant 韵律音符)
       ============================================================ */
    var PepIllustrations = (function () {
      function wrapSvg(w, h, content, className) {
        className = className || '';
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" class="' + className + '" preserveAspectRatio="xMidYMid meet">' + content + '</svg>';
      }

      /* 1. 单元情景大图 (Scene Illustrations) */
      /* 1. 单元情景大图 (Scene Illustrations) - 支持语意多幕分镜剧场 */
      function getSceneSvg(unitKey, actIdx) {
        actIdx = typeof actIdx === 'number' ? actIdx : 0;
        var defs = '<defs>' +
          '<linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#bae6fd"/><stop offset="100%" stop-color="#e0f2fe"/></linearGradient>' +
          '<linearGradient id="grassGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#86efac"/><stop offset="100%" stop-color="#22c55e"/></linearGradient>' +
          '<linearGradient id="warmWallGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#fef3c7"/><stop offset="100%" stop-color="#fed7aa"/></linearGradient>' +
          '<linearGradient id="sunGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fde047"/><stop offset="100%" stop-color="#f59e0b"/></linearGradient>' +
          '<linearGradient id="rainbowGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ef4444"/><stop offset="20%" stop-color="#f97316"/><stop offset="40%" stop-color="#eab308"/><stop offset="60%" stop-color="#22c55e"/><stop offset="80%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#a855f7"/></linearGradient>' +
          '<filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-opacity="0.15"/></filter>' +
        '</defs>';

        var c = '';
        if (unitKey === 'u1') {
          // Unit 1 分镜剧场 (4幕语意画卷)
          if (actIdx === 0) {
            // 第1幕：校门清晨相遇问候 (Mike & Wu Binbin 打招呼)
            c = defs +
              '<rect width="600" height="240" rx="16" fill="url(#skyGrad)"/>' +
              '<circle cx="80" cy="50" r="36" fill="url(#sunGrad)" opacity="0.95"/>' +
              '<circle cx="80" cy="50" r="48" fill="#fef08a" opacity="0.35"/>' +
              '<path d="M 60 180 A 240 160 0 0 1 540 180" fill="none" stroke="url(#rainbowGrad)" stroke-width="6" opacity="0.4"/>' +
              '<path d="M 180 50 Q 200 35 225 45 Q 250 35 270 50 Q 290 60 265 75 Q 235 80 200 75 Q 170 65 180 50 Z" fill="#ffffff" opacity="0.85"/>' +
              '<rect x="230" y="70" width="140" height="100" fill="#fca5a5" rx="6"/>' +
              '<polygon points="220,70 300,30 380,70" fill="#dc2626"/>' +
              '<rect x="280" y="42" width="40" height="28" fill="#f87171" rx="4"/>' +
              '<circle cx="300" cy="56" r="10" fill="#ffffff"/>' +
              '<line x1="300" y1="56" x2="300" y2="50" stroke="#0f172a" stroke-width="2"/>' +
              '<line x1="300" y1="56" x2="305" y2="56" stroke="#0f172a" stroke-width="2"/>' +
              '<rect x="250" y="90" width="24" height="30" fill="#e0f2fe" rx="3"/>' +
              '<rect x="326" y="90" width="24" height="30" fill="#e0f2fe" rx="3"/>' +
              '<rect x="282" y="125" width="36" height="45" fill="#78350f" rx="4"/>' +
              '<rect x="240" y="170" width="120" height="14" rx="4" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5"/>' +
              '<text x="300" y="181" font-size="9" font-weight="900" fill="#b45309" text-anchor="middle">🏫 PEP PRIMARY SCHOOL</text>' +
              '<path d="M 0 165 Q 150 145 300 165 Q 450 180 600 160 L 600 240 L 0 240 Z" fill="url(#grassGrad)"/>' +
              '<g transform="translate(80, 85)" filter="url(#softShadow)">' +
                '<rect x="-8" y="40" width="16" height="30" rx="5" fill="#2563eb"/>' +
                '<rect x="10" y="32" width="30" height="45" rx="8" fill="#38bdf8"/>' +
                '<rect x="14" y="77" width="9" height="38" rx="4" fill="#1e3a8a"/>' +
                '<rect x="27" y="77" width="9" height="38" rx="4" fill="#1e3a8a"/>' +
                '<ellipse cx="18" cy="116" rx="8" ry="4" fill="#475569"/><ellipse cx="32" cy="116" rx="8" ry="4" fill="#475569"/>' +
                '<ellipse cx="25" cy="18" rx="14" ry="15" fill="#fde047"/>' +
                '<ellipse cx="25" cy="20" rx="13" ry="14" fill="#fed7aa"/>' +
                '<path d="M 12 18 Q 25 5 38 18 Q 32 9 25 10 Q 18 9 12 18 Z" fill="#eab308"/>' +
                '<circle cx="21" cy="18" r="2.5" fill="#0f172a"/><circle cx="29" cy="18" r="2.5" fill="#0f172a"/>' +
                '<path d="M 22 25 Q 25 29 28 25" stroke="#e11d48" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
                '<path d="M 38 38 Q 55 18 62 4" stroke="#fed7aa" stroke-width="7" stroke-linecap="round" fill="none"/>' +
                '<circle cx="63" cy="3" r="5" fill="#fed7aa"/>' +
                '<g transform="translate(45, -24)">' +
                  '<rect x="0" y="0" width="112" height="28" rx="8" fill="#ffffff" stroke="#38bdf8" stroke-width="2"/>' +
                  '<polygon points="8,28 14,35 18,28" fill="#ffffff"/>' +
                  '<polygon points="8,28 14,35 18,28" stroke="#38bdf8" stroke-width="2" fill="none"/>' +
                  '<text x="56" y="18" font-size="11" font-weight="bold" fill="#0369a1" text-anchor="middle">Hello! I\'m Mike</text>' +
                '</g>' +
              '</g>' +
              '<g transform="translate(420, 85)" filter="url(#softShadow)">' +
                '<rect x="42" y="40" width="16" height="30" rx="5" fill="#10b981"/>' +
                '<rect x="10" y="32" width="30" height="45" rx="8" fill="#f97316"/>' +
                '<rect x="14" y="77" width="9" height="38" rx="4" fill="#334155"/>' +
                '<rect x="27" y="77" width="9" height="38" rx="4" fill="#334155"/>' +
                '<ellipse cx="18" cy="116" rx="8" ry="4" fill="#0f172a"/><ellipse cx="32" cy="116" rx="8" ry="4" fill="#0f172a"/>' +
                '<ellipse cx="25" cy="20" rx="13" ry="14" fill="#fed7aa"/>' +
                '<path d="M 12 18 Q 25 4 38 18 Q 34 10 25 10 Q 16 10 12 18 Z" fill="#1e293b"/>' +
                '<circle cx="21" cy="18" r="2.5" fill="#0f172a"/><circle cx="29" cy="18" r="2.5" fill="#0f172a"/>' +
                '<path d="M 22 25 Q 25 29 28 25" stroke="#e11d48" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
                '<path d="M 12 38 Q -6 20 -12 6" stroke="#fed7aa" stroke-width="7" stroke-linecap="round" fill="none"/>' +
                '<circle cx="-13" cy="5" r="5" fill="#fed7aa"/>' +
                '<g transform="translate(-75, -24)">' +
                  '<rect x="0" y="0" width="118" height="28" rx="8" fill="#ffffff" stroke="#f97316" stroke-width="2"/>' +
                  '<polygon points="98,28 104,35 108,28" fill="#ffffff"/>' +
                  '<polygon points="98,28 104,35 108,28" stroke="#f97316" stroke-width="2" fill="none"/>' +
                  '<text x="59" y="18" font-size="11" font-weight="bold" fill="#c2410c" text-anchor="middle">Hi! Wu Binbin</text>' +
                '</g>' +
              '</g>';
          } else if (actIdx === 1) {
            // 第2幕：草坪树荫礼貌握手 (Nice to meet you)
            c = defs +
              '<rect width="600" height="240" rx="16" fill="url(#skyGrad)"/>' +
              '<circle cx="510" cy="50" r="32" fill="url(#sunGrad)" opacity="0.9"/>' +
              '<circle cx="70" cy="100" r="55" fill="#86efac" opacity="0.7"/>' +
              '<circle cx="530" cy="110" r="60" fill="#86efac" opacity="0.7"/>' +
              '<path d="M 0 150 Q 200 130 400 145 Q 520 135 600 145 L 600 240 L 0 240 Z" fill="url(#grassGrad)"/>' +
              '<g transform="translate(40, 180)"><circle cx="10" cy="10" r="6" fill="#f43f5e"/><circle cx="10" cy="10" r="2.5" fill="#fef08a"/></g>' +
              '<g transform="translate(90, 195)"><circle cx="10" cy="10" r="5" fill="#a855f7"/><circle cx="10" cy="10" r="2" fill="#fef08a"/></g>' +
              '<g transform="translate(480, 185)"><circle cx="10" cy="10" r="6" fill="#fbbf24"/><circle cx="10" cy="10" r="2.5" fill="#ffffff"/></g>' +
              '<g transform="translate(540, 195)"><circle cx="10" cy="10" r="5" fill="#38bdf8"/><circle cx="10" cy="10" r="2" fill="#ffffff"/></g>' +
              '<g transform="translate(190, 75)" filter="url(#softShadow)">' +
                '<rect x="6" y="42" width="34" height="52" rx="10" fill="#38bdf8"/>' +
                '<rect x="11" y="94" width="10" height="42" rx="5" fill="#1e3a8a"/>' +
                '<rect x="25" y="94" width="10" height="42" rx="5" fill="#1e3a8a"/>' +
                '<ellipse cx="15" cy="138" rx="9" ry="5" fill="#475569"/><ellipse cx="30" cy="138" rx="9" ry="5" fill="#475569"/>' +
                '<ellipse cx="23" cy="22" rx="15" ry="16" fill="#fde047"/>' +
                '<ellipse cx="23" cy="24" rx="14" ry="15" fill="#fed7aa"/>' +
                '<path d="M 10 21 Q 23 7 36 21 Q 30 11 23 12 Q 16 11 10 21 Z" fill="#eab308"/>' +
                '<circle cx="19" cy="21" r="2.5" fill="#0f172a"/><circle cx="27" cy="21" r="2.5" fill="#0f172a"/>' +
                '<path d="M 19 28 Q 23 33 27 28" stroke="#e11d48" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
                '<path d="M 36 56 L 68 68" stroke="#fed7aa" stroke-width="8" stroke-linecap="round"/>' +
                '<g transform="translate(-60, -25)">' +
                  '<rect x="0" y="0" width="128" height="28" rx="10" fill="#ffffff" stroke="#38bdf8" stroke-width="2"/>' +
                  '<polygon points="70,28 76,36 82,28" fill="#ffffff"/>' +
                  '<polygon points="70,28 76,36 82,28" stroke="#38bdf8" stroke-width="2" fill="none"/>' +
                  '<text x="64" y="19" font-size="11.5" font-weight="bold" fill="#0369a1" text-anchor="middle">Nice to meet you.</text>' +
                '</g>' +
              '</g>' +
              '<g transform="translate(340, 75)" filter="url(#softShadow)">' +
                '<rect x="6" y="42" width="34" height="52" rx="10" fill="#f97316"/>' +
                '<rect x="11" y="94" width="10" height="42" rx="5" fill="#334155"/>' +
                '<rect x="25" y="94" width="10" height="42" rx="5" fill="#334155"/>' +
                '<ellipse cx="15" cy="138" rx="9" ry="5" fill="#0f172a"/><ellipse cx="30" cy="138" rx="9" ry="5" fill="#0f172a"/>' +
                '<ellipse cx="23" cy="24" rx="14" ry="15" fill="#fed7aa"/>' +
                '<path d="M 10 20 Q 23 6 36 20 Q 31 12 23 12 Q 15 12 10 20 Z" fill="#1e293b"/>' +
                '<circle cx="19" cy="21" r="2.5" fill="#0f172a"/><circle cx="27" cy="21" r="2.5" fill="#0f172a"/>' +
                '<path d="M 19 28 Q 23 33 27 28" stroke="#e11d48" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
                '<path d="M 8 56 L -24 68" stroke="#fed7aa" stroke-width="8" stroke-linecap="round"/>' +
                '<g transform="translate(-10, -25)">' +
                  '<rect x="0" y="0" width="144" height="28" rx="10" fill="#ffffff" stroke="#f97316" stroke-width="2"/>' +
                  '<polygon points="40,28 46,36 52,28" fill="#ffffff"/>' +
                  '<polygon points="40,28 46,36 52,28" stroke="#f97316" stroke-width="2" fill="none"/>' +
                  '<text x="72" y="19" font-size="11.5" font-weight="bold" fill="#c2410c" text-anchor="middle">Nice to meet you, too.</text>' +
                '</g>' +
              '</g>' +
              '<g transform="translate(290, 138)">' +
                '<circle cx="0" cy="0" r="16" fill="#fde047" opacity="0.6"/>' +
                '<text x="0" y="7" font-size="22" text-anchor="middle">🤝</text>' +
                '<path d="M -12 -12 L -6 -6 M 12 -12 L 6 -6 M -12 12 L -6 6 M 12 12 L 6 6" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round"/>' +
              '</g>';
          } else if (actIdx === 2) {
            // 第3幕：教室新朋自我介绍 (Sarah & John)
            c = defs +
              '<rect width="600" height="240" rx="16" fill="url(#warmWallGrad)"/>' +
              '<rect x="0" y="180" width="600" height="60" fill="#b45309"/>' +
              '<line x1="0" y1="180" x2="600" y2="180" stroke="#78350f" stroke-width="3"/>' +
              '<rect x="30" y="30" width="90" height="110" rx="6" fill="#e0f2fe" stroke="#0284c7" stroke-width="4"/>' +
              '<line x1="75" y1="30" x2="75" y2="140" stroke="#0284c7" stroke-width="2"/>' +
              '<line x1="30" y1="85" x2="120" y2="85" stroke="#0284c7" stroke-width="2"/>' +
              '<circle cx="55" cy="55" r="14" fill="url(#sunGrad)"/>' +
              '<rect x="150" y="25" width="300" height="120" rx="10" fill="#1e3a1e" stroke="#78350f" stroke-width="6"/>' +
              '<rect x="156" y="31" width="288" height="108" rx="6" fill="#14532d"/>' +
              '<text x="300" y="62" font-size="14" font-weight="900" fill="#fef08a" text-anchor="middle">🌟 Welcome New Friends! 🌟</text>' +
              '<text x="300" y="86" font-size="11" font-weight="700" fill="#bbf7d0" text-anchor="middle">PEP Grade 3 · 认识新同学</text>' +
              '<path d="M 180 115 L 420 115" stroke="#86efac" stroke-width="1.5" stroke-dasharray="4,4"/>' +
              '<text x="300" y="110" font-size="10" font-weight="bold" fill="#ffffff" text-anchor="middle">A  B  C  D  E  F  G</text>' +
              '<circle cx="490" cy="45" r="18" fill="#ffffff" stroke="#d97706" stroke-width="2.5"/>' +
              '<circle cx="490" cy="45" r="2" fill="#0f172a"/>' +
              '<line x1="490" y1="45" x2="490" y2="35" stroke="#0f172a" stroke-width="2"/>' +
              '<line x1="490" y1="45" x2="498" y2="45" stroke="#0f172a" stroke-width="2"/>' +
              '<g transform="translate(130, 95)" filter="url(#softShadow)">' +
                '<rect x="10" y="36" width="28" height="42" rx="8" fill="#f43f5e"/>' +
                '<rect x="14" y="78" width="8" height="34" rx="4" fill="#fed7aa"/>' +
                '<rect x="26" y="78" width="8" height="34" rx="4" fill="#fed7aa"/>' +
                '<ellipse cx="17" cy="113" rx="7" ry="4" fill="#ec4899"/><ellipse cx="31" cy="113" rx="7" ry="4" fill="#ec4899"/>' +
                '<circle cx="24" cy="20" r="13" fill="#fed7aa"/>' +
                '<path d="M 11 18 Q 24 5 37 18" fill="#fde047"/>' +
                '<circle cx="9" cy="16" r="6" fill="#f43f5e"/><circle cx="39" cy="16" r="6" fill="#f43f5e"/>' +
                '<circle cx="20" cy="19" r="2" fill="#0f172a"/><circle cx="28" cy="19" r="2" fill="#0f172a"/>' +
                '<path d="M 21 24 Q 24 28 27 24" stroke="#e11d48" stroke-width="2" fill="none" stroke-linecap="round"/>' +
                '<path d="M 10 40 Q -4 25 -6 12" stroke="#fed7aa" stroke-width="6" stroke-linecap="round" fill="none"/>' +
                '<g transform="translate(-40, -22)">' +
                  '<rect x="0" y="0" width="128" height="26" rx="8" fill="#ffffff" stroke="#f43f5e" stroke-width="2"/>' +
                  '<polygon points="40,26 46,33 50,26" fill="#ffffff"/>' +
                  '<polygon points="40,26 46,33 50,26" stroke="#f43f5e" stroke-width="2" fill="none"/>' +
                  '<text x="64" y="17" font-size="11" font-weight="bold" fill="#be123c" text-anchor="middle">Hello! My name is Sarah.</text>' +
                '</g>' +
              '</g>' +
              '<g transform="translate(380, 95)" filter="url(#softShadow)">' +
                '<rect x="10" y="36" width="28" height="42" rx="8" fill="#2563eb"/>' +
                '<rect x="14" y="78" width="8" height="34" rx="4" fill="#1e293b"/>' +
                '<rect x="26" y="78" width="8" height="34" rx="4" fill="#1e293b"/>' +
                '<ellipse cx="17" cy="113" rx="7" ry="4" fill="#0f172a"/><ellipse cx="31" cy="113" rx="7" ry="4" fill="#0f172a"/>' +
                '<circle cx="24" cy="20" r="13" fill="#fed7aa"/>' +
                '<path d="M 11 18 Q 24 5 37 18" fill="#78350f"/>' +
                '<circle cx="20" cy="19" r="2" fill="#0f172a"/><circle cx="28" cy="19" r="2" fill="#0f172a"/>' +
                '<path d="M 21 24 Q 24 28 27 24" stroke="#e11d48" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
                '<path d="M 38 40 Q 52 25 54 12" stroke="#fed7aa" stroke-width="6" stroke-linecap="round" fill="none"/>' +
                '<g transform="translate(10, -22)">' +
                  '<rect x="0" y="0" width="85" height="26" rx="8" fill="#ffffff" stroke="#2563eb" stroke-width="2"/>' +
                  '<polygon points="12,26 18,33 22,26" fill="#ffffff"/>' +
                  '<polygon points="12,26 18,33 22,26" stroke="#2563eb" stroke-width="2" fill="none"/>' +
                  '<text x="42" y="17" font-size="11" font-weight="bold" fill="#1d4ed8" text-anchor="middle">Hi! I\'m John.</text>' +
                '</g>' +
              '</g>';
          } else {
            // 第4幕：课桌文具温暖分享 (We can share)
            c = defs +
              '<rect width="600" height="240" rx="16" fill="#fef2f2"/>' +
              '<path d="M 0 0 L 600 0 L 600 130 L 0 130 Z" fill="#fff7ed"/>' +
              '<rect x="30" y="125" width="540" height="95" rx="12" fill="#fde68a" stroke="#d97706" stroke-width="3"/>' +
              '<rect x="40" y="135" width="520" height="80" rx="8" fill="#fef3c7"/>' +
              '<g transform="translate(240, 142)">' +
                '<rect x="0" y="10" width="115" height="42" rx="12" fill="#38bdf8" stroke="#0284c7" stroke-width="2"/>' +
                '<line x1="0" y1="26" x2="115" y2="26" stroke="#ffffff" stroke-width="3"/>' +
                '<rect x="15" y="4" width="12" height="32" rx="2" fill="#ef4444" transform="rotate(-15 15 4)"/>' +
                '<rect x="35" y="6" width="12" height="30" rx="2" fill="#eab308" transform="rotate(-8 35 6)"/>' +
                '<rect x="55" y="8" width="12" height="28" rx="2" fill="#10b981" transform="rotate(5 55 8)"/>' +
                '<rect x="75" y="4" width="12" height="32" rx="2" fill="#a855f7" transform="rotate(12 75 4)"/>' +
                '<rect x="15" y="48" width="80" height="14" rx="2" fill="#facc15" stroke="#ca8a04" stroke-width="1.5"/>' +
                '<line x1="25" y1="48" x2="25" y2="54" stroke="#78350f" stroke-width="1"/>' +
                '<line x1="35" y1="48" x2="35" y2="54" stroke="#78350f" stroke-width="1"/>' +
                '<line x1="45" y1="48" x2="45" y2="54" stroke="#78350f" stroke-width="1"/>' +
                '<line x1="55" y1="48" x2="55" y2="54" stroke="#78350f" stroke-width="1"/>' +
                '<line x1="65" y1="48" x2="65" y2="54" stroke="#78350f" stroke-width="1"/>' +
                '<line x1="75" y1="48" x2="75" y2="54" stroke="#78350f" stroke-width="1"/>' +
                '<rect x="98" y="48" width="24" height="15" rx="3" fill="#f43f5e"/>' +
              '</g>' +
              '<g transform="translate(90, 45)" filter="url(#softShadow)">' +
                '<circle cx="30" cy="30" r="18" fill="#fed7aa"/>' +
                '<path d="M 12 28 Q 30 12 48 28" fill="#1e293b"/>' +
                '<circle cx="24" cy="28" r="2.5" fill="#0f172a"/><circle cx="36" cy="28" r="2.5" fill="#0f172a"/>' +
                '<path d="M 25 36 Q 30 42 35 36" stroke="#e11d48" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
                '<rect x="12" y="48" width="36" height="42" rx="8" fill="#8b5cf6"/>' +
                '<path d="M 46 58 Q 70 65 95 62" stroke="#fed7aa" stroke-width="7" stroke-linecap="round" fill="none"/>' +
                '<g transform="translate(-20, -32)">' +
                  '<rect x="0" y="0" width="130" height="26" rx="8" fill="#ffffff" stroke="#8b5cf6" stroke-width="2"/>' +
                  '<polygon points="40,26 46,33 50,26" fill="#ffffff"/>' +
                  '<polygon points="40,26 46,33 50,26" stroke="#8b5cf6" stroke-width="2" fill="none"/>' +
                  '<text x="65" y="17" font-size="11" font-weight="bold" fill="#6d28d9" text-anchor="middle">Thank you, Sarah! ❤️</text>' +
                '</g>' +
              '</g>' +
              '<g transform="translate(420, 45)" filter="url(#softShadow)">' +
                '<circle cx="30" cy="30" r="18" fill="#fed7aa"/>' +
                '<path d="M 12 28 Q 30 12 48 28" fill="#fde047"/>' +
                '<circle cx="24" cy="28" r="2.5" fill="#0f172a"/><circle cx="36" cy="28" r="2.5" fill="#0f172a"/>' +
                '<path d="M 25 36 Q 30 42 35 36" stroke="#e11d48" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
                '<rect x="12" y="48" width="36" height="42" rx="8" fill="#f43f5e"/>' +
                '<path d="M 14 58 Q -10 65 -35 62" stroke="#fed7aa" stroke-width="7" stroke-linecap="round" fill="none"/>' +
                '<g transform="translate(-30, -32)">' +
                  '<rect x="0" y="0" width="150" height="26" rx="8" fill="#ecfdf5" stroke="#10b981" stroke-width="2"/>' +
                  '<polygon points="80,26 86,33 90,26" fill="#ecfdf5"/>' +
                  '<polygon points="80,26 86,33 90,26" stroke="#10b981" stroke-width="2" fill="none"/>' +
                  '<text x="75" y="17" font-size="11" font-weight="bold" fill="#047857" text-anchor="middle">It\'s OK. We can share!</text>' +
                '</g>' +
              '</g>' +
              '<g transform="translate(160, 205)">' +
                '<rect x="0" y="0" width="280" height="26" rx="13" fill="#10b981" filter="url(#softShadow)"/>' +
                '<text x="140" y="17" font-size="11.5" font-weight="900" fill="#ffffff" text-anchor="middle">🤝 Friends help each other · 好朋友互相帮助</text>' +
              '</g>';
          }
        } else if (unitKey === 'u2') {
          // Unit 2: 温馨家庭客厅与全家福大合影金相框
          c = defs +
            '<rect width="600" height="240" rx="16" fill="url(#warmWallGrad)"/>' +
            '<line x1="0" y1="70" x2="600" y2="70" stroke="#fde68a" stroke-width="2"/>' +
            '<path d="M 100 0 L 100 40" stroke="#78350f" stroke-width="2"/>' +
            '<path d="M 85 40 Q 100 30 115 40 L 125 58 L 75 58 Z" fill="#f59e0b"/>' +
            '<ellipse cx="100" cy="58" rx="25" ry="6" fill="#fef08a" opacity="0.6"/>' +
            '<g transform="translate(180, 20)" filter="url(#softShadow)">' +
              '<rect x="0" y="0" width="240" height="150" rx="10" fill="#fef9c3" stroke="#b45309" stroke-width="6"/>' +
              '<rect x="6" y="6" width="228" height="138" rx="6" fill="#ffffff"/>' +
              '<rect x="70" y="10" width="100" height="18" rx="9" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5"/>' +
              '<text x="120" y="23" font-size="10" font-weight="bold" fill="#b45309" text-anchor="middle">❤️ Our Big Family</text>' +
              // Grandpa
              '<g transform="translate(25, 38)"><circle cx="16" cy="16" r="14" fill="#fed7aa"/><path d="M 2 14 Q 16 0 30 14" fill="#e2e8f0"/><circle cx="11" cy="15" r="4" fill="none" stroke="#64748b" stroke-width="1.5"/><circle cx="21" cy="15" r="4" fill="none" stroke="#64748b" stroke-width="1.5"/><line x1="15" y1="15" x2="17" y2="15" stroke="#64748b" stroke-width="1.5"/><rect x="6" y="32" width="20" height="28" rx="4" fill="#0284c7"/><text x="16" y="69" font-size="8" font-weight="bold" fill="#475569" text-anchor="middle">Grandpa</text></g>' +
              // Grandma
              '<g transform="translate(68, 38)"><circle cx="16" cy="16" r="14" fill="#fed7aa"/><circle cx="16" cy="2" r="6" fill="#cbd5e1"/><path d="M 3 14 Q 16 4 29 14" fill="#cbd5e1"/><circle cx="11" cy="16" r="3.5" fill="none" stroke="#e11d48" stroke-width="1.2"/><circle cx="21" cy="16" r="3.5" fill="none" stroke="#e11d48" stroke-width="1.2"/><rect x="6" y="32" width="20" height="28" rx="4" fill="#be185d"/><text x="16" y="69" font-size="8" font-weight="bold" fill="#475569" text-anchor="middle">Grandma</text></g>' +
              // Father
              '<g transform="translate(112, 38)"><circle cx="16" cy="16" r="14" fill="#fed7aa"/><path d="M 2 12 Q 16 0 30 12" fill="#334155"/><circle cx="11" cy="16" r="2" fill="#0f172a"/><circle cx="21" cy="16" r="2" fill="#0f172a"/><rect x="6" y="32" width="20" height="28" rx="4" fill="#1e40af"/><polygon points="16,33 13,44 16,50 19,44" fill="#ef4444"/><text x="16" y="69" font-size="8" font-weight="bold" fill="#475569" text-anchor="middle">Father</text></g>' +
              // Mother
              '<g transform="translate(156, 38)"><circle cx="16" cy="16" r="14" fill="#fed7aa"/><path d="M 2 16 Q 16 2 30 16 Q 28 32 30 36 Q 2 36 4 32 Z" fill="#92400e"/><circle cx="11" cy="16" r="2" fill="#0f172a"/><circle cx="21" cy="16" r="2" fill="#0f172a"/><rect x="6" y="32" width="20" height="28" rx="4" fill="#db2777"/><text x="16" y="69" font-size="8" font-weight="bold" fill="#475569" text-anchor="middle">Mother</text></g>' +
              // Brother
              '<g transform="translate(196, 44)"><circle cx="12" cy="12" r="10" fill="#fed7aa"/><path d="M 2 10 Q 12 2 22 10" fill="#f59e0b"/><rect x="4" y="24" width="16" height="22" rx="3" fill="#10b981"/><text x="12" y="55" font-size="8" font-weight="bold" fill="#475569" text-anchor="middle">Me</text></g>' +
            '</g>' +
            '<rect x="0" y="190" width="600" height="50" fill="#b45309"/>' +
            '<ellipse cx="300" cy="215" rx="220" ry="20" fill="#fef08a" opacity="0.4"/>' +
            '<g transform="translate(30, 150)"><rect x="0" y="20" width="120" height="40" rx="10" fill="#93c5fd"/><rect x="10" y="5" width="100" height="25" rx="8" fill="#60a5fa"/></g>' +
            '<g transform="translate(450, 160)"><ellipse cx="50" cy="35" rx="45" ry="12" fill="#78350f"/><rect x="42" y="15" width="16" height="20" rx="4" fill="#38bdf8"/><circle cx="50" cy="5" r="7" fill="#fb7185"/></g>';
        } else if (unitKey === 'u3') {
          // Unit 3: 奇妙动物乐园 (大熊猫吃竹子、小白兔吃胡萝卜、小狗小猫)
          c = defs +
            '<rect width="600" height="240" rx="16" fill="url(#skyGrad)"/>' +
            '<path d="M 0 160 Q 120 90 240 160 Q 360 80 500 150 Q 560 120 600 140 L 600 240 L 0 240 Z" fill="#bbf7d0" opacity="0.6"/>' +
            '<circle cx="530" cy="55" r="28" fill="url(#sunGrad)"/>' +
            '<path d="M 0 165 Q 180 140 380 160 Q 500 170 600 155 L 600 240 L 0 240 Z" fill="url(#grassGrad)"/>' +
            '<path d="M 230 240 Q 280 190 320 200 Q 370 210 400 240 Z" fill="#38bdf8" opacity="0.7"/>' +
            '<g transform="translate(30, 40)"><line x1="20" y1="160" x2="20" y2="0" stroke="#16a34a" stroke-width="7"/><line x1="45" y1="160" x2="45" y2="10" stroke="#22c55e" stroke-width="8"/></g>' +
            '<g transform="translate(100, 100)" filter="url(#softShadow)">' +
              '<ellipse cx="45" cy="65" rx="36" ry="32" fill="#ffffff" stroke="#0f172a" stroke-width="1.5"/>' +
              '<ellipse cx="20" cy="90" rx="14" ry="10" fill="#0f172a"/><ellipse cx="70" cy="90" rx="14" ry="10" fill="#0f172a"/>' +
              '<path d="M 15 55 Q 35 68 55 60" stroke="#0f172a" stroke-width="14" stroke-linecap="round" fill="none"/>' +
              '<line x1="38" y1="35" x2="48" y2="85" stroke="#22c55e" stroke-width="6" stroke-linecap="round"/>' +
              '<circle cx="45" cy="32" r="26" fill="#ffffff" stroke="#0f172a" stroke-width="1.5"/>' +
              '<circle cx="23" cy="13" r="10" fill="#0f172a"/><circle cx="67" cy="13" r="10" fill="#0f172a"/>' +
              '<ellipse cx="35" cy="30" rx="7" ry="9" fill="#0f172a" transform="rotate(-15 35 30)"/>' +
              '<ellipse cx="55" cy="30" rx="7" ry="9" fill="#0f172a" transform="rotate(15 55 30)"/>' +
              '<circle cx="36" cy="29" r="2.5" fill="#ffffff"/><circle cx="54" cy="29" r="2.5" fill="#ffffff"/>' +
              '<ellipse cx="45" cy="40" rx="4" ry="3" fill="#0f172a"/>' +
              '<rect x="20" y="105" width="50" height="18" rx="9" fill="#f8fafc" stroke="#334155" stroke-width="1.2"/>' +
              '<text x="45" y="118" font-size="10" font-weight="bold" fill="#0f172a" text-anchor="middle">🐼 Panda</text>' +
            '</g>' +
            '<g transform="translate(260, 130)" filter="url(#softShadow)">' +
              '<ellipse cx="25" cy="50" rx="18" ry="16" fill="#ffffff"/>' +
              '<ellipse cx="18" cy="14" rx="5" ry="16" fill="#ffffff"/><ellipse cx="18" cy="14" rx="2.5" ry="12" fill="#fbcfe8"/>' +
              '<ellipse cx="30" cy="14" rx="5" ry="16" fill="#ffffff"/><ellipse cx="30" cy="14" rx="2.5" ry="12" fill="#fbcfe8"/>' +
              '<circle cx="25" cy="32" r="14" fill="#ffffff"/><circle cx="20" cy="30" r="2" fill="#e11d48"/><circle cx="30" cy="30" r="2" fill="#e11d48"/>' +
              '<polygon points="35,46 45,62 38,62" fill="#f97316"/>' +
              '<rect x="3" y="68" width="46" height="16" rx="8" fill="#fdf2f8" stroke="#f472b6" stroke-width="1.2"/>' +
              '<text x="26" y="80" font-size="9" font-weight="bold" fill="#db2777" text-anchor="middle">🐰 Rabbit</text>' +
            '</g>' +
            '<g transform="translate(370, 135)" filter="url(#softShadow)">' +
              '<ellipse cx="30" cy="45" rx="20" ry="16" fill="#f59e0b"/><circle cx="22" cy="26" r="14" fill="#f59e0b"/>' +
              '<ellipse cx="10" cy="26" rx="5" ry="10" fill="#d97706"/><ellipse cx="34" cy="26" rx="5" ry="10" fill="#d97706"/>' +
              '<circle cx="18" cy="24" r="2" fill="#0f172a"/><circle cx="26" cy="24" r="2" fill="#0f172a"/>' +
              '<rect x="8" y="65" width="40" height="16" rx="8" fill="#fffbeb" stroke="#f59e0b" stroke-width="1.2"/>' +
              '<text x="28" y="77" font-size="9" font-weight="bold" fill="#b45309" text-anchor="middle">🐶 Dog</text>' +
            '</g>' +
            '<g transform="translate(480, 80)"><circle cx="25" cy="12" r="12" fill="#38bdf8"/><polygon points="35,12 43,15 35,18" fill="#f59e0b"/><text x="25" y="4" font-size="12" fill="#0284c7">🎶</text></g>';
        } else if (unitKey === 'u4') {
          // Unit 4: 阳光果园与植物温室 (大苹果树、香蕉、向日葵花田、花洒)
          c = defs +
            '<rect width="600" height="240" rx="16" fill="url(#skyGrad)"/>' +
            '<circle cx="500" cy="50" r="42" fill="url(#sunGrad)"/>' +
            '<path d="M 0 160 Q 150 140 300 160 Q 450 175 600 150 L 600 240 L 0 240 Z" fill="url(#grassGrad)"/>' +
            '<g transform="translate(40, 30)" filter="url(#softShadow)">' +
              '<path d="M 90 200 L 90 120 Q 90 90 70 80 L 110 80 Q 90 100 100 200 Z" fill="#92400e"/>' +
              '<circle cx="50" cy="70" r="45" fill="#22c55e"/><circle cx="100" cy="50" r="50" fill="#16a34a"/><circle cx="140" cy="75" r="42" fill="#15803d"/>' +
              '<g transform="translate(45, 55)"><circle cx="8" cy="8" r="8" fill="#ef4444"/><ellipse cx="6" cy="6" rx="2" ry="1" fill="#fff" opacity="0.6"/></g>' +
              '<g transform="translate(85, 35)"><circle cx="8" cy="8" r="8" fill="#ef4444"/><ellipse cx="6" cy="6" rx="2" ry="1" fill="#fff" opacity="0.6"/></g>' +
              '<g transform="translate(125, 65)"><circle cx="8" cy="8" r="8" fill="#ef4444"/><ellipse cx="6" cy="6" rx="2" ry="1" fill="#fff" opacity="0.6"/></g>' +
              '<g transform="translate(75, 80)"><circle cx="8" cy="8" r="8" fill="#ef4444"/><ellipse cx="6" cy="6" rx="2" ry="1" fill="#fff" opacity="0.6"/></g>' +
              '<rect x="60" y="180" width="70" height="20" rx="10" fill="#fef2f2" stroke="#ef4444" stroke-width="1.5"/>' +
              '<text x="95" y="194" font-size="10" font-weight="bold" fill="#b91c1c" text-anchor="middle">🍎 Apple Tree</text>' +
            '</g>' +
            '<g transform="translate(260, 150)" filter="url(#softShadow)">' +
              '<path d="M 10 30 Q 35 55 60 30 L 55 50 Q 35 60 15 50 Z" fill="#b45309"/>' +
              '<path d="M 15 25 Q 35 15 50 35 Q 35 25 15 25 Z" fill="#eab308"/><path d="M 18 30 Q 38 20 54 40 Q 38 30 18 30 Z" fill="#facc15"/>' +
              '<rect x="12" y="58" width="52" height="16" rx="8" fill="#fefce8" stroke="#eab308" stroke-width="1.2"/>' +
              '<text x="38" y="70" font-size="9" font-weight="bold" fill="#a16207" text-anchor="middle">🍌 Banana</text>' +
            '</g>' +
            '<g transform="translate(360, 100)" filter="url(#softShadow)">' +
              '<line x1="40" y1="60" x2="40" y2="120" stroke="#16a34a" stroke-width="6"/>' +
              '<circle cx="40" cy="50" r="16" fill="#78350f"/>' +
              '<g fill="#facc15"><ellipse cx="40" cy="28" rx="6" ry="10"/><ellipse cx="62" cy="50" rx="10" ry="6"/><ellipse cx="40" cy="72" rx="6" ry="10"/><ellipse cx="18" cy="50" rx="10" ry="6"/></g>' +
              '<rect x="14" y="115" width="54" height="16" rx="8" fill="#fefce8" stroke="#ca8a04" stroke-width="1.2"/>' +
              '<text x="41" y="127" font-size="9" font-weight="bold" fill="#854d0e" text-anchor="middle">🌻 Flower</text>' +
            '</g>' +
            '<g transform="translate(460, 130)">' +
              '<rect x="15" y="15" width="30" height="22" rx="6" fill="#38bdf8"/><path d="M 45 22 L 65 14" stroke="#0284c7" stroke-width="4"/><circle cx="68" cy="13" r="5" fill="#0284c7"/>' +
              '<circle cx="74" cy="22" r="2.5" fill="#38bdf8"/><circle cx="78" cy="30" r="2.5" fill="#38bdf8"/>' +
              '<g transform="translate(75, 45)"><ellipse cx="10" cy="20" rx="14" ry="4" fill="#78350f"/><path d="M 10 20 L 10 10 Q 5 5 2 8" stroke="#16a34a" stroke-width="2.5" fill="none"/><path d="M 10 12 Q 16 6 18 10" stroke="#22c55e" stroke-width="2.5" fill="none"/></g>' +
            '</g>';
        } else if (unitKey === 'u5') {
          // Unit 5: 艺术工坊与七彩调色板 (跨天彩虹、大调色盘挤满鲜艳颜料、画板画笔)
          c = defs +
            '<rect width="600" height="240" rx="16" fill="url(#skyGrad)"/>' +
            '<g fill="none" stroke-width="7" opacity="0.9">' +
              '<path d="M 20 220 A 280 200 0 0 1 580 220" stroke="#ef4444"/>' +
              '<path d="M 28 220 A 272 192 0 0 1 572 220" stroke="#f97316"/>' +
              '<path d="M 36 220 A 264 184 0 0 1 564 220" stroke="#eab308"/>' +
              '<path d="M 44 220 A 256 176 0 0 1 556 220" stroke="#22c55e"/>' +
              '<path d="M 52 220 A 248 168 0 0 1 548 220" stroke="#06b6d4"/>' +
              '<path d="M 60 220 A 240 160 0 0 1 540 220" stroke="#3b82f6"/>' +
              '<path d="M 68 220 A 232 152 0 0 1 532 220" stroke="#a855f7"/>' +
            '</g>' +
            '<g transform="translate(480, 40)"><ellipse cx="15" cy="20" rx="14" ry="18" fill="#ef4444"/><ellipse cx="40" cy="15" rx="14" ry="18" fill="#3b82f6"/><ellipse cx="60" cy="30" rx="13" ry="17" fill="#eab308"/></g>' +
            '<g transform="translate(60, 60)" filter="url(#softShadow)">' +
              '<path d="M 40 60 Q 20 20 80 15 Q 180 5 210 50 Q 235 90 190 120 Q 140 140 80 120 Q 30 110 40 60 Z" fill="#fde68a" stroke="#d97706" stroke-width="3"/>' +
              '<ellipse cx="180" cy="85" rx="12" ry="16" fill="#e0f2fe" stroke="#d97706" stroke-width="2"/>' +
              '<circle cx="65" cy="40" r="13" fill="#ef4444"/><circle cx="105" cy="30" r="13" fill="#eab308"/><circle cx="145" cy="35" r="13" fill="#3b82f6"/><circle cx="85" cy="78" r="13" fill="#22c55e"/><circle cx="125" cy="85" r="13" fill="#a855f7"/>' +
              '<rect x="65" y="132" width="110" height="22" rx="11" fill="#ffffff" stroke="#d97706" stroke-width="1.5"/>' +
              '<text x="120" y="147" font-size="11" font-weight="bold" fill="#b45309" text-anchor="middle">🎨 Colour Palette</text>' +
            '</g>' +
            '<g transform="translate(320, 70)" filter="url(#softShadow)">' +
              '<line x1="80" y1="15" x2="25" y2="155" stroke="#92400e" stroke-width="5"/><line x1="80" y1="15" x2="135" y2="155" stroke="#92400e" stroke-width="5"/>' +
              '<rect x="30" y="25" width="100" height="80" rx="4" fill="#ffffff" stroke="#b45309" stroke-width="3"/>' +
              '<rect x="35" y="30" width="90" height="70" fill="#e0f2fe"/><circle cx="55" cy="48" r="10" fill="#facc15"/><path d="M 35 80 Q 60 60 85 75 Q 105 68 125 80 L 125 100 L 35 100 Z" fill="#4ade80"/>' +
            '</g>';
        } else if (unitKey === 'u6') {
          // Unit 6: 生日派对数蜡烛 (双层草莓蛋糕插5根点亮蜡烛、彩色拉旗、数字气球、礼盒)
          c = defs +
            '<rect width="600" height="240" rx="16" fill="#fef2f2"/>' +
            '<path d="M 0 35 Q 150 70 300 40 Q 450 70 600 35" fill="none" stroke="#f43f5e" stroke-width="2"/>' +
            '<polygon points="40,43 55,75 70,47" fill="#ef4444"/><polygon points="90,50 105,82 120,54" fill="#f59e0b"/><polygon points="140,55 155,87 170,57" fill="#10b981"/><polygon points="190,55 205,87 220,55" fill="#3b82f6"/><polygon points="240,52 255,84 270,49" fill="#8b5cf6"/><polygon points="330,48 345,80 360,51" fill="#ec4899"/><polygon points="380,54 395,86 410,56" fill="#06b6d4"/><polygon points="430,56 445,88 460,55" fill="#f97316"/><polygon points="480,52 495,84 510,48" fill="#eab308"/><polygon points="530,45 545,77 560,40" fill="#22c55e"/>' +
            '<g transform="translate(60, 45)"><ellipse cx="20" cy="30" rx="16" ry="20" fill="#ef4444"/><text x="20" y="37" font-size="14" font-weight="900" fill="#fff" text-anchor="middle">1</text><ellipse cx="50" cy="20" rx="16" ry="20" fill="#3b82f6"/><text x="50" y="27" font-size="14" font-weight="900" fill="#fff" text-anchor="middle">2</text><ellipse cx="80" cy="35" rx="16" ry="20" fill="#10b981"/><text x="80" y="42" font-size="14" font-weight="900" fill="#fff" text-anchor="middle">3</text></g>' +
            '<g transform="translate(440, 45)"><ellipse cx="20" cy="25" rx="16" ry="20" fill="#f59e0b"/><text x="20" y="32" font-size="14" font-weight="900" fill="#fff" text-anchor="middle">4</text><ellipse cx="50" cy="18" rx="16" ry="20" fill="#8b5cf6"/><text x="50" y="25" font-size="14" font-weight="900" fill="#fff" text-anchor="middle">5</text></g>' +
            '<ellipse cx="300" cy="210" rx="200" ry="28" fill="#fda4af" opacity="0.4"/><ellipse cx="300" cy="205" rx="180" ry="24" fill="#ffffff"/>' +
            '<g transform="translate(210, 85)" filter="url(#softShadow)">' +
              '<rect x="15" y="65" width="150" height="42" rx="8" fill="#fbcfe8"/><rect x="40" y="30" width="100" height="38" rx="6" fill="#fef08a"/>' +
              '<g transform="translate(48, 10)"><rect x="0" y="8" width="5" height="15" fill="#38bdf8"/><circle cx="2.5" cy="4" r="3" fill="#f59e0b"/></g>' +
              '<g transform="translate(66, 8)"><rect x="0" y="8" width="5" height="17" fill="#f43f5e"/><circle cx="2.5" cy="4" r="3" fill="#f59e0b"/></g>' +
              '<g transform="translate(86, 6)"><rect x="0" y="8" width="5" height="19" fill="#10b981"/><circle cx="2.5" cy="4" r="3.5" fill="#f59e0b"/></g>' +
              '<g transform="translate(106, 8)"><rect x="0" y="8" width="5" height="17" fill="#a855f7"/><circle cx="2.5" cy="4" r="3" fill="#f59e0b"/></g>' +
              '<g transform="translate(124, 10)"><rect x="0" y="8" width="5" height="15" fill="#f97316"/><circle cx="2.5" cy="4" r="3" fill="#f59e0b"/></g>' +
            '</g>' +
            '<g transform="translate(100, 150)" filter="url(#softShadow)"><rect x="0" y="15" width="45" height="40" rx="4" fill="#38bdf8"/><line x1="22" y1="10" x2="22" y2="55" stroke="#f43f5e" stroke-width="6"/><circle cx="22" cy="7" r="5" fill="#f43f5e"/></g>' +
            '<g transform="translate(450, 145)" filter="url(#softShadow)"><rect x="0" y="15" width="50" height="45" rx="4" fill="#a855f7"/><line x1="25" y1="10" x2="25" y2="60" stroke="#facc15" stroke-width="6"/><circle cx="25" cy="6" r="6" fill="#facc15"/></g>';
        } else {
          // 兜底 / 自然拼读森林大图
          c = defs +
            '<rect width="600" height="240" rx="16" fill="url(#skyGrad)"/>' +
            '<circle cx="80" cy="60" r="35" fill="url(#sunGrad)"/>' +
            '<path d="M 0 170 Q 200 140 400 170 Q 520 180 600 160 L 600 240 L 0 240 Z" fill="url(#grassGrad)"/>' +
            '<g transform="translate(60, 40)"><rect x="75" y="100" width="30" height="90" fill="#92400e" rx="4"/><circle cx="90" cy="70" r="65" fill="#22c55e"/><circle cx="55" cy="50" r="16" fill="#ef4444"/><text x="55" y="56" font-size="16" font-weight="900" fill="#fff" text-anchor="middle">A</text><circle cx="90" cy="35" r="16" fill="#3b82f6"/><text x="90" y="41" font-size="16" font-weight="900" fill="#fff" text-anchor="middle">E</text><circle cx="125" cy="50" r="16" fill="#eab308"/><text x="125" y="56" font-size="16" font-weight="900" fill="#fff" text-anchor="middle">I</text><circle cx="65" cy="90" r="16" fill="#f97316"/><text x="65" y="96" font-size="16" font-weight="900" fill="#fff" text-anchor="middle">O</text><circle cx="115" cy="90" r="16" fill="#a855f7"/><text x="115" y="96" font-size="16" font-weight="900" fill="#fff" text-anchor="middle">U</text></g>' +
            '<g transform="translate(260, 120)" filter="url(#softShadow)"><rect x="0" y="20" width="70" height="45" rx="6" fill="#ef4444"/><rect x="80" y="30" width="55" height="35" rx="5" fill="#f59e0b"/><rect x="145" y="30" width="55" height="35" rx="5" fill="#10b981"/><text x="108" y="52" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">c-a-t</text><text x="172" y="52" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">cat</text></g>';
        }

        return wrapSvg(600, 240, c, 'pep-svg-scene');
      }

      /* 2. 核心生词图文闪卡专属插画 (Word Illustrated Flashcard) */
      function getWordSvg(w) {
        var word = (w && w.word ? w.word : '').toLowerCase().trim();
        var emoji = (w && w.emoji) || '📖';

        var bg = '<rect width="100" height="80" rx="14" fill="#f1f5f9"/>';
        var inner = '';

        switch (word) {
          // 五官与身体
          case 'ear':
            bg = '<rect width="100" height="80" rx="14" fill="#eff6ff"/>';
            inner = '<path d="M 40 22 C 28 22 25 40 35 52 C 40 58 45 62 48 56 C 52 50 48 42 42 38" stroke="#3b82f6" stroke-width="4.5" stroke-linecap="round" fill="none"/>' +
              '<path d="M 56 30 A 15 15 0 0 1 56 46" stroke="#60a5fa" stroke-width="3" fill="none" stroke-linecap="round"/>' +
              '<path d="M 64 24 A 25 25 0 0 1 64 52" stroke="#93c5fd" stroke-width="3" fill="none" stroke-linecap="round"/>' +
              '<path d="M 72 18 A 35 35 0 0 1 72 58" stroke="#bfdbfe" stroke-width="3" fill="none" stroke-linecap="round"/>';
            break;
          case 'eye':
            bg = '<rect width="100" height="80" rx="14" fill="#f0fdf4"/>';
            inner = '<path d="M 20 40 Q 50 16 80 40 Q 50 64 20 40 Z" fill="#ffffff" stroke="#16a34a" stroke-width="3"/>' +
              '<circle cx="50" cy="40" r="13" fill="#15803d"/>' +
              '<circle cx="50" cy="40" r="7" fill="#0f172a"/>' +
              '<circle cx="47" cy="36" r="3.5" fill="#ffffff"/>' +
              '<path d="M 32 24 L 28 17" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round"/>' +
              '<path d="M 50 20 L 50 13" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round"/>' +
              '<path d="M 68 24 L 72 17" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round"/>';
            break;
          case 'mouth':
          case 'lip':
            bg = '<rect width="100" height="80" rx="14" fill="#fef2f2"/>';
            inner = '<path d="M 22 38 Q 50 32 78 38 Q 66 60 50 60 Q 34 60 22 38 Z" fill="#ef4444"/>' +
              '<path d="M 26 40 Q 50 48 74 40 Q 64 54 50 54 Q 36 54 26 40 Z" fill="#991b1b"/>' +
              '<rect x="36" y="40" width="28" height="6" rx="2" fill="#ffffff"/>' +
              '<ellipse cx="50" cy="50" rx="9" ry="5" fill="#f43f5e"/>';
            break;
          case 'hand':
            bg = '<rect width="100" height="80" rx="14" fill="#fefce8"/>';
            inner = '<g transform="translate(26, 12)">' +
              '<path d="M 16 48 L 16 35 C 16 31 22 31 22 35 L 22 20 C 22 16 28 16 28 20 L 28 16 C 28 12 34 12 34 16 L 34 22 C 34 18 40 18 40 22 L 40 38 C 40 50 36 58 24 58 L 18 58 C 10 58 6 52 10 46 L 14 42" fill="#fde047" stroke="#ca8a04" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
              '<circle cx="28" cy="42" r="4" fill="#f59e0b"/>' +
            '</g>';
            break;
          case 'arm':
            bg = '<rect width="100" height="80" rx="14" fill="#fdf2f8"/>';
            inner = '<g transform="translate(18, 16)">' +
              '<path d="M 10 42 C 10 42 16 26 28 26 C 36 26 40 32 46 32 C 54 32 58 20 54 12 C 48 8 40 14 36 18 C 30 18 20 24 10 32 Z" fill="#f472b6" stroke="#db2777" stroke-width="3"/>' +
              '<circle cx="56" cy="14" r="8" fill="#db2777"/>' +
              '<line x1="32" y1="26" x2="36" y2="30" stroke="#be185d" stroke-width="2"/>' +
            '</g>';
            break;
          case 'smile':
            bg = '<rect width="100" height="80" rx="14" fill="#fefce8"/>';
            inner = '<circle cx="50" cy="40" r="28" fill="#facc15" stroke="#ca8a04" stroke-width="3"/>' +
              '<ellipse cx="38" cy="34" rx="3.5" ry="5" fill="#78350f"/>' +
              '<ellipse cx="62" cy="34" rx="3.5" ry="5" fill="#78350f"/>' +
              '<circle cx="32" cy="44" r="4" fill="#f87171" opacity="0.6"/>' +
              '<circle cx="68" cy="44" r="4" fill="#f87171" opacity="0.6"/>' +
              '<path d="M 36 46 Q 50 62 64 46" stroke="#78350f" stroke-width="3.5" fill="none" stroke-linecap="round"/>';
            break;
          case 'listen':
            bg = '<rect width="100" height="80" rx="14" fill="#eff6ff"/>';
            inner = '<circle cx="45" cy="40" r="20" fill="#93c5fd"/>' +
              '<path d="M 25 40 A 20 20 0 0 1 65 40" stroke="#1d4ed8" stroke-width="4" fill="none"/>' +
              '<rect x="20" y="32" width="10" height="18" rx="4" fill="#1e40af"/>' +
              '<rect x="60" y="32" width="10" height="18" rx="4" fill="#1e40af"/>' +
              '<text x="78" y="32" font-size="14" fill="#2563eb">🎵</text>';
            break;
          case 'share':
            bg = '<rect width="100" height="80" rx="14" fill="#f0fdf4"/>';
            inner = '<g transform="translate(18, 18)">' +
              '<circle cx="16" cy="24" r="10" fill="#60a5fa"/>' +
              '<circle cx="48" cy="24" r="10" fill="#f472b6"/>' +
              '<path d="M 32 18 Q 36 12 40 18 Q 40 26 32 34 Q 24 26 24 18 Q 28 12 32 18 Z" fill="#ef4444"/>' +
              '<path d="M 12 34 L 28 34" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/>' +
              '<path d="M 52 34 L 36 34" stroke="#db2777" stroke-width="3" stroke-linecap="round"/>' +
            '</g>';
            break;
          case 'help':
            bg = '<rect width="100" height="80" rx="14" fill="#fef3c7"/>';
            inner = '<g transform="translate(24, 18)">' +
              '<path d="M 8 16 Q 24 16 28 26 L 36 26" stroke="#d97706" stroke-width="4" fill="none" stroke-linecap="round"/>' +
              '<path d="M 46 36 Q 32 36 26 26 L 16 26" stroke="#2563eb" stroke-width="4" fill="none" stroke-linecap="round"/>' +
              '<circle cx="27" cy="26" r="5" fill="#ef4444"/>' +
              '<text x="22" y="10" font-size="12" fill="#f59e0b">✨</text>' +
            '</g>';
            break;
          case 'say':
            bg = '<rect width="100" height="80" rx="14" fill="#f5f3ff"/>';
            inner = '<g transform="translate(18, 14)">' +
              '<rect x="4" y="4" width="56" height="36" rx="12" fill="#8b5cf6"/>' +
              '<polygon points="20,40 16,50 30,40" fill="#8b5cf6"/>' +
              '<circle cx="22" cy="22" r="3" fill="#ffffff"/><circle cx="32" cy="22" r="3" fill="#ffffff"/><circle cx="42" cy="22" r="3" fill="#ffffff"/>' +
            '</g>';
            break;
          case 'can':
            bg = '<rect width="100" height="80" rx="14" fill="#ecfdf5"/>';
            inner = '<circle cx="50" cy="40" r="26" fill="#10b981"/>' +
              '<path d="M 36 40 L 46 50 L 64 30" stroke="#ffffff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
            break;
          case 'friend':
            bg = '<rect width="100" height="80" rx="14" fill="#eff6ff"/>';
            inner = '<g transform="translate(20, 16)">' +
              '<circle cx="18" cy="18" r="10" fill="#facc15"/>' +
              '<rect x="10" y="28" width="16" height="20" rx="4" fill="#3b82f6"/>' +
              '<circle cx="42" cy="18" r="10" fill="#f472b6"/>' +
              '<rect x="34" y="28" width="16" height="20" rx="4" fill="#ec4899"/>' +
              '<path d="M 30 10 Q 30 4 34 8 Q 38 4 38 10 Q 38 14 34 18 Q 30 14 30 10 Z" fill="#ef4444"/>' +
            '</g>';
            break;

          // 家庭成员
          case 'father':
          case 'dad':
          case 'man':
          case 'men':
            bg = '<rect width="100" height="80" rx="14" fill="#eff6ff"/>';
            inner = '<g transform="translate(28, 10)">' +
              '<circle cx="22" cy="20" r="16" fill="#fed7aa"/>' +
              '<path d="M 6 16 Q 22 0 38 16" fill="#334155"/>' +
              '<circle cx="16" cy="18" r="2.5" fill="#0f172a"/><circle cx="28" cy="18" r="2.5" fill="#0f172a"/>' +
              '<path d="M 18 26 Q 22 30 26 26" stroke="#e11d48" stroke-width="2" fill="none" stroke-linecap="round"/>' +
              '<rect x="8" y="36" width="28" height="26" rx="6" fill="#1d4ed8"/>' +
              '<polygon points="22,36 18,48 22,54 26,48" fill="#ef4444"/>' +
            '</g>';
            break;
          case 'mother':
          case 'mum':
          case 'woman':
            bg = '<rect width="100" height="80" rx="14" fill="#fdf2f8"/>';
            inner = '<g transform="translate(28, 10)">' +
              '<circle cx="22" cy="20" r="16" fill="#fed7aa"/>' +
              '<path d="M 4 20 Q 22 2 40 20 Q 38 40 40 44 Q 4 44 6 40 Z" fill="#92400e"/>' +
              '<circle cx="16" cy="20" r="2.5" fill="#0f172a"/><circle cx="28" cy="20" r="2.5" fill="#0f172a"/>' +
              '<path d="M 18 27 Q 22 31 26 27" stroke="#e11d48" stroke-width="2" fill="none" stroke-linecap="round"/>' +
              '<rect x="8" y="38" width="28" height="24" rx="6" fill="#db2777"/>' +
            '</g>';
            break;
          case 'brother':
          case 'kid':
          case 'me':
            bg = '<rect width="100" height="80" rx="14" fill="#ecfdf5"/>';
            inner = '<g transform="translate(28, 12)">' +
              '<circle cx="22" cy="18" r="14" fill="#fed7aa"/>' +
              '<path d="M 8 16 Q 22 2 36 16" fill="#f59e0b"/>' +
              '<circle cx="16" cy="18" r="2" fill="#0f172a"/><circle cx="28" cy="18" r="2" fill="#0f172a"/>' +
              '<path d="M 18 24 Q 22 28 26 24" stroke="#e11d48" stroke-width="1.8" fill="none"/>' +
              '<rect x="10" y="32" width="24" height="26" rx="5" fill="#10b981"/>' +
            '</g>';
            break;
          case 'sister':
            bg = '<rect width="100" height="80" rx="14" fill="#fdf2f8"/>';
            inner = '<g transform="translate(28, 12)">' +
              '<circle cx="22" cy="18" r="14" fill="#fed7aa"/>' +
              '<circle cx="8" cy="14" r="6" fill="#f43f5e"/><circle cx="36" cy="14" r="6" fill="#f43f5e"/>' +
              '<path d="M 8 16 Q 22 4 36 16" fill="#f43f5e"/>' +
              '<circle cx="16" cy="18" r="2" fill="#0f172a"/><circle cx="28" cy="18" r="2" fill="#0f172a"/>' +
              '<path d="M 18 24 Q 22 28 26 24" stroke="#e11d48" stroke-width="1.8" fill="none"/>' +
              '<rect x="10" y="32" width="24" height="26" rx="5" fill="#ec4899"/>' +
            '</g>';
            break;
          case 'grandfather':
          case 'grandpa':
            bg = '<rect width="100" height="80" rx="14" fill="#f8fafc"/>';
            inner = '<g transform="translate(28, 10)">' +
              '<circle cx="22" cy="20" r="16" fill="#fed7aa"/>' +
              '<path d="M 6 16 Q 22 2 38 16" fill="#cbd5e1"/>' +
              '<circle cx="15" cy="18" r="4.5" fill="none" stroke="#475569" stroke-width="2"/>' +
              '<circle cx="29" cy="18" r="4.5" fill="none" stroke="#475569" stroke-width="2"/>' +
              '<line x1="20" y1="18" x2="24" y2="18" stroke="#475569" stroke-width="2"/>' +
              '<path d="M 16 28 Q 22 24 28 28" stroke="#cbd5e1" stroke-width="3" fill="none"/>' +
              '<rect x="8" y="36" width="28" height="26" rx="6" fill="#0284c7"/>' +
            '</g>';
            break;
          case 'grandmother':
          case 'grandma':
            bg = '<rect width="100" height="80" rx="14" fill="#fdf4ff"/>';
            inner = '<g transform="translate(28, 10)">' +
              '<circle cx="22" cy="20" r="16" fill="#fed7aa"/>' +
              '<circle cx="22" cy="4" r="7" fill="#cbd5e1"/>' +
              '<path d="M 6 16 Q 22 6 38 16" fill="#cbd5e1"/>' +
              '<circle cx="15" cy="19" r="4" fill="none" stroke="#be185d" stroke-width="1.8"/>' +
              '<circle cx="29" cy="19" r="4" fill="none" stroke="#be185d" stroke-width="1.8"/>' +
              '<line x1="19" y1="19" x2="25" y2="19" stroke="#be185d" stroke-width="1.8"/>' +
              '<rect x="8" y="36" width="28" height="26" rx="6" fill="#9333ea"/>' +
            '</g>';
            break;
          case 'family':
            bg = '<rect width="100" height="80" rx="14" fill="#fef2f2"/>';
            inner = '<path d="M 50 16 Q 30 0 16 16 Q 2 32 50 68 Q 98 32 84 16 Q 70 0 50 16 Z" fill="#f87171" opacity="0.25"/>' +
              '<g transform="translate(22, 22)">' +
                '<circle cx="14" cy="14" r="8" fill="#3b82f6"/>' +
                '<circle cx="42" cy="14" r="8" fill="#ec4899"/>' +
                '<circle cx="28" cy="26" r="6" fill="#facc15"/>' +
              '</g>';
            break;
          case 'baby':
            bg = '<rect width="100" height="80" rx="14" fill="#fefce8"/>';
            inner = '<circle cx="50" cy="38" r="20" fill="#fed7aa"/>' +
              '<path d="M 48 18 Q 50 10 54 14" stroke="#f59e0b" stroke-width="3" fill="none"/>' +
              '<circle cx="42" cy="34" r="2.5" fill="#0f172a"/><circle cx="58" cy="34" r="2.5" fill="#0f172a"/>' +
              '<circle cx="50" cy="46" r="7" fill="#38bdf8"/>' +
              '<circle cx="50" cy="46" r="3.5" fill="#fde047"/>';
            break;

          // 动物
          case 'cat':
            bg = '<rect width="100" height="80" rx="14" fill="#fefce8"/>';
            inner = '<g transform="translate(26, 14)">' +
              '<polygon points="6,18 14,2 22,14" fill="#f59e0b"/><polygon points="26,14 34,2 42,18" fill="#f59e0b"/>' +
              '<polygon points="9,16 14,6 19,14" fill="#fbcfe8"/><polygon points="29,14 34,6 39,16" fill="#fbcfe8"/>' +
              '<circle cx="24" cy="26" r="18" fill="#f59e0b"/>' +
              '<circle cx="17" cy="24" r="2.5" fill="#0f172a"/><circle cx="31" cy="24" r="2.5" fill="#0f172a"/>' +
              '<polygon points="24,30 22,28 26,28" fill="#f43f5e"/>' +
              '<line x1="6" y1="28" x2="16" y2="29" stroke="#78350f" stroke-width="1.8"/>' +
              '<line x1="32" y1="29" x2="42" y2="28" stroke="#78350f" stroke-width="1.8"/>' +
            '</g>';
            break;
          case 'dog':
          case 'pup':
            bg = '<rect width="100" height="80" rx="14" fill="#fffbeb"/>';
            inner = '<g transform="translate(26, 14)">' +
              '<ellipse cx="8" cy="24" rx="6" ry="12" fill="#d97706"/><ellipse cx="40" cy="24" rx="6" ry="12" fill="#d97706"/>' +
              '<circle cx="24" cy="26" r="18" fill="#f59e0b"/>' +
              '<circle cx="17" cy="24" r="2.5" fill="#0f172a"/><circle cx="31" cy="24" r="2.5" fill="#0f172a"/>' +
              '<ellipse cx="24" cy="30" rx="4" ry="3" fill="#0f172a"/>' +
              '<path d="M 24 33 Q 24 40 28 37" stroke="#ef4444" stroke-width="3" fill="none"/>' +
            '</g>';
            break;
          case 'fish':
            bg = '<rect width="100" height="80" rx="14" fill="#e0f2fe"/>';
            inner = '<g transform="translate(20, 18)">' +
              '<ellipse cx="32" cy="24" rx="22" ry="14" fill="#f97316"/>' +
              '<polygon points="50,24 66,12 66,36" fill="#ea580c"/>' +
              '<polygon points="30,10 40,2 40,14" fill="#ea580c"/>' +
              '<circle cx="18" cy="22" r="3" fill="#0f172a"/><circle cx="17" cy="21" r="1" fill="#fff"/>' +
              '<circle cx="8" cy="14" r="3" fill="#38bdf8" opacity="0.6"/><circle cx="4" cy="8" r="2" fill="#38bdf8" opacity="0.6"/>' +
            '</g>';
            break;
          case 'bird':
            bg = '<rect width="100" height="80" rx="14" fill="#e0f2fe"/>';
            inner = '<g transform="translate(22, 16)">' +
              '<circle cx="28" cy="22" r="16" fill="#38bdf8"/>' +
              '<polygon points="42,20 54,24 42,28" fill="#f59e0b"/>' +
              '<circle cx="34" cy="18" r="2.5" fill="#0f172a"/>' +
              '<path d="M 16 26 Q 8 16 14 36" fill="#0284c7"/>' +
              '<text x="40" y="8" font-size="12" fill="#0284c7">🎶</text>' +
            '</g>';
            break;
          case 'rabbit':
            bg = '<rect width="100" height="80" rx="14" fill="#fdf2f8"/>';
            inner = '<g transform="translate(26, 8)">' +
              '<ellipse cx="16" cy="18" rx="5" ry="16" fill="#ffffff" stroke="#f472b6" stroke-width="1.5"/><ellipse cx="16" cy="18" rx="2.5" ry="12" fill="#fbcfe8"/>' +
              '<ellipse cx="32" cy="18" rx="5" ry="16" fill="#ffffff" stroke="#f472b6" stroke-width="1.5"/><ellipse cx="32" cy="18" rx="2.5" ry="12" fill="#fbcfe8"/>' +
              '<circle cx="24" cy="38" r="18" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>' +
              '<circle cx="17" cy="36" r="2" fill="#e11d48"/><circle cx="31" cy="36" r="2" fill="#e11d48"/>' +
              '<polygon points="24,42 22,40 26,40" fill="#f43f5e"/>' +
            '</g>';
            break;
          case 'panda':
            bg = '<rect width="100" height="80" rx="14" fill="#f1f5f9"/>';
            inner = '<g transform="translate(26, 12)">' +
              '<circle cx="10" cy="12" r="8" fill="#0f172a"/><circle cx="38" cy="12" r="8" fill="#0f172a"/>' +
              '<circle cx="24" cy="28" r="20" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>' +
              '<ellipse cx="16" cy="26" rx="5" ry="7" fill="#0f172a" transform="rotate(-15 16 26)"/>' +
              '<ellipse cx="32" cy="26" rx="5" ry="7" fill="#0f172a" transform="rotate(15 32 26)"/>' +
              '<circle cx="17" cy="25" r="2" fill="#ffffff"/><circle cx="31" cy="25" r="2" fill="#ffffff"/>' +
              '<ellipse cx="24" cy="34" rx="3.5" ry="2.5" fill="#0f172a"/>' +
            '</g>';
            break;
          case 'monkey':
            bg = '<rect width="100" height="80" rx="14" fill="#fef3c7"/>';
            inner = '<g transform="translate(26, 12)">' +
              '<circle cx="6" cy="26" r="8" fill="#b45309"/><circle cx="42" cy="26" r="8" fill="#b45309"/>' +
              '<circle cx="24" cy="28" r="18" fill="#b45309"/>' +
              '<ellipse cx="24" cy="32" rx="13" ry="11" fill="#fed7aa"/>' +
              '<circle cx="17" cy="25" r="2.5" fill="#0f172a"/><circle cx="31" cy="25" r="2.5" fill="#0f172a"/>' +
              '<ellipse cx="24" cy="33" rx="3" ry="2" fill="#78350f"/>' +
            '</g>';
            break;
          case 'tiger':
            bg = '<rect width="100" height="80" rx="14" fill="#fff7ed"/>';
            inner = '<g transform="translate(26, 12)">' +
              '<circle cx="8" cy="12" r="8" fill="#ea580c"/><circle cx="40" cy="12" r="8" fill="#ea580c"/>' +
              '<circle cx="24" cy="28" r="20" fill="#f97316"/>' +
              '<path d="M 20 14 L 28 14 M 24 14 L 24 22 M 20 18 L 28 18" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/>' +
              '<circle cx="16" cy="28" r="2.5" fill="#0f172a"/><circle cx="32" cy="28" r="2.5" fill="#0f172a"/>' +
            '</g>';
            break;
          case 'elephant':
            bg = '<rect width="100" height="80" rx="14" fill="#f1f5f9"/>';
            inner = '<g transform="translate(22, 12)">' +
              '<ellipse cx="14" cy="26" rx="14" ry="18" fill="#94a3b8"/><ellipse cx="42" cy="26" rx="14" ry="18" fill="#94a3b8"/>' +
              '<circle cx="28" cy="26" r="18" fill="#cbd5e1"/>' +
              '<circle cx="20" cy="22" r="2.5" fill="#0f172a"/><circle cx="36" cy="22" r="2.5" fill="#0f172a"/>' +
              '<path d="M 28 30 Q 28 46 36 44" stroke="#94a3b8" stroke-width="6" stroke-linecap="round" fill="none"/>' +
            '</g>';
            break;
          case 'pet':
            bg = '<rect width="100" height="80" rx="14" fill="#fdf2f8"/>';
            inner = '<g transform="translate(26, 14)">' +
              '<ellipse cx="24" cy="30" rx="12" ry="10" fill="#f43f5e"/>' +
              '<circle cx="12" cy="16" r="4.5" fill="#f43f5e"/><circle cx="20" cy="11" r="4.5" fill="#f43f5e"/><circle cx="28" cy="11" r="4.5" fill="#f43f5e"/><circle cx="36" cy="16" r="4.5" fill="#f43f5e"/>' +
            '</g>';
            break;

          // 植物与水果
          case 'apple':
            bg = '<rect width="100" height="80" rx="14" fill="#fef2f2"/>';
            inner = '<g transform="translate(28, 12)">' +
              '<path d="M 22 14 Q 22 2 28 4" stroke="#78350f" stroke-width="3" stroke-linecap="round" fill="none"/>' +
              '<path d="M 28 4 Q 38 2 34 12 Z" fill="#22c55e"/>' +
              '<ellipse cx="15" cy="32" rx="14" ry="18" fill="#ef4444"/><ellipse cx="29" cy="32" rx="14" ry="18" fill="#ef4444"/>' +
              '<ellipse cx="12" cy="26" rx="3" ry="6" fill="#ffffff" opacity="0.6"/>' +
            '</g>';
            break;
          case 'banana':
            bg = '<rect width="100" height="80" rx="14" fill="#fefce8"/>';
            inner = '<g transform="translate(22, 16)">' +
              '<path d="M 12 12 Q 32 4 52 28 Q 32 24 12 12 Z" fill="#eab308"/>' +
              '<path d="M 14 18 Q 34 10 54 34 Q 34 30 14 18 Z" fill="#facc15"/>' +
              '<circle cx="12" cy="12" r="3" fill="#78350f"/>' +
            '</g>';
            break;
          case 'orange':
            bg = '<rect width="100" height="80" rx="14" fill="#fff7ed"/>';
            inner = '<circle cx="50" cy="40" r="22" fill="#f97316"/>' +
              '<circle cx="50" cy="20" r="3" fill="#15803d"/>' +
              '<path d="M 50 20 Q 60 14 56 22 Z" fill="#22c55e"/>';
            break;
          case 'grape':
            bg = '<rect width="100" height="80" rx="14" fill="#faf5ff"/>';
            inner = '<g transform="translate(32, 10)">' +
              '<path d="M 18 12 L 18 2" stroke="#78350f" stroke-width="3"/>' +
              '<circle cx="12" cy="18" r="7" fill="#a855f7"/><circle cx="24" cy="18" r="7" fill="#a855f7"/>' +
              '<circle cx="8" cy="28" r="7" fill="#9333ea"/><circle cx="18" cy="28" r="7" fill="#9333ea"/><circle cx="28" cy="28" r="7" fill="#9333ea"/>' +
              '<circle cx="13" cy="38" r="7" fill="#7e22ce"/><circle cx="23" cy="38" r="7" fill="#7e22ce"/>' +
              '<circle cx="18" cy="48" r="7" fill="#6b21a8"/>' +
            '</g>';
            break;
          case 'flower':
            bg = '<rect width="100" height="80" rx="14" fill="#fdf2f8"/>';
            inner = '<g transform="translate(30, 10)">' +
              '<line x1="20" y1="36" x2="20" y2="58" stroke="#16a34a" stroke-width="4"/>' +
              '<circle cx="20" cy="24" r="8" fill="#f59e0b"/>' +
              '<circle cx="20" cy="10" r="8" fill="#f43f5e"/><circle cx="34" cy="24" r="8" fill="#f43f5e"/><circle cx="20" cy="38" r="8" fill="#f43f5e"/><circle cx="6" cy="24" r="8" fill="#f43f5e"/>' +
            '</g>';
            break;
          case 'grass':
            bg = '<rect width="100" height="80" rx="14" fill="#f0fdf4"/>';
            inner = '<g transform="translate(24, 20)">' +
              '<path d="M 10 40 Q 12 10 2 12 Q 18 20 20 40" fill="#22c55e"/>' +
              '<path d="M 22 40 Q 26 2 30 6 Q 30 20 32 40" fill="#16a34a"/>' +
              '<path d="M 34 40 Q 40 12 50 16 Q 40 24 42 40" fill="#22c55e"/>' +
            '</g>';
            break;
          case 'tree':
            bg = '<rect width="100" height="80" rx="14" fill="#f0fdf4"/>';
            inner = '<g transform="translate(26, 8)">' +
              '<rect x="18" y="36" width="12" height="28" rx="3" fill="#78350f"/>' +
              '<circle cx="24" cy="26" r="22" fill="#22c55e"/>' +
              '<circle cx="14" cy="20" r="14" fill="#16a34a"/><circle cx="34" cy="20" r="14" fill="#16a34a"/>' +
            '</g>';
            break;
          case 'plant':
          case 'seed':
            bg = '<rect width="100" height="80" rx="14" fill="#f0fdf4"/>';
            inner = '<g transform="translate(28, 16)">' +
              '<polygon points="6,34 38,34 34,52 10,52" fill="#b45309"/>' +
              '<path d="M 22 34 L 22 18 Q 12 12 10 18 Q 16 26 22 24" fill="#22c55e"/>' +
              '<path d="M 22 22 Q 32 14 34 20 Q 28 28 22 26" fill="#16a34a"/>' +
            '</g>';
            break;
          case 'water':
          case 'wet':
            bg = '<rect width="100" height="80" rx="14" fill="#e0f2fe"/>';
            inner = '<g transform="translate(30, 12)">' +
              '<path d="M 20 6 C 20 6 36 26 36 36 A 16 16 0 1 1 4 36 C 4 26 20 6 20 6 Z" fill="#38bdf8"/>' +
              '<ellipse cx="15" cy="36" rx="4" ry="7" fill="#ffffff" opacity="0.6"/>' +
            '</g>';
            break;
          case 'sun':
          case 'hot':
            bg = '<rect width="100" height="80" rx="14" fill="#fefce8"/>';
            inner = '<circle cx="50" cy="40" r="18" fill="#f59e0b"/>' +
              '<g stroke="#f59e0b" stroke-width="3.5" stroke-linecap="round">' +
                '<line x1="50" y1="12" x2="50" y2="4"/><line x1="50" y1="68" x2="50" y2="76"/>' +
                '<line x1="22" y1="40" x2="14" y2="40"/><line x1="78" y1="40" x2="86" y2="40"/>' +
                '<line x1="30" y1="20" x2="24" y2="14"/><line x1="70" y1="60" x2="76" y2="66"/>' +
                '<line x1="30" y1="60" x2="24" y2="66"/><line x1="70" y1="20" x2="76" y2="14"/>' +
              '</g>';
            break;

          // 颜色
          case 'red':
            bg = '<rect width="100" height="80" rx="14" fill="#fef2f2"/>';
            inner = '<circle cx="50" cy="40" r="22" fill="#ef4444"/><circle cx="44" cy="34" r="5" fill="#fff" opacity="0.5"/>';
            break;
          case 'yellow':
            bg = '<rect width="100" height="80" rx="14" fill="#fefce8"/>';
            inner = '<circle cx="50" cy="40" r="22" fill="#eab308"/><circle cx="44" cy="34" r="5" fill="#fff" opacity="0.6"/>';
            break;
          case 'blue':
            bg = '<rect width="100" height="80" rx="14" fill="#eff6ff"/>';
            inner = '<circle cx="50" cy="40" r="22" fill="#3b82f6"/><circle cx="44" cy="34" r="5" fill="#fff" opacity="0.5"/>';
            break;
          case 'green':
            bg = '<rect width="100" height="80" rx="14" fill="#f0fdf4"/>';
            inner = '<circle cx="50" cy="40" r="22" fill="#22c55e"/><circle cx="44" cy="34" r="5" fill="#fff" opacity="0.5"/>';
            break;
          case 'purple':
            bg = '<rect width="100" height="80" rx="14" fill="#faf5ff"/>';
            inner = '<circle cx="50" cy="40" r="22" fill="#a855f7"/><circle cx="44" cy="34" r="5" fill="#fff" opacity="0.5"/>';
            break;
          case 'pink':
            bg = '<rect width="100" height="80" rx="14" fill="#fdf2f8"/>';
            inner = '<circle cx="50" cy="40" r="22" fill="#ec4899"/><circle cx="44" cy="34" r="5" fill="#fff" opacity="0.5"/>';
            break;
          case 'brown':
            bg = '<rect width="100" height="80" rx="14" fill="#fffbeb"/>';
            inner = '<circle cx="50" cy="40" r="22" fill="#78350f"/><circle cx="44" cy="34" r="5" fill="#fff" opacity="0.4"/>';
            break;
          case 'white':
            bg = '<rect width="100" height="80" rx="14" fill="#f1f5f9"/>';
            inner = '<circle cx="50" cy="40" r="22" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>';
            break;
          case 'black':
            bg = '<rect width="100" height="80" rx="14" fill="#f8fafc"/>';
            inner = '<circle cx="50" cy="40" r="22" fill="#0f172a"/>';
            break;
          case 'colour':
          case 'rainbow':
            bg = '<rect width="100" height="80" rx="14" fill="#f0f9ff"/>';
            inner = '<path d="M 20 60 A 30 30 0 0 1 80 60" stroke="#ef4444" stroke-width="4" fill="none"/>' +
              '<path d="M 26 60 A 24 24 0 0 1 74 60" stroke="#f59e0b" stroke-width="4" fill="none"/>' +
              '<path d="M 32 60 A 18 18 0 0 1 68 60" stroke="#10b981" stroke-width="4" fill="none"/>' +
              '<path d="M 38 60 A 12 12 0 0 1 62 60" stroke="#3b82f6" stroke-width="4" fill="none"/>';
            break;

          // 数字与派对
          case 'one':
          case '1':
            bg = '<rect width="100" height="80" rx="14" fill="#eff6ff"/>';
            inner = '<text x="50" y="55" font-size="44" font-weight="900" fill="#2563eb" text-anchor="middle">1</text>';
            break;
          case 'two':
          case '2':
            bg = '<rect width="100" height="80" rx="14" fill="#f0fdf4"/>';
            inner = '<text x="50" y="55" font-size="44" font-weight="900" fill="#16a34a" text-anchor="middle">2</text>';
            break;
          case 'three':
          case '3':
            bg = '<rect width="100" height="80" rx="14" fill="#fefce8"/>';
            inner = '<text x="50" y="55" font-size="44" font-weight="900" fill="#ca8a04" text-anchor="middle">3</text>';
            break;
          case 'four':
          case '4':
            bg = '<rect width="100" height="80" rx="14" fill="#fff7ed"/>';
            inner = '<text x="50" y="55" font-size="44" font-weight="900" fill="#ea580c" text-anchor="middle">4</text>';
            break;
          case 'five':
          case '5':
            bg = '<rect width="100" height="80" rx="14" fill="#fdf2f8"/>';
            inner = '<text x="50" y="55" font-size="44" font-weight="900" fill="#db2777" text-anchor="middle">5</text>';
            break;
          case 'six':
          case '6':
            bg = '<rect width="100" height="80" rx="14" fill="#faf5ff"/>';
            inner = '<text x="50" y="55" font-size="44" font-weight="900" fill="#9333ea" text-anchor="middle">6</text>';
            break;
          case 'seven':
          case '7':
            bg = '<rect width="100" height="80" rx="14" fill="#eff6ff"/>';
            inner = '<text x="50" y="55" font-size="44" font-weight="900" fill="#0284c7" text-anchor="middle">7</text>';
            break;
          case 'eight':
          case '8':
            bg = '<rect width="100" height="80" rx="14" fill="#f0fdf4"/>';
            inner = '<text x="50" y="55" font-size="44" font-weight="900" fill="#059669" text-anchor="middle">8</text>';
            break;
          case 'nine':
          case '9':
            bg = '<rect width="100" height="80" rx="14" fill="#fef2f2"/>';
            inner = '<text x="50" y="55" font-size="44" font-weight="900" fill="#dc2626" text-anchor="middle">9</text>';
            break;
          case 'ten':
          case '10':
            bg = '<rect width="100" height="80" rx="14" fill="#fefce8"/>';
            inner = '<text x="50" y="55" font-size="40" font-weight="900" fill="#b45309" text-anchor="middle">10</text>';
            break;
          case 'birthday':
          case 'cake':
            bg = '<rect width="100" height="80" rx="14" fill="#fdf2f8"/>';
            inner = '<g transform="translate(24, 14)">' +
              '<rect x="4" y="26" width="44" height="24" rx="5" fill="#fbcfe8"/>' +
              '<path d="M 4 26 Q 14 32 24 26 Q 34 32 48 26" fill="#f43f5e"/>' +
              '<rect x="23" y="10" width="5" height="16" fill="#38bdf8"/>' +
              '<circle cx="25.5" cy="6" r="4" fill="#f59e0b"/>' +
            '</g>';
            break;
          case 'candle':
            bg = '<rect width="100" height="80" rx="14" fill="#fffbeb"/>';
            inner = '<g transform="translate(42, 12)">' +
              '<rect x="4" y="20" width="8" height="40" rx="3" fill="#f43f5e"/>' +
              '<path d="M 8 6 Q 14 14 8 20 Q 2 14 8 6 Z" fill="#f59e0b"/>' +
              '<circle cx="8" cy="14" r="2.5" fill="#fef08a"/>' +
            '</g>';
            break;
          case 'gift':
          case 'party':
            bg = '<rect width="100" height="80" rx="14" fill="#eff6ff"/>';
            inner = '<g transform="translate(26, 16)">' +
              '<rect x="4" y="14" width="40" height="34" rx="4" fill="#38bdf8"/>' +
              '<rect x="2" y="10" width="44" height="8" rx="2" fill="#0284c7"/>' +
              '<line x1="24" y1="10" x2="24" y2="48" stroke="#ef4444" stroke-width="6"/>' +
              '<circle cx="24" cy="6" r="4" fill="#ef4444"/>' +
            '</g>';
            break;

          // 日常物品与拼读词
          case 'bed':
            bg = '<rect width="100" height="80" rx="14" fill="#f1f5f9"/>';
            inner = '<g transform="translate(18, 22)">' +
              '<rect x="4" y="16" width="56" height="20" rx="4" fill="#38bdf8"/>' +
              '<rect x="8" y="8" width="16" height="12" rx="3" fill="#ffffff"/>' +
              '<line x1="4" y1="4" x2="4" y2="40" stroke="#78350f" stroke-width="4"/>' +
              '<line x1="60" y1="18" x2="60" y2="40" stroke="#78350f" stroke-width="4"/>' +
            '</g>';
            break;
          case 'pen':
            bg = '<rect width="100" height="80" rx="14" fill="#f8fafc"/>';
            inner = '<g transform="translate(24, 14) rotate(45 26 26)">' +
              '<rect x="22" y="4" width="8" height="42" rx="2" fill="#2563eb"/>' +
              '<polygon points="22,46 30,46 26,56" fill="#0f172a"/>' +
            '</g>';
            break;
          case 'cup':
          case 'mug':
            bg = '<rect width="100" height="80" rx="14" fill="#fffbeb"/>';
            inner = '<g transform="translate(26, 18)">' +
              '<rect x="8" y="14" width="32" height="30" rx="6" fill="#f59e0b"/>' +
              '<path d="M 40 20 Q 52 28 40 38" stroke="#f59e0b" stroke-width="4" fill="none"/>' +
              '<path d="M 18 8 Q 20 2 18 0 M 26 8 Q 28 2 26 0" stroke="#cbd5e1" stroke-width="2" fill="none"/>' +
            '</g>';
            break;
          case 'bus':
            bg = '<rect width="100" height="80" rx="14" fill="#fefce8"/>';
            inner = '<g transform="translate(16, 20)">' +
              '<rect x="4" y="8" width="60" height="30" rx="6" fill="#facc15"/>' +
              '<rect x="10" y="12" width="10" height="10" rx="2" fill="#38bdf8"/><rect x="24" y="12" width="10" height="10" rx="2" fill="#38bdf8"/><rect x="38" y="12" width="10" height="10" rx="2" fill="#38bdf8"/>' +
              '<circle cx="18" cy="38" r="6" fill="#0f172a"/><circle cx="50" cy="38" r="6" fill="#0f172a"/>' +
            '</g>';
            break;
          case 'duck':
            bg = '<rect width="100" height="80" rx="14" fill="#fefce8"/>';
            inner = '<g transform="translate(24, 18)">' +
              '<ellipse cx="26" cy="28" rx="18" ry="12" fill="#facc15"/>' +
              '<circle cx="34" cy="16" r="10" fill="#facc15"/>' +
              '<polygon points="42,16 54,18 42,22" fill="#ea580c"/>' +
              '<circle cx="36" cy="14" r="2" fill="#0f172a"/>' +
            '</g>';
            break;
          case 'pig':
            bg = '<rect width="100" height="80" rx="14" fill="#fdf2f8"/>';
            inner = '<g transform="translate(26, 14)">' +
              '<circle cx="24" cy="26" r="18" fill="#f472b6"/>' +
              '<polygon points="8,14 16,8 16,18" fill="#f43f5e"/><polygon points="32,18 32,8 40,14" fill="#f43f5e"/>' +
              '<circle cx="17" cy="22" r="2" fill="#0f172a"/><circle cx="31" cy="22" r="2" fill="#0f172a"/>' +
              '<ellipse cx="24" cy="30" rx="8" ry="5" fill="#fbcfe8"/>' +
              '<circle cx="21" cy="30" r="1.5" fill="#be185d"/><circle cx="27" cy="30" r="1.5" fill="#be185d"/>' +
            '</g>';
            break;
          case 'box':
            bg = '<rect width="100" height="80" rx="14" fill="#fffbeb"/>';
            inner = '<g transform="translate(24, 18)">' +
              '<rect x="6" y="16" width="40" height="30" rx="4" fill="#d97706"/>' +
              '<polygon points="2,16 10,4 42,4 50,16" fill="#b45309"/>' +
            '</g>';
            break;
          case 'fox':
            bg = '<rect width="100" height="80" rx="14" fill="#fff7ed"/>';
            inner = '<g transform="translate(26, 12)">' +
              '<polygon points="6,16 16,4 20,20" fill="#ea580c"/><polygon points="28,20 32,4 42,16" fill="#ea580c"/>' +
              '<circle cx="24" cy="28" r="18" fill="#ea580c"/>' +
              '<polygon points="12,32 24,44 36,32" fill="#ffffff"/>' +
              '<circle cx="17" cy="26" r="2" fill="#0f172a"/><circle cx="31" cy="26" r="2" fill="#0f172a"/>' +
              '<circle cx="24" cy="38" r="2.5" fill="#0f172a"/>' +
            '</g>';
            break;
          case 'hat':
          case 'cap':
            bg = '<rect width="100" height="80" rx="14" fill="#eff6ff"/>';
            inner = '<g transform="translate(20, 20)">' +
              '<path d="M 12 28 C 12 12 36 12 40 28 Z" fill="#ef4444"/>' +
              '<path d="M 8 28 L 56 28" stroke="#ef4444" stroke-width="4" stroke-linecap="round"/>' +
            '</g>';
            break;
          case 'bag':
            bg = '<rect width="100" height="80" rx="14" fill="#f0fdf4"/>';
            inner = '<g transform="translate(26, 14)">' +
              '<rect x="6" y="16" width="36" height="34" rx="8" fill="#10b981"/>' +
              '<path d="M 16 16 L 16 10 Q 24 4 32 10 L 32 16" stroke="#047857" stroke-width="3" fill="none"/>' +
              '<rect x="12" y="24" width="24" height="14" rx="4" fill="#34d399"/>' +
            '</g>';
            break;
          case 'egg':
            bg = '<rect width="100" height="80" rx="14" fill="#fefce8"/>';
            inner = '<ellipse cx="50" cy="40" rx="18" ry="24" fill="#fed7aa" stroke="#f59e0b" stroke-width="2"/>';
            break;
          case 'milk':
            bg = '<rect width="100" height="80" rx="14" fill="#eff6ff"/>';
            inner = '<g transform="translate(32, 12)">' +
              '<rect x="6" y="14" width="24" height="38" rx="4" fill="#ffffff" stroke="#93c5fd" stroke-width="2"/>' +
              '<polygon points="6,14 12,6 24,6 30,14" fill="#e0f2fe"/>' +
              '<text x="18" y="38" font-size="10" font-weight="900" fill="#2563eb" text-anchor="middle">MILK</text>' +
            '</g>';
            break;

          default:
            bg = '<rect width="100" height="80" rx="14" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>';
            inner = '<circle cx="50" cy="40" r="24" fill="#e0f2fe"/>' +
              '<text x="50" y="48" font-size="28" text-anchor="middle">' + emoji + '</text>' +
              '<text x="24" y="24" font-size="10" fill="#f59e0b">✨</text>' +
              '<text x="76" y="60" font-size="10" fill="#3b82f6">★</text>';
            break;
        }

        return wrapSvg(100, 80, bg + inner, 'pep-svg-word');
      }

      /* 3. 考点必背金句情景插图 (Pattern Situational Micro-illustration) */
      function getPatternSvg(kp, unitKey, index) {
        var pStr = (kp && kp.pattern ? kp.pattern : '') + ' ' + (kp && kp.example ? kp.example : '');
        var bg = '<rect width="90" height="70" rx="12" fill="#eff6ff"/>';
        var inner = '';

        if (/Hello|Hi|name|I'm/i.test(pStr) || (unitKey === 'u1' && index === 0)) {
          bg = '<rect width="90" height="70" rx="12" fill="#eff6ff"/>';
          inner = '<circle cx="35" cy="30" r="14" fill="#fed7aa"/>' +
            '<path d="M 23 26 Q 35 14 47 26" fill="#facc15"/>' +
            '<path d="M 45 35 Q 56 20 62 12" stroke="#fed7aa" stroke-width="5" stroke-linecap="round" fill="none"/>' +
            '<g transform="translate(48, 28)"><rect x="0" y="0" width="38" height="18" rx="6" fill="#38bdf8"/><text x="19" y="13" font-size="9" font-weight="900" fill="#fff" text-anchor="middle">Hi!</text></g>';
        } else if (/meet you/i.test(pStr) || unitKey === 'u1') {
          bg = '<rect width="90" height="70" rx="12" fill="#ecfdf5"/>';
          inner = '<g transform="translate(18, 16)">' +
            '<path d="M 6 18 Q 20 18 26 26" stroke="#d97706" stroke-width="5" stroke-linecap="round" fill="none"/>' +
            '<path d="M 48 34 Q 34 34 26 26" stroke="#2563eb" stroke-width="5" stroke-linecap="round" fill="none"/>' +
            '<circle cx="27" cy="26" r="6" fill="#ef4444"/>' +
            '<text x="27" y="10" font-size="14" text-anchor="middle">🤝</text>' +
          '</g>';
        } else if (/father|mother|family|Who's this/i.test(pStr) || unitKey === 'u2') {
          bg = '<rect width="90" height="70" rx="12" fill="#fefce8"/>';
          inner = '<rect x="18" y="12" width="54" height="42" rx="6" fill="#ffffff" stroke="#ca8a04" stroke-width="3"/>' +
            '<circle cx="34" cy="30" r="8" fill="#3b82f6"/><circle cx="56" cy="30" r="8" fill="#ec4899"/>' +
            '<path d="M 45 42 L 45 58 L 52 50 Z" fill="#f59e0b"/>' +
            '<text x="70" y="24" font-size="12">👉</text>';
        } else if (/What's this|panda|animal/i.test(pStr) || unitKey === 'u3') {
          bg = '<rect width="90" height="70" rx="12" fill="#f0fdf4"/>';
          inner = '<circle cx="36" cy="34" r="16" fill="#10b981" opacity="0.3"/>' +
            '<text x="36" y="40" font-size="18" text-anchor="middle">🐼</text>' +
            '<circle cx="48" cy="30" r="16" fill="none" stroke="#2563eb" stroke-width="3.5"/>' +
            '<line x1="60" y1="42" x2="72" y2="54" stroke="#2563eb" stroke-width="4.5" stroke-linecap="round"/>';
        } else if (/apple|plant|like/i.test(pStr) || unitKey === 'u4') {
          bg = '<rect width="90" height="70" rx="12" fill="#fef2f2"/>';
          inner = '<circle cx="35" cy="36" r="16" fill="#ef4444"/>' +
            '<line x1="35" y1="20" x2="38" y2="14" stroke="#78350f" stroke-width="2.5"/>' +
            '<path d="M 38 14 Q 46 10 42 18 Z" fill="#22c55e"/>' +
            '<text x="62" y="44" font-size="18">👍</text>';
        } else if (/colour|red|blue/i.test(pStr) || unitKey === 'u5') {
          bg = '<rect width="90" height="70" rx="12" fill="#faf5ff"/>';
          inner = '<path d="M 20 40 Q 15 20 38 18 Q 65 14 68 36 Q 70 54 48 54 Q 24 54 20 40 Z" fill="#fde68a" stroke="#d97706" stroke-width="2"/>' +
            '<circle cx="32" cy="28" r="5" fill="#ef4444"/><circle cx="46" cy="26" r="5" fill="#3b82f6"/><circle cx="56" cy="36" r="5" fill="#22c55e"/>' +
            '<line x1="50" y1="12" x2="70" y2="48" stroke="#78350f" stroke-width="3.5" stroke-linecap="round"/>';
        } else if (/old|year|How old|birthday/i.test(pStr) || unitKey === 'u6') {
          bg = '<rect width="90" height="70" rx="12" fill="#fdf2f8"/>';
          inner = '<rect x="20" y="32" width="50" height="24" rx="4" fill="#fbcfe8"/>' +
            '<line x1="35" y1="22" x2="35" y2="32" stroke="#38bdf8" stroke-width="3"/>' +
            '<circle cx="35" cy="18" r="3" fill="#f59e0b"/>' +
            '<line x1="55" y1="22" x2="55" y2="32" stroke="#f43f5e" stroke-width="3"/>' +
            '<circle cx="55" cy="18" r="3" fill="#f59e0b"/>' +
            '<text x="66" y="24" font-size="14">🎂</text>';
        } else {
          bg = '<rect width="90" height="70" rx="12" fill="#eff6ff"/>';
          inner = '<circle cx="45" cy="35" r="20" fill="#3b82f6"/>' +
            '<text x="45" y="42" font-size="20" text-anchor="middle">⭐</text>';
        }

        return wrapSvg(90, 70, bg + inner, 'ppc-svg-pattern');
      }

      /* 4. 歌谣横幅插画 (Chant Banner Graphic) */
      function getChantSvg() {
        var bg = '<rect width="110" height="70" rx="12" fill="#fffbeb"/>';
        var inner = '<path d="M 10 25 Q 35 15 60 25 Q 85 35 100 25" stroke="#fde68a" stroke-width="3" fill="none"/>' +
          '<path d="M 10 38 Q 35 28 60 38 Q 85 48 100 38" stroke="#fde68a" stroke-width="3" fill="none"/>' +
          '<circle cx="30" cy="32" r="7" fill="#f59e0b"/>' +
          '<line x1="37" y1="32" x2="37" y2="12" stroke="#d97706" stroke-width="3.5"/>' +
          '<circle cx="65" cy="22" r="7" fill="#f59e0b"/>' +
          '<line x1="72" y1="22" x2="72" y2="6" stroke="#d97706" stroke-width="3.5"/>' +
          '<line x1="37" y1="12" x2="72" y2="6" stroke="#d97706" stroke-width="4"/>' +
          '<text x="86" y="52" font-size="18">🎤</text>';
        return wrapSvg(110, 70, bg + inner, 'pep-svg-chant');
      }

      return {
        getSceneSvg: getSceneSvg,
        getWordSvg: getWordSvg,
        getPatternSvg: getPatternSvg,
        getChantSvg: getChantSvg
      };
    })();

    /* ---------------- 模式 0：教材同步伴学助教视图 ---------------- */
    function renderLessonView() {
      var les = LESSON_DATA[S.unit] || LESSON_DATA['u1'];
      var unitWords = S.words || [];
      var curTab = S.lessonTab || 'dialogue';

      var h = '<div class="pep-lesson-wrap">';

      // 1. 快捷单元切换药丸滑轨 (支持移动端平滑横向拖拽)
      h += '<div class="pep-lesson-units-bar">';
      var allUnitKeys = ['u1','u2','u3','u4','u5','u6','sa','se','si','so','su'];
      allUnitKeys.forEach(function (uk) {
        var uItem = UNITS[uk];
        if (!uItem) return;
        var isCur = S.unit === uk ? 'active' : '';
        h += '<button type="button" class="pep-unit-pill-btn ' + isCur + '" data-unit="' + uk + '">' + esc(uItem.label) + '</button>';
      });
      h += '</div>';

      // 2. 单元主题与目标信息看板 (整合跨端智能语速切换，节省纵向空间)
      h += '<div class="pep-lesson-header">' +
        '<div class="plh-top-row">' +
          '<span class="plh-badge">' + esc(les.book) + '</span>' +
          '<div class="pep-rate-wrap">' +
            '<span class="pep-rate-label">语速：</span>' +
            '<button type="button" class="pep-rate-btn ' + (speechRateLevel === 'slow' ? 'active' : '') + '" data-rate="slow" id="btnRateSlow" title="适合初学跟读，逐音极清晰">🐢 慢速跟读</button>' +
            '<button type="button" class="pep-rate-btn ' + (speechRateLevel === 'medium' ? 'active' : '') + '" data-rate="medium" id="btnRateMed" title="人教版课标磁带伴学标准节奏（推荐）">📖 课本伴学</button>' +
            '<button type="button" class="pep-rate-btn ' + (speechRateLevel === 'normal' ? 'active' : '') + '" data-rate="normal" id="btnRateNorm" title="流利原速">🐰 流利原速</button>' +
          '</div>' +
        '</div>' +
        '<h2 class="plh-title">' + esc(les.title) + '</h2>' +
        '<p class="plh-sub">' + esc(les.sub) + '</p>' +
        '<div class="plh-target">🎯 <b>课标核心教学目标：</b>' + esc(les.target) + '</div>' +
      '</div>';

      // 3. 🌟 课本同步三大子模块选项卡 (分段控制器，解耦长页面平铺)
      h += '<div class="pep-lesson-subnav">' +
        '<button type="button" class="pep-lsub-btn ' + (curTab === 'dialogue' ? 'active' : '') + '" data-lsub="dialogue">' +
          '<span class="plsb-icon">💬</span>' +
          '<span class="plsb-txt">课文情景对话</span>' +
          '<span class="plsb-sub"><span class="plsb-sub-en">Let\'s talk </span>(' + les.dialogues.length + '轮)</span>' +
        '</button>' +
        '<button type="button" class="pep-lsub-btn ' + (curTab === 'vocab' ? 'active' : '') + '" data-lsub="vocab">' +
          '<span class="plsb-icon">🔤</span>' +
          '<span class="plsb-txt">单元核心生词</span>' +
          '<span class="plsb-sub"><span class="plsb-sub-en">Let\'s learn </span>(' + unitWords.length + '词)</span>' +
        '</button>' +
        '<button type="button" class="pep-lsub-btn ' + (curTab === 'chant' ? 'active' : '') + '" data-lsub="chant">' +
          '<span class="plsb-icon">🎵</span>' +
          '<span class="plsb-txt">趣味歌谣金句</span>' +
          '<span class="plsb-sub"><span class="plsb-sub-en">Chant & </span>Grammar</span>' +
        '</button>' +
      '</div>';

      // 4. 按选中的子模块精准独立渲染
      if (curTab === 'dialogue') {
        // 子模块 1: 💬 Let's talk · 课文情景分镜剧场 (语意联动 4 幕动态矢量大画卷)
        var acts = les.acts || [{ id: 0, title: '情景大图', desc: les.sub + ' · ' + les.title, range: [0, les.dialogues.length - 1] }];
        var curActIdx = typeof S.dialogueAct === 'number' ? S.dialogueAct : 0;
        if (curActIdx >= acts.length) curActIdx = 0;
        var currentAct = acts[curActIdx] || acts[0];

        h += '<div class="pep-scene-card">' +
          '<div class="pep-scene-acts-bar">' +
            '<div class="psab-title">🎬 <b>情景分镜剧场</b> <span class="badge">' + acts.length + ' 幕画卷</span></div>' +
            '<div class="pep-act-pills" id="pepActPills">';
        acts.forEach(function (act, aIdx) {
          h += '<button type="button" class="pep-act-btn ' + (aIdx === curActIdx ? 'active' : '') + '" data-act="' + aIdx + '">' +
            esc(act.title) +
          '</button>';
        });
        h += '</div>' +
          '</div>' +
          '<div class="psc-media" id="pepSceneMedia">' +
            PepIllustrations.getSceneSvg(S.unit, curActIdx) +
          '</div>' +
          '<div class="psc-caption">' +
            '<span class="psc-badge">🎬 ' + esc(currentAct.title) + '</span>' +
            '<span class="psc-text" id="pepSceneDesc">' + esc(currentAct.desc) + '</span>' +
          '</div>' +
        '</div>';

        h += '<div class="pep-section-card">' +
          '<div class="psc-head">' +
            '<div class="psc-title">💬 <b>Let\'s talk · 课文情景对话领读</b> <span class="badge">情景模拟 · ' + les.dialogues.length + '轮互动</span></div>' +
            '<div class="psc-actions">' +
              '<button type="button" class="btn small ghost" id="btnToggleDialogCn">👁️ 隐藏中文</button>' +
              '<button type="button" class="btn small ghost" id="btnPlayDialogues">▶️ 连续角色跟读</button>' +
            '</div>' +
          '</div>' +
          '<div class="pep-dialogue-list" id="pepDialogueList">';
        les.dialogues.forEach(function (d, dIdx) {
          var dAct = typeof d.act === 'number' ? d.act : 0;
          h += '<div class="pep-dialogue-item" data-didx="' + dIdx + '" data-act="' + dAct + '" data-en="' + esc(d.en) + '">' +
            '<div class="pdi-avatar" title="' + esc(d.role) + '">' + d.avatar + '</div>' +
            '<div class="pdi-body">' +
              '<div class="pdi-speaker">' + esc(d.role) + ' (' + esc(d.speaker) + '):</div>' +
              '<div class="pdi-en">' + esc(d.en) + '</div>' +
              '<div class="pdi-cn">' + esc(d.cn) + '</div>' +
            '</div>' +
            '<button type="button" class="pdi-speak-btn" data-en="' + esc(d.en) + '" title="点我朗读此句">🔊</button>' +
          '</div>';
        });
        h += '</div>' +
          '<div class="pep-tab-footer-guide">' +
            '<span class="ptfg-tip">💡 课文对话读熟练了吗？点击下一步前往生词记忆：</span>' +
            '<button type="button" class="btn primary small" id="btnGoVocabFromDlg">👉 前往生词记忆 (Let\'s learn · ' + unitWords.length + '词) ➔</button>' +
          '</div>' +
        '</div>';

      } else if (curTab === 'vocab') {
        // 子模块 2: 🔤 Let's learn · 3D 拟物翻转记忆闪卡流 (100% 图文+巧记+TPR动一动)
        var vocabMode = S.vocabMode || 'grid';
        var heroIdx = typeof S.vocabHeroIdx === 'number' ? S.vocabHeroIdx : 0;
        if (heroIdx >= unitWords.length) heroIdx = 0;
        if (heroIdx < 0) heroIdx = Math.max(0, unitWords.length - 1);
        S.vocabHeroIdx = heroIdx;

        h += '<div class="pep-section-card">' +
          '<div class="psc-head">' +
            '<div class="psc-title">🔤 <b>Let\'s learn · 单元核心生词库 (' + unitWords.length + ' 词)</b> <span class="badge">3D 翻转闪卡 · 100% 巧记+动作</span></div>' +
            '<div class="psc-actions">' +
              '<button type="button" class="btn small ' + (vocabMode === 'hero' ? 'primary' : 'ghost') + '" id="btnToggleCardMode">' +
                (vocabMode === 'hero' ? '▦ 平铺网格模式' : '🃏 单卡沉浸学习') +
              '</button>' +
              (vocabMode === 'grid' ? (
                '<button type="button" class="btn small ghost" id="btnPlayAllVocab">🎧 连播单词</button>' +
                '<button type="button" class="btn small ghost" id="btnFlipAllVocab">🔄 全部翻面看巧记</button>'
              ) : '') +
              '<button type="button" class="btn small ghost" id="btnGoSoundout">🧩 开启音素拆读</button>' +
            '</div>' +
          '</div>';

        if (vocabMode === 'hero' && unitWords.length > 0) {
          // 沉浸式单卡模式 (超大字体 + 聚焦记忆)
          var curWord = unitWords[heroIdx] || unitWords[0];
          var curChips = (curWord.phonics || [curWord.word]).map(function (p) {
            return '<span class="pvc-pchip">' + esc(p) + '</span>';
          }).join('');

          h += '<div class="pep-hero-deck">' +
            '<div class="pep-card-3d pep-hero-card" data-word="' + esc(curWord.word) + '" data-widx="' + heroIdx + '">' +
              '<div class="pep-card-inner">' +
                // 正面: 巨大化生词、音标与自然拼读拆解
                '<div class="pep-card-face pep-card-front">' +
                  '<div class="pvc-illustration-box">' +
                    PepIllustrations.getWordSvg(curWord) +
                    '<button type="button" class="pvc-floating-speaker" data-word="' + esc(curWord.word) + '" title="听单词发音">🔊</button>' +
                  '</div>' +
                  '<div class="pvc-word-row">' +
                    '<span class="pvc-en">' + esc(curWord.word) + '</span>' +
                    '<span class="pvc-ipa">' + esc(curWord.ipa || '') + '</span>' +
                  '</div>' +
                  '<div class="pvc-cn">' + esc(curWord.cn) + '</div>' +
                  '<div class="pvc-phonics-chips">' + curChips + '</div>' +
                  '<button type="button" class="pvc-flip-btn" data-act="flip">🔄 点击翻看 1秒巧记秘籍</button>' +
                '</div>' +
                // 反面: 3D 翻转 · 1秒形象巧记与TPR身体记忆
                '<div class="pep-card-face pep-card-back">' +
                  '<div class="pvc-back-head">' +
                    '<span class="pbh-word">' + esc(curWord.word) + '</span>' +
                    '<span class="pbh-cn">' + esc(curWord.cn) + '</span>' +
                  '</div>' +
                  '<div class="pvc-magic-box">' +
                    '<div class="pmb-title">💡 1秒形象巧记</div>' +
                    '<div class="pmb-body">' + esc(curWord.magicTip || curWord.tip || '观察字母形状与发音，大声读三遍！') + '</div>' +
                  '</div>' +
                  (curWord.tpr ? (
                    '<div class="pvc-tpr-box">' +
                      '<div class="ptb-title">🏃 动一动 TPR 身体记忆</div>' +
                      '<div class="ptb-body">' + esc(curWord.tpr) + '</div>' +
                    '</div>'
                  ) : '') +
                  '<div class="pvc-back-bottom">' +
                    '<button type="button" class="btn small ghost pvc-soundout-btn" data-widx="' + heroIdx + '">🧩 音素拆读</button>' +
                    '<button type="button" class="btn small primary pvc-flip-back" data-act="flip">🔄 翻回正面</button>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            // 沉浸模式专属前后翻页与发音操作栏
            '<div class="pep-hero-nav">' +
              '<button type="button" class="btn ghost" id="btnHeroPrev" ' + (heroIdx === 0 ? 'disabled' : '') + '>◀ 上一个</button>' +
              '<div class="pep-hero-progress">' +
                '<span>生词 <b>' + (heroIdx + 1) + '</b> / ' + unitWords.length + '</span>' +
                '<button type="button" class="btn small ghost" id="btnHeroSpeak">🔊 读此词</button>' +
              '</div>' +
              '<button type="button" class="btn primary" id="btnHeroNext" ' + (heroIdx === unitWords.length - 1 ? 'disabled' : '') + '>下一个 ▶</button>' +
            '</div>' +
          '</div>';
        } else {
          // 平铺全宽网格模式
          h += '<div class="pep-vocab-grid" id="pepVocabGrid">';
          unitWords.forEach(function (w, wIdx) {
            var pchips = (w.phonics || [w.word]).map(function (p) {
              return '<span class="pvc-pchip">' + esc(p) + '</span>';
            }).join('');
            h += '<div class="pep-card-3d" data-word="' + esc(w.word) + '" data-widx="' + wIdx + '">' +
              '<div class="pep-card-inner">' +
                // 正面: 认识与发音
                '<div class="pep-card-face pep-card-front">' +
                  '<div class="pvc-illustration-box">' +
                    PepIllustrations.getWordSvg(w) +
                    '<button type="button" class="pvc-floating-speaker" data-word="' + esc(w.word) + '" title="听单词发音">🔊</button>' +
                  '</div>' +
                  '<div class="pvc-word-row">' +
                    '<span class="pvc-en">' + esc(w.word) + '</span>' +
                    '<span class="pvc-ipa">' + esc(w.ipa || '') + '</span>' +
                  '</div>' +
                  '<div class="pvc-cn">' + esc(w.cn) + '</div>' +
                  '<div class="pvc-phonics-chips">' + pchips + '</div>' +
                  '<button type="button" class="pvc-flip-btn" data-act="flip">🔄 点击翻看 1秒巧记秘籍</button>' +
                '</div>' +
                // 反面: 3D 翻转 · 1秒巧记与TPR动一动
                '<div class="pep-card-face pep-card-back">' +
                  '<div class="pvc-back-head">' +
                    '<span class="pbh-word">' + esc(w.word) + '</span>' +
                    '<span class="pbh-cn">' + esc(w.cn) + '</span>' +
                  '</div>' +
                  '<div class="pvc-magic-box">' +
                    '<div class="pmb-title">💡 1秒形象巧记</div>' +
                    '<div class="pmb-body">' + esc(w.magicTip || w.tip || '观察字母形状与发音，大声读三遍！') + '</div>' +
                  '</div>' +
                  (w.tpr ? (
                    '<div class="pvc-tpr-box">' +
                      '<div class="ptb-title">🏃 动一动 TPR 身体记忆</div>' +
                      '<div class="ptb-body">' + esc(w.tpr) + '</div>' +
                    '</div>'
                  ) : '') +
                  '<div class="pvc-back-bottom">' +
                    '<button type="button" class="btn small ghost pvc-soundout-btn" data-widx="' + wIdx + '">🧩 音素拆读</button>' +
                    '<button type="button" class="btn small primary pvc-flip-back" data-act="flip">🔄 翻回正面</button>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>';
          });
          h += '</div>';
        }

        h += '<div class="pep-tab-footer-guide split">' +
            '<button type="button" class="btn ghost small" id="btnBackDlgFromVocab">← 返回课文情景对话</button>' +
            '<button type="button" class="btn primary small" id="btnGoChantFromVocab">👉 趣味歌谣与金句 (Let\'s chant) ➔</button>' +
          '</div>' +
        '</div>';

      } else if (curTab === 'chant') {
        // 子模块 3: 🎵 Let's chant · 课本趣味韵律歌谣 + ⭐ 单元课标金句秘籍 (图文结合情景呈现)
        h += '<div class="pep-section-card">' +
          '<div class="pep-chant-banner">' +
            '<div class="pcb-media">' +
              PepIllustrations.getChantSvg() +
            '</div>' +
            '<div class="pcb-info">' +
              '<div class="pcb-title">🎶 Let\'s chant · 课本趣味韵律歌谣伴读</div>' +
              '<div class="pcb-desc">打着节拍跟读，韵律节奏朗朗上口，建立纯正英语语感与语音记忆！</div>' +
            '</div>' +
          '</div>' +
          '<div class="psc-head">' +
            '<div class="psc-title">🎵 <b>歌谣点读</b> <span class="badge">语感律动</span></div>' +
            '<button type="button" class="btn small ghost" id="btnPlayChant">▶️ 完整歌谣朗读</button>' +
          '</div>' +
          '<div class="pep-chant-list" id="pepChantList">';
        les.chant.forEach(function (c, cIdx) {
          h += '<div class="pep-chant-item" data-cidx="' + cIdx + '" data-en="' + esc(c.en) + '">' +
            '<span class="pci-icon">🎶</span>' +
            '<div class="pci-body">' +
              '<div class="pci-en">' + esc(c.en) + '</div>' +
              '<div class="pci-cn">' + esc(c.cn) + '</div>' +
            '</div>' +
            '<button type="button" class="pdi-speak-btn" data-en="' + esc(c.en) + '">🔊</button>' +
          '</div>';
        });
        h += '</div></div>';

        // 单元课标考点金句秘籍 (左侧情景微插图 + 右侧句型公式与例句释义)
        h += '<div class="pep-section-card" style="margin-top:12px;">' +
          '<div class="psc-head">' +
            '<div class="psc-title">⭐ <b>单元课标金句秘籍</b> <span class="badge">必背 & 考试提分</span></div>' +
          '</div>' +
          '<div class="pep-pattern-list">';
        les.keyPatterns.forEach(function (kp, kpIdx) {
          h += '<div class="pep-pattern-card">' +
            '<div class="ppc-body-split">' +
              '<div class="ppc-scene-visual">' +
                PepIllustrations.getPatternSvg(kp, S.unit, kpIdx) +
              '</div>' +
              '<div class="ppc-content">' +
                '<div class="ppc-badge-row">' +
                  '<span class="ppc-badge">必背句型</span>' +
                  '<span class="ppc-tag">情景图解</span>' +
                '</div>' +
                '<div class="ppc-pattern"><b>公式：</b>' + esc(kp.pattern) + '</div>' +
                '<div class="ppc-example-row">' +
                  '<span class="ppc-example"><b>例句：</b>' + esc(kp.example) + '</span>' +
                  '<button type="button" class="ppc-speaker" data-en="' + esc(kp.example) + '" title="朗读此句">🔊</button>' +
                '</div>' +
                '<div class="ppc-cn"><b>释义：</b>' + esc(kp.cn) + '</div>' +
                '<div class="ppc-tip">💡 <b>秘籍：</b>' + esc(kp.tip) + '</div>' +
              '</div>' +
            '</div>' +
          '</div>';
        });
        h += '</div>' +
          '<div class="pep-tab-footer-guide split" style="margin-top:14px;">' +
            '<button type="button" class="btn ghost small" id="btnBackVocabFromChant">← 返回单元词汇</button>' +
            '<button type="button" class="btn good small" id="btnGoQuizFromChant">🎮 听音辨音大闯关 (测一测) ➔</button>' +
          '</div>' +
        '</div>';
      }

      h += '</div>';
      return h;
    }

    function bindLessonEvents() {
      var les = LESSON_DATA[S.unit] || LESSON_DATA['u1'];
      var curTab = S.lessonTab || 'dialogue';

      // 切换单元药丸
      host.querySelectorAll('.pep-unit-pill-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (isDebounced(200)) return;
          startSequence();
          var u = btn.getAttribute('data-unit');
          Sfx.click();
          newGame(u, 'lesson', S.lessonTab || 'dialogue');
        });
      });

      // 切换子模式 (Segmented Switcher)
      host.querySelectorAll('.pep-lsub-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (isDebounced(200)) return;
          var tab = btn.getAttribute('data-lsub');
          if (tab === S.lessonTab) return;
          startSequence();
          Sfx.click();
          S.lessonTab = tab;
          render();
        });
      });

      // 跨端语速切换
      host.querySelectorAll('.pep-rate-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var lvl = btn.getAttribute('data-rate');
          if (!lvl || lvl === speechRateLevel) return;
          Sfx.click();
          speechRateLevel = lvl;
          speechRate = lvl;
          if (typeof Store !== 'undefined' && Store.set) Store.set('pep_rate_level', lvl);
          render();
        });
      });

      if (curTab === 'dialogue') {
        // 剧场分镜幕次切换
        host.querySelectorAll('.pep-act-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (isDebounced(150)) return;
            var actIdx = parseInt(btn.getAttribute('data-act'), 10) || 0;
            S.dialogueAct = actIdx;
            var acts = les.acts || [];
            var currentAct = acts[actIdx] || acts[0];
            host.querySelectorAll('.pep-act-btn').forEach(function (b) {
              b.classList.toggle('active', parseInt(b.getAttribute('data-act'), 10) === actIdx);
            });
            var media = $('pepSceneMedia');
            if (media) {
              media.style.opacity = '0.3';
              setTimeout(function () {
                media.innerHTML = PepIllustrations.getSceneSvg(S.unit, actIdx);
                media.style.opacity = '1';
              }, 120);
            }
            var desc = $('pepSceneDesc');
            if (desc && currentAct) desc.textContent = currentAct.desc;
            var badge = host.querySelector('.psc-caption .psc-badge');
            if (badge && currentAct) badge.innerHTML = '🎬 ' + esc(currentAct.title);
            Sfx.click();
            var targetItem = host.querySelector('.pep-dialogue-item[data-act="' + actIdx + '"]');
            if (targetItem) targetItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          });
        });

        // 单句点读 (同步驱动剧场大画卷)
        host.querySelectorAll('.pep-dialogue-item').forEach(function (item) {
          item.addEventListener('click', function () {
            if (isDebounced(250)) return;
            startSequence();
            var en = item.getAttribute('data-en');
            var dAct = parseInt(item.getAttribute('data-act'), 10) || 0;
            if (typeof S.dialogueAct !== 'number' || S.dialogueAct !== dAct) {
              S.dialogueAct = dAct;
              host.querySelectorAll('.pep-act-btn').forEach(function (b) {
                b.classList.toggle('active', parseInt(b.getAttribute('data-act'), 10) === dAct);
              });
              var media = $('pepSceneMedia');
              if (media) media.innerHTML = PepIllustrations.getSceneSvg(S.unit, dAct);
              var acts = les.acts || [];
              var currentAct = acts[dAct] || acts[0];
              var desc = $('pepSceneDesc');
              if (desc && currentAct) desc.textContent = currentAct.desc;
              var badge = host.querySelector('.psc-caption .psc-badge');
              if (badge && currentAct) badge.innerHTML = '🎬 ' + esc(currentAct.title);
            }
            item.classList.add('speaking', 'karaoke-active');
            setTimeout(function () { item.classList.remove('speaking', 'karaoke-active'); }, 1400);
            speakWord(en, speechRate);
          });
        });

        // 连续角色对话跟读 (动态联动多幕分镜)
        var playDlgBtn = $('btnPlayDialogues');
        if (playDlgBtn) {
          playDlgBtn.addEventListener('click', function () {
            if (isDebounced(350)) return;
            var items = host.querySelectorAll('.pep-dialogue-item');
            if (!items.length) return;
            playDlgBtn.disabled = true;
            var origTxt = playDlgBtn.innerHTML;
            playDlgBtn.innerHTML = '🔊 对话朗读中...';

            var seqId = startSequence();
            var idx = 0;
            function stepDlg() {
              if (seqId !== sequenceToken) {
                playDlgBtn.disabled = false;
                playDlgBtn.innerHTML = origTxt;
                return;
              }
              items.forEach(function (it) { it.classList.remove('speaking', 'karaoke-active'); });

              if (idx < items.length) {
                var curItem = items[idx];
                curItem.classList.add('speaking', 'karaoke-active');
                curItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                var dAct = parseInt(curItem.getAttribute('data-act'), 10) || 0;
                if (typeof S.dialogueAct !== 'number' || S.dialogueAct !== dAct) {
                  S.dialogueAct = dAct;
                  host.querySelectorAll('.pep-act-btn').forEach(function (b) {
                    b.classList.toggle('active', parseInt(b.getAttribute('data-act'), 10) === dAct);
                  });
                  var media = $('pepSceneMedia');
                  if (media) media.innerHTML = PepIllustrations.getSceneSvg(S.unit, dAct);
                  var acts = les.acts || [];
                  var currentAct = acts[dAct] || acts[0];
                  var desc = $('pepSceneDesc');
                  if (desc && currentAct) desc.textContent = currentAct.desc;
                  var badge = host.querySelector('.psc-caption .psc-badge');
                  if (badge && currentAct) badge.innerHTML = '🎬 ' + esc(currentAct.title);
                }

                var en = curItem.getAttribute('data-en');
                idx++;
                speakWord(en, speechRate, function () {
                  setTimeout(stepDlg, 1100);
                });
              } else {
                setTimeout(function () {
                  if (seqId !== sequenceToken) return;
                  items.forEach(function (it) { it.classList.remove('speaking', 'karaoke-active'); });
                  playDlgBtn.disabled = false;
                  playDlgBtn.innerHTML = origTxt;
                }, 400);
              }
            }
            stepDlg();
          });
        }

        // 隐藏/显示中文切换
        var toggleCnBtn = $('btnToggleDialogCn');
        if (toggleCnBtn) {
          toggleCnBtn.addEventListener('click', function () {
            var dlgList = $('pepDialogueList');
            if (!dlgList) return;
            var isHidden = dlgList.classList.toggle('hide-dialogue-cn');
            toggleCnBtn.innerHTML = isHidden ? '👁️ 显示中文' : '👁️ 隐藏中文';
            Sfx.click();
          });
        }

        // 引导去词汇
        var goVocabBtn = $('btnGoVocabFromDlg');
        if (goVocabBtn) {
          goVocabBtn.addEventListener('click', function () {
            startSequence();
            Sfx.click();
            S.lessonTab = 'vocab';
            render();
          });
        }

      } else if (curTab === 'vocab') {
        var unitWords = S.words || [];

        // 沉浸单卡 / 全部平铺 视图切换
        var btnToggleMode = $('btnToggleCardMode');
        if (btnToggleMode) {
          btnToggleMode.addEventListener('click', function () {
            if (isDebounced(150)) return;
            Sfx.click();
            S.vocabMode = S.vocabMode === 'hero' ? 'grid' : 'hero';
            render();
          });
        }

        // 沉浸式单卡导航与发音
        var btnHeroPrev = $('btnHeroPrev');
        if (btnHeroPrev) {
          btnHeroPrev.addEventListener('click', function () {
            if (isDebounced(150)) return;
            if (S.vocabHeroIdx > 0) {
              S.vocabHeroIdx--;
              Sfx.click();
              render();
              if (unitWords[S.vocabHeroIdx]) speakWord(unitWords[S.vocabHeroIdx].word, speechRate);
            }
          });
        }
        var btnHeroNext = $('btnHeroNext');
        if (btnHeroNext) {
          btnHeroNext.addEventListener('click', function () {
            if (isDebounced(150)) return;
            if (S.vocabHeroIdx < unitWords.length - 1) {
              S.vocabHeroIdx++;
              Sfx.click();
              render();
              if (unitWords[S.vocabHeroIdx]) speakWord(unitWords[S.vocabHeroIdx].word, speechRate);
            }
          });
        }
        var btnHeroSpeak = $('btnHeroSpeak');
        if (btnHeroSpeak) {
          btnHeroSpeak.addEventListener('click', function () {
            if (isDebounced(200)) return;
            var curWord = unitWords[S.vocabHeroIdx];
            if (curWord) {
              Sfx.click();
              speakWord(curWord.word, speechRate);
            }
          });
        }

        // 3D 拟物翻转闪卡交互
        host.querySelectorAll('.pep-card-3d').forEach(function (card) {
          card.addEventListener('click', function (e) {
            if (e.target.closest('.pvc-floating-speaker') || e.target.closest('.pvc-soundout-btn')) return;
            if (isDebounced(150)) return;
            Sfx.click();
            card.classList.toggle('flipped');
          });
        });

        // 听单词发音 (阻止翻转冒泡)
        host.querySelectorAll('.pvc-floating-speaker').forEach(function (spk) {
          spk.addEventListener('click', function (e) {
            e.stopPropagation();
            if (isDebounced(250)) return;
            startSequence();
            var word = spk.getAttribute('data-word');
            var card = spk.closest('.pep-card-3d');
            if (card) {
              card.classList.add('speaking');
              setTimeout(function () { card.classList.remove('speaking'); }, 700);
            }
            speakWord(word, speechRate);
          });
        });

        // 全部翻面看巧记
        var btnFlipAll = $('btnFlipAllVocab');
        if (btnFlipAll) {
          var allFlipped = false;
          btnFlipAll.addEventListener('click', function () {
            allFlipped = !allFlipped;
            btnFlipAll.innerHTML = allFlipped ? '🔄 全部翻回正面' : '🔄 全部翻面看巧记';
            Sfx.click();
            host.querySelectorAll('.pep-card-3d').forEach(function (card) {
              card.classList.toggle('flipped', allFlipped);
            });
          });
        }

        // 连播全部单词
        var playAllVocabBtn = $('btnPlayAllVocab');
        if (playAllVocabBtn) {
          playAllVocabBtn.addEventListener('click', function () {
            if (isDebounced(350)) return;
            var cards = host.querySelectorAll('.pep-card-3d');
            if (!cards.length) return;
            playAllVocabBtn.disabled = true;
            var origTxt = playAllVocabBtn.innerHTML;
            playAllVocabBtn.innerHTML = '🔊 正在连播...';

            var seqId = startSequence();
            var idx = 0;
            function stepVocab() {
              if (seqId !== sequenceToken) {
                playAllVocabBtn.disabled = false;
                playAllVocabBtn.innerHTML = origTxt;
                return;
              }
              cards.forEach(function (c) { c.classList.remove('speaking'); });

              if (idx < cards.length) {
                var curCard = cards[idx];
                curCard.classList.add('speaking');
                curCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                var word = curCard.getAttribute('data-word');
                idx++;
                speakWord(word, speechRate, function () {
                  setTimeout(stepVocab, 1200);
                });
              } else {
                setTimeout(function () {
                  if (seqId !== sequenceToken) return;
                  cards.forEach(function (c) { c.classList.remove('speaking'); });
                  playAllVocabBtn.disabled = false;
                  playAllVocabBtn.innerHTML = origTxt;
                }, 400);
              }
            }
            stepVocab();
          });
        }

        // 卡片直达音素拆读机
        host.querySelectorAll('.pvc-soundout-btn').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var wIdx = parseInt(btn.getAttribute('data-widx'), 10) || 0;
            startSequence();
            Sfx.click();
            newGame(S.unit, 'phonics', 'soundout', wIdx);
          });
        });

        // 跳转音素拆读机
        var goSoundBtn = $('btnGoSoundout');
        if (goSoundBtn) {
          goSoundBtn.addEventListener('click', function () {
            if (isDebounced(250)) return;
            startSequence();
            Sfx.click();
            newGame(S.unit, 'phonics', 'soundout', 0);
          });
        }

        // 底部引导
        var backDlgBtn = $('btnBackDlgFromVocab');
        if (backDlgBtn) {
          backDlgBtn.addEventListener('click', function () {
            startSequence();
            Sfx.click();
            S.lessonTab = 'dialogue';
            render();
          });
        }
        var goChantBtn = $('btnGoChantFromVocab');
        if (goChantBtn) {
          goChantBtn.addEventListener('click', function () {
            startSequence();
            Sfx.click();
            S.lessonTab = 'chant';
            render();
          });
        }

      } else if (curTab === 'chant') {
        // 歌谣单句点读
        host.querySelectorAll('.pep-chant-item').forEach(function (cItem) {
          cItem.addEventListener('click', function () {
            if (isDebounced(250)) return;
            startSequence();
            var en = cItem.getAttribute('data-en');
            cItem.classList.add('speaking');
            setTimeout(function () { cItem.classList.remove('speaking'); }, 1200);
            speakWord(en, speechRate);
          });
        });

        // 连续歌谣跟读
        var playChantBtn = $('btnPlayChant');
        if (playChantBtn) {
          playChantBtn.addEventListener('click', function () {
            if (isDebounced(350)) return;
            var items = host.querySelectorAll('.pep-chant-item');
            if (!items.length) return;
            playChantBtn.disabled = true;
            var origTxt = playChantBtn.innerHTML;
            playChantBtn.innerHTML = '🎶 歌谣伴读中...';

            var seqId = startSequence();
            var idx = 0;
            function stepChant() {
              if (seqId !== sequenceToken) {
                playChantBtn.disabled = false;
                playChantBtn.innerHTML = origTxt;
                return;
              }
              items.forEach(function (it) { it.classList.remove('speaking'); });

              if (idx < items.length) {
                var curItem = items[idx];
                curItem.classList.add('speaking');
                curItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                var en = curItem.getAttribute('data-en');
                idx++;
                speakWord(en, speechRate, function () {
                  setTimeout(stepChant, 950);
                });
              } else {
                setTimeout(function () {
                  if (seqId !== sequenceToken) return;
                  items.forEach(function (it) { it.classList.remove('speaking'); });
                  playChantBtn.disabled = false;
                  playChantBtn.innerHTML = origTxt;
                }, 400);
              }
            }
            stepChant();
          });
        }

        // 金句发音
        host.querySelectorAll('.ppc-speaker').forEach(function (spk) {
          spk.addEventListener('click', function (e) {
            e.stopPropagation();
            if (isDebounced(250)) return;
            startSequence();
            var en = spk.getAttribute('data-en');
            speakWord(en, speechRate);
          });
        });

        // 底部引导
        var backVocabBtn = $('btnBackVocabFromChant');
        if (backVocabBtn) {
          backVocabBtn.addEventListener('click', function () {
            startSequence();
            Sfx.click();
            S.lessonTab = 'vocab';
            render();
          });
        }
        var goQuizBtn = $('btnGoQuizFromChant');
        if (goQuizBtn) {
          goQuizBtn.addEventListener('click', function () {
            startSequence();
            Sfx.click();
            newGame(S.unit, 'practice', 'quiz');
          });
        }
      }
    }

    /* ---------------- 模式 1：音素拆读机视图 ---------------- */
    function renderSoundOutView() {
      if (!S.words.length) {
        return '<div class="card center-txt" style="padding:40px 20px;">' +
          '<div style="font-size:48px;">🎉</div>' +
          '<h3>太棒啦！温故单词已全部复习完毕！</h3>' +
          '<p class="muted">昨天学习的内容已经牢牢巩固。回到单元继续学习新内容吧！</p>' +
          '<button class="btn primary" id="btnBackUnits">返回人教版教材单元 ➔</button>' +
        '</div>';
      }

      var w = S.words[S.idx];
      var mem = getMemoryMap()[w.id] || {};
      var starIcon = mem.star === 'gold' ? '🥇 黄金掌握' : (mem.star === 'silver' ? '🥈 形成记忆' : '🥉 稳固中');
      var isFlagged = mem.flag;

      var h = '<div class="pep-card-wrap">';

      // 顶部进度与掌握星章
      h += '<div class="pep-card-head">' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<button type="button" class="btn small ghost" id="btnBackToLesson">← 返回课本课堂</button>' +
          '<span class="pep-progress-txt">' + (S.idx + 1) + ' / ' + S.words.length + '</span>' +
        '</div>' +
        '<div class="pep-head-tags">' +
          (isFlagged ? '<span class="pep-flag-badge">🚩 重点攻坚词</span>' : '') +
          '<span class="pep-star-badge">' + starIcon + '</span>' +
        '</div>' +
      '</div>';

      // 核心卡片展示区
      h += '<div class="pep-sound-card ' + (S.hidden ? 'masked' : '') + '">' +
        '<div class="pep-card-top">' +
          '<div class="pep-illustration-thumb">' +
            PepIllustrations.getWordSvg(w) +
          '</div>' +
          '<div class="pep-cn-box">' +
            '<span class="pep-cn-txt">' + (S.hidden ? '❓ (先在脑海中读一读)' : esc(w.cn)) + '</span>' +
            '<span class="pep-ipa-txt">' + (S.hidden ? '/ ??? /' : esc(w.ipa)) + '</span>' +
          '</div>' +
          '<button type="button" class="pep-speaker-btn" id="btnMainSpeak" title="点击听标准发音">🔊</button>' +
        '</div>';

      // 音素积木区 (Phonics Sound Blocks)
      h += '<div class="pep-phonics-blocks" id="phonicsBlocks">';
      w.phonics.forEach(function (part, i) {
        var partIpa = (w.ipas && w.ipas[i]) || '';
        h += '<div class="pep-block" data-part="' + esc(part) + '" data-idx="' + i + '">' +
          '<span class="pb-letter">' + esc(part) + '</span>' +
          '<span class="pb-ipa">' + esc(partIpa) + '</span>' +
          '<span class="pb-hint">点我发音</span>' +
        '</div>';
      });
      h += '</div>';

      // 拼读连线滑轨 (Blend Bar)
      h += '<div class="pep-blend-row">' +
        '<button type="button" class="btn primary pep-blend-btn" id="btnBlendSound">' +
          '🚂 开动小火车 · 拼读连线 (Blend ➔ ' + esc(w.word) + '!)' +
        '</button>' +
        '<button type="button" class="btn ghost pep-mask-btn" id="btnToggleMask">' +
          (S.hidden ? '👁️ 揭晓答案' : '🙈 遮挡自测') +
        '</button>' +
      '</div>';

      // 🌟 1秒巧记小魔法与动作
      if (w.magicTip) {
        h += '<div class="pep-magic-box">💡 <b>1秒巧记小魔法：</b>' + esc(w.magicTip) + '</div>';
      }
      if (w.tpr) {
        h += '<div class="pep-tpr-box">🏃 <b>动动小身板：</b>' + esc(w.tpr) + '</div>';
      } else if (w.tip) {
        h += '<div class="pep-tip-box">💡 <b>拼读秘籍：</b>' + esc(w.tip) + '</div>';
      }

      h += '</div>'; // pep-sound-card

      // 底部操作区 (上一个、我会读啦、下一个)
      h += '<div class="pep-nav-row">' +
        '<button type="button" class="btn ghost" id="btnPrevWord" ' + (S.idx === 0 ? 'disabled' : '') + '>← 上一个</button>' +
        '<button type="button" class="btn good pep-pass-btn" id="btnPassWord">⭐ 我会读了，记住了！</button>' +
        '<button type="button" class="btn primary" id="btnNextWord">' +
          (S.idx === S.words.length - 1 ? '完成此单元 🎉' : '下一个 →') +
        '</button>' +
      '</div>';

      h += '</div>'; // pep-card-wrap
      return h;
    }

    /* ---------------- 模式 2：词族滑轨碰撞 ---------------- */
    function renderTrainView() {
      if (S.trainFamilyIdx >= WORD_FAMILIES.length) S.trainFamilyIdx = 0;
      var fam = WORD_FAMILIES[S.trainFamilyIdx] || WORD_FAMILIES[0];
      if (S.trainOnsetIdx >= fam.onsets.length) S.trainOnsetIdx = 0;
      var curOnset = fam.onsets[S.trainOnsetIdx] || fam.onsets[0];
      var curVowel = S.trainVowel || 'all';

      var totalTrainWords = 0;
      WORD_FAMILIES.forEach(function (wf) { totalTrainWords += wf.onsets.length; });

      var h = '<div class="pep-train-wrap">';
      h += '<div class="pep-train-header">' +
        '<div class="pth-left">' +
          '<h3 class="pth-title">🚂 拼读公式小火车 · 碰头拼读</h3>' +
          '<span class="pth-sub">核心法则：首辅音碰上词尾，推导一整串新单词！</span>' +
        '</div>' +
        '<span class="pth-badge">' + WORD_FAMILIES.length + ' 核心词族 · ' + totalTrainWords + ' 词</span>' +
      '</div>';

      // 短元音分类筛选药丸栏 (全部 / a / e / i / o / u)
      h += '<div class="pep-vowel-filter-row">' +
        '<button type="button" class="pep-vowel-filter-btn ' + (curVowel === 'all' ? 'active' : '') + '" data-vowel="all">全部 (25)</button>' +
        '<button type="button" class="pep-vowel-filter-btn ' + (curVowel === 'a' ? 'active' : '') + '" data-vowel="a">🌱 a (5)</button>' +
        '<button type="button" class="pep-vowel-filter-btn ' + (curVowel === 'e' ? 'active' : '') + '" data-vowel="e">🌿 e (5)</button>' +
        '<button type="button" class="pep-vowel-filter-btn ' + (curVowel === 'i' ? 'active' : '') + '" data-vowel="i">🌾 i (5)</button>' +
        '<button type="button" class="pep-vowel-filter-btn ' + (curVowel === 'o' ? 'active' : '') + '" data-vowel="o">🍁 o (5)</button>' +
        '<button type="button" class="pep-vowel-filter-btn ' + (curVowel === 'u' ? 'active' : '') + '" data-vowel="u">🌻 u (5)</button>' +
      '</div>';

      // 词族选择标签（根据元音筛选，横向滑动轨）
      h += '<div class="pep-family-tabs">';
      WORD_FAMILIES.forEach(function (f, i) {
        if (curVowel !== 'all' && f.vowel !== curVowel) return;
        var on = S.trainFamilyIdx === i ? 'active' : '';
        h += '<button type="button" class="pep-fam-btn ' + on + '" data-fam="' + i + '">' + f.label + ' (' + f.onsets.length + '词)</button>';
      });
      h += '</div>';

      // 碰撞展示核心大舞台
      h += '<div class="pep-train-stage">' +
        '<div class="pep-train-track">' +
          '<div class="pep-train-box onset-box bounce" id="trainOnsetBox">' +
            '<span class="tb-char">' + esc(curOnset.onset) + '</span>' +
            '<span class="tb-type">首辅音</span>' +
          '</div>' +
          '<div class="pep-train-plus">➕</div>' +
          '<div class="pep-train-box rime-box" id="trainRimeBox">' +
            '<span class="tb-char">-' + esc(fam.rime) + '</span>' +
            '<span class="tb-type">' + esc(fam.rimeIpa) + ' 词族</span>' +
          '</div>' +
          '<div class="pep-train-eq">➔</div>' +
          '<div class="pep-train-result" id="trainResultBox">' +
            '<span class="tr-emoji">' + curOnset.emoji + '</span>' +
            '<span class="tr-word">' + esc(curOnset.word) + '</span>' +
            '<span class="tr-cn">' + esc(curOnset.cn) + '</span>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="btn primary large pep-collide-btn" id="btnTriggerCollide">' +
          '💥 撞击拼读：' + curOnset.onset + ' + ' + fam.rime + ' ➔ ' + curOnset.word + '! 🔊' +
        '</button>' +
      '</div>';

      // 候选中首辅音积木列
      h += '<div class="pep-onsets-shelf">' +
        '<div class="shelf-title">👇 换一个首辅音推导新单词（本家族共 ' + fam.onsets.length + ' 个）：</div>' +
        '<div class="shelf-chips">';
      fam.onsets.forEach(function (item, idx) {
        var sel = S.trainOnsetIdx === idx ? 'selected' : '';
        h += '<button type="button" class="pep-shelf-chip ' + sel + '" data-onset-idx="' + idx + '">' +
          '<span class="sc-letter">' + esc(item.onset) + '</span>' +
          '<span class="sc-word">' + esc(item.word) + ' ' + item.emoji + '</span>' +
        '</button>';
      });
      h += '</div></div>';

      h += '</div>';
      return h;
    }

    /* ---------------- 模式 3：听音辨音大闯关 ---------------- */
    function renderQuizView() {
      // 准备题目
      if (!S.quizPool || !S.quizPool.length) {
        S.quizPool = generateQuizPool(S.unit);
        S.quizIdx = 0;
      }

      if (S.quizDone >= S.totalQuiz || S.quizIdx >= S.quizPool.length) {
        // 通关结算
        var starsEarned = S.score >= 7 ? 3 : (S.score >= 5 ? 2 : 1);
        if (api && api.over && !S.over) {
          S.over = true;
          api.over('win', { score: S.score, stars: starsEarned });
        }
        return '<div class="card center-txt pep-quiz-win">' +
          '<div style="font-size:56px;">🎉</div>' +
          '<h2>恭喜闯关成功！</h2>' +
          '<div class="win-stars">' +
            (starsEarned >= 1 ? '⭐' : '☆') +
            (starsEarned >= 2 ? '⭐' : '☆') +
            (starsEarned >= 3 ? '⭐' : '☆') +
          '</div>' +
          '<p class="muted">本次听力辨音测试得分：<b>' + S.score + '</b> / ' + S.totalQuiz + ' 题！</p>' +
          '<div class="btn-row center" style="margin-top:20px;">' +
            '<button class="btn primary" id="btnQuizAgain">再测一组 🔄</button>' +
            '<button class="btn ghost" id="btnQuizToSoundout">去读音机练练 🧩</button>' +
          '</div>' +
        '</div>';
      }

      var q = S.quizPool[S.quizIdx];
      var h = '<div class="pep-quiz-wrap">';

      // 顶部对决计分栏
      h += '<div class="pep-quiz-head">' +
        '<span class="pq-prog">第 ' + (S.quizDone + 1) + ' / ' + S.totalQuiz + ' 题</span>' +
        '<span class="pq-type-tag">' + (q.type === 'pair' ? '👂 易混音二选一' : (q.type === 'blank' ? '🧩 缺元音填空' : '🫧 听音拼词')) + '</span>' +
        '<span class="pq-streak">连对: <b>' + S.streak + '</b> ⭐</span>' +
      '</div>';

      // 听音播音核心区
      h += '<div class="pep-quiz-box">' +
        '<p class="pq-instruction">小耳朵仔细听：点击喇叭播放发音，选出正确的答案</p>' +
        '<button type="button" class="pep-quiz-audio-btn" id="btnQuizAudio">' +
          '<span class="pq-audio-icon">🔊</span>' +
          '<span class="pq-audio-txt">点击播放读音 (可无限次重复慢速收听)</span>' +
        '</button>';

      if (q.type === 'pair') {
        // 易混音二选一 (Listen and Circle)
        h += '<div class="pq-pair-options">';
        q.options.forEach(function (opt) {
          h += '<button type="button" class="pep-pair-card" data-ans="' + esc(opt.word) + '">' +
            '<span class="ppc-word">' + esc(opt.word) + '</span>' +
            '<span class="ppc-cn">' + esc(opt.cn) + ' ' + opt.emoji + '</span>' +
          '</button>';
        });
        h += '</div>';
      } else if (q.type === 'blank') {
        // 缺元音填空 (Listen and Complete)
        h += '<div class="pq-blank-word">' +
          '<span class="bw-char">' + esc(q.prefix) + '</span>' +
          '<span class="bw-slot" id="blankSlot">?</span>' +
          '<span class="bw-char">' + esc(q.suffix) + '</span>' +
        '</div>';
        h += '<div class="pq-blank-options">';
        ['a', 'e', 'i', 'o', 'u'].forEach(function (v) {
          h += '<button type="button" class="pep-vowel-btn" data-vowel="' + v + '">' + v + '</button>';
        });
        h += '</div>';
      } else if (q.type === 'spell') {
        // 听音拼词 (Listen and Spell)
        h += '<div class="pq-spell-display" id="spellDisplay">' +
          '<span class="sd-placeholder">请点击下方气泡，依次拼出单词...</span>' +
        '</div>';
        h += '<div class="pq-bubble-shelf" id="bubbleShelf">';
        q.scrambled.forEach(function (c, ci) {
          h += '<button type="button" class="pep-letter-bubble" data-char="' + esc(c) + '" data-bi="' + ci + '">' + esc(c) + '</button>';
        });
        h += '</div>';
        h += '<div class="center-txt" style="margin-top:10px;"><button type="button" class="btn small ghost" id="btnResetSpell">清空重拼 ↩️</button></div>';
      }

      h += '<div class="pq-feedback" id="quizFeedback"></div>';
      h += '</div>'; // pep-quiz-box

      h += '</div>';
      return h;
    }

    // 题目生成器
    function generateQuizPool(unitKey) {
      var pool = [];
      // 1. 插入易混二选一
      var pairs = shuffle(MINIMAL_PAIRS).slice(0, 3);
      pairs.forEach(function (p) {
        var wordObj = WORDS.filter(function (x) { return x.word === p.target; })[0] || { word: p.target, cn: p.target, emoji: '🎯' };
        var otherWord = p.target === p.a ? p.b : p.a;
        var otherObj = WORDS.filter(function (x) { return x.word === otherWord; })[0] || { word: otherWord, cn: otherWord, emoji: '❓' };
        var opts = shuffle([wordObj, otherObj]);
        pool.push({
          type: 'pair',
          target: p.target,
          audioText: p.audioText,
          options: opts,
          tip: p.tip
        });
      });

      // 2. 插入缺元音题
      var cvcWords = WORDS.filter(function (w) {
        return w.phonics.length === 3 && ['a', 'e', 'i', 'o', 'u'].indexOf(w.phonics[1]) >= 0;
      });
      shuffle(cvcWords).slice(0, 3).forEach(function (w) {
        pool.push({
          type: 'blank',
          target: w.phonics[1],
          audioText: w.word,
          prefix: w.phonics[0],
          suffix: w.phonics[2],
          fullWord: w.word,
          cn: w.cn,
          emoji: w.emoji
        });
      });

      // 3. 插入听音拼词题
      var unitWords = WORDS.filter(function (w) { return w.unit === unitKey; });
      if (!unitWords.length) unitWords = WORDS.slice(0, 10);
      shuffle(unitWords).slice(0, 2).forEach(function (w) {
        pool.push({
          type: 'spell',
          target: w.word,
          audioText: w.word,
          scrambled: shuffle(w.word.split('')),
          cn: w.cn,
          emoji: w.emoji
        });
      });

      return shuffle(pool).slice(0, S.totalQuiz);
    }

    /* ---------------- 模式 4：艾宾浩斯昨日温故唤醒舱视图 ---------------- */
    function renderReviewHomeView(dueList) {
      dueList = dueList || getReviewDueWords();
      var mem = getMemoryMap();
      var totalGold = 0, totalSilver = 0, totalBronze = 0, totalFlag = 0;
      WORDS.forEach(function (w) {
        var m = mem[w.id];
        if (!m) return;
        if (m.star === 'gold') totalGold++;
        else if (m.star === 'silver') totalSilver++;
        else if (m.star === 'bronze') totalBronze++;
        if (m.flag) totalFlag++;
      });
      var totalLearned = totalGold + totalSilver + totalBronze;

      var h = '<div class="pep-review-dashboard">';

      // 记忆资产总览看板
      h += '<div class="pep-review-stats-grid">' +
        '<div class="prsg-card gold">' +
          '<span class="prsg-icon">🥇</span>' +
          '<span class="prsg-val">' + totalGold + '</span>' +
          '<span class="prsg-lbl">黄金掌握 (永久记忆)</span>' +
        '</div>' +
        '<div class="prsg-card silver">' +
          '<span class="prsg-icon">🥈</span>' +
          '<span class="prsg-val">' + totalSilver + '</span>' +
          '<span class="prsg-lbl">形成记忆 (已巩固2次)</span>' +
        '</div>' +
        '<div class="prsg-card bronze">' +
          '<span class="prsg-icon">🥉</span>' +
          '<span class="prsg-val">' + totalBronze + '</span>' +
          '<span class="prsg-lbl">初学稳固 (待复习)</span>' +
        '</div>' +
        '<div class="prsg-card flag">' +
          '<span class="prsg-icon">🚩</span>' +
          '<span class="prsg-val">' + totalFlag + '</span>' +
          '<span class="prsg-lbl">易错攻坚生词</span>' +
        '</div>' +
      '</div>';

      // 待温故列表 / 无遗忘状态
      if (dueList.length > 0) {
        h += '<div class="pep-section-card" style="margin-top:14px;">' +
          '<div class="psc-head">' +
            '<div class="psc-title">🌅 <b>今日艾宾浩斯待温故单词 (' + dueList.length + ' 词)</b> <span class="badge" style="background:#fee2e2;color:#dc2626;">即将遗忘</span></div>' +
            '<button type="button" class="btn primary small" id="btnRunReviewSeq">⚡ 开启今日闪电唤醒 (2分钟)</button>' +
          '</div>' +
          '<p class="muted" style="margin:0 0 10px;font-size:12.5px;">根据人类大脑遗忘曲线，在单词变模糊前温故一次，记忆持久度提升 300%！</p>' +
          '<div class="pep-vocab-grid">';
        dueList.forEach(function (w, wIdx) {
          h += '<div class="pep-vocab-card" data-word="' + esc(w.word) + '">' +
            '<div class="pvc-top">' +
              '<span class="pvc-emoji">' + (w.emoji || '📖') + '</span>' +
              '<div class="pvc-word-info">' +
                '<span class="pvc-en">' + esc(w.word) + '</span>' +
                '<span class="pvc-ipa">' + esc(w.ipa || '') + '</span>' +
              '</div>' +
              '<button type="button" class="pvc-speaker" data-word="' + esc(w.word) + '">🔊</button>' +
            '</div>' +
            '<div class="pvc-cn">' + esc(w.cn) + '</div>' +
            (w.magicTip ? '<div class="pvc-magic">💡 ' + esc(w.magicTip) + '</div>' : '') +
            '<button type="button" class="btn small primary pvc-soundout-btn" data-review-idx="' + wIdx + '" style="margin-top:6px;width:100%;">⚡ 立即温故</button>' +
          '</div>';
        });
        h += '</div></div>';
      } else {
        h += '<div class="pep-section-card center-txt" style="margin-top:14px;padding:36px 16px;">' +
          '<div style="font-size:52px;line-height:1;margin-bottom:12px;">🌟</div>' +
          '<h3 style="margin:0 0 6px;color:#1e3a8a;">太棒啦！今日没有遗忘生词！</h3>' +
          '<p class="muted" style="max-width:440px;margin:0 auto 16px;font-size:13.5px;line-height:1.5;">' +
            '你已累计稳固 <b>' + totalLearned + '</b> 个单词，所有已学词都在安全记忆期中。继续去课本课堂学习新单元，或者去闯关挑战吧！' +
          '</p>' +
          '<div class="btn-row center" style="gap:10px;">' +
            '<button type="button" class="btn primary" id="btnGoLessonFromReview">📖 去课本同步课堂 ➔</button>' +
            '<button type="button" class="btn ghost" id="btnGoQuizFromReview">🎮 去听音辨音大闯关 ➔</button>' +
          '</div>' +
        '</div>';
      }

      h += '</div>';
      return h;
    }

    function bindReviewEvents() {
      var runSeqBtn = $('btnRunReviewSeq');
      if (runSeqBtn) {
        runSeqBtn.addEventListener('click', function () {
          startSequence();
          Sfx.click();
          newGame(S.unit, 'phonics', 'soundout', 0);
        });
      }

      host.querySelectorAll('[data-review-idx]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var rIdx = parseInt(btn.getAttribute('data-review-idx'), 10) || 0;
          startSequence();
          Sfx.click();
          newGame(S.unit, 'phonics', 'soundout', rIdx);
        });
      });

      host.querySelectorAll('.pvc-speaker').forEach(function (spk) {
        spk.addEventListener('click', function (e) {
          e.stopPropagation();
          var w = spk.getAttribute('data-word');
          speakWord(w, speechRateLevel);
        });
      });

      var goLesBtn = $('btnGoLessonFromReview');
      if (goLesBtn) goLesBtn.addEventListener('click', function () { newGame(S.unit, 'lesson'); });
      var goQuizBtn = $('btnGoQuizFromReview');
      if (goQuizBtn) goQuizBtn.addEventListener('click', function () { newGame(S.unit, 'practice', 'quiz'); });
    }

    /* ---------------- 事件监听与交互绑定 ---------------- */
    function bindEvents() {
      // 顶部温故按钮
      var revBtn = $('btnStartReview');
      if (revBtn) {
        revBtn.addEventListener('click', function () {
          Sfx.click();
          newGame(S.unit, 'practice', 'review');
        });
      }

      // 核心主模式导航 (三大主模式切换)
      host.querySelectorAll('.pep-main-tab').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (isDebounced(200)) return;
          var m = btn.getAttribute('data-main');
          Sfx.click();
          newGame(S.unit, m);
        });
      });

      // 次级工具分段切换
      host.querySelectorAll('.pep-sub-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (isDebounced(200)) return;
          var sub = btn.getAttribute('data-sub');
          Sfx.click();
          newGame(S.unit, S.mainMode, sub);
        });
      });

      // 跨端智能语速切换 (全局备用)
      host.querySelectorAll('.pep-rate-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var lvl = btn.getAttribute('data-rate');
          if (!lvl || lvl === speechRateLevel) return;
          Sfx.click();
          speechRateLevel = lvl;
          speechRate = lvl;
          if (typeof Store !== 'undefined' && Store.set) Store.set('pep_rate_level', lvl);
          if (S && S.words && S.words[S.idx]) speakWord(S.words[S.idx].word);
          render();
        });
      });

      // 模式事件分发
      if (S.mainMode === 'lesson') {
        bindLessonEvents();
      } else if (S.mainMode === 'phonics') {
        if (S.phonicsTab === 'train') {
          bindTrainEvents();
        } else {
          bindSoundOutEvents();
        }
      } else if (S.mainMode === 'practice') {
        if (S.practiceTab === 'quiz') {
          bindQuizEvents();
        } else {
          bindReviewEvents();
        }
      }
    }

    function bindSoundOutEvents() {
      var w = S.words[S.idx];
      if (!w) {
        var backBtn = $('btnBackUnits');
        if (backBtn) {
          backBtn.addEventListener('click', function () {
            newGame(S.unit, 'lesson');
          });
        }
        return;
      }

      // 返回课本课堂
      var backToLesBtn = $('btnBackToLesson');
      if (backToLesBtn) {
        backToLesBtn.addEventListener('click', function () {
          startSequence();
          Sfx.click();
          newGame(S.unit, 'lesson');
        });
      }

      // 主喇叭
      var speakBtn = $('btnMainSpeak');
      if (speakBtn) {
        speakBtn.addEventListener('click', function () {
          startSequence();
          speakWord(w.word);
        });
      }

      // 单个音素积木点击 (纯净朗读单字母，杜绝多余单词干扰)
      host.querySelectorAll('.pep-block').forEach(function (block) {
        block.addEventListener('click', function () {
          if (isDebounced()) return;
          startSequence();
          var part = block.getAttribute('data-part');
          block.classList.add('active-pop');
          setTimeout(function () { block.classList.remove('active-pop'); }, 400);
          speakPhonicsSound(part, w);
        });
      });

      // 拼读滑轨动画 (小火车按字母逐个点亮朗读 ➔ 到站全部高亮连读整词)
      var blendBtn = $('btnBlendSound');
      if (blendBtn) {
        blendBtn.addEventListener('click', function () {
          if (isDebounced(350)) return;
          var blocks = host.querySelectorAll('.pep-block');
          if (!blocks.length) return;
          blendBtn.disabled = true;

          var seqId = startSequence();
          var origBtnText = blendBtn.innerHTML;
          blendBtn.innerHTML = '🚂 小火车逐音拼读中... 🔊';

          // 步骤 1：顺着轨道依次开过每一个积木，每个积木点亮时发其对应的字母音，自然播放完毕后再继续下一字母
          var curIdx = 0;
          function stepBlock() {
            if (seqId !== sequenceToken) {
              blendBtn.disabled = false;
              blendBtn.innerHTML = origBtnText;
              return;
            }
            blocks.forEach(function (b) { b.classList.remove('active-pop'); });

            if (curIdx < blocks.length) {
              var b = blocks[curIdx];
              b.classList.add('active-pop');
              var part = b.getAttribute('data-part') || '';
              curIdx++;

              // 纯净朗读字母本身，自然结束后微停顿进入下一个
              speakWord(part, 'slow', function () {
                if (seqId !== sequenceToken) return;
                blendTimer = setTimeout(stepBlock, 180);
              });
            } else {
              // 步骤 2：小火车到站！全部积木同时高亮，连贯朗读完整单词 (如 cat!)
              blendTimer = setTimeout(function () {
                if (seqId !== sequenceToken) {
                  blendBtn.disabled = false;
                  blendBtn.innerHTML = origBtnText;
                  return;
                }
                blendBtn.innerHTML = '✨ 连读 ➔ ' + esc(w.word) + '! 🔊';
                blocks.forEach(function (b) { b.classList.add('active-pop'); });
                Sfx.pop();

                function cleanUpBlend() {
                  if (seqId !== sequenceToken) return;
                  blocks.forEach(function (b) { b.classList.remove('active-pop'); });
                  blendBtn.disabled = false;
                  blendBtn.innerHTML = origBtnText;
                }

                // 朗读完整合成单词
                speakWord(w.word, speechRateLevel, function () {
                  setTimeout(cleanUpBlend, 400);
                });
              }, 220);
            }
          }

          stepBlock();
        });
      }

      // 遮挡自测切换
      var maskBtn = $('btnToggleMask');
      if (maskBtn) {
        maskBtn.addEventListener('click', function () {
          if (isDebounced()) return;
          startSequence();
          S.hidden = !S.hidden;
          render();
          if (!S.hidden) speakWord(w.word);
        });
      }

      // 我会读啦按钮
      var passBtn = $('btnPassWord');
      if (passBtn) {
        passBtn.addEventListener('click', function () {
          if (isDebounced()) return;
          startSequence();
          Sfx.win();
          recordWordPass(w.id);
          api.toast('⭐ 太棒啦！已记录掌握，金星进度 +1！');
          passBtn.textContent = '✅ 已掌握！真棒！';
          passBtn.disabled = true;
          setTimeout(function () {
            if (S.idx < S.words.length - 1) {
              S.idx++;
              S.hidden = false;
              render();
              speakWord(S.words[S.idx].word);
              updateStatus();
            } else {
              render();
            }
          }, 700);
        });
      }

      // 上一个 / 下一个
      var prevBtn = $('btnPrevWord');
      var nextBtn = $('btnNextWord');
      if (prevBtn) {
        prevBtn.addEventListener('click', function () {
          if (isDebounced(250)) return;
          startSequence();
          if (S.idx > 0) {
            S.idx--;
            S.hidden = false;
            render();
            speakWord(S.words[S.idx].word);
            updateStatus();
          }
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          if (isDebounced(250)) return;
          startSequence();
          if (S.idx < S.words.length - 1) {
            S.idx++;
            S.hidden = false;
            render();
            speakWord(S.words[S.idx].word);
            updateStatus();
          } else {
            api.toast('🎉 本单元所有单词已浏览完毕！去闯关测验吧！');
            newGame(S.unit, 'practice', 'quiz');
          }
        });
      }
    }

    function bindTrainEvents() {
      var fam = WORD_FAMILIES[S.trainFamilyIdx] || WORD_FAMILIES[0];
      var curOnset = fam.onsets[S.trainOnsetIdx] || fam.onsets[0];

      // 切换短元音分类筛选
      host.querySelectorAll('.pep-vowel-filter-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (isDebounced(200)) return;
          startSequence();
          var v = btn.getAttribute('data-vowel');
          S.trainVowel = v;
          if (v !== 'all' && fam.vowel !== v) {
            for (var i = 0; i < WORD_FAMILIES.length; i++) {
              if (WORD_FAMILIES[i].vowel === v) {
                S.trainFamilyIdx = i;
                S.trainOnsetIdx = 0;
                break;
              }
            }
          }
          Sfx.click();
          render();
        });
      });

      // 切换词族
      host.querySelectorAll('.pep-fam-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (isDebounced(250)) return;
          startSequence();
          S.trainFamilyIdx = parseInt(btn.getAttribute('data-fam'), 10) || 0;
          S.trainOnsetIdx = 0;
          Sfx.click();
          render();
          var f = WORD_FAMILIES[S.trainFamilyIdx];
          speakWord(f.onsets[0].word);
        });
      });

      // 切换首辅音
      host.querySelectorAll('.pep-shelf-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          if (isDebounced(250)) return;
          startSequence();
          S.trainOnsetIdx = parseInt(chip.getAttribute('data-onset-idx'), 10) || 0;
          Sfx.click();
          render();
          var curO = fam.onsets[S.trainOnsetIdx];
          speakWord(curO.word);
        });
      });

      // 碰撞动画与发音 (💥 撞击拼读)
      var collideBtn = $('btnTriggerCollide');
      if (collideBtn) {
        collideBtn.addEventListener('click', function () {
          if (isDebounced(350)) return;
          var oBox = $('trainOnsetBox');
          var rBox = $('trainRimeBox');
          var resBox = $('trainResultBox');
          if (oBox && rBox) {
            oBox.classList.add('collide-left');
            rBox.classList.add('collide-right');
            Sfx.click();
            var seqId = startSequence();
            setTimeout(function () {
              if (seqId !== sequenceToken) return;
              oBox.classList.remove('collide-left');
              rBox.classList.remove('collide-right');
              if (resBox) resBox.classList.add('bounce-pop');

              // 步骤 1：首辅音 (例如 c)，自然播放完毕再进行步骤 2
              speakWord(curOnset.onset, 'slow', function () {
                if (seqId !== sequenceToken) return;
                setTimeout(function () {
                  if (seqId !== sequenceToken) return;
                  // 步骤 2：词族尾音 (例如 at)
                  speakWord(fam.rime, 'slow', function () {
                    if (seqId !== sequenceToken) return;
                    setTimeout(function () {
                      if (seqId !== sequenceToken) return;
                      // 步骤 3：碰撞合体合成词 (例如 cat!)
                      Sfx.win();
                      speakWord(curOnset.word, speechRateLevel, function () {
                        setTimeout(function () {
                          if (resBox) resBox.classList.remove('bounce-pop');
                        }, 300);
                      });
                    }, 200);
                  });
                }, 180);
              });
            }, 300);
          }
        });
      }
    }

    function bindQuizEvents() {
      if (S.quizDone >= S.totalQuiz || !S.quizPool || S.quizIdx >= S.quizPool.length) {
        var againBtn = $('btnQuizAgain');
        var toSoundBtn = $('btnQuizToSoundout');
        if (againBtn) againBtn.addEventListener('click', function () { newGame(S.unit, 'practice', 'quiz'); });
        if (toSoundBtn) toSoundBtn.addEventListener('click', function () { newGame(S.unit, 'phonics', 'soundout'); });
        return;
      }

      var q = S.quizPool[S.quizIdx];
      S._quizLocked = false; // 解除上题锁定，允许本题作答

      // 播放试题读音
      var audioBtn = $('btnQuizAudio');
      if (audioBtn) {
        audioBtn.addEventListener('click', function () {
          if (isDebounced(250)) return;
          speakWord(q.audioText);
        });
      }
      // 题目加载时自动播报一次
      speakWord(q.audioText);

      var fbEl = $('quizFeedback');

      // 题型 1：易混辨音 (Pair)
      host.querySelectorAll('.pep-pair-card').forEach(function (card) {
        card.addEventListener('click', function () {
          if (S._quizLocked) return;
          var chosen = card.getAttribute('data-ans');
          if (chosen === q.target) {
            handleQuizCorrect(card);
          } else {
            handleQuizWrong(card, q.target);
          }
        });
      });

      // 题型 2：缺音填空 (Blank)
      host.querySelectorAll('.pep-vowel-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (S._quizLocked) return;
          var chosen = btn.getAttribute('data-vowel');
          var slot = $('blankSlot');
          if (chosen === q.target) {
            if (slot) slot.textContent = chosen;
            handleQuizCorrect(btn);
          } else {
            handleQuizWrong(btn, q.target);
          }
        });
      });

      // 题型 3：拼词 (Spell)
      var currentSpelled = '';
      var spellBox = $('spellDisplay');
      var resetBtn = $('btnResetSpell');

      host.querySelectorAll('.pep-letter-bubble').forEach(function (bubble) {
        bubble.addEventListener('click', function () {
          if (S._quizLocked) return;
          if (bubble.classList.contains('used')) return;
          var c = bubble.getAttribute('data-char');
          bubble.classList.add('used');
          currentSpelled += c;
          speakPhonicsSound(c, q.target);
          if (spellBox) spellBox.textContent = currentSpelled;

          if (currentSpelled.length === q.target.length) {
            if (currentSpelled === q.target) {
              handleQuizCorrect(spellBox);
            } else {
              handleQuizWrong(spellBox, q.target);
              setTimeout(function () {
                currentSpelled = '';
                if (spellBox) spellBox.textContent = '再试一次哦...';
                host.querySelectorAll('.pep-letter-bubble').forEach(function (b) { b.classList.remove('used'); });
                S._quizLocked = false;
              }, 800);
            }
          }
        });
      });

      if (resetBtn) {
        resetBtn.addEventListener('click', function () {
          if (S._quizLocked) return;
          currentSpelled = '';
          if (spellBox) spellBox.textContent = '请点击气泡拼出单词...';
          host.querySelectorAll('.pep-letter-bubble').forEach(function (b) { b.classList.remove('used'); });
        });
      }

      function handleQuizCorrect(el) {
        if (S._quizLocked) return;
        S._quizLocked = true; // 锁定防止连击和重复发音
        Sfx.win();
        S.score++;
        S.streak++;
        S.quizDone++;
        recordWordPass(q.target);
        if (el) el.classList.add('correct');
        if (fbEl) fbEl.innerHTML = '<span class="fb-ok">🎉 太棒了，完全正确！' + esc(q.target) + '</span>';
        speakWord(q.audioText);
        setTimeout(function () {
          S.quizIdx++;
          render();
          updateStatus();
        }, 1100);
      }

      function handleQuizWrong(el, correctAns) {
        if (S._quizLocked) return;
        S._quizLocked = true; // 锁定防乱点
        Sfx.lose();
        S.streak = 0;
        recordWordFail(q.target);
        if (el) el.classList.add('wrong');
        if (fbEl) fbEl.innerHTML = '<span class="fb-no">💡 听一听，正确的是：<b>' + esc(correctAns) + '</b>（已标上复习红旗 🚩）</span>';
        speakWord(correctAns);
        setTimeout(function () {
          if (el) el.classList.remove('wrong');
          S._quizLocked = false; // 解除锁定允许再次作答
        }, 1000);
      }
    }

    // 默认直接初始化挂载 Unit 1 课本课堂
    newGame('u1', 'lesson');

    /* ---------------- 框架生命周期接口 ---------------- */
    return {
      restart: function (opts) {
        var unitKey = (opts && opts.side && UNITS[opts.side]) ? opts.side : 'u1';
        newGame(unitKey, 'lesson');
      },
      restore: function (d) {
        try {
          if (!d || d.kind !== 'english') return false;
          var subTab = (d.mainMode === 'lesson') ? (d.lessonTab || 'dialogue') : (d.phonicsTab || d.practiceTab);
          newGame(d.unit || 'u1', d.mainMode || 'lesson', subTab, d.idx || 0);
          return true;
        } catch (e) {
          return false;
        }
      },
      serialize: function () {
        if (!S) return null;
        return {
          v: 3, kind: 'english',
          unit: S.unit, mainMode: S.mainMode,
          lessonTab: S.lessonTab || 'dialogue',
          phonicsTab: S.phonicsTab, practiceTab: S.practiceTab,
          idx: S.idx, subMode: S.subMode,
          trainVowel: S.trainVowel || "all",
          trainFamilyIdx: S.trainFamilyIdx,
          trainOnsetIdx: S.trainOnsetIdx,
          score: S.score, totalQuiz: S.totalQuiz, quizDone: S.quizDone,
          streak: S.streak, over: S.over, ts: Date.now()
        };
      },
      undo: function () {
        if (!S || S.mainMode !== 'phonics' || S.phonicsTab !== 'soundout' || S.idx === 0) return;
        S.idx--;
        render();
        updateStatus();
      },
      hint: function () {
        if (!S) return;
        if (S.mainMode === 'phonics' && S.phonicsTab === 'soundout' && S.words[S.idx]) {
          var w = S.words[S.idx];
          api.toast('1秒巧记：' + (w.magicTip || w.tip || w.word + ' ' + w.ipa));
          speakWord(w.word);
        } else if (S.mainMode === 'phonics' && S.phonicsTab === 'train') {
          var fam = WORD_FAMILIES[S.trainFamilyIdx];
          api.toast(fam.label + '：首辅音撞击词尾，掌握规律推导新词！');
        } else {
          api.toast('提示：仔细辨别短元音口型大小（如 a大口，e小口，i微露牙）！');
        }
      },
      resign: function () {
        if (!S) return;
        if (S.mode === 'quiz') {
          S.quizDone = S.totalQuiz;
          render();
        }
      },
      setSpeechRate: function (lvl) {
        if (!lvl || !RATE_PROFILES[lvl]) return;
        speechRateLevel = lvl;
        speechRate = lvl;
        if (typeof Store !== 'undefined' && Store.set) Store.set('pep_rate_level', lvl);
        if (S) render();
      },
      redraw: function () {
        if (S) render();
      },
      destroy: function () {
        if (blendTimer) clearTimeout(blendTimer);
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      }
    };
  }

  /* ---------------- 注册游戏与配置 ---------------- */
  global.Games = global.Games || {};
  global.Games.english = {
    stageType: 'story',
    cat: 'kids',
    emoji: '🔤',
    name: '人教版英语 · 课本同步与自然拼读',
    desc: '2024最新三年级人教版PEP同步！课文情景点读、音素拆读机、五大短元音碰头小火车、艾宾浩斯昨日温故抗遗忘！',
    tags: ['人教版PEP', '课本同步', '自然拼读', '抗遗忘温故', '三年级同步'],
    rules: '①【课本同步课堂】：Unit 1~6 课文情景对话角色点读、双语切换、单元核心生词卡片（含1秒巧记小魔法与TPR肢体记忆）、趣味韵律歌谣与考点金句；②【自然拼读小火车】：短 a, e, i, o, u 5大元音家族碰头拼读大舞台，单词音素逐字拆解，滑读拼音与遮挡自测；③【闯关与抗遗忘】：听音辨音大闯关二选一与缺音填空，艾宾浩斯抗遗忘记忆库昨日温故唤醒。',
    guide: '三年级英语黄金学习法则：① 课前/课后：打开「课本同步课堂」，按单元点读课文和生词，模仿地道发音，做一做TPR肢体动作；② 拼读突破：打开「自然拼读小火车」，掌握字母拼读规律，见词能读，听音能写；③ 长期记忆：每天花2分钟在「昨日温故唤醒舱」打卡，把学过的单词牢牢锁在长期记忆库！',
    tip: '每天打开先看「抗遗忘提醒」，花 2 分钟闪电温故，单词记得又快又牢！',
    standalone: true,
    single: true,
    noLevel: true,
    dom: true,
    noUndo: true,
    noResign: true,
    noQuickActions: true,
    mount: mount
  };
})(window);
