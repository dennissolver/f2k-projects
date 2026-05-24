"use client";

import { useEffect, useState } from "react";

interface Lot {
  lot_number: number;
  sqm: number | null;
  category: string | null;
  zone: string | null;
  status: string | null;
  stage_number: number | null;
  stage_label: string | null;
  is_open_for_registration: boolean;
  total_price: number | null;
}

const STATUS_BADGE: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-800 border-emerald-300",
  reserved: "bg-amber-100 text-amber-800 border-amber-300",
  sold: "bg-slate-200 text-slate-800 border-slate-400",
  withheld: "bg-rose-100 text-rose-800 border-rose-300",
  backup_list_only: "bg-sky-100 text-sky-800 border-sky-300",
};

function fmt(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function AvailabilityPage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/agent/availability");
        if (res.ok) setLots((await res.json()).lots || []);
        else setError("Couldn't load availability.");
      } catch {
        setError("Network error.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const shown = openOnly ? lots.filter((l) => l.is_open_for_registration) : lots;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Lot Availability</h1>
      <p className="text-sm text-slate-500 mb-4 max-w-2xl">
        Live status for every lot at Seafields Estate. You can see whether a lot is
        available, reserved or sold and its listed price — buyer details for lots
        held by others stay private.
      </p>

      <label className="inline-flex items-center gap-2 text-sm text-slate-600 mb-4">
        <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="h-4 w-4" />
        Show only lots open for registration
      </label>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
      )}

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="grid grid-cols-1 sm:hidden gap-2">
            {shown.map((l) => (
              <div key={l.lot_number} className="border border-slate-200 rounded-lg p-3 bg-white">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Lot {l.lot_number}</span>
                  <span className="text-sm text-slate-500">{l.sqm}m²</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs">
                  <span className={`border px-2 py-0.5 rounded font-semibold ${STATUS_BADGE[l.status || ""] || "bg-slate-100 text-slate-700 border-slate-300"}`}>
                    {(l.status || "—").replace(/_/g, " ")}
                  </span>
                  {l.stage_number && <span className="text-slate-500">Stage {l.stage_number}</span>}
                  {l.is_open_for_registration && <span className="text-emerald-700">open</span>}
                </div>
                <div className="text-sm font-semibold text-slate-800 mt-2">{fmt(l.total_price)}</div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block border border-slate-200 rounded-lg overflow-x-auto bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Lot</th>
                  <th className="px-3 py-2 text-left">Size</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Stage</th>
                  <th className="px-3 py-2 text-left">Open</th>
                  <th className="px-3 py-2 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.lot_number} className="border-t">
                    <td className="px-3 py-2 font-semibold">{l.lot_number}</td>
                    <td className="px-3 py-2">{l.sqm}m²</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block border px-2 py-0.5 rounded text-xs font-semibold ${STATUS_BADGE[l.status || ""] || "bg-slate-100 text-slate-700 border-slate-300"}`}>
                        {(l.status || "—").replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3 py-2">{l.stage_number ? `S${l.stage_number}` : "—"}</td>
                    <td className="px-3 py-2">{l.is_open_for_registration ? "✓" : "—"}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(l.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
