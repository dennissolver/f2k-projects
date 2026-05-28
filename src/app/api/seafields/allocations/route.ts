import { NextResponse } from "next/server";
import { createSupabaseService } from "@/lib/supabase-service";
import {
  validateLotPricing,
  getSeverity,
  ValidationSeverity,
  type AllocationData,
  type StageData,
  type ViewData,
} from "@/lib/seafields-pricing-validator";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export type PublicLotRow = {
  lot_number: number;
  status: string;
  allocation_bucket: string | null;
  public_label: string | null;
  stage_number: number | null;
  stage_label: string | null;
  is_open_for_registration: boolean;
  effective_rate_per_sqm: number | null;
  land_total: number | null;
  total_price: number | null;
  land_only: boolean;
};

/**
 * Public lot register. Reads the seafields_public_lots view — never the
 * base allocations table — so admin-only columns (allocated_to, wholesale
 * price, internal notes, intent-lock metadata) cannot leak to anon. The
 * view also suppresses prices when display_price_to_public=FALSE or the
 * stage is hidden, and filters out non-public stages entirely.
 *
 * Response is keyed by lot_number for O(1) lookup in the client.
 * F2KSFLDS-8: replaces the previous /api/seafields/allocations endpoint
 * which returned the raw allocated_to free-text field.
 *
 * Pricing validation: now includes silent validation checks that log issues
 * to audit_log without blocking the response (graceful degradation).
 */
export async function GET() {
  const supabase = createSupabaseService();

  try {
    const { data, error } = await (supabase
      .from("seafields_public_lots") as any)
      .select(
        "lot_number, status, allocation_bucket, public_label, stage_number, stage_label, is_open_for_registration, effective_rate_per_sqm, land_total, total_price, land_only",
      )
      .order("lot_number");

    if (error) {
      return NextResponse.json({ lots: [] });
    }

    // Background: validate pricing (non-blocking, logs only)
    if (process.env.NODE_ENV === "production") {
      void validatePricingAsync(supabase, (data || []) as PublicLotRow[]);
    }

    return NextResponse.json({ lots: (data || []) as PublicLotRow[] });
  } catch {
    return NextResponse.json({ lots: [] });
  }
}

/**
 * Background validation task (non-blocking).
 * Runs after response is sent to avoid latency impact.
 */
async function validatePricingAsync(
  supabase: ReturnType<typeof createSupabaseService>,
  viewData: PublicLotRow[]
) {
  try {
    // Fetch allocations and stages for validation
    const { data: allocations } = await (supabase
      .from("seafields_lot_allocations") as any)
      .select(
        "lot_number, sqm, retail_price, wholesale_price, house_cost, land_rate_override_per_sqm, stage_id, status, display_price_to_public"
      );

    const { data: stages } = await (supabase.from("stages") as any).select(
      "id, stage_number, rate_per_sqm, public_visible"
    );

    if (!allocations || !stages) {
      return;
    }

    // Build maps
    const stageMap = new Map(
      (stages as StageData[]).map((s) => [s.id, s])
    );
    const viewMap = new Map(
      viewData.map((v) => [v.lot_number, { lot_number: v.lot_number, land_total: v.land_total, total_price: v.total_price } as ViewData])
    );

    // Check for critical issues
    const criticalIssues: Array<{
      lot_number: number;
      message: string;
    }> = [];

    for (const alloc of allocations as AllocationData[]) {
      const stage = alloc.stage_id ? stageMap.get(alloc.stage_id) : null;
      const view = viewMap.get(alloc.lot_number);

      const validation = validateLotPricing(
        alloc,
        (stage as StageData) || null,
        (view as ViewData) || null
      );

      const severity = getSeverity(validation);

      if (severity === ValidationSeverity.CRITICAL) {
        criticalIssues.push({
          lot_number: alloc.lot_number,
          message: validation.issues.join("; "),
        });
      }
    }

    // Log critical issues
    if (criticalIssues.length > 0) {
      for (const issue of criticalIssues) {
        await (supabase.from("audit_log") as any).insert({
          actor_email: "system@api-validator",
          action: "seafields_pricing_validation_critical",
          entity_type: "seafields_lot_allocations",
          entity_id: issue.lot_number.toString(),
          details: {
            severity: "critical",
            message: issue.message,
            timestamp: new Date().toISOString(),
            source: "allocations-api",
          },
        });
      }

      console.error(
        `[seafields-pricing] ${criticalIssues.length} critical pricing issue(s) logged`
      );
    }
  } catch (error) {
    // Silently fail validation - don't impact the API response
    console.error("[seafields-pricing] Validation error:", error);
  }
}
