import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import {
  createSupabaseService,
  createSupabaseServiceWithActor,
} from "@/lib/supabase-service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface Ctx { params: { id: string } }

const FROM_DEFAULT = "Factory2Key Hemp Homes <noreply@updates.corporateaisolutions.com>";
const REPLY_TO_DEFAULT = "dennis@factory2key.com.au";

export async function POST(_request: Request, { params }: Ctx) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_hemp_homes_outreach")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });

  const supabase = createSupabaseService();
  const { data: outreach, error: loadErr } = await (supabase.from("hemp_homes_prospect_outreach") as any)
    .select("id, prospect_id, review_status, drafted_subject, drafted_preview, drafted_body_md, drafted_body_html, drafted_to_addresses")
    .eq("id", params.id)
    .maybeSingle();
  if (loadErr || !outreach) return NextResponse.json({ error: "Outreach not found" }, { status: 404 });
  if (outreach.review_status !== "pending") {
    return NextResponse.json({ error: `Cannot approve — current status: ${outreach.review_status}` }, { status: 409 });
  }
  if ((outreach.drafted_to_addresses ?? []).length === 0) {
    return NextResponse.json({ error: "No recipient addresses on this draft" }, { status: 422 });
  }

  // Send via Resend.
  let resendId: string | undefined;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || FROM_DEFAULT,
      to: outreach.drafted_to_addresses,
      subject: outreach.drafted_subject,
      html: outreach.drafted_body_html ?? `<pre>${outreach.drafted_body_md}</pre>`,
      text: outreach.drafted_body_md,
      replyTo: REPLY_TO_DEFAULT,
    });
    if (result.error) {
      return NextResponse.json({ error: result.error.message ?? String(result.error) }, { status: 502 });
    }
    resendId = result.data?.id;
  } catch (e) {
    return NextResponse.json({ error: `Resend send failed: ${(e as Error).message}` }, { status: 502 });
  }

  const writer = createSupabaseServiceWithActor(admin.email, "approve + send hemp-homes outreach");
  const now = new Date().toISOString();
  await (writer.from("hemp_homes_prospect_outreach") as any)
    .update({
      review_status: "approved",
      reviewed_by: admin.auth_user_id,
      reviewed_at: now,
      sent_at: now,
      resend_message_id: resendId,
      delivery_status: "sent",
    })
    .eq("id", params.id);

  // Move prospect into 'sent' lifecycle.
  await (writer.from("hemp_homes_community_prospects") as any)
    .update({
      outreach_status: "sent",
      last_outreach_at: now,
      // Bump operational status too — admin can still flip later.
      status: "outreach_sent",
    })
    .eq("id", outreach.prospect_id)
    .in("status", ["researched"]); // only auto-flip if still researched

  // Audit attribution.
  await supabase.from("audit_log").insert({
    actor_id: admin.auth_user_id,
    actor_email: admin.email,
    action: "hemp_homes_outreach_sent",
    entity_type: "hemp_homes_prospect_outreach",
    entity_id: outreach.id,
    details: {
      prospect_id: outreach.prospect_id,
      to: outreach.drafted_to_addresses,
      subject: outreach.drafted_subject,
      resend_id: resendId ?? null,
    },
  }).then(() => {}, (err) => console.error("audit insert failed", err));

  return NextResponse.json({ ok: true, resend_id: resendId ?? null });
}
