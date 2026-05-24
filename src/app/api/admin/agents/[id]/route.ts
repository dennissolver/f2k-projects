import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";

const AGENT_SELECT =
  "id, name, email, phone, agency, estate_access, active, status, invite_expires_at, created_at";

const patchSchema = z.object({ active: z.boolean() });

// PATCH — block / unblock an agent. active=false denies them at getAgentUser()
// on their next request (the portal layout + APIs bounce inactive agents).
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_agents")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "active (boolean) required" }, { status: 400 });
  }
  const service = createSupabaseService();
  const { data: agent, error } = await (service.from("agents") as any)
    .update({ active: parsed.data.active, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select(AGENT_SELECT)
    .single();
  if (error || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  await service.from("audit_log").insert({
    actor_email: admin.email,
    action: parsed.data.active ? "agent_unblocked" : "agent_blocked",
    entity_type: "agent",
    entity_id: params.id,
    details: { email: agent.email },
  });
  return NextResponse.json({ agent });
}

// DELETE — remove the agent and revoke their login. The agent_id FK on the
// registration tables is ON DELETE SET NULL, so registrations are kept and
// simply unlinked. The linked Supabase auth user is deleted so they can no
// longer log in.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_agents")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const service = createSupabaseService();

  const { data: agent } = await (service.from("agents") as any)
    .select("id, email, auth_user_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (agent.auth_user_id) {
    try {
      await service.auth.admin.deleteUser(agent.auth_user_id);
    } catch (err) {
      console.error("revoke agent auth user failed:", err);
      // Non-fatal: still delete the agents row so they lose portal access.
    }
  }

  const { error } = await (service.from("agents") as any).delete().eq("id", params.id);
  if (error) {
    console.error("delete agent error:", error);
    return NextResponse.json({ error: "Failed to delete agent" }, { status: 500 });
  }

  await service.from("audit_log").insert({
    actor_email: admin.email,
    action: "agent_deleted",
    entity_type: "agent",
    entity_id: params.id,
    details: { email: agent.email },
  });

  return NextResponse.json({ ok: true });
}
