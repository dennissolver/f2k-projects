"use client";

import { useEffect } from "react";
import {
  CATEGORY_INFO,
  STAGE_INFO,
  type LotData,
} from "@/data/seafields";
import type { PublicLotRow } from "@/app/api/seafields/allocations/route";

interface LotInfoCardProps {
  lot: LotData;
  registrationCount: number;
  publicRow?: PublicLotRow;
  /** Set to false when this lot cannot be added to the registration —
   * reserved, sold, withheld, non-public bucket, or stage not yet open. */
  canSelect: boolean;
  isSelected: boolean;
  bg: string;
  border: string;
  onClose: () => void;
  onToggle: () => void;
}

function isReservedStatus(status: string | undefined | null): boolean {
  return status === "reserved" || status === "sold" || status === "withheld";
}

function formatPrice(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function LotInfoCard({
  lot,
  registrationCount,
  publicRow,
  canSelect,
  isSelected,
  bg,
  border,
  onClose,
  onToggle,
}: LotInfoCardProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isReserved = !!publicRow && isReservedStatus(publicRow.status);
  const isComingSoon =
    !!publicRow && !publicRow.is_open_for_registration && !isReserved;

  const statusText = isReserved
    ? "Reserved"
    : isComingSoon
      ? `Coming soon — Stage ${publicRow?.stage_number ?? "?"}`
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
      aria-label={`Lot ${lot.lotNumber} details`}
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
            {publicRow?.stage_label
              ? publicRow.stage_label
              : lot.stage
                ? STAGE_INFO[lot.stage].title
                : "Stage TBD"}
          </p>
          <h3 className="font-playfair text-3xl font-black mb-4 leading-none">
            Lot {lot.lotNumber}
          </h3>

           <dl className="space-y-2 text-sm font-archivo">
             <Row label="Size" value={`${lot.area} m²`} />
             <Row
               label="Category"
               value={CATEGORY_INFO[lot.category].label}
             />
             <Row label="Zone" value={lot.zone} />
             <Row label="Status" value={statusText} />
           </dl>

           {/* Pricing section with clear tier labels */}
           {(publicRow?.total_price != null && publicRow.total_price > 0) ||
           (publicRow?.land_total != null && publicRow.land_total > 0) ? (
             <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
               <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-white/50 mb-2">
                 Available Options
               </p>

               {publicRow?.total_price != null &&
                 publicRow.total_price > 0 &&
                 !publicRow.land_only && (
                   <div className="bg-gradient-to-r from-white/5 to-white/0 border border-white/20 rounded px-3 py-2.5">
                     <div className="flex items-baseline justify-between gap-2">
                       <span className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                         House + Land Package
                       </span>
                       <span className="text-white font-bold text-lg">
                         {formatPrice(publicRow.total_price)}
                       </span>
                     </div>
                     <p className="text-white/60 text-[10px] mt-1">
                       Includes land, modular home build & site works
                     </p>
                   </div>
                 )}

               {/* Serviced-land-only price ONLY for lots that are actually land-only. For an
                  H&L / dual-occ lot (land_only=false), retail_price is the PACKAGE total, not a
                  land price — showing it here labelled "Serviced Land Only" mis-stated the
                  package as raw land (e.g. Lot 238 dual-occ showed land-only at the $933,400
                  package price). Gating on land_only fixes that without changing any figure. */}
              {publicRow?.land_only &&
                 publicRow.land_total != null &&
                 publicRow.land_total > 0 && (
                   <div className="bg-gradient-to-r from-white/5 to-white/0 border border-white/20 rounded px-3 py-2.5">
                     <div className="flex items-baseline justify-between gap-2">
                       <span className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                         Serviced Land Only
                       </span>
                       <span className="text-white font-bold text-lg">
                         {formatPrice(publicRow.land_total)}
                       </span>
                     </div>
                     <p className="text-white/60 text-[10px] mt-1">
                       Titled land only — build your own design
                     </p>
                   </div>
                 )}

               <p className="text-white/40 text-[9px] mt-2 italic px-3">
                 Prices shown are from the current reserve. Contact us for
                 specific details about your chosen lot.
               </p>
             </div>
           ) : null}

          {publicRow?.public_label && (
            <div className="mt-4 bg-white/10 border border-white/25 px-3 py-2 text-[11px] text-white/90 leading-relaxed">
              {publicRow.public_label}
            </div>
          )}

          {lot.geometryPending && (
            <div className="mt-4 bg-amber-400/15 border border-amber-300/40 px-3 py-2 text-[11px] text-amber-100 leading-relaxed">
              <strong className="text-amber-200">Geometry pending CLE final survey.</strong>{" "}
              Boundary and area shown for this lot are indicative — the
              authoritative figures will be confirmed against the WAPC-approved
              survey.
            </div>
          )}

          <div className="mt-3 text-[10px] text-white/55 leading-snug">
            All lot details (size, shape, boundary, area, lot number) are
            indicative and subject to confirmation against the WAPC-approved
            deposited plan and final title survey prior to any contract of
            sale.
          </div>

          <div className="mt-6">
            {isReserved ? (
              <div className="bg-white/10 border border-white/20 px-4 py-3 text-xs text-white/80 leading-relaxed">
                This lot is reserved and is not available for registration.
              </div>
            ) : isComingSoon ? (
              <div className="bg-white/10 border border-white/20 px-4 py-3 text-xs text-white/80 leading-relaxed">
                Stage {publicRow?.stage_number ?? "?"} is not yet open for
                registration. We&apos;re launching Stage 1 first — registrations
                for later stages will open once each stage&apos;s allocation
                threshold is met.
              </div>
            ) : !canSelect && !isSelected ? (
              <div className="bg-white/10 border border-white/20 px-4 py-3 text-xs text-white/80 leading-relaxed">
                This lot is not currently available for public registration.
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
                      regForm.scrollIntoView({ behavior: "smooth", block: "start" });
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
