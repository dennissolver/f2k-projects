"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { LOTS, CATEGORY_INFO } from "@/data/seafields";
import buildableAreas from "@/data/seafields/buildable-areas.json";
import LazyVisible from "@/components/LazyVisible";
import SuburbAutocomplete from "@/components/SuburbAutocomplete";

// The interactive subdivision map (143-lot SVG + lazy satellite layer) is the
// heaviest client subtree on the page and sits ~9 sections below the fold.
// Code-split it into its own chunk (ssr: false) and only mount it once it
// scrolls near the viewport (LazyVisible), so the initial page load — and the
// hydration memory spike on low-end mobile — never pays for it up front.
const SiteMap = dynamic(() => import("./SiteMap"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[420px] flex items-center justify-center rounded bg-off-white border border-black/5">
      <span className="font-archivo text-sm text-slate/60">
        Loading subdivision plan…
      </span>
    </div>
  ),
});

// Just {lotId: areaM2} — the full polygon geometry lives in polygons.json,
// imported only by the lazy-mounted map components (keeps ~155 KB of coordinate
// arrays out of this form's chunk / the initial estate-page load).
const BUILDABLE_AREAS = buildableAreas as Record<string, number>;

const INTEREST_TYPES = [
  "Vacant serviced land only",
  "House & land package (Factory2Key modular build)",
  "Either — exploring options",
] as const;

// Price-expectation options are derived PER LOT from the lot's actual reserve
// (seafields_public_lots: land_total for bare land, total_price for H&L) so we
// NEVER suggest a figure below what Uwe has set. (Uwe, 2026-05-27: Lot 338's
// $160k reserve must not show a "from $150k" option.) When a lot's price isn't
// public, we fall back to the band floor — and never below it.
const LAND_FLOOR = 155_000; // cheapest Seafields land band
const HL_FLOOR = 485_000; // cheapest house & land package
const LAND_STEP = 10_000;
const HL_STEP = 25_000;

function fmtFrom(n: number): string {
  return `From $${Math.round(n).toLocaleString("en-AU")}`;
}

/**
 * Three ascending "From $X" options for a lot, floored at its reserve (or the
 * band floor when the reserve isn't public). The lowest option always equals
 * the lot's set price — never below it.
 */
function priceOptionsForLot(base: number | null, isHL: boolean): string[] {
  // No public reserve for this lot → never guess a number (it could land below
  // the lot's real price). Ask them to enquire instead.
  if (base == null || base <= 0) return ["Price on application"];
  // Floor at the lot's reserve (band floor is a secondary guard) — never below.
  const floor = isHL ? HL_FLOOR : LAND_FLOOR;
  const step = isHL ? HL_STEP : LAND_STEP;
  const start = Math.max(base, floor);
  return [start, start + step, start + 2 * step].map(fmtFrom);
}

const DWELLING_TYPES = [
  "2x1 ADU / Granny Flat",
  "3x2 Modular Home (GROH)",
  "3x2 + Study Modular",
  "4x2 Modular Home (GROH)",
  "BigRoo — 4x2 + Theatre Modular",
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
  // Ray White referrals attribute to the OFFICE, not an individual agent — per Henry
  // (2026-06-16): showing one agent's name/number confuses clients working with Brett or
  // others in the office. Name + contact left blank so the client can optionally add their
  // own agent; the ?ref source tag still attributes the lead to the Ray White campaign.
  "raywhite-signage": {
    type: "Real Estate Agent",
    name: "",
    company: "Ray White Geraldton",
    contact: "",
  },
  raywhite: {
    type: "Real Estate Agent",
    name: "",
    company: "Ray White Geraldton",
    contact: "",
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
  const [referrerAgentId, setReferrerAgentId] = useState("");
  const [agents, setAgents] = useState<{ id: string; name: string; agency: string | null }[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  // Fetch agents when "Real Estate Agent" is selected
  useEffect(() => {
    if (referrerType === "Real Estate Agent" && agents.length === 0) {
      setAgentsLoading(true);
      fetch("/api/public/agents?estate=seafields")
        .then(r => r.json())
        .then(data => {
          setAgents(data.agents || []);
          setAgentsLoading(false);
        })
        .catch(() => setAgentsLoading(false));
    }
  }, [referrerType]);

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

  // Per-lot public prices (land_total / total_price) from the same view the
  // public map reads, so the price-expectation options floor at each lot's
  // real reserve instead of a hardcoded list.
  const [priceByLot, setPriceByLot] = useState<
    Record<number, { land_total: number | null; total_price: number | null }>
  >({});
  useEffect(() => {
    fetch("/api/seafields/allocations")
      .then((r) => (r.ok ? r.json() : { lots: [] }))
      .then(
        (d: {
          lots?: Array<{
            lot_number: number;
            land_total: number | null;
            total_price: number | null;
          }>;
        }) => {
          const map: Record<
            number,
            { land_total: number | null; total_price: number | null }
          > = {};
          for (const l of d.lots ?? [])
            map[l.lot_number] = {
              land_total: l.land_total,
              total_price: l.total_price,
            };
          setPriceByLot(map);
        },
      )
      .catch(() => {});
  }, []);

  const isHL =
    interestType === "House & land package (Factory2Key modular build)" ||
    interestType === "Either — exploring options";
  const isLandOnly =
    interestType === "Vacant serviced land only" ||
    interestType === "Either — exploring options";

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
      // Hard cap at 3 lots, registered in order of preference (Uwe 2026-06-15).
      if (prev.length >= 3) {
        setError(
          "You can register interest in up to 3 lots, in order of preference. Deselect one to choose another.",
        );
        return prev;
      }
      setError(null);
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

  // When this form mounted — a time-trap (a human can't complete this form in <2.5s).
  const formLoadedAt = useRef<number>(Date.now());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Bot signals (honeypot + time-trap) are SENT TO THE SERVER, which decides whether to
    // record the submission. We never fake-success on the client and skip the API — that
    // silently drops real submissions (PRODUCT_STANDARDS; the 2026-06-15 lost-lead bug).
    const elapsedMs = Date.now() - formLoadedAt.current;

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

    // Hard gate: how they heard about us is required (the "where did you find
    // us" half — paired with the referrer below).
    if (!howHeard) {
      setError("Please tell us how you heard about us.");
      return;
    }

    // Hard gate: the referrer choice cannot be skipped (an explicit "None" counts).
    if (!referrerType) {
      setError(
        "Please choose a referrer option — select “None / Not applicable” if you found this yourself."
      );
      return;
    }
    if (referrerType === "Real Estate Agent" && !referrerAgentId) {
      setError(
        "Please select your agent, or choose “I’m not working with an agent”."
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
          referrer_type: referrerType,
          referrer_name: referrerName.trim() || null,
          referrer_company: referrerCompany.trim() || null,
          referrer_contact: referrerContact.trim() || null,
          referrer_agent_id:
            referrerAgentId && referrerAgentId !== "no-agent" ? referrerAgentId : null,
          notes: notes.trim() || null,
          consent,
          source: refTag ?? undefined,
          hp_field: honeypot,
          elapsed_ms: elapsedMs,
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
        <p className="text-slate/50 font-archivo text-xs leading-relaxed mt-4 max-w-md mx-auto">
          All lot details registered above (size, shape, boundary, area, lot
          number) are indicative and remain subject to confirmation against the
          WAPC-approved deposited plan and final title survey. Final figures
          will be confirmed with you in writing prior to any contract of sale.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full border border-black/10 px-4 py-3 min-h-[44px] font-archivo text-base text-deep-blue focus:outline-none focus:border-[#00B5AD] transition-colors bg-white";
  const labelClass =
    "block text-deep-blue font-semibold font-archivo text-sm mb-1";
  const selectClass = inputClass;

  // Selection order IS preference order — the first lot clicked is the buyer's
  // 1st preference. lots_selected is submitted in this order, so we display it
  // the same way (not sorted by lot number) and label each 1st/2nd/3rd. (Uwe
  // 2026-06-15: "up to 3 lots, in order of your preference".)
  const preferenceLots = selectedLots;
  const PREFERENCE_LABELS = ["1st", "2nd", "3rd"];
  const ordinal = (i: number) => PREFERENCE_LABELS[i] ?? `${i + 1}th`;

  return (
    <div>
      {/* ===== SITE MAP SECTION ===== */}
      <div id="site-map" className="mb-12">
        <p className="font-ibm-mono text-xs tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
          Interactive Subdivision Plan
        </p>
        <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-3">
          Select Your Preferred Lot(s)
        </h2>
        <p className="text-slate font-archivo leading-relaxed mb-3">
          Click a lot on the subdivision plan to select it. You can select up to
          3 lots, in order of your preference — your first click is your 1st
          preference. Each lot is a serviced residential block — available as
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

        <LazyVisible minHeight={520}>
          <SiteMap selectedLots={selectedLots} onToggleLot={toggleLot} />
        </LazyVisible>

        {/* Your Selected Lot(s) summary card */}
        {selectedLots.length > 0 && (
          <div className="mt-6 bg-[#1A2744] text-white p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-ibm-mono text-xs tracking-[0.4em] uppercase text-white/60">
                Your Selected{" "}
                {selectedLots.length === 1 ? "Lot" : `Lots (${selectedLots.length})`}
              </p>
              <span className="font-archivo text-xs text-white/50">
                Click any lot to remove it
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {preferenceLots.map((lotId, prefIndex) => {
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
                        <span className="ml-2 text-[#00B5AD] font-semibold">
                          {ordinal(prefIndex)} preference
                        </span>
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

      {/* ===== REGISTRATION FORM ===== */}
      {selectedLots.length === 0 ? (
        <div
          id="register"
          className="bg-white border-2 border-dashed border-[#00B5AD]/30 p-8 sm:p-12 text-center"
        >
          <p className="font-ibm-mono text-xs tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
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
        <p className="font-ibm-mono text-xs tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
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
            name="hp_field"
            id="hp_field"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            style={{ position: "absolute", left: "-9999px" }}
          />

          {/* Contact Details */}
          <div className="border border-black/5 bg-white p-5">
            <p className="font-ibm-mono text-xs tracking-[0.3em] uppercase text-[#00B5AD] mb-4">
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
                  <SuburbAutocomplete
                    id="sf-suburb"
                    value={suburb}
                    onChange={setSuburb}
                    onSelectPostcode={setPostcode}
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

      {/* ===== INTEREST TYPE ===== */}
      {selectedLots.length > 0 && (
        <div className="mb-12">
          <p className="font-ibm-mono text-xs tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
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
          <p className="font-ibm-mono text-xs tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
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
            {preferenceLots.map((lotId, prefIndex) => {
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
                          <span className="ml-2 text-[#00B5AD] font-semibold">
                            · {ordinal(prefIndex)} preference
                          </span>
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
                          <p className="font-ibm-mono text-xs tracking-[0.3em] uppercase text-slate/50 mb-3">
                            Lot Details
                          </p>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-off-white py-3 px-4">
                              <div className="font-archivo font-bold text-deep-blue text-lg">
                                {lot.area}m²
                              </div>
                              <div className="font-ibm-mono text-xs text-slate/50 uppercase">
                                Land Area
                              </div>
                            </div>
                            <div className="bg-off-white py-3 px-4">
                              <div className="font-archivo font-bold text-[#00B5AD] text-lg">
                                {BUILDABLE_AREAS[lot.id] ?? "—"}
                                {BUILDABLE_AREAS[lot.id] ? "m²" : ""}
                              </div>
                              <div className="font-ibm-mono text-xs text-slate/50 uppercase">
                                Buildable
                              </div>
                            </div>
                            <div className="bg-off-white py-3 px-4">
                              <div className="font-archivo font-bold text-deep-blue text-lg">
                                R20
                              </div>
                              <div className="font-ibm-mono text-xs text-slate/50 uppercase">
                                Zoning
                              </div>
                            </div>
                            <div className="bg-off-white py-3 px-4">
                              <div className="font-archivo font-bold text-deep-blue text-sm">
                                {lot.zone}
                              </div>
                              <div className="font-ibm-mono text-xs text-slate/50 uppercase">
                                Location
                              </div>
                            </div>
                            <div className="bg-off-white py-3 px-4">
                              <div className="font-archivo font-bold text-deep-blue text-sm">
                                Stage {lot.stage}
                              </div>
                              <div className="font-ibm-mono text-xs text-slate/50 uppercase">
                                Release
                              </div>
                            </div>
                            <div className="bg-off-white py-3 px-4">
                              <div className="font-archivo font-bold text-deep-blue text-sm">
                                {CATEGORY_INFO[lot.category].label}
                              </div>
                              <div className="font-ibm-mono text-xs text-slate/50 uppercase">
                                Category
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-slate/50 font-archivo mt-3 leading-relaxed">
                            <span className="text-[#00B5AD] font-semibold">Buildable</span>{" "}
                            shows the indicative single-storey footprint
                            after a uniform 1.5m setback. R20 actual setbacks:
                            3m primary street (avg 6m), 1.5m secondary, 1m–1.5m
                            sides &amp; rear (boundary walls also permitted per
                            Local Planning Policy R-Codes).
                          </p>
                          <p className="text-xs text-slate/40 font-archivo mt-2 italic">
                            All lots are flat, serviced (reticulated water,
                            sewer, power), and will be titled upon settlement.
                            Lot areas are approximate and subject to final
                            survey.
                          </p>
                        </div>

                        {/* Price selector */}
                         <div>
                           <div className="flex items-baseline justify-between gap-2 mb-2">
                             <p className="font-ibm-mono text-xs tracking-[0.3em] uppercase text-slate/50">
                               {isHL
                                 ? "House & Land Package"
                                 : "Serviced Land Only"}
                             </p>
                             <span className="inline-block bg-[#00B5AD]/10 text-[#00B5AD] text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                               {isHL ? "Full Package" : "Land Only"}
                             </span>
                           </div>
                           <p className="text-xs text-slate/60 font-archivo mb-3">
                             What would you expect to pay for Lot{" "}
                             {lot.lotNumber} ({lot.area}m²)?
                             {isHL
                               ? " This includes the land, Factory2Key modular home build, and all site works."
                               : " This is for the serviced, titled land only. You arrange your own design and build."}
                           </p>
                           <div className="grid grid-cols-1 gap-1.5">
                             {priceOptionsForLot(
                               isHL
                                 ? (priceByLot[lot.lotNumber]?.total_price ??
                                     null)
                                 : (priceByLot[lot.lotNumber]?.land_total ??
                                     null),
                               isHL,
                             ).map((range) => (
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
                        <p className="font-ibm-mono text-xs tracking-[0.3em] uppercase text-slate/50 mb-2">
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
                              className="w-full border border-black/10 px-3 py-3 min-h-[44px] font-archivo text-base text-deep-blue focus:outline-none focus:border-[#00B5AD] transition-colors bg-white"
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
                                className="w-full border border-black/10 px-3 py-3 min-h-[44px] font-archivo text-base text-deep-blue focus:outline-none focus:border-[#00B5AD] transition-colors bg-white"
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

          {/* About You */}
          <div className="border border-black/5 bg-white p-5">
            <p className="font-ibm-mono text-xs tracking-[0.3em] uppercase text-[#00B5AD] mb-1">
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
              </div>
            </div>
          </div>

          {/* Selected Lots Summary */}
          <div>
            <label className={labelClass}>Selected Lot(s) *</label>
            <div className="border border-black/10 bg-white font-archivo text-sm">
              {selectedLots.length > 0 ? (
                <div className="divide-y divide-black/5">
                  {preferenceLots.map((lotId, prefIndex) => {
                    const lot = LOTS.find((l) => l.id === lotId);
                    return (
                      <div
                        key={lotId}
                        className="px-4 py-2 flex items-center justify-between"
                      >
                        <span className="text-deep-blue">
                          <strong>Lot {lot?.lotNumber}</strong>
                          <span className="text-[#00B5AD] font-semibold ml-2">
                            {ordinal(prefIndex)} pref
                          </span>
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

          {/* How You Found Us / Referral — required */}
          <div className="border border-black/5 bg-white p-5">
            <p className="font-ibm-mono text-xs tracking-[0.3em] uppercase text-[#00B5AD] mb-1">
              Required
            </p>
            <p className="font-archivo font-semibold text-deep-blue text-sm mb-1">
              How you found us &amp; who referred you
            </p>
            <p className="text-xs text-slate/60 font-archivo mb-4">
              Please tell us how you heard about Seafields Estate and whether
              anyone referred you — both are required so we can look after you and
              credit the right agent or partner. Choose “None / I found this
              myself” for the referrer if no one referred you.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="sf-howHeard" className={labelClass}>
                  How did you hear about us? *
                </label>
                <select
                  id="sf-howHeard"
                  value={howHeard}
                  onChange={(e) => setHowHeard(e.target.value)}
                  className={selectClass}
                  required
                >
                  <option value="" disabled>
                    — Please choose —
                  </option>
                  {HOW_HEARD.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="sf-referrerType" className={labelClass}>
                  Were you referred by anyone? *
                </label>
                <select
                  id="sf-referrerType"
                  value={referrerType}
                  onChange={(e) => setReferrerType(e.target.value)}
                  className={selectClass}
                  required
                >
                  <option value="" disabled>
                    — Please choose —
                  </option>
                  <option value="none">None / Not applicable — I found this myself</option>
                  {REFERRER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {referrerType && (
                <>
                  {referrerType === "Real Estate Agent" ? (
                    <div className="bg-[#00B5AD]/10 border border-[#00B5AD]/30 rounded-lg p-4">
                      <label htmlFor="sf-referrerAgent" className="block font-semibold text-slate-900 mb-2">
                        If an agent is working with you, please select them here so your agent can look after you properly
                      </label>
                      <select
                        id="sf-referrerAgent"
                        value={referrerAgentId}
                        onChange={(e) => {
                          setReferrerAgentId(e.target.value);
                          const agent = agents.find(a => a.id === e.target.value);
                          if (agent) {
                            setReferrerName(agent.name);
                            setReferrerCompany(agent.agency || "");
                          }
                        }}
                        className={selectClass}
                        disabled={agentsLoading}
                        required
                      >
                        <option value="" disabled>
                          {agentsLoading ? "Loading agents..." : "— Please choose —"}
                        </option>
                        <option value="no-agent">I&apos;m not working with an agent</option>
                        {agents.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name} {a.agency ? `(${a.agency})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
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
                  )}
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
              contract of sale. Factory2Key may email me an acknowledgement and
              further information about this offer, and I can unsubscribe at any time.
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
