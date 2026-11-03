import { PrintSheet } from "@/components/admin/PrintSheet";
import { getSite } from "@/lib/cms";
import { requirePageUser } from "@/lib/auth";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const metadata = { title: "Print QR", robots: { index: false } };
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ layout?: string }> }) {
  const [, { id }, sp, { site }] = await Promise.all([requirePageUser(PERMS.attendanceView), params, searchParams, getSite()]);
  return <PrintSheet id={id} layout={sp.layout ?? "poster"} brand={site.brand.name} />;
}
