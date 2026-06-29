/**
 * Daily Branscombe digest email. Triggered by Vercel cron at 00:00 UTC
 * (08:00 AWST / Perth, 10:00 AEST / Hobart-Sydney). Mirrors the
 * Seafields digest pattern.
 *
 * Reports:
 *   - New registrations in the last 24 hours (with chosen units)
 *   - Unit allocations touched in the last 24 hours
 *   - Allocated count per home type
 *   - Total active interest registrations on the waitlist
 *
 * Goes to every active recipient in branscombe_notify_recipients.
 * Cron auth: Vercel sends Authorization: Bearer <CRON_SECRET> (same
 * secret across every cron route on the project).
 */

import { NextResponse } from "next/server";
import { createSupabaseService } from "@/lib/supabase-service";
import {
  escapeHtml,
  getActiveRecipients,
  renderBrandedEmail,
} from "@/lib/branscombe/notify";
import { guardRecipients } from "@/lib/email/recipient-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RegistrationRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  units_selected: string[] | null;
  created_at: string;
}

interface AllocationRow {
  unit_number: number;
  home_type: string;
  area_m2: number;
  allocated_to: string | null;
  updated_at: string;
}

function authorised(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
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

  // 1. New registrations in last 24h (with their chosen units)
  const { data: newRegs } = await (
    supabase.from("branscombe_registrations") as any
  )
    .select("id, first_name, last_name, email, units_selected, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });

  const regList = (newRegs ?? []) as RegistrationRow[];

  // 2. Unit allocations touched in last 24h
  const { data: touchedRows } = await (
    supabase.from("branscombe_unit_allocations") as any
  )
    .select("unit_number, home_type, area_m2, allocated_to, updated_at")
    .gte("updated_at", sinceIso)
    .order("updated_at", { ascending: false });

  const touched = (touchedRows ?? []) as AllocationRow[];
  const allocatedTouched = touched.filter((r) => r.allocated_to);

  // 3. Allocation breakdown per home type (overall, not 24h)
  const { data: allRows } = await (
    supabase.from("branscombe_unit_allocations") as any
  )
    .select("unit_number, home_type, allocated_to");
  const byTypeTotal = new Map<string, number>();
  const byTypeAllocated = new Map<string, number>();
  for (const r of (allRows ?? []) as Array<{
    home_type: string | null;
    allocated_to: string | null;
  }>) {
    const type = r.home_type || "—";
    byTypeTotal.set(type, (byTypeTotal.get(type) || 0) + 1);
    if (r.allocated_to) {
      byTypeAllocated.set(type, (byTypeAllocated.get(type) || 0) + 1);
    }
  }

  // 4. Total interest registrations (sum of units_selected arrays)
  const { data: allRegs } = await (
    supabase.from("branscombe_registrations") as any
  )
    .select("units_selected");
  let totalInterest = 0;
  for (const r of (allRegs ?? []) as Array<{
    units_selected: string[] | null;
  }>) {
    totalInterest += (r.units_selected ?? []).length;
  }

  const totalAllocated = (allRows ?? []).filter(
    (r: { allocated_to: string | null }) => r.allocated_to,
  ).length;

  // Render
  const rows: Array<{ label: string; value: string }> = [];

  rows.push({
    label: "New registrations (24h)",
    value: `<strong>${regList.length}</strong>`,
  });
  if (regList.length > 0) {
    const items = regList
      .map((r) => {
        const units = r.units_selected ?? [];
        const unitsStr = units.length ? units.join(", ") : "no homes recorded";
        return `<li style="margin:2px 0">${escapeHtml(`${r.first_name} ${r.last_name}`.trim())} <span style="color:#94A3B8">— ${escapeHtml(unitsStr)}</span></li>`;
      })
      .join("");
    rows.push({
      label: "Registrants",
      value: `<ul style="margin:0;padding-left:18px">${items}</ul>`,
    });
  }

  rows.push({
    label: "Homes touched (24h)",
    value: `<strong>${touched.length}</strong>${
      touched.length > 0
        ? ` <span style="color:#94A3B8">— ${touched.slice(0, 12).map((r) => `U${r.unit_number}`).join(", ")}${touched.length > 12 ? "…" : ""}</span>`
        : ""
    }`,
  });

  rows.push({
    label: "Allocated in last 24h",
    value: `<strong>${allocatedTouched.length}</strong>`,
  });

  const typesSorted = Array.from(byTypeTotal.keys()).sort();
  const typeRows = typesSorted
    .map((t) => {
      const alloc = byTypeAllocated.get(t) || 0;
      const total = byTypeTotal.get(t) || 0;
      return `<tr><td style="padding:3px 14px 3px 0;color:#64748B;font-size:13px">Type ${escapeHtml(t)}</td><td style="padding:3px 0;color:#0F172A;font-size:13px"><strong>${alloc}</strong> of ${total} allocated</td></tr>`;
    })
    .join("");
  rows.push({
    label: "By home type",
    value: `<table style="border-collapse:collapse">${typeRows}</table>`,
  });

  rows.push({
    label: "Total interest registrations",
    value: `<strong>${totalInterest}</strong> active waitlist entries`,
  });

  rows.push({
    label: "Total allocated (overall)",
    value: `<strong>${totalAllocated}</strong> of ${(allRows ?? []).length} homes`,
  });

  const dateLabel = now.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Hobart",
  });

  const html = renderBrandedEmail({
    preheader: `Branscombe daily digest — ${regList.length} new registrations, ${allocatedTouched.length} allocated`,
    heading: `Branscombe daily digest — ${dateLabel}`,
    intro: `Activity in the last 24 hours and the current state of the estate.`,
    rows,
    ctaLabel: "Open admin",
    ctaHref: "https://f2k-projects.vercel.app/admin/branscombe-pipeline",
    footer:
      "Daily digest sent every morning. Manage recipients at /admin/branscombe-pipeline.",
  });

  try {
    const recipients = await getActiveRecipients();
    if (recipients.length > 0) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const guard = guardRecipients(recipients);
      const { error: sendErr } = await resend.emails.send({
        from:
          process.env.RESEND_FROM_EMAIL ||
          "Branscombe Estate <onboarding@resend.dev>",
        to: guard.to,
        subject: `Branscombe digest — ${regList.length} new, ${allocatedTouched.length} allocated`,
        html,
      });
      if (sendErr) console.error("branscombe daily digest: Resend send error:", sendErr);
    }
  } catch (err) {
    console.error("Branscombe daily digest send failed:", err);
    return NextResponse.json(
      { ok: false, error: "Send failed", counts: { regList: regList.length } },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    counts: {
      new_registrations: regList.length,
      touched_24h: touched.length,
      allocated_24h: allocatedTouched.length,
      total_interest: totalInterest,
      total_allocated: totalAllocated,
    },
  });
}
