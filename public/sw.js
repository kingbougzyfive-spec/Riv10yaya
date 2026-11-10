/* Service worker v2.
 *
 * What it does:
 *  - Caches the app shell assets (/_next/static, icons) so the app opens fast.
 *  - Keeps a copy of a short list of PUBLIC pages and PUBLIC read-only JSON so they can be read offline.
 *  - Shows /offline.html when a page that cannot be cached is opened offline.
 *  - Web Push display and click handling.
 *
 * What it deliberately never does:
 *  - Never touches non-GET requests, so a payment, report, approval or any other write is never
 *    intercepted, queued, or answered by the worker. Offline, those requests simply fail.
 *  - Never caches /admin, /me, /login, /setup, /forgot, /reset, /print, or any /api route except the
 *    short public allowlist below. Financial and personal data are never stored by the worker.
 *  - Never stores a response marked Cache-Control: no-store or private.
 */
const VERSION = "v2";
const STATIC = `yaya-static-${VERSION}`;
const PAGES = `yaya-pages-${VERSION}`;
const DATA = `yaya-data-${VERSION}`;
const MEDIA = `yaya-media-${VERSION}`;
const ALL = [STATIC, PAGES, DATA, MEDIA];
const OFFLINE = "/offline.html";
const MAX_ENTRIES = { [PAGES]: 40, [DATA]: 40, [MEDIA]: 80 };

const PUBLIC_PAGES = ["/", "/about", "/events", "/announcements", "/departments", "/zones", "/leadership", "/gallery", "/contact", "/join", "/install"];
const PUBLIC_PAGE_PREFIXES = ["/events/", "/announcements/", "/zones/", "/departments/"];
const PUBLIC_JSON = ["/api/public/announcements", "/api/public/events", "/api/public/departments", "/api/public/org"];
const NEVER = ["/admin", "/me", "/login", "/setup", "/forgot", "/reset", "/print", "/attend"];

function isPublicPage(p) {
  return PUBLIC_PAGES.includes(p) || PUBLIC_PAGE_PREFIXES.some((x) => p.startsWith(x));
}
function isNever(p) {
  return NEVER.some((x) => p === x || p.startsWith(x + "/"));
}
function cacheable(res) {
  if (!res || res.status !== 200 || res.type === "opaque" || res.redirected) return false;
  const cc = (res.headers.get("Cache-Control") || "").toLowerCase();
  return !(cc.includes("no-store") || cc.includes("private"));
}
function publicMedia(res) {
  if (!res || res.status !== 200) return false;
  return (res.headers.get("Cache-Control") || "").toLowerCase().includes("public");
}
async function trim(name) {
  const max = MAX_ENTRIES[name];
  if (!max) return;
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}
async function put(name, req, res) {
  const c = await caches.open(name);
  await c.put(req, res);
  await trim(name);
}

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"])));
  // No automatic skipWaiting: the page asks the user first (UpdateToast) so a form is never reloaded mid-entry.
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("yaya-") && !ALL.includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener("message", (e) => {
  const t = e.data && e.data.type;
  if (t === "SKIP_WAITING") self.skipWaiting();
  // Sent on sign-out so nothing page-shaped lingers on a shared device.
  if (t === "CLEAR_USER_CACHES") e.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(DATA)]));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // writes are never handled here
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;

  if (req.mode === "navigate") {
    if (isNever(p)) {
      e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
      return;
    }
    if (isPublicPage(p)) {
      e.respondWith(
        fetch(req)
          .then((res) => {
            if (cacheable(res)) put(PAGES, new Request(url.origin + p), res.clone());
            return res;
          })
          .catch(async () => (await caches.match(new Request(url.origin + p), { cacheName: PAGES })) || (await caches.match(OFFLINE))),
      );
      return;
    }
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }

  if (p.startsWith("/_next/static/") || p.startsWith("/icons/") || p.startsWith("/splash/")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.status === 200) put(STATIC, req, res.clone()); return res; })));
    return;
  }

  if (p.startsWith("/api/media/")) {
    // Only public images are kept. Private files answer "no-store" and are never stored.
    e.respondWith(
      caches.match(req, { cacheName: MEDIA }).then((hit) => hit || fetch(req).then((res) => { if (publicMedia(res)) put(MEDIA, req, res.clone()); return res; })),
    );
    return;
  }

  if (PUBLIC_JSON.includes(p)) {
    // Network first so data is fresh online; the last copy is served offline.
    e.respondWith(
      fetch(req)
        .then((res) => { if (cacheable(res)) put(DATA, req, res.clone()); return res; })
        .catch(async () => (await caches.match(req, { cacheName: DATA })) || new Response(JSON.stringify({ error: "You are offline." }), { status: 503, headers: { "Content-Type": "application/json", "X-Offline": "1" } })),
    );
    return;
  }
  // Everything else (all other /api, /admin data, etc.) goes straight to the network.
});

/* Web Push: show the notification and open the linked page when it is tapped. */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "New update", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "New update", { body: d.body || "", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: d.url || "/" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  let url = (e.notification.data && e.notification.data.url) || "/";
  try { const u = new URL(url, self.location.origin); url = u.origin === self.location.origin ? u.pathname + u.search : "/"; } catch { url = "/"; }
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => {
    for (const w of ws) { if (new URL(w.url).origin === self.location.origin && "focus" in w) { w.navigate(url); return w.focus(); } }
    return self.clients.openWindow(url);
  }));
});
