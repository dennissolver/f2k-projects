/**
 * seafields-pricing-audit.ts
 *
 * Comprehensive audit script for Seafields lot pricing.
 * Identifies mismatches between stored land/house costs and computed prices.
 *
 * Usage:
 *   npx ts-node scripts/seafields-pricing-audit.ts [--lot NUMBER] [--check-views]
 *
 * Examples:
 *   npx ts-node scripts/seafields-pricing-audit.ts                    # All lots
 *   npx ts-node scripts/seafields-pricing-audit.ts --lot 237          # Lot 237 only
 *   npx ts-node scripts/seafields-pricing-audit.ts --check-views      # Include view output
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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
  public_visible: boolean | null;
}

interface PublicLotRow {
  lot_number: number;
  land_total: number | null;
  total_price: number | null;
}

interface AuditResult {
  lot_number: number;
  sqm: number;
  stage_number: number | null;
  status: string;
  retail_price: number | null;
  wholesale_price: number | null;
  house_cost: number | null;
  effective_land_price: number | null;
  expected_total_price: number | null;
  view_land_total: number | null;
  view_total_price: number | null;
  land_price_matches: boolean;
  total_price_matches: boolean;
  issues: string[];
}

async function getStageRate(
  stageId: string,
  stages: StageRow[]
): Promise<number | null> {
  const stage = stages.find((s) => s.id === stageId);
  return stage?.rate_per_sqm ?? null;
}

async function auditLot(
  allocation: AllocationRow,
  stages: StageRow[],
  viewData: Map<number, PublicLotRow>
): Promise<AuditResult> {
  const issues: string[] = [];

  // Determine effective land price (priority: retail > wholesale)
  const landPrice = allocation.retail_price ?? allocation.wholesale_price;

  // Get stage rate for fallback calculation
  const stageRate =
    allocation.stage_id && allocation.status !== "sold"
      ? await getStageRate(allocation.stage_id, stages)
      : null;

  // Calculate what the price SHOULD be
  let expectedLandPrice = landPrice;
  if (!expectedLandPrice && stageRate && allocation.sqm) {
    expectedLandPrice =
      (allocation.land_rate_override_per_sqm ?? stageRate) *
      allocation.sqm;
  }

  const expectedTotalPrice = expectedLandPrice
    ? expectedLandPrice + (allocation.house_cost ?? 0)
    : null;

  // Get view data
  const viewRow = viewData.get(allocation.lot_number);

  // Validate
  const landMatches =
    expectedLandPrice === null ||
    viewRow?.land_total === null ||
    Math.abs((expectedLandPrice ?? 0) - (viewRow?.land_total ?? 0)) < 1; // Allow $1 rounding

  const totalMatches =
    expectedTotalPrice === null ||
    viewRow?.total_price === null ||
    Math.abs((expectedTotalPrice ?? 0) - (viewRow?.total_price ?? 0)) < 1;

  // Populate issues
  if (!landMatches) {
    issues.push(
      `Land price mismatch: expected $${expectedLandPrice}, view shows $${viewRow?.land_total}`
    );
  }

  if (!totalMatches) {
    issues.push(
      `Total price mismatch: expected $${expectedTotalPrice}, view shows $${viewRow?.total_price}`
    );
  }

  if (
    allocation.house_cost &&
    allocation.house_cost <= 0 &&
    allocation.status !== "sold"
  ) {
    issues.push(
      `House cost is ${allocation.house_cost} (expected > 0 for H&L package)`
    );
  }

  if (!allocation.display_price_to_public && !issues.length) {
    issues.push(`Price not displayed to public (display_price_to_public=FALSE)`);
  }

  const stage = stages.find((s) => s.id === allocation.stage_id);

  return {
    lot_number: allocation.lot_number,
    sqm: allocation.sqm,
    stage_number: stage?.stage_number ?? null,
    status: allocation.status,
    retail_price: allocation.retail_price,
    wholesale_price: allocation.wholesale_price,
    house_cost: allocation.house_cost,
    effective_land_price: expectedLandPrice ?? null,
    expected_total_price: expectedTotalPrice ?? null,
    view_land_total: viewRow?.land_total ?? null,
    view_total_price: viewRow?.total_price ?? null,
    land_price_matches: landMatches,
    total_price_matches: totalMatches,
    issues,
  };
}

function formatCurrency(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
  }).format(n);
}

async function main() {
  const args = process.argv.slice(2);
  const lotFilter = args.includes("--lot")
    ? parseInt(args[args.indexOf("--lot") + 1])
    : null;
  const checkViews = args.includes("--check-views");

  console.log("\n📊 Seafields Pricing Audit\n");
  console.log(`Repository: F2K-Projects`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  if (lotFilter) console.log(`Filter: Lot ${lotFilter} only`);
  console.log();

  try {
    // Fetch allocations
    console.log("⏳ Fetching allocations...");
    const { data: allocations, error: allocError } = await (
      supabase.from("seafields_lot_allocations") as any
    )
      .select(
        "lot_number, sqm, retail_price, wholesale_price, house_cost, land_rate_override_per_sqm, stage_id, status, display_price_to_public"
      )
      .order("lot_number");

    if (allocError) {
      console.error("❌ Error fetching allocations:", allocError.message);
      process.exit(1);
    }

    // Fetch stages
    console.log("⏳ Fetching stages...");
    const { data: stages, error: stageError } = await (supabase.from("stages") as any).select(
      "id, stage_number, rate_per_sqm, public_visible"
    );

    if (stageError) {
      console.error("❌ Error fetching stages:", stageError.message);
      process.exit(1);
    }

    // Fetch public view data
    console.log("⏳ Fetching public view data...");
    const { data: viewData, error: viewError } = await (
      supabase.from("seafields_public_lots") as any
    ).select("lot_number, land_total, total_price");

    if (viewError) {
      console.error("❌ Error fetching view data:", viewError.message);
      process.exit(1);
    }

    // Build map for quick lookup
    const viewMap: Map<number, PublicLotRow> = new Map(
      (viewData || []).map((row: PublicLotRow) => [row.lot_number, row])
    );

    // Run audit
    console.log("⏳ Running audit...");
    const results: AuditResult[] = [];

    const toAudit = lotFilter
      ? (allocations || []).filter((a: AllocationRow) => a.lot_number === lotFilter)
      : (allocations || []);

    for (const alloc of toAudit) {
      const result = await auditLot(alloc, stages || [], viewMap);
      results.push(result);
    }

    // Report
    console.log(`\n📋 Audit Results (${results.length} lots)\n`);

    const hasIssues = results.some((r) => r.issues.length > 0);

    if (hasIssues) {
      console.log("⚠️  ISSUES FOUND:\n");

      for (const result of results.filter((r) => r.issues.length > 0)) {
        console.log(`  Lot ${result.lot_number} (${result.sqm}m²)`);
        console.log(`    Status: ${result.status}`);
        console.log(`    Retail price: ${formatCurrency(result.retail_price)}`);
        console.log(`    House cost: ${formatCurrency(result.house_cost)}`);
        console.log(`    Expected land: ${formatCurrency(result.effective_land_price)}`);
        console.log(`    Expected total: ${formatCurrency(result.expected_total_price)}`);
        console.log(`    View shows land: ${formatCurrency(result.view_land_total)}`);
        console.log(`    View shows total: ${formatCurrency(result.view_total_price)}`);
        for (const issue of result.issues) {
          console.log(`    ❌ ${issue}`);
        }
        console.log();
      }
    } else {
      console.log("✅ All prices consistent!\n");
    }

    // Summary table (only issues, or specific lot if filtered)
    if (lotFilter || hasIssues) {
      console.log("📊 Detailed Table:\n");
      console.log(
        "Lot | Stage | SQM  | Retail | House | Land Total | Total Price | Land ✓ | Total ✓"
      );
      console.log(
        "----+-------+------+--------+-------+------------+-------------+--------+--------"
      );

      for (const result of results) {
        const landOk = result.land_price_matches ? "✓" : "✗";
        const totalOk = result.total_price_matches ? "✓" : "✗";

        console.log(
          `${result.lot_number.toString().padEnd(3)} | ${(result.stage_number ?? "?").toString().padEnd(5)} | ${result.sqm.toString().padEnd(4)} | ` +
            `${formatCurrency(result.retail_price).padEnd(6)} | ${formatCurrency(result.house_cost).padEnd(5)} | ` +
            `${formatCurrency(result.view_land_total).padEnd(10)} | ${formatCurrency(result.view_total_price).padEnd(11)} | ${landOk.padEnd(6)} | ${totalOk}`
        );
      }
    }

    // Statistics
    const issueCount = results.filter((r) => r.issues.length > 0).length;
    const landMatches = results.filter((r) => r.land_price_matches).length;
    const totalMatches = results.filter((r) => r.total_price_matches).length;

    console.log(`\n📈 Statistics:`);
    console.log(`   Lots with issues: ${issueCount}/${results.length}`);
    console.log(`   Land prices match: ${landMatches}/${results.length}`);
    console.log(`   Total prices match: ${totalMatches}/${results.length}`);

    if (checkViews) {
      console.log(`\n🔍 View Query Results (first 3 rows):`);
      console.log(JSON.stringify((viewData || []).slice(0, 3), null, 2));
    }

    process.exit(issueCount > 0 ? 1 : 0);
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  }
}

main();
