import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";

/**
 * GET — ROI funnel metrics for the F2K dashboard (spec §12): waitlist → qualification,
 * by status and by agent, plus finance-ready and attributed/unassigned splits.
 */
export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_agents")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const estate = (searchParams.get("estate") || "branscombe").toLowerCase();

  const supabase = createSupabaseService();
  const { data: e } = await (supabase.from("estates") as any)
    .select("id")
    .eq("slug", estate)
    .maybeSingle();
  if (!e) return NextResponse.json({ error: "Unknown estate" }, { status: 400 });

  const { data: waitlist } = await (supabase.from("waitlist_registrations") as any)
    .select("id, status, introducing_agent_id, nudged_at")
    .eq("estate_id", e.id)
    .limit(5000);
  const { data: regs } = await (supabase.from("registrations") as any)
    .select("id, introducing_agent_id, payload")
    .eq("estate_id", e.id)
    .limit(5000);

  const wl = waitlist ?? [];
  const rg = regs ?? [];

  // Agent names for the per-agent breakdown.
  const agentIds = Array.from(
    new Set([
      ...wl.map((r: any) => r.introducing_agent_id),
      ...rg.map((r: any) => r.introducing_agent_id),
    ].filter(Boolean)),
  );
  const agentNames: Record<string, string> = {};
  if (agentIds.length) {
    const { data: agents } = await (supabase.from("agents") as any)
      .select("id, name")
      .in("id", agentIds);
    for (const a of agents ?? []) agentNames[a.id] = a.name;
  }

  const byStatus: Record<string, number> = {};
  let attributed = 0;
  let nudged = 0;
  for (const r of wl) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    if (r.introducing_agent_id) attributed++;
    if (r.nudged_at) nudged++;
  }

  const financeReady = rg.filter((r: any) => {
    const f = r.payload?.finance_status;
    return f === "Cash" || f === "Pre-approved";
  }).length;

  // Per-agent funnel: waitlist count → qualification count.
  const byAgent: Record<string, { agent: string; waitlist: number; qualifications: number }> = {};
  const bump = (id: string | null, key: "waitlist" | "qualifications") => {
    const k = id ?? "unassigned";
    const name = id ? agentNames[id] ?? "Unknown" : "Unassigned";
    if (!byAgent[k]) byAgent[k] = { agent: name, waitlist: 0, qualifications: 0 };
    byAgent[k][key]++;
  };
  for (const r of wl) bump(r.introducing_agent_id, "waitlist");
  for (const r of rg) bump(r.introducing_agent_id, "qualifications");

  return NextResponse.json({
    estate,
    waitlist_total: wl.length,
    qualification_total: rg.length,
    attributed,
    unassigned: wl.length - attributed,
    nudged,
    finance_ready: financeReady,
    by_status: byStatus,
    by_agent: Object.values(byAgent).sort((a, b) => b.waitlist - a.waitlist),
  });
}
