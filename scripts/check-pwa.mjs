// Static PWA checks you can run anywhere: node scripts/check-pwa.mjs
// Verifies the pieces a browser needs. It does NOT prove installation works on a device; see docs/PWA-TESTING.md.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bad = [];
const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) bad.push(m); };

for (const f of ["public/sw.js", "public/offline.html", "public/icons/icon-192.png", "public/icons/icon-512.png", "public/icons/maskable-512.png", "public/icons/apple-touch-icon.png", "app/manifest.ts", "lib/splash.ts"]) ok(existsSync(join(root, f)), `${f} exists`);
const man = readFileSync(join(root, "app/manifest.ts"), "utf8");
for (const k of ['display: "standalone"', "theme_color", "background_color", "start_url", 'purpose: "maskable"', "scope", "id:"]) ok(man.includes(k), `manifest has ${k}`);
const splash = readdirSync(join(root, "public/splash"));
ok(splash.length >= 30, `${splash.length} splash images`);
const sp = readFileSync(join(root, "lib/splash.ts"), "utf8");
const refs = [...sp.matchAll(/src: "\/splash\/([^"]+)"/g)].map((m) => m[1]);
ok(refs.every((r) => splash.includes(r)), "every splash reference has a file");
const sw = readFileSync(join(root, "public/sw.js"), "utf8");
ok(/method !== "GET"\) return/.test(sw), "service worker ignores every non-GET request (writes are never intercepted)");
ok(/"\/admin"/.test(sw) && /"\/me"/.test(sw), "service worker never caches /admin or /me");
ok(!/\/api\/(finance|remittances|reports|members|users)/.test(sw), "service worker does not mention financial or private APIs");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
ok(layout.includes("startupImage") && layout.includes("capable: true"), "layout declares Apple web app + startup images");
process.exit(bad.length ? 1 : 0);
