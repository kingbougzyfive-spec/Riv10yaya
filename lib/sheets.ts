import { SignJWT, importPKCS8 } from "jose";

/**
 * Google Sheets as a reporting copy. MongoDB stays the source of truth: each sync REPLACES a tab's contents,
 * so running it twice never creates duplicates. Needs a service account (see Admin → Integrations).
 */
type Creds = { client_email: string; private_key: string; token_uri?: string };

function creds(): Creds | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const j = JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
    return j.client_email && j.private_key ? { ...j, private_key: String(j.private_key).replace(/\\n/g, "\n") } : null;
  } catch { return null; }
}

export const sheetsConfigured = () => !!creds() && !!process.env.GOOGLE_SHEET_ID;
export const sheetsServiceEmail = () => creds()?.client_email ?? null;

let tokenCache: { token: string; exp: number } | null = null;
async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const c = creds();
  if (!c) throw new Error("Google Sheets isn't configured.");
  const aud = c.token_uri || "https://oauth2.googleapis.com/token";
  const key = await importPKCS8(c.private_key, "RS256");
  const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/spreadsheets" }).setProtectedHeader({ alg: "RS256", typ: "JWT" }).setIssuer(c.client_email).setSubject(c.client_email).setAudience(aud).setIssuedAt().setExpirationTime("55m").sign(key);
  const res = await fetch(aud, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error(`Google sign-in failed: ${j.error_description || j.error || res.status}`);
  tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return tokenCache.token;
}

async function g(path: string, init?: RequestInit) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}${path}`, { ...init, headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...init?.headers } });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = j?.error?.message || `HTTP ${res.status}`;
    throw new Error(res.status === 403 || res.status === 404 ? `${m}. Share the spreadsheet with ${sheetsServiceEmail()} as an Editor.` : m);
  }
  return j;
}

export async function writeTab(tab: string, head: string[], rows: (string | number | null | undefined)[][]) {
  const meta = await g("?fields=sheets.properties.title");
  if (!meta.sheets?.some((s: any) => s.properties.title === tab)) await g(":batchUpdate", { method: "POST", body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }) });
  const range = encodeURIComponent(`'${tab}'`);
  await g(`/values/${range}:clear`, { method: "POST", body: "{}" });
  const values = [head, ...rows.map((r) => r.map((v) => (v === null || v === undefined ? "" : v)))];
  await g(`/values/${range}!A1?valueInputOption=USER_ENTERED`, { method: "PUT", body: JSON.stringify({ values }) });
  return rows.length;
}
