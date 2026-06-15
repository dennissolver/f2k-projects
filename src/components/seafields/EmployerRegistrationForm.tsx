"use client";

import { useState } from "react";
import type { VoiceMessage } from "./EmployerVoiceAgent";

/**
 * Take-or-pay registration-of-interest form for local employers (Seafields). The "rent it"
 * piece of the /seafields/employers fork — the "own it" path never reaches this form (it
 * redirects to the main Seafields buyer registration). Same submit plumbing as the funder /
 * developer forms (JSON → service-role insert → Resend), same honeypot + consent + voice-
 * transcript capture, with a take-or-pay-specific field set.
 *
 * Take-or-pay is admin-handled — there is deliberately no agent attribution on this path.
 */

const inputClass =
  "w-full border border-black/10 px-4 py-2.5 font-archivo text-base text-deep-blue focus:outline-none focus:border-[#1B3A5B] transition-colors bg-white";
const labelClass =
  "block text-deep-blue font-semibold font-archivo text-sm mb-1";

const TERM_OPTIONS = [6, 12, 24, 36] as const;

type UnitPreference = "whole_house" | "by_room";

interface Props {
  voiceTranscript: VoiceMessage[];
  voiceConversationId: string | null;
  sourcePage: string;
  /** Switch the fork back to the "own it" redirect (used by the would-also-buy nudge). */
  onSwitchToOwnIt: () => void;
}

/** Standard ABN checksum (ATO weighting). Returns true for a structurally valid ABN. */
function isValidAbn(raw: string): boolean {
  const digits = raw.replace(/\s+/g, "");
  if (!/^\d{11}$/.test(digits)) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const sum = digits
    .split("")
    .map((d, i) => (i === 0 ? Number(d) - 1 : Number(d)) * weights[i])
    .reduce((a, b) => a + b, 0);
  return sum % 89 === 0;
}

export default function EmployerRegistrationForm({
  voiceTranscript,
  voiceConversationId,
  sourcePage,
  onSwitchToOwnIt,
}: Props) {
  const [businessName, setBusinessName] = useState("");
  const [abn, setAbn] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [staffCount, setStaffCount] = useState("");
  const [unitPreference, setUnitPreference] = useState<UnitPreference>("whole_house");
  const [quantity, setQuantity] = useState("");
  const [termMonths, setTermMonths] = useState<number>(12);
  const [startDate, setStartDate] = useState("");
  const [fifoRoles, setFifoRoles] = useState("");
  const [wouldConsiderBuying, setWouldConsiderBuying] = useState(false);

  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState(""); // bot trap — must stay empty

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quantityLabel =
    unitPreference === "whole_house" ? "How many whole houses?" : "How many rooms / beds?";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!businessName.trim() || !contactName.trim() || !email.trim()) {
      setError("Please complete your business name, contact name and email.");
      return;
    }
    if (abn.trim() && !isValidAbn(abn)) {
      setError("That ABN doesn't look right — please check it's the 11-digit number.");
      return;
    }
    if (!consent) {
      setError("Please acknowledge the registration-of-interest terms to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        business_name: businessName.trim(),
        abn: abn.trim() ? abn.replace(/\s+/g, "") : null,
        contact_name: contactName.trim(),
        contact_email: email.trim(),
        contact_phone: phone.trim() || null,
        staff_count: staffCount.trim() ? Number(staffCount) : null,
        unit_preference: unitPreference,
        quantity: quantity.trim() ? Number(quantity) : null,
        commitment_term_months: termMonths,
        required_start_date: startDate || null,
        fifo_roles_replaced: fifoRoles.trim() || null,
        would_consider_buying: wouldConsiderBuying,
        consent,
        source_page: sourcePage,
        voice_transcript: voiceTranscript,
        voice_conversation_id: voiceConversationId,
        hp_field: honeypot, // honeypot — server silently drops if filled (autofill-safe name)
      };

      const res = await fetch("/api/seafields/employer-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Registration failed. Please try again.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Registration failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="bg-white border border-black/5 p-8 text-center">
        <h3 className="font-archivo text-2xl font-black text-deep-blue mb-2">
          Interest registered
        </h3>
        <p className="font-archivo text-slate leading-relaxed max-w-md mx-auto">
          Thank you. We&apos;ve recorded {businessName.trim()}&apos;s take-or-pay interest for
          Seafields staff accommodation. Dennis will be in touch to size the demand and walk
          through the commercial terms. This was a registration of interest only — it creates
          no obligation on either side.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-black/5 p-6 sm:p-8 space-y-8">
      {/* Explanatory header (per the UI EXPLANATORY HEADER rule) */}
      <div>
        <h3 className="font-archivo text-2xl font-black text-deep-blue mb-1">
          Reserve staff beds — take-or-pay
        </h3>
        <p className="font-archivo text-sm text-slate leading-relaxed">
          Tell us how many beds you&apos;d commit to and for how long. A take-or-pay commitment
          reserves a set number of beds for a fixed term — that guaranteed demand is what lets us
          build local housing so your people stop flying in and out. This is a registration of
          interest only — not a lease, and not an offer.
        </p>
      </div>

      {/* Your business */}
      <fieldset className="space-y-4">
        <legend className={labelClass}>Your business</legend>
        <div>
          <label className={labelClass} htmlFor="business_name">
            Business name *
          </label>
          <input
            id="business_name"
            className={inputClass}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            autoComplete="organization"
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="abn">
            ABN
          </label>
          <input
            id="abn"
            className={inputClass}
            value={abn}
            onChange={(e) => setAbn(e.target.value)}
            inputMode="numeric"
            placeholder="11-digit ABN"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="contact_name">
              Contact full name *
            </label>
            <input
              id="contact_name"
              className={inputClass}
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="email">
              Contact email *
            </label>
            <input
              id="email"
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="phone">
              Contact phone
            </label>
            <input
              id="phone"
              type="tel"
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="staff_count">
              Staff needing accommodation
            </label>
            <input
              id="staff_count"
              type="number"
              min={1}
              className={inputClass}
              value={staffCount}
              onChange={(e) => setStaffCount(e.target.value)}
              placeholder="e.g. 8"
            />
          </div>
        </div>
      </fieldset>

      {/* What you'd commit to */}
      <fieldset className="space-y-4">
        <legend className={labelClass}>What you&apos;d commit to (the &ldquo;take&rdquo;)</legend>

        <div className="grid sm:grid-cols-2 gap-3">
          {(
            [
              {
                key: "whole_house" as const,
                title: "Whole house(s)",
                blurb: "Reserve entire homes for your team.",
              },
              {
                key: "by_room" as const,
                title: "By the room",
                blurb: "Reserve individual rooms / beds.",
              },
            ]
          ).map((opt) => (
            <label
              key={opt.key}
              className={`cursor-pointer border p-4 transition-colors ${
                unitPreference === opt.key
                  ? "border-[#1B3A5B] bg-[#1B3A5B]/[0.04]"
                  : "border-black/10 hover:border-black/30"
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="unitPreference"
                  checked={unitPreference === opt.key}
                  onChange={() => setUnitPreference(opt.key)}
                  className="accent-[#1B3A5B]"
                />
                <span className="font-archivo font-bold text-deep-blue">{opt.title}</span>
              </span>
              <span className="block font-archivo text-sm text-slate mt-1">{opt.blurb}</span>
            </label>
          ))}
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass} htmlFor="quantity">
              {quantityLabel}
            </label>
            <input
              id="quantity"
              type="number"
              min={1}
              className={inputClass}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="term_months">
              Commitment term
            </label>
            <select
              id="term_months"
              className={inputClass}
              value={termMonths}
              onChange={(e) => setTermMonths(Number(e.target.value))}
            >
              {TERM_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t} months
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="start_date">
              Required start date
            </label>
            <input
              id="start_date"
              type="date"
              className={inputClass}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="fifo_roles">
            FIFO roles this would replace (optional)
          </label>
          <textarea
            id="fifo_roles"
            className={`${inputClass} min-h-[90px]`}
            placeholder="Which fly-in/fly-out roles could become local if housing existed? This helps us show funders the demand is real."
            value={fifoRoles}
            onChange={(e) => setFifoRoles(e.target.value)}
          />
        </div>
      </fieldset>

      {/* Would also consider buying — nudge back to the own-it path */}
      <label className="flex gap-3 items-start border border-[#C77F3A]/40 bg-[#FBF4E6] p-4 cursor-pointer">
        <input
          type="checkbox"
          checked={wouldConsiderBuying}
          onChange={(e) => setWouldConsiderBuying(e.target.checked)}
          className="mt-1 accent-[#1B3A5B] h-4 w-4 shrink-0"
        />
        <span className="font-archivo text-sm text-[#5b4a2a] leading-relaxed">
          We&apos;d also consider <strong>buying</strong> a house-and-land package for staff.
          {wouldConsiderBuying && (
            <>
              {" "}
              <button
                type="button"
                onClick={onSwitchToOwnIt}
                className="underline text-[#1B3A5B] font-semibold"
              >
                Register to buy instead →
              </button>{" "}
              (or finish the take-or-pay form below — we&apos;ll cover both).
            </>
          )}
        </span>
      </label>

      {/* Consent */}
      <label className="flex gap-3 items-start cursor-pointer">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 accent-[#1B3A5B] h-4 w-4 shrink-0"
        />
        <span className="font-archivo text-sm text-slate leading-relaxed">
          I understand this is a registration of interest only, is not a lease or an offer,
          creates no obligation on either side, and that any take-or-pay commitment is subject to
          formal documentation. *
        </span>
      </label>

      {/* Honeypot — visually hidden, must stay empty */}
      <div className="absolute left-[-9999px]" aria-hidden>
        <label htmlFor="hp_field">Leave this field empty</label>
        <input
          id="hp_field"
          name="hp_field"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 font-archivo text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto bg-[#1B3A5B] hover:bg-[#142C44] text-white px-8 py-3 font-archivo font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Registering…" : "Register take-or-pay interest"}
      </button>
    </form>
  );
}
