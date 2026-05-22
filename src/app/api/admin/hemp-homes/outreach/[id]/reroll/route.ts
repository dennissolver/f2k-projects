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

interface Ctx { params: { id: string } }

// Mark the existing draft as 'rerolled' and generate a fresh one against
// the same template + prospect. Same frequency-cap-bypass logic as
// /generate?force=true, since the operator already approved a re-roll.
export async function POST(_request: Request, { params }: Ctx) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_hemp_homes_outreach")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseService();
  const { data: old, error: loadErr } = await (supabase.from("hemp_homes_prospect_outreach") as any)
    .select("id, prospect_id, template_id, review_status")
    .eq("id", params.id)
    .maybeSingle();
  if (loadErr || !old) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  if (old.review_status !== "pending") {
    return NextResponse.json({ error: `Cannot reroll — status: ${old.review_status}` }, { status: 409 });
  }

  const [prospectRes, templateRes] = await Promise.all([
    (supabase.from("hemp_homes_community_prospects") as any).select("*").eq("id", old.prospect_id).maybeSingle(),
    (supabase.from("hemp_homes_outreach_templates") as any).select("*").eq("id", old.template_id).maybeSingle(),
  ]);
  if (!prospectRes.data || !templateRes.data) {
    return NextResponse.json({ error: "Prospect or template missing" }, { status: 404 });
  }
  const prospect = prospectRes.data as HempHomesProspect;
  const template = templateRes.data as HempHomesOutreachTemplate;

  let draft;
  try {
    draft = await generateOutreachDraft(template, prospect);
  } catch (e) {
    return NextResponse.json({ error: `Reroll generation failed: ${(e as Error).message}` }, { status: 500 });
  }

  const writer = createSupabaseServiceWithActor(admin.email, "reroll hemp-homes outreach draft");

  // Mark old as rerolled.
  await (writer.from("hemp_homes_prospect_outreach") as any)
    .update({
      review_status: "rerolled",
      reviewed_by: admin.auth_user_id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  // Insert new draft.
  const { data: fresh, error: insErr } = await (writer.from("hemp_homes_prospect_outreach") as any)
    .insert({
      prospect_id: old.prospect_id,
      template_id: old.template_id,
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

  return NextResponse.json({ outreach: fresh });
}
