import { NextResponse } from "next/server";
import { getAgentUser } from "@/lib/agents/agent-auth";
import { createSupabaseService } from "@/lib/supabase-service";

// An agent's own clients — Seafields registrations explicitly tagged with their
// agent_id. Full detail (these are the agent's own buyers). Service-role read,
// scoped by agent_id; the agent_reads_own RLS policy is the defense-in-depth.
export async function GET() {
  const agent = await getAgentUser();
  if (!agent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const service = createSupabaseService();
  const { data, error } = await (service.from("seafields_registrations") as any)
    .select(
      "id, first_name, last_name, email, phone, lots_selected, interest_type, buyer_type, purchase_timeline, created_at",
    )
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("agent my-clients error:", error);
    return NextResponse.json({ error: "Failed to load your clients" }, { status: 500 });
  }
  return NextResponse.json({ clients: data ?? [] });
}
