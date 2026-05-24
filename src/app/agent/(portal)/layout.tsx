import { redirect } from "next/navigation";
import { getAgentUser } from "@/lib/agents/agent-auth";
import { AgentTopBar } from "@/components/agent/AgentTopBar";

export const dynamic = "force-dynamic";

// Authed portal gate. Middleware already requires a session for /agent/*;
// this layout is the second gate — only an ACTIVE agents row gets in, so a
// blocked agent, a deleted agent, or any non-agent (incl. admins) is bounced.
export default async function AgentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const agent = await getAgentUser();
  if (!agent) redirect("/agent/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <AgentTopBar name={agent.name} />
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
