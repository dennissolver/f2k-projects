"use client";

import { useEffect } from "react";
import {
  HOUSE_TYPE_INFO,
  NOTIONAL_LAND_M2,
  type UnitData,
} from "@/data/branscombe";

interface UnitInfoCardProps {
  unit: UnitData;
  registrationCount: number;
  /** Retail ("suggested") price for this unit, from /api/branscombe/lots. */
  retailPrice: number | null;
  /** True when the unit is firmly allocated and cannot be registered. */
  isReserved: boolean;
  isSelected: boolean;
  bg: string;
  border: string;
  onClose: () => void;
  onToggle: () => void;
}

function formatPrice(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function UnitInfoCard({
  unit,
  registrationCount,
  retailPrice,
  isReserved,
  isSelected,
  bg,
  border,
  onClose,
  onToggle,
}: UnitInfoCardProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const info = HOUSE_TYPE_INFO[unit.type];
  const land = NOTIONAL_LAND_M2[unit.unitNumber];

  const statusText = isReserved
    ? "Reserved"
    : registrationCount > 0
      ? `${registrationCount} ${
          registrationCount === 1 ? "person interested" : "interested"
        }`
      : "Available";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Home ${unit.unitNumber} details`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm border-2 shadow-2xl"
        style={{ backgroundColor: bg, borderColor: border }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-white/70 hover:text-white text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>

        <div className="p-6 text-white">
          <p className="font-ibm-mono text-[0.6rem] tracking-[0.4em] uppercase text-white/60 mb-1">
            {info.label} · {unit.zone}
          </p>
          <h3 className="font-playfair text-3xl font-black mb-4 leading-none">
            Home {unit.unitNumber}
          </h3>

          <dl className="space-y-2 text-sm font-archivo">
            <Row label="Home size" value={`${info.size} + ${info.deck}`} />
            <Row label="Beds / baths" value={`${info.beds} bed / ${info.baths} bath`} />
            {land != null && <Row label="Notional land" value={`${land} m²`} />}
            <Row
              label="Parking"
              value={`${unit.parking.spaces} cars · ${unit.parking.locationLabel}`}
            />
            <Row label="Status" value={statusText} />
          </dl>

          {/* Suggested price */}
          {retailPrice != null && retailPrice > 0 && (
            <div className="mt-4 border-t border-white/10 pt-3">
              <div className="bg-gradient-to-r from-white/5 to-white/0 border border-white/20 rounded px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                    Suggested price from
                  </span>
                  <span className="text-white font-bold text-lg">
                    {formatPrice(retailPrice)}
                  </span>
                </div>
                <p className="text-white/60 text-[10px] mt-1">
                  Indicative house &amp; land — fixed-price modular build by
                  Unison, 7-Star energy rated.
                </p>
              </div>
              <p className="text-white/40 text-[9px] mt-2 italic px-3">
                Price is indicative and from the current schedule. Contact us to
                confirm specifics for your chosen home.
              </p>
            </div>
          )}

          <div className="mt-3 text-[10px] text-white/55 leading-snug">
            All home details (type, size, notional land, home number) are
            indicative and subject to confirmation against the architectural
            plans and contract of sale.
          </div>

          <div className="mt-6">
            {isReserved ? (
              <div className="bg-white/10 border border-white/20 px-4 py-3 text-xs text-white/80 leading-relaxed">
                This home is reserved and is not available for registration.
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onToggle();
                  onClose();
                  setTimeout(() => {
                    const regForm = document.getElementById("register");
                    if (regForm) {
                      regForm.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }
                  }, 400);
                }}
                className={`w-full py-3 font-archivo font-semibold transition-colors ${
                  isSelected
                    ? "bg-white/20 hover:bg-white/30 text-white"
                    : "bg-white text-deep-blue hover:bg-white/90"
                }`}
              >
                {isSelected
                  ? "Remove from my registration"
                  : "Add to my registration"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/10 pb-1.5">
      <dt className="text-white/60 uppercase text-xs tracking-wider shrink-0">
        {label}
      </dt>
      <dd className="text-white font-semibold text-right">{value}</dd>
    </div>
  );
}
