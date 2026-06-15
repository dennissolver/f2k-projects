import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";
import {
  renderEmployerCampaignEmail,
  CAMPAIGN_SUBJECT,
  CAMPAIGN_FROM,
  CAMPAIGN_REPLY_TO,
} from "@/lib/seafields/employer-campaign-email";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SITE =
  process.env.NEXT_PUBLIC_CANONICAL_URL || "https://f2k-projects.vercel.app";
const REGISTER_URL = `${SITE}/seafields/employers?src=geraldton-campaign`;
const TEST_RECIPIENTS = ["dennis@factory2key.com.au", "uwe@factory2key.com.au"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function unsubUrl(token: string): string {
  return `${SITE}/api/seafields/employer-prospects/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** Auth: a logged-in admin OR a server-to-server Bearer CRON_SECRET. */
async function authorize(
  request: Request,
): Promise<{ ok: boolean; actorEmail: string } | null> {
  const bearer = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    bearer === `Bearer ${process.env.CRON_SECRET}`
  ) {
    return { ok: true, actorEmail: "campaign-runner" };
  }
  const admin = await getAdminUser();
  if (admin && (admin.role === "super_admin" || admin.role === "fund_manager")) {
    return { ok: true, actorEmail: admin.email };
  }
  return null;
}

/** GET — prospect counts by outreach status (for the operator view / pre-send check). */
export async function GET(request: Request) {
  const auth = await authorize(request);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createSupabaseService();
  const { data } = await (service.from("seafields_employer_prospects") as any)
    .select("outreach_status, email")
    .eq("estate_slug", "seafields");
  const rows = (data as { outreach_status: string; email: string | null }[]) || [];
  const byStatus: Record<string, number> = {};
  for (const r of rows) byStatus[r.outreach_status] = (byStatus[r.outreach_status] || 0) + 1;
  const sendable = rows.filter(
    (r) => r.outreach_status === "imported" && r.email,
  ).length;
  return NextResponse.json({ total: rows.length, byStatus, sendableNow: sendable });
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY not configured" },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const mode: "test" | "live" = body.mode === "live" ? "live" : "test";
  const sector: string | undefined = body.sector || undefined;
  const limit: number | undefined =
    typeof body.limit === "number" && body.limit > 0 ? body.limit : undefined;

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const service = createSupabaseService();

  // ---------- TEST MODE: send the exact email to the operator(s), touch no rows ----------
  if (mode === "test") {
    const recipients: string[] = Array.isArray(body.testEmails) && body.testEmails.length
      ? body.testEmails
      : TEST_RECIPIENTS;
    const { subject, html, text } = renderEmployerCampaignEmail({
      businessName: "Your Business (TEST)",
      registerUrl: REGISTER_URL,
      unsubscribeUrl: unsubUrl("test-token-not-a-real-prospect"),
    });
    const results: { email: string; status: string; error?: string }[] = [];
    for (const to of recipients) {
      const r = await resend.emails.send({
        from: CAMPAIGN_FROM,
        to,
        replyTo: CAMPAIGN_REPLY_TO,
        subject: `[TEST] ${subject}`,
        html,
        text,
      });
      results.push({
        email: to,
        status: r.error ? "failed" : "sent",
        error: r.error?.message,
      });
      await sleep(150);
    }
    return NextResponse.json({ mode: "test", recipients, results });
  }

  // ---------- LIVE MODE: send to imported emailable prospects, update status ----------
  let query = (service.from("seafields_employer_prospects") as any)
    .select("id, business_name, email, unsubscribe_token, sector")
    .eq("estate_slug", "seafields")
    .eq("outreach_status", "imported")
    .not("email", "is", null);
  if (sector) query = query.eq("sector", sector);
  query = query.order("created_at", { ascending: true });
  if (limit) query = query.limit(limit);

  const { data: prospects, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const list = (prospects as {
    id: string;
    business_name: string;
    email: string;
    unsubscribe_token: string;
    sector: string;
  }[]) || [];

  let sent = 0;
  let failed = 0;
  const failures: { email: string; error: string }[] = [];

  for (const p of list) {
    try {
      const { subject, html, text } = renderEmployerCampaignEmail({
        businessName: p.business_name,
        registerUrl: REGISTER_URL,
        unsubscribeUrl: unsubUrl(p.unsubscribe_token),
      });
      const r = await resend.emails.send({
        from: CAMPAIGN_FROM,
        to: p.email,
        replyTo: CAMPAIGN_REPLY_TO,
        subject,
        html,
        text,
      });
      if (r.error) throw new Error(r.error.message);
      await service
        .from("seafields_employer_prospects")
        .update({ outreach_status: "emailed", emailed_at: new Date().toISOString() })
        .eq("id", p.id);
      sent++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : "send failed";
      failures.push({ email: p.email, error: msg });
      await service
        .from("seafields_employer_prospects")
        .update({ outreach_status: "bounced", notes: `send error: ${msg}`.slice(0, 500) })
        .eq("id", p.id);
    }
    await sleep(180); // throttle for deliverability
  }

  // Audit (best-effort; actor_id nullable — matches the register routes).
  try {
    await service.from("audit_log").insert({
      actor_id: null,
      actor_email: auth.actorEmail,
      action: "seafields_employer_campaign_sent",
      entity_type: "seafields_employer_campaign",
      entity_id: null,
      details: { mode: "live", sector: sector ?? "all", attempted: list.length, sent, failed },
    });
  } catch (err) {
    console.error("campaign audit log failed:", err);
  }

  return NextResponse.json({
    mode: "live",
    sector: sector ?? "all",
    subject: CAMPAIGN_SUBJECT,
    attempted: list.length,
    sent,
    failed,
    failures: failures.slice(0, 25),
  });
}
