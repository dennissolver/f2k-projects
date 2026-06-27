"use client";

import { useMemo, useRef, useState } from "react";
import {
  PURCHASER_ENTITY_TYPES,
  FINANCE_STATUSES,
  CONTACT_METHODS,
  DEPOSIT_OPTIONS,
} from "@/lib/roi/estate-config";

export type UnitOption = { number: number; label: string };

/**
 * ROI portal — artefact 2: the qualification (EOI) form, sections A–F (spec §7).
 * Pre-attributed + pre-filled (the page resolved the waitlist record from the signed token).
 * Attribution is not shown/editable here — it's copied server-side from the waitlist record.
 */
export default function QualificationForm({
  token,
  estateName,
  units,
  colours,
  prefill,
}: {
  token: string;
  estateName: string;
  units: UnitOption[];
  colours: string[];
  prefill: { full_name: string; email: string; mobile: string; buyer_category: string };
}) {
  // A
  const [fullName, setFullName] = useState(prefill.full_name);
  const [applicantsCount, setApplicantsCount] = useState(1);
  const [applicant2, setApplicant2] = useState("");
  const [mobile, setMobile] = useState(prefill.mobile);
  const [email, setEmail] = useState(prefill.email);
  const [postal, setPostal] = useState("");
  const [buyerCategory, setBuyerCategory] = useState(prefill.buyer_category);
  const [entityType, setEntityType] = useState("");
  const [contactMethod, setContactMethod] = useState("");
  // B — three ranked preferences
  const [pref1, setPref1] = useState("");
  const [pref2, setPref2] = useState("");
  const [pref3, setPref3] = useState("");
  // C
  const [price, setPrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [depositOther, setDepositOther] = useState("");
  const [financeStatus, setFinanceStatus] = useState("");
  const [lender, setLender] = useState("");
  const [amountLvr, setAmountLvr] = useState("");
  const [subjectToFinance, setSubjectToFinance] = useState("");
  const [approvalDays, setApprovalDays] = useState("");
  const [settlement, setSettlement] = useState("");
  const [comments, setComments] = useState("");
  // D
  const [colour, setColour] = useState("");
  // E
  const [ackEoi, setAckEoi] = useState(false);
  const [ackNonbinding, setAckNonbinding] = useState(false);
  const [ackPrivacy, setAckPrivacy] = useState(false);
  const [consentContact, setConsentContact] = useState(true);
  // F
  const [signature, setSignature] = useState("");
  const [signDate, setSignDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formLoadedAt = useRef<number>(Date.now());

  const rankedUnits = useMemo(() => {
    const seen = new Set<number>();
    const out: number[] = [];
    for (const v of [pref1, pref2, pref3]) {
      if (!v) continue;
      const n = Number(v);
      if (!Number.isNaN(n) && !seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    }
    return out;
  }, [pref1, pref2, pref3]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (rankedUnits.length === 0) return setError("Please select at least one preferred home.");
    if (!entityType) return setError("Please choose the purchaser entity type.");
    if (!contactMethod) return setError("Please choose a preferred contact method.");
    if (!deposit) return setError("Please choose a deposit option.");
    if (deposit === "Other" && (!depositOther || Number(depositOther) < 5))
      return setError("Deposit must be at least 5%.");
    if (!financeStatus) return setError("Please choose your finance status.");
    if (!subjectToFinance) return setError("Please indicate if the purchase is subject to finance.");
    if (!ackEoi || !ackNonbinding || !ackPrivacy)
      return setError("Please tick all three acknowledgements to submit.");
    if (!signature.trim()) return setError("Please type your name to confirm.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/roi/qualification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          full_name: fullName.trim(),
          applicants_count: applicantsCount,
          applicant2_name: applicant2.trim() || null,
          mobile: mobile.trim() || null,
          email: email.trim(),
          postal_address: postal.trim() || null,
          buyer_category: buyerCategory || null,
          purchaser_entity_type: entityType,
          preferred_contact_method: contactMethod,
          ranked_unit_numbers: rankedUnits,
          indicative_price: price ? Math.round(Number(price.replace(/[^0-9]/g, ""))) || null : null,
          deposit_option: deposit,
          deposit_other_pct: deposit === "Other" ? Number(depositOther) : null,
          finance_status: financeStatus,
          lender_broker: lender.trim() || null,
          estimated_amount_or_lvr: amountLvr.trim() || null,
          subject_to_finance: subjectToFinance,
          finance_approval_days: approvalDays || null,
          settlement_timing: settlement.trim() || null,
          special_comments: comments.trim() || null,
          colour_scheme: colour || null,
          consent_eoi_only: ackEoi,
          consent_nonbinding: ackNonbinding,
          consent_privacy: ackPrivacy,
          consent_contact: consentContact,
          signature_name: signature.trim(),
          signature_date: signDate,
          hp_field: honeypot,
          elapsed_ms: Date.now() - formLoadedAt.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error || "Something went wrong. Please try again.");
      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const input =
    "w-full border border-slate-300 rounded-lg px-4 py-3 min-h-[48px] text-base focus:outline-none focus:border-[#00B5AD] focus:ring-1 focus:ring-[#00B5AD]";
  const lbl = "block text-sm font-semibold text-slate-700 mb-1";
  const sectionTitle = "text-lg font-bold text-[#1A2744] border-b border-slate-200 pb-2 mb-4";

  if (success) {
    return (
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
        <div className="text-3xl mb-3">✓</div>
        <h3 className="text-xl font-bold text-[#1A2744] mb-2">Registration received</h3>
        <p className="text-slate-600 text-base leading-relaxed">
          Thank you. We&apos;ve recorded your preferences for {estateName}. This is an expression of
          interest only — non-binding, no deposit. Your agent and the Factory2Key team will be in
          touch, and we&apos;ve emailed you a confirmation.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
      <p className="text-slate-600 text-base leading-relaxed mb-6">
        Complete the sections below to register your preferred home(s) and indicative terms for{" "}
        {estateName}. All figures are indicative and non-binding.
      </p>

      {error && (
        <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-8">
        {/* A. Applicant */}
        <div>
          <h3 className={sectionTitle}>Your details</h3>
          <div className="space-y-4">
            <div>
              <label className={lbl}>Full name *</label>
              <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={input} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Number of applicants</label>
                <select value={applicantsCount} onChange={(e) => setApplicantsCount(Number(e.target.value))} className={input}>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </div>
              {applicantsCount === 2 && (
                <div>
                  <label className={lbl}>Second applicant&apos;s name</label>
                  <input value={applicant2} onChange={(e) => setApplicant2(e.target.value)} className={input} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Mobile</label>
                <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} className={input} />
              </div>
              <div>
                <label className={lbl}>Email *</label>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
              </div>
            </div>
            <div>
              <label className={lbl}>Postal address</label>
              <input value={postal} onChange={(e) => setPostal(e.target.value)} className={input} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Purchaser entity *</label>
                <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className={input}>
                  <option value="">Select…</option>
                  {PURCHASER_ENTITY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Preferred contact *</label>
                <select value={contactMethod} onChange={(e) => setContactMethod(e.target.value)} className={input}>
                  <option value="">Select…</option>
                  {CONTACT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* B. Preferred homes */}
        <div>
          <h3 className={sectionTitle}>Preferred home(s) — rank up to three</h3>
          <div className="space-y-3">
            {[
              { v: pref1, set: setPref1, label: "1st preference *" },
              { v: pref2, set: setPref2, label: "2nd preference" },
              { v: pref3, set: setPref3, label: "3rd preference" },
            ].map((p, i) => (
              <div key={i}>
                <label className={lbl}>{p.label}</label>
                <select value={p.v} onChange={(e) => p.set(e.target.value)} className={input}>
                  <option value="">Select a home…</option>
                  {units.map((u) => (
                    <option key={u.number} value={u.number}>{u.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* C. Commercial terms */}
        <div>
          <h3 className={sectionTitle}>Indicative terms</h3>
          <div className="space-y-4">
            <div>
              <label className={lbl}>Indicative price (leave blank for POA)</label>
              <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className={input} placeholder="$" />
            </div>
            <div>
              <span className={lbl}>Deposit *</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DEPOSIT_OPTIONS.map((opt) => (
                  <label key={opt} className={`flex items-center justify-center border rounded-lg px-3 py-3 min-h-[48px] text-sm cursor-pointer ${deposit === opt ? "border-[#00B5AD] bg-[#E6FAF9] text-[#0F5C57] font-semibold" : "border-slate-300 text-slate-700"}`}>
                    <input type="radio" name="deposit" value={opt} checked={deposit === opt} onChange={() => setDeposit(opt)} className="sr-only" />
                    {opt}
                  </label>
                ))}
              </div>
              {deposit === "Other" && (
                <input inputMode="decimal" value={depositOther} onChange={(e) => setDepositOther(e.target.value)} className={`${input} mt-2`} placeholder="Deposit % (min 5)" />
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Finance status *</label>
                <select value={financeStatus} onChange={(e) => setFinanceStatus(e.target.value)} className={input}>
                  <option value="">Select…</option>
                  {FINANCE_STATUSES.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Subject to finance? *</label>
                <select value={subjectToFinance} onChange={(e) => setSubjectToFinance(e.target.value)} className={input}>
                  <option value="">Select…</option>
                  <option value="Y">Yes</option>
                  <option value="N">No</option>
                  <option value="TBC">TBC</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Lender / broker</label>
                <input value={lender} onChange={(e) => setLender(e.target.value)} className={input} />
              </div>
              <div>
                <label className={lbl}>Estimated amount or LVR</label>
                <input value={amountLvr} onChange={(e) => setAmountLvr(e.target.value)} className={input} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Finance approval period</label>
                <select value={approvalDays} onChange={(e) => setApprovalDays(e.target.value)} className={input}>
                  <option value="">Select…</option>
                  <option value="30 days">30 days</option>
                  <option value="45 days">45 days</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Settlement timing</label>
                <input value={settlement} onChange={(e) => setSettlement(e.target.value)} className={input} placeholder="e.g. 30 days from registration of the strata plan" />
              </div>
            </div>
            <div>
              <label className={lbl}>Special comments</label>
              <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} className={input} />
            </div>
          </div>
        </div>

        {/* D. Colour scheme */}
        {colours.length > 0 && (
          <div>
            <h3 className={sectionTitle}>Colour scheme</h3>
            <select value={colour} onChange={(e) => setColour(e.target.value)} className={input}>
              <option value="">No preference</option>
              {colours.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {/* E. Acknowledgements */}
        <div>
          <h3 className={sectionTitle}>Acknowledgements</h3>
          <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={ackEoi} onChange={(e) => setAckEoi(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
              <span>I understand this is an expression of interest only — not a contract, option, reservation, offer, acceptance, or agreement for lease. *</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={ackNonbinding} onChange={(e) => setAckNonbinding(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
              <span>I understand this does not oblige the developer/vendor and related parties to sell or reserve a home, no money is payable, all figures are indicative, and it is binding only on a signed, exchanged contract. *</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={ackPrivacy} onChange={(e) => setAckPrivacy(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
              <span>I consent to Factory2Key Pty Ltd (or such entity as is subsequently named by Factory2Key Pty Ltd), its related parties, the introducing agency, and Factory2Key on the agent&apos;s behalf collecting and using this information per the{" "}
                <a href="/privacy" className="text-[#00B5AD] underline">privacy policy</a>. *</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={consentContact} onChange={(e) => setConsentContact(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
              <span>Keep me updated about {estateName} by my preferred contact method.</span>
            </label>
          </div>
        </div>

        {/* F. Signature */}
        <div>
          <h3 className={sectionTitle}>Confirm</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Type your full name to confirm *</label>
              <input value={signature} onChange={(e) => setSignature(e.target.value)} className={input} />
            </div>
            <div>
              <label className={lbl}>Date</label>
              <input type="date" value={signDate} onChange={(e) => setSignDate(e.target.value)} className={input} />
            </div>
          </div>
        </div>

        {/* Honeypot */}
        <input
          type="text"
          name="hp_field"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#1A2744] hover:bg-[#24365f] text-white font-semibold px-6 py-3.5 min-h-[48px] rounded-lg text-base disabled:opacity-50 transition-colors"
        >
          {submitting ? "Submitting…" : "Submit registration"}
        </button>
      </form>
    </div>
  );
}
