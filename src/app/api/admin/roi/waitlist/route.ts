import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";

// GET — F2K admin list of ROI waitlist registrations (artefact 1) with attribution + status,
// the surface for the "Send qualification form" action and the unassigned pool.
export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_agents")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const estate = searchParams.get("estate");

  const supabase = createSupabaseService();

  // Estate slug→id (optional filter).
  let estateId: string | null = null;
  if (estate) {
    const { data: e } = await (supabase.from("estates") as any)
      .select("id")
      .eq("slug", estate.toLowerCase())
      .maybeSingle();
    estateId = e?.id ?? null;
  }

  let query = (supabase.from("waitlist_registrations") as any)
    .select(
      "id, name, email, mobile, buyer_category, status, consent_contact, nudged_at, submitted_at, introducing_agent_id",
    )
    .order("submitted_at", { ascending: false })
    .limit(500);
  if (estateId) query = query.eq("estate_id", estateId);

  const { data: rows, error } = await query;
  if (error) {
    console.error("admin roi waitlist list error:", error);
    return NextResponse.json({ error: "Failed to load waitlist" }, { status: 500 });
  }

  // Resolve agent names in one pass.
  const agentIds = Array.from(
    new Set((rows ?? []).map((r: any) => r.introducing_agent_id).filter(Boolean)),
  );
  const agentNames: Record<string, string> = {};
  if (agentIds.length) {
    const { data: agents } = await (supabase.from("agents") as any)
      .select("id, name")
      .in("id", agentIds);
    for (const a of agents ?? []) agentNames[a.id] = a.name;
  }

  const waitlist = (rows ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    mobile: r.mobile,
    buyer_category: r.buyer_category,
    status: r.status,
    consent_contact: r.consent_contact,
    nudged_at: r.nudged_at,
    submitted_at: r.submitted_at,
    introducing_agent_id: r.introducing_agent_id ?? null,
    agent_name: r.introducing_agent_id ? agentNames[r.introducing_agent_id] ?? "Unknown" : null,
  }));

  return NextResponse.json({ waitlist });
}
