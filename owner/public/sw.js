/* 双味居老板端 Service Worker
 * 策略：
 *   1. 静态资源（assets/、css/js/图片）→ 缓存优先 + 后台更新（SWR）
 *   2. 页面导航 → 网络优先，失败回落缓存的外壳页（离线可打开）
 *   3. 跨域请求（Supabase REST / Realtime）→ 完全不拦截
 * 升级：构建时 scripts/stamp-sw.mjs 会把 VERSION 换成时间戳，
 *        新版 activate 阶段自动清掉旧版全部缓存（含上一版哈希文件）
 */
const VERSION = "shuangwei-owner-v1";
const SHELL = "./";

const isAsset = (url) =>
  /\/assets\//.test(url.pathname) ||
  /\.(?:css|js|mjs|png|jpg|jpeg|svg|webp|ico|woff2?|webmanifest)$/.test(
    url.pathname,
  );

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll([SHELL]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return; // 第三方一律放行

  if (isAsset(url)) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(req, { ignoreSearch: true });
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok && res.type === "basic")
              cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || network;
      }),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(SHELL, copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(SHELL)
            .then((c) => c || caches.match("./") || Response.error()),
        ),
    );
  }
});
