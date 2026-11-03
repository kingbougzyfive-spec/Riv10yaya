import { handle, audit, keyOf } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Optional starter content so a new deployment isn't empty. Only runs on a completely empty organisation,
 * and every item is plainly labelled "Sample" so it can be renamed or deleted. No real church data is invented.
 */
export const POST = handle(async (req) => {
  const user = await requireApiUser(["super_admin"]);
  const { Zone, Area, Parish, Announcement, Department } = await getDb();
  if ((await Zone.countDocuments()) > 0) throw new ApiError(409, "Your organisation already has zones, so sample data wasn't added.");

  const zA = await Zone.create({ name: "Sample Zone A (with areas)", nameKey: keyOf("Sample Zone A (with areas)"), hasAreas: true });
  const zB = await Zone.create({ name: "Sample Zone B (standalone)", nameKey: keyOf("Sample Zone B (standalone)"), hasAreas: false });
  const a1 = await Area.create({ name: "Sample Area 1", nameKey: keyOf("Sample Area 1"), zone: zA._id });
  const a2 = await Area.create({ name: "Sample Area 2", nameKey: keyOf("Sample Area 2"), zone: zA._id });
  const mk = (name: string, zone: any, area: any) => Parish.create({ name, nameKey: keyOf(name), zone, area });
  await Promise.all([mk("Sample Parish 1", zA._id, a1._id), mk("Sample Parish 2", zA._id, a1._id), mk("Sample Parish 3", zA._id, a2._id), mk("Sample Parish 4", zB._id, null), mk("Sample Parish 5", zB._id, null)]);

  if ((await Announcement.countDocuments()) === 0)
    await Announcement.create({ title: "Sample announcement: welcome to the new platform", body: "This is a sample post. Edit or delete it from Admin → Announcements.", status: "published", publishedAt: new Date(), pinned: true, createdBy: user.id });
  if ((await Department.countDocuments()) === 0)
    await Department.create({ name: "Sample Department", description: "Describe what this department does. Edit or delete it from Admin → Departments.", order: 0 });

  await audit(user, "seed.sample_data", "sample", undefined, req);
  return { ok: true };
});
