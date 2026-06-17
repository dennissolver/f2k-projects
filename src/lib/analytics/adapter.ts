// High-level analytics adapter (FTK analytics Phase 1).
//
// The single seam the dashboard reads from. Combines Umami traffic (per estate, by path) with
// submission counts (from each estate's registration table) into a per-estate analytics row, and
// computes conversion against BOTH unique visitors (headline) and sessions (secondary).
//
// Caching: Umami API calls AND the Supabase submission counts are wrapped in unstable_cache
// (~10 min TTL, keyed by estate+window) so a dashboard load doesn't hammer the Umami API
// (rate limits) or Postgres on every render.
//
// Swapping Umami Cloud → self-host later touches only lib/analytics/umami.ts, not this file.

import { unstable_cache } from "next/cache";
import { createSupabaseService } from "@/lib/supabase-service";
import { trackedEstates, type Estate } from "@/data/estates";
import {
  fetchUmamiTraffic,
  isUmamiConfigured,
  windowRange,
  type AnalyticsWindow,
  type TrafficStats,
  type SourceCategory,
  type Breakdown,
} from "./umami";
import { computeConversion } from "./conversion";

export { computeConversion };

const TTL_SECONDS = 600; // 10 min

export interface EstateAnalytics {
  slug: string;
  name: string;
  href: string;
  accent: string;
  /** Umami returned data (false → render "traffic unavailable" for this row). */
  available: boolean;
  traffic: TrafficStats | null;
  sources: Record<SourceCategory, number> | null;
  devices: Breakdown[] | null;
  /** null when the estate has no lot-enquiry funnel → conversion shows N/A. */
  submissions: number | null;
  hasFunnel: boolean;
  /** conversion = submissions / uniques. null when no funnel OR denominator is 0. */
  conversionUniques: number | null;
  /** conversion = submissions / sessions. */
  conversionSessions: number | null;
}

/** Count submissions in an estate's registration table within the window. */
async function countSubmissions(
  table: string,
  startAtMs: number,
  endAtMs: number,
): Promise<number> {
  const supabase = createSupabaseService();
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(startAtMs).toISOString())
    .lte("created_at", new Date(endAtMs).toISOString());
  if (error) throw error;
  return count ?? 0;
}

/** Cached per-estate fetch (Umami + submissions), keyed by slug+window. */
const cachedEstateRow = (estate: Estate, window: AnalyticsWindow) =>
  unstable_cache(
    async (): Promise<EstateAnalytics> => {
      const traffic = await fetchUmamiTraffic(estate.href, window);

      let submissions: number | null = null;
      if (estate.registrationsTable) {
        const { startAt, endAt } = windowRange(window);
        try {
          submissions = await countSubmissions(estate.registrationsTable, startAt, endAt);
        } catch {
          submissions = null; // degrade rather than crash the whole dashboard
        }
      }

      return {
        slug: estate.slug,
        name: estate.shortName,
        href: estate.href,
        accent: estate.accent,
        available: traffic !== null,
        traffic: traffic?.stats ?? null,
        sources: traffic?.sources ?? null,
        devices: traffic?.devices ?? null,
        submissions,
        hasFunnel: Boolean(estate.registrationsTable),
        conversionUniques: computeConversion(submissions, traffic?.stats.uniques),
        conversionSessions: computeConversion(submissions, traffic?.stats.sessions),
      };
    },
    ["analytics", estate.slug, window],
    { revalidate: TTL_SECONDS, tags: ["analytics"] },
  );

/** One estate's analytics row (cached). */
export async function getEstateAnalytics(
  estate: Estate,
  window: AnalyticsWindow,
): Promise<EstateAnalytics> {
  return cachedEstateRow(estate, window)();
}

/** All tracked estates side-by-side for comparison (cached per row). */
export async function getComparison(
  window: AnalyticsWindow,
): Promise<{ configured: boolean; rows: EstateAnalytics[] }> {
  const rows = await Promise.all(
    trackedEstates().map((e) => getEstateAnalytics(e, window)),
  );
  return { configured: isUmamiConfigured(), rows };
}
