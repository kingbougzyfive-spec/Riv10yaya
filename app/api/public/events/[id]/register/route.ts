import { z } from "zod";
import { handle } from "@/lib/api";
import { ApiError } from "@/lib/auth";
import { validPhone } from "@/lib/ids";
import { HOUR, MIN, rateLimit } from "@/lib/ratelimit";
import { findEventByKey } from "@/lib/event-key";
import { getDb } from "@/lib/db";
import { registerForEvent } from "@/lib/register-event";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().refine(validPhone, "Enter a valid phone number"),
  email: z.string().trim().email().optional().or(z.literal("")),
  zone: z.string().optional().or(z.literal("")), area: z.string().optional().or(z.literal("")), parish: z.string().optional().or(z.literal("")),
  answers: z.record(z.string().max(300)).default({}),
});

export const POST = handle<Ctx>(async (req, ctx) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  await rateLimit(`reg:${ip}`, 10, MIN, "Too many attempts. Please wait a minute.");
  const { id } = await ctx.params;
  const i = schema.parse(await req.json());
  const ev = await findEventByKey((await getDb()).Event, id);
  if (!ev) throw new ApiError(404, "Event not found.");
  const r = await registerForEvent({ eventId: String(ev._id), name: i.name, phone: i.phone, email: i.email, parish: i.parish, answers: i.answers });
  return { reference: r.reference, regId: r.regId };
});
