"use client";

import { useEffect, useMemo, useState } from "react";

type LotStatus = "available" | "under_contract" | "sold" | "reserve";

interface Lot {
  lotNumber: number;
  label: string;
  sqm: number | null;
  areaConfidence: "surveyed" | "plan_ocr" | "narrative" | "illegible" | null;
  status: LotStatus;
  zone: string | null;
  dwellingType: string | null;
  retailPrice: number | null;
  address: string | null;
  xPct: number | null;
  yPct: number | null;
}

const STATUS_META: Record<
  LotStatus,
  { label: string; chip: string; dot: string }
> = {
  available: {
    label: "Available",
    chip: "bg-[#E6F8F7] text-[#067A75] border-[#00B5AD]/40",
    dot: "bg-[#00B5AD]",
  },
  under_contract: {
    label: "Under contract",
    chip: "bg-amber-50 text-amber-800 border-amber-300",
    dot: "bg-amber-500",
  },
  sold: {
    label: "Sold",
    chip: "bg-slate-100 text-slate-500 border-slate-300",
    dot: "bg-slate-400",
  },
  reserve: {
    label: "Public open space",
    chip: "bg-[#EDF5E6] text-[#4A6B2E] border-[#8DB36A]/50",
    dot: "bg-[#8DB36A]",
  },
};

const STATUS_ORDER: LotStatus[] = ["available", "under_contract", "sold", "reserve"];

/** Render the lot area honouring data confidence — never a fabricated figure. */
function areaDisplay(lot: Lot): { text: string; note: string | null } {
  if (lot.sqm == null || lot.areaConfidence === "illegible") {
    return { text: "Area TBC", note: null };
  }
  const m2 = `${lot.sqm.toLocaleString()} m²`;
  switch (lot.areaConfidence) {
    case "surveyed":
      return { text: m2, note: null }; // exact
    case "narrative":
      return { text: `~${m2}`, note: "indicative" };
    case "plan_ocr":
    default:
      return { text: `~${m2}`, note: "approx" };
  }
}

function priceDisplay(lot: Lot): string {
  if (lot.status === "sold") return "Sold";
  if (lot.zone === "POS" || lot.status === "reserve") return "Not for sale";
  if (lot.retailPrice != null) {
    return `$${Math.round(lot.retailPrice).toLocaleString()}`;
  }
  return "POA";
}

export default function LotList() {
  const [lots, setLots] = useState<Lot[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<"all" | LotStatus>("all");
  const [selected, setSelected] = useState<Lot | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/wavecrest/lots")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (Array.isArray(d.lots)) setLots(d.lots);
        else setError(true);
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: lots?.length || 0 };
    for (const s of STATUS_ORDER) c[s] = 0;
    for (const l of lots || []) c[l.status] = (c[l.status] || 0) + 1;
    return c;
  }, [lots]);

  const visible = useMemo(() => {
    const list = (lots || []).filter((l) => filter === "all" || l.status === filter);
    // Available first, then under-contract, then sold, then POS; by lot number within.
    return list.sort((a, b) => {
      const sa = STATUS_ORDER.indexOf(a.status);
      const sb = STATUS_ORDER.indexOf(b.status);
      if (sa !== sb) return sa - sb;
      return a.lotNumber - b.lotNumber;
    });
  }, [lots, filter]);

  if (error) {
    return (
      <div className="bg-amber-50 border-l-4 border-amber-400 px-4 py-3">
        <p className="font-archivo text-sm text-amber-900">
          Lot information is temporarily unavailable. Please register your
          interest below and we&apos;ll be in touch with current availability.
        </p>
      </div>
    );
  }

  if (lots == null) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-28 bg-black/5 border border-black/5 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {(["all", ...STATUS_ORDER] as const).map((key) => {
          const isActive = filter === key;
          const label =
            key === "all" ? "All lots" : STATUS_META[key as LotStatus].label;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`font-archivo text-xs sm:text-sm px-3 py-2 border transition-colors min-h-[44px] sm:min-h-0 ${
                isActive
                  ? "bg-deep-blue text-white border-deep-blue"
                  : "bg-white text-slate border-black/10 hover:border-deep-blue/40"
              }`}
            >
              {label}
              <span className={isActive ? "text-white/70" : "text-slate/50"}>
                {" "}
                · {counts[key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Lot grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {visible.map((lot) => {
          const meta = STATUS_META[lot.status];
          const area = areaDisplay(lot);
          const isSold = lot.status === "sold";
          return (
            <button
              key={lot.lotNumber}
              type="button"
              onClick={() => setSelected(lot)}
              className={`text-left p-3 border transition-colors min-h-[44px] ${
                isSold
                  ? "bg-slate-50 border-black/5 hover:border-slate-300"
                  : "bg-white border-black/10 hover:border-[#00B5AD] hover:shadow-sm"
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="font-playfair text-lg font-black text-deep-blue leading-none">
                  {lot.label}
                </span>
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${meta.dot}`} />
              </div>
              <div className="font-archivo text-sm text-slate mt-1.5">
                {area.text}
                {area.note && (
                  <span className="text-slate/45 text-xs"> {area.note}</span>
                )}
              </div>
              <div
                className={`inline-flex items-center mt-2 px-1.5 py-0.5 text-[0.6rem] font-archivo font-semibold uppercase tracking-wide border rounded-sm ${meta.chip}`}
              >
                {meta.label}
              </div>
            </button>
          );
        })}
      </div>

      {visible.length === 0 && (
        <p className="font-archivo text-sm text-slate/60 py-8 text-center">
          No lots in this category.
        </p>
      )}

      <p className="font-archivo text-xs text-slate/50 mt-5 leading-relaxed">
        Areas marked <em>approx</em> are read from the approved subdivision plan;
        <em> indicative</em> areas are from sale documentation; exact areas are
        from feature survey. &ldquo;Area TBC&rdquo; lots are pending survey
        confirmation. Lots have no street number until titles issue — each is
        referenced as Lot N, Brownlie Street, Waggrakine WA 6530.
      </p>

      {/* Per-lot detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white w-full sm:max-w-md max-h-[90vh] overflow-y-auto sm:rounded-sm border border-black/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-deep-blue text-white px-5 py-4 flex items-start justify-between">
              <div>
                <div className="font-playfair text-2xl font-black leading-none">
                  {selected.label}
                </div>
                <div className="font-archivo text-sm text-white/70 mt-1">
                  {selected.address}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="text-white/70 hover:text-white text-2xl leading-none min-w-[44px] min-h-[44px] -mr-2 -mt-1"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-3">
              {(() => {
                const meta = STATUS_META[selected.status];
                const area = areaDisplay(selected);
                const rows: { label: string; value: string }[] = [
                  { label: "Status", value: meta.label },
                  {
                    label: "Area",
                    value: area.note ? `${area.text} (${area.note})` : area.text,
                  },
                ];
                if (selected.dwellingType)
                  rows.push({ label: "Home", value: selected.dwellingType });
                rows.push({ label: "Indicative price", value: priceDisplay(selected) });
                return rows.map((r) => (
                  <div
                    key={r.label}
                    className="flex border-b border-black/5 pb-2.5"
                  >
                    <span className="font-ibm-mono text-[0.6rem] tracking-wider uppercase text-slate/50 w-32 shrink-0 pt-0.5">
                      {r.label}
                    </span>
                    <span className="font-archivo text-sm text-deep-blue">
                      {r.value}
                    </span>
                  </div>
                ));
              })()}

              {selected.status === "available" ? (
                <a
                  href="#register"
                  onClick={() => setSelected(null)}
                  className="block text-center bg-[#00B5AD] hover:bg-[#009E97] text-white px-6 py-3 font-archivo font-semibold transition-colors mt-2"
                >
                  Register interest in {selected.label} &rarr;
                </a>
              ) : (
                <p className="font-archivo text-xs text-slate/60 leading-relaxed pt-1">
                  {selected.status === "sold"
                    ? "This lot has sold. Register your interest below and we'll let you know about comparable lots and upcoming releases."
                    : selected.status === "under_contract"
                    ? "This lot is under contract. Register your interest below to be notified if it returns to market or for similar lots."
                    : "This is public open space and is not for sale."}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
