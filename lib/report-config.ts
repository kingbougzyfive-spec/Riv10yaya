import { z } from "zod";

/** One definition drives both the form (client) and the validation (server). */
export type FieldDef = { key: string; label: string; kind: "int" | "text" | "long"; hint?: string; optional?: boolean };

const NIL = "Write NIL if none.";

export const PARISH_FIELDS: FieldDef[] = [
  { key: "youthSundayAttendance", label: "Youth Sunday attendance", kind: "int", hint: "Enter 0 if none." },
  { key: "youthMeetingAttendance", label: "Youth meeting attendance", kind: "int", hint: "Enter 0 if none." },
  { key: "meetingsHeld", label: "Number of youth meetings held", kind: "int", hint: "Enter 0 if no meeting took place. Leaving it blank is not accepted." },
  { key: "otherMeetings", label: "Other meetings and activities", kind: "long", hint: NIL },
  { key: "evangelism", label: "Evangelism activities", kind: "long", hint: NIL },
  { key: "outreach", label: "Outreach activities", kind: "long", hint: NIL },
  { key: "discipleship", label: "Discipleship activities", kind: "long", hint: NIL },
  { key: "programmes", label: "Youth programmes", kind: "long", hint: NIL },
  { key: "specialEvents", label: "Special events", kind: "long", hint: NIL },
  { key: "leadership", label: "Leadership activities", kind: "long", hint: NIL },
  { key: "activeMembers", label: "Number of active youth members", kind: "int", optional: true, hint: "Where available." },
  { key: "newMembers", label: "New members", kind: "int", hint: "Enter 0 if none." },
  { key: "achievements", label: "Notable achievements", kind: "long", hint: NIL },
  { key: "challenges", label: "Challenges encountered", kind: "long", hint: NIL },
  { key: "recommendations", label: "Recommendations", kind: "long", hint: NIL },
  { key: "remarks", label: "Other relevant remarks", kind: "long", optional: true },
];

export const AREA_FIELDS: FieldDef[] = [
  { key: "areaMeetings", label: "Number of area meetings held", kind: "int", hint: "Enter 0 if none." },
  { key: "areaProgrammes", label: "Area programmes", kind: "long", hint: NIL },
  { key: "attendance", label: "Total attendance at area meetings/programmes", kind: "int", hint: "Enter 0 if none." },
  { key: "evangelismOutreach", label: "Evangelism and outreach activities", kind: "long", hint: NIL },
  { key: "leadership", label: "Leadership activities", kind: "long", hint: NIL },
  { key: "challenges", label: "Challenges", kind: "long", hint: NIL },
  { key: "recommendations", label: "Recommendations", kind: "long", hint: NIL },
  { key: "other", label: "Other relevant activities", kind: "long", optional: true },
];

export const ZONE_FIELDS: FieldDef[] = [
  { key: "zonalProgrammes", label: "Zonal programmes", kind: "long", hint: NIL },
  { key: "zonalMeetings", label: "Number of zonal meetings held", kind: "int", hint: "Enter 0 if none." },
  { key: "attendance", label: "Total attendance", kind: "int", hint: "Enter 0 if none." },
  { key: "evangelism", label: "Evangelism activities", kind: "long", hint: NIL },
  { key: "outreach", label: "Outreach activities", kind: "long", hint: NIL },
  { key: "leadership", label: "Leadership activities", kind: "long", hint: NIL },
  { key: "achievements", label: "Achievements", kind: "long", hint: NIL },
  { key: "challenges", label: "Challenges", kind: "long", hint: NIL },
  { key: "recommendations", label: "Recommendations", kind: "long", hint: NIL },
  { key: "other", label: "Other relevant information", kind: "long", optional: true },
];

export const FIELDS = { parish: PARISH_FIELDS, area: AREA_FIELDS, zone: ZONE_FIELDS } as const;

/** Blank mandatory fields are rejected. A blank is NEVER treated as zero. */
export function activitySchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    if (f.kind === "int") {
      const base = z.number({ required_error: `${f.label} is required (enter 0 if none)`, invalid_type_error: `${f.label} must be a number` }).int().min(0).max(1_000_000);
      shape[f.key] = f.optional ? base.nullable().optional() : base;
    } else {
      const base = z.string().trim().max(4000);
      shape[f.key] = f.optional ? base.optional().default("") : base.min(1, `${f.label} is required (write NIL if none)`);
    }
  }
  return z.object(shape);
}

/** Nigerian numbers (0803…, +234803…, 234803…) or international E.164-style (+44…). */
export const phoneRegex = /^(?:(?:\+?234|0)[789][01]\d{8}|\+\d{8,15})$/;
export const normalizePhone = (s: string) => s.replace(/[\s()-]/g, "");

export const contactSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name"),
  phone: z.string().transform(normalizePhone).refine((v) => phoneRegex.test(v), "Enter a valid active phone number"),
  altPhone: z
    .string()
    .optional()
    .transform((v) => normalizePhone(v ?? ""))
    .refine((v) => v === "" || phoneRegex.test(v), "Alternative phone number is not valid"),
});

export const periodSchema = z.object({ month: z.number().int().min(1).max(12), year: z.number().int().min(2020).max(2100) });
