/**
 * Daily Seafields digest email. Triggered by Vercel cron at 00:00 UTC
 * (08:00 AWST / Perth). Reports:
 *   - New registrations in the last 24 hours
 *   - Lot transitions in the last 24 hours (status changes captured by
 *     comparing the allocation row updated_at window)
 *   - Lots remaining per stage (status='available' OR null)
 *   - Total active interest registrations on the waitlist
 *
 * Goes to every active recipient in seafields_notify_recipients. Cron
 * auth: Vercel cron sends Authorization: Bearer <CRON_SECRET>. Guard
 * against accidental public hits.
 */

import { NextResponse } from "next/server";
import { createSupabaseService } from "@/lib/supabase-service";
import {
  escapeHtml,
  getActiveRecipients,
  renderBrandedEmail,
} from "@/lib/seafields/notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RegistrationRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
}

interface RegistrationLotRow {
  registration_id: string;
  lot_number: number;
}

interface AllocationRow {
  lot_number: number;
  status: string | null;
  stage: string | null;
  updated_at: string;
  retail_price: number | null;
  allocated_to: string | null;
}

function authorised(req: Request): boolean {
  // Vercel cron sends this header. Allow manual triggers from an admin
  // session by also accepting service-role calls via a separate query
  // param if CRON_SECRET is unset — keeps local-dev "curl /api/cron/..."
  // workable without leaking a public schedule trigger to production.
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // No secret configured — assume local dev. Refuse only if running on
    // Vercel without the header set, which would indicate a misconfig.
    return !process.env.VERCEL;
  }
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${expected}`;
}

export async function GET(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseService();
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();

  // 1. New registrations in last 24h
  const { data: newRegs } = await (
    supabase.from("seafields_registrations") as any
  )
    .select("id, first_name, last_name, email, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });

  const regList = (newRegs ?? []) as RegistrationRow[];

  // Look up the lots each new registrant chose
  let regLots: RegistrationLotRow[] = [];
  if (regList.length > 0) {
    const ids = regList.map((r) => r.id);
    const { data: lotsRows } = await (
      supabase.from("seafields_registration_lots") as any
    )
      .select("registration_id, lot_number")
      .in("registration_id", ids);
    regLots = (lotsRows ?? []) as RegistrationLotRow[];
  }
  const lotsByReg = new Map<string, number[]>();
  for (const r of regLots) {
    const arr = lotsByReg.get(r.registration_id) || [];
    arr.push(r.lot_number);
    lotsByReg.set(r.registration_id, arr);
  }

  // 2. Lot allocations touched in last 24h (any field change)
  const { data: touchedRows } = await (
    supabase.from("seafields_lot_allocations") as any
  )
    .select("lot_number, status, stage, updated_at, retail_price, allocated_to")
    .gte("updated_at", sinceIso)
    .order("updated_at", { ascending: false });

  const touched = (touchedRows ?? []) as AllocationRow[];
  const soldToday = touched.filter((r) => r.status === "sold");

  // 3. Lots remaining per stage (available or unset status)
  const { data: allRows } = await (
    supabase.from("seafields_lot_allocations") as any
  )
    .select("lot_number, status, stage");
  const byStageAvailable = new Map<string, number>();
  const byStageTotal = new Map<string, number>();
  for (const r of (allRows ?? []) as Array<{
    status: string | null;
    stage: string | null;
  }>) {
    const stage = r.stage || "unstaged";
    byStageTotal.set(stage, (byStageTotal.get(stage) || 0) + 1);
    if (r.status === null || r.status === "available") {
      byStageAvailable.set(stage, (byStageAvailable.get(stage) || 0) + 1);
    }
  }

  // 4. Total active interest registrations
  const { count: totalInterest } = await (
    supabase.from("seafields_registration_lots") as any
  )
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  // 5. Total sold count overall
  const { count: totalSold } = await (
    supabase.from("seafields_lot_allocations") as any
  )
    .select("*", { count: "exact", head: true })
    .eq("status", "sold");

  // Render
  const rows: Array<{ label: string; value: string }> = [];

  rows.push({
    label: "New registrations (24h)",
    value: `<strong>${regList.length}</strong>`,
  });
  if (regList.length > 0) {
    const items = regList
      .map((r) => {
        const lots = lotsByReg.get(r.id) || [];
        const lotsStr = lots.length
          ? lots.map((n) => `Lot ${n}`).join(", ")
          : "no lots recorded";
        return `<li style="margin:2px 0">${escapeHtml(`${r.first_name} ${r.last_name}`.trim())} <span style="color:#94A3B8">— ${escapeHtml(lotsStr)}</span></li>`;
      })
      .join("");
    rows.push({
      label: "Registrants",
      value: `<ul style="margin:0;padding-left:18px">${items}</ul>`,
    });
  }

  rows.push({
    label: "Sold today",
    value: `<strong>${soldToday.length}</strong>${
      soldToday.length > 0
        ? ` <span style="color:#94A3B8">— ${soldToday.map((r) => `Lot ${r.lot_number}`).join(", ")}</span>`
        : ""
    }`,
  });

  rows.push({
    label: "Lots touched (24h)",
    value: `<strong>${touched.length}</strong>${
      touched.length > 0
        ? ` <span style="color:#94A3B8">— ${touched.slice(0, 12).map((r) => `Lot ${r.lot_number}`).join(", ")}${touched.length > 12 ? "…" : ""}</span>`
        : ""
    }`,
  });

  // Stage availability table
  const stagesSorted = Array.from(byStageTotal.keys()).sort();
  const stageRows = stagesSorted
    .map((s) => {
      const avail = byStageAvailable.get(s) || 0;
      const total = byStageTotal.get(s) || 0;
      const label = s === "unstaged" ? "Unstaged" : `Stage ${s}`;
      return `<tr><td style="padding:3px 14px 3px 0;color:#64748B;font-size:13px">${escapeHtml(label)}</td><td style="padding:3px 0;color:#0F172A;font-size:13px"><strong>${avail}</strong> available <span style="color:#94A3B8">of ${total}</span></td></tr>`;
    })
    .join("");
  rows.push({
    label: "Remaining by stage",
    value: `<table style="border-collapse:collapse">${stageRows}</table>`,
  });

  rows.push({
    label: "Total interest registrations",
    value: `<strong>${totalInterest ?? 0}</strong> active waitlist entries`,
  });

  rows.push({
    label: "Total sold (overall)",
    value: `<strong>${totalSold ?? 0}</strong> lots`,
  });

  const dateLabel = now.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Perth",
  });

  const html = renderBrandedEmail({
    preheader: `Seafields daily digest — ${regList.length} new registrations, ${soldToday.length} sold`,
    heading: `Seafields daily digest — ${dateLabel}`,
    intro: `Activity in the last 24 hours and the current state of the estate.`,
    rows,
    ctaLabel: "Open admin",
    ctaHref: "https://f2k-projects.vercel.app/admin/seafields-registrations",
    footer:
      "Daily digest sent every morning. Manage recipients at /admin/seafields-registrations.",
  });

  try {
    const recipients = await getActiveRecipients();
    if (recipients.length > 0) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from:
          process.env.RESEND_FROM_EMAIL ||
          "Seafields Estate <onboarding@resend.dev>",
        to: recipients,
        subject: `Seafields digest — ${regList.length} new, ${soldToday.length} sold`,
        html,
      });
    }
  } catch (err) {
    console.error("Daily digest send failed:", err);
    return NextResponse.json(
      { ok: false, error: "Send failed", counts: { regList: regList.length } },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    counts: {
      new_registrations: regList.length,
      sold_today: soldToday.length,
      touched_24h: touched.length,
      total_interest: totalInterest ?? 0,
      total_sold: totalSold ?? 0,
    },
  });
}
