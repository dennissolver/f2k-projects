# Wavecrest Estate — Page Build Plan (v2)

**Repo:** `dennissolver/f2k-projects` (private) · Next.js App Router · Vercel team *Corporate AI Solutions* · `f2k-projects.vercel.app`
**New route:** `/wavecrest-estate`
**Model:** **Seafields-style staged estate** (interactive staged lot plan) — *not* the Branscombe placeholder approach. Wavecrest is structure-planned with real stages and a published lot layout.

> v2 changes: F2K confirmed as **Project Manager** for the development; estate confirmed as HLD's structure-planned ~1,860-lot Wavecrest Estate; build model switched from Branscombe-lite to Seafields-style staging; real estate facts + lot master plan sourced from hld.com.au.

---

## 1. Roles & parties

- **Project Manager:** Factory2Key Pty Ltd (Dennis McMahon). F2K runs the project — consultants, council, contractors, programme — and is the source-of-truth coordinator for page data.
- **Landowner / Developer:** Humfrey Land Developments (HLD) / The Hunt Property Joint Venture — Barry Humfrey (barryh@hld.com.au, 0428 648 028; also Mary, maryh@hld.com.au). HLD holds the Structure Plan and stage approvals and publishes the estate at hld.com.au/wavecrest-estate.
- **Client / applicant:** Property Friends Pty Ltd — Uwe Jacobs.
- **Display home:** Lot 91, No. 2 Brownlie Street — single-lift Modular WA modular (F2K showcase within the estate).

The page "Developer" framing should follow the Seafields precedent (F2K-led marketing of an HLD estate), with F2K as the coordinating PM.

## 2. Repo conventions (confirmed)

- Route pages: `src/app/<estate>-estate/page.tsx`
- Per-estate components: `src/components/<estate>/` (confirmed `src/components/seafields/RegistrationForm.tsx`)
- Public assets: `public/<estate>/`
- Registrations: Supabase-backed (per-project tag)

## 3. Page model — clone Seafields

Wavecrest is content-and-structure equivalent to Seafields, so **clone the Seafields page, not Branscombe**:
- Interactive staged subdivision plan (plan / satellite / schematic / official-drawing views)
- Per-lot data: size, price band, status, stage
- Stage logic (open / locked / reserved)
- Two-ways-to-buy: vacant serviced land + F2K modular house & land
- Reused Geraldton market stats (same town as Seafields)
- Modular design cards (shared F2K range)

The Seafields interactive plan is driven by the CLE deposited plan; **Wavecrest's equivalent is HLD's Lot Numbers & Layout plan + the approved stage plans** (see §6).

## 4. Estate facts (source: hld.com.au/wavecrest-estate)

- **~1,860 lots total**, Geraldton WA. Structure-planned coastal estate with ocean & city views.
- Master features: **Town Centre, Northern Recreational Area, School, Tourist Resort, Caravan Park sites**; access to town/school/recreation via the **Tramway Road extension**; parks & gardens built as developer commitment.
- **Lot mix:** 1 ha lots down to **R80 townhouse** lots; **300 m²** lots surrounding parks; **760–820 m²** as the well-catered middle; **2,000 m²** premium (Stage 3).
- **Services:** underground (per stage, as subdivision completes).
- Develops alongside HLD's Seafields Estate (same developer, same region).

## 5. Stages (live now)

- **Stage 2 — 61 lots.** Ocean & city views, via Sutcliffe & Tramway Roads, all services underground. **Approved for construction.**
- **Stage 3 — 2,000 m² lots.** Off Hackett Road, ocean & city views. **Planning + construction approval granted.**
- Earlier/other stages and the ~1,860-lot full build sit behind these as future releases (mirror Seafields' open-vs-locked stage treatment).

## 6. Lot master plan & estate assets

The "master plan with lots" exists in two forms:
- **HLD "Lot Numbers and Layout" plan** (public, current/approved) — primary basis for the interactive plan.
- **Montgomery R002 "Drawing Key Plan & Precalculated Plan"** (in Drive; pre-approval version, came via Barry → John Montgomery). Interim until HLD's plan images are in.

HLD page assets to bring in (see §9 for status):
- Lot Numbers & Layout (master plan) — `/wp-content/uploads/2025/06/Lot-Numbers-and-Layout_page-0001-Updated.png`
- Stage 2 approval plan — `/wp-content/uploads/2025/12/Stage-2-68-Lot_Approval-10-scaled.png`
- Agonis Lane — `/wp-content/uploads/2026/02/AGONIS-LANE-scaled.png`
- Panorama — `/wp-content/uploads/2018/11/IMG_20140511_143703-PANO1.jpg`
- Moresby aerial (marked boundaries) — `/wp-content/uploads/2018/11/IMG_7442PP-Moresby-aerial-with-marked-boundaries-and-title-1.jpg`
- Aerial — `/wp-content/uploads/2019/04/8-e1554365719201.jpg`
- Flyover video — youtube.com/watch?v=RrjdYPyms40 (Branscombe-style site flyover)

## 7. Open decisions / placeholders (PM to confirm)

1. **Marketed scope.** All 1,860 lots is the whole HLD estate; the F2K page markets a defined subset/stages (as Seafields markets 145). Confirm which stages/lots are in scope for the F2K page (likely Stage 2 + Stage 3 to start).
2. **Lot schedule.** Per-lot numbers, sizes, status, price — read off the Lot Numbers & Layout / Stage 2 plan once images are in. Pricing bands TBC (likely from HLD/PF).
3. **Servicing reconciliation.** Estate marketing = underground services (per HLD). The **Lot 91 display home uses interim septic + leach drains** because it precedes subdivision servicing/titles — that is a display-home special case, **not** the estate servicing line. Keep them separate on the page.
4. **Lot 91 linkage.** HLD describes the estate via Sutcliffe/Tramway/Hackett Roads; the display home is on Brownlie/Ulla. The Montgomery correspondence calls Lot 91's subdivision "Wavecrest," so same estate — confirm Brownlie St sits within this structure plan before committing lot data.
5. **Pricing + covenant + zoning** (R-codes vary across the estate: R80 townhouse through 1 ha) — confirm per stage.

## 8. Build phases

### Phase 0 — confirm internals (clone source = Seafields)
Open in repo: `src/app/seafields-estate/page.tsx`, the Seafields **lot data file** (per-lot size/price/status/stage + stage definitions), the homepage **projects list**, and `src/components/seafields/RegistrationForm.tsx` (note the project enum to add a `wavecrest` value in Supabase).

### Phase 1 — scaffold
Clone `src/components/seafields/` → `src/components/wavecrest/`; create `src/app/wavecrest-estate/page.tsx`; create `public/wavecrest/` (lot plan, stage plans, panorama, aerial, og image); rename internal references.

### Phase 2 — populate known content
Hero · About (HLD estate facts §4) · fact table (Developer HLD/Hunt Property JV, PM Factory2Key, ~1,860 lots, structure-planned, services underground, lot mix) · stages §5 · reused Geraldton market stats · two-ways-to-buy · modular design cards · sales terms · contacts (Uwe + Dennis; HLD/Barry as developer).

### Phase 3 — lot data + interactive plan
Build `src/data/wavecrest.ts` Seafields-shaped: stage definitions + per-lot records (no · size · status · stage · price · product type), populated from the Lot Numbers & Layout / Stage 2 plan. Wire the interactive staged plan to it. Display home (Lot 91) flagged as a feature within the estate.

### Phase 4 — wire up
Registration form with `wavecrest` project tag; add Wavecrest card to homepage grid; add to nav; optional `src/app/blog/wavecrest/page.tsx`; site-flyover section using the HLD YouTube video (Branscombe pattern).

### Phase 5 — ship
Branch → Vercel preview → review → merge to `main`.

## 9. Asset inventory & status — Wavecrest Project Files (Drive)

**In the folder now (copied):**
- 19 site photos (`site-photo-01..19.jpg`)
- `survey-25653-lot91.pdf`, `TP01-DA-site-plan.pdf`
- `MWA-25278-RevK-working-drawings.pdf`, `MWA-25278-IFC-Rev0.pdf`
- `Montgomery-R002-key-plan.pdf` (interim lot layout), `Montgomery-R050-brownlie-ulla-intersection.pdf`
- `Wavecrest-subdivision-engineering-plans-context.pdf`

**Pending (HLD page images — can't be pulled server-side; hld.com.au not reachable from the build environment):**
- Lot Numbers & Layout, Stage 2 approval, Agonis Lane, panorama, Moresby aerial, aerial, flyover video.
- Get them in by either: (A) Dennis saves them into the folder / `public/wavecrest/` from the URLs in §6, or (B) add `hld.com.au` to the assistant's allowed network domains and it fetches + uploads them.

## 10. Compliance note

Public ROI marketing page; F2K is PM. Keep the existing "indicative / subject to confirmation / registration is not an offer" disclaimers. Estate facts and lot data should track HLD's published Structure Plan / approved stage plans; reconcile the F2K lot schedule against HLD's plan and the approved deposited plan when issued. The Lot 91 display home (mid-DA, RFI due 8 June) is a feature within the estate, not a lot for sale — and its interim septic servicing must not be presented as the estate servicing.
