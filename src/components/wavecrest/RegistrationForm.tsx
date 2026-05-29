"use client";

import { useState } from "react";
import SuburbAutocomplete from "@/components/SuburbAutocomplete";
import SiteMap from "./SiteMap";

const INTEREST_TYPES = [
  "Vacant serviced land only",
  "House & land package (Factory2Key modular build)",
  "Either — exploring options",
] as const;

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

const REFERRER_TYPES = [
  "Real Estate Agent",
  "Mortgage Broker",
  "Financial Adviser",
  "Friend or Family",
  "Other",
] as const;

export default function RegistrationForm() {
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

  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");
  const [interestType, setInterestType] = useState("");
  const [buyerType, setBuyerType] = useState("");
  const [buyerProfile, setBuyerProfile] = useState("");
  const [currentHousing, setCurrentHousing] = useState("");
  const [purchaseTimeline, setPurchaseTimeline] = useState("");
  const [financeStatus, setFinanceStatus] = useState("");
  const [howHeard, setHowHeard] = useState("");

  const [referrerType, setReferrerType] = useState("");
  const [referrerName, setReferrerName] = useState("");
  const [referrerCompany, setReferrerCompany] = useState("");
  const [referrerContact, setReferrerContact] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (honeypot) {
      setSuccess(true);
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
      const res = await fetch("/api/wavecrest/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          interest_type: interestType || null,
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
          We&apos;ve recorded your interest in Wavecrest Estate.
        </p>
        <p className="text-slate font-archivo text-sm leading-relaxed max-w-md mx-auto mb-2">
          You&apos;ll receive <strong>progress updates</strong> as stages are
          released and we&apos;ll contact you when lot selection opens.
        </p>
        <p className="text-slate/70 font-archivo text-sm">
          A confirmation has been sent to <strong>{email}</strong>.
        </p>
        <p className="text-slate/50 font-archivo text-[11px] leading-relaxed mt-4 max-w-md mx-auto">
          All information shown is indicative and subject to final confirmation.
          Registration of interest does not constitute an offer or commitment.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full border border-black/10 px-4 py-3 font-archivo text-base text-deep-blue focus:outline-none focus:border-[#00B5AD] transition-colors bg-white";
  const labelClass =
    "block text-deep-blue font-semibold font-archivo text-sm mb-1";
  const selectClass = inputClass;

  return (
    <div id="register">
      <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
        Registration
      </p>
      <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-3">
        Register Your Interest
      </h2>
      <p className="text-slate font-archivo leading-relaxed mb-8 max-w-[700px]">
        Complete the form below to register your interest in Wavecrest Estate.
        No deposit or commitment is required. We&apos;ll keep you informed as
        stages are released and lot selection becomes available.
      </p>

      {/* Interactive Site Plan */}
      <div className="mb-12">
        <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
          Interactive Site Plan
        </p>
        <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-3">
          Select Your Preferred Lot(s)
        </h2>
        <div className="bg-amber-50 border-l-4 border-amber-400 px-4 py-3 mb-4 flex items-start gap-3">
          <svg
            className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
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
              All lot information shown is indicative and subject to final confirmation
            </p>
            <p className="text-amber-900/85 font-archivo text-xs leading-relaxed mt-1">
              Every lot&apos;s size, shape, boundary, area and final lot numbering
              remains subject to confirmation against the approved deposited plan
              and final title survey. Registering interest does not guarantee
              allocation or final dimensions.
            </p>
          </div>
        </div>

        <SiteMap />

        <div className="mt-4 bg-off-white border border-black/5 p-4 text-center">
          <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-slate/60 mb-1">
            Lot selection coming soon
          </p>
          <p className="font-archivo text-sm text-deep-blue">
            Detailed lot plans and pricing will be available once stage approvals
            are confirmed. Register your interest and we&apos;ll notify you when
            lot selection opens.
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border-l-4 border-amber-400 px-4 py-3 mb-8 flex items-start gap-3">
        <svg
          className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
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
            All information shown is indicative and subject to final confirmation
          </p>
          <p className="text-amber-900/85 font-archivo text-xs leading-relaxed mt-1">
            This is a <strong>Registration of Interest only</strong> — no
            deposit or commitment is required or implied. Pricing, lot details,
            and stage timing are subject to confirmation. Registering does not
            guarantee allocation.
          </p>
        </div>
      </div>

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
                <SuburbAutocomplete
                  id="suburb"
                  value={suburb}
                  onChange={setSuburb}
                  onSelectPostcode={setPostcode}
                  className={inputClass}
                  placeholder="e.g. Waggrakine, Geraldton"
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
                  placeholder="e.g. 6530"
                  maxLength={4}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Interest Type */}
        <div className="border border-black/5 bg-white p-5">
          <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-[#00B5AD] mb-4">
            Your Interest
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor="interestType" className={labelClass}>
                I am interested in...
              </label>
              <select
                id="interestType"
                value={interestType}
                onChange={(e) => setInterestType(e.target.value)}
                className={selectClass}
              >
                <option value="">— Select —</option>
                {INTEREST_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

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

        {/* Referrer */}
        <div className="border border-black/5 bg-white p-5">
          <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-slate/50 mb-1">
            Optional
          </p>
          <p className="font-archivo font-semibold text-deep-blue text-sm mb-4">
            Were you referred by a real estate agent or other party?
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
            )}
          </div>
        </div>

        {/* Notes */}
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

        {/* Consent */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 w-5 h-5 accent-[#00B5AD]"
          />
          <span className="text-sm text-slate font-archivo leading-relaxed">
            I understand this is a Registration of Interest only — no deposit
            or commitment is required or implied. All information shown is
            indicative and subject to final confirmation against the contract
            documentation. I agree to have my details added to the Factory2Key
            database and to receive project updates and communications.
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
            disabled={submitting || !consent}
            className="bg-[#00B5AD] hover:bg-[#009E97] text-white px-8 py-3 font-archivo font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            {submitting ? "Submitting..." : "Register My Interest"}
          </button>
          {!consent && !submitting && (
            <p className="text-xs text-slate/70 font-archivo">
              <span className="text-[#00B5AD] font-semibold">One more step</span>
              — tick the consent checkbox above to enable the submit button.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
