"use client";

import { useMemo, useState } from "react";
import type { VoiceMessage } from "./FunderVoiceAgent";
import {
  type ProjectFundingModel,
  JUNIOR_MIN_PCT,
  JUNIOR_MAX_PCT,
  SENIOR_PCT,
  seniorAmount,
  juniorAmount,
} from "@/data/funding";

/**
 * Funder registration-of-interest form (per-project funder pages). The funder analog of the
 * developer onboarding form: same submit plumbing (FormData → /api/funders/register → service-
 * role insert → Resend), same honeypot + consent + voice-transcript capture, restyled for the
 * funder audience. Senior/junior choice drives the indicative-participation fields.
 *
 * Directed to registered Australian banks (ADIs) only — the registered-bank confirmation is a
 * hard gate (the brief §9 gate), and the consent wording is funder-specific (NOT the buyer copy).
 */

const fmt0 = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

const inputClass =
  "w-full border border-black/10 px-4 py-2.5 font-archivo text-base text-deep-blue focus:outline-none focus:border-[#1B3A5B] transition-colors bg-white";
const labelClass =
  "block text-deep-blue font-semibold font-archivo text-sm mb-1";

interface Props {
  project: ProjectFundingModel;
  voiceTranscript: VoiceMessage[];
  voiceConversationId: string | null;
  sourcePage: string;
}

type LenderType = "senior" | "junior";

export default function FunderRegistrationForm({
  project,
  voiceTranscript,
  voiceConversationId,
  sourcePage,
}: Props) {
  const [lenderType, setLenderType] = useState<LenderType>("senior");
  const [juniorPct, setJuniorPct] = useState<number>(JUNIOR_MIN_PCT);

  const [orgName, setOrgName] = useState("");
  const [contactName, setContactName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [division, setDivision] = useState("");
  const [preferredStructure, setPreferredStructure] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [bankConfirmed, setBankConfirmed] = useState(false);
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState(""); // bot trap — must stay empty

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Indicative participation, derived from the project's package.
  const { indicativePct, indicativeAmount } = useMemo(() => {
    if (lenderType === "senior") {
      return {
        indicativePct: SENIOR_PCT,
        indicativeAmount: seniorAmount(project.package_amount),
      };
    }
    return {
      indicativePct: juniorPct,
      indicativeAmount: juniorAmount(project.package_amount, juniorPct),
    };
  }, [lenderType, juniorPct, project.package_amount]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!orgName.trim() || !contactName.trim() || !roleTitle.trim() || !email.trim()) {
      setError("Please complete your bank name, contact name, role and email.");
      return;
    }
    if (!bankConfirmed) {
      setError(
        "Please confirm your institution is a registered Australian bank / APRA-authorised ADI.",
      );
      return;
    }
    if (!consent) {
      setError("Please acknowledge the registration-of-interest terms to continue.");
      return;
    }
    if (
      lenderType === "junior" &&
      (juniorPct < JUNIOR_MIN_PCT || juniorPct > JUNIOR_MAX_PCT)
    ) {
      setError(`A junior tranche is between ${JUNIOR_MIN_PCT}% and ${JUNIOR_MAX_PCT}%.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        project_slug: project.slug,
        lender_type: lenderType,
        org_name: orgName.trim(),
        contact_name: contactName.trim(),
        role_title: roleTitle.trim(),
        email: email.trim(),
        mobile: mobile.trim() || null,
        division: division.trim() || null,
        registered_bank_confirmed: bankConfirmed,
        indicative_pct: indicativePct,
        indicative_amount: Math.round(indicativeAmount),
        package_amount_at_submit: project.package_amount,
        preferred_structure: preferredStructure.trim() || null,
        consent,
        source_page: sourcePage,
        voice_transcript: voiceTranscript,
        voice_conversation_id: voiceConversationId,
        hp_field: honeypot, // honeypot — server silently drops if filled (autofill-safe name)
      };

      const formData = new FormData();
      formData.set("data", JSON.stringify(payload));
      if (file) formData.set("file", file);

      const res = await fetch("/api/funders/register", {
        method: "POST",
        body: formData,
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
          Thank you. We&apos;ve recorded {orgName.trim()}&apos;s indicative interest in{" "}
          {project.name} as a {lenderType} lender. Dennis will be in touch to walk
          through the term sheet and next steps. This was a registration of interest
          only — it creates no obligation on either side.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-black/5 p-6 sm:p-8 space-y-8">
      {/* Explanatory header (per the UI EXPLANATORY HEADER rule) */}
      <div>
        <h3 className="font-archivo text-2xl font-black text-deep-blue mb-1">
          Register your interest — {project.name}
        </h3>
        <p className="font-archivo text-sm text-slate leading-relaxed">
          For registered Australian banks (APRA-authorised ADIs). Indicate a senior or
          junior position in {project.name}&apos;s funding package. This is a registration
          of interest only — not an offer, and not financial product advice.
        </p>
      </div>

      {/* Registering as */}
      <fieldset className="space-y-3">
        <legend className={labelClass}>Registering as</legend>
        <div className="grid sm:grid-cols-2 gap-3">
          {(
            [
              {
                key: "senior" as const,
                title: "Senior lender",
                blurb: "50% of the package + first right of refusal on the retail mortgage book.",
              },
              {
                key: "junior" as const,
                title: "Junior lender",
                blurb: `${JUNIOR_MIN_PCT}–${JUNIOR_MAX_PCT}% of the package (sharing the remaining 50%).`,
              },
            ]
          ).map((opt) => (
            <label
              key={opt.key}
              className={`cursor-pointer border p-4 transition-colors ${
                lenderType === opt.key
                  ? "border-[#1B3A5B] bg-[#1B3A5B]/[0.04]"
                  : "border-black/10 hover:border-black/30"
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="lenderType"
                  checked={lenderType === opt.key}
                  onChange={() => setLenderType(opt.key)}
                  className="accent-[#1B3A5B]"
                />
                <span className="font-archivo font-bold text-deep-blue">{opt.title}</span>
              </span>
              <span className="block font-archivo text-sm text-slate mt-1">{opt.blurb}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Your bank */}
      <fieldset className="space-y-4">
        <legend className={labelClass}>Your bank</legend>
        <div>
          <label className={labelClass} htmlFor="org_name">
            Registered Australian bank / institution name *
          </label>
          <input
            id="org_name"
            className={inputClass}
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            autoComplete="organization"
            required
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
            <label className={labelClass} htmlFor="role_title">
              Role / title *
            </label>
            <input
              id="role_title"
              className={inputClass}
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="email">
              Email * (bank-domain email expected)
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
            <label className={labelClass} htmlFor="mobile">
              Mobile
            </label>
            <input
              id="mobile"
              type="tel"
              className={inputClass}
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              autoComplete="tel"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="division">
              Division / desk
            </label>
            <input
              id="division"
              className={inputClass}
              placeholder="e.g. development finance, institutional"
              value={division}
              onChange={(e) => setDivision(e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      {/* Bank confirmation gate */}
      <label className="flex gap-3 items-start border border-[#C77F3A]/40 bg-[#FBF4E6] p-4 cursor-pointer">
        <input
          type="checkbox"
          required
          checked={bankConfirmed}
          onChange={(e) => setBankConfirmed(e.target.checked)}
          className="mt-1 accent-[#1B3A5B] h-4 w-4 shrink-0"
        />
        <span className="font-archivo text-sm text-[#5b4a2a] leading-relaxed">
          I confirm <strong>{orgName.trim() || "your institution"}</strong> is a registered
          Australian bank / APRA-authorised ADI, and I am authorised to register this
          interest on its behalf. *
        </span>
      </label>

      {/* Indicative participation */}
      <fieldset className="space-y-4">
        <legend className={labelClass}>Your indicative participation</legend>
        {lenderType === "senior" ? (
          <div className="bg-off-white border border-black/5 p-4">
            <p className="font-archivo text-sm text-slate">
              Senior position — <strong className="text-deep-blue">50% of the funding package</strong>
            </p>
            <p className="font-ibm-mono text-2xl font-bold text-deep-blue mt-1">
              {fmt0(indicativeAmount)}
            </p>
            <p className="font-archivo text-xs text-slate/70 mt-1">
              Plus first right of refusal on the retail mortgage lending for {project.name}.
              Read-only — derived from the project package.
            </p>
          </div>
        ) : (
          <div className="bg-off-white border border-black/5 p-4">
            <div className="flex items-baseline justify-between">
              <label className="font-archivo text-sm text-slate" htmlFor="junior_pct">
                Indicative tranche — {indicativePct}% of the package
              </label>
              <span className="font-ibm-mono text-2xl font-bold text-deep-blue">
                {fmt0(indicativeAmount)}
              </span>
            </div>
            <input
              id="junior_pct"
              type="range"
              min={JUNIOR_MIN_PCT}
              max={JUNIOR_MAX_PCT}
              step={1}
              value={juniorPct}
              onChange={(e) => setJuniorPct(Number(e.target.value))}
              className="w-full mt-3 accent-[#1B3A5B]"
            />
            <p className="font-archivo text-xs text-slate/70 mt-1">
              Junior tranches are {JUNIOR_MIN_PCT}–{JUNIOR_MAX_PCT}% of the package (sharing
              the remaining 50%). Capital return per the facility terms; no retail FRoR.
            </p>
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="preferred_structure">
            Preferred structure / conditions
          </label>
          <textarea
            id="preferred_structure"
            className={`${inputClass} min-h-[110px]`}
            placeholder="How you'd like to participate, and any conditions."
            value={preferredStructure}
            onChange={(e) => setPreferredStructure(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="file">
            Mandate / term sheet / capacity statement (optional, PDF)
          </label>
          <input
            id="file"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full font-archivo text-sm text-slate file:mr-4 file:py-2 file:px-4 file:border-0 file:bg-[#1B3A5B] file:text-white file:font-semibold file:cursor-pointer"
          />
        </div>
      </fieldset>

      {/* Project (prefilled + locked) */}
      <div className="font-archivo text-sm text-slate">
        Project: <strong className="text-deep-blue">{project.name}</strong> — {project.location}{" "}
        <span className="text-slate/60">(prefilled from this page)</span>
      </div>

      {/* Consent — funder-specific wording */}
      <label className="flex gap-3 items-start cursor-pointer">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 accent-[#1B3A5B] h-4 w-4 shrink-0"
        />
        <span className="font-archivo text-sm text-slate leading-relaxed">
          I understand this is a registration of interest only, is not an offer or invitation,
          creates no obligation on either side, and that any participation is subject to formal
          documentation and due diligence. See the{" "}
          <a href="/funders/terms" className="text-[#1B3A5B] underline">
            funder terms
          </a>
          . Factory2Key may email me an acknowledgement and further information about
          this offer, and I can unsubscribe at any time. *
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
        {submitting ? "Registering…" : "Register my interest"}
      </button>
    </form>
  );
}
