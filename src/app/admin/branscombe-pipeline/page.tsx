// @explanatory-header-exempt — nested workflow page; entry-point header lives on the parent surface
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  UNITS,
  HOUSE_TYPE_INFO,
  HOUSE_TYPES,
  type HouseType,
} from "@/data/branscombe";
import { NotifyRecipientsCard } from "@caistech/property-launch-kit/components";

interface Allocation {
  unit_number: number;
  home_type: string;
  area_m2: number;
  allocated_to: string | null;
  dwelling_type: string | null;
  notes: string | null;
  wholesale_price: number | null;
  retail_price: number | null;
  intent_locked_to_registration_id: string | null;
}

function fmtAUD(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function BranscombePipelinePage() {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [allocRes, countsRes] = await Promise.all([
          fetch("/api/admin/branscombe/allocations"),
          fetch("/api/admin/branscombe/units"),
        ]);
        if (!allocRes.ok) {
          setError("Failed to load allocations");
        } else {
          const data = await allocRes.json();
          setAllocations(data.allocations || []);
        }
        if (countsRes.ok) {
          const data = await countsRes.json();
          setInterestCounts(data.counts || {});
        }
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allocByNumber = useMemo(() => {
    const m: Record<number, Allocation> = {};
    for (const a of allocations) m[a.unit_number] = a;
    return m;
  }, [allocations]);

  const enriched = useMemo(() => {
    return UNITS.map((unit) => {
      const alloc = allocByNumber[unit.unitNumber];
      const interest = interestCounts[unit.id] || 0;
      const status: "allocated" | "soft" | "interest" | "available" =
        alloc?.allocated_to
          ? "allocated"
          : alloc?.intent_locked_to_registration_id
            ? "soft"
            : interest > 0
              ? "interest"
              : "available";
      return { unit, alloc, interest, status };
    });
  }, [allocByNumber, interestCounts]);

  const totals = useMemo(() => {
    const totalUnits = enriched.length;
    const allocated = enriched.filter((e) => e.status === "allocated").length;
    const soft = enriched.filter((e) => e.status === "soft").length;
    const withInterest = enriched.filter((e) => e.interest > 0).length;
    const totalRegistrations = Object.values(interestCounts).reduce(
      (s, n) => s + n,
      0,
    );
    const oversub = totalUnits > 0 ? totalRegistrations / totalUnits : 0;
    return {
      totalUnits,
      allocated,
      soft,
      withInterest,
      totalRegistrations,
      oversubscriptionRatio: oversub,
    };
  }, [enriched, interestCounts]);

  const typeBreakdown = useMemo(() => {
    return HOUSE_TYPES.map((t) => {
      const inType = enriched.filter((e) => e.unit.type === t);
      const units = inType.length;
      const allocated = inType.filter((e) => e.status === "allocated").length;
      const soft = inType.filter((e) => e.status === "soft").length;
      const interest = inType.reduce((sum, e) => sum + e.interest, 0);
      const ratio = units > 0 ? interest / units : 0;
      return {
        type: t,
        info: HOUSE_TYPE_INFO[t],
        units,
        allocated,
        soft,
        interest,
        ratio,
      };
    });
  }, [enriched]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">
        Branscombe Pipeline
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        Demand snapshot for the 37-home Branscombe Estate. For funder reporting
        and commercial planning. Numbers reflect waitlist registrations + admin
        allocations as of now.
      </p>

      <NotifyRecipientsCard
        apiEndpoint="/api/admin/branscombe/notify-recipients"
        description="Who gets emailed on new Branscombe registrations, unit changes, and the daily digest."
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {/* Top-line metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <Metric label="Total homes" value={totals.totalUnits} />
        <Metric label="Allocated" value={totals.allocated} tint="purple" />
        <Metric label="Soft-allocated" value={totals.soft} tint="amber" />
        <Metric
          label="Homes with interest"
          value={totals.withInterest}
          tint="sky"
        />
        <Metric
          label="Total registrations"
          value={totals.totalRegistrations}
          tint="emerald"
        />
        <Metric
          label="Interest / home"
          value={`${totals.oversubscriptionRatio.toFixed(2)}×`}
          tint="emerald"
          subtitle={
            totals.oversubscriptionRatio >= 1 ? "oversubscribed" : "below par"
          }
        />
      </div>

      {/* Per-type breakdown */}
      <h3 className="text-lg font-semibold text-slate-900 mb-2">By type</h3>
      <div className="bg-white border rounded mb-8 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-right">Homes</th>
              <th className="px-3 py-2 text-right">Allocated</th>
              <th className="px-3 py-2 text-right">Soft</th>
              <th className="px-3 py-2 text-right">Interest</th>
              <th className="px-3 py-2 text-right">Ratio</th>
              <th className="px-3 py-2 text-left">Saturation</th>
            </tr>
          </thead>
          <tbody>
            {typeBreakdown.map((s) => {
              const oversub = s.ratio >= 1;
              const barWidth = Math.min(100, s.ratio * 50);
              return (
                <tr key={s.type} className="border-t hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <span
                      className="inline-block px-2 py-0.5 rounded border text-xs font-semibold mr-2"
                      style={{
                        backgroundColor: `${s.info.color}22`,
                        borderColor: s.info.border,
                        color: s.info.border,
                      }}
                    >
                      Type {s.type}
                    </span>
                    <span className="text-slate-600 text-xs">
                      {s.info.size} home + {s.info.deck}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {s.units}
                  </td>
                  <td className="px-3 py-2 text-right text-purple-700">
                    {s.allocated || "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-amber-600">
                    {s.soft || "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-sky-700 font-semibold">
                    {s.interest}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-bold ${
                      oversub ? "text-emerald-700" : "text-slate-500"
                    }`}
                  >
                    {s.ratio.toFixed(2)}×
                  </td>
                  <td className="px-3 py-2">
                    <div className="bg-slate-100 rounded-full h-2 w-32 overflow-hidden">
                      <div
                        className={
                          oversub ? "bg-emerald-500 h-2" : "bg-sky-400 h-2"
                        }
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Per-unit table */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-slate-900">
          By home — full register
        </h3>
        <span className="text-xs text-slate-500">
          Sorted by interest count, descending
        </span>
      </div>
      <div className="bg-white border rounded overflow-x-auto">
        {loading ? (
          <div className="p-6 text-slate-500">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">Unit</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">m²</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Allocated to</th>
                <th className="px-3 py-2 text-right">Interest</th>
                <th className="px-3 py-2 text-right">Wholesale</th>
                <th className="px-3 py-2 text-right">Retail</th>
              </tr>
            </thead>
            <tbody>
              {enriched
                .slice()
                .sort((a, b) => {
                  if (b.interest !== a.interest)
                    return b.interest - a.interest;
                  return a.unit.unitNumber - b.unit.unitNumber;
                })
                .map(({ unit, alloc, interest, status }) => {
                  const info = HOUSE_TYPE_INFO[unit.type as HouseType];
                  return (
                    <tr key={unit.id} className="border-t hover:bg-slate-50">
                      <td className="px-3 py-2 font-semibold">{unit.id}</td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold"
                          style={{
                            backgroundColor: `${info.color}22`,
                            borderColor: info.border,
                            color: info.border,
                          }}
                        >
                          {unit.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {alloc?.area_m2 ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {status === "allocated" && (
                          <span className="inline-block bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-[11px] font-medium">
                            Allocated
                          </span>
                        )}
                        {status === "soft" && (
                          <span className="inline-block bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[11px] font-medium">
                            Soft
                          </span>
                        )}
                        {status === "interest" && (
                          <span className="inline-block bg-sky-100 text-sky-800 px-2 py-0.5 rounded text-[11px] font-medium">
                            Interest
                          </span>
                        )}
                        {status === "available" && (
                          <span className="text-slate-400 text-[11px]">
                            Available
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {alloc?.allocated_to || (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {interest > 0 ? (
                          <span className="font-semibold text-sky-700">
                            {interest}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {fmtAUD(alloc?.wholesale_price)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {fmtAUD(alloc?.retail_price)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tint,
  subtitle,
}: {
  label: string;
  value: string | number;
  tint?: "purple" | "amber" | "sky" | "emerald";
  subtitle?: string;
}) {
  const colour = {
    purple: "text-purple-700",
    amber: "text-amber-600",
    sky: "text-sky-700",
    emerald: "text-emerald-700",
  }[tint ?? ("none" as never)];
  return (
    <div className="bg-white border rounded p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`text-2xl font-bold ${
          colour || "text-slate-900"
        } leading-tight mt-0.5`}
      >
        {value}
      </div>
      {subtitle && (
        <div className="text-[10px] text-slate-500 mt-0.5">{subtitle}</div>
      )}
    </div>
  );
}
