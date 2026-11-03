import { getSite } from "@/lib/cms";
import { SimplePage } from "@/components/site/views";
import { SectionTitle } from "@/components/site/blocks";
import { DepartmentsList } from "@/components/site/Lists";
export const dynamic = "force-dynamic";
export const metadata = { title: "Departments" };
export default async function Page() {
  const { site } = await getSite();
  return (<SimplePage site={site} current="/departments"><section className="mx-auto max-w-6xl px-5 py-14 sm:px-6"><SectionTitle eyebrow="Serving together" title="Our departments" /><DepartmentsList /></section></SimplePage>);
}
