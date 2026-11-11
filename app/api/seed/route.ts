import { handle, audit, keyOf } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Types } from "mongoose";

export const dynamic = "force-dynamic";

/**
 * Optional starter content so a new deployment isn't empty. Only runs on a completely empty organisation,
 * and every item is plainly labelled "Sample" so it can be renamed or deleted. No real church data is invented.
 */
export const POST = handle(async (req) => {
  const user = await requireApiUser(["super_admin"]);
  const { Zone, Area, Parish, Announcement, Department } = await getDb();
  if ((await Zone.countDocuments()) > 0) throw new ApiError(409, "Your organisation already has zones, so sample data wasn't added.");

  const zA = await Zone.create({ isSample: true, name: "Sample Zone A (with areas)", nameKey: keyOf("Sample Zone A (with areas)"), hasAreas: true });
  const zB = await Zone.create({ isSample: true, name: "Sample Zone B (standalone)", nameKey: keyOf("Sample Zone B (standalone)"), hasAreas: false });
  const a1 = await Area.create({ isSample: true, name: "Sample Area 1", nameKey: keyOf("Sample Area 1"), zone: zA._id });
  const a2 = await Area.create({ isSample: true, name: "Sample Area 2", nameKey: keyOf("Sample Area 2"), zone: zA._id });
  const mk = (name: string, zone: any, area: any) => Parish.create({ isSample: true, name, nameKey: keyOf(name), zone, area });
  await Promise.all([mk("Sample Parish 1", zA._id, a1._id), mk("Sample Parish 2", zA._id, a1._id), mk("Sample Parish 3", zA._id, a2._id), mk("Sample Parish 4", zB._id, null), mk("Sample Parish 5", zB._id, null)]);

  if ((await Announcement.countDocuments()) === 0)
    await Announcement.create({ isSample: true, title: "Sample announcement: welcome to the new platform", body: "This is a sample post. Edit or delete it from Admin → Announcements.", status: "published", publishedAt: new Date(), pinned: true, createdBy: user.id });
  if ((await Department.countDocuments()) === 0)
    await Department.create({ isSample: true, name: "Sample Department", description: "Describe what this department does. Edit or delete it from Admin → Departments.", order: 0 });

  await audit(user, "seed.sample_data", "sample", undefined, req);
  return { ok: true };
});

/**
 * Removes ONLY rows flagged isSample. Refuses if any real record (reports, remittances, users, members,
 * registrations) points at a sample zone, area or parish, so real data is never orphaned.
 */
export const DELETE = handle(async (req) => {
  const user = await requireApiUser(["super_admin"]);
  const { Zone, Area, Parish, Announcement, Department, Remittance, Report, User, Member, Registration } = await getDb();
  const ids = async (M: any) => (await M.find({ isSample: true }).select("_id").lean()).map((d: any) => d._id as Types.ObjectId);
  const [zones, areas, parishes] = await Promise.all([ids(Zone), ids(Area), ids(Parish)]);
  const refs = (extra: object = {}) => ({ ...extra, $or: [{ zone: { $in: zones } }, { area: { $in: areas } }, { parish: { $in: parishes } }] });
  const used = await Promise.all([Remittance, Report, User, Member, Registration].map((M: any) => M.countDocuments(refs())));
  if (used.some((n) => n > 0)) throw new ApiError(409, "Real records (reports, payments, users or members) are linked to the sample organisation, so it was not removed. Reassign or remove those first.");
  const out = {
    parishes: (await Parish.deleteMany({ isSample: true })).deletedCount,
    areas: (await Area.deleteMany({ isSample: true })).deletedCount,
    zones: (await Zone.deleteMany({ isSample: true })).deletedCount,
    announcements: (await Announcement.deleteMany({ isSample: true })).deletedCount,
    departments: (await Department.deleteMany({ isSample: true })).deletedCount,
  };
  await audit(user, "seed.sample_data_removed", "sample", out, req);
  return { ok: true, removed: out };
});
