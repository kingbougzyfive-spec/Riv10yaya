import { getSite } from "@/lib/cms";
import { Attend } from "@/components/site/Events";
import { Logo } from "@/components/site/blocks";
export const dynamic = "force-dynamic";
export const metadata = { title: "Mark attendance", robots: { index: false } };
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const [{ site }, { token }] = await Promise.all([getSite(), params]);
  return (<main className="grid min-h-dvh place-items-center px-4 py-10"><div className="w-full"><div className="mb-6 flex justify-center"><Logo site={site} size={52} /></div><Attend token={token} /></div></main>);
}
