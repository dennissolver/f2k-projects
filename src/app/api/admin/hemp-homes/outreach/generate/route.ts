import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import {
  createSupabaseService,
  createSupabaseServiceWithActor,
} from "@/lib/supabase-service";
import { generateOutreachDraft } from "@/lib/hemp-homes/outreach-generator";
import type { HempHomesOutreachTemplate, HempHomesProspect } from "@/lib/hemp-homes/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FREQUENCY_CAP_DAYS = 21;

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_hemp_homes_outreach")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const prospectId = String(body.prospect_id ?? "").trim();
  const templateSlug = String(body.template_slug ?? "").trim();
  if (!prospectId) return NextResponse.json({ error: "prospect_id required" }, { status: 400 });
  if (!templateSlug) return NextResponse.json({ error: "template_slug required" }, { status: 400 });
  const force = !!body.force; // bypass frequency cap

  const supabase = createSupabaseService();

  // Load prospect + template in parallel.
  const [prospectRes, templateRes] = await Promise.all([
    (supabase.from("hemp_homes_community_prospects") as any)
      .select("*").eq("id", prospectId).maybeSingle(),
    (supabase.from("hemp_homes_outreach_templates") as any)
      .select("*").eq("slug", templateSlug).eq("active", true).maybeSingle(),
  ]);

  if (prospectRes.error || !prospectRes.data) {
    return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
  }
  if (templateRes.error || !templateRes.data) {
    return NextResponse.json({ error: "Active template not found" }, { status: 404 });
  }
  const prospect = prospectRes.data as HempHomesProspect;
  const template = templateRes.data as HempHomesOutreachTemplate;

  // Privacy + lifecycle gates.
  if (prospect.outreach_status && ["paused", "declined"].includes(prospect.outreach_status as string)) {
    return NextResponse.json({ error: `Prospect outreach_status is "${prospect.outreach_status}" — blocked` }, { status: 409 });
  }
  if ((prospect.contact_emails ?? []).length === 0) {
    return NextResponse.json({ error: "No contact email on this prospect — discover one before generating" }, { status: 422 });
  }

  // Frequency cap (skipped when force=true).
  if (!force) {
    const sinceDate = new Date(Date.now() - FREQUENCY_CAP_DAYS * 86400 * 1000).toISOString();
    const { data: recent } = await (supabase.from("hemp_homes_prospect_outreach") as any)
      .select("id, generated_at, review_status")
      .eq("prospect_id", prospectId)
      .gte("generated_at", sinceDate)
      .in("review_status", ["pending", "approved"])
      .limit(1);
    if ((recent ?? []).length > 0) {
      return NextResponse.json({
        error: `Frequency cap: this prospect already has a draft/send within ${FREQUENCY_CAP_DAYS} days. Pass force=true to override.`,
      }, { status: 429 });
    }
  }

  // Generate.
  let draft;
  try {
    draft = await generateOutreachDraft(template, prospect);
  } catch (e) {
    return NextResponse.json({ error: `Generation failed: ${(e as Error).message}` }, { status: 500 });
  }

  // Persist draft.
  const writer = createSupabaseServiceWithActor(admin.email, "generate hemp-homes outreach draft");
  const { data: outreach, error: insErr } = await (writer.from("hemp_homes_prospect_outreach") as any)
    .insert({
      prospect_id: prospectId,
      template_id: template.id,
      drafted_subject: draft.subject,
      drafted_preview: draft.preview,
      drafted_body_md: draft.body_md,
      drafted_body_html: draft.body_html,
      drafted_to_addresses: prospect.contact_emails ?? [],
      review_status: "pending",
    })
    .select("*")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Bump prospect outreach_status to queued (idle → queued).
  if (prospect.outreach_status === "idle") {
    await (writer.from("hemp_homes_community_prospects") as any)
      .update({ outreach_status: "queued" })
      .eq("id", prospectId);
  }

  return NextResponse.json({
    outreach,
    llm_model: draft.llm_model,
    llm_tokens: { input: draft.llm_input_tokens, output: draft.llm_output_tokens },
  }, { status: 201 });
}
