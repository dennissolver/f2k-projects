import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

type ProjectFilter = "all" | "seafields" | "branscombe" | "dutton" | "hemp";

// Unified, fixed column order so every row aligns regardless of source project.
const HEADERS = [
  "Project",
  "Registration ID",
  "Name",
  "Email",
  "Phone",
  "Location",
  "Items",
  "Buyer Type",
  "Purchase Timeline",
  "Finance Status",
  "Stage",
  "Status",
  "Assigned Agent",
  "Build Preference",
  "Referrer",
  "Registered At",
] as const;

type UnifiedRow = Record<(typeof HEADERS)[number], string>;

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function buildCsvRow(row: UnifiedRow): string {
  return HEADERS.map((h) => csvCell(row[h])).join(",");
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-AU");
  } catch {
    return iso;
  }
}

const BUILD_PREFERENCE_LABEL: Record<string, string> = {
  owner_builder: "Owner-builder (community help)",
  built_for_you: "Built for you (F2K supplies team)",
  not_sure: "Not sure yet",
};

export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "view_registrations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filter = (searchParams.get("type") ?? "all") as ProjectFilter;
  const search = (searchParams.get("q") ?? "").trim().toLowerCase();

  const service = createSupabaseService();
  const rows: UnifiedRow[] = [];

  // Agent name lookup (shared across estate projects).
  const { data: allAgents } = await (service.from("agents") as any)
    .select("id, name, agency");
  const agentMap = new Map<string, string>(
    (allAgents || []).map((a: any): [string, string] => [
      a.id,
      `${a.name}${a.agency ? ` (${a.agency})` : ""}`,
    ]),
  );

  if (filter === "all" || filter === "seafields") {
    const { data } = await (service.from("seafields_registrations") as any)
      .select("*")
      .order("created_at", { ascending: false });
    for (const r of (data as any[]) || []) {
      rows.push({
        Project: "Seafields",
        "Registration ID": r.id,
        Name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
        Email: r.email ?? "",
        Phone: r.phone ?? "",
        Location: "",
        Items: Array.isArray(r.lots_selected) ? r.lots_selected.join(", ") : "",
        "Buyer Type": r.buyer_type ?? "",
        "Purchase Timeline": r.purchase_timeline ?? "",
        "Finance Status": r.finance_status ?? "",
        Stage: r.stage_name ?? "",
        Status: r.lead_status ?? "",
        "Assigned Agent": agentMap.get(r.agent_id) ?? "",
        "Build Preference": "",
        Referrer: "",
        "Registered At": formatDate(r.created_at),
      });
    }
  }

  if (filter === "all" || filter === "branscombe") {
    const { data } = await (service.from("branscombe_registrations") as any)
      .select("*")
      .order("created_at", { ascending: false });
    for (const r of (data as any[]) || []) {
      rows.push({
        Project: "Branscombe",
        "Registration ID": r.id,
        Name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
        Email: r.email ?? "",
        Phone: r.phone ?? "",
        Location: "",
        Items: Array.isArray(r.units_selected)
          ? r.units_selected.join(", ")
          : "",
        "Buyer Type": r.buyer_type ?? "",
        "Purchase Timeline": r.purchase_timeline ?? "",
        "Finance Status": r.finance_status ?? "",
        Stage: r.stage_name ?? "",
        Status: r.lead_status ?? "",
        "Assigned Agent": agentMap.get(r.agent_id) ?? "",
        "Build Preference": "",
        Referrer: "",
        "Registered At": formatDate(r.created_at),
      });
    }
  }

  if (filter === "all" || filter === "dutton") {
    try {
      const { data } = await (service.from("dutton_registrations") as any)
        .select("*")
        .order("created_at", { ascending: false });
      for (const r of (data as any[]) || []) {
        rows.push({
          Project: "Dutton Terrace",
          "Registration ID": r.id,
          Name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
          Email: r.email ?? "",
          Phone: r.phone ?? "",
          Location: [r.suburb, r.postcode].filter(Boolean).join(" "),
          Items: [r.interest_type, r.lot_size_preference, r.budget_band].filter(Boolean).join(", "),
          "Buyer Type": r.buyer_type ?? "",
          "Purchase Timeline": r.purchase_timeline ?? "",
          "Finance Status": r.finance_status ?? "",
          Stage: "",
          Status: "",
          "Assigned Agent": agentMap.get(r.referrer_agent_id) ?? "",
          "Build Preference": "",
          Referrer: [r.referrer_name, r.referrer_company].filter(Boolean).join(" — "),
          "Registered At": formatDate(r.created_at),
        });
      }
    } catch {
      // table may not exist yet — skip silently
    }
  }

  if (filter === "all" || filter === "hemp") {
    try {
      const { data } = await (service.from("hemp_homes_waitlist") as any)
        .select("*")
        .order("created_at", { ascending: false });
      for (const r of (data as any[]) || []) {
        const referrer = r.referrer_name
          ? `${r.referrer_name}${r.referrer_company ? ` — ${r.referrer_company}` : ""}${r.referrer_contact ? ` (${r.referrer_contact})` : ""}${r.referrer_type ? ` [${r.referrer_type}]` : ""}`
          : "";
        rows.push({
          Project: "Hemp Homes",
          "Registration ID": r.id,
          Name: r.full_name ?? "",
          Email: r.email ?? "",
          Phone: r.phone ?? "",
          Location: [r.suburb, r.state, r.postcode].filter(Boolean).join(" "),
          Items: Array.isArray(r.regions_of_interest)
            ? r.regions_of_interest.join(", ")
            : "",
          "Buyer Type": r.i_am_a ?? "",
          "Purchase Timeline": r.timeframe ?? "",
          "Finance Status": r.finance_status ?? "",
          Stage: "",
          Status: "",
          "Assigned Agent": "",
          "Build Preference": r.build_preference
            ? (BUILD_PREFERENCE_LABEL[r.build_preference] ?? r.build_preference)
            : "",
          Referrer: referrer,
          "Registered At": formatDate(r.created_at),
        });
      }
    } catch {
      // table may not exist yet — skip silently
    }
  }

  rows.sort((a, b) =>
    (b["Registered At"] ?? "").localeCompare(a["Registered At"] ?? ""),
  );

  const filtered = search
    ? rows.filter(
        (r) =>
          r.Name.toLowerCase().includes(search) ||
          r.Email.toLowerCase().includes(search) ||
          r.Items.toLowerCase().includes(search),
      )
    : rows;

  // Always return a valid (headered) CSV — an empty result is a 0-row file, not
  // an error. This is what a "Download CSV" button should always produce.
  const csv = [HEADERS.join(","), ...filtered.map(buildCsvRow)].join("\n");

  const scope = filter === "all" ? "all" : filter;
  const filename = `${scope}-registrations-${new Date().toISOString().split("T")[0]}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
