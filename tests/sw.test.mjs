// Runs public/sw.js in a sandbox with a fake Cache API and checks the safety rules. node tests/sw.test.mjs
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../public/sw.js"), "utf8");

const store = new Map(); // cacheName -> Map(url -> Response)
const mkCache = (n) => ({
  async put(r, res) { (store.get(n) ?? store.set(n, new Map()).get(n)).set(typeof r === "string" ? r : r.url, res); },
  async addAll(urls) { for (const u of urls) await this.put("https://x.test" + u, new Response("ok")); },
  async keys() { return [...(store.get(n)?.keys() ?? [])].map((u) => new Request(u)); },
  async delete(r) { return store.get(n)?.delete(typeof r === "string" ? r : r.url) ?? false; },
});
const caches = {
  async open(n) { if (!store.has(n)) store.set(n, new Map()); return mkCache(n); },
  async match(r, o) {
    const u = typeof r === "string" ? r : r.url;
    for (const [n, m] of store) { if (o?.cacheName && o.cacheName !== n) continue; if (m.has(u)) return m.get(u).clone(); const alt = "https://x.test" + u; if (m.has(alt)) return m.get(alt).clone(); }
  },
  async keys() { return [...store.keys()]; },
  async delete(n) { return store.delete(n); },
};
let online = true; const fetched = [];
const net = { "/": ["<html>home</html>", {}], "/events": ["<html>events</html>", {}], "/me": ["<html>private</html>", {}], "/admin/finance": ["<html>fin</html>", {}],
  "/api/public/events": ['{"rows":[1]}', { "Content-Type": "application/json" }], "/api/remittances": ['{"secret":1}', {}],
  "/api/media/pub": ["img", { "Cache-Control": "public, max-age=31536000, immutable" }], "/api/media/priv": ["secret", { "Cache-Control": "private, no-store" }],
  "/_next/static/a.js": ["js", {}] };
const fakeFetch = async (req) => {
  const u = new URL(typeof req === "string" ? req : req.url); fetched.push(u.pathname);
  if (!online) throw new TypeError("offline");
  const e = net[u.pathname]; if (!e) return new Response("nf", { status: 404 });
  return new Response(e[0], { status: 200, headers: e[1] });
};
const listeners = {};
const self = { location: new URL("https://x.test/"), addEventListener: (t, f) => (listeners[t] = f), clients: { claim: async () => {}, matchAll: async () => [], openWindow: async () => {} }, registration: {}, skipWaiting() { self.skipped = true; } };
vm.runInNewContext(src, { self, caches, fetch: fakeFetch, Request, Response, URL, Promise, console });

let bad = 0; const t = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) bad++; };
async function go(url, { method = "GET", mode = "cors" } = {}) {
  let out; let handled = false;
  const req = new Request("https://x.test" + url, { method }); Object.defineProperty(req, "mode", { value: mode });
  listeners.fetch({ request: req, respondWith: (p) => { handled = true; out = Promise.resolve(p); } });
  await new Promise((r) => setTimeout(r, 15));
  return { handled, res: out ? await out : null };
}
let w; listeners.install({ waitUntil: (p) => (w = p) }); await w;
listeners.activate({ waitUntil: (p) => (w = p) }); await w;

t((await go("/api/remittances", { method: "POST" })).handled === false, "POST /api/remittances is not handled by the worker");
t((await go("/api/remittances", { method: "PATCH" })).handled === false, "PATCH is not handled");
t((await go("/api/remittances")).handled === false, "GET of a financial API goes straight to the network");
await go("/admin/finance", { mode: "navigate" }); await go("/me", { mode: "navigate" });
t(![...store.values()].some((m) => [...m.keys()].some((k) => /admin|\/me/.test(k))), "/admin and /me are never stored");
await go("/", { mode: "navigate" }); await go("/events", { mode: "navigate" });
await go("/api/public/events"); await go("/api/media/pub"); await go("/api/media/priv"); await go("/_next/static/a.js");
t(![...store.values()].some((m) => [...m.keys()].some((k) => k.includes("/api/media/priv"))), "private media is never stored");
online = false;
let r = await go("/events", { mode: "navigate" }); t((await r.res.text()).includes("events"), "public page served from cache offline");
r = await go("/me", { mode: "navigate" }); t((await r.res.text()) === "ok", "private page offline shows the offline page, not a cached copy");
r = await go("/gallery", { mode: "navigate" }); t((await r.res.text()) === "ok", "never-visited public page offline shows the offline page");
r = await go("/api/public/events"); t((await r.res.text()).includes("rows"), "public JSON served from cache offline");
r = await go("/api/media/pub"); t((await r.res.text()) === "img", "public image served from cache offline");
await listeners.message({ data: { type: "CLEAR_USER_CACHES" }, waitUntil: (p) => (w = p) }); await w;
r = await go("/events", { mode: "navigate" }); t((await r.res.text()) === "ok", "sign-out clears cached pages");
process.exit(bad ? 1 : 0);
