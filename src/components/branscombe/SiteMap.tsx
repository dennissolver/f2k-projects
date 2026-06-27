"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  UNITS,
  HOUSE_TYPE_INFO,
  HOUSE_TYPES,
  type HouseType,
  type UnitData,
} from "@/data/branscombe";
import PlanView from "./PlanView";
import UnitBadge from "./UnitBadge";
import UnitInfoCard from "./UnitInfoCard";

// Lazy-load Mapbox satellite — defers loading mapbox-gl (~200KB gzipped) and
// react-map-gl until a user activates the satellite tab.
const SatelliteSitePlan = dynamic(() => import("./SatelliteSitePlan"), {
  ssr: false,
  loading: () => (
    <div
      className="bg-[#0F1419] text-white/60 font-archivo text-sm flex items-center justify-center"
      style={{ height: 600 }}
    >
      Loading satellite imagery…
    </div>
  ),
});

interface UnitCounts {
  [unitId: string]: number;
}

interface AllocationLite {
  unit_number: number;
  allocated_to: string | null;
  dwelling_type: string | null;
  home_type: string | null;
}

interface SiteMapProps {
  selectedUnits: string[];
  onToggleUnit: (unitId: string) => void;
}

type ViewMode = "plan" | "satellite" | "schematic" | "drawing";

const TYPE_FILL: Record<HouseType, string> = {
  "1A": HOUSE_TYPE_INFO["1A"].color,
  "1B": HOUSE_TYPE_INFO["1B"].color,
  "2A": HOUSE_TYPE_INFO["2A"].color,
  "2B": HOUSE_TYPE_INFO["2B"].color,
  "2C": HOUSE_TYPE_INFO["2C"].color,
};

function badgeColors(
  count: number,
  isSelected: boolean,
  isReserved: boolean,
  type: HouseType,
): { bg: string; border: string } {
  if (isReserved) return { bg: "rgba(100, 116, 139, 0.92)", border: "#475569" };
  if (isSelected) return { bg: "rgba(26, 39, 68, 0.95)", border: "#FFFFFF" };
  if (count >= 3) return { bg: "rgba(232, 93, 74, 0.88)", border: "#C0392B" };
  if (count === 2) return { bg: "rgba(200, 169, 81, 0.88)", border: "#B8941A" };
  if (count === 1) return { bg: "rgba(232, 165, 55, 0.88)", border: "#CC8A1E" };
  const info = HOUSE_TYPE_INFO[type];
  return { bg: info.color, border: info.border };
}

/** Layout the 5 type panels into 2 rows: [1A 1B] / [2A 2B 2C]. */
const TYPE_ROWS: HouseType[][] = [
  ["1A", "1B"],
  ["2A", "2B", "2C"],
];

export default function SiteMap({ selectedUnits, onToggleUnit }: SiteMapProps) {
  const [counts, setCounts] = useState<UnitCounts>({});
  const [allocations, setAllocations] = useState<Record<number, AllocationLite>>(
    {},
  );
  const [prices, setPrices] = useState<Record<number, number | null>>({});
  const [openUnitId, setOpenUnitId] = useState<string | null>(null);
  const [hoveredUnit, setHoveredUnit] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("plan");
  const [showInferredLots, setShowInferredLots] = useState(false);

  // On phones, default to the schematic (type-grouped) view: its home pills are
  // 44px tap targets, whereas the spatial plan view packs 37 homes too tightly
  // to tap reliably with a thumb. Desktop keeps the plan view as default.
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches
    ) {
      setViewMode("schematic");
    }
  }, []);

  // Group homes by type for the schematic panels
  const byType = useMemo(() => {
    const m = new Map<HouseType, UnitData[]>();
    for (const u of UNITS) {
      if (!m.has(u.type)) m.set(u.type, []);
      m.get(u.type)!.push(u);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.unitNumber - b.unitNumber);
    }
    return m;
  }, []);

  const fetchCountsAndAllocations = useCallback(async () => {
    try {
      const [countsRes, allocRes, lotsRes] = await Promise.all([
        fetch("/api/branscombe/units"),
        fetch("/api/branscombe/allocations"),
        fetch("/api/branscombe/lots"),
      ]);
      if (countsRes.ok) {
        const data = await countsRes.json();
        setCounts(data.counts || {});
      }
      if (allocRes.ok) {
        const data = await allocRes.json();
        const byNumber: Record<number, AllocationLite> = {};
        for (const a of data.allocations || []) byNumber[a.unit_number] = a;
        setAllocations(byNumber);
      }
      if (lotsRes.ok) {
        const data = await lotsRes.json();
        const byNumber: Record<number, number | null> = {};
        for (const l of data.lots || [])
          byNumber[l.unit_number] = l.retail_price ?? null;
        setPrices(byNumber);
      }
    } catch {
      // silently fail
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchCountsAndAllocations();
  }, [fetchCountsAndAllocations]);

  const hoveredData = hoveredUnit
    ? UNITS.find((u) => u.id === hoveredUnit)
    : null;
  const hoveredInfo = hoveredData ? HOUSE_TYPE_INFO[hoveredData.type] : null;

  return (
    <div className="w-full">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4 text-sm font-archivo">
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            {HOUSE_TYPES.map((type) => (
              <div key={type} className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: TYPE_FILL[type] }}
                />
                <span className="text-slate text-[0.7rem]">{type}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="w-px bg-black/10" />
        {[
          { color: "#E8A537", label: "1 registration" },
          { color: "#C8A951", label: "2 registrations" },
          { color: "#E85D4A", label: "3+" },
          { color: "#1A2744", label: "Your selection" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-slate text-xs">{item.label}</span>
          </div>
        ))}
      </div>

      {/* View mode toggle */}
      <div className="flex items-center gap-2 mb-3">
        <span className="font-archivo text-xs text-slate font-semibold uppercase tracking-wider">
          View:
        </span>
        <div className="inline-flex border-2 border-deep-blue/20 rounded-sm overflow-hidden">
          {(["plan", "satellite", "schematic", "drawing"] as const).map((mode) => {
            const isActive = viewMode === mode;
            const label =
              mode === "plan"
                ? "Plan view"
                : mode === "satellite"
                  ? "Satellite"
                  : mode === "schematic"
                    ? "Schematic"
                    : "Official drawing";
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`font-archivo text-xs px-3 py-1.5 transition-colors ${
                  isActive
                    ? "bg-deep-blue text-white"
                    : "bg-white text-slate hover:bg-deep-blue/5"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {viewMode === "plan" && (
          <span className="font-archivo text-xs text-slate/60 ml-2">
            Vector site plan from Unison 20E92-03 · click a home for details &
            price
          </span>
        )}
        {viewMode === "satellite" && (
          <span className="font-archivo text-xs text-slate/60 ml-2">
            Satellite imagery via Mapbox · click a home for details & price
          </span>
        )}
        {viewMode === "schematic" && (
          <span className="font-archivo text-xs text-slate/60 ml-2">
            Simplified schematic view
          </span>
        )}
        {viewMode === "drawing" && (
          <span className="font-archivo text-xs text-slate/60 ml-2">
            Architectural site plan · authoritative home layout
          </span>
        )}
      </div>

      {/* Official drawing — high-res raster of the architectural site plan, non-interactive */}
      {viewMode === "drawing" && (
        <div className="bg-white border border-black/10 p-3">
          <a
            href="/branscombe/site-plan.jpg"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open the official Branscombe Road site plan in a new tab"
          >
            <img
              src="/branscombe/site-plan.jpg"
              alt="Branscombe Road architectural site plan — official home layout"
              className="w-full h-auto"
              loading="lazy"
            />
          </a>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-archivo text-slate/70">
            <span>
              Source: 122–124 Branscombe Road architectural site plan
              (overlapped concept, 09 Mar 2026)
            </span>
            <a
              href="/branscombe/branscombe-site-plan.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#00B5AD] hover:underline font-semibold"
            >
              Download official PDF →
            </a>
          </div>
          <p className="mt-2 text-xs text-slate/50 font-archivo italic">
            This is the architectural drawing. Home positions here override any
            approximations in the schematic, plan, or satellite views. To
            select a home, switch back to Plan view or Schematic.
          </p>
        </div>
      )}

      {/* Inferred-lot toggle — only relevant for plan + satellite views */}
      {(viewMode === "plan" || viewMode === "satellite") && (
        <label className="flex items-center gap-2 mb-3 cursor-pointer text-xs font-archivo text-slate w-fit">
          <input
            type="checkbox"
            checked={showInferredLots}
            onChange={(e) => setShowInferredLots(e.target.checked)}
            className="w-4 h-4 accent-[#00B5AD]"
          />
          <span>
            Show indicative lot boundaries
            <span className="text-slate/50 ml-1">
              (Voronoi-derived — not legal lot lines)
            </span>
          </span>
        </label>
      )}

      {/* Plan view (default) — vector polygons from the architectural DWG */}
      {viewMode === "plan" && (
        <div style={{ opacity: loaded ? 1 : 0.55 }}>
          <PlanView
            selectedUnits={selectedUnits}
            counts={counts}
            allocations={allocations}
            hoveredUnit={hoveredUnit}
            setHoveredUnit={setHoveredUnit}
            onOpenUnit={setOpenUnitId}
            showInferredLots={showInferredLots}
          />
        </div>
      )}

      {/* Satellite view — Mapbox tiles + GeoJSON polygon overlay */}
      {viewMode === "satellite" && (
        <div style={{ opacity: loaded ? 1 : 0.55 }}>
          <SatelliteSitePlan
            selectedUnits={selectedUnits}
            counts={counts}
            allocations={allocations}
            hoveredUnit={hoveredUnit}
            setHoveredUnit={setHoveredUnit}
            onOpenUnit={setOpenUnitId}
            showInferredLots={showInferredLots}
          />
        </div>
      )}

      {/* Schematic view — type-grouped pill grid (mirrors seafields stage panels) */}
      {viewMode === "schematic" && (
        <div className="space-y-4" style={{ opacity: loaded ? 1 : 0.55 }}>
          {TYPE_ROWS.map((row, ri) => (
            <div key={ri} className="flex flex-col md:flex-row gap-4">
              {row.map((type) => {
                const info = HOUSE_TYPE_INFO[type];
                const homes = byType.get(type) || [];
                if (homes.length === 0) return null;
                const widthClass = row.length === 1 ? "w-full" : "flex-1";
                return (
                  <section
                    key={type}
                    className={`${widthClass} rounded-md border-2 p-3`}
                    style={{
                      backgroundColor: `${info.color}22`,
                      borderColor: info.border,
                    }}
                  >
                    <header className="flex items-center justify-between mb-3">
                      <div>
                        <h3
                          className="font-playfair font-black text-lg leading-none"
                          style={{ color: info.border }}
                        >
                          Type {type}
                        </h3>
                        <p className="font-archivo text-[0.7rem] text-slate/70 mt-0.5">
                          {info.size} home + {info.deck} · {info.beds} bed /{" "}
                          {info.baths} bath
                        </p>
                        {type === "2C" && (
                          <p className="font-archivo text-[0.6rem] text-slate/50 mt-0.5 leading-snug">
                            Unit 31 is approved as 2-bedroom (3-bedroom amendment
                            in preparation).
                          </p>
                        )}
                      </div>
                      <span className="font-archivo text-xs text-slate/70">
                        {homes.length} home{homes.length === 1 ? "" : "s"}
                      </span>
                    </header>
                    <div
                      className="grid gap-2"
                      style={{
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(72px, 1fr))",
                      }}
                    >
                      {homes.map((unit) => {
                        const count = counts[unit.id] || 0;
                        const isSelected = selectedUnits.includes(unit.id);
                        const isHovered = hoveredUnit === unit.id;
                        const isReserved = !!allocations[unit.unitNumber]?.allocated_to;
                        const { bg, border } = badgeColors(
                          count,
                          isSelected,
                          isReserved,
                          unit.type,
                        );
                        const ariaLabel =
                          `${unit.id}, Type ${unit.type}, ${unit.zone}` +
                          (isReserved
                            ? ", reserved"
                            : count > 0
                              ? `, ${count} interested`
                              : "") +
                          (isSelected ? ", selected" : "");
                        return (
                          <UnitBadge
                            key={unit.id}
                            unitNumber={unit.unitNumber}
                            bg={bg}
                            border={border}
                            isSelected={isSelected}
                            isHovered={isHovered}
                            registrationCount={count}
                            onClick={() => setOpenUnitId(unit.id)}
                            onMouseEnter={() => setHoveredUnit(unit.id)}
                            onMouseLeave={() => setHoveredUnit(null)}
                            ariaLabel={ariaLabel}
                          />
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Hover tooltip — works for both views */}
      {hoveredData && hoveredInfo && (
        <div className="mt-4 text-center font-archivo text-sm text-slate bg-white border border-black/5 py-3 px-4">
          <strong className="text-deep-blue">{hoveredData.id}</strong>
          {" — "}
          Type {hoveredData.type} | {hoveredInfo.size} + {hoveredInfo.deck} |{" "}
          {hoveredData.unitNumber === 31 ? 2 : hoveredInfo.beds} bed /{" "}
          {hoveredInfo.baths} bath | {hoveredData.zone} |{" "}
          <span className="font-semibold">
            {counts[hoveredData.id] || 0} registration
            {(counts[hoveredData.id] || 0) !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Click-to-open info card (details + suggested price) */}
      {openUnitId &&
        (() => {
          const unit = UNITS.find((u) => u.id === openUnitId);
          if (!unit) return null;
          const count = counts[unit.id] || 0;
          const isSelected = selectedUnits.includes(unit.id);
          const isReserved = !!allocations[unit.unitNumber]?.allocated_to;
          const { bg, border } = badgeColors(
            count,
            isSelected,
            isReserved,
            unit.type,
          );
          return (
            <UnitInfoCard
              unit={unit}
              registrationCount={count}
              retailPrice={prices[unit.unitNumber] ?? null}
              isReserved={isReserved}
              isSelected={isSelected}
              bg={bg}
              border={border}
              onClose={() => setOpenUnitId(null)}
              onToggle={() => onToggleUnit(unit.id)}
            />
          );
        })()}

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-slate/50 font-archivo">
          Click a home to view its details and price, then add it to your
          registration. Homes are colour-coded by type.
        </p>
        <a
          href="/branscombe/site-plan.jpg"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#00B5AD] hover:underline font-archivo shrink-0 ml-4"
        >
          View full architectural site plan →
        </a>
      </div>
    </div>
  );
}
