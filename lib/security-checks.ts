export type Check = { id: string; level: "ok" | "warn" | "fail"; title: string; detail: string };

export type Facts = {
  env: Record<string, string | undefined>;
  superAdmins: number;
  bootstrapPending: number; // bootstrap accounts that still have a temporary password
  tempPasswords: number; // people who still must replace a temporary password
  backupConnections: number; // linked backup databases
  failedLogins24h: number;
  blockedLogins24h: number;
  errors24h: number;
  isProd: boolean;
};

/** Pure: turns facts about the deployment into a plain-language checklist. No secrets are ever included. */
export function runChecks(x: Facts): Check[] {
  const c: Check[] = [];
  const add = (id: string, level: Check["level"], title: string, detail: string) => c.push({ id, level, title, detail });
  const secret = x.env.APP_SECRET || "";
  add("secret", secret.length >= 32 ? "ok" : secret.length >= 16 ? "warn" : "fail", "Session signing secret",
    secret.length >= 32 ? "APP_SECRET is set and long enough." : "APP_SECRET should be at least 32 random characters. Changing it signs everyone out.");
  const url = x.env.NEXT_PUBLIC_APP_URL || "";
  add("https", !x.isProd || url.startsWith("https://") ? "ok" : "warn", "Secure address (HTTPS)", x.isProd && !url.startsWith("https://") ? "NEXT_PUBLIC_APP_URL should start with https:// in production." : "The site address is secure, or this is a local run.");
  const boot = !!(x.env.BOOTSTRAP_ADMIN_EMAIL || x.env.BOOTSTRAP_ADMIN_PASSWORD);
  add("bootstrap-env", boot ? (x.isProd ? "fail" : "warn") : "ok", "Temporary administrator settings",
    boot ? "BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD are still set on the server. Once the temporary administrator has chosen a new password, delete both settings and redeploy." : "No temporary administrator settings remain on the server.");
  add("bootstrap-pw", x.bootstrapPending ? "fail" : "ok", "Temporary password replaced", x.bootstrapPending ? "The temporary administrator has not yet chosen their own password." : "No temporary administrator password is in use.");
  add("temp-pw", x.tempPasswords ? "warn" : "ok", "Administrator-set passwords", x.tempPasswords ? `${x.tempPasswords} ${x.tempPasswords === 1 ? "person has" : "people have"} not yet replaced a temporary password.` : "Everyone has chosen their own password.");
  add("super-admins", x.superAdmins >= 2 ? "ok" : "warn", "More than one Super Administrator", x.superAdmins >= 2 ? `${x.superAdmins} active Super Administrators.` : "Only one active Super Administrator. Add a second so the organisation is never locked out.");
  add("cron", x.env.CRON_SECRET ? "ok" : "warn", "Scheduled jobs protected", x.env.CRON_SECRET ? "CRON_SECRET is set." : "CRON_SECRET is not set, so reminders and the daily Sheets sync are switched off.");
  add("setup-token", x.env.SETUP_TOKEN ? "ok" : "warn", "First-run setup code", x.env.SETUP_TOKEN ? "SETUP_TOKEN is set." : "No SETUP_TOKEN. This only matters on a brand-new empty deployment, where it stops a stranger claiming the first account.");
  add("backup-db", x.backupConnections > 0 ? "ok" : "warn", "Backup database linked", x.backupConnections > 0 ? `${x.backupConnections} backup database${x.backupConnections === 1 ? "" : "s"} linked (Admin, Database).` : "No backup database is linked. Also turn on Atlas backups (see the README).");
  add("logins", x.failedLogins24h > 25 ? "warn" : "ok", "Failed sign-ins (24 hours)", `${x.failedLogins24h} failed, ${x.blockedLogins24h} blocked by the rate limit.${x.failedLogins24h > 25 ? " That is higher than usual. Review the audit log." : ""}`);
  add("errors", x.errors24h > 20 ? "warn" : "ok", "Server errors (24 hours)", `${x.errors24h} recorded.`);
  return c;
}
