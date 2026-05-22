import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseServiceWithActor } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

interface Ctx { params: { id: string } }

// PATCH allows the reviewer to edit subject / preview / body / recipients
// before approving. Marks reviewer_edited = true so we can spot LLM drift.
export async function PATCH(request: Request, { params }: Ctx) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_hemp_homes_outreach")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const update: Record<string, unknown> = { reviewer_edited: true };
  if (typeof body.drafted_subject === "string") update.drafted_subject = body.drafted_subject;
  if ("drafted_preview" in body) update.drafted_preview = body.drafted_preview ?? null;
  if (typeof body.drafted_body_md === "string") update.drafted_body_md = body.drafted_body_md;
  if ("drafted_body_html" in body) update.drafted_body_html = body.drafted_body_html ?? null;
  if (Array.isArray(body.drafted_to_addresses)) {
    update.drafted_to_addresses = body.drafted_to_addresses.filter((s: unknown) => typeof s === "string" && s);
  }
  if ("notes" in body) update.notes = body.notes ?? null;

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const supabase = createSupabaseServiceWithActor(admin.email, "edit hemp-homes outreach draft");
  const { data, error } = await (supabase.from("hemp_homes_prospect_outreach") as any)
    .update(update)
    .eq("id", params.id)
    .eq("review_status", "pending")
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ outreach: data });
}
