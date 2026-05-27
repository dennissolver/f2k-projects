"use client";

import { UNIT_BY_ID, HOUSE_TYPE_INFO, type HouseType } from "@/data/branscombe";
import polygonsData from "@/data/branscombe/polygons.json";

type Polygons = {
  viewBox: string;
  siteBoundary: number[][] | null;
  homes: Record<
    string,
    { points: number[][]; type: HouseType; areaM2: number; labelXY: number[] }
  >;
  decks: number[][][];
  pos: number[][][];
  roads: number[][][];
  kerbs: number[][][];
};

const POLYGONS = polygonsData as Polygons;

export interface UnitAllocationLite {
  unit_number: number;
  allocated_to: string | null;
  intent_locked_to_registration_id: string | null;
}

interface Props {
  /** Indexed by unit_number for fast lookup */
  allocations: Record<number, UnitAllocationLite>;
  /** Indexed by unitId (e.g. "U1") — number of waitlist registrations */
  interestCounts: Record<string, number>;
  selectedUnitId: string | null;
  onSelectUnit: (unitId: string, unitNumber: number) => void;
  /** When non-null, only these unitIds are at full opacity; everything else
   * is dimmed. Mirrors the active filter set from the parent table so the
   * map and table stay in lockstep. */
  highlightedUnitIds?: Set<string> | null;
  /** The unit currently hovered in the table — rendered like a selected lot so
   * scanning the register lights up each home on the map (Uwe's reference ask). */
  previewUnitId?: string | null;
}

function pointsToD(pts: number[][]): string {
  if (pts.length === 0) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ") + " Z";
}

type Status = "available" | "interest" | "intent-locked" | "allocated" | "selected";

function statusFor(
  unitId: string,
  unitNumber: number,
  allocations: Record<number, UnitAllocationLite>,
  interestCounts: Record<string, number>,
  isSelected: boolean,
): Status {
  if (isSelected) return "selected";
  const a = allocations[unitNumber];
  if (a?.allocated_to) return "allocated";
  if (a?.intent_locked_to_registration_id) return "intent-locked";
  if ((interestCounts[unitId] || 0) > 0) return "interest";
  return "available";
}

function colorsFor(
  status: Status,
  type: HouseType,
): { fill: string; stroke: string; strokeWidth: number } {
  switch (status) {
    case "selected":
      return { fill: "rgba(26, 39, 68, 0.95)", stroke: "#FFFFFF", strokeWidth: 1.6 };
    case "allocated":
      return { fill: "rgba(126, 34, 206, 0.85)", stroke: "#581c87", strokeWidth: 0.6 };
    case "intent-locked":
      return { fill: "rgba(217, 119, 6, 0.85)", stroke: "#92400e", strokeWidth: 0.6 };
    case "interest":
      return { fill: "rgba(2, 132, 199, 0.78)", stroke: "#075985", strokeWidth: 0.5 };
    case "available":
    default: {
      const info = HOUSE_TYPE_INFO[type];
      return { fill: info.color, stroke: info.border, strokeWidth: 0.4 };
    }
  }
}

export default function AdminUnitMap({
  allocations,
  interestCounts,
  selectedUnitId,
  onSelectUnit,
  highlightedUnitIds,
  previewUnitId,
}: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">
          Site map — click any home to edit
        </span>
        <div className="flex gap-3 text-[10px] text-slate-600">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-purple-700" />
            Allocated
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-600" />
            Soft
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-sky-600" />
            Interest
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#00B5AD]" />
            Available
          </span>
        </div>
      </div>
      <svg
        viewBox={POLYGONS.viewBox}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto block bg-[#FAF8F4]"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Branscombe Estate admin map"
      >
        {POLYGONS.siteBoundary && (
          <path
            d={pointsToD(POLYGONS.siteBoundary)}
            fill="#FFFFFF"
            stroke="#1A2744"
            strokeWidth="1"
          />
        )}
        {POLYGONS.pos.map((pos, i) => (
          <path
            key={`pos-${i}`}
            d={pointsToD(pos)}
            fill="#B8D99B"
            stroke="#6B9B4A"
            strokeWidth="0.5"
            opacity="0.6"
          />
        ))}
        <g stroke="#DDD8CD" strokeWidth="0.35" strokeLinecap="round">
          {POLYGONS.kerbs.map((seg, i) => (
            <line key={`k-${i}`} x1={seg[0][0]} y1={seg[0][1]} x2={seg[1][0]} y2={seg[1][1]} />
          ))}
        </g>
        <g stroke="#B8B0A0" strokeWidth="0.6" strokeLinecap="round">
          {POLYGONS.roads.map((seg, i) => (
            <line key={`r-${i}`} x1={seg[0][0]} y1={seg[0][1]} x2={seg[1][0]} y2={seg[1][1]} />
          ))}
        </g>
        {POLYGONS.decks.map((d, i) => (
          <path
            key={`deck-${i}`}
            d={pointsToD(d)}
            fill="#D6BD96"
            stroke="#A0875A"
            strokeWidth="0.4"
            opacity="0.7"
          />
        ))}
        {Object.entries(POLYGONS.homes).map(([id, h]) => {
          const unit = UNIT_BY_ID[id];
          if (!unit) return null;
          // A hovered (preview) lot renders like the selected one, so pointing
          // at a row in the table lights up that home on the map.
          const isSelected = selectedUnitId === id || previewUnitId === id;
          const status = statusFor(
            id,
            unit.unitNumber,
            allocations,
            interestCounts,
            isSelected,
          );
          const c = colorsFor(status, unit.type);
          const [lx, ly] = h.labelXY;
          const count = interestCounts[id] || 0;
          const a = allocations[unit.unitNumber];
          const isDimmed =
            !!highlightedUnitIds &&
            !highlightedUnitIds.has(id) &&
            !isSelected;
          const isHighlightHit =
            !!highlightedUnitIds &&
            highlightedUnitIds.has(id) &&
            !isSelected;
          const ariaLabel =
            `Unit ${unit.unitNumber} (Type ${unit.type}) — ${
              a?.allocated_to
                ? `allocated to ${a.allocated_to}`
                : a?.intent_locked_to_registration_id
                  ? "soft-allocated"
                  : count > 0
                    ? `${count} interested`
                    : "available"
            }`;
          return (
            <g
              key={id}
              role="button"
              aria-label={ariaLabel}
              tabIndex={0}
              onClick={() => onSelectUnit(id, unit.unitNumber)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectUnit(id, unit.unitNumber);
                }
              }}
              style={{
                cursor: "pointer",
                outline: "none",
                opacity: isDimmed ? 0.18 : 1,
              }}
            >
              <path
                d={pointsToD(h.points)}
                fill={c.fill}
                stroke={isHighlightHit ? "#0F172A" : c.stroke}
                strokeWidth={isHighlightHit ? c.strokeWidth + 0.6 : c.strokeWidth}
                opacity={0.94}
              />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="5"
                fontWeight="700"
                fill="#FFFFFF"
                stroke="#000000"
                strokeWidth="0.15"
                paintOrder="stroke"
                fontFamily="sans-serif"
                pointerEvents="none"
              >
                {unit.unitNumber}
              </text>
              {count > 0 &&
                status !== "selected" &&
                status !== "allocated" &&
                status !== "intent-locked" && (
                  <g pointerEvents="none">
                    <circle cx={lx + 8} cy={ly - 5} r="2.5" fill="#1A2744" />
                    <text
                      x={lx + 8}
                      y={ly - 4.5}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="3"
                      fontWeight="700"
                      fill="#FFFFFF"
                      fontFamily="sans-serif"
                    >
                      {count}
                    </text>
                  </g>
                )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
