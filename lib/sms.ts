/** SMS through Termii (a Nigerian provider) when TERMII_API_KEY is set. If it isn't, nothing is sent and nothing pretends to be. */
export const smsConfigured = () => !!process.env.TERMII_API_KEY;

/** Termii wants digits only, with the country code: 0803… becomes 234803…, +44… becomes 44… */
export function smsNumber(raw: string): string {
  const d = raw.replace(/[^\d+]/g, "");
  if (/^0[789][01]\d{8}$/.test(d)) return "234" + d.slice(1);
  return d.replace(/^\+/, "");
}

export async function sendSms(to: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!smsConfigured()) return { ok: false, error: "SMS is not configured." };
  try {
    const res = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: smsNumber(to), from: process.env.TERMII_SENDER_ID || "YAYA", sms: text.slice(0, 600), type: "plain", channel: process.env.TERMII_CHANNEL || "generic", api_key: process.env.TERMII_API_KEY }),
      signal: AbortSignal.timeout(10_000),
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok || (j.code && j.code !== "ok")) return { ok: false, error: j.message || `Provider returned ${res.status}.` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.name === "TimeoutError" ? "The SMS provider took too long to answer." : "Could not reach the SMS provider." };
  }
}
