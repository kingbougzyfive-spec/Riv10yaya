import { PageHeader } from "@/components/admin/AdminShell";
import { AiAssistant } from "@/components/admin/AiAssistant";
import { requirePageUser } from "@/lib/auth";
import { aiConfigured } from "@/lib/ai-receipt";
import { PERMS, can } from "@/lib/rbac";

export default async function Page() {
  const user = await requirePageUser(PERMS.aiAny);
  return (<><PageHeader title="AI Assistant" subtitle="Ask about your records and get help writing messages. It only reads what your role may see, and it can't approve, change or send anything." /><AiAssistant configured={aiConfigured()} canAsk={can(user.role, "assistant")} canWrite={can(user.role, "aiWrite")} canReport={can(user.role, "assistant")} /></>);
}
