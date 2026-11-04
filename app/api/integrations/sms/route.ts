import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { validPhone } from "@/lib/ids";
import { PERMS } from "@/lib/rbac";
import { sendSms, smsConfigured } from "@/lib/sms";

export const dynamic = "force-dynamic";

/** Sends one test message so an admin can confirm the SMS setup works. */
export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.integrations);
  if (!smsConfigured()) throw new ApiError(400, "Add TERMII_API_KEY first (see the steps on this page).");
  const { to } = z.object({ to: z.string().trim().refine(validPhone, "Enter a valid phone number") }).parse(await req.json());
  const r = await sendSms(to, "Test message from your YAYA platform. SMS is working.");
  if (!r.ok) throw new ApiError(502, r.error || "The SMS provider rejected the message.");
  await audit(user, "sms.test", to.replace(/\d(?=\d{3})/g, "•"), undefined, req);
  return { ok: true };
});
