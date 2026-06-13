import { createPropertyServices } from "@caistech/property-services-sdk";

/**
 * Kickstart property analysis for a developer-onboarding lead.
 *
 * Calls @caistech/property-services (derive) for the enquiry's location and returns a flat,
 * storable summary (wind region/speed, BAL bushfire, climate zone, LGA, zoning, overlays, and
 * the torrens subdivision yield) — the first-pass site DD that lands WITH the enquiry.
 *
 * Best-effort by contract: env-gated, time-bounded, and never throws — a failure returns a
 * {status:'skipped'|'error'} record so the onboarding submission is never blocked.
 *
 * Note: property-services derive is geocode/address-driven. We geocode by locality
 * (suburb + postcode), folding the lot/plan reference into the address string to help parcel
 * resolution where the geocoder supports it. Locality-level coverage always returns the
 * wind/bushfire/climate layer; zoning + LGA + maxLots fill in where property-services has LGA
 * coverage. Parcel-precise lookups (from a full street address / title) are a later refinement.
 */

export interface PropertyCheck {
  status: "ok" | "skipped" | "error";
  ran_at: string;
  address?: string;
  reason?: string;
  summary?: string | null;
  wind_region?: string | null;
  wind_speed?: number | null;
  bal?: string | null;
  climate_zone?: string | null;
  lga_name?: string | null;
  lga_coverage?: string | null;
  zoning_code?: string | null;
  zoning_name?: string | null;
  subdivision_permitted?: boolean | null;
  max_lots?: number | null;
  overlays?: Array<{ type: string; name: string; requiresReport: boolean }>;
  data?: unknown;
}

interface LeadLocation {
  estate_location?: string | null;
  estate_postcode?: string | null;
  lot_plan_reference?: string | null;
}

export async function runPropertyCheck(
  lead: LeadLocation,
  timeoutMs = 25_000,
): Promise<PropertyCheck> {
  const ran_at = new Date().toISOString();
  // Accept either the server-side names or the portfolio's NEXT_PUBLIC_* convention
  // (DealFindrs / mmcbuild use the prefixed names) so whichever is set on Vercel works.
  const supabaseUrl =
    process.env.PROPERTY_SERVICES_URL || process.env.NEXT_PUBLIC_PROPERTY_SERVICES_URL;
  const apiKey =
    process.env.PROPERTY_SERVICES_API_KEY ||
    process.env.NEXT_PUBLIC_PROPERTY_SERVICES_API_KEY;

  if (!supabaseUrl || !apiKey) {
    return { status: "skipped", ran_at, reason: "property-services env not configured" };
  }
  const suburb = lead.estate_location?.trim();
  const postcode = lead.estate_postcode?.trim();
  if (!suburb) {
    return { status: "skipped", ran_at, reason: "no location to geocode" };
  }

  // Geocodable string: lot/plan ref (helps parcel resolution) + locality.
  const address = [lead.lot_plan_reference?.trim(), suburb, postcode, "Australia"]
    .filter(Boolean)
    .join(", ");

  const client = createPropertyServices({ supabaseUrl, apiKey, product: "f2k" });

  try {
    const res = (await Promise.race([
      client.derive({ address, suburb, postcode: postcode || undefined }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs),
      ),
    ])) as Awaited<ReturnType<typeof client.derive>>;

    if (!res?.success || !res.data) {
      return { status: "error", ran_at, address, reason: res?.error || "derive returned no data" };
    }
    const d = res.data;
    return {
      status: "ok",
      ran_at,
      address,
      summary: d.summary ?? null,
      wind_region: d.environment?.windRegion ?? null,
      wind_speed: d.environment?.windSpeed ?? null,
      bal: d.environment?.bal ?? null,
      climate_zone: d.environment?.climateZone ?? null,
      lga_name: d.metadata?.lgaName ?? null,
      lga_coverage: d.metadata?.lgaCoverage ?? null,
      zoning_code: d.zoning?.code ?? null,
      zoning_name: d.zoning?.name ?? null,
      subdivision_permitted: d.zoning?.subdivisionPermitted ?? null,
      max_lots: d.subdivision?.torrens?.maxLots ?? null,
      overlays: (d.overlays ?? []).map((o) => ({
        type: o.type,
        name: o.name,
        requiresReport: o.requiresReport,
      })),
      data: d,
    };
  } catch (err) {
    return {
      status: "error",
      ran_at,
      address,
      reason: err instanceof Error ? err.message : "derive failed",
    };
  }
}

/** Render the property check as an admin-email HTML block (returns "" when nothing useful). */
export function propertyCheckEmailBlock(
  pc: PropertyCheck | null | undefined,
  escapeHtml: (v: string | null | undefined) => string,
): string {
  if (!pc || pc.status === "skipped") return "";
  if (pc.status === "error") {
    return `<h3 style="color:#1A2744;font-size:14px;margin:20px 0 4px">Property check</h3>
      <p style="font-size:13px;color:#9b6b00">Couldn't run automatically (${escapeHtml(pc.reason)}). Worth a manual look.</p>`;
  }
  const row = (label: string, value: string | number | null | undefined) =>
    value || value === 0
      ? `<tr><td style="padding:3px 12px;color:#666;vertical-align:top">${label}</td><td style="padding:3px 12px;color:#1A2744">${escapeHtml(String(value))}</td></tr>`
      : "";
  const overlays = (pc.overlays ?? [])
    .map((o) => o.name + (o.requiresReport ? " (report required)" : ""))
    .join(", ");
  return `
    <h3 style="color:#1A2744;font-size:14px;margin:20px 0 4px">Property check <span style="color:#999;font-weight:normal">(auto, first-pass)</span></h3>
    <table style="border-collapse:collapse;font-size:13px;width:100%">
      ${row("Wind region", pc.wind_region ? `${pc.wind_region}${pc.wind_speed ? ` (${pc.wind_speed} m/s)` : ""}` : null)}
      ${row("Bushfire (BAL)", pc.bal)}
      ${row("Climate zone", pc.climate_zone)}
      ${row("LGA / council", pc.lga_name ? `${pc.lga_name}${pc.lga_coverage && pc.lga_coverage !== "full" ? ` (${pc.lga_coverage} coverage)` : ""}` : null)}
      ${row("Zoning", pc.zoning_code ? `${pc.zoning_code}${pc.zoning_name ? ` — ${pc.zoning_name}` : ""}` : null)}
      ${row("Subdivision permitted", pc.subdivision_permitted == null ? null : pc.subdivision_permitted ? "Yes" : "No")}
      ${row("Est. max lots (Torrens)", pc.max_lots)}
      ${row("Overlays", overlays)}
    </table>
    ${pc.summary ? `<p style="font-size:12px;color:#4A5568;margin:6px 0 0">${escapeHtml(pc.summary)}</p>` : ""}`;
}
