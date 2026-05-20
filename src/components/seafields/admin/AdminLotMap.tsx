"use client";

import { useMemo } from "react";
import {
  LOTS,
  STAGE_INFO,
  type LotStage,
} from "@/data/seafields";
import polygonsData from "@/data/seafields/polygons.json";

type Polygons = {
  viewBox: string;
  subjectArea: number[][] | null;
  parentLots: number[][][];
  pos: number[][] | null;
  lots: Record<string, number[][]>;
  heritageLots: Record<string, number[][]>;
  amendments: Record<string, number[][]>;
  buildableEnvelopes: Record<string, { points: number[][]; areaM2: number }>;
  roads: number[][][];
  roadReserves: number[][][];
  streetLabels: { text: string; x: number; y: number; rotation: number }[];
};

const POLYGONS = polygonsData as Polygons;

export interface LotAllocationLite {
  lot_number: number;
  allocated_to: string | null;
  intent_locked_to_registration_id: string | null;
  status:
    | "available"
    | "reserved"
    | "withheld"
    | "sold"
    | "backup_list_only"
    | null;
  allocation_bucket:
    | "public"
    | "groh"
    | "baurimus"
    | "takken"
    | "wachs"
    | "f2k_withheld"
    | "display_home"
    | "heritage_retained"
    | null;
}

export interface LotInterestCount {
  lot_id: string;
  count: number;
}

interface Props {
  /** Indexed by lot_number for fast lookup */
  allocations: Record<number, LotAllocationLite>;
  /** Indexed by lot_id (e.g. "L240") — number of waitlist registrations */
  interestCounts: Record<string, number>;
  selectedLotId: string | null;
  onSelectLot: (lotId: string, lotNumber: number) => void;
}

function pointsToD(pts: number[][]): string {
  if (pts.length === 0) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ") + " Z";
}

function centroid(pts: number[][]): { x: number; y: number } {
  const x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const y = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return { x, y };
}

/**
 * Resolve display state for an admin map lot. Priority is hard → soft:
 *   "sold"             — closed allocation, locked
 *   "withheld"         — withheld from sale (F2K / heritage / display)
 *   "allocated"        — firm allocation (named buyer OR non-public pool)
 *   "reserved"         — status=reserved (held but not yet sold)
 *   "intent-locked"    — pinned to a specific registrant (soft-allocate)
 *   "interest"         — registrants waitlisting but no allocation/lock
 *   "available"        — open
 *   "selected"         — currently focused in the editor (overrides above)
 */
function statusFor(
  lotId: string,
  lotNumber: number,
  allocations: Record<number, LotAllocationLite>,
  interestCounts: Record<string, number>,
  isSelected: boolean,
):
  | "available"
  | "interest"
  | "intent-locked"
  | "reserved"
  | "allocated"
  | "withheld"
  | "sold"
  | "selected" {
  if (isSelected) return "selected";
  const a = allocations[lotNumber];
  if (a?.status === "sold") return "sold";
  if (a?.status === "withheld") return "withheld";
  if (
    a?.allocated_to ||
    (a?.allocation_bucket && a.allocation_bucket !== "public")
  )
    return "allocated";
  if (a?.status === "reserved") return "reserved";
  if (a?.intent_locked_to_registration_id) return "intent-locked";
  if ((interestCounts[lotId] || 0) > 0) return "interest";
  return "available";
}

const STATUS_FILL: Record<
  ReturnType<typeof statusFor>,
  { fill: string; stroke: string }
> = {
  available:      { fill: "#F4F4F2", stroke: "#94A3B8" }, // light grey, not noisy
  interest:       { fill: "#BAE6FD", stroke: "#0369A1" }, // sky blue
  "intent-locked":{ fill: "#FCD34D", stroke: "#B45309" }, // amber
  reserved:       { fill: "#FDE68A", stroke: "#92400E" }, // yellow — held but not closed
  allocated:      { fill: "#C4B5FD", stroke: "#5B21B6" }, // purple
  withheld:       { fill: "#CBD5E1", stroke: "#475569" }, // slate-grey — off-market
  sold:           { fill: "#86EFAC", stroke: "#166534" }, // green — done
  selected:       { fill: "#1A2744", stroke: "#FFFFFF" }, // navy with white
};

export default function AdminLotMap({
  allocations,
  interestCounts,
  selectedLotId,
  onSelectLot,
}: Props) {
  const lotById = useMemo(
    () => new globalThis.Map(LOTS.map((l) => [l.id, l] as const)),
    [],
  );

  const finalLotPolys = useMemo(() => {
    const out: Array<[string, number[][]]> = [];
    for (const [id, pts] of Object.entries(POLYGONS.lots)) {
      out.push([id, POLYGONS.amendments[id] || pts]);
    }
    return out;
  }, []);

  return (
    <div className="relative w-full bg-[#FAF8F4] border border-slate-200 rounded overflow-hidden">
      <svg
        viewBox={POLYGONS.viewBox}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto block"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern
            id="adminHeritageHatch"
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill="#F5E7D6" />
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="6"
              stroke="#C7A877"
              strokeWidth="1.5"
            />
          </pattern>
        </defs>

        {POLYGONS.subjectArea && (
          <path
            d={pointsToD(POLYGONS.subjectArea)}
            fill="#FFFFFF"
            stroke="#1A2744"
            strokeWidth="1"
          />
        )}

        {POLYGONS.pos && (
          <g>
            <path
              d={pointsToD(POLYGONS.pos)}
              fill="#B8D99B"
              stroke="#6B9B4A"
              strokeWidth="0.6"
            />
          </g>
        )}

        <g stroke="#B8B0A0" strokeWidth="0.5">
          {POLYGONS.roads.map((seg, i) => (
            <line
              key={`road-${i}`}
              x1={seg[0][0]}
              y1={seg[0][1]}
              x2={seg[1][0]}
              y2={seg[1][1]}
            />
          ))}
        </g>

        {finalLotPolys.map(([id, pts]) => {
          const lot = lotById.get(id);
          if (!lot) return null;
          const isSelected = selectedLotId === id;
          const status = statusFor(
            id,
            lot.lotNumber,
            allocations,
            interestCounts,
            isSelected,
          );
          const colors = STATUS_FILL[status];
          const c = centroid(pts);
          return (
            <g
              key={id}
              role="button"
              aria-label={`Lot ${lot.lotNumber} — ${status}`}
              tabIndex={0}
              onClick={() => onSelectLot(id, lot.lotNumber)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectLot(id, lot.lotNumber);
                }
              }}
              style={{ cursor: "pointer", outline: "none" }}
            >
              <path
                d={pointsToD(pts)}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={isSelected ? 1.5 : 0.5}
              />
              <text
                x={c.x}
                y={c.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="5.2"
                fontWeight="700"
                fill={isSelected ? "#FFFFFF" : "#1A2744"}
                fontFamily="Archivo, system-ui, sans-serif"
                pointerEvents="none"
              >
                {lot.lotNumber}
              </text>
            </g>
          );
        })}

        {Object.entries(POLYGONS.heritageLots).map(([id, pts]) => {
          const lot = lotById.get(id);
          const c = centroid(pts);
          return (
            <g key={`heritage-${id}`} aria-label={`Heritage lot ${lot?.lotNumber}`}>
              <path
                d={pointsToD(pts)}
                fill="url(#adminHeritageHatch)"
                stroke="#8B6F1E"
                strokeWidth="0.7"
                strokeDasharray="2 1.5"
              />
              {lot && (
                <text
                  x={c.x}
                  y={c.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="5.2"
                  fontWeight="700"
                  fill="#5E4A0E"
                  fontFamily="Archivo, system-ui, sans-serif"
                  pointerEvents="none"
                >
                  {lot.lotNumber}
                </text>
              )}
            </g>
          );
        })}

        {POLYGONS.streetLabels.map((s, i) => (
          <text
            key={`street-${i}`}
            x={s.x}
            y={s.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="6.5"
            fontWeight="700"
            fill="#1A2744"
            fontFamily="Archivo, system-ui, sans-serif"
            letterSpacing="1"
            pointerEvents="none"
            transform={
              s.rotation
                ? `rotate(${-s.rotation} ${s.x} ${s.y})`
                : undefined
            }
            style={{ textShadow: "0 0 2px rgba(255,255,255,0.9)" }}
          >
            {s.text}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded border border-slate-200 px-3 py-2 text-[11px] font-medium text-slate-700 shadow-sm">
        <div className="flex flex-col gap-1">
          {([
            ["available", "Available"],
            ["interest", "Has interest"],
            ["intent-locked", "Soft-allocated"],
            ["reserved", "Reserved"],
            ["allocated", "Allocated"],
            ["withheld", "Withheld"],
            ["sold", "Sold"],
          ] as const).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-sm border"
                style={{
                  backgroundColor: STATUS_FILL[key].fill,
                  borderColor: STATUS_FILL[key].stroke,
                }}
              />
              <span>{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
            <span
              className="inline-block w-3 h-3 rounded-sm border"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, #C7A877 0 1.5px, #F5E7D6 1.5px 4px)",
                borderColor: "#8B6F1E",
              }}
            />
            <span>Heritage</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-2 right-2 text-[10px] text-slate-500 bg-white/80 px-2 py-0.5 rounded">
        CLE 3027-08B · click a lot to edit
      </div>
    </div>
  );
}
