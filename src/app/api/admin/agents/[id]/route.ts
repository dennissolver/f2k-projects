import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";

const AGENT_SELECT =
  "id, name, email, phone, agency, estate_access, active, status, invite_expires_at, created_at";

const patchSchema = z.object({
  active: z.boolean().optional(),
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  agency: z.string().nullable().optional(),
});

// PATCH — block / unblock an agent, or edit details. active=false denies them at getAgentUser()
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
    return NextResponse.json({ error: parsed.error.errors[0]?.message || "Invalid data" }, { status: 400 });
  }
  
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.active !== undefined) updates.active = parsed.data.active;
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
  if (parsed.data.agency !== undefined) updates.agency = parsed.data.agency;
  
  const service = createSupabaseService();
  const { data: agent, error } = await (service.from("agents") as any)
    .update(updates)
    .eq("id", params.id)
    .select(AGENT_SELECT)
    .single();
  if (error || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  
  // Audit log
  if (parsed.data.active !== undefined) {
    await service.from("audit_log").insert({
      actor_email: admin.email,
      action: parsed.data.active ? "agent_unblocked" : "agent_blocked",
      entity_type: "agent",
      entity_id: params.id,
      details: { email: agent.email },
    });
  }
  if (parsed.data.name !== undefined || parsed.data.phone !== undefined || parsed.data.agency !== undefined) {
    await service.from("audit_log").insert({
      actor_email: admin.email,
      action: "agent_updated",
      entity_type: "agent",
      entity_id: params.id,
      details: { 
        email: agent.email,
        name: parsed.data.name,
        phone: parsed.data.phone,
        agency: parsed.data.agency,
      },
    });
  }
  
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
