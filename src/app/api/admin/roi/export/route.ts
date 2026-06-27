import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";

/**
 * GET — CSV export of the ROI waitlist (spec §12). Admin-gated.
 *   /api/admin/roi/export?estate=branscombe
 */
function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

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

  const { data: rows } = await (supabase.from("waitlist_registrations") as any)
    .select(
      "name, email, mobile, buyer_category, status, consent_contact, nudged_at, submitted_at, introducing_agent_id",
    )
    .eq("estate_id", e.id)
    .order("submitted_at", { ascending: false })
    .limit(5000);

  const list = rows ?? [];
  const agentIds = Array.from(
    new Set(list.map((r: any) => r.introducing_agent_id).filter(Boolean)),
  );
  const agentNames: Record<string, string> = {};
  if (agentIds.length) {
    const { data: agents } = await (supabase.from("agents") as any)
      .select("id, name")
      .in("id", agentIds);
    for (const a of agents ?? []) agentNames[a.id] = a.name;
  }

  const headers = [
    "Name",
    "Email",
    "Mobile",
    "Category",
    "Status",
    "Agent",
    "Contact consent",
    "Sent",
    "Submitted",
  ];
  const lines = [headers.join(",")];
  for (const r of list) {
    lines.push(
      [
        r.name,
        r.email,
        r.mobile,
        r.buyer_category,
        r.status,
        r.introducing_agent_id ? agentNames[r.introducing_agent_id] ?? "Unknown" : "Unassigned",
        r.consent_contact ? "yes" : "no",
        r.nudged_at ? new Date(r.nudged_at).toISOString().slice(0, 10) : "",
        r.submitted_at ? new Date(r.submitted_at).toISOString().slice(0, 10) : "",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${estate}-waitlist.csv"`,
    },
  });
}
