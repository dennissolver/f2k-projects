import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

interface RegistrantRow {
  name: string;
  email: string | null;
  phone: string | null;
  estate: string;
  items: string; // lot(s) or unit(s), comma-joined
  buyer_type: string | null;
  purchase_timeline: string | null;
  finance_status: string | null;
  created_at: string | null;
}

/**
 * Loads an agent's OWN allocated registrants directly from the base
 * registration tables (scoped to the estates the agent can access), mirroring
 * the working /api/admin/<estate>/registrations?agent_id= routes. Full contact
 * detail is intentional — these are the agent's own buyers (the masking rule
 * only hides OTHER agents'/house leads + unallocated availability).
 */
async function loadAgentRegistrants(
  service: ReturnType<typeof createSupabaseService>,
  agentId: string,
  estateAccess: string[],
): Promise<RegistrantRow[]> {
  const rows: RegistrantRow[] = [];

  if (estateAccess.includes("seafields")) {
    const { data } = await (service.from("seafields_registrations") as any)
      .select(
        "first_name, last_name, email, phone, buyer_type, purchase_timeline, finance_status, created_at, lots_selected",
      )
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false });
    for (const r of (data as any[]) || []) {
      rows.push({
        name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
        email: r.email,
        phone: r.phone,
        estate: "Seafields",
        items: Array.isArray(r.lots_selected) ? r.lots_selected.join(", ") : "",
        buyer_type: r.buyer_type,
        purchase_timeline: r.purchase_timeline,
        finance_status: r.finance_status,
        created_at: r.created_at,
      });
    }
  }

  if (estateAccess.includes("branscombe")) {
    const { data } = await (service.from("branscombe_registrations") as any)
      .select(
        "first_name, last_name, email, phone, buyer_type, purchase_timeline, finance_status, created_at, units_selected",
      )
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false });
    for (const r of (data as any[]) || []) {
      rows.push({
        name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
        email: r.email,
        phone: r.phone,
        estate: "Branscombe",
        items: Array.isArray(r.units_selected)
          ? r.units_selected.join(", ")
          : "",
        buyer_type: r.buyer_type,
        purchase_timeline: r.purchase_timeline,
        finance_status: r.finance_status,
        created_at: r.created_at,
      });
    }
  }

  rows.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  return rows;
}

function renderRegistrantTable(rows: RegistrantRow[]): string {
  if (rows.length === 0) {
    return `<p style="color:#666;font-size:14px;margin:8px 0;">No buyers are currently allocated to you. New registrations that name you, or that admin assigns to you, will appear here.</p>`;
  }
  const headers = [
    "Client",
    "Email",
    "Phone",
    "Estate",
    "Lot / Unit",
    "Buyer",
    "Timeline",
    "Finance",
    "Registered",
  ];
  const head = `<tr>${headers
    .map(
      (h) =>
        `<th style="text-align:left;padding:6px 10px;border-bottom:2px solid #ddd;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#666;white-space:nowrap;">${h}</th>`,
    )
    .join("")}</tr>`;
  const bodyRows = rows
    .map((r) => {
      const cells = [
        r.name,
        r.email,
        r.phone,
        r.estate,
        r.items,
        r.buyer_type,
        r.purchase_timeline,
        r.finance_status,
        formatDate(r.created_at),
      ];
      return `<tr>${cells
        .map(
          (c) =>
            `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;color:#333;">${escapeHtml(
              c == null || c === "" ? "—" : String(c),
            )}</td>`,
        )
        .join("")}</tr>`;
    })
    .join("");
  return `<div style="overflow-x:auto;"><table style="border-collapse:collapse;width:100%;margin-top:8px;">${head}${bodyRows}</table></div>`;
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { agentIds, subject, message, includeRegistrants } = body;

  if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
    return NextResponse.json({ error: "No agents selected" }, { status: 400 });
  }
  if (!subject?.trim()) {
    return NextResponse.json({ error: "Subject required" }, { status: 400 });
  }
  // When the registrant list is included it carries the content, so a free-text
  // message is optional; otherwise a message is required.
  if (!includeRegistrants && !message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const service = createSupabaseService();

  const { data: agents } = await (service.from("agents") as any)
    .select("id, name, email, estate_access")
    .in("id", agentIds)
    .eq("active", true);

  if (!agents || agents.length === 0) {
    return NextResponse.json({ error: "No active agents found" }, { status: 404 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const results: {
    email: string;
    status: string;
    registrantCount?: number;
    error?: string;
  }[] = [];

  for (const agent of agents) {
    try {
      let registrantSection = "";
      let registrantCount = 0;
      if (includeRegistrants) {
        const rows = await loadAgentRegistrants(
          service,
          agent.id,
          agent.estate_access || [],
        );
        registrantCount = rows.length;
        registrantSection = `
          <h3 style="color:#1a1a1a;font-size:15px;margin:24px 0 4px;">Your allocated buyers (${registrantCount})</h3>
          ${renderRegistrantTable(rows)}
        `;
      }

      const messageBlock = message?.trim()
        ? `<div style="color: #444; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(
            message,
          )}</div>`
        : "";

      const html = `
        <div style="font-family: system-ui, sans-serif; max-width: 760px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">${escapeHtml(subject)}</h2>
          ${messageBlock}
          ${registrantSection}
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
          <p style="color: #888; font-size: 12px;">
            This is an official message from Factory2Key Projects administration.
          </p>
        </div>
      `;

      const sendResult = await resend.emails.send({
        from:
          process.env.RESEND_FROM_EMAIL ||
          "Seafields Estate <noreply@updates.corporateaisolutions.com>",
        to: agent.email,
        // BCC the sending admin so the operator gets a copy of exactly what
        // each agent received (personalised registrant list per agent).
        bcc: admin.email ? [admin.email] : undefined,
        subject,
        html,
      });

      const providerMessageId = sendResult.data?.id || null;
      const error = sendResult.error?.message || null;

      await service.from("messages").insert({
        direction: "outbound",
        channel: "email",
        sender_id: null,
        sender_email: admin.email,
        recipient_id: agent.id,
        recipient_email: agent.email,
        subject,
        body: includeRegistrants
          ? `${message || ""}\n\n[Included registrant list: ${registrantCount} buyer(s)]`.trim()
          : message,
        status: error ? "failed" : "sent",
        error: error || null,
        provider_message_id: providerMessageId,
      });

      results.push({
        email: agent.email,
        status: error ? "failed" : "sent",
        registrantCount: includeRegistrants ? registrantCount : undefined,
        error: error || undefined,
      });
    } catch (err) {
      results.push({
        email: agent.email,
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return NextResponse.json({
    summary: { total: agents.length, sent, failed },
    results,
  });
}
