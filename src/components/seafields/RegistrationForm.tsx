"use client";

import { useEffect, useState } from "react";
import { LOTS, CATEGORY_INFO } from "@/data/seafields";
import polygonsData from "@/data/seafields/polygons.json";
import SiteMap from "./SiteMap";

const BUILDABLE_ENVELOPES = (
  polygonsData as { buildableEnvelopes: Record<string, { areaM2: number }> }
).buildableEnvelopes;

const INTEREST_TYPES = [
  "Vacant serviced land only",
  "House & land package (Factory2Key modular build)",
  "Either — exploring options",
] as const;

const LAND_PRICE_RANGES = [
  "From $150,000",
  "From $160,000",
] as const;

const HL_PRICE_RANGES = [
  "From $485,000",
  "From $500,000",
  "From $550,000",
  "From $600,000",
  "From $650,000",
  "From $700,000",
] as const;

const DWELLING_TYPES = [
  "2x1 ADU / Granny Flat",
  "3x2 Modular Home",
  "3x2 + Study Modular",
  "4x2 Modular Home",
  "4x2 + Theatre Modular",
  "5x2 Modular Home",
  "Dual Occupancy",
  "Not sure yet",
] as const;

/** Lots ≥ this size realistically fit two dwellings under R20 setbacks. */
const SECONDARY_DWELLING_MIN_SQM = 600;

const REFERRER_TYPES = [
  "Real Estate Agent",
  "Mortgage Broker",
  "Financial Adviser",
  "Friend or Family",
  "Other",
] as const;

/**
 * Partner referral campaigns keyed by the ?ref= URL tag. A printed QR code or
 * short link carries ?ref=<tag> (e.g. ?ref=raywhite-signage), so any
 * registration arriving through it is auto-attributed to that partner across
 * the whole pipeline (admin email + GHL + audit). Add a row here when
 * onboarding a new referral channel. Unknown tags are still recorded verbatim
 * as the lead `source` but won't pre-fill the referrer fields. The referrer
 * `type` MUST match a value in REFERRER_TYPES so the select renders it.
 */
const REFERRAL_CAMPAIGNS: Record<
  string,
  { type: string; name: string; company: string; contact: string }
> = {
  "raywhite-signage": {
    type: "Real Estate Agent",
    name: "Henry Van Tiel",
    company: "Ray White Geraldton",
    contact: "0429 995 121 / henry.vantiel@raywhite.com",
  },
  raywhite: {
    type: "Real Estate Agent",
    name: "Henry Van Tiel",
    company: "Ray White Geraldton",
    contact: "0429 995 121 / henry.vantiel@raywhite.com",
  },
};

const BUYER_TYPES = [
  "First Home Buyer",
  "Next Home Buyer",
  "Downsizer",
  "Investor — Owner Occupier",
  "Investor — Rental / SMSF",
  "WACHS / Government Staff",
] as const;

const BUYER_PROFILES = [
  "Young Family",
  "Couple",
  "Single",
  "Empty Nester",
  "Retiree / Semi-Retired",
  "Healthcare Worker",
  "FIFO Worker",
  "Other",
] as const;

const CURRENT_HOUSING = [
  "Renting",
  "Own Home (with mortgage)",
  "Own Home (outright)",
  "Living with Family",
  "Other",
] as const;

const PURCHASE_TIMELINES = [
  "As soon as possible",
  "Within 3–6 months",
  "6–12 months",
  "12+ months",
  "Just exploring — no timeframe",
] as const;

const FINANCE_STATUSES = [
  "Pre-approved by lender",
  "Currently exploring finance",
  "Cash buyer — no finance needed",
  "Not yet started",
  "Prefer not to say",
] as const;

const HOW_HEARD = [
  "Online search",
  "Social media",
  "Real estate agent",
  "Word of mouth",
  "Drive-by / local signage",
  "News article",
  "Factory2Key website",
  "WACHS / Health campus",
  "Other",
] as const;

export default function RegistrationForm() {
  const [selectedLots, setSelectedLots] = useState<string[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Interest & price preferences
  const [interestType, setInterestType] = useState("");
  const [pricePrefs, setPricePrefs] = useState<Record<string, string>>({});
  // Per-lot dwelling type — primary + (large lots only) secondary.
  type DwellingPref = { primary?: string; secondary?: string };
  const [dwellingPrefs, setDwellingPrefs] = useState<
    Record<string, DwellingPref>
  >({});

  // Buyer profile
  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");
  const [buyerType, setBuyerType] = useState("");
  const [buyerProfile, setBuyerProfile] = useState("");
  const [currentHousing, setCurrentHousing] = useState("");
  const [purchaseTimeline, setPurchaseTimeline] = useState("");
  const [financeStatus, setFinanceStatus] = useState("");
  const [howHeard, setHowHeard] = useState("");

  // Referrer
  const [referrerType, setReferrerType] = useState("");
  const [referrerName, setReferrerName] = useState("");
  const [referrerCompany, setReferrerCompany] = useState("");
  const [referrerContact, setReferrerContact] = useState("");

  // Expanded lot panel
  const [expandedLot, setExpandedLot] = useState<string | null>(null);

  // Lead-source attribution. A partner QR code / short link carries a
  // ?ref=<tag> param. We record the raw tag for the `source` column and, for
  // known campaigns, pre-fill the referrer fields so the lead is attributed to
  // the partner end-to-end. The fields stay user-editable on screen.
  const [refTag, setRefTag] = useState<string | null>(null);
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search)
      .get("ref")
      ?.toLowerCase()
      .trim();
    if (!ref || !/^[a-z0-9_-]{1,60}$/.test(ref)) return;
    setRefTag(ref);
    const campaign = REFERRAL_CAMPAIGNS[ref];
    if (campaign) {
      setReferrerType(campaign.type);
      setReferrerName(campaign.name);
      setReferrerCompany(campaign.company);
      setReferrerContact(campaign.contact);
    }
  }, []);

  const isHL =
    interestType === "House & land package (Factory2Key modular build)" ||
    interestType === "Either — exploring options";
  const isLandOnly =
    interestType === "Vacant serviced land only" ||
    interestType === "Either — exploring options";
  const priceRanges = isHL ? HL_PRICE_RANGES : LAND_PRICE_RANGES;

  const toggleLot = (lotId: string) => {
    const target = LOTS.find((l) => l.id === lotId);
    // Heritage retention lots are not available — existing buildings retained.
    if (target?.isHeritage) return;
    setSelectedLots((prev) => {
      if (prev.includes(lotId)) {
        setPricePrefs((p) => {
          const next = { ...p };
          delete next[lotId];
          return next;
        });
        setDwellingPrefs((p) => {
          const next = { ...p };
          delete next[lotId];
          return next;
        });
        if (expandedLot === lotId) setExpandedLot(null);
        return prev.filter((id) => id !== lotId);
      }
      setExpandedLot(lotId);
      return [...prev, lotId];
    });
  };

  const setPricePref = (lotId: string, range: string) => {
    setPricePrefs((prev) => ({ ...prev, [lotId]: range }));
  };

  const setDwellingPref = (
    lotId: string,
    slot: "primary" | "secondary",
    value: string,
  ) => {
    setDwellingPrefs((prev) => {
      const current = prev[lotId] || {};
      const next: DwellingPref = { ...current };
      if (value) next[slot] = value;
      else delete next[slot];
      // Drop the lot entry entirely if both slots are empty.
      if (!next.primary && !next.secondary) {
        const cleaned = { ...prev };
        delete cleaned[lotId];
        return cleaned;
      }
      return { ...prev, [lotId]: next };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (honeypot) {
      setSuccess(true);
      return;
    }

    if (selectedLots.length === 0) {
      setError("Please select at least one lot on the subdivision plan above.");
      return;
    }

    if (!consent) {
      setError(
        "Please confirm you understand this is a Registration of Interest only."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/seafields/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          lots_selected: selectedLots,
          interest_type: interestType || null,
          price_preferences: pricePrefs,
          dwelling_preferences: dwellingPrefs,
          suburb: suburb.trim() || null,
          postcode: postcode.trim() || null,
          buyer_type: buyerType || null,
          buyer_profile: buyerProfile || null,
          current_housing: currentHousing || null,
          purchase_timeline: purchaseTimeline || null,
          finance_status: financeStatus || null,
          how_heard: howHeard || null,
          referrer_type: referrerType || null,
          referrer_name: referrerName.trim() || null,
          referrer_company: referrerCompany.trim() || null,
          referrer_contact: referrerContact.trim() || null,
          notes: notes.trim() || null,
          consent,
          source: refTag ?? undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white p-10 border border-black/5 text-center">
        <div className="w-16 h-16 rounded-full bg-[#00B5AD]/10 flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-[#00B5AD]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="font-playfair text-2xl font-black text-deep-blue mb-3">
          Registration Received
        </h3>
        <p className="text-slate font-archivo leading-relaxed max-w-md mx-auto mb-2">
          Thank you for your interest in Seafields Estate. We&apos;ve recorded
          your interest in{" "}
          <strong>
            {selectedLots.length} lot{selectedLots.length > 1 ? "s" : ""}
          </strong>
          .
        </p>
        <p className="text-slate/70 font-archivo text-sm">
          A confirmation has been sent to <strong>{email}</strong>. We&apos;ll be
          in touch as the project progresses.
        </p>
        <p className="text-slate/50 font-archivo text-[11px] leading-relaxed mt-4 max-w-md mx-auto">
          All lot details registered above (size, shape, boundary, area, lot
          number) are indicative and remain subject to confirmation against the
          WAPC-approved deposited plan and final title survey. Final figures
          will be confirmed with you in writing prior to any contract of sale.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full border border-black/10 px-4 py-2.5 font-archivo text-sm text-deep-blue focus:outline-none focus:border-[#00B5AD] transition-colors bg-white";
  const labelClass =
    "block text-deep-blue font-semibold font-archivo text-sm mb-1";
  const selectClass = inputClass;

  const sortedLots = [...selectedLots].sort((a, b) => {
    const numA = parseInt(a.replace("L", ""));
    const numB = parseInt(b.replace("L", ""));
    return numA - numB;
  });

  return (
    <div>
      {/* ===== SITE MAP SECTION ===== */}
      <div id="site-map" className="mb-12">
        <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
          Interactive Subdivision Plan
        </p>
        <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-3">
          Select Your Preferred Lot(s)
        </h2>
        <p className="text-slate font-archivo leading-relaxed mb-3">
          Click a lot on the subdivision plan to select it. You can select
          multiple lots. Each lot is a serviced residential block — available as
          vacant land or as a complete house &amp; land package with a
          Factory2Key modular build.
        </p>
        <div className="bg-amber-50 border-l-4 border-amber-400 px-4 py-3 mb-4 flex items-start gap-3">
          <svg
            className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01M4.06 19h15.88a2 2 0 001.79-2.89L13.79 4.11a2 2 0 00-3.58 0L2.27 16.11A2 2 0 004.06 19z"
            />
          </svg>
          <div>
            <p className="font-archivo font-semibold text-amber-900 text-sm leading-snug">
              All lot information shown is indicative and subject to final
              confirmation
            </p>
            <p className="text-amber-900/85 font-archivo text-xs leading-relaxed mt-1">
              Every lot&apos;s <strong>size, shape, boundary, area</strong> and
              final lot numbering remains subject to confirmation against the
              WAPC-approved deposited plan and final title survey. Registering
              interest does not guarantee allocation or final dimensions —
              final figures will be confirmed with you in writing prior to any
              contract of sale.
            </p>
          </div>
        </div>
        <p className="text-slate/60 font-archivo text-xs italic mb-8">
          Plan reference: CLE 3027-08B-01 (Amended Plan of Subdivision, WAPC
          202888), 22 April 2026. A small number of lot numbers are pending
          final confirmation by CLE.
        </p>

        <SiteMap selectedLots={selectedLots} onToggleLot={toggleLot} />

        {/* Your Selected Lot(s) summary card */}
        {selectedLots.length > 0 && (
          <div className="mt-6 bg-[#1A2744] text-white p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-white/60">
                Your Selected{" "}
                {selectedLots.length === 1 ? "Lot" : `Lots (${selectedLots.length})`}
              </p>
              <span className="font-archivo text-xs text-white/50">
                Click any lot to remove it
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {sortedLots.map((lotId) => {
                const lot = LOTS.find((l) => l.id === lotId);
                if (!lot) return null;
                return (
                  <button
                    key={lotId}
                    type="button"
                    onClick={() => toggleLot(lotId)}
                    className="bg-white/10 hover:bg-white/20 px-4 py-3 transition-colors flex items-center gap-3 text-left group"
                  >
                    <div className="h-10 w-10 bg-[#00B5AD] flex items-center justify-center text-white font-archivo font-bold text-sm shrink-0">
                      {lot.lotNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-archivo font-bold text-sm">
                        Lot {lot.lotNumber}
                      </div>
                      <div className="font-archivo text-xs text-white/60">
                        {lot.area}m² · {CATEGORY_INFO[lot.category].label}
                      </div>
                    </div>
                    <span className="text-white/40 group-hover:text-white/80 text-lg leading-none">
                      &times;
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ===== INTEREST TYPE ===== */}
      {selectedLots.length > 0 && (
        <div className="mb-12">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            What Are You Looking For?
          </p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-3">
            Land or House &amp; Land?
          </h2>
          <p className="text-slate font-archivo leading-relaxed mb-6">
            Seafields Estate lots are available as{" "}
            <strong>vacant serviced land</strong> (titled, ready to build) or as
            a complete <strong>house &amp; land package</strong> with a
            Factory2Key modular build (from $485,000). Tell us what you&apos;re
            interested in.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {INTEREST_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setInterestType(type)}
                className={`px-5 py-4 text-sm font-archivo text-left border transition-all ${
                  interestType === type
                    ? "bg-[#00B5AD] text-white border-[#00B5AD] font-semibold"
                    : "bg-white text-deep-blue border-black/10 hover:border-[#00B5AD]/50 hover:bg-[#00B5AD]/5"
                }`}
              >
                {type}
                {interestType === type && (
                  <span className="float-right">&#10003;</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== LOT DETAIL PANELS WITH PRICE RANGE ===== */}
      {selectedLots.length > 0 && (
        <div className="mb-12">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            Your Selected Lots
          </p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-3">
            Review &amp; Set Your Price Expectation
          </h2>
          <p className="text-slate font-archivo leading-relaxed mb-6">
            For each selected lot, tell us what you&apos;d expect to pay for{" "}
            {isHL
              ? "the complete house and land package"
              : "the vacant serviced land"}
            . This is not a commitment — it helps us gauge market expectations.
          </p>

          <div className="space-y-4">
            {sortedLots.map((lotId) => {
              const lot = LOTS.find((l) => l.id === lotId);
              if (!lot) return null;
              const isExpanded = expandedLot === lotId;
              const selectedPrice = pricePrefs[lotId] || "";

              return (
                <div
                  key={lotId}
                  className="bg-white border border-black/5 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedLot(isExpanded ? null : lotId)
                    }
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-off-white/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-[#00B5AD] flex items-center justify-center text-white font-archivo font-bold text-sm">
                        {lot.lotNumber}
                      </div>
                      <div>
                        <div className="font-archivo font-bold text-deep-blue text-sm">
                          Lot {lot.lotNumber} — {lot.area}m²{" "}
                          {CATEGORY_INFO[lot.category].label}
                        </div>
                        <div className="font-archivo text-xs text-slate/60">
                          {lot.zone} &middot; R20 Residential
                          {selectedPrice && (
                            <span className="ml-2 text-[#00B5AD] font-semibold">
                              &middot; {selectedPrice}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-slate/40 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-black/5 px-5 py-5 space-y-6">
                      {lot.geometryPending && (
                        <div className="bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900 leading-relaxed font-archivo">
                          <strong>Geometry pending CLE final survey.</strong>{" "}
                          Boundary and area shown for Lot {lot.lotNumber} are
                          indicative pending re-confirmation against the
                          WAPC-approved 08B survey. You can still register
                          interest — we&apos;ll confirm the exact figures with
                          you before any contract.
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Lot details */}
                        <div>
                          <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-slate/50 mb-3">
                            Lot Details
                          </p>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-off-white py-3 px-4">
                              <div className="font-archivo font-bold text-deep-blue text-lg">
                                {lot.area}m²
                              </div>
                              <div className="font-ibm-mono text-[0.55rem] text-slate/50 uppercase">
                                Land Area
                              </div>
                            </div>
                            <div className="bg-off-white py-3 px-4">
                              <div className="font-archivo font-bold text-[#00B5AD] text-lg">
                                {BUILDABLE_ENVELOPES[lot.id]?.areaM2 ?? "—"}
                                {BUILDABLE_ENVELOPES[lot.id] ? "m²" : ""}
                              </div>
                              <div className="font-ibm-mono text-[0.55rem] text-slate/50 uppercase">
                                Buildable
                              </div>
                            </div>
                            <div className="bg-off-white py-3 px-4">
                              <div className="font-archivo font-bold text-deep-blue text-lg">
                                R20
                              </div>
                              <div className="font-ibm-mono text-[0.55rem] text-slate/50 uppercase">
                                Zoning
                              </div>
                            </div>
                            <div className="bg-off-white py-3 px-4">
                              <div className="font-archivo font-bold text-deep-blue text-sm">
                                {lot.zone}
                              </div>
                              <div className="font-ibm-mono text-[0.55rem] text-slate/50 uppercase">
                                Location
                              </div>
                            </div>
                            <div className="bg-off-white py-3 px-4">
                              <div className="font-archivo font-bold text-deep-blue text-sm">
                                Stage {lot.stage}
                              </div>
                              <div className="font-ibm-mono text-[0.55rem] text-slate/50 uppercase">
                                Release
                              </div>
                            </div>
                            <div className="bg-off-white py-3 px-4">
                              <div className="font-archivo font-bold text-deep-blue text-sm">
                                {CATEGORY_INFO[lot.category].label}
                              </div>
                              <div className="font-ibm-mono text-[0.55rem] text-slate/50 uppercase">
                                Category
                              </div>
                            </div>
                          </div>
                          <p className="text-[0.65rem] text-slate/50 font-archivo mt-3 leading-relaxed">
                            <span className="text-[#00B5AD] font-semibold">Buildable</span>{" "}
                            shows the indicative single-storey footprint
                            after a uniform 1.5m setback. R20 actual setbacks:
                            3m primary street (avg 6m), 1.5m secondary, 1m–1.5m
                            sides &amp; rear (boundary walls also permitted per
                            Local Planning Policy R-Codes).
                          </p>
                          <p className="text-[0.65rem] text-slate/40 font-archivo mt-2 italic">
                            All lots are flat, serviced (reticulated water,
                            sewer, power), and will be titled upon settlement.
                            Lot areas are approximate and subject to final
                            survey.
                          </p>
                        </div>

                        {/* Price selector */}
                        <div>
                          <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-slate/50 mb-2">
                            {isHL
                              ? "House & Land Package — Your Price Expectation"
                              : "Bare Serviced Land — Your Price Expectation"}
                          </p>
                          <p className="text-xs text-slate/60 font-archivo mb-3">
                            What would you expect to pay for Lot{" "}
                            {lot.lotNumber} ({lot.area}m²)?
                            {isHL
                              ? " This includes the land, modular home build, and all site works."
                              : " This is for the serviced, titled land only."}
                          </p>
                          <div className="grid grid-cols-1 gap-1.5">
                            {priceRanges.map((range) => (
                              <button
                                key={range}
                                type="button"
                                onClick={() => setPricePref(lotId, range)}
                                className={`px-4 py-2 text-sm font-archivo text-left border transition-all ${
                                  selectedPrice === range
                                    ? "bg-[#00B5AD] text-white border-[#00B5AD] font-semibold"
                                    : "bg-white text-deep-blue border-black/10 hover:border-[#00B5AD]/50 hover:bg-[#00B5AD]/5"
                                }`}
                              >
                                {range}
                                {selectedPrice === range && (
                                  <span className="float-right">&#10003;</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Dwelling type picker — primary always, secondary on larger lots */}
                      <div>
                        <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-slate/50 mb-2">
                          Dwelling Configuration
                        </p>
                        <p className="text-xs text-slate/60 font-archivo mb-3">
                          {lot.area >= SECONDARY_DWELLING_MIN_SQM
                            ? `Lot ${lot.lotNumber} (${lot.area}m²) is large enough for two dwellings under R20 — e.g. a main home plus an ADU/granny flat, or a dual-occupancy. Tell us what you'd build.`
                            : `What would you build on Lot ${lot.lotNumber} (${lot.area}m²)?`}
                        </p>
                        <div
                          className={`grid grid-cols-1 ${
                            lot.area >= SECONDARY_DWELLING_MIN_SQM
                              ? "md:grid-cols-2"
                              : ""
                          } gap-4`}
                        >
                          <div>
                            <label
                              htmlFor={`dwelling-primary-${lotId}`}
                              className="block text-deep-blue font-semibold font-archivo text-xs mb-1"
                            >
                              Primary Dwelling
                            </label>
                            <select
                              id={`dwelling-primary-${lotId}`}
                              value={dwellingPrefs[lotId]?.primary || ""}
                              onChange={(e) =>
                                setDwellingPref(
                                  lotId,
                                  "primary",
                                  e.target.value,
                                )
                              }
                              className="w-full border border-black/10 px-3 py-2 font-archivo text-sm text-deep-blue focus:outline-none focus:border-[#00B5AD] transition-colors bg-white"
                            >
                              <option value="">— Select —</option>
                              {DWELLING_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>
                          {lot.area >= SECONDARY_DWELLING_MIN_SQM && (
                            <div>
                              <label
                                htmlFor={`dwelling-secondary-${lotId}`}
                                className="block text-deep-blue font-semibold font-archivo text-xs mb-1"
                              >
                                Secondary Dwelling{" "}
                                <span className="text-slate/50 font-normal">
                                  (optional)
                                </span>
                              </label>
                              <select
                                id={`dwelling-secondary-${lotId}`}
                                value={dwellingPrefs[lotId]?.secondary || ""}
                                onChange={(e) =>
                                  setDwellingPref(
                                    lotId,
                                    "secondary",
                                    e.target.value,
                                  )
                                }
                                className="w-full border border-black/10 px-3 py-2 font-archivo text-sm text-deep-blue focus:outline-none focus:border-[#00B5AD] transition-colors bg-white"
                              >
                                <option value="">— None / single home —</option>
                                {DWELLING_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== REGISTRATION FORM ===== */}
      {selectedLots.length === 0 ? (
        <div
          id="register"
          className="bg-white border-2 border-dashed border-[#00B5AD]/30 p-8 sm:p-12 text-center"
        >
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            Your Registration
          </p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-3">
            Pick a Lot Above to Begin
          </h2>
          <p className="text-slate font-archivo leading-relaxed mb-6 max-w-[560px] mx-auto">
            The registration form opens once you choose at least one lot on the
            subdivision plan above. You can pick multiple lots — each one will
            give you a slot to set your price expectation and dwelling
            preference before you complete the form.
          </p>
          <a
            href="#site-map"
            className="inline-flex items-center gap-2 bg-[#00B5AD] hover:bg-[#009E97] text-white px-6 py-3 font-archivo font-semibold transition-colors"
          >
            <span aria-hidden>↑</span> Scroll back to the subdivision plan
          </a>
          <p className="font-archivo text-xs text-slate/60 mt-6 leading-relaxed max-w-[560px] mx-auto">
            <span className="text-[#00B5AD] font-semibold">Available</span>{" "}
            lots are coloured green on the plan.{" "}
            <span className="text-slate font-semibold">Reserved</span>,{" "}
            <span className="text-slate font-semibold">Sold</span>, and{" "}
            <span className="text-slate font-semibold">Coming soon</span> lots
            are not selectable for registration.
          </p>
        </div>
      ) : (
      <div id="register">
        <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
          Your Details
        </p>
        <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-3">
          Register Your Interest
        </h2>
        <p className="text-slate font-archivo leading-relaxed mb-8">
          Complete the form below to register your interest in Seafields Estate.
          No deposit or commitment is required. The more you tell us, the better
          we can keep you informed with relevant updates.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Honeypot */}
          <input
            tabIndex={-1}
            aria-hidden
            autoComplete="off"
            name="website_url"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            style={{ position: "absolute", left: "-9999px" }}
          />

          {/* Contact Details */}
          <div className="border border-black/5 bg-white p-5">
            <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-[#00B5AD] mb-4">
              Contact Details
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="sf-firstName" className={labelClass}>
                    First Name *
                  </label>
                  <input
                    id="sf-firstName"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label htmlFor="sf-lastName" className={labelClass}>
                    Last Name *
                  </label>
                  <input
                    id="sf-lastName"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass}
                    placeholder="Smith"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="sf-email" className={labelClass}>
                    Email Address *
                  </label>
                  <input
                    id="sf-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="jane@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="sf-phone" className={labelClass}>
                    Phone Number
                  </label>
                  <input
                    id="sf-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                    placeholder="0400 000 000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="sf-suburb" className={labelClass}>
                    Current Suburb / Town
                  </label>
                  <input
                    id="sf-suburb"
                    type="text"
                    value={suburb}
                    onChange={(e) => setSuburb(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Geraldton, Waggrakine, Bluff Point"
                  />
                </div>
                <div>
                  <label htmlFor="sf-postcode" className={labelClass}>
                    Postcode
                  </label>
                  <input
                    id="sf-postcode"
                    type="text"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. 6530"
                    maxLength={4}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* About You */}
          <div className="border border-black/5 bg-white p-5">
            <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-[#00B5AD] mb-1">
              About You
            </p>
            <p className="text-xs text-slate/50 font-archivo mb-4">
              Help us understand who is interested in Seafields Estate. All
              fields in this section are optional.
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="sf-buyerType" className={labelClass}>
                    I am a...
                  </label>
                  <select
                    id="sf-buyerType"
                    value={buyerType}
                    onChange={(e) => setBuyerType(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">— Select —</option>
                    {BUYER_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="sf-buyerProfile" className={labelClass}>
                    Best describes my situation
                  </label>
                  <select
                    id="sf-buyerProfile"
                    value={buyerProfile}
                    onChange={(e) => setBuyerProfile(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">— Select —</option>
                    {BUYER_PROFILES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="sf-currentHousing" className={labelClass}>
                    Current living situation
                  </label>
                  <select
                    id="sf-currentHousing"
                    value={currentHousing}
                    onChange={(e) => setCurrentHousing(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">— Select —</option>
                    {CURRENT_HOUSING.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="sf-purchaseTimeline" className={labelClass}>
                    When are you looking to buy?
                  </label>
                  <select
                    id="sf-purchaseTimeline"
                    value={purchaseTimeline}
                    onChange={(e) => setPurchaseTimeline(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">— Select —</option>
                    {PURCHASE_TIMELINES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="sf-financeStatus" className={labelClass}>
                    Finance status
                  </label>
                  <select
                    id="sf-financeStatus"
                    value={financeStatus}
                    onChange={(e) => setFinanceStatus(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">— Select —</option>
                    {FINANCE_STATUSES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="sf-howHeard" className={labelClass}>
                    How did you hear about us?
                  </label>
                  <select
                    id="sf-howHeard"
                    value={howHeard}
                    onChange={(e) => setHowHeard(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">— Select —</option>
                    {HOW_HEARD.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Selected Lots Summary */}
          <div>
            <label className={labelClass}>Selected Lot(s) *</label>
            <div className="border border-black/10 bg-white font-archivo text-sm">
              {selectedLots.length > 0 ? (
                <div className="divide-y divide-black/5">
                  {sortedLots.map((lotId) => {
                    const lot = LOTS.find((l) => l.id === lotId);
                    return (
                      <div
                        key={lotId}
                        className="px-4 py-2 flex items-center justify-between"
                      >
                        <span className="text-deep-blue">
                          <strong>Lot {lot?.lotNumber}</strong>
                          {lot && (
                            <span className="text-slate/60 ml-2">
                              {lot.area}m² — {lot.zone}
                            </span>
                          )}
                        </span>
                        {pricePrefs[lotId] ? (
                          <span className="text-[#00B5AD] font-semibold text-xs">
                            {pricePrefs[lotId]}
                          </span>
                        ) : (
                          <span className="text-slate/30 text-xs">
                            No price set
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-2.5 text-slate/70">
                  <a
                    href="#site-map"
                    className="text-[#00B5AD] font-semibold hover:underline"
                  >
                    ↑ Scroll up to the subdivision plan
                  </a>{" "}
                  and click any green lot to add it here.
                </div>
              )}
            </div>
          </div>

          {/* Referral / Agent */}
          <div className="border border-black/5 bg-white p-5">
            <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-slate/50 mb-1">
              Optional
            </p>
            <p className="font-archivo font-semibold text-deep-blue text-sm mb-4">
              Were you referred by a real estate agent or other party?
            </p>
            <p className="text-xs text-slate/60 font-archivo mb-4">
              If someone referred you to this project, provide their details
              below so we can log them for any applicable referral arrangements.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="sf-referrerType" className={labelClass}>
                  Referrer Type
                </label>
                <select
                  id="sf-referrerType"
                  value={referrerType}
                  onChange={(e) => setReferrerType(e.target.value)}
                  className={selectClass}
                >
                  <option value="">— None / Not applicable —</option>
                  {REFERRER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {referrerType && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="sf-referrerName" className={labelClass}>
                        Referrer Name
                      </label>
                      <input
                        id="sf-referrerName"
                        type="text"
                        value={referrerName}
                        onChange={(e) => setReferrerName(e.target.value)}
                        className={inputClass}
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label htmlFor="sf-referrerCompany" className={labelClass}>
                        Agency / Company
                      </label>
                      <input
                        id="sf-referrerCompany"
                        type="text"
                        value={referrerCompany}
                        onChange={(e) => setReferrerCompany(e.target.value)}
                        className={inputClass}
                        placeholder="ABC Real Estate"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="sf-referrerContact" className={labelClass}>
                      Referrer Email or Phone
                    </label>
                    <input
                      id="sf-referrerContact"
                      type="text"
                      value={referrerContact}
                      onChange={(e) => setReferrerContact(e.target.value)}
                      className={inputClass}
                      placeholder="john@abcrealestate.com.au or 0400 000 000"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="sf-notes" className={labelClass}>
              Notes / Questions
            </label>
            <textarea
              id="sf-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
              placeholder="Any questions, preferences, or things you'd like us to know..."
            />
          </div>

          {/* Consent */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 w-4 h-4 accent-[#00B5AD]"
            />
            <span className="text-sm text-slate font-archivo leading-relaxed">
              I understand this is a Registration of Interest only — no deposit
              or commitment is required or implied. Pricing shown is indicative.
              <strong>
                {" "}All lot details — including size, shape, boundary, area and
                final lot numbering — are subject to confirmation against the
                WAPC-approved deposited plan and final title survey, and may
                differ from what is shown on this page.
              </strong>{" "}
              Final figures will be confirmed with me in writing prior to any
              contract of sale.
            </span>
          </label>

          {error && (
            <div className="bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-archivo">
              {error}
            </div>
          )}

          <p className="font-archivo text-xs text-slate/70">
            By submitting you agree to our{" "}
            <a href="/privacy" className="underline hover:text-deep-blue">
              Privacy Policy
            </a>
            .
          </p>

          <div className="space-y-2">
            <button
              type="submit"
              disabled={submitting || selectedLots.length === 0 || !consent}
              className="bg-[#00B5AD] hover:bg-[#009E97] text-white px-8 py-3 font-archivo font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              title={
                selectedLots.length === 0
                  ? "Pick a lot on the subdivision plan above first"
                  : !consent
                    ? "Tick the consent checkbox above to continue"
                    : ""
              }
            >
              {submitting ? "Submitting..." : "Register My Interest"}
            </button>
            {(selectedLots.length === 0 || !consent) && !submitting && (
              <p className="text-xs text-slate/70 font-archivo">
                {selectedLots.length === 0 ? (
                  <>
                    <span className="text-[#00B5AD] font-semibold">
                      Pick a lot first
                    </span>{" "}
                    —{" "}
                    <a
                      href="#site-map"
                      className="underline hover:text-deep-blue"
                    >
                      scroll up to the subdivision plan
                    </a>{" "}
                    and click any green lot to add it to your registration.
                  </>
                ) : (
                  <>
                    <span className="text-[#00B5AD] font-semibold">
                      One more step
                    </span>{" "}
                    — tick the consent checkbox above to enable the submit
                    button.
                  </>
                )}
              </p>
            )}
          </div>
        </form>
      </div>
      )}
    </div>
  );
}
