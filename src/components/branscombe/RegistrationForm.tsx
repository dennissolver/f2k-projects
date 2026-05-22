"use client";

import { useState } from "react";
import Image from "next/image";
import { UNITS, HOUSE_TYPE_INFO, type HouseType } from "@/lib/branscombe-units";
import SiteMap from "./SiteMap";

const PRICE_RANGES = [
  "$600,000 – $650,000",
  "$650,000 – $700,000",
  "$700,000 – $750,000",
  "$750,000 – $800,000",
  "$800,000+",
] as const;

const REFERRER_TYPES = [
  "Real Estate Agent",
  "Mortgage Broker",
  "Financial Adviser",
  "Friend or Family",
  "Other",
] as const;

const BUYER_TYPES = [
  "First Home Buyer",
  "Next Home Buyer",
  "Downsizer",
  "Investor",
] as const;

const BUYER_PROFILES = [
  "Young Family",
  "Couple",
  "Single",
  "Empty Nester",
  "Retiree / Semi-Retired",
  "Investor — Owner Occupier",
  "Investor — Rental",
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
  "Other",
] as const;

/** Floor plan image per house type group */
const FLOORPLAN_IMAGE: Record<HouseType, string> = {
  "1A": "/branscombe/floorplan-type1.png",
  "1B": "/branscombe/floorplan-type1.png",
  "2A": "/branscombe/floorplan-type2.png",
  "2B": "/branscombe/floorplan-type2.png",
  "2C": "/branscombe/floorplan-type2.png",
};

export default function RegistrationForm() {
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
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

  // Price preferences per unit
  const [pricePrefs, setPricePrefs] = useState<Record<string, string>>({});

  // Buyer profile fields
  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");
  const [buyerType, setBuyerType] = useState("");
  const [buyerProfile, setBuyerProfile] = useState("");
  const [currentHousing, setCurrentHousing] = useState("");
  const [purchaseTimeline, setPurchaseTimeline] = useState("");
  const [financeStatus, setFinanceStatus] = useState("");
  const [howHeard, setHowHeard] = useState("");

  // Referrer / agent fields
  const [referrerType, setReferrerType] = useState("");
  const [referrerName, setReferrerName] = useState("");
  const [referrerCompany, setReferrerCompany] = useState("");
  const [referrerContact, setReferrerContact] = useState("");

  // Expanded unit detail panel
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);

  const toggleUnit = (unitId: string) => {
    setSelectedUnits((prev) => {
      if (prev.includes(unitId)) {
        setPricePrefs((p) => {
          const next = { ...p };
          delete next[unitId];
          return next;
        });
        if (expandedUnit === unitId) setExpandedUnit(null);
        return prev.filter((id) => id !== unitId);
      }
      setExpandedUnit(unitId);
      return [...prev, unitId];
    });
  };

  const setPricePref = (unitId: string, range: string) => {
    setPricePrefs((prev) => ({ ...prev, [unitId]: range }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (honeypot) {
      setSuccess(true);
      return;
    }

    if (selectedUnits.length === 0) {
      setError("Please select at least one home on the site map above.");
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
      const res = await fetch("/api/branscombe/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          units_selected: selectedUnits,
          price_preferences: pricePrefs,
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
          Thank You for Your Interest!
        </h3>
        <p className="text-slate font-archivo leading-relaxed max-w-md mx-auto mb-2">
          We&apos;re excited to have you on board! We&apos;ve recorded your
          interest in{" "}
          <strong>
            {selectedUnits.length} home{selectedUnits.length > 1 ? "s" : ""}
          </strong>{" "}
          ({selectedUnits.join(", ")}).
        </p>
        <p className="text-slate font-archivo text-sm leading-relaxed max-w-md mx-auto mb-2">
          You&apos;ll receive <strong>monthly progress updates</strong> and
          we&apos;ll contact you personally as we get within 6 months of
          completion to discuss next steps.
        </p>
        <p className="text-slate/70 font-archivo text-sm">
          A confirmation has been sent to <strong>{email}</strong>.
        </p>
        <p className="text-slate/50 font-archivo text-[11px] leading-relaxed mt-4 max-w-md mx-auto">
          All home details registered above (floor area, internal layout,
          finishes, specifications, unit numbering) are indicative and remain
          subject to confirmation against the final construction drawings and
          contract documentation. Final figures will be confirmed with you in
          writing prior to any contract of sale.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full border border-black/10 px-4 py-2.5 font-archivo text-sm text-deep-blue focus:outline-none focus:border-[#00B5AD] transition-colors bg-white";
  const labelClass =
    "block text-deep-blue font-semibold font-archivo text-sm mb-1";
  const selectClass = inputClass;
  const sortedUnits = [...selectedUnits].sort(
    (a, b) => parseInt(a.replace("U", "")) - parseInt(b.replace("U", ""))
  );

  return (
    <div>
      {/* ===== SITE MAP SECTION ===== */}
      <div id="site-map" className="mb-12">
        <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
          Interactive Site Plan
        </p>
        <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-3">
          Select Your Preferred Home(s)
        </h2>
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
              All home information shown is indicative and subject to final
              confirmation
            </p>
            <p className="text-amber-900/85 font-archivo text-xs leading-relaxed mt-1">
              Every home&apos;s <strong>floor area, internal layout, finishes,
              specifications</strong> and final unit numbering remains subject
              to confirmation against the final construction drawings and
              contract documentation. Registering interest does not guarantee
              allocation or final dimensions — final figures will be confirmed
              with you in writing prior to any contract of sale.
            </p>
          </div>
        </div>

        {/* Prominent instruction callout */}
        <div className="bg-[#00B5AD]/10 border border-[#00B5AD]/20 px-5 py-4 mb-6 flex items-start gap-3">
          <svg className="w-6 h-6 text-[#00B5AD] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          <div>
            <p className="text-deep-blue font-archivo font-semibold text-sm">
              Click directly on a numbered home in the map below to select it.
            </p>
            <p className="text-slate/70 font-archivo text-sm mt-1">
              You can select multiple homes. Each home will appear in your
              registration form where you can review its floor plan and set
              your price expectation. Use the reference table below to see
              which home type is assigned to each unit number.
            </p>
          </div>
        </div>

        {/* Unit-to-Type quick reference — prominent with coloured headers */}
        <div className="bg-white border-2 border-[#00B5AD]/30 p-5 mb-6">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.3em] uppercase text-[#00B5AD] mb-1">
            Which home is which type?
          </p>
          <p className="text-xs text-slate/50 font-archivo mb-4">
            Find your preferred unit number below to see its home type, then
            click it on the map.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {([
              { type: "1A", size: "104m²", units: "U1, U3, U9, U11, U14, U19, U22, U27, U32, U37" },
              { type: "1B", size: "104m²", units: "U2, U7, U12, U17, U23, U28, U33" },
              { type: "2A", size: "114m²", units: "U4, U8, U13, U18, U24, U29, U34" },
              { type: "2B", size: "114m²", units: "U5, U10, U15, U20, U25, U30, U35" },
              { type: "2C", size: "114m²", units: "U6, U16, U21, U26, U31, U36" },
            ]).map((h) => (
              <div key={h.type} className="bg-off-white p-3 border border-black/5">
                <div className="bg-[#1A2744] text-white text-center py-1.5 -mx-3 -mt-3 mb-2">
                  <span className="font-playfair font-black text-base">Type {h.type}</span>
                  <span className="font-ibm-mono text-[0.55rem] tracking-wider text-white/60 ml-2">{h.size}</span>
                </div>
                <div className="text-xs font-archivo text-deep-blue leading-relaxed">
                  {h.units}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[0.65rem] text-slate/40 font-archivo mt-3">
            All homes: 3 bed &middot; 2 bath &middot; 24m² deck &middot; 7 Star Energy rated
          </p>
        </div>

        <SiteMap selectedUnits={selectedUnits} onToggleUnit={toggleUnit} />

        {/* Selected units summary bar */}
        {selectedUnits.length > 0 && (
          <div className="mt-6 bg-[#1A2744] text-white p-4 flex flex-wrap items-center gap-3">
            <span className="font-ibm-mono text-[0.65rem] tracking-[0.3em] uppercase opacity-60">
              Selected:
            </span>
            {sortedUnits.map((unitId) => {
              const unit = UNITS.find((u) => u.id === unitId);
              return (
                <button
                  key={unitId}
                  type="button"
                  onClick={() => toggleUnit(unitId)}
                  className="bg-white/10 hover:bg-white/20 px-3 py-1 text-sm font-archivo transition-colors flex items-center gap-2"
                >
                  {unitId}
                  {unit && (
                    <span className="opacity-50 text-xs">
                      Type {unit.type}
                    </span>
                  )}
                  <span className="opacity-40">&times;</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== UNIT DETAIL PANELS WITH PRICE RANGE ===== */}
      {selectedUnits.length > 0 && (
        <div className="mb-12">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            Your Selected Homes
          </p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-3">
            Review &amp; Set Your Price Range
          </h2>
          <p className="text-slate font-archivo leading-relaxed mb-6">
            For each selected home, review the floor plan and location, then tell
            us what you&apos;d expect to pay for the complete{" "}
            <strong>house and land package</strong>. This is not a commitment —
            it helps us understand market expectations.
          </p>

          <div className="space-y-4">
            {sortedUnits.map((unitId) => {
              const unit = UNITS.find((u) => u.id === unitId);
              if (!unit) return null;
              const info = HOUSE_TYPE_INFO[unit.type];
              const isExpanded = expandedUnit === unitId;
              const selectedPrice = pricePrefs[unitId] || "";

              return (
                <div
                  key={unitId}
                  className="bg-white border border-black/5 overflow-hidden"
                >
                  {/* Unit header */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedUnit(isExpanded ? null : unitId)
                    }
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-off-white/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-[#00B5AD] flex items-center justify-center text-white font-archivo font-bold text-sm">
                        {unitId}
                      </div>
                      <div>
                        <div className="font-archivo font-bold text-deep-blue text-sm">
                          Type {unit.type} — {info.size} home + {info.deck}
                        </div>
                        <div className="font-archivo text-xs text-slate/60">
                          {unit.zone} &middot; {info.beds} bed / 2 bath &middot;
                          House &amp; land package
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

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div className="border-t border-black/5 px-5 py-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Floor plan */}
                        <div>
                          <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-slate/50 mb-2">
                            Floor Plan — Type {unit.type}
                          </p>
                          <div className="bg-off-white p-2 border border-black/5">
                            <Image
                              src={FLOORPLAN_IMAGE[unit.type]}
                              alt={`Floor plan Type ${unit.type}`}
                              width={500}
                              height={350}
                              className="w-full h-auto"
                            />
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                            <div className="bg-off-white py-2">
                              <div className="font-archivo font-bold text-deep-blue text-sm">
                                {info.size}
                              </div>
                              <div className="font-ibm-mono text-[0.55rem] text-slate/50 uppercase">
                                Home
                              </div>
                            </div>
                            <div className="bg-off-white py-2">
                              <div className="font-archivo font-bold text-deep-blue text-sm">
                                {info.deck}
                              </div>
                              <div className="font-ibm-mono text-[0.55rem] text-slate/50 uppercase">
                                Deck
                              </div>
                            </div>
                            <div className="bg-off-white py-2">
                              <div className="font-archivo font-bold text-deep-blue text-sm">
                                {info.beds} Bed / 2 Bath
                              </div>
                              <div className="font-ibm-mono text-[0.55rem] text-slate/50 uppercase">
                                Layout
                              </div>
                            </div>
                          </div>
                          <p className="text-[0.65rem] text-slate/40 font-archivo mt-2 italic">
                            Each lot includes the home, deck, landscaping,
                            driveway, and all site works as a turnkey package.
                            7 Star Energy rated.
                          </p>
                        </div>

                        {/* Home renders + price selector */}
                        <div>
                          <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-slate/50 mb-2">
                            Home Exterior — Indicative Renders
                          </p>
                          <div className="grid grid-cols-3 gap-1 mb-4">
                            <Image
                              src="/branscombe/home-exterior-1.png"
                              alt="Home exterior front"
                              width={200}
                              height={140}
                              className="w-full h-auto object-cover"
                            />
                            <Image
                              src="/branscombe/home-exterior-2.png"
                              alt="Home exterior side"
                              width={200}
                              height={140}
                              className="w-full h-auto object-cover"
                            />
                            <Image
                              src="/branscombe/home-exterior-3.png"
                              alt="Home exterior rear"
                              width={200}
                              height={140}
                              className="w-full h-auto object-cover"
                            />
                          </div>

                          {/* Price range selector */}
                          <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-slate/50 mb-2">
                            House &amp; Land Package — Your Price Expectation
                          </p>
                          <p className="text-xs text-slate/60 font-archivo mb-3">
                            What would you expect to pay for {unitId} as a
                            complete <strong>house and land package</strong>
                            {" "}(Type {unit.type}, {info.size} home + {info.deck} +
                            land + site works)? This is not binding — it helps us
                            gauge market expectations.
                          </p>
                          <div className="grid grid-cols-1 gap-1.5">
                            {PRICE_RANGES.map((range) => (
                              <button
                                key={range}
                                type="button"
                                onClick={() => setPricePref(unitId, range)}
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== REGISTRATION FORM ===== */}
      {selectedUnits.length === 0 ? (
        <div
          id="register"
          className="bg-white border-2 border-dashed border-[#00B5AD]/30 p-8 sm:p-12 text-center"
        >
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            Your Registration
          </p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-3">
            Pick a Home Above to Begin
          </h2>
          <p className="text-slate font-archivo leading-relaxed mb-6 max-w-[560px] mx-auto">
            The registration form opens once you choose at least one home on
            the site map above. You can pick multiple homes — each one will
            give you a slot to set your preferences before you complete the
            form.
          </p>
          <a
            href="#site-map"
            className="inline-flex items-center gap-2 bg-[#00B5AD] hover:bg-[#009E97] text-white px-6 py-3 font-archivo font-semibold transition-colors"
          >
            <span aria-hidden>↑</span> Scroll back to the site map
          </a>
          <p className="font-archivo text-xs text-slate/60 mt-6 leading-relaxed max-w-[560px] mx-auto">
            <span className="text-[#00B5AD] font-semibold">Available</span>{" "}
            homes are coloured on the plan and respond to clicks.{" "}
            <span className="text-slate font-semibold">Reserved</span> and{" "}
            <span className="text-slate font-semibold">Sold</span> homes
            cannot be added to a registration.
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
          Complete the form below to register your interest. No deposit or
          commitment is required. The more you tell us, the better we can keep
          you informed with relevant updates.
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

          {/* ---- SECTION: Contact Details ---- */}
          <div className="border border-black/5 bg-white p-5">
            <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-[#00B5AD] mb-4">
              Contact Details
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className={labelClass}>
                    First Name *
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className={labelClass}>
                    Last Name *
                  </label>
                  <input
                    id="lastName"
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
                  <label htmlFor="email" className={labelClass}>
                    Email Address *
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="jane@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className={labelClass}>
                    Phone Number
                  </label>
                  <input
                    id="phone"
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
                  <label htmlFor="suburb" className={labelClass}>
                    Current Suburb / Town
                  </label>
                  <input
                    id="suburb"
                    type="text"
                    value={suburb}
                    onChange={(e) => setSuburb(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Claremont, Sandy Bay, Moonah"
                  />
                </div>
                <div>
                  <label htmlFor="postcode" className={labelClass}>
                    Postcode
                  </label>
                  <input
                    id="postcode"
                    type="text"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. 7011"
                    maxLength={4}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ---- SECTION: About You ---- */}
          <div className="border border-black/5 bg-white p-5">
            <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-[#00B5AD] mb-1">
              About You
            </p>
            <p className="text-xs text-slate/50 font-archivo mb-4">
              Help us understand who is interested in Branscombe Estate. All
              fields in this section are optional.
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="buyerType" className={labelClass}>
                    I am a...
                  </label>
                  <select
                    id="buyerType"
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
                  <label htmlFor="buyerProfile" className={labelClass}>
                    Best describes my situation
                  </label>
                  <select
                    id="buyerProfile"
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
                  <label htmlFor="currentHousing" className={labelClass}>
                    Current living situation
                  </label>
                  <select
                    id="currentHousing"
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
                  <label htmlFor="purchaseTimeline" className={labelClass}>
                    When are you looking to buy?
                  </label>
                  <select
                    id="purchaseTimeline"
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
                  <label htmlFor="financeStatus" className={labelClass}>
                    Finance status
                  </label>
                  <select
                    id="financeStatus"
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
                  <label htmlFor="howHeard" className={labelClass}>
                    How did you hear about us?
                  </label>
                  <select
                    id="howHeard"
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

          {/* ---- SECTION: Selected Units + Price Summary ---- */}
          <div>
            <label className={labelClass}>Selected Home(s) *</label>
            <div className="border border-black/10 bg-white font-archivo text-sm">
              {selectedUnits.length > 0 ? (
                <div className="divide-y divide-black/5">
                  {sortedUnits.map((uid) => {
                    const unit = UNITS.find((u) => u.id === uid);
                    return (
                      <div
                        key={uid}
                        className="px-4 py-2 flex items-center justify-between"
                      >
                        <span className="text-deep-blue">
                          <strong>{uid}</strong>
                          {unit && (
                            <span className="text-slate/60 ml-2">
                              Type {unit.type} — House &amp; land
                            </span>
                          )}
                        </span>
                        {pricePrefs[uid] ? (
                          <span className="text-[#00B5AD] font-semibold text-xs">
                            {pricePrefs[uid]}
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
                <div className="px-4 py-3 text-slate/60 bg-amber-50 border border-amber-200">
                  <strong className="text-amber-800">No homes selected yet.</strong>{" "}
                  <a href="#site-map" className="text-[#00B5AD] underline hover:text-[#009E97]">
                    Scroll up to the interactive site map
                  </a>{" "}
                  and click directly on any numbered home to select it. Your selections will appear here.
                </div>
              )}
            </div>
          </div>

          {/* ---- SECTION: Referral / Agent ---- */}
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
                <label htmlFor="referrerType" className={labelClass}>
                  Referrer Type
                </label>
                <select
                  id="referrerType"
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
                      <label htmlFor="referrerName" className={labelClass}>
                        Referrer Name
                      </label>
                      <input
                        id="referrerName"
                        type="text"
                        value={referrerName}
                        onChange={(e) => setReferrerName(e.target.value)}
                        className={inputClass}
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label htmlFor="referrerCompany" className={labelClass}>
                        Agency / Company
                      </label>
                      <input
                        id="referrerCompany"
                        type="text"
                        value={referrerCompany}
                        onChange={(e) => setReferrerCompany(e.target.value)}
                        className={inputClass}
                        placeholder="ABC Real Estate"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="referrerContact" className={labelClass}>
                      Referrer Email or Phone
                    </label>
                    <input
                      id="referrerContact"
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

          {/* ---- Notes ---- */}
          <div>
            <label htmlFor="notes" className={labelClass}>
              Notes / Questions
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
              placeholder="Any questions, preferences, or things you'd like us to know..."
            />
          </div>

          {/* Consent checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 w-4 h-4 accent-[#00B5AD]"
            />
            <span className="text-sm text-slate font-archivo leading-relaxed">
              I understand this is a Registration of Interest only — no deposit
              or commitment is required or implied. Pricing shown is indicative
              and relates to a complete house and land package.
              <strong>
                {" "}All home details — including floor area, internal layout,
                finishes, specifications and final unit numbering — are subject
                to confirmation against the final construction drawings and
                contract documentation, and may differ from what is shown on
                this page.
              </strong>{" "}
              Final figures will be confirmed with me in writing prior to any
              contract of sale. I agree to have my details added to the
              Factory2Key database and to receive project updates, news, and
              development progress communications.
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
              disabled={submitting || selectedUnits.length === 0 || !consent}
              className="bg-[#00B5AD] hover:bg-[#009E97] text-white px-8 py-3 font-archivo font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              title={
                selectedUnits.length === 0
                  ? "Pick a home on the site map above first"
                  : !consent
                    ? "Tick the consent checkbox above to continue"
                    : ""
              }
            >
              {submitting ? "Submitting..." : "Register My Interest"}
            </button>
            {(selectedUnits.length === 0 || !consent) && !submitting && (
              <p className="text-xs text-slate/70 font-archivo">
                {selectedUnits.length === 0 ? (
                  <>
                    <span className="text-[#00B5AD] font-semibold">
                      Pick a home first
                    </span>{" "}
                    —{" "}
                    <a
                      href="#site-map"
                      className="underline hover:text-deep-blue"
                    >
                      scroll up to the interactive site map
                    </a>{" "}
                    and click any available home to add it to your
                    registration.
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
