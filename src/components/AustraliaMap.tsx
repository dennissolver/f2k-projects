"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  publicEstates,
  STATE_COLORS,
  STATE_NAMES,
  ALL_STATE_ABBRS,
  estatesInState,
  pinnedEstates,
  activeStateAbbrs,
  type StateAbbr,
} from "@/data/estates";
import { AUSTRALIA, projectLngLat } from "@/lib/australia-map";

/**
 * AustraliaMap — the landing-page front door.
 *
 * A stylised inline-SVG choropleth of Australia: every state is a clickable polygon (its own
 * "state colour"); every estate with coords is a pin at its real location. Click a state → that
 * state's page; click a pin → that estate. Co-located estates (e.g. Seafields + Wavecrest, both
 * Waggrakine) are fanned out so they don't stack. Polygons + pins share ONE Mercator projection
 * (src/lib/australia-map.ts), so pins always sit in the right state.
 *
 * Accessibility / SEO: the SVG is interactive (pointer + keyboard), and a visually-hidden list of
 * real <Link>s mirrors every destination so the map is crawlable and usable without JS.
 */

const MUTED_FILL = "#D8D2C6"; // states with no estate yet
const stateHref = (abbr: string) => `/estates/${abbr.toLowerCase()}`;

export default function AustraliaMap() {
  const router = useRouter();
  const [hoverState, setHoverState] = useState<string | null>(null);
  const [hoverPin, setHoverPin] = useState<string | null>(null);
  const active = useMemo(() => activeStateAbbrs(), []);

  // Project pins, then fan out any that land on the same spot.
  const pins = useMemo(() => {
    const base = pinnedEstates().map((e) => {
      const { x, y } = projectLngLat(e.coords!.lng, e.coords!.lat);
      return { estate: e, x, y };
    });
    // Group by a coarse grid cell to detect co-location.
    const groups = new Map<string, typeof base>();
    for (const p of base) {
      const key = `${Math.round(p.x / 18)}:${Math.round(p.y / 18)}`;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(p);
    }
    const out: { estate: (typeof base)[number]["estate"]; x: number; y: number }[] = [];
    for (const group of groups.values()) {
      if (group.length === 1) {
        out.push(group[0]);
        continue;
      }
      const R = 20; // fan radius (viewBox units)
      const cx = group.reduce((s, p) => s + p.x, 0) / group.length;
      const cy = group.reduce((s, p) => s + p.y, 0) / group.length;
      group.forEach((p, i) => {
        const a = (Math.PI * 2 * i) / group.length - Math.PI / 2;
        out.push({ estate: p.estate, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R });
      });
    }
    return out;
  }, []);

  const { width, height, states } = AUSTRALIA;
  const pinR = 9;
  const hitR = 22; // ≥44px equivalent tap target at typical render scale

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto select-none"
        role="img"
        aria-label="Map of Australia. Select a state to see its developments, or a pin to open an estate."
        style={{ maxHeight: "70vh" }}
      >
        {/* State polygons */}
        {states.map((s) => {
          const abbr = s.abbr as StateAbbr;
          const isActive = active.has(abbr);
          const isHover = hoverState === s.abbr;
          const fill = isActive ? STATE_COLORS[abbr] ?? MUTED_FILL : MUTED_FILL;
          const count = estatesInState(abbr).length;
          return (
            <g
              key={s.abbr}
              role="button"
              tabIndex={0}
              aria-label={`${STATE_NAMES[abbr] ?? s.name}${
                count ? ` — ${count} development${count > 1 ? "s" : ""}` : " — no developments yet"
              }`}
              className="cursor-pointer outline-none"
              onClick={() => router.push(stateHref(s.abbr))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(stateHref(s.abbr));
                }
              }}
              onMouseEnter={() => setHoverState(s.abbr)}
              onMouseLeave={() => setHoverState((h) => (h === s.abbr ? null : h))}
              onFocus={() => setHoverState(s.abbr)}
              onBlur={() => setHoverState((h) => (h === s.abbr ? null : h))}
            >
              <path
                d={s.d}
                fill={fill}
                fillOpacity={isActive ? (isHover ? 1 : 0.92) : isHover ? 0.7 : 0.5}
                stroke="#FAF7F2"
                strokeWidth={1.5}
                strokeLinejoin="round"
                style={{ transition: "fill-opacity 150ms ease" }}
              />
              {/* State label — only where it reads cleanly (skip tiny ACT). */}
              {s.abbr !== "ACT" && (
                <text
                  x={s.cx}
                  y={s.cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none font-archivo"
                  fontSize={isActive ? 22 : 18}
                  fontWeight={isActive ? 800 : 600}
                  fill={isActive ? "#FFFFFF" : "#6B6457"}
                >
                  {s.abbr}
                </text>
              )}
            </g>
          );
        })}

        {/* Estate pins (drawn above polygons) */}
        {pins.map(({ estate, x, y }) => {
          const isHover = hoverPin === estate.slug;
          return (
            <g
              key={estate.slug}
              role="button"
              tabIndex={0}
              aria-label={`${estate.name} — ${estate.location} (${estate.status})`}
              className="cursor-pointer outline-none"
              onClick={() => router.push(estate.href)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(estate.href);
                }
              }}
              onMouseEnter={() => setHoverPin(estate.slug)}
              onMouseLeave={() => setHoverPin((h) => (h === estate.slug ? null : h))}
              onFocus={() => setHoverPin(estate.slug)}
              onBlur={() => setHoverPin((h) => (h === estate.slug ? null : h))}
            >
              {/* invisible enlarged hit area */}
              <circle cx={x} cy={y} r={hitR} fill="transparent" />
              {/* pin */}
              <circle
                cx={x}
                cy={y}
                r={isHover ? pinR + 3 : pinR}
                fill={estate.accent}
                stroke="#FFFFFF"
                strokeWidth={3}
                style={{ transition: "r 120ms ease" }}
              />
              {/* label chip */}
              <g className="pointer-events-none" opacity={isHover ? 1 : 0.95}>
                <rect
                  x={x + 14}
                  y={y - 13}
                  width={estate.shortName.length * 8.6 + 16}
                  height={24}
                  rx={4}
                  fill="#1A2744"
                  opacity={0.92}
                />
                <text
                  x={x + 22}
                  y={y + 1}
                  dominantBaseline="middle"
                  className="font-archivo"
                  fontSize={14}
                  fontWeight={700}
                  fill="#FFFFFF"
                >
                  {estate.shortName}
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* Visually-hidden, crawlable + no-JS fallback: every destination as a real link. */}
      <nav className="sr-only" aria-label="Developments by state">
        <ul>
          {ALL_STATE_ABBRS.map((abbr) => (
            <li key={abbr}>
              <Link href={stateHref(abbr)}>{STATE_NAMES[abbr]}</Link>
            </li>
          ))}
          {publicEstates().map((e) => (
            <li key={e.slug}>
              <Link href={e.href}>
                {e.name} — {e.location}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
