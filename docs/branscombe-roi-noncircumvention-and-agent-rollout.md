# Non-Circumvention Clause + Agent Alignment Plan

**Status:** DRAFT for legal review + rollout planning · 2026-06-28
**Owner:** Dennis McMahon, Factory2Key
**Relates to:** `docs/Branscombe_ROI_Portal_Form_BuildSpec_v2.1.md` §4 (the one open legal item) and
the shipped Phase 1 attribution system (migration `0063`, the `/r/<estate>?ref=TOKEN` resolver,
first-touch-immutable attribution).

> **Why this exists.** Phase 1 is technically live: the portal now *evidences* who introduced a
> buyer first, immutably. The thing still outstanding is the **commercial promise** F2K makes to
> agents in their agency agreement — the non-circumvention undertaking. That promise is what makes
> an agent willing to funnel their buyers through F2K's portal. This doc holds (a) candidate wording
> for the lawyer, and (b) how we get both new and existing agents aligned to it.

---

## 1. Candidate clause (DRAFT — not legal advice; for the lawyer to finalise)

> **Non-Circumvention.**
> 1. **"Introduced Buyer"** means a prospective purchaser whose first registration of interest in
>    the Estate is attributed to the Agent through Factory2Key's registration portal (the
>    first-touch record), as evidenced by Factory2Key's system records.
> 2. Factory2Key holds and controls the central registration data. For **[12] months** from the
>    date an Introduced Buyer is first attributed to the Agent (the **"Protection Period"**),
>    Factory2Key will not, and will procure that the Vendor does not, deal directly with that
>    Introduced Buyer in a manner intended to circumvent the Agent or defeat the Agent's
>    entitlement to commission on a sale to that Introduced Buyer.
> 3. Where an Introduced Buyer proceeds to a sale during the Protection Period, the Agent's
>    commission entitlement is determined under **[the Commission Schedule]**, notwithstanding that
>    the buyer's data is held centrally by Factory2Key.
> 4. This clause does not prevent Factory2Key from: (a) operating the portal and contacting buyers
>    for administrative, compliance, and registration purposes; (b) dealing with buyers **not**
>    attributed to the Agent (including the unassigned pool); or (c) reallocating an Introduced
>    Buyer where the Agent consents, the Agent's appointment ends, or a first-touch attribution is
>    corrected for a demonstrable, logged error.
> 5. Factory2Key's **system first-touch record is the agreed evidence of introduction** for the
>    purposes of this clause.

**Blanks to settle with the lawyer:**
- Protection Period length (drafted as **[12] months**).
- The **[Commission Schedule]** cross-reference.
- Whether the **Vendor / SPV** is a party to the clause or bound via Factory2Key's "procure that"
  undertaking (clause 2).
- Interaction with the two-controller privacy disclosure (spec §11 item 4).

**The system tie-in (already built — clause 5 rests on this):** Phase 1 stamps `introducing_agent_id`
+ `first_touch_at` at first touch and makes them immutable (migration `0063`'s trigger); any admin
reallocation is logged to `audit_log` as `attribution_override`. So "F2K's system first-touch record"
is a real, tamper-evident artefact, not a claim.

---

## 2. Is this blocking? No.

- **Technically active now** — resolver, link minting, immutable attribution are deployed (prod + demo).
- **What the clause gates** — only the *formal commission promise to external agencies*. The system
  evidences first-touch regardless of whether the clause is signed.
- **Safe to do today:** activate for agents **already under agreement** (Henry, Patrick, etc.) and
  share their links.
- **Hold until the clause is signed:** *new commission commitments to new agencies*. Best practice is
  the clause is in their agreement before you ask them to push buyers through the portal.

---

## 3. The conversation we need with agents

Two distinct messages — keep them separate, because they have different jobs:

- **A. The trust message ("we've got your back").** Attribution is now automatic, system-captured,
  and locked to first touch — the agent no longer has to *claim* buyers or worry about being cut
  out. F2K commits in writing not to go around them.
- **B. The contractual step ("please sign this").** The non-circumvention clause goes into their
  agreement (new agents) or as a short addendum (existing agents), with a recorded agreement.

Don't lead with B. Lead with A — the clause *protects them*; framed that way it's a benefit, not
paperwork.

### Existing agents (already onboarded, already under an agency agreement)
These are the relationship-sensitive ones — they've been operating without central attribution, so
"F2K now holds all the buyer data centrally" must land as protection, not as a threat.

1. **Personal call** (Dennis/Uwe), especially for **Henry** — explain A, then say a short written
   addendum is coming that puts the non-circumvention promise in writing.
2. **Follow-up email** with the **signed addendum** (the clause) for a recorded agreement
   (DocuSign / reply-to-accept). This is the contractual record — must be written, not a verbal nod.
3. **Operational handoff:** their new tokenised **share link** (the portal "Share links" button /
   an email), plus a one-paragraph "how attribution works now."

### New agents (appointed from here on)
1. **Non-circumvention clause is in the agency agreement they sign at appointment** — no separate
   addendum, no second conversation.
2. **Existing invite + access-code onboarding** (already built) delivers their portal access.
3. A short **"how attribution works"** explainer at onboarding (the Share-links modal already states
   the attribution is locked — reinforce it).

---

## 4. Which channel for which message

| Message | Channel | Why |
|---|---|---|
| **The contractual clause / addendum (sign it)** | **Written — email with the agreement/addendum; recorded acceptance** (DocuSign or reply-to-accept) | A commission promise needs a signature/acknowledgement record. A system notification alone is not a contract. Transactional B2B mail (not marketing) — carry sender identification; Spam Act unsubscribe not required. |
| **The trust framing / the "why"** | **Call** for key existing agents (Henry first); **personal email** for the rest | Relationship-sensitive. A call pre-empts "why is F2K holding my buyers?" before the addendum lands. |
| **Operational (your link + how attribution works)** | **Portal / system notification + email** | Low-stakes, repeatable, self-serve. Fine to automate. |

**Rule of thumb:** *contract → written + recorded; trust → voice; operations → system.* Don't try to
do the contract via a system notification, and don't try to do the trust message via a mass email.

### Sequencing (so nothing lands out of order)
1. Sign-off on the clause wording (lawyer).
2. Call existing agents (trust message) → send addendum → record acceptance.
3. Only then push their share links broadly + bake the clause into the new-agent agreement template.
4. New agencies onboarded against the updated template from that point.

---

## 5. Draft note to existing agents (email — for review, after the call)

> **Subject:** Your Branscombe registrations — now automatically protected to you
>
> Hi [name],
>
> Following our chat — a quick note on the portal. We've upgraded it so that every buyer who
> registers through your link is **automatically and permanently recorded as your introduction**.
> You no longer need to claim or track anyone; the system locks it to you at first contact.
>
> We're also putting our commitment in writing: Factory2Key won't deal directly with a buyer you've
> introduced in a way that cuts across your commission. The short addendum below sets that out —
> please review and reply to confirm, or sign via the link.
>
> Your personal Branscombe link is: **[/r/branscombe?ref=…]** — share it however you like.
>
> Any questions, call me.
> — [Dennis / Uwe], Factory2Key Pty Ltd · [ABN] · [contact]

*(Transactional B2B — identification footer; no marketing unsubscribe required. Use the verified
sender `noreply@updates.corporateaisolutions.com` or a personal F2K address for the 1:1 version.)*

---

*Once the lawyer finalises §1, fold the clause into the agency-agreement template + an existing-agent
addendum, and update `Branscombe_ROI_Portal_Form_BuildSpec_v2.1.md` §4 to mark the legal item closed.*
