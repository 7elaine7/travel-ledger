// Service Worker — 旅行记账 PWA 离线缓存
// 硬约束 5（PROJECT_BRIEF.md 第 3 节）+ 5.2-F12（App 安装后必须完全离线可用）
//
// === 使用纪律（任何修改前必读）===
// 1. 任何 app-shell 资源（下方 APP_SHELL_URLS 列表）有变动 → 必须 bump CACHE_VERSION
//    （如 'pwa-v1' → 'pwa-v2'），否则用户永远拿到旧缓存。
// 2. 改动后验证需刷新两次：第一次刷新装新 SW（旧 SW 仍控制页面），
//    第二次刷新才用新缓存。Safari DevTools → Application → Service Workers
//    可手动 skipWaiting 加速，但验收时仍按两次刷新走真实路径。
//
// === 缓存清单同步约束 ===
// 下方 APP_SHELL_URLS 必须与 index.html 末尾 <script> 列表保持同步，
// 今后新增 js 模块必须两处同时改（漏一项 → cache.addAll 整体失败 → SW 不激活）。
//
// 离线策略：全量 cache-first（无 network-first 混用）。
// app-shell 是静态资源、无运行时数据，cache-first 命中即返回、无网络延迟；
// 非白名单 URL 一律 network-only，不缓存（避免误存业务数据）。

const CACHE_VERSION = 'pwa-v15';
const CACHE_NAME = `travel-ledger-${CACHE_VERSION}`;

// 与 index.html <script> 列表保持同步
const APP_SHELL_URLS = [
  './',
  'index.html',
  'css/styles.css',
  'css/tokens.css',
  'css/app-v2.css',
  'js/db.js',
  'js/profiles.js',
  'js/session.js',
  'js/parser.js',
  'js/entry-utils.js',
  'js/ledger.js',
  'js/export.js',
  'js/app.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon-180.png',
  /* S3-06 载录页素材：印章 + 6 分类图 + 2 字体（字体 ~29MB 预缓存成本 → PENDING #17）
     S3-07 账簿页素材：印章 seal-zhang.png（分类图/字体与载录页共用，已在上方清单）
     S3-08 阅踪页素材：印章 seal-zong.png */
  'assets/seals/seal-ji.png',
  'assets/seals/seal-zhang.png',
  'assets/seals/seal-zong.png',
  'assets/icons/category/category-food.png',
  'assets/icons/category/category-transport.png',
  'assets/icons/category/category-driving.png',
  'assets/icons/category/category-hotel.png',
  'assets/icons/category/category-ticket.png',
  'assets/icons/category/category-other.png',
  'assets/fonts/fosi-ti.ttf',
  'assets/fonts/SiyinSong-Regular.otf',
  'manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      // 只清本应用的旧版本缓存，避免误删同源下其他缓存
      const toDelete = keys.filter((k) => k.startsWith('travel-ledger-') && k !== CACHE_NAME);
      return Promise.all(toDelete.map((k) => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 同源 + 在白名单 → cache-first
  if (url.origin === self.location.origin && APP_SHELL_URLS.includes(url.pathname === '/' ? './' : url.pathname.slice(1))) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((resp) => {
          // 安装期未命中的资源，运行时按需补缓存（仅 200 OK）
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return resp;
        }).catch((err) => {
          // 走到这里 = 缓存没有 + 网络也拿不到（离线且资源未预缓存）。
          // 不假兜底：抛出让浏览器按真实网络失败处理，日志帮助定位是哪条 URL 漏缓存。
          console.warn('SW fetch miss（可能离线且资源未缓存）', req.url);
          throw err;
        });
      })
    );
  }
  // 其他请求：network-only，不缓存
});
