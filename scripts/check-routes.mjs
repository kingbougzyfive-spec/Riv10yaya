// Confirms every route in the specification has a page, and that old addresses redirect. node scripts/check-routes.mjs
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED = {
  public: ["/", "/about", "/leadership", "/structure", "/zones", "/events", "/events/[slug]", "/register/[eventId]", "/announcements", "/gallery", "/contact", "/install"],
  auth: ["/login", "/forgot-password", "/reset-password"],
  member: ["/member", "/member/profile", "/member/events", "/member/attendance", "/member/notifications"],
  portal: ["/portal", "/portal/remittance", "/portal/payment-evidence", "/portal/monthly-report", "/portal/attendance", "/portal/history", "/portal/notifications"],
  admin: ["/admin", "/admin/organizations", "/admin/users", "/admin/members", "/admin/events", "/admin/registrations", "/admin/attendance", "/admin/remittances", "/admin/finance", "/admin/reconciliation", "/admin/reports", "/admin/analytics", "/admin/leadership", "/admin/departments", "/admin/committees", "/admin/tasks", "/admin/meetings", "/admin/documents", "/admin/notifications", "/admin/ai-assistant", "/admin/settings", "/admin/audit-logs"],
  qr: ["/attendance/[token]"],
};
let bad = 0, n = 0;
for (const [group, list] of Object.entries(REQUIRED)) for (const r of list) {
  n++; const file = join(root, "app", r === "/" ? "" : r.slice(1), "page.tsx");
  const ok = existsSync(file); if (!ok) { bad++; console.log(`FAIL ${group.padEnd(6)} ${r}`); }
}
const cfg = readFileSync(join(root, "next.config.mjs"), "utf8");
for (const old of ["/forgot", "/reset", "/attend/:token", "/me", "/admin/organization", "/admin/assistant", "/admin/communications", "/admin/audit", "/admin/finance/dashboard", "/admin/governance"]) {
  n++; if (!cfg.includes(`source: "${old}"`)) { bad++; console.log(`FAIL old address ${old} has no redirect`); }
}
console.log(`${n - bad}/${n} checks passed`);
process.exit(bad ? 1 : 0);
