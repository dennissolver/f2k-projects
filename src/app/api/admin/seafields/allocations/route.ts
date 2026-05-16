import { NextResponse } from "next/server";
import { getAdminUser, hasPermission } from "@/lib/admin-auth";
import { createSupabaseService } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin || !hasPermission(admin.role, "manage_seafields_allocations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseService();
  const { data, error } = await (supabase.from("seafields_lot_allocations") as any)
    .select(
      "lot_number, sqm, allocated_to, dwelling_type, stage, x_pct, y_pct, assigned_at, updated_at, notes, wholesale_price, retail_price, intent_locked_to_registration_id, intent_locked_at, intent_locked_by, status, allocation_bucket, stage_id, dwelling_type_id, category, zone, land_only, land_rate_override_per_sqm, house_cost, display_price_to_public, public_label, internal_notes"
    )
    .order("lot_number");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ allocations: data || [] });
}
