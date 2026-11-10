// Pre-deployment check. Run: node scripts/check-env.mjs   (reads the current environment; use with `--env-file=.env.production` on Node 20+)
// Prints problems only by NAME, never by value.
const e = process.env;
const bad = [], warn = [];
const need = (k, ok, msg) => { if (!e[k]) bad.push(`${k} is not set. ${msg}`); else if (ok && !ok(e[k])) bad.push(`${k} is set but weak or invalid. ${msg}`); };
need("APP_SECRET", (v) => v.length >= 32, "Use 32+ random characters (openssl rand -base64 48).");
need("MONGODB_URI", (v) => /^mongodb(\+srv)?:\/\//.test(v), "Use your Atlas connection string.");
need("NEXT_PUBLIC_APP_URL", (v) => v.startsWith("https://"), "Use your real https:// address.");
if (!e.CRON_SECRET) warn.push("CRON_SECRET is not set: reminders and the Sheets sync will not run.");
if (e.BOOTSTRAP_ADMIN_PASSWORD || e.BOOTSTRAP_ADMIN_EMAIL) warn.push("BOOTSTRAP_ADMIN_* are set. Fine for the FIRST deploy. After the temporary administrator has chosen a new password, delete both and redeploy.");
if (e.BOOTSTRAP_ADMIN_PASSWORD && e.BOOTSTRAP_ADMIN_PASSWORD.length < 12) bad.push("BOOTSTRAP_ADMIN_PASSWORD is shorter than 12 characters.");
for (const k of Object.keys(e)) if (/^NEXT_PUBLIC_.*(SECRET|PASSWORD|TOKEN|KEY|URI)/i.test(k) && !/VAPID/i.test(k)) bad.push(`${k} starts with NEXT_PUBLIC_, so it would be sent to every browser. Rename it.`);
for (const m of bad) console.log("FAIL", m);
for (const m of warn) console.log("warn", m);
if (!bad.length) console.log("ok   required settings look fine");
process.exit(bad.length ? 1 : 0);
