/**
 * Supabase Edge Function: seafields-pricing-audit
 *
 * Scheduled audit job (runs every 6 hours) that validates Seafields lot pricing
 * for consistency between stored allocation data and the public_lots view.
 *
 * Logs issues to `audit_log` table with severity levels.
 * Can be invoked manually or via scheduled triggers.
 *
 * Deploy:
 *   supabase functions deploy seafields-pricing-audit
 *
 * Test locally:
 *   supabase functions serve
 *   curl http://localhost:54321/functions/v1/seafields-pricing-audit
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface AllocationRow {
  lot_number: number;
  sqm: number;
  retail_price: number | null;
  wholesale_price: number | null;
  house_cost: number | null;
  land_rate_override_per_sqm: number | null;
  stage_id: string | null;
  status: string;
  display_price_to_public: boolean;
}

interface StageRow {
  id: string;
  stage_number: number;
  rate_per_sqm: number | null;
}

interface ViewRow {
  lot_number: number;
  land_total: number | null;
  total_price: number | null;
}

interface ValidationIssue {
  lot_number: number;
  severity: "warning" | "critical";
  message: string;
}

const tolerance = 1; // Allow $1 rounding error

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    console.log("[seafields-pricing-audit] Starting audit...");

    // Fetch all allocations
    const { data: allocations, error: allocError } = await (supabase
      .from("seafields_lot_allocations") as any)
      .select(
        "lot_number, sqm, retail_price, wholesale_price, house_cost, land_rate_override_per_sqm, stage_id, status, display_price_to_public"
      )
      .order("lot_number");

    if (allocError) {
      console.error("[seafields-pricing-audit] Allocation fetch error:", allocError);
      return new Response(
        JSON.stringify({ error: allocError.message }),
        { status: 500 }
      );
    }

    // Fetch stages
    const { data: stages, error: stageError } = await (supabase
      .from("stages") as any)
      .select("id, stage_number, rate_per_sqm");

    if (stageError) {
      console.error("[seafields-pricing-audit] Stage fetch error:", stageError);
      return new Response(JSON.stringify({ error: stageError.message }), {
        status: 500,
      });
    }

    // Fetch public view
    const { data: viewData, error: viewError } = await (supabase
      .from("seafields_public_lots") as any)
      .select("lot_number, land_total, total_price");

    if (viewError) {
      console.error("[seafields-pricing-audit] View fetch error:", viewError);
      return new Response(JSON.stringify({ error: viewError.message }), {
        status: 500,
      });
    }

    // Build maps
    const stageMap = new Map(
      (stages || []).map((s: StageRow) => [s.id, s])
    );
    const viewMap = new Map(
      (viewData || []).map((v: ViewRow) => [v.lot_number, v])
    );

    // Validate each lot
    const issues: ValidationIssue[] = [];

    for (const alloc of (allocations || []) as AllocationRow[]) {
      const stage = alloc.stage_id ? stageMap.get(alloc.stage_id) : null;
      const view = viewMap.get(alloc.lot_number);

      // Compute expected values
      let expectedLandTotal: number | null = null;
      if (alloc.retail_price !== null && alloc.retail_price > 0) {
        expectedLandTotal = alloc.retail_price;
      } else if (alloc.wholesale_price !== null && alloc.wholesale_price > 0) {
        expectedLandTotal = alloc.wholesale_price;
      } else if (stage?.rate_per_sqm && alloc.sqm > 0) {
        const rate = alloc.land_rate_override_per_sqm ?? stage.rate_per_sqm;
        if (rate) expectedLandTotal = alloc.sqm * rate;
      }

      const expectedTotalPrice = expectedLandTotal
        ? expectedLandTotal + (alloc.house_cost ?? 0)
        : null;

      // Check for mismatches
      if (
        expectedLandTotal !== null &&
        view?.land_total !== null &&
        Math.abs(expectedLandTotal - view.land_total) > tolerance
      ) {
        const severity = alloc.status === "sold" ? "warning" : "critical";
        issues.push({
          lot_number: alloc.lot_number,
          severity,
          message: `Land price mismatch: expected $${Math.round(expectedLandTotal)}, view shows $${Math.round(view.land_total)}`,
        });
      }

      if (
        expectedTotalPrice !== null &&
        view?.total_price !== null &&
        Math.abs(expectedTotalPrice - view.total_price) > tolerance
      ) {
        const severity = alloc.status === "sold" ? "warning" : "critical";
        issues.push({
          lot_number: alloc.lot_number,
          severity,
          message: `Total price mismatch: expected $${Math.round(expectedTotalPrice)}, view shows $${Math.round(view.total_price)}`,
        });
      }

      if (alloc.house_cost && alloc.house_cost < 0) {
        issues.push({
          lot_number: alloc.lot_number,
          severity: "warning",
          message: `Negative house cost: $${alloc.house_cost}`,
        });
      }
    }

    // Log issues to audit_log
    if (issues.length > 0) {
      console.log(
        `[seafields-pricing-audit] Found ${issues.length} issue(s)`
      );

      for (const issue of issues) {
        const { error: logError } = await (supabase
          .from("audit_log") as any)
          .insert({
            actor_email: "system@pricing-validator",
            action: "seafields_pricing_validation",
            entity_type: "seafields_lot_allocations",
            entity_id: issue.lot_number.toString(),
            details: {
              severity: issue.severity,
              message: issue.message,
              timestamp: new Date().toISOString(),
              source: "scheduled-audit",
            },
          });

        if (logError) {
          console.error(
            `[seafields-pricing-audit] Failed to log issue for lot ${issue.lot_number}:`,
            logError
          );
        }
      }
    } else {
      console.log("[seafields-pricing-audit] ✅ All pricing consistent");
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        lotsAudited: (allocations || []).length,
        issuesFound: issues.length,
        criticalCount: issues.filter((i) => i.severity === "critical").length,
        issues: issues,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("[seafields-pricing-audit] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500 }
    );
  }
});
