/** Email through Resend when RESEND_API_KEY is set. If it isn't, nothing is sent (and nothing pretends to be). */
export const mailConfigured = () => !!process.env.RESEND_API_KEY;

export type MailResult = { ok: boolean; skipped?: boolean; error?: string };
export async function sendMailResult(m: { to: string; subject: string; html: string }): Promise<MailResult> {
  if (!mailConfigured()) return { ok: false, skipped: true, error: "Email is not set up" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM || "YAYA <onboarding@resend.dev>", to: m.to, subject: m.subject, html: m.html }),
    });
    if (res.ok) return { ok: true };
    const t = await res.text().catch(() => "");
    return { ok: false, error: `Mail provider said ${res.status}${t ? `: ${t.slice(0, 120)}` : ""}` };
  } catch (e: any) { return { ok: false, error: String(e?.message || "Network error").slice(0, 120) }; }
}
export async function sendMail(m: { to: string; subject: string; html: string }): Promise<boolean> { return (await sendMailResult(m)).ok; }
