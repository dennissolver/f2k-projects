// Umami analytics client adapter (FTK analytics Phase 1).
//
// Consumes the official @umami/api-client (not a hand-rolled fetch). One Umami "website" (bucket)
// for the whole f2k site; per-estate numbers come from filtering by URL path (the estate's `href`).
// Degrades-don't-fakes: env missing or any API error → returns null, and the dashboard renders a
// clean "unavailable" state.
//
// The client is loaded via a DYNAMIC import inside the fetch function so this module's pure helpers
// (windowRange / normaliseReferrer) stay unit-testable without pulling @umami/api-client (and its
// transitive `next`) into the test/runtime graph.
//
// AUTH — @umami/api-client.getClient() takes { apiEndpoint, apiKey, userId, secret } and supports
// TWO mutually-exclusive modes (this file is the only seam):
//   • Umami Cloud  → apiKey  (UMAMI_API_KEY)                         + endpoint https://api.umami.is/v1
//   • Self-hosted  → userId + secret (UMAMI_API_CLIENT_USER_ID /     + endpoint https://<your-umami>/api
//                    UMAMI_API_CLIENT_SECRET, secret === the
//                    Umami instance's APP_SECRET)
// We default to Cloud and switch to self-host automatically when the userId/secret pair is present.

// Endpoint: prefer the package-native UMAMI_API_CLIENT_ENDPOINT, then the legacy aliases, then Cloud.
const API_ENDPOINT =
  process.env.UMAMI_API_CLIENT_ENDPOINT ||
  process.env.UMAMI_API_ENDPOINT ||
  process.env.UMAMI_API_URL ||
  "https://api.umami.is/v1";

// Cloud auth.
const API_KEY = process.env.UMAMI_API_KEY;

// Self-host auth (the f2k-Supabase-backed Umami deploy). secret === the instance's APP_SECRET.
const API_CLIENT_USER_ID = process.env.UMAMI_API_CLIENT_USER_ID;
const API_CLIENT_SECRET = process.env.UMAMI_API_CLIENT_SECRET;

const WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

/** Self-host credentials present → use userId/secret instead of a Cloud apiKey. */
const SELF_HOST = Boolean(API_CLIENT_USER_ID && API_CLIENT_SECRET);

export type AnalyticsWindow = "today" | "month" | "30d" | "all";

export type SourceCategory = "direct" | "email" | "search" | "social" | "referral";

export interface TrafficStats {
  pageviews: number;
  uniques: number; // Umami "visitors"
  sessions: number; // Umami "visits"
}

export interface Breakdown {
  label: string;
  count: number;
}

export interface UmamiTraffic {
  stats: TrafficStats;
  sources: Record<SourceCategory, number>;
  devices: Breakdown[];
}

/**
 * True when the Umami integration is configured (env present). Lets callers degrade cleanly.
 * Configured = a website id PLUS either Cloud auth (apiKey) or self-host auth (userId + secret).
 */
export function isUmamiConfigured(): boolean {
  return Boolean(WEBSITE_ID && (API_KEY || SELF_HOST));
}

/**
 * Resolve a window to a [startAt, endAt] range in epoch-ms.
 * `all` is clamped to ANALYTICS_START_DATE (the day tracking went live) — before that, Umami has
 * no data and dividing historical submissions by ~0 pageviews would produce garbage.
 */
export function windowRange(
  window: AnalyticsWindow,
  now: Date = new Date(),
  startFloor: Date | null = analyticsStartDate(),
): { startAt: number; endAt: number } {
  const endAt = now.getTime();
  let start: Date;
  switch (window) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "30d":
      start = new Date(endAt - 30 * 24 * 60 * 60 * 1000);
      break;
    case "all":
    default:
      start = startFloor ?? new Date(0);
      break;
  }
  if (startFloor && start.getTime() < startFloor.getTime()) {
    start = startFloor;
  }
  return { startAt: start.getTime(), endAt };
}

export function analyticsStartDate(): Date | null {
  const raw = process.env.ANALYTICS_START_DATE;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/** Map a raw referrer string to a coarse source category. */
export function normaliseReferrer(referrer: string | null | undefined): SourceCategory {
  if (!referrer || !referrer.trim()) return "direct";
  const r = referrer.toLowerCase();
  // ⚠️ T1 SPIKE follow-up: most F2K traffic is agent email, which usually arrives with NO
  // referrer (shows as `direct`) unless the link carries UTM. Real email attribution needs
  // utm_source — wire Umami query/utm metrics in the spike and fold it in here.
  if (/mail|gmail|outlook|webmail|yahoo|protonmail/.test(r)) return "email";
  if (/google|bing|duckduckgo|yahoo\.com\/search|ecosia|brave/.test(r)) return "search";
  if (/facebook|instagram|linkedin|twitter|t\.co|tiktok|youtube|reddit|fb\.com/.test(r))
    return "social";
  return "referral";
}

function emptySources(): Record<SourceCategory, number> {
  return { direct: 0, email: 0, search: 0, social: 0, referral: 0 };
}

// --- @umami/api-client (dynamically imported) ---------------------------------------------------
interface UmamiResponse<T> {
  ok: boolean;
  data?: T;
  error?: unknown;
}
type MetricRow = { x: string | null; y: number };
interface UmamiClientLike {
  getWebsiteStats(
    websiteId: string,
    params: Record<string, unknown>,
  ): Promise<
    UmamiResponse<{
      pageviews?: { value: number };
      visitors?: { value: number };
      visits?: { value: number };
    }>
  >;
  getWebsiteMetrics(
    websiteId: string,
    params: Record<string, unknown>,
  ): Promise<UmamiResponse<MetricRow[] | { data: MetricRow[] }>>;
}

let _client: Promise<UmamiClientLike> | null = null;
function umamiClient(): Promise<UmamiClientLike> {
  if (!_client) {
    _client = import("@umami/api-client").then(({ getClient }) => {
      // Self-host: authenticate with userId + secret. Cloud: authenticate with apiKey.
      const options = SELF_HOST
        ? { apiEndpoint: API_ENDPOINT, userId: API_CLIENT_USER_ID, secret: API_CLIENT_SECRET }
        : { apiEndpoint: API_ENDPOINT, apiKey: API_KEY };
      return getClient(options) as unknown as UmamiClientLike;
    });
  }
  return _client;
}

/** Normalise a metrics response (the client may wrap rows in SearchResult.data or return them flat). */
function metricRows(res: UmamiResponse<MetricRow[] | { data: MetricRow[] }> | null): MetricRow[] {
  if (!res?.ok || !res.data) return [];
  const d = res.data;
  if (Array.isArray(d)) return d;
  return Array.isArray(d.data) ? d.data : [];
}

/**
 * Fetch traffic for one estate path over a window. Returns null on any failure (env missing,
 * network, non-ok) so the dashboard renders "traffic unavailable" rather than crashing.
 */
export async function fetchUmamiTraffic(
  estatePath: string,
  window: AnalyticsWindow,
): Promise<UmamiTraffic | null> {
  if (!isUmamiConfigured()) return null;
  const { startAt, endAt } = windowRange(window);
  const base = { startAt, endAt, url: estatePath };

  try {
    const client = await umamiClient();
    const [statsRes, refRes, devRes] = await Promise.all([
      client.getWebsiteStats(WEBSITE_ID as string, base),
      client.getWebsiteMetrics(WEBSITE_ID as string, { ...base, type: "referrer" }),
      client.getWebsiteMetrics(WEBSITE_ID as string, { ...base, type: "device" }),
    ]);

    if (!statsRes?.ok || !statsRes.data) return null;
    const stats = statsRes.data;

    const sources = emptySources();
    for (const row of metricRows(refRes)) {
      sources[normaliseReferrer(row.x)] += Number(row.y) || 0;
    }

    const devices: Breakdown[] = metricRows(devRes).map((row) => ({
      label: row.x || "unknown",
      count: Number(row.y) || 0,
    }));

    return {
      stats: {
        pageviews: Number(stats.pageviews?.value) || 0,
        uniques: Number(stats.visitors?.value) || 0,
        sessions: Number(stats.visits?.value) || 0,
      },
      sources,
      devices,
    };
  } catch {
    return null; // degrade-don't-fake
  }
}
