"use client";

import { useEffect, useRef, useState } from "react";
import SuburbAutocomplete from "@/components/SuburbAutocomplete";

const REFERRER_TYPES = ["Real Estate Agent", "Mortgage Broker", "Friend or Family", "Other"] as const;

// ?ref=<tag> partner attribution (same pattern as Seafields). The Harris Real Estate agents
// marketing Dutton can share ?ref=zen-hartree etc.; the tag auto-fills the referrer.
const REFERRAL_CAMPAIGNS: Record<string, { name: string; company: string }> = {
  "zen-hartree": { name: "Zen Hartree", company: "Harris Real Estate" },
  rachel: { name: "Rachel", company: "Harris Real Estate" },
  corey: { name: "Corey", company: "Harris Real Estate" },
  harris: { name: "", company: "Harris Real Estate" },
};

// Dutton Terrace register-of-interest (Archetype-C). Leaner than the lot-precise estates
// (no interactive lot map yet — the land is unzoned), but it captures the demand-validation
// anchors the funder revenue stack needs: interest_type, lot_size_preference, and budget_band
// ("would they buy AT a price", × lots = revenue stack tested for ≥20% margin).

const INTEREST_TYPES = [
  "Vacant serviced land only",
  "House & land package (Factory2Key modular build)",
  "Either — exploring options",
] as const;

const LOT_SIZE_PREF = [
  "Compact (≈300–450 m²)",
  "Standard (≈450–700 m²)",
  "Large (≈700–900 m²)",
  "Lifestyle (1,000 m²+)",
  "Not sure yet",
] as const;

// Indicative budget — the price anchor. Kept broad/honest while pricing is unset.
const BUDGET_BANDS = [
  "Land only — under $150k",
  "Land only — $150k–$200k",
  "Land only — $200k–$250k",
  "Land only — $250k+",
  "House & land — under $450k",
  "House & land — $450k–$550k",
  "House & land — $550k–$650k",
  "House & land — $650k+",
  "Prefer not to say",
] as const;

const BUYER_TYPES = [
  "First Home Buyer", "Next Home Buyer", "Downsizer",
  "Investor — Owner Occupier", "Investor — Rental / SMSF", "Government / Essential Worker",
] as const;

const PURCHASE_TIMELINES = [
  "As soon as possible", "Within 3–6 months", "6–12 months", "12+ months", "Just exploring — no timeframe",
] as const;

const FINANCE_STATUSES = [
  "Pre-approved by lender", "Currently exploring finance", "Cash buyer — no finance needed", "Not yet started", "Prefer not to say",
] as const;

const HOW_HEARD = [
  "Online search", "Social media", "Real estate agent", "Word of mouth", "Drive-by / local signage", "Factory2Key website", "Other",
] as const;

export default function RegistrationForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");
  const [interestType, setInterestType] = useState("");
  const [lotSizePref, setLotSizePref] = useState("");
  const [budgetBand, setBudgetBand] = useState("");
  const [buyerType, setBuyerType] = useState("");
  const [purchaseTimeline, setPurchaseTimeline] = useState("");
  const [financeStatus, setFinanceStatus] = useState("");
  const [howHeard, setHowHeard] = useState("");
  // Referrer / agent (same dropdown pattern as Seafields/Branscombe — agents from /api/public/agents).
  const [referrerType, setReferrerType] = useState("");
  const [referrerName, setReferrerName] = useState("");
  const [referrerCompany, setReferrerCompany] = useState("");
  const [referrerAgentId, setReferrerAgentId] = useState("");
  const [agents, setAgents] = useState<{ id: string; name: string; agency: string | null }[]>([]);
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formLoadedAt = useRef<number>(Date.now());

  // Load the agent list when "Real Estate Agent" is chosen (same source as Seafields/Branscombe).
  useEffect(() => {
    if (referrerType === "Real Estate Agent" && agents.length === 0) {
      fetch("/api/public/agents?estate=dutton-terrace")
        .then((r) => r.json())
        .then((d) => setAgents(d.agents || []))
        .catch(() => {});
    }
  }, [referrerType, agents.length]);

  // ?ref=<tag> partner attribution → auto-fill the referrer.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref")?.toLowerCase().trim();
    if (!ref) return;
    const c = REFERRAL_CAMPAIGNS[ref];
    if (c) {
      setReferrerType("Real Estate Agent");
      setReferrerName(c.name);
      setReferrerCompany(c.company);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Bot trap — autofill-safe hp_field + time-trap; a real human is never silently dropped.
    if (honeypot || Date.now() - formLoadedAt.current < 2500) {
      setSuccess(true);
      return;
    }
    if (!consent) {
      setError("Please confirm you understand this is a Registration of Interest only.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/dutton/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          interest_type: interestType || null,
          lot_size_preference: lotSizePref || null,
          budget_band: budgetBand || null,
          suburb: suburb.trim() || null,
          postcode: postcode.trim() || null,
          buyer_type: buyerType || null,
          purchase_timeline: purchaseTimeline || null,
          finance_status: financeStatus || null,
          how_heard: howHeard || null,
          referrer_type: referrerType || null,
          referrer_name: referrerName.trim() || null,
          referrer_company: referrerCompany.trim() || null,
          referrer_agent_id: referrerAgentId || null,
          notes: notes.trim() || null,
          consent,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full border border-black/10 px-4 py-3 font-archivo text-base text-deep-blue focus:outline-none focus:border-[#00B5AD] transition-colors bg-white";
  const labelClass = "block text-deep-blue font-semibold font-archivo text-sm mb-1";

  if (success) {
    return (
      <div id="register" className="bg-white p-10 border border-black/5 text-center">
        <h3 className="font-playfair text-2xl font-black text-deep-blue mb-3">Thank you for your interest!</h3>
        <p className="text-slate font-archivo leading-relaxed max-w-md mx-auto mb-2">
          We&apos;ve recorded your interest in Dutton Terrace. We&apos;ll keep you informed as the
          masterplan, lot releases and pricing are confirmed.
        </p>
        <p className="text-slate/70 font-archivo text-sm">A confirmation will follow to <strong>{email}</strong>.</p>
        <p className="text-slate/50 font-archivo text-[11px] leading-relaxed mt-4 max-w-md mx-auto">
          Dutton Terrace is at concept stage — all details are indicative and subject to planning
          approvals. Registering interest is not an offer or commitment.
        </p>
      </div>
    );
  }

  return (
    <div id="register">
      <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">Registration</p>
      <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-3">Register your interest</h2>
      <p className="text-slate font-archivo leading-relaxed mb-6 max-w-[700px]">
        Dutton Terrace is at an early concept stage. Register now to help shape the masterplan and be
        first to hear when lots, designs and pricing are released — no deposit, no commitment. Telling
        us your <strong>preferred lot size and budget</strong> helps us plan the right mix of homes.
      </p>

      <div className="bg-amber-50 border-l-4 border-amber-400 px-4 py-3 mb-8">
        <p className="font-archivo font-semibold text-amber-900 text-sm">Registration of Interest only</p>
        <p className="text-amber-900/85 font-archivo text-xs leading-relaxed mt-1">
          No deposit or commitment is required or implied. The estate is unzoned and at concept stage;
          lot layout, designs, pricing and timing are all subject to planning approval and confirmation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <input
          tabIndex={-1} aria-hidden autoComplete="off" name="hp_field" id="hp_field"
          value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
          style={{ position: "absolute", left: "-9999px" }}
        />

        <div className="border border-black/5 bg-white p-5 space-y-4">
          <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-[#00B5AD]">Contact details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label htmlFor="firstName" className={labelClass}>First name *</label>
              <input id="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} placeholder="Jane" /></div>
            <div><label htmlFor="lastName" className={labelClass}>Last name *</label>
              <input id="lastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} placeholder="Smith" /></div>
            <div><label htmlFor="email" className={labelClass}>Email *</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="jane@example.com" /></div>
            <div><label htmlFor="phone" className={labelClass}>Phone</label>
              <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="0400 000 000" /></div>
            <div><label htmlFor="suburb" className={labelClass}>Current suburb / town</label>
              <SuburbAutocomplete id="suburb" value={suburb} onChange={setSuburb} onSelectPostcode={setPostcode} className={inputClass} placeholder="Start typing your suburb…" /></div>
            <div><label htmlFor="postcode" className={labelClass}>Postcode</label>
              <input id="postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} className={inputClass} placeholder="e.g. 5605" maxLength={4} /></div>
          </div>
        </div>

        <div className="border border-black/5 bg-white p-5 space-y-4">
          <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-[#00B5AD]">What you&apos;re looking for</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label htmlFor="interestType" className={labelClass}>I&apos;m interested in…</label>
              <select id="interestType" value={interestType} onChange={(e) => setInterestType(e.target.value)} className={inputClass}>
                <option value="">— Select —</option>{INTEREST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label htmlFor="lotSizePref" className={labelClass}>Preferred lot size</label>
              <select id="lotSizePref" value={lotSizePref} onChange={(e) => setLotSizePref(e.target.value)} className={inputClass}>
                <option value="">— Select —</option>{LOT_SIZE_PREF.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div className="sm:col-span-2"><label htmlFor="budgetBand" className={labelClass}>Indicative budget</label>
              <select id="budgetBand" value={budgetBand} onChange={(e) => setBudgetBand(e.target.value)} className={inputClass}>
                <option value="">— Select —</option>{BUDGET_BANDS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
              <p className="font-archivo text-xs text-slate/60 mt-1">Helps us plan a mix people will actually buy — your budget guides the pricing, not the other way around.</p></div>
            <div><label htmlFor="buyerType" className={labelClass}>I am a…</label>
              <select id="buyerType" value={buyerType} onChange={(e) => setBuyerType(e.target.value)} className={inputClass}>
                <option value="">— Select —</option>{BUYER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label htmlFor="purchaseTimeline" className={labelClass}>When are you looking to buy?</label>
              <select id="purchaseTimeline" value={purchaseTimeline} onChange={(e) => setPurchaseTimeline(e.target.value)} className={inputClass}>
                <option value="">— Select —</option>{PURCHASE_TIMELINES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label htmlFor="financeStatus" className={labelClass}>Finance status</label>
              <select id="financeStatus" value={financeStatus} onChange={(e) => setFinanceStatus(e.target.value)} className={inputClass}>
                <option value="">— Select —</option>{FINANCE_STATUSES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label htmlFor="howHeard" className={labelClass}>How did you hear about us?</label>
              <select id="howHeard" value={howHeard} onChange={(e) => setHowHeard(e.target.value)} className={inputClass}>
                <option value="">— Select —</option>{HOW_HEARD.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          </div>
        </div>

        <div className="border border-black/5 bg-white p-5 space-y-4">
          <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-slate/50">Optional</p>
          <p className="font-archivo font-semibold text-deep-blue text-sm">Were you referred by an agent or other party?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label htmlFor="referrerType" className={labelClass}>Referrer type</label>
              <select id="referrerType" value={referrerType} onChange={(e) => { setReferrerType(e.target.value); setReferrerAgentId(""); }} className={inputClass}>
                <option value="">— None / not applicable —</option>{REFERRER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            {referrerType === "Real Estate Agent" && (
              <div><label htmlFor="referrerAgentId" className={labelClass}>Referring agent</label>
                <select id="referrerAgentId" value={referrerAgentId} className={inputClass}
                  onChange={(e) => {
                    const a = agents.find((x) => x.id === e.target.value);
                    setReferrerAgentId(e.target.value);
                    if (a) { setReferrerName(a.name); setReferrerCompany(a.agency || ""); }
                  }}>
                  <option value="">{agents.length ? "— Select your agent —" : "Loading agents…"}</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}{a.agency ? ` — ${a.agency}` : ""}</option>)}
                </select></div>
            )}
            {referrerType && referrerType !== "Real Estate Agent" && (
              <div><label htmlFor="referrerName" className={labelClass}>Referrer name</label>
                <input id="referrerName" value={referrerName} onChange={(e) => setReferrerName(e.target.value)} className={inputClass} placeholder="Who referred you?" /></div>
            )}
          </div>
        </div>

        <div><label htmlFor="notes" className={labelClass}>Notes / questions</label>
          <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="Anything you'd like us to know — preferences, questions, the kind of home you want…" /></div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 w-5 h-5 accent-[#00B5AD]" />
          <span className="text-sm text-slate font-archivo leading-relaxed">
            I understand this is a Registration of Interest only — no deposit or commitment is required
            or implied, and all details are indicative and subject to planning approval. I agree to be
            added to the Factory2Key database to receive Dutton Terrace updates.
          </span>
        </label>

        {error && <div className="bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-archivo">{error}</div>}

        <button type="submit" disabled={submitting || !consent}
          className="bg-[#00B5AD] hover:bg-[#009E97] text-white px-8 py-3 font-archivo font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto">
          {submitting ? "Submitting…" : "Register my interest"}
        </button>
      </form>
    </div>
  );
}
