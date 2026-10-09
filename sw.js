/* 离线缓存：安装时把全部静态资源写入缓存，之后断网也能打开。
   【更新策略】改代码时只需把 CACHE 版本号 +1（推荐直接跑 scripts/bump_version.py，
   它会同时同步 index.html 里的 ?v=，避免「SW 换了但资源还是旧的」）：
   - 导航请求（页面本身）走网络优先：联网打开就是最新版，断网才回退缓存
   - 新 SW 装好后 skipWaiting + clients.claim，页面端检测到即自动保存进度并刷新
   - 【关键】下面所有 fetch 都显式指定 cache 模式，强制绕过浏览器 HTTP 缓存。
     否则 cache.add() / fetch() 会命中上一轮 HTTP 强缓存里的旧文件，
     新 SW 也会把旧资源装进新缓存，导致版本号 bump 了却依然显示旧版。 */
var CACHE = 'kidboard-v61';
var ASSETS = [
  './',
  './index.html',
  './name-cards.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/store.js',
  './js/sfx.js',
  './js/fx.js',
  './js/gestures.js',
  './js/boardkit.js',
  './js/names-data.js',
  './js/names-audio-data.js',
  './js/name-cards.js',
  './audio/names-sprite.mp3',
  './js/games/gomoku.js',
  './js/games/go.js',
  './js/games/checkers.js',
  './js/games/xiangqi.js',
  './js/games/sudoku.js',
  './js/games/slide.js',
  './js/games/memory.js',
  './js/games/game24.js',
  './js/games/mathcamp.js',
  './js/games/english.js',
  './js/games/hanoi.js',
  './js/games/lightsout.js',
  './js/games/nonogram.js',
  './js/games/mastermind.js',
  './js/games/pattern.js',
  './js/games/shadow.js',
  './js/games/mole.js',
  './js/games/catch.js',
  './js/games/puzzle.js',
  './js/games/diff.js',
  './js/games/simon.js',
  './js/games/slidepic.js',
  './js/games/dragpuzzle.js',
  './js/games/sokoban.js',
  './js/games/pipes.js',
  './js/games/mines.js',
  './js/games/balance.js',
  './js/games/xylo.js',
  './js/games/paint.js',
  './js/app.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(ASSETS.map(function (u) {
        /* cache:'reload' 强制走网络并刷新 HTTP 缓存条目，
           避免把浏览器 HTTP 缓存里的旧文件装进新 SW 缓存 */
        return fetch(u, { cache: 'reload' }).then(function (res) {
          if (res && res.ok) return c.put(u, res);
        }).catch(function () { /* 单个文件失败不影响整体 */ });
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

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;

  /* 导航请求：网络优先（联网即拿最新版），失败再回退缓存 —— 保证断网也能开 */
  var accept = e.request.headers.get('accept') || '';
  if (e.request.mode === 'navigate' || accept.indexOf('text/html') >= 0) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' }).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (hit) {
          return hit || caches.match('./');
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) {
        /* 后台顺手更新一份（no-cache：强制向服务器确认，避免拿到 HTTP 缓存里的旧文件） */
        fetch(e.request, { cache: 'no-cache' }).then(function (res) {
          if (res && res.status === 200) caches.open(CACHE).then(function (c) { c.put(e.request, res.clone()); });
        }).catch(function () {});
        return hit;
      }
      return fetch(e.request, { cache: 'no-cache' }).then(function (res) {
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
