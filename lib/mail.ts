/** Email through Resend when RESEND_API_KEY is set. If it isn't, nothing is sent (and nothing pretends to be). */
export const mailConfigured = () => !!process.env.RESEND_API_KEY;

export async function sendMail(m: { to: string; subject: string; html: string }): Promise<boolean> {
  if (!mailConfigured()) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM || "YAYA <onboarding@resend.dev>", to: m.to, subject: m.subject, html: m.html }),
  });
  return res.ok;
}
