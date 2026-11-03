import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";
import { activitySchema, contactSchema, FIELDS, periodSchema } from "@/lib/report-config";
import { areaRollup, zoneRollup } from "@/lib/rollup";
import { CONTACT_ROLES, recordScope, resolveIdentity } from "@/lib/scope";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const user = await requireApiUser(PERMS.reports);
  const scope = await recordScope(user);
  if (scope === null) throw new ApiError(403, "No access.");
  const q = new URL(req.url).searchParams;
  const f: any = { ...scope };
  for (const k of ["month", "year"]) if (q.get(k)) f[k] = Number(q.get(k));
  if (q.get("type")) f.type = q.get("type");
  const { Report, Remittance } = await getDb();
  const rows = await Report.find(f).sort({ year: -1, month: -1, submittedAt: -1 }).limit(500).lean<any[]>();
  const rem = new Map<string, any>((await Remittance.find({ _id: { $in: rows.map((r) => r.remittance).filter(Boolean) } }).lean<any[]>()).map((r) => [String(r._id), r]));
  return {
    rows: rows.map((r) => {
      // Contact details only for authorised administrators (or the author's own parish). Never public, never members.
      const seeContact = (CONTACT_ROLES as readonly string[]).includes(user.role) || (user.parish && String(r.parish) === user.parish);
      const m = r.remittance ? rem.get(String(r.remittance)) : null;
      return {
        id: String(r._id), type: r.type, month: r.month, year: r.year, names: r.names, submittedAt: r.submittedAt,
        contact: seeContact ? r.contact : null, activity: r.activity, rollup: r.rollup,
        remittance: m ? { status: m.status, requiredKobo: m.requiredKobo, offeringKobo: m.offeringKobo, amountKobo: m.amountKobo } : null,
      };
    }),
  };
});

const submitSchema = periodSchema.extend({ contact: contactSchema, activity: z.record(z.unknown()) });

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.reportSubmit);
  const body = submitSchema.parse(await req.json());
  const id = await resolveIdentity(user);
  if (!id) throw new ApiError(400, "Your account isn't linked to a zone, area or parish yet.");
  const activity = activitySchema([...FIELDS[id.type]]).parse(body.activity); // blank mandatory fields are rejected, never read as 0

  const { Report, Remittance } = await getDb();
  const key = { type: id.type, zone: id.zone, area: id.area, parish: id.parish, month: body.month, year: body.year };
  if (await Report.exists(key)) throw new ApiError(409, "This report has already been submitted for that month.");

  let remittance: string | undefined;
  let rollup: unknown;
  if (id.type === "parish") {
    const y = await Remittance.findOne({ parish: id.parish, month: body.month, year: body.year, kind: "yst" }, { _id: 1 }).lean<any>();
    if (!y) throw new ApiError(400, "Please complete the financial section (remittance and evidence) first, then submit the activity report.");
    remittance = String(y._id);
  } else if (id.type === "area") rollup = await areaRollup(id.area!, body.month, body.year);
  else rollup = await zoneRollup(id.zone, body.month, body.year);

  const doc = await Report.create({
    ...key, names: id.names, contact: body.contact, activity, rollup, remittance, submittedBy: user.id,
  });
  await audit(user, `report.submit.${id.type}`, `${id.names.parish ?? id.names.area ?? id.names.zone} ${body.month}/${body.year}`, undefined, req);
  return { id: String(doc._id) };
});
