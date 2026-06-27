import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import {
  createSupabaseService,
  createSupabaseServiceWithAttributionOverride,
} from "@/lib/supabase-service";

/**
 * POST — F2K admin assigns a waitlist buyer to an introducing agent, or re-assigns one
 * (spec §4: "No agent self-claim … F2K (admin) assigns them").
 *
 * First assignment (currently unassigned) is a first-touch (NULL → agent) which the 0063
 * trigger allows directly. A RE-assignment (already attributed) changes an immutable field,
 * so it goes through the override client (logged as `attribution_override`) and requires a
 * reason. Unassigning (agent → null) is likewise an override.
 */
const schema = z.object({
  waitlist_id: z.string().uuid(),
  agent_id: z.string().uuid().nullable(),
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_agents")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { waitlist_id, agent_id, reason } = parsed.data;

  const service = createSupabaseService();
  const { data: waitlist } = await (service.from("waitlist_registrations") as any)
    .select("id, estate_id, introducing_agent_id, first_touch_at")
    .eq("id", waitlist_id)
    .maybeSingle();
  if (!waitlist) {
    return NextResponse.json({ error: "Waitlist registration not found" }, { status: 404 });
  }

  // No-op if unchanged.
  if ((waitlist.introducing_agent_id ?? null) === agent_id) {
    return NextResponse.json({ success: true, unchanged: true });
  }

  // Resolve the target agent (must exist + cover the estate) and its agency.
  let agencyId: string | null = null;
  if (agent_id) {
    const { data: agent } = await (service.from("agents") as any)
      .select("id, agency_id, estate_access, active")
      .eq("id", agent_id)
      .maybeSingle();
    if (!agent || !agent.active) {
      return NextResponse.json({ error: "Agent not found or inactive" }, { status: 400 });
    }
    // Estate access check.
    const { data: estate } = await (service.from("estates") as any)
      .select("slug")
      .eq("id", waitlist.estate_id)
      .maybeSingle();
    if (estate && Array.isArray(agent.estate_access) && !agent.estate_access.includes(estate.slug)) {
      return NextResponse.json(
        { error: "That agent doesn't cover this estate." },
        { status: 400 },
      );
    }
    agencyId = agent.agency_id ?? null;
  }

  const isReassignment = !!waitlist.introducing_agent_id; // already attributed → override path
  const updates: Record<string, unknown> = {
    introducing_agent_id: agent_id,
    introducing_agency_id: agencyId,
    assigned_by: admin.id,
    // Stamp first_touch_at on first assignment (it was null for a direct arrival).
    first_touch_at: waitlist.first_touch_at ?? (agent_id ? new Date().toISOString() : null),
  };

  if (isReassignment) {
    if (!reason || reason.trim() === "") {
      return NextResponse.json(
        { error: "A reason is required to re-assign an already-attributed buyer." },
        { status: 400 },
      );
    }
    // Override client — the 0063 trigger permits the change and logs it.
    const ovr = createSupabaseServiceWithAttributionOverride(admin.email, reason.trim());
    const { error } = await (ovr.from("waitlist_registrations") as any)
      .update(updates)
      .eq("id", waitlist_id);
    if (error) {
      console.error("roi reassign error:", error);
      return NextResponse.json({ error: "Re-assignment failed" }, { status: 500 });
    }
  } else {
    // First assignment — NULL → agent, allowed by the trigger.
    const { error } = await (service.from("waitlist_registrations") as any)
      .update(updates)
      .eq("id", waitlist_id);
    if (error) {
      console.error("roi assign error:", error);
      return NextResponse.json({ error: "Assignment failed" }, { status: 500 });
    }
    await service.from("audit_log").insert({
      actor_email: admin.email,
      action: "roi_waitlist_assigned",
      entity_type: "waitlist_registration",
      entity_id: waitlist_id,
      details: { agent_id, reason: reason ?? null },
    });
  }

  return NextResponse.json({ success: true });
}
