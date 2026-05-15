import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

/**
 * List all stages with computed escalation_pct.
 * Reads from `stages_with_escalation` view (vs stages directly) so callers
 * get the % above Stage 1 rate without computing client-side.
 */
export async function GET() {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_seafields_stages")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseService();
  const { data, error } = await (
    supabase.from("stages_with_escalation") as any
  )
    .select(
      "id, stage_number, stage_label, rate_per_sqm, escalation_pct, is_open_for_registration, auto_advance_threshold_pct, public_visible, updated_at",
    )
    .order("stage_number");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ stages: data ?? [] });
}
