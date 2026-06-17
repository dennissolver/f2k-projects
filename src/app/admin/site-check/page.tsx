"use client";

import { useState } from "react";

// Reusable estate site-check: feed an address, run @caistech/property-services in prod, see the
// first-pass planning + environment analysis (LGA, zoning, wind/BAL/climate, overlays, max-lots) to
// surface on the estate page. Prefilled with Dutton Terrace's corrected coords so it runs as-is.

interface PropertyCheck {
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
}

const DUTTON_DEFAULTS = {
  suburb: "Tumby Bay",
  postcode: "5605",
  state: "SA",
  lat: "-34.379268",
  lng: "136.095408",
  lotPlanReference: "Allotment 50, Deposited Plan 90582",
};

export default function SiteCheckPage() {
  const [form, setForm] = useState(DUTTON_DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PropertyCheck | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/site-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suburb: form.suburb,
          postcode: form.postcode,
          state: form.state,
          lat: form.lat || null,
          lng: form.lng || null,
          lotPlanReference: form.lotPlanReference,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `Request failed (${res.status})`);
      } else {
        setResult(json.result as PropertyCheck);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded border border-slate-300 px-3 py-2 text-base focus:border-slate-500 focus:outline-none";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1";

  const row = (label: string, value: string | number | null | undefined) =>
    value || value === 0 ? (
      <div className="flex border-b border-slate-100 py-2">
        <span className="w-44 shrink-0 text-sm text-slate-500">{label}</span>
        <span className="text-sm font-medium text-slate-900">{String(value)}</span>
      </div>
    ) : null;

  return (
    <div className="max-w-3xl">
      {/* Explanatory header (§5) */}
      <h2 className="text-xl font-semibold text-slate-900">Estate site check</h2>
      <p className="mt-1 mb-6 max-w-prose text-sm text-slate-600">
        Run an automated first-pass site analysis for an estate address. It queries our
        property-services (LGA / council, zoning, wind &amp; bushfire, climate, overlays, indicative
        max-lots) so you can surface what&apos;s possible on the estate page. Pass the precise
        latitude/longitude (from the address autocomplete) to skip geocoding and avoid the wrong-state
        misfire. Read-only — nothing is saved.
      </p>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass}>Suburb / locality *</label>
            <input className={inputClass} value={form.suburb} onChange={set("suburb")} placeholder="Tumby Bay" />
          </div>
          <div>
            <label className={labelClass}>State</label>
            <input className={inputClass} value={form.state} onChange={set("state")} placeholder="SA" />
          </div>
          <div>
            <label className={labelClass}>Postcode</label>
            <input className={inputClass} value={form.postcode} onChange={set("postcode")} placeholder="5605" />
          </div>
          <div>
            <label className={labelClass}>Latitude</label>
            <input className={inputClass} value={form.lat} onChange={set("lat")} placeholder="-34.379268" />
          </div>
          <div>
            <label className={labelClass}>Longitude</label>
            <input className={inputClass} value={form.lng} onChange={set("lng")} placeholder="136.095408" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Lot / plan reference (optional)</label>
            <input className={inputClass} value={form.lotPlanReference} onChange={set("lotPlanReference")} placeholder="Allotment 50, Deposited Plan 90582" />
          </div>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading || !form.suburb.trim()}
          className="mt-5 w-full rounded bg-[#1A2744] px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-[#243556] disabled:opacity-50 sm:w-auto"
        >
          {loading ? "Running site check…" : "Run site check"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded border-l-4 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          {result.status === "ok" && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Site analysis</h3>
                <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">OK</span>
              </div>
              {row("Address used", result.address)}
              {row("LGA / council", result.lga_name ? `${result.lga_name}${result.lga_coverage && result.lga_coverage !== "full" ? ` (${result.lga_coverage} coverage)` : ""}` : null)}
              {row("Zoning", result.zoning_code ? `${result.zoning_code}${result.zoning_name ? ` — ${result.zoning_name}` : ""}` : null)}
              {row("Subdivision permitted", result.subdivision_permitted == null ? null : result.subdivision_permitted ? "Yes" : "No")}
              {row("Indicative max lots (Torrens)", result.max_lots)}
              {row("Wind region", result.wind_region ? `${result.wind_region}${result.wind_speed ? ` (${result.wind_speed} m/s)` : ""}` : null)}
              {row("Bushfire (BAL)", result.bal)}
              {row("Climate zone", result.climate_zone)}
              {row("Overlays", (result.overlays ?? []).map((o) => o.name + (o.requiresReport ? " (report required)" : "")).join(", ") || null)}
              {result.summary && <p className="mt-3 text-sm text-slate-600">{result.summary}</p>}
            </>
          )}
          {result.status === "error" && (
            <div className="text-sm text-amber-800">
              <p className="font-medium">Couldn&apos;t complete the site check.</p>
              <p className="mt-1">{result.reason}</p>
              {result.address && <p className="mt-1 text-slate-500">Address tried: {result.address}</p>}
            </div>
          )}
          {result.status === "skipped" && (
            <div className="text-sm text-slate-600">
              <p className="font-medium">Site check skipped.</p>
              <p className="mt-1">{result.reason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
