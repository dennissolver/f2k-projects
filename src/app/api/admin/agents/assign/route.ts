import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";

// Assign (or clear) the agent that owns a Seafields registration. This is the
// explicit-agent_id ownership mechanism (D1): admin links a buyer to an agent
// so it appears in that agent's "My Clients". agent_id=null unlinks.
const schema = z.object({
  registration_id: z.string().uuid(),
  agent_id: z.string().uuid().nullable(),
});

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_agents")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { registration_id, agent_id } = parsed.data;
  const service = createSupabaseService();

  // If assigning, confirm the agent exists + has Seafields access.
  if (agent_id) {
    const { data: agent } = await (service.from("agents") as any)
      .select("id, estate_access, active")
      .eq("id", agent_id)
      .maybeSingle();
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    if (!agent.active) {
      return NextResponse.json({ error: "That agent is blocked" }, { status: 400 });
    }
    if (!Array.isArray(agent.estate_access) || !agent.estate_access.includes("seafields")) {
      return NextResponse.json(
        { error: "That agent doesn't have Seafields access" },
        { status: 400 },
      );
    }
  }

  const { data, error } = await (service.from("seafields_registrations") as any)
    .update({ agent_id })
    .eq("id", registration_id)
    .select("id, agent_id")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  await service.from("audit_log").insert({
    actor_email: admin.email,
    action: agent_id ? "registration_assigned_to_agent" : "registration_unassigned_from_agent",
    entity_type: "seafields_registration",
    entity_id: registration_id,
    details: { agent_id },
  });

  return NextResponse.json({ ok: true, registration_id, agent_id });
}
