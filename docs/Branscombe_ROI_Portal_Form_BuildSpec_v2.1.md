# Branscombe Estate — Online Registration of Interest (Agent Portal)
## Build Specification v2.1 · 27 June 2026

**Prepared for:** Claude Code
**Owner:** Dennis McMahon, Factory2Key (F2K)
**Target app:** `f2k-projects` (Vercel) — existing site at `f2k-projects.vercel.app`

**Changes from v1:** added §3 Workflow & agent handoff, §4 Buyer ownership & attribution, §11 Privacy & compliance (expanded). Incorporates decisions: auto-nudge ON (F2K fallback); first-touch-via-link wins (agent links are a NEW build item); F2K assigns unattributed leads.
**Changes in v2.1:** contact/controller entity resolved to "Factory2Key Pty Ltd, or such entity as is subsequently named by Factory2Key Pty Ltd" (future-proofs the SPV name); Branscombe `representation_statement` and Unit 31 note set to authorised wording. Only the non-circumvention wording remains for legal.

---

## 0. Read first — build approach

This form lives **inside the existing `f2k-projects` app**, as a function of the agents portal. Do not stand up a separate project.

**Step 0 (mandatory):** inspect the existing repo and conform to its stack, routing, styling, and data conventions. Report the stack before scaffolding. The defaults below apply **only if the repo is greenfield or silent**.

**Assumed default stack (confirm against repo):** Next.js (App Router), TypeScript, Tailwind on Vercel; Postgres (Vercel Postgres / Neon) via the repo's ORM (Drizzle/Prisma); Vercel Blob for logo uploads; email via the repo's provider (e.g. Resend).

**Three principles that drive the design:**
1. **Product data is config-driven, never hard-coded** (§8). No literal asserts "37 × 3-bed" or any type/area/star rating. A representation control, not a convenience.
2. **Attribution is system-captured, not typed** (§4). Introducing agent/agency is resolved from the link the buyer arrives through and stamped immutably.
3. **Two distinct artefacts, not one form issued twice** (§3): a light estate-level *waitlist registration*, and the unit-level *qualification form* (the EOI). The portal connects them.

---

## 1. Objective

Replace per-agent PDF EOIs with one online flow that captures **standardised, compliant, attributed** data regardless of channel; lets agencies **co-brand**; feeds a **central F2K pipeline** with funnel visibility; and is **multi-estate** from day one (optional for Branscombe, mandatory for future estates).

---

## 2. Architecture overview

```
Agent share link (tokenised, NEW) ─┐
   or agent portal login            ├─► Branded waitlist form (estate + agent resolved)
   or direct/generic page          ─┘            │
                                                 ▼
                                   Waitlist registration (attributed or unassigned)
                                                 │
                  agent one-click "Send qualification form"  OR  48h auto-nudge (F2K fallback)
                                                 ▼
                                Qualification form (EOI) — prefilled, attributed
                                                 │
                            Validated submit → Postgres (AU region)
                                                 │
        ┌────────────────────────────────────────┼────────────────────────────────────────┐
        ▼                                        ▼                                        ▼
 Confirmation to applicant          Copy to introducing agent                 Central F2K record + dashboard
```

---

## 3. Workflow & agent handoff (end-to-end)

The funnel and exactly where each artefact fires:

1. **Estate page live.**
2. **Agents appointed** → each agent/agency issued a **unique tokenised link** (`/r/branscombe?ref=AGENT_TOKEN`). *This link mechanism does not exist yet — build it.*
3. **Agents promote** using their own link (listings, socials, email).
4. **Buyer responds → waitlist registration** (artefact 1: estate-level interest, light fields, contact + consent).
   - Arrived via an agent link → **auto-attributed to that agent at first touch, immutable**.
   - Arrived direct/generic → lands in the **unassigned pool**.
5. **Agent qualifies the buyer** (the sales conversation — units, indicative price). Buyer now appears in that agent's dashboard list.
6. **Agent's next action = one click: "Send qualification form."** From the dashboard, per buyer. The system sends a **branded covering email** containing a **one-click link to the pre-attributed, pre-filled qualification form** (name/email/phone carried from the waitlist record so the buyer doesn't re-key).
7. **Auto-nudge fallback (decision: ON):** if a waitlisted buyer sits untouched for **48h**, the system prompts the attributed agent and, failing action, sends the covering email **on the agent's behalf** (F2K fallback). Agent-overridable / can opt a buyer out. This is where the current funnel leaks — the fallback is deliberate.
8. **Qualification form completed** → flows back **attributed** into the central pipeline *and* the agent's view. F2K receives every one.

### Covering email (agent-branded, F2K co-brand footer)
> **Subject:** Your Branscombe Estate home — let's lock in your preference
> Hi [first name], great speaking with you. To register your preferred home(s) and indicative terms — no obligation, no deposit — just complete this short form: **[Complete my registration →]**. Two minutes. Questions? Reply or call me.
> — [Agent name], [Agency]
> *Footer: sender identification, F2K/vendor identification, and an unsubscribe link (Spam Act — see §11).*

### Auto-nudge email (F2K-sent on agent's behalf)
> **Subject:** Still interested in Branscombe Estate?
> Hi [first name], you registered interest in Branscombe Estate. When you're ready, you can note your preferred home(s) here — no obligation: **[Register my preference →]**. Your agent [Agent name] is on [phone] if you'd like to talk it through.
> *Footer: sender ID + unsubscribe.*

> **Build note:** both emails are templates with config-driven sender identity and a mandatory unsubscribe. Never send a nudge to a buyer who has not consented at waitlist (§11).

---

## 4. Buyer ownership, attribution & non-circumvention

There is **no single owner** — ownership splits by dimension. The system enforces attribution; the agency agreement enforces the commercial promise.

| Dimension | Owner | Enforced by |
|---|---|---|
| Introduction / commission | Introducing **agent/agency** | First-touch token (immutable); F2K assigns unattributed |
| Registration **data / pipeline** | **F2K** (data controller of record) | Central DB; agents get scoped access to their attributed buyers only |
| **Contract** at sale | **Vendor / SPV** | Contract of sale |

**Attribution rules (decisions applied):**
- **First-touch via link wins** and is immutable once set.
- **No agent self-claim.** Buyers with no link sit in the unassigned pool; **F2K (admin) assigns** them to an agent or keeps them house/direct.
- Every registration carries `introducing_agency_id` + `introducing_agent_id`; once set they cannot be edited by agents (admin override logged).
- **Conflict / double-claim** surfaces to F2K admin to arbitrate (should be rare given first-touch).

**Non-circumvention (paper, not code — flag to legal):** F2K holds the central data but undertakes in each agency agreement **not to deal directly with an agent's introduced buyer so as to defeat the agent's commission.** This is what makes agents willing to funnel buyers through F2K's portal. The system's role is to **evidence first-touch** for that clause.

**Decisions:**
- **Data controller — RESOLVED.** Named as **"Factory2Key Pty Ltd, or such entity as is subsequently named by Factory2Key Pty Ltd"** (future-proofs the change to the project SPV name once that entity is established). Use this exact string wherever the collecting/contacting entity is identified (contact consent, privacy notice, `controller_entity`).
- **Awaiting legal:** the **non-circumvention wording** in the agency agreements.

---

## 5. Multi-tenancy / config

Everything estate- or agent-specific is data, not code. **Estate config** seeds units, types, colour schemes, the representation statement, privacy/T&C version. **Agency/Agent config** holds branding + attribution token. Adding the next estate = new config + seed, **no form rewrite**.

---

## 6. Data model

Use the repo's ORM. Indicative schema:

### `estates`
`id`, `slug`, `name`, `address`, `representation_statement` (the only product header rendered — §8), `tenure_type` (`strata`), `privacy_policy_url`, `controller_entity` (set to: "Factory2Key Pty Ltd, or such entity as is subsequently named by Factory2Key Pty Ltd" — covers the future SPV name), `terms_version`, `status`.

### `units`
`id`, `estate_id`, `unit_number`, `type_code`, `bedrooms`, `bathrooms`, `internal_area_m2`, `deck_area_m2`, `star_rating`, `price_indicative` (nullable → "POA"), **`authorised_for_display`** (if false, type/beds/areas/star NOT shown; selectable by number only), `status` (`available/reserved/sold/withheld`).

> **Branscombe seed — Unit 31.** Seed the schedule as **36 × 3-bed + Unit 31 as 2-bed (approved DA)**. Unit 31 is 2-bedroom because of a lot-size constraint; a 3-bedroom amendment is being prepared. `representation_statement` (§8) tells this story honestly. Do **not** flip U31 to 3-bed in config until JSA confirms the Type 1B footprint fits the approved envelope (the reasonable grounds for the future claim) and the S56 amendment is lodged/approved — then it's a one-field config change.

### `agencies` / `agents`
`agency_id`, `agency_name`, `agency_logo_url`, `agent_id`, `agent_name/email/phone`, **`attribution_token`** (unique — resolves the tokenised link), `active`.

### `waitlist_registrations` (artefact 1)
`id`, `estate_id`, `introducing_agency_id` (nullable → unassigned pool), `introducing_agent_id` (nullable), `first_touch_at`, `name`, `email`, `mobile`, `consent_contact` (bool — required for nudge), `consent_privacy` (bool), `terms_version`, `submitted_at`, `submitter_ip`, `user_agent`, `nudged_at` (nullable), `assigned_by` (admin id, for unassigned→assigned), `status` (`new/contacted/qualified/withdrawn`).

### `registrations` (artefact 2 — the qualification form / EOI)
`id`, `estate_id`, `waitlist_id` (fk — links back), unit refs (ranked), `introducing_agency_id` + `introducing_agent_id` (**copied from waitlist, immutable**), `payload` (jsonb — all answers), `terms_version`, `consent_privacy`, `consent_nonbinding`, `consent_contact`, `submitted_at`, `submitter_ip`, `user_agent`, `status`.

---

## 7. Form fields

### Waitlist (artefact 1) — light
Name, mobile, email, buyer category (owner-occupier / investor / first home buyer), **contact consent + collection notice** (§11). That's it — top-of-funnel, low friction.

### Qualification form (artefact 2) — merged best-of-both (V3 + Ant PDF)
**A. Applicant:** full name(s); number of applicants → reveal Applicant 2; mobile; email; postal address; buyer category; **purchaser entity type** (Individual/Joint/Company/Trust/SMSF/TBC); preferred contact method.
**B. Preferred home(s) — up to three ranked:** unit number (from available units) + type (auto-filled **only if `authorised_for_display`**). Reference panel renders authorised rows only.
**C. Indicative commercial terms:** buyer-entered indicative price (null price → "POA — discuss with agent"); **deposit menu 5% / 7.5% / 10% / Other, floor 5%** (ties to V55 model put to Abacus — do not anchor below 5%, do not import conventional presale logic); finance status (Cash / Finance required / Pre-approved); lender/broker; estimated amount or LVR; subject to finance (Y/N/TBC); finance approval period (30/45/Other days); settlement timing ("30 days from registration of the strata plan and issue of title" / Other / TBC — strata-clean); special comments.
**D. Colour scheme:** from estate config (Branscombe: The Forest / Dark Contemporary / Light Coastal).
**E. Acknowledgements & consent (all required to submit):** full V3 Section-5 set — EOI only (not contract/option/reservation/offer/acceptance/agreement for lease); does not oblige the **developer/vendor and related parties** (the vendor/SPV at sale) to sell/reserve; no money payable; all figures indicative; binding only on a signed exchanged contract; **privacy consent** (link to policy); contact consent (**"Factory2Key Pty Ltd, or such entity as is subsequently named by Factory2Key Pty Ltd"**, its related parties, the **introducing agency**, and F2K on the agent's behalf).
**F. Signature/confirmation:** typed name + date; capture `submitted_at`, IP, user-agent.

---

## 8. Representation guardrail (critical)

Header shows **only** `estate.representation_statement`. **Set Branscombe's to exactly:**

> *"36 of the 37 homes are 3-bedroom. Unit 31 is currently approved as 2-bedroom due to a lot-size constraint; an amendment to bring it into line as a 3-bedroom is being prepared, subject to Council approval."*

Lead with this honest split — never a bare "37 × 3-bed" headline with the caveat buried (the ACL tests the dominant message, not the footnote). Unit/type/area/star detail renders **only** where `authorised_for_display = true`. No hard-coded product copy anywhere. Add a server-side test asserting no detail renders for unauthorised rows.

---

## 9. Agent branding

Form co-brands F2K/Branscombe with the introducing agency's logo + agent contact, resolved from the token. Logo upload via portal (Vercel Blob), F2K-approved before activation. Branding changes **only** logo + contact — never fields, disclaimers, or product data.

---

## 10. Notifications & routing

On qualification submit: (1) applicant confirmation (summary + non-binding statement restated); (2) introducing agent copy; (3) F2K central record + notification. Attribution travels on every copy. F2K receives **every** submission, both artefacts, regardless of channel.

---

## 11. Privacy & compliance

Australian **Privacy Act 1988 / APPs** + **Spam Act 2003**. Build-affecting requirements:

1. **Collection notice at BOTH capture points** (waitlist and qualification form): who collects, purpose, that data is disclosed to the **introducing agency** and the **vendor/SPV** (and funder, if applicable), and how to access/correct. The nudge fires off the waitlist record, so consent + notice must exist **at waitlist**, not only at the EOI.
2. **Consent gates:** `consent_privacy` and (for qualification) `consent_nonbinding` required to submit; `consent_contact` required before any nudge is sent.
3. **Spam Act on all nudges/marketing emails:** consent + sender identification + functional unsubscribe in every message, including F2K-sent-on-agent's-behalf nudges. Honour unsubscribe across both channels.
4. **Two-controller disclosure:** because F2K and the agency both hold the buyer (§4), the notice names both categories of recipient.
5. **Data residency:** pin Postgres + Blob to an **Australian region (Sydney)**; disclose any offshore processing (APP 8).
6. **Security (APP 11):** HTTPS only, least-privilege DB, no PII in logs/analytics, scoped agent access (agents see only their attributed buyers).
7. **Retention/destruction (APP 11.2):** define a retention period; de-identify/destroy when no longer needed.
8. **Access & correction (APP 12/13):** provide a contact and an internal process.
9. **Confirm the website privacy policy** actually covers this collection and names the controller as "Factory2Key Pty Ltd, or such entity as is subsequently named by Factory2Key Pty Ltd" (§4).

> Item 4 and the non-circumvention undertaking require legal sign-off. The rest is standard build.

---

## 12. Admin dashboard (F2K)

Auth-gated. All registrations (both artefacts) across estates/agents, filterable. Per record: applicant, ranked units, indicative price, finance status, deposit pref, entity type, **introducing agency/agent**, timestamps, consent flags, status. **Unassigned-pool view with assign action (F2K only).** **Funnel metrics:** link views → waitlist starts → waitlist submits → qualification submits, by agent and by unit. Finance-ready count (pre-approved or cash). Dedupe by email/mobile. CSV export.

---

## 13. Non-functional

Mobile-first, accessible, keyboard-navigable. Spam control on public forms (honeypot + Turnstile/CAPTCHA; rate-limit submits). House style: navy `#1F3864`, blue `#2E75B6`, clean sans, responsive, confidential footer with form version + terms version. Stamp form version + `terms_version` on every record.

---

## 14. Out of scope (v1)

Payments/deposit collection; legal e-signature; contract-of-sale generation; agent self-service analytics (F2K dashboard first).

---

## 15. Acceptance criteria

1. A tokenised agent link opens a co-branded form with attribution pre-bound; links are generatable per agent (NEW mechanism works).
2. No product claim appears as a literal anywhere; unauthorised unit detail does not render (test-covered); Branscombe seed = approved DA (36×3-bed + 1×2-bed), config-flippable.
3. Waitlist (light) and qualification (full merged fields) both capture correctly; deposit menu defaults to 5%.
4. **Workflow:** agent dashboard "Send qualification form" sends the branded covering email with a prefilled, attributed link; 48h auto-nudge fires as F2K fallback and is agent-overridable; both emails carry sender ID + unsubscribe.
5. **Attribution:** first-touch via link is immutable; unassigned buyers sit in a pool only F2K can assign; every record carries agency + agent.
6. **Privacy:** collection notice + consent at waitlist AND qualification; no nudge without `consent_contact`; unsubscribe honoured; DB/Blob in AU region.
7. Submission blocked unless required consents ticked; `terms_version`, timestamp, IP, user-agent recorded.
8. On submit, applicant + introducing agent + F2K central all receive the record; dashboard shows correct attribution, funnel metrics, finance-ready count, dedupe, CSV export.
9. Adding a second estate requires config + seed only — no component changes.

---

## 16. Phasing

- **MVP (now):** Branscombe live — agent links + branding, waitlist + qualification capture, consent, covering email + auto-nudge, notifications, F2K dashboard with assignment + funnel. Optional alongside existing PDFs.
- **Phase 2 (future estates):** portal mandatory; agent self-service link generation + own-pipeline view; logo-approval workflow.

---

*End of spec v2.1. Claude Code: start with Step 0 (repo inspection) and report the stack before scaffolding. One item awaits legal: the non-circumvention wording (§4). The contact/controller entity is resolved (§4/§11).*
