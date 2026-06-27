/**
 * ROI portal — 48h auto-nudge (spec §3 step 7, the deliberate F2K fallback).
 *
 * For waitlist buyers who registered but were never followed up, send the agent-branded
 * covering email (the qualification-form link) on the agent's behalf. Gated hard on:
 *   - status still 'new' (no one has actioned them),
 *   - consent_contact = true (Spam Act — never nudge a non-consenting buyer),
 *   - not in email_suppressions (honoured unsubscribe),
 *   - nudged_at IS NULL (send once),
 *   - submitted_at older than 48h.
 *
 * Runs daily via Vercel cron; a row becomes eligible at 48h and is nudged on the next run.
 * Cron auth: Vercel sends Authorization: Bearer <CRON_SECRET>.
 */

import { NextResponse } from "next/server";
import { createSupabaseService } from "@/lib/supabase-service";
import { isSuppressed } from "@/lib/email/unsubscribe";
import { buildQualifyUrl } from "@/lib/roi/qualify-link";
import { buildCoveringEmail } from "@/lib/roi/covering-email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://f2k-projects.vercel.app";

function authorised(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return !process.env.VERCEL;
  return (req.headers.get("authorization") || "") === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseService();
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await (supabase.from("waitlist_registrations") as any)
    .select("id, estate_id, name, email, introducing_agent_id")
    .eq("status", "new")
    .eq("consent_contact", true)
    .is("nudged_at", null)
    .lt("submitted_at", cutoff)
    .limit(100);

  if (error) {
    console.error("roi-nudge query error:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 });
  }

  // Cache estate + agent lookups across the batch.
  const estateCache = new Map<string, { slug: string; name: string } | null>();
  const agentCache = new Map<string, { name: string | null; phone: string | null } | null>();

  let sent = 0;
  let skipped = 0;
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from =
    process.env.RESEND_FROM_EMAIL ||
    "Branscombe Estate <noreply@updates.corporateaisolutions.com>";

  for (const row of rows) {
    try {
      if (await isSuppressed(row.email)) {
        skipped++;
        continue;
      }

      let estate = estateCache.get(row.estate_id) ?? null;
      if (!estateCache.has(row.estate_id)) {
        const { data } = await (supabase.from("estates") as any)
          .select("slug, name")
          .eq("id", row.estate_id)
          .maybeSingle();
        estate = data ?? null;
        estateCache.set(row.estate_id, estate);
      }
      if (!estate) {
        skipped++;
        continue;
      }

      let agent: { name: string | null; phone: string | null } | null = null;
      if (row.introducing_agent_id) {
        agent = agentCache.get(row.introducing_agent_id) ?? null;
        if (!agentCache.has(row.introducing_agent_id)) {
          const { data } = await (supabase.from("agents") as any)
            .select("name, phone")
            .eq("id", row.introducing_agent_id)
            .maybeSingle();
          agent = data ?? null;
          agentCache.set(row.introducing_agent_id, agent);
        }
      }

      const qualifyUrl = buildQualifyUrl(SITE_URL, estate.slug, row.id);
      const { subject, html } = buildCoveringEmail({
        buyerName: row.name,
        buyerEmail: row.email,
        estateName: estate.name,
        qualifyUrl,
        agentName: agent?.name ?? null,
        agentPhone: agent?.phone ?? null,
        isNudge: true,
      });

      await resend.emails.send({ to: row.email, from, subject, html });

      // Mark nudged so it never fires twice (even if the send is retried).
      await (supabase.from("waitlist_registrations") as any)
        .update({ nudged_at: new Date().toISOString() })
        .eq("id", row.id);
      sent++;
    } catch (err) {
      console.error("roi-nudge send failed for", row.id, err);
      skipped++;
    }
  }

  await supabase.from("audit_log").insert({
    actor_email: "system",
    action: "roi_nudge_run",
    entity_type: "waitlist_registration",
    entity_id: null,
    details: { sent, skipped, candidates: rows.length },
  });

  return NextResponse.json({ sent, skipped });
}
