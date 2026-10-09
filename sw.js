/* 离线缓存：安装时把全部静态资源写入缓存，之后断网也能打开。
   【更新策略】改代码时只需把 CACHE 版本号 +1（推荐直接跑 scripts/bump_version.py，
   它会同时同步 index.html 里的 ?v=）：
   - 导航请求（页面本身）走网络优先：联网打开就是最新版，断网才回退缓存
   - 其它静态资源走缓存优先：断网秒开，联网时后台顺手更新
   - 新 SW 装好后 skipWaiting + clients.claim，页面端检测到即自动保存进度并刷新

   【两个关键约束，改动前务必想清楚】
   1) 所有 fetch 都显式指定 cache 模式（install 用 reload，运行期用 no-cache），
      强制绕过浏览器 HTTP 缓存。否则会把上一轮 HTTP 强缓存里的旧文件装进新缓存，
      导致版本号 bump 了却依然显示旧版。
   2) 缓存键必须归一化（见 cacheKey）：预缓存列表存的是「不带参数」的 URL
      （./js/app.js），而页面引用的是带版本参数的 URL（js/app.js?v=v61）。
      两者不归一就永远匹配不上，预缓存形同虚设、断网会缺文件打不开。
      —— 归一后「离线可用」才真正有保障。 */
var CACHE = 'kidboard-v64';
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

/* 把请求 URL 归一化成缓存键：去掉 ?v= 之类的查询参数。
   预缓存列表里存的是「不带参数」的 URL，页面引用的却是「带版本参数」的 URL，
   归一之后两者指向同一条缓存记录 —— 这是「断网也能打开」的前提。
   跨域资源不做归一，保持原样。 */
function cacheKey(req) {
  try {
    var u = new URL(req.url);
    if (u.origin !== self.location.origin) return req.url;
    u.search = '';
    u.hash = '';
    return u.href;
  } catch (err) {
    return req.url;
  }
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(ASSETS.map(function (u) {
        /* 优先 cache:'reload'：强制走网络，避免把浏览器 HTTP 缓存里的旧文件装进新缓存；
           网络抖动时退回普通 fetch（可命中 HTTP 缓存），尽量把离线包攒完整 */
        return fetch(u, { cache: 'reload' }).then(function (res) {
          if (res && res.ok) return c.put(u, res);
        }).catch(function () {
          return fetch(u).then(function (res) {
            if (res && res.ok) return c.put(u, res);
          }).catch(function () { /* 单个文件失败不影响整体 */ });
        });
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

  var accept = e.request.headers.get('accept') || '';
  var isHTML = e.request.mode === 'navigate' || accept.indexOf('text/html') >= 0;

  /* 导航请求：网络优先（联网即拿最新版），失败再回退缓存 —— 保证断网也能开 */
  if (isHTML) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' }).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        }
        return res;
      }).catch(function () {
        /* 断网：先找请求的这个页面本身（如 name-cards.html 也在预缓存里），
           找不到才回退首页 —— 否则断网打开子页面会被硬塞回首页 */
        return caches.match(cacheKey(e.request)).then(function (hit) {
          if (hit) return hit;
          return caches.match('./index.html').then(function (home) {
            return home || caches.match('./');
          });
        });
      })
    );
    return;
  }

  /* 其它静态资源：缓存优先（离线秒开），命中后后台顺手更新一份。
     缓存键统一走 cacheKey()，这样页面请求的 js/app.js?v=v61
     也能命中预缓存里那份 ./js/app.js。 */
  var key = cacheKey(e.request);
  e.respondWith(
    caches.match(key).then(function (hit) {
      if (hit) {
        fetch(e.request, { cache: 'no-cache' }).then(function (res) {
          if (res && res.status === 200) caches.open(CACHE).then(function (c) { c.put(key, res.clone()); });
        }).catch(function () {});
        return hit;
      }
      return fetch(e.request, { cache: 'no-cache' }).then(function (res) {
        if (res && res.status === 200 && e.request.url.indexOf('http') === 0) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(key, copy); });
        }
        return res;
      }).catch(function () {
        /* 断网且缓存里没有：HTML 请求回退首页，其它资源让它正常失败，
           避免把一段 HTML 当成 JS/CSS 塞给浏览器造成更难排查的报错 */
        if (isHTML) return caches.match('./index.html');
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
