import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_hemp_homes_outreach")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "pending";

  const supabase = createSupabaseService();
  let q = (supabase.from("hemp_homes_prospect_outreach") as any)
    .select(`
      *,
      prospect:hemp_homes_community_prospects(
        id, name, slug, state, wave, status, source_basis,
        contact_emails, contact_form_url, website_url, is_public_safe
      ),
      template:hemp_homes_outreach_templates(id, slug, name)
    `)
    .order("generated_at", { ascending: false })
    .limit(200);

  if (status !== "all") {
    q = q.eq("review_status", status);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ outreach: data ?? [] });
}
