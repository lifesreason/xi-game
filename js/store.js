/* 本地离线存储：localStorage 优先，不可用时自动降级到内存 */
(function (global) {
  var PREFIX = 'kidboard.v1.';
  var mem = {};
  var ok = true;
  try {
    global.localStorage.setItem(PREFIX + '__t', '1');
    global.localStorage.removeItem(PREFIX + '__t');
  } catch (e) { ok = false; }

  var BADGE_DEFS = [
    { id: 'first_win', name: '初露锋芒', emoji: '🐣', desc: '赢得任意 1 局游戏' },
    { id: 'math_streak', name: '连对超人', emoji: '🔥', desc: '口算达成 5 连对及以上' },
    { id: 'math_master', name: '极速心算家', emoji: '⚡', desc: '口算一轮全对 100%' },
    { id: 'hanoi_3', name: '通天塔学徒', emoji: '🗼', desc: '通关汉诺塔 3 层' },
    { id: 'hanoi_master', name: '汉诺塔宗师', emoji: '👑', desc: '通关汉诺塔 5 层或以上' },
    { id: 'lights_novice', name: '点灯小行家', emoji: '💡', desc: '通关奇妙点灯关卡' },
    { id: 'lights_master', name: '璀璨星空', emoji: '✨', desc: '通关奇妙点灯 5 关以上' },
    { id: 'memory_champ', name: '最强大脑', emoji: '🎴', desc: '记忆翻牌全配对完成' },
    { id: 'game24_pro', name: '巧凑24点', emoji: '🎯', desc: '成功解出 24 点' },
    { id: 'slide_solved', name: '华容道破局', emoji: '🧩', desc: '成功还原数字华容道' },
    { id: 'nonogram_clear', name: '像素画家', emoji: '🦊', desc: '完成一幅数织像素画' },
    { id: 'nonogram_pro', name: '数织大师', emoji: '🎨', desc: '完成 10×10 高阶数织' },
    { id: 'mastermind_crack', name: '神探破译', emoji: '🕵️', desc: '成功破译推理密码' },
    { id: 'mastermind_fast', name: '极速神探', emoji: '🔍', desc: '4 次以内破译密码' },
    { id: 'pattern_brain', name: '规律小达人', emoji: '🐣', desc: '规律排排看全部答对' },
    { id: 'shadow_eagle', name: '火眼金睛', emoji: '🐰', desc: '影子找朋友全部答对' },
    { id: 'mole_hammer', name: '快手小锤手', emoji: '🐹', desc: '打地鼠达成目标分数' },
    { id: 'catch_star', name: '摘星小能手', emoji: '⭐', desc: '接星星达成目标分数' },
    { id: 'puzzle_star', name: '拼拼乐高手', emoji: '🖼️', desc: '完成一幅可爱拼图' },
    { id: 'diff_master', name: '找不同神眼', emoji: '🔍', desc: '找不同全部通关' },
    { id: 'simon_brain', name: '记忆小灯神', emoji: '💡', desc: '记忆亮灯达到目标步数' },
    { id: 'slide_pilot', name: '滑动小司机', emoji: '🚂', desc: '复原移动拼图' },
    { id: 'drag_ninja', name: '巧手搬运工', emoji: '🧸', desc: '完成拖拖拼图' },
    { id: 'sokoban_brain', name: '搬运小达人', emoji: '🚜', desc: '完成一个推箱子关卡包' },
    { id: 'pipes_flow', name: '水利工程师', emoji: '🚇', desc: '接通全部水管不漏水' },
    { id: 'mines_digger', name: '排雷小英雄', emoji: '💣', desc: '扫雷推理获胜' },
    { id: 'balance_angel', name: '天平小法官', emoji: '⚖️', desc: '连续平衡 5 道天平题' },
    { id: 'music_star', name: '小小音乐家', emoji: '🎵', desc: '完整弹完一首儿歌' },
    { id: 'paint_master', name: '神笔小画家', emoji: '🎨', desc: '保存第一幅画作' },
    { id: 'writing_doctor', name: '啄木鸟医生', emoji: '🐦', desc: '捉虫关判胜 3 轮' },
    { id: 'writing_eye', name: '捉虫神眼', emoji: '🔍', desc: '清空错字本 1 次' },
    { id: 'writing_alchemy', name: '炼金术士', emoji: '⚗️', desc: '收集 10 张词卡' },
    { id: 'writing_master', name: '图鉴大师', emoji: '📖', desc: '收集 40 张词卡' },
    { id: 'writing_police', name: '断句小交警', emoji: '🚦', desc: '标点关判胜 1 轮' },
    { id: 'win_10', name: '常胜小将军', emoji: '🏆', desc: '累计获胜达到 10 局' },
    { id: 'win_30', name: '棋坛小霸王', emoji: '🎖️', desc: '累计获胜达到 30 局' }
  ];

  var Store = {
    persistent: ok,
    get: function (key, def) {
      try {
        var raw = ok ? global.localStorage.getItem(PREFIX + key) : mem[key];
        if (raw == null) return def;
        return JSON.parse(raw);
      } catch (e) { return def; }
    },
    set: function (key, val) {
      var raw = JSON.stringify(val);
      if (ok) {
        try { global.localStorage.setItem(PREFIX + key, raw); return true; }
        catch (e) { /* 配额不足则降级 */ }
      }
      mem[key] = raw;
      return false;
    },
    del: function (key) {
      if (ok) { try { global.localStorage.removeItem(PREFIX + key); } catch (e) {} }
      delete mem[key];
    },
    keys: function () {
      var out = [];
      if (ok) {
        for (var i = 0; i < global.localStorage.length; i++) {
          var k = global.localStorage.key(i);
          if (k && k.indexOf(PREFIX) === 0) out.push(k.slice(PREFIX.length));
        }
      }
      for (var m in mem) if (out.indexOf(m) < 0) out.push(m);
      return out;
    },
    /* ---------- 业务数据 ---------- */
    getSettings: function () {
      var d = {
        theme: 'bright', sound: true, coords: false,
        mode: 'pve', side: 1,
        levels: { gomoku: 'normal', go: 'normal', checkers: 'normal', xiangqi: 'normal' }
      };
      var s = Store.get('settings', {});
      for (var k in d) if (!(k in s)) s[k] = d[k];
      if (!s.levels) s.levels = d.levels;
      for (var g in d.levels) if (!(g in s.levels)) s.levels[g] = 'normal';
      return s;
    },
    saveSettings: function (s) { Store.set('settings', s); },

    getStats: function () { return Store.get('stats', {}); },
    addResult: function (gameId, result) {
      var st = Store.getStats();
      if (!st[gameId]) st[gameId] = { win: 0, lose: 0, draw: 0 };
      st[gameId][result] = (st[gameId][result] || 0) + 1;
      Store.set('stats', st);
      return st;
    },

    getRecords: function () { return Store.get('records', []); },
    addRecord: function (rec) {
      var list = Store.getRecords();
      list.unshift(rec);
      if (list.length > 300) list.length = 300;
      Store.set('records', list);
      return list;
    },
    delRecord: function (ts) {
      Store.set('records', Store.getRecords().filter(function (r) { return r.ts !== ts; }));
    },
    clearRecords: function () { Store.set('records', []); Store.set('stats', {}); },

    /* ---------- 成就与智慧之星系统 ---------- */
    getStars: function () { return Store.get('stars', 0); },
    addStars: function (n) {
      var cur = Store.getStars() + (n || 1);
      Store.set('stars', cur);
      return cur;
    },
    getBadges: function () { return Store.get('badges', []); },
    unlockBadge: function (id) {
      var list = Store.getBadges();
      if (list.indexOf(id) >= 0) return false;
      list.push(id);
      Store.set('badges', list);
      return true;
    },
    getAllBadges: function () {
      var unlocked = Store.getBadges();
      return BADGE_DEFS.map(function (b) {
        return {
          id: b.id, name: b.name, emoji: b.emoji, desc: b.desc,
          unlocked: unlocked.indexOf(b.id) >= 0
        };
      });
    },

    /* ---------- 最佳纪录系统 ----------
       key: '游戏.模式'；lowerBetter=true 表示数值越小越好（步数/用时）。
       返回 true 表示打破了之前的纪录（首次达成不算破纪录）。 */
    getBest: function (key) { return Store.get('best.' + key, null); },
    setBest: function (key, val, lowerBetter) {
      var cur = Store.get('best.' + key, null);
      var isRecord = cur != null && (lowerBetter ? val < cur : val > cur);
      if (isRecord || cur == null) Store.set('best.' + key, val);
      return isRecord;
    },

    saveGame: function (gameId, data) { Store.set('save.' + gameId, data); },
    loadGame: function (gameId) { return Store.get('save.' + gameId, null); },
    clearGame: function (gameId) { Store.del('save.' + gameId); },

    exportAll: function () {
      var out = {};
      Store.keys().forEach(function (k) { out[k] = Store.get(k, null); });
      return out;
    },
    importAll: function (obj) {
      if (!obj || typeof obj !== 'object') return false;
      for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) Store.set(k, obj[k]);
      return true;
    },
    clearAll: function () { Store.keys().forEach(function (k) { Store.del(k); }); }
  };

  global.Store = Store;
})(window);
