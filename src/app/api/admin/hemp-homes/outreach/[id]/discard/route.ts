import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseServiceWithActor } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

interface Ctx { params: { id: string } }

export async function POST(request: Request, { params }: Ctx) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_hemp_homes_outreach")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any = {};
  try { body = await request.json(); } catch { /* optional body */ }

  const supabase = createSupabaseServiceWithActor(admin.email, "discard hemp-homes outreach draft");
  const { data, error } = await (supabase.from("hemp_homes_prospect_outreach") as any)
    .update({
      review_status: "discarded",
      reviewed_by: admin.auth_user_id,
      reviewed_at: new Date().toISOString(),
      notes: body.notes ?? null,
    })
    .eq("id", params.id)
    .eq("review_status", "pending")
    .select("id, prospect_id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Draft not found or not pending" }, { status: 404 });

  // If the prospect's only pending draft was this one, drop it back to idle.
  const { count } = await (supabase.from("hemp_homes_prospect_outreach") as any)
    .select("id", { count: "exact", head: true })
    .eq("prospect_id", data.prospect_id)
    .eq("review_status", "pending");
  if ((count ?? 0) === 0) {
    await (supabase.from("hemp_homes_community_prospects") as any)
      .update({ outreach_status: "idle" })
      .eq("id", data.prospect_id)
      .eq("outreach_status", "queued");
  }

  return NextResponse.json({ ok: true });
}
