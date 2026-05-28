/**
 * seafields-pricing-validator.ts
 *
 * Runtime validation and monitoring for Seafields lot pricing consistency.
 * Catches mismatches between stored values and public view calculations.
 *
 * Used by:
 * - /api/seafields/allocations (validates before returning)
 * - Admin pages (warns on edit)
 * - Scheduled audit jobs (logs discrepancies)
 */

export interface PriceValidation {
  lot_number: number;
  isValid: boolean;
  issues: string[];
  expectedLandTotal: number | null;
  expectedTotalPrice: number | null;
  viewLandTotal: number | null;
  viewTotalPrice: number | null;
}

export interface AllocationData {
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

export interface StageData {
  id: string;
  stage_number: number;
  rate_per_sqm: number | null;
  public_visible: boolean | null;
}

export interface ViewData {
  lot_number: number;
  land_total: number | null;
  total_price: number | null;
}

/**
 * Validates a single lot's pricing against expected values.
 * Returns issues array (empty = valid).
 */
export function validateLotPricing(
  allocation: AllocationData,
  stage: StageData | null,
  viewRow: ViewData | null,
  tolerance: number = 1 // Allow $1 rounding error
): PriceValidation {
  const issues: string[] = [];

  // Step 1: Compute expected land price
  // Priority: retail_price > wholesale_price > (sqm × rate)
  let expectedLandTotal: number | null = null;

  if (allocation.retail_price !== null && allocation.retail_price > 0) {
    expectedLandTotal = allocation.retail_price;
  } else if (allocation.wholesale_price !== null && allocation.wholesale_price > 0) {
    expectedLandTotal = allocation.wholesale_price;
  } else if (stage?.rate_per_sqm && allocation.sqm > 0) {
    const rate = allocation.land_rate_override_per_sqm ?? stage.rate_per_sqm;
    if (rate) {
      expectedLandTotal = allocation.sqm * rate;
    }
  }

  // Step 2: Compute expected total price (land + house)
  let expectedTotalPrice: number | null = null;
  if (expectedLandTotal !== null) {
    expectedTotalPrice = expectedLandTotal + (allocation.house_cost ?? 0);
  }

  // Step 3: Compare with view data
  let landPriceMatches = true;
  let totalPriceMatches = true;

  if (
    expectedLandTotal !== null &&
    viewRow?.land_total !== null &&
    Math.abs(expectedLandTotal - viewRow.land_total) > tolerance
  ) {
    landPriceMatches = false;
    issues.push(
      `Land price mismatch: expected $${Math.round(expectedLandTotal)} but view shows $${Math.round(viewRow.land_total)}`
    );
  }

  if (
    expectedTotalPrice !== null &&
    viewRow?.total_price !== null &&
    Math.abs(expectedTotalPrice - viewRow.total_price) > tolerance
  ) {
    totalPriceMatches = false;
    issues.push(
      `Total price mismatch: expected $${Math.round(expectedTotalPrice)} but view shows $${Math.round(viewRow.total_price)}`
    );
  }

  // Step 4: Additional validation rules
  if (
    !allocation.display_price_to_public &&
    allocation.status !== "sold"
  ) {
    issues.push(
      `Price hidden from public (display_price_to_public=FALSE) - verify if intentional`
    );
  }

  if (
    allocation.house_cost &&
    allocation.house_cost < 0 &&
    allocation.status !== "sold"
  ) {
    issues.push(`House cost is negative ($${allocation.house_cost})`);
  }

  // For "sold" lots, pricing is locked - any mismatch is informational only
  if (allocation.status === "sold") {
    // Reduce severity but keep the record
    issues.forEach((issue) => {
      if (issue.includes("mismatch")) {
        issues[issues.indexOf(issue)] = `[SOLD] ${issue} (price locked at sale)`;
      }
    });
  }

  return {
    lot_number: allocation.lot_number,
    isValid: issues.length === 0,
    issues,
    expectedLandTotal,
    expectedTotalPrice,
    viewLandTotal: viewRow?.land_total ?? null,
    viewTotalPrice: viewRow?.total_price ?? null,
  };
}

/**
 * Batch validate multiple lots. Returns summary and detailed issues.
 */
export function validateBatch(
  allocations: AllocationData[],
  stages: Map<string, StageData>,
  viewData: Map<number, ViewData>
): {
  summary: {
    total: number;
    valid: number;
    issueCount: number;
    criticalCount: number;
  };
  issues: Array<{
    lot_number: number;
    severity: "critical" | "warning";
    messages: string[];
  }>;
} {
  const issues: Array<{
    lot_number: number;
    severity: "critical" | "warning";
    messages: string[];
  }> = [];

  let issueCount = 0;
  let criticalCount = 0;

  for (const alloc of allocations) {
    const stage = alloc.stage_id ? stages.get(alloc.stage_id) : null;
    const view = viewData.get(alloc.lot_number);

    const validation = validateLotPricing(alloc, stage ?? null, view ?? null);

    if (!validation.isValid) {
      issueCount++;

      // Categorize severity
      const hasCriticalMismatch = validation.issues.some((i) =>
        i.includes("mismatch") && !i.includes("[SOLD]")
      );

      if (hasCriticalMismatch) {
        criticalCount++;
      }

      issues.push({
        lot_number: alloc.lot_number,
        severity: hasCriticalMismatch ? "critical" : "warning",
        messages: validation.issues,
      });
    }
  }

  return {
    summary: {
      total: allocations.length,
      valid: allocations.length - issueCount,
      issueCount,
      criticalCount,
    },
    issues,
  };
}

/**
 * Format validation results for logging.
 */
export function formatValidationReport(
  validation: PriceValidation,
  full: boolean = false
): string {
  const status = validation.isValid ? "✅" : "❌";
  const header = `${status} Lot ${validation.lot_number}`;

  if (!full || validation.isValid) {
    return header;
  }

  const lines = [header];
  lines.push(
    `  Expected land: $${Math.round(validation.expectedLandTotal ?? 0)}`
  );
  lines.push(
    `  View land:     $${Math.round(validation.viewLandTotal ?? 0)}`
  );
  lines.push(
    `  Expected total: $${Math.round(validation.expectedTotalPrice ?? 0)}`
  );
  lines.push(
    `  View total:     $${Math.round(validation.viewTotalPrice ?? 0)}`
  );

  for (const issue of validation.issues) {
    lines.push(`  ⚠️  ${issue}`);
  }

  return lines.join("\n");
}

/**
 * Severity levels for monitoring alerts.
 */
export enum ValidationSeverity {
  OK = "ok",
  WARNING = "warning",
  CRITICAL = "critical",
}

/**
 * Determine alert severity based on validation results.
 */
export function getSeverity(
  validation: PriceValidation
): ValidationSeverity {
  if (validation.isValid) return ValidationSeverity.OK;

  const hasMismatch = validation.issues.some((i) => i.includes("mismatch"));
  const hasSoldCaveat = validation.issues.some((i) => i.includes("[SOLD]"));

  // Critical: price mismatch on non-sold lot
  if (hasMismatch && !hasSoldCaveat) {
    return ValidationSeverity.CRITICAL;
  }

  // Warning: other issues
  return ValidationSeverity.WARNING;
}
