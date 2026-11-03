import { PageHeader } from "@/components/admin/AdminShell";
import { requirePageUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePageUser(PERMS.audit);
  const { Audit } = await getDb();
  const rows = await Audit.find().sort({ createdAt: -1 }).limit(150).lean<any[]>();
  return (
    <>
      <PageHeader title="Audit Log" subtitle="Who changed what, and when. Entries can't be edited from the app." />
      <div className="glass overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-white/45"><tr><th className="p-4">When</th><th className="p-4">Who</th><th className="p-4">Action</th><th className="p-4">Target</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r._id)} className="border-t border-white/10 hover:bg-white/5">
                <td className="whitespace-nowrap p-4 text-white/55">{new Date(r.createdAt).toLocaleString("en-NG")}</td>
                <td className="p-4">{r.actorName ?? "system"}</td>
                <td className="p-4 font-mono text-xs text-brand">{r.action}</td>
                <td className="max-w-[220px] truncate p-4 text-white/55">{r.target}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-white/40">Nothing recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
