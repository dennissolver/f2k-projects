// Pure conversion math (FTK analytics Phase 1). Kept dependency-free so it's unit-testable
// without pulling in Supabase / next-cache (the `@/` alias isn't wired into vitest).

/**
 * Conversion as a fraction (0..1), or null when it can't be computed:
 *  - no funnel (submissions === null), or
 *  - a zero/undefined denominator (avoids NaN/Infinity).
 */
export function computeConversion(
  submissions: number | null,
  denominator: number | null | undefined,
): number | null {
  if (submissions === null) return null;
  if (!denominator || denominator <= 0) return null;
  return submissions / denominator;
}
