import { SignJWT, importPKCS8 } from "jose";

/**
 * Google Sheets API client (service account). One-way: this module only ever WRITES a reporting copy.
 * Nothing here reads cell values back, so edits made in the spreadsheet can never reach the database.
 */
type Creds = { client_email: string; private_key: string; token_uri?: string };
export type Cell = string | number | boolean | null | undefined;
export type TabInfo = { title: string; sheetId: number; rows: number; cols: number };

function creds(): Creds | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const j = JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
    return j.client_email && j.private_key ? { ...j, private_key: String(j.private_key).replace(/\\n/g, "\n") } : null;
  } catch { return null; }
}

export const sheetsCredsConfigured = () => !!creds();
export const envSheetId = () => (process.env.GOOGLE_SHEET_ID || "").trim();
export const sheetsServiceEmail = () => creds()?.client_email ?? null;
/** Accepts a bare id or a full spreadsheet URL. */
export function parseSheetId(v: string): string {
  const m = v.trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
  const id = m ? m[1] : v.trim();
  return /^[a-zA-Z0-9_-]{20,}$/.test(id) ? id : "";
}
export const sheetsConfigured = (id?: string) => !!creds() && !!(id || envSheetId());

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export class SheetsError extends Error { constructor(m: string, public status = 0, public retryable = false) { super(m); } }

/** One Sheets API call. Rate limits and Google outages are retried with a short backoff; anything else fails straight away. */
async function g(sid: string, path: string, init?: RequestInit, tries = 3) {
  let last: SheetsError | null = null;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sid}${path}`, { ...init, headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...init?.headers } });
      const j: any = await res.json().catch(() => ({}));
      if (res.ok) return j;
      const m = j?.error?.message || `HTTP ${res.status}`;
      const retryable = res.status === 429 || res.status >= 500;
      if (res.status === 401) tokenCache = null;
      last = new SheetsError(res.status === 403 || res.status === 404 ? `${m}. Share the spreadsheet with ${sheetsServiceEmail()} as an Editor.` : m, res.status, retryable || res.status === 401);
      if (!last.retryable) throw last;
    } catch (e: any) {
      if (e instanceof SheetsError && !e.retryable) throw e;
      last = e instanceof SheetsError ? e : new SheetsError(e?.message || "Network error", 0, true);
    }
    if (i < tries - 1) await sleep(800 * 2 ** i + Math.random() * 300);
  }
  throw last ?? new SheetsError("Google Sheets didn't respond.");
}

/** Proves the service account can open the spreadsheet. Nothing is sent before this succeeds. */
export async function spreadsheetInfo(sid: string): Promise<{ title: string; tabs: TabInfo[] }> {
  const j = await g(sid, "?fields=properties.title,sheets.properties(sheetId,title,gridProperties(rowCount,columnCount))");
  return { title: j.properties?.title ?? "", tabs: (j.sheets ?? []).map((s: any) => ({ title: s.properties.title, sheetId: s.properties.sheetId, rows: s.properties.gridProperties?.rowCount ?? 1000, cols: s.properties.gridProperties?.columnCount ?? 26 })) };
}

export async function addTabs(sid: string, titles: string[]) {
  if (!titles.length) return;
  await g(sid, ":batchUpdate", { method: "POST", body: JSON.stringify({ requests: titles.map((title) => ({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } })) }) });
}

const CHUNK = 4000;
const clean = (v: Cell): string | number | boolean => (v === null || v === undefined ? "" : typeof v === "string" ? (v.length > 45000 ? v.slice(0, 45000) + "…" : v) : v);

/**
 * Replace the whole contents of one tab. Whole-tab replacement is what makes a sync idempotent: the tab always
 * equals the database snapshot, so a repeat or a retry can never add a second copy of a row. Values go in as RAW,
 * so text starting with = or + is never evaluated as a formula.
 */
export async function replaceTab(sid: string, info: TabInfo, head: string[], rows: Cell[][]) {
  const needRows = Math.max(rows.length + 2, 50), needCols = Math.max(head.length, 8);
  if (info.rows < needRows || info.cols < needCols) {
    await g(sid, ":batchUpdate", { method: "POST", body: JSON.stringify({ requests: [{ updateSheetProperties: { properties: { sheetId: info.sheetId, gridProperties: { rowCount: Math.max(info.rows, needRows), columnCount: Math.max(info.cols, needCols), frozenRowCount: 1 } }, fields: "gridProperties.rowCount,gridProperties.columnCount,gridProperties.frozenRowCount" } }] }) });
  }
  const q = encodeURIComponent(`'${info.title.replace(/'/g, "''")}'`);
  await g(sid, `/values/${q}:clear`, { method: "POST", body: "{}" });
  const all = [head, ...rows];
  for (let i = 0; i < all.length; i += CHUNK) {
    const values = all.slice(i, i + CHUNK).map((r) => r.map(clean));
    await g(sid, `/values/${q}!A${i + 1}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values }) });
  }
  return rows.length;
}
