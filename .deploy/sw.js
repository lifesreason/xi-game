/* 离线缓存：安装时把全部静态资源写入缓存，之后断网也能打开 */
var CACHE = 'kidboard-v6';
var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/store.js',
  './js/sfx.js',
  './js/boardkit.js',
  './js/games/gomoku.js',
  './js/games/go.js',
  './js/games/checkers.js',
  './js/games/xiangqi.js',
  './js/games/sudoku.js',
  './js/games/slide.js',
  './js/games/memory.js',
  './js/games/game24.js',
  './js/games/mathcamp.js',
  './js/app.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(ASSETS.map(function (u) {
        return c.add(u).catch(function () { /* 单个文件失败不影响整体 */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) {
        /* 后台顺手更新一份 */
        fetch(e.request).then(function (res) {
          if (res && res.status === 200) caches.open(CACHE).then(function (c) { c.put(e.request, res.clone()); });
        }).catch(function () {});
        return hit;
      }
      return fetch(e.request).then(function (res) {
        if (res && res.status === 200 && e.request.url.indexOf('http') === 0) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
