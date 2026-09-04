/* 本地离线存储：localStorage 优先，不可用时自动降级到内存 */
(function (global) {
  var PREFIX = 'kidboard.v1.';
  var mem = {};
  var ok = true;
  try {
    global.localStorage.setItem(PREFIX + '__t', '1');
    global.localStorage.removeItem(PREFIX + '__t');
  } catch (e) { ok = false; }

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
