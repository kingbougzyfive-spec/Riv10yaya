import { z } from "zod";
import mongoose from "mongoose";

const dt = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date and time");
const opt = (n = 300) => z.string().trim().max(n).optional().default("");

export const eventSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: opt(5000),
  venue: opt(200),
  mapUrl: opt(300),
  startsAt: dt,
  endsAt: dt.optional().or(z.literal("")),
  registrationDeadline: dt.optional().or(z.literal("")),
  capacity: z.number().int().min(0).max(100000).default(0),
  eligibility: opt(300),
  organizers: opt(300),
  contactName: opt(80), contactPhone: opt(30), contactEmail: opt(120),
  flyerId: z.string().refine((v) => v === "" || mongoose.isValidObjectId(v)).optional().default(""),
  status: z.enum(["draft", "published", "cancelled"]).default("draft"),
  registrationOpen: z.boolean().default(true),
  customFields: z.array(z.object({
    key: z.string().regex(/^[a-z][a-z0-9_]{0,30}$/, "Field id: lowercase letters/numbers"),
    label: z.string().trim().min(1).max(80), type: z.enum(["text", "select", "yesno"]).default("text"),
    required: z.boolean().default(false), options: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  })).max(12).default([]),
  recurrence: z.object({ freq: z.enum(["none", "weekly", "monthly"]).default("none"), count: z.number().int().min(2).max(52).default(4) }).optional(),
});

export const clean = (i: z.infer<typeof eventSchema>) => ({
  ...i,
  endsAt: i.endsAt ? new Date(i.endsAt) : undefined,
  registrationDeadline: i.registrationDeadline ? new Date(i.registrationDeadline) : undefined,
  startsAt: new Date(i.startsAt),
  flyerId: i.flyerId || undefined,
});


