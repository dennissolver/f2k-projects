"use client";

import { useRef, useState } from "react";
import SuburbAutocomplete from "@/components/SuburbAutocomplete";
import type { VoiceMessage } from "./DeveloperVoiceAgent";

const SUBMITTER_ROLES = [
  "Developer",
  "Land owner",
  "Real estate agent / broker",
  "Builder",
  "Other",
] as const;

const SITE_CONTROL = [
  "Owned outright",
  "Under option or contract",
  "Currently negotiating",
  "Not yet secured",
  "Not sure",
] as const;

const ZONING_STATUSES = [
  "Zoned residential — ready",
  "Zoning / rezoning in progress",
  "Development application lodged",
  "Development approval granted",
  "Concept / feasibility stage",
  "Raw land — not yet zoned",
  "Other / not sure",
] as const;

const DEAL_PREFERENCES = [
  "Outright sale to F2K",
  "Joint venture / profit share",
  "Staged delivery",
  "Build-to-rent",
  "Open to options — let's talk",
] as const;

// Deterministic intake — the developer self-classifies so the page + funder summary don't guess.
const ARCHETYPES = [
  { value: "subdivision", label: "Land subdivision — selling lots" },
  { value: "house_and_land", label: "Set house & land — defined homes" },
  { value: "mixed_use", label: "Mixed-use master-plan — homes + childcare / aged-care / commercial etc." },
  { value: "unsure", label: "Not sure — help me work it out" },
] as const;

const TARGET_MARKETS = [
  "First-home buyers", "Investors", "Downsizers", "Families / next-home buyers",
  "Retirees", "Essential / government workers", "Owner-occupiers",
] as const;

const LAND_USES = [
  "Residential lots", "Childcare centre", "Aged-care facility", "Commercial / town centre",
  "School / education", "Recreation / parks", "Tourism / short-stay", "Community facility",
] as const;

interface Props {
  voiceTranscript: VoiceMessage[];
  voiceConversationId?: string | null;
}

export default function DeveloperOnboardingForm({
  voiceTranscript,
  voiceConversationId,
}: Props) {
  const [submitterRole, setSubmitterRole] = useState("");
  const [developerName, setDeveloperName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [website, setWebsite] = useState("");
  const [estateName, setEstateName] = useState("");
  const [estateLocation, setEstateLocation] = useState("");
  const [estatePostcode, setEstatePostcode] = useState("");
  // Captured when the user PICKS a location suggestion (precise geocode); cleared on free-typing.
  const [estateState, setEstateState] = useState("");
  const [estateLat, setEstateLat] = useState<number | null>(null);
  const [estateLng, setEstateLng] = useState<number | null>(null);
  const [lotPlanReference, setLotPlanReference] = useState("");
  const [siteAreaValue, setSiteAreaValue] = useState("");
  const [siteAreaUnit, setSiteAreaUnit] = useState("ha");
  const [dwellingsEnvisaged, setDwellingsEnvisaged] = useState("");
  const [zoningStatus, setZoningStatus] = useState("");
  const [siteControl, setSiteControl] = useState("");
  const [vision, setVision] = useState("");
  const [dealPreference, setDealPreference] = useState("");
  const [dealNotes, setDealNotes] = useState("");
  // Land owner details — captured when the person enquiring isn't the owner (e.g. an agent).
  const [landownerName, setLandownerName] = useState("");
  const [landownerEmail, setLandownerEmail] = useState("");
  const [landownerPhone, setLandownerPhone] = useState("");
  const [landownerNote, setLandownerNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [titleFiles, setTitleFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  // Deterministic intake fields.
  const [archetype, setArchetype] = useState("");
  const [targetMarket, setTargetMarket] = useState<string[]>([]);
  const [landUses, setLandUses] = useState<string[]>([]);
  const [lotSizeMix, setLotSizeMix] = useState("");
  const [whyAttractive, setWhyAttractive] = useState("");
  const [landCost, setLandCost] = useState("");
  const [marketValueNote, setMarketValueNote] = useState("");
  const [agentRows, setAgentRows] = useState<{ name: string; agency: string; mobile: string; email: string }[]>([
    { name: "", agency: "", mobile: "", email: "" },
  ]);
  const [estateManagerAck, setEstateManagerAck] = useState(false);
  const [authorityAck, setAuthorityAck] = useState(false);

  const toggleIn = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    v: string,
  ) => setter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  // When the submitter IS the land owner, their own contact details are the owner's —
  // so we only ask for separate land-owner details otherwise.
  const submitterIsOwner = submitterRole === "Land owner";

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full border border-black/10 px-4 py-3 font-archivo text-base text-deep-blue focus:outline-none focus:border-[#00B5AD] transition-colors bg-white";
  const labelClass =
    "block text-deep-blue font-semibold font-archivo text-sm mb-1";

  const addToList =
    (setter: React.Dispatch<React.SetStateAction<File[]>>) =>
    (list: FileList | null) => {
      if (!list) return;
      setter((prev) => {
        const combined = [...prev, ...Array.from(list)];
        // De-dupe by name+size and cap at 10.
        const seen = new Set<string>();
        const deduped: File[] = [];
        for (const f of combined) {
          const key = `${f.name}-${f.size}`;
          if (seen.has(key)) continue;
          seen.add(key);
          deduped.push(f);
        }
        return deduped.slice(0, 10);
      });
    };
  const addFiles = addToList(setFiles);
  const addTitleFiles = addToList(setTitleFiles);

  const removeFromList =
    (setter: React.Dispatch<React.SetStateAction<File[]>>) => (idx: number) =>
      setter((prev) => prev.filter((_, i) => i !== idx));
  const removeFile = removeFromList(setFiles);
  const removeTitleFile = removeFromList(setTitleFiles);

  // When this form instance mounted — used as a time-trap (humans can't fill this
  // long, file-upload form in <2.5s; bots that auto-submit can).
  const formLoadedAt = useRef<number>(Date.now());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Bot trap. The hidden field is named non-semantically (hp_field) so browser
    // autofill / password managers can't drop a value into it and silently lose a
    // real submission (the 'company_url' name used to do exactly that). We only
    // treat it as a bot when that field is filled OR the form is submitted
    // implausibly fast — never on a normal human submission.
    const elapsedMs = Date.now() - formLoadedAt.current;
    if (honeypot || elapsedMs < 2500) {
      setSuccess(true);
      return;
    }
    if (!consent) {
      setError("Please tick the consent box so we can contact you.");
      return;
    }
    if (!estateManagerAck) {
      setError("Please acknowledge that submitting appoints Factory2Key as estate manager.");
      return;
    }
    if (!submitterIsOwner && !authorityAck) {
      setError("Please confirm you have the landowner's authority to submit this estate.");
      return;
    }

    const dealPreferences = [dealPreference, dealNotes.trim()]
      .filter(Boolean)
      .join(" — ");

    // Land owner details only when the submitter isn't the owner and gave something.
    const landowner = submitterIsOwner
      ? null
      : (() => {
          const o: Record<string, string> = {};
          if (landownerName.trim()) o.name = landownerName.trim();
          if (landownerEmail.trim()) o.email = landownerEmail.trim();
          if (landownerPhone.trim()) o.phone = landownerPhone.trim();
          if (landownerNote.trim()) o.note = landownerNote.trim();
          return Object.keys(o).length ? o : null;
        })();

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append(
        "data",
        JSON.stringify({
          developer_name: developerName.trim(),
          email: email.trim(),
          mobile: mobile.trim() || null,
          website: website.trim() || null,
          estate_name: estateName.trim(),
          estate_location: estateLocation.trim() || null,
          estate_postcode: estatePostcode.trim() || null,
          estate_state: estateState.trim() || null,
          estate_lat: estateLat,
          estate_lng: estateLng,
          lot_plan_reference: lotPlanReference.trim() || null,
          site_area_value: siteAreaValue.trim() ? Number(siteAreaValue) : null,
          site_area_unit: siteAreaValue.trim() ? siteAreaUnit : null,
          dwellings_envisaged: dwellingsEnvisaged.trim() || null,
          zoning_status: zoningStatus || null,
          site_control: siteControl || null,
          vision: vision.trim() || null,
          deal_preferences: dealPreferences || null,
          archetype: archetype || null,
          target_market: targetMarket,
          land_uses: landUses,
          lot_size_mix: lotSizeMix.trim() || null,
          why_attractive: whyAttractive.trim() || null,
          land_cost: landCost.trim() ? Number(landCost) : null,
          market_value_note: marketValueNote.trim() || null,
          agents: agentRows
            .filter((a) => a.name.trim() || a.email.trim())
            .map((a) => ({
              name: a.name.trim(),
              agency: a.agency.trim(),
              mobile: a.mobile.trim(),
              email: a.email.trim(),
            })),
          terms_accepted: estateManagerAck,
          authority_confirmed: authorityAck,
          submitter_role: submitterRole || null,
          landowner_details: landowner,
          voice_transcript: voiceTranscript,
          voice_conversation_id: voiceConversationId || null,
          consent,
          website_url: "",
        }),
      );
      for (const f of files) fd.append("files", f);
      for (const f of titleFiles) fd.append("title_files", f);

      const res = await fetch("/api/developers/onboarding", {
        method: "POST",
        body: fd,
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
          Thank you — we&apos;ve got it
        </h3>
        <p className="text-slate font-archivo leading-relaxed max-w-md mx-auto mb-2">
          Your details for <strong>{estateName}</strong> are in. A member of the
          Factory2Key team will review your vision and be in touch shortly to
          talk through next steps.
        </p>
        <p className="text-slate/70 font-archivo text-sm">
          A confirmation has been sent to <strong>{email}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Honeypot — non-semantic name (NOT company_url / website / email / etc.) so
          browser autofill + password managers leave it alone. A filled value here, or
          an implausibly fast submit, is treated as a bot (see handleSubmit). */}
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

      {/* ---- Your details ---- */}
      <div className="border border-black/5 bg-white p-5">
        <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-[#00B5AD] mb-4">
          Your details
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="submitterRole" className={labelClass}>
              I&apos;m enquiring as
            </label>
            <select
              id="submitterRole"
              value={submitterRole}
              onChange={(e) => setSubmitterRole(e.target.value)}
              className={inputClass}
            >
              <option value="">— Select —</option>
              {SUBMITTER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {submitterRole && !submitterIsOwner && (
              <p className="text-xs text-slate/60 font-archivo mt-1">
                Since you&apos;re not the land owner, we&apos;ll ask for the
                owner&apos;s details below.
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="developerName" className={labelClass}>
                Your full name *
              </label>
              <input
                id="developerName"
                type="text"
                required
                value={developerName}
                onChange={(e) => setDeveloperName(e.target.value)}
                className={inputClass}
                placeholder="Jane Developer"
              />
            </div>
            <div>
              <label htmlFor="devEmail" className={labelClass}>
                Email *
              </label>
              <input
                id="devEmail"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="jane@example.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="mobile" className={labelClass}>
                Mobile
              </label>
              <input
                id="mobile"
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className={inputClass}
                placeholder="0400 000 000"
              />
            </div>
            <div>
              <label htmlFor="website" className={labelClass}>
                Website
              </label>
              <input
                id="website"
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className={inputClass}
                placeholder="https://yourcompany.com.au"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ---- Estate details ---- */}
      <div className="border border-black/5 bg-white p-5">
        <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-[#00B5AD] mb-4">
          Your estate / project
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="estateName" className={labelClass}>
              Estate / project name *
            </label>
            <input
              id="estateName"
              type="text"
              required
              value={estateName}
              onChange={(e) => setEstateName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Riverbend Estate"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="estateLocation" className={labelClass}>
                Location
              </label>
              <SuburbAutocomplete
                id="estateLocation"
                value={estateLocation}
                onChange={(v) => {
                  setEstateLocation(v);
                  // Free-typed text no longer matches a picked place — drop the precise geocode.
                  setEstateState("");
                  setEstateLat(null);
                  setEstateLng(null);
                }}
                onSelectPostcode={setEstatePostcode}
                onSelectAddress={(a) => {
                  setEstateState(a.state ?? "");
                  setEstateLat(a.latitude);
                  setEstateLng(a.longitude);
                }}
                className={inputClass}
                placeholder="Start typing the suburb / town, then pick a suggestion…"
              />
            </div>
            <div>
              <label htmlFor="estatePostcode" className={labelClass}>
                Postcode
              </label>
              <input
                id="estatePostcode"
                type="text"
                value={estatePostcode}
                onChange={(e) => setEstatePostcode(e.target.value)}
                className={inputClass}
                placeholder="e.g. 7011"
                maxLength={4}
              />
            </div>
          </div>
          <div>
            <label htmlFor="lotPlanReference" className={labelClass}>
              Lot &amp; plan number / title reference
            </label>
            <input
              id="lotPlanReference"
              type="text"
              value={lotPlanReference}
              onChange={(e) => setLotPlanReference(e.target.value)}
              className={inputClass}
              placeholder="e.g. Lot 3 on DP 123456 (or your certificate of title reference)"
            />
            <p className="text-xs text-slate/50 font-archivo mt-1">
              If you have it, this lets us automatically check the site&apos;s wind
              zone, council, zoning overlays and easements. Multiple lots are fine.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="siteAreaValue" className={labelClass}>
                Site size
              </label>
              <div className="flex gap-2">
                <input
                  id="siteAreaValue"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={siteAreaValue}
                  onChange={(e) => setSiteAreaValue(e.target.value)}
                  className={`${inputClass} flex-1`}
                  placeholder="e.g. 4"
                />
                <select
                  aria-label="Site size unit"
                  value={siteAreaUnit}
                  onChange={(e) => setSiteAreaUnit(e.target.value)}
                  className={inputClass}
                  style={{ width: "auto" }}
                >
                  <option value="ha">hectares</option>
                  <option value="acres">acres</option>
                  <option value="m2">m²</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="dwellingsEnvisaged" className={labelClass}>
                Approx. homes / lots envisaged
              </label>
              <input
                id="dwellingsEnvisaged"
                type="text"
                value={dwellingsEnvisaged}
                onChange={(e) => setDwellingsEnvisaged(e.target.value)}
                className={inputClass}
                placeholder="e.g. 25 (or a range — 20–30)"
              />
            </div>
          </div>
          <div>
            <label htmlFor="zoningStatus" className={labelClass}>
              Zoning / planning status
            </label>
            <select
              id="zoningStatus"
              value={zoningStatus}
              onChange={(e) => setZoningStatus(e.target.value)}
              className={inputClass}
            >
              <option value="">— Select —</option>
              {ZONING_STATUSES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="siteControl" className={labelClass}>
              Site ownership / control
            </label>
            <select
              id="siteControl"
              value={siteControl}
              onChange={(e) => setSiteControl(e.target.value)}
              className={inputClass}
            >
              <option value="">— Select —</option>
              {SITE_CONTROL.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate/50 font-archivo mt-1">
              We can help with feasibility, planning and finance — but a project
              needs the site owned or under your control to go ahead.
            </p>
          </div>
          <div>
            <label htmlFor="vision" className={labelClass}>
              Your vision for the estate
            </label>
            <textarea
              id="vision"
              rows={5}
              value={vision}
              onChange={(e) => setVision(e.target.value)}
              className={inputClass}
              placeholder="What are you hoping to build? Who is it for? What does success look like for you?"
            />
          </div>
        </div>
      </div>

      {/* ---- Project shape (deterministic intake) ---- */}
      <div className="border border-black/5 bg-white p-5">
        <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-[#00B5AD] mb-1">Project shape</p>
        <p className="text-xs text-slate/50 font-archivo mb-4">
          The clearer this is, the faster and more accurately we can model your estate and a funder
          feasibility — no guesswork.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="archetype" className={labelClass}>What kind of project is it?</label>
            <select id="archetype" value={archetype} onChange={(e) => setArchetype(e.target.value)} className={inputClass}>
              <option value="">— Select —</option>
              {ARCHETYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <span className={labelClass}>Who is it for? (target market)</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              {TARGET_MARKETS.map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm font-archivo text-deep-blue cursor-pointer">
                  <input type="checkbox" checked={targetMarket.includes(m)} onChange={() => toggleIn(setTargetMarket, m)} className="w-4 h-4 accent-[#00B5AD]" />
                  {m}
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className={labelClass}>Land uses in the plan</span>
            <p className="text-xs text-slate/50 font-archivo mb-1">Tick all that apply — a mix beyond residential makes it a master-plan.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {LAND_USES.map((u) => (
                <label key={u} className="flex items-center gap-2 text-sm font-archivo text-deep-blue cursor-pointer">
                  <input type="checkbox" checked={landUses.includes(u)} onChange={() => toggleIn(setLandUses, u)} className="w-4 h-4 accent-[#00B5AD]" />
                  {u}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="lotSizeMix" className={labelClass}>Lot-size mix (if known)</label>
            <input id="lotSizeMix" value={lotSizeMix} onChange={(e) => setLotSizeMix(e.target.value)} className={inputClass} placeholder="e.g. mostly 450–700 m², some 1,000 m²+ lifestyle lots" />
          </div>
          <div>
            <label htmlFor="whyAttractive" className={labelClass}>Why will it appeal to that market?</label>
            <textarea id="whyAttractive" rows={3} value={whyAttractive} onChange={(e) => setWhyAttractive(e.target.value)} className={inputClass} placeholder="What makes this location / product right for those buyers — lifestyle, value, jobs, services…" />
          </div>
        </div>
      </div>

      {/* ---- Indicative commercials ---- */}
      <div className="border border-black/5 bg-white p-5">
        <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-[#00B5AD] mb-1">Indicative commercials</p>
        <p className="text-xs text-slate/50 font-archivo mb-4">
          Rough is fine. These anchor the funder feasibility to real numbers — the cost stack vs what
          buyers will pay (a project needs a solid margin for finance to flow).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="landCost" className={labelClass}>Indicative land / acquisition cost (AUD)</label>
            <input id="landCost" type="number" min="0" inputMode="decimal" value={landCost} onChange={(e) => setLandCost(e.target.value)} className={inputClass} placeholder="e.g. 2500000" />
          </div>
          <div>
            <label htmlFor="marketValueNote" className={labelClass}>Current market values nearby</label>
            <input id="marketValueNote" value={marketValueNote} onChange={(e) => setMarketValueNote(e.target.value)} className={inputClass} placeholder="e.g. comparable lots ~$180k; homes ~$520k" />
          </div>
        </div>
      </div>

      {/* ---- Land owner (only when the submitter isn't the owner) ---- */}
      {submitterRole && !submitterIsOwner && (
        <div className="border border-black/5 bg-white p-5">
          <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-[#00B5AD] mb-1">
            Land owner
          </p>
          <p className="text-xs text-slate/50 font-archivo mb-4">
            Who owns the land? This helps us understand who we&apos;ll ultimately
            be working with. Leave blank if you&apos;d rather tell us later.
          </p>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="landownerName" className={labelClass}>
                  Owner name
                </label>
                <input
                  id="landownerName"
                  type="text"
                  value={landownerName}
                  onChange={(e) => setLandownerName(e.target.value)}
                  className={inputClass}
                  placeholder="Person or entity on the title"
                />
              </div>
              <div>
                <label htmlFor="landownerEmail" className={labelClass}>
                  Owner email
                </label>
                <input
                  id="landownerEmail"
                  type="email"
                  value={landownerEmail}
                  onChange={(e) => setLandownerEmail(e.target.value)}
                  className={inputClass}
                  placeholder="owner@example.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="landownerPhone" className={labelClass}>
                  Owner phone
                </label>
                <input
                  id="landownerPhone"
                  type="tel"
                  value={landownerPhone}
                  onChange={(e) => setLandownerPhone(e.target.value)}
                  className={inputClass}
                  placeholder="0400 000 000"
                />
              </div>
              <div>
                <label htmlFor="landownerNote" className={labelClass}>
                  Your relationship to the owner
                </label>
                <input
                  id="landownerNote"
                  type="text"
                  value={landownerNote}
                  onChange={(e) => setLandownerNote(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. acting agent, family, business partner"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- Your sales agents ---- */}
      <div className="border border-black/5 bg-white p-5">
        <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-[#00B5AD] mb-1">Your sales agents</p>
        <p className="text-xs text-slate/50 font-archivo mb-4">
          The agents who&apos;ll market this estate. Each gets their own Factory2Key portal to track
          their own buyers — we invite them automatically once the estate is set up. Add as many as
          you need.
        </p>
        <div className="space-y-4">
          {agentRows.map((a, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-black/5 pb-4 last:border-0 last:pb-0">
              <input value={a.name} onChange={(e) => setAgentRows((r) => r.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={inputClass} placeholder="Agent name" />
              <input value={a.agency} onChange={(e) => setAgentRows((r) => r.map((x, j) => (j === i ? { ...x, agency: e.target.value } : x)))} className={inputClass} placeholder="Agency" />
              <input value={a.email} type="email" onChange={(e) => setAgentRows((r) => r.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} className={inputClass} placeholder="Email" />
              <div className="flex gap-2">
                <input value={a.mobile} type="tel" onChange={(e) => setAgentRows((r) => r.map((x, j) => (j === i ? { ...x, mobile: e.target.value } : x)))} className={`${inputClass} flex-1`} placeholder="Mobile" />
                {agentRows.length > 1 && (
                  <button type="button" onClick={() => setAgentRows((r) => r.filter((_, j) => j !== i))} className="text-slate/50 hover:text-red-600 px-2 text-sm font-archivo shrink-0" aria-label="Remove agent">Remove</button>
                )}
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setAgentRows((r) => [...r, { name: "", agency: "", mobile: "", email: "" }])} className="text-[#00B5AD] hover:text-[#009E97] font-archivo text-sm font-semibold">
            + Add another agent
          </button>
        </div>
      </div>

      {/* ---- Land title / certificate of title ---- */}
      <div className="border border-black/5 bg-white p-5">
        <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-[#00B5AD] mb-1">
          Land title &amp; deposited (survey) plan
        </p>
        <p className="text-xs text-slate/50 font-archivo mb-2">
          If you have the certificate of title and/or the <strong>deposited (survey)
          plan</strong> — the document that shows your exact parcel boundaries —
          upload them here. The title also carries the legal description, area,
          easements and covenants we&apos;d need anyway. Optional.
        </p>
        <p className="text-xs font-archivo mb-4 bg-amber-50 border-l-4 border-amber-400 text-amber-900 px-3 py-2 leading-relaxed">
          Worth knowing: without the deposited plan we can only show an{" "}
          <strong>estimated, indicative boundary</strong> on your estate&apos;s map
          (sized to the site area, not surveyed). Provide it and we can draw the{" "}
          <strong>exact parcel outline</strong>.
        </p>

        <label
          htmlFor="titleFiles"
          className="flex flex-col items-center justify-center border-2 border-dashed border-[#00B5AD]/30 hover:border-[#00B5AD]/60 bg-off-white px-4 py-6 cursor-pointer transition-colors text-center"
        >
          <svg
            className="w-7 h-7 text-[#00B5AD] mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span className="font-archivo text-sm text-deep-blue font-semibold">
            Upload title and/or deposited plan (optional)
          </span>
          <span className="font-archivo text-xs text-slate/50 mt-1">
            PDF or image
          </span>
          <input
            id="titleFiles"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,.tiff,image/*,application/pdf"
            onChange={(e) => {
              addTitleFiles(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />
        </label>

        {titleFiles.length > 0 && (
          <ul className="mt-4 space-y-2">
            {titleFiles.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center justify-between bg-off-white border border-black/5 px-3 py-2 font-archivo text-sm"
              >
                <span className="text-deep-blue truncate mr-3">
                  {f.name}{" "}
                  <span className="text-slate/40 text-xs">
                    ({Math.round(f.size / 1024)} KB)
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeTitleFile(i)}
                  className="text-slate/50 hover:text-red-600 shrink-0"
                  aria-label={`Remove ${f.name}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---- Deal preferences ---- */}
      <div className="border border-black/5 bg-white p-5">
        <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-[#00B5AD] mb-1">
          Deal preferences
        </p>
        <p className="text-xs text-slate/50 font-archivo mb-4">
          How would you ideally like to work with us? This just helps us prepare —
          nothing is binding.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="dealPreference" className={labelClass}>
              Preferred structure
            </label>
            <select
              id="dealPreference"
              value={dealPreference}
              onChange={(e) => setDealPreference(e.target.value)}
              className={inputClass}
            >
              <option value="">— Select —</option>
              {DEAL_PREFERENCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dealNotes" className={labelClass}>
              Anything else about how you like to do deals?
            </label>
            <textarea
              id="dealNotes"
              rows={3}
              value={dealNotes}
              onChange={(e) => setDealNotes(e.target.value)}
              className={inputClass}
              placeholder="Joint venture appetite, timelines, partners already involved…"
            />
          </div>
        </div>
      </div>

      {/* ---- File uploads ---- */}
      <div className="border border-black/5 bg-white p-5">
        <p className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-[#00B5AD] mb-1">
          Plans, sketches & designs
        </p>
        <p className="text-xs text-slate/50 font-archivo mb-4">
          Upload any plans, sketches, drawings or preferred house designs (PDF or
          images, up to 25MB each, 10 files max). Optional — but the more we see,
          the better we can help.
        </p>

        <label
          htmlFor="devFiles"
          className="flex flex-col items-center justify-center border-2 border-dashed border-[#00B5AD]/30 hover:border-[#00B5AD]/60 bg-off-white px-4 py-8 cursor-pointer transition-colors text-center"
        >
          <svg
            className="w-8 h-8 text-[#00B5AD] mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <span className="font-archivo text-sm text-deep-blue font-semibold">
            Click to choose files
          </span>
          <span className="font-archivo text-xs text-slate/50 mt-1">
            PDF, JPG, PNG, WEBP, DWG, DOC
          </span>
          <input
            id="devFiles"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.tiff,.dwg,.doc,.docx,image/*,application/pdf"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />
        </label>

        {files.length > 0 && (
          <ul className="mt-4 space-y-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center justify-between bg-off-white border border-black/5 px-3 py-2 font-archivo text-sm"
              >
                <span className="text-deep-blue truncate mr-3">
                  {f.name}{" "}
                  <span className="text-slate/40 text-xs">
                    ({Math.round(f.size / 1024)} KB)
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-slate/50 hover:text-red-600 shrink-0"
                  aria-label={`Remove ${f.name}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
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
          I&apos;m happy for Factory2Key to contact me about my project and to
          store the details and files I&apos;ve provided. I understand this is an
          enquiry only and creates no obligation on either side.
        </span>
      </label>

      {/* Commercial gate — F2K as estate manager + authority to agree */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={estateManagerAck}
          onChange={(e) => setEstateManagerAck(e.target.checked)}
          className="mt-1 w-5 h-5 accent-[#00B5AD]"
        />
        <span className="text-sm text-slate font-archivo leading-relaxed">
          I understand that submitting this estate (which is free) is on the basis that{" "}
          <strong>Factory2Key acts as estate manager</strong> — leading the project, lot allocations,
          management and delivery of the homes — as set out in the{" "}
          <a href="/developers/terms" target="_blank" className="underline hover:text-deep-blue">
            estate submission terms
          </a>
          . *
        </span>
      </label>

      {submitterRole && !submitterIsOwner && (
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={authorityAck}
            onChange={(e) => setAuthorityAck(e.target.checked)}
            className="mt-1 w-5 h-5 accent-[#00B5AD]"
          />
          <span className="text-sm text-slate font-archivo leading-relaxed">
            I confirm I have the landowner&apos;s authority to submit this estate and to agree to the
            above on their behalf — or I&apos;ll arrange the owner&apos;s confirmation. *
          </span>
        </label>
      )}

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

      <button
        type="submit"
        disabled={submitting || !consent || !estateManagerAck}
        className="bg-[#00B5AD] hover:bg-[#009E97] text-white px-8 py-3 font-archivo font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
      >
        {submitting ? "Submitting…" : "Submit my project"}
      </button>
    </form>
  );
}
