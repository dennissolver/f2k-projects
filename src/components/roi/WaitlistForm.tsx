"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ROI portal — artefact 1: the light waitlist form (spec §7).
 *
 * Deliberately minimal (name / mobile / email / category + consent) — top of funnel.
 * Attribution is NOT a field here: it's carried by the signed first-touch cookie the
 * resolver set and read server-side on submit. We surface the attributed agent (if any)
 * read-only so the buyer sees who introduced them.
 */

const CATEGORIES = [
  { value: "owner-occupier", label: "Owner-occupier" },
  { value: "investor", label: "Investor" },
  { value: "first-home-buyer", label: "First home buyer" },
] as const;

export default function WaitlistForm({
  estate,
  estateName,
}: {
  estate: string;
  estateName: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [category, setCategory] = useState("");
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentContact, setConsentContact] = useState(true);
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attribution, setAttribution] = useState<{
    agentName: string;
    agencyName: string | null;
  } | null>(null);

  const formLoadedAt = useRef<number>(Date.now());

  // Surface the introducing agent (resolved server-side from the HttpOnly cookie).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/roi/first-touch?estate=${encodeURIComponent(estate)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.attributed) {
          setAttribution({ agentName: d.agentName, agencyName: d.agencyName });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [estate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!category) {
      setError("Please choose what best describes you.");
      return;
    }
    if (!consentPrivacy) {
      setError("Please acknowledge the privacy collection notice to continue.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/roi/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estate,
          name: name.trim(),
          email: email.trim(),
          mobile: mobile.trim() || null,
          buyer_category: category,
          consent_privacy: true,
          consent_contact: consentContact,
          hp_field: honeypot,
          elapsed_ms: Date.now() - formLoadedAt.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full border border-slate-300 rounded-lg px-4 py-3 min-h-[48px] text-base focus:outline-none focus:border-[#00B5AD] focus:ring-1 focus:ring-[#00B5AD]";

  if (success) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
        <div className="text-3xl mb-3">✓</div>
        <h3 className="text-xl font-bold text-[#1A2744] mb-2">You&apos;re on the waitlist</h3>
        <p className="text-slate-600 text-base leading-relaxed">
          Thanks for registering your interest in {estateName}. We&apos;ll keep you updated, and
          when you&apos;re ready{attribution ? ` ${attribution.agentName}` : " your agent"} will help
          you note your preferred home(s) and terms. No deposit, no obligation — we&apos;ve sent a
          confirmation to your inbox.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
      {/* Explanatory header (PRODUCT_STANDARDS §5) */}
      <h2 className="text-2xl font-bold text-[#1A2744] mb-1">Register your interest</h2>
      <p className="text-slate-600 text-base leading-relaxed mb-5">
        Join the {estateName} waitlist to receive updates as the development progresses. It takes a
        minute — no deposit and no obligation. When you&apos;re ready, your agent will help you
        register a preferred home.
      </p>

      {attribution && (
        <div className="mb-5 rounded-lg bg-[#E6FAF9] border border-[#00B5AD]/30 px-4 py-3 text-sm text-[#0F5C57]">
          You&apos;re registering via <strong>{attribution.agentName}</strong>
          {attribution.agencyName ? ` — ${attribution.agencyName}` : ""}.
        </div>
      )}

      {error && (
        <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="wl-name" className="block text-sm font-semibold text-slate-700 mb-1">
            Full name *
          </label>
          <input
            id="wl-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Jane Smith"
            autoComplete="name"
          />
        </div>

        <div>
          <label htmlFor="wl-email" className="block text-sm font-semibold text-slate-700 mb-1">
            Email *
          </label>
          <input
            id="wl-email"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="jane@example.com"
            autoComplete="email"
          />
        </div>

        <div>
          <label htmlFor="wl-mobile" className="block text-sm font-semibold text-slate-700 mb-1">
            Mobile
          </label>
          <input
            id="wl-mobile"
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className={inputClass}
            placeholder="0400 000 000"
            autoComplete="tel"
          />
        </div>

        <div>
          <span className="block text-sm font-semibold text-slate-700 mb-2">
            What best describes you? *
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <label
                key={c.value}
                className={`flex items-center justify-center gap-2 border rounded-lg px-3 py-3 min-h-[48px] text-sm cursor-pointer text-center ${
                  category === c.value
                    ? "border-[#00B5AD] bg-[#E6FAF9] text-[#0F5C57] font-semibold"
                    : "border-slate-300 text-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="buyer_category"
                  value={c.value}
                  checked={category === c.value}
                  onChange={() => setCategory(c.value)}
                  className="sr-only"
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        {/* Honeypot — autofill-neutral name, off-screen; server accepts any value + no-ops. */}
        <input
          type="text"
          name="hp_field"
          id="hp_field"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
        />

        <label className="flex items-start gap-3 text-sm text-slate-600 leading-relaxed cursor-pointer">
          <input
            type="checkbox"
            checked={consentPrivacy}
            onChange={(e) => setConsentPrivacy(e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0"
          />
          <span>
            I&apos;ve read the collection notice: Factory2Key Pty Ltd (or such entity as is
            subsequently named by Factory2Key Pty Ltd) collects this information to register my
            interest and contact me about {estateName}. It may be disclosed to the introducing
            agency and the vendor. See the{" "}
            <a href="/privacy" className="text-[#00B5AD] underline">
              privacy policy
            </a>{" "}
            for access/correction. *
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm text-slate-600 leading-relaxed cursor-pointer">
          <input
            type="checkbox"
            checked={consentContact}
            onChange={(e) => setConsentContact(e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0"
          />
          <span>Keep me updated about {estateName} by email and SMS.</span>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#1A2744] hover:bg-[#24365f] text-white font-semibold px-6 py-3.5 min-h-[48px] rounded-lg text-base disabled:opacity-50 transition-colors"
        >
          {submitting ? "Registering…" : "Join the waitlist"}
        </button>
      </form>
    </div>
  );
}
