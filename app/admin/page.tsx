import { Building2, Database, Layers, MapPin, Palette, ImageIcon, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/AdminShell";
import { requirePageUser } from "@/lib/auth";
import { connectionViews, failoverNote, getDb } from "@/lib/db";
import { can, PERMS } from "@/lib/rbac";
import { ROLE_LABELS } from "@/lib/roles";
import { resolveIdentity } from "@/lib/scope";
import { SeedButton, SampleBanner } from "@/components/admin/SeedButton";
import { MONTHS } from "@/lib/money";
import { OverviewDashboard } from "@/components/admin/OverviewDashboard";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requirePageUser(PERMS.adminArea);
  if (user.role === "parish_admin") redirect("/portal"); // parish administrators work from their own portal
  const sp = await searchParams;
  const { Zone, Area, Parish, User, Media, Audit, Announcement, Department, AdminRequest } = await getDb();
  const waiting = can(user.role, "users") ? await AdminRequest.countDocuments({ status: "pending" }) : 0;
  const [zones, areas, parishes, users, media, recent, sampleZones, sampleOther] = await Promise.all([
    Zone.countDocuments(), Area.countDocuments(), Parish.countDocuments(), can(user.role, "users") ? User.countDocuments() : Promise.resolve(0), Media.countDocuments(),
    can(user.role, "audit") ? Audit.find().sort({ createdAt: -1 }).limit(6).lean<any[]>() : Promise.resolve([]),
    user.role === "super_admin" ? Zone.countDocuments({ isSample: true }) : Promise.resolve(0),
    user.role === "super_admin" ? Promise.all([Announcement.countDocuments({ isSample: true }), Department.countDocuments({ isSample: true })]).then((a) => a[0] + a[1]) : Promise.resolve(0),
  ]);
  // Monthly to-do for the people who must submit a report
  let todo: { done: boolean; label: string } | null = null;
  if (can(user.role, "reportSubmit")) {
    const id = await resolveIdentity(user);
    if (id) {
      const now = new Date();
      const { Report } = await getDb();
      const done = !!(await Report.exists({ type: id.type, zone: id.zone, area: id.area, parish: id.parish, month: now.getMonth() + 1, year: now.getFullYear() }));
      todo = { done, label: `${MONTHS[now.getMonth()]} ${now.getFullYear()}` };
    }
  }
  const conns = connectionViews();
  const running = conns.find((c) => c.isRunning);
  const note = failoverNote();

  const stats = [
    { label: "Zones", value: zones, icon: Layers },
    { label: "Areas", value: areas, icon: MapPin },
    { label: "Parishes", value: parishes, icon: Building2 },
    ...(can(user.role, "users") ? [{ label: "Users", value: users, icon: Users }] : []),
  ];
  const actions = [
    { href: "/admin/site", label: "Edit website", desc: "Logo, text, colours, photos", icon: Palette, perm: "siteEdit" as const },
    { href: "/admin/media", label: "Upload images", desc: "Logos, flyers, gallery", icon: ImageIcon, perm: "media" as const },
    { href: "/admin/organizations", label: "Zones & parishes", desc: "Build the hierarchy", icon: Building2, perm: "orgView" as const },
    { href: "/admin/database", label: "Databases", desc: "Add URIs, set failover", icon: Database, perm: "database" as const },
  ].filter((a) => can(user.role, a.perm));

  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(" ")[0]}`} subtitle={`You're signed in as ${ROLE_LABELS[user.role]}.`} />
      {sp.denied && <p className="badge-warn mb-4 rounded-xl p-3 text-sm">You don't have access to that page.</p>}
      {waiting > 0 && <Link href="/admin/requests" className="badge-warn mb-4 block rounded-xl p-3 text-sm font-medium hover:opacity-90">{waiting} administrator registration{waiting > 1 ? "s are" : " is"} waiting for your approval. Review {waiting > 1 ? "them" : "it"}</Link>}
      {user.role === "super_admin" && zones === 0 && <SeedButton />}
      {user.role === "super_admin" && sampleZones + sampleOther > 0 && <SampleBanner real={zones - sampleZones} />}
      {todo && (
        <div className={`glass mb-4 flex flex-wrap items-center justify-between gap-3 p-4 ${todo.done ? "" : "ring-1 ring-accent/50"}`}>
          <p className="flex items-center gap-2 text-sm font-semibold">{todo.done ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-accent" />}{todo.done ? `Your ${todo.label} report is submitted. Thank you!` : `Your ${todo.label} report hasn't been submitted yet.`}</p>
          {!todo.done && <Link href="/admin/reports/new" className="btn btn-primary btn-sm">Start report</Link>}
        </div>
      )}
      {can(user.role, "reports") && <OverviewDashboard />}
      {note && <p className="badge-warn mb-4 flex items-center gap-2 rounded-xl p-3 text-sm"><AlertTriangle className="h-4 w-4" />{note}</p>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.label} className="glass glass-hover animate-fade-up p-5" style={{ animationDelay: `${i * 80}ms` }}>
            <s.icon className="h-5 w-5 text-brand" /><p className="mt-3 text-3xl font-black">{s.value}</p><p className="text-xs uppercase tracking-wider text-white/65">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="glass p-5">
          <h2 className="mb-4 font-bold">Quick actions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {actions.map((a) => (
              <Link key={a.href} href={a.href} className="glass-hover flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand/20 text-brand"><a.icon className="h-5 w-5" /></div>
                <div><p className="text-sm font-semibold">{a.label}</p><p className="text-xs text-white/65">{a.desc}</p></div>
              </Link>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {can(user.role, "database") && (
            <div className="glass p-5">
              <h2 className="mb-3 flex items-center gap-2 font-bold"><Database className="h-4 w-4 text-brand" />Database</h2>
              <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Running on <b>{running?.label ?? "—"}</b></p>
              <p className="mt-1 text-xs text-white/65">{conns.length} connection{conns.length === 1 ? "" : "s"} saved · {conns.filter((c) => c.enabled).length - 1 > 0 ? "failover ready" : "add a backup for failover"}</p>
              <Link href="/admin/database" className="btn btn-ghost btn-sm mt-4">Manage</Link>
            </div>
          )}
          {recent.length > 0 && (
            <div className="glass p-5">
              <h2 className="mb-3 font-bold">Recent activity</h2>
              <ul className="space-y-2.5">
                {recent.map((r: any) => (<li key={String(r._id)} className="text-xs"><p className="font-medium text-white/85">{r.action}</p><p className="text-white/65">{r.actorName ?? "system"} · {new Date(r.createdAt).toLocaleString("en-NG")}</p></li>))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
