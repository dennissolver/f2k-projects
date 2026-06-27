# New-Agent Agency Agreement — Template Change (Non-Circumvention)

**Status:** DRAFT for legal review (LegalVision) · 2026-06-28
**Owner:** Dennis McMahon, Factory2Key Pty Ltd
**Relates to:** `docs/branscombe-roi-noncircumvention-and-agent-rollout.md` (clause + rollout plan),
`docs/Branscombe_ROI_Portal_Form_BuildSpec_v2.1.md` §4/§11.

> **What this is.** The specific edits to fold into F2K's standard selling-agent agency agreement so
> that **every newly-appointed agent** is bound by the non-circumvention promise + the central-data /
> first-touch attribution model from the moment they sign — no separate addendum (the addendum route
> is only for agents already appointed; see the rollout doc). This is the document to put in front of
> the lawyer alongside the clause.

---

## 1. Insertions / amendments (markup against the standard agreement)

### 1.1 New definitions — add to the Definitions clause

> **"Portal"** means the online registration-of-interest platform operated by Factory2Key for the
> Estate.
> **"First-Touch Record"** means Factory2Key's system record of the first agent (if any) to whom a
> prospective purchaser's registration of interest is attributed, captured automatically when the
> purchaser first registers through that agent's unique Portal link and recorded immutably.
> **"Introduced Buyer"** means a prospective purchaser whose First-Touch Record attributes them to
> the Agent.
> **"Protection Period"** means the period of **[12] months** from the date a purchaser becomes an
> Introduced Buyer of the Agent.

### 1.2 New clause — Non-Circumvention (insert as a standalone clause)

*(The operative clause — same as the standalone draft, adapted to use the agreement's defined terms.)*

> **[X]. Non-Circumvention.**
> (a) Factory2Key holds and controls the central registration data captured through the Portal.
>     During the Protection Period, Factory2Key will not, and will procure that the Vendor does not,
>     deal directly with an Introduced Buyer in a manner intended to circumvent the Agent or defeat
>     the Agent's entitlement to commission on a sale to that Introduced Buyer.
> (b) Where an Introduced Buyer proceeds to a sale during the Protection Period, the Agent's
>     commission entitlement is determined under **[the Commission clause / Schedule]**,
>     notwithstanding that the buyer's data is held centrally by Factory2Key.
> (c) This clause does not prevent Factory2Key from: (i) operating the Portal and contacting buyers
>     for administrative, compliance and registration purposes; (ii) dealing with buyers who are not
>     Introduced Buyers of the Agent (including buyers in the unassigned pool); or (iii) reallocating
>     an Introduced Buyer where the Agent consents, the Agent's appointment ends, or a First-Touch
>     Record is corrected for a demonstrable, logged error.
> (d) The First-Touch Record is the agreed evidence of introduction for the purposes of this clause.

### 1.3 Amend the Commission clause — cross-reference

> Add at the end of the Commission clause: *"The Agent's entitlement to commission in respect of an
> Introduced Buyer is subject to clause [X] (Non-Circumvention)."*

### 1.4 New clause — Data, Privacy & Attribution acknowledgement

*(Reflects the two-controller model, spec §11.4 — the Agent acknowledges F2K is the controller of
record and that the Agent receives scoped access only to their own Introduced Buyers.)*

> **[Y]. Data and Attribution.**
> (a) The Agent acknowledges that Factory2Key (or such entity as is subsequently named by Factory2Key
>     Pty Ltd) is the controller of the registration data collected through the Portal, and that the
>     Agent is provided scoped access only to the Agent's own Introduced Buyers.
> (b) Attribution is captured automatically by the Portal at first touch and is not amended by either
>     party except as permitted under clause [X](c). The Agent will not attempt to alter, reassign or
>     claim attribution other than through Factory2Key.
> (c) The parties will each comply with the Privacy Act 1988 (Cth) and the Australian Privacy
>     Principles in respect of buyer personal information, and will only use it for the purposes of
>     the Estate sales process.

---

## 2. Open points for the lawyer (these need a view)

1. **Protection Period length + start point.** Is **[12] months** from first-touch reasonable and
   enforceable for a sales-agency context, and is "from the date a purchaser becomes an Introduced
   Buyer" a clean trigger?
2. **"Procure that the Vendor does not…"** — the Vendor/SPV entity is **not yet established** (the
   agreement currently names "Factory2Key Pty Ltd, or such entity as is subsequently named by
   Factory2Key Pty Ltd"). Is a "procure" undertaking by F2K sufficient, or should the Vendor/SPV be
   a party / sign a deed of accession when established?
3. **First-Touch Record as evidence (clause [X](d)).** Is it acceptable to contractually agree that
   F2K's system record is the evidence of introduction? Any carve-out needed for manifest error?
4. **Two-controller privacy position (clause [Y]).** Does the Agreement adequately reflect APP
   obligations where both F2K and the Agent hold the buyer's data, and does the buyer-facing
   collection notice (already in the Portal) need to name the Agent's agency expressly?
5. **Jurisdiction.** Seafields is **WA**, Branscombe is **TAS** — do the agency-agreement /
   non-circumvention provisions need state-specific treatment (e.g. WA REBA / settlement-agent rules
   vs TAS Property Agents and Land Transactions Act)?
6. **Existing agents.** Confirm the **addendum** route (rollout doc §3) is sound for agents already
   under an agreement, vs requiring a fresh agreement.

---

## 3. What's already true in the system (so the clause isn't aspirational)

- First-touch attribution is **captured automatically** and stored **immutably** (migration `0063`
  trigger); admin reallocation is **logged** to an audit trail (`attribution_override`).
- Buyers with no agent link land in an **unassigned pool** (clause [X](c)(ii) reflects this).
- The buyer-facing **collection notice + consent** are captured at registration (spec §11).

So clauses [X](d) and [Y](b) describe a real, evidenced mechanism, not a promise to build one.

---

*Next: on the lawyer's sign-off, fold §1 into the master agency-agreement template; prepare the
matching one-page addendum for existing agents; mark spec §4 legal item closed.*
