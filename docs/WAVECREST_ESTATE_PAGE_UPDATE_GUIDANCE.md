# Wavecrest Estate page — update guidance (lot data)

**For:** a future F2K-Projects session.
**Goal:** replace the static "lot selection coming soon" Wavecrest site map with a real, data-driven lot layout — lot numbers, sizes, status — matching how **Seafields** and **Branscombe** already work.
**Status of inputs:** the real lot schedule has been extracted from Drive and drafted to `docs/wavecrest-lot-schedule.DRAFT.csv` (this repo). Source-of-truth provenance is in that file's `internal_notes` per row.

---

## 1. Where it stands today (what to change)

- **Public page `/wavecrest-estate`** renders lots as a **static PNG** — `SiteMap.tsx` swaps images (`plan: "/wavecrest/wavecrest-lot-layout.png"`, modes plan/schematic/satellite/official). Only **Lot 91 ("2 Brownlie Street")** is individually labelled. The page says *"Lot selection coming soon."* Lots are **not clickable** and there is **no lot dataset** behind the map.
- **Admin scaffolding already exists** but is unpopulated: `src/app/admin/wavecrest-lots`, `wavecrest-import`, `wavecrest-stages`, `wavecrest-dwelling-types`, `src/app/api/wavecrest/*`.
- **⚠️ Do NOT use the two Drive CSVs** (`wavecrest-lot-schedule-full.csv`, `-template.csv`). They are **synthetic placeholders** (lots 1–15, fake 450/480/500 m², "R1/R2" zones, round prices) — a schema scaffold only, **not real data**. The real lots are 83–115 at 2000–3013 m².

## 2. The reference pattern (copy this)

**Seafields** is the worked example of a data-driven estate in this repo:
- Table `seafields_lot_allocations(lot_number PK, sqm, allocated_to, dwelling_type, stage, zone, category, x_pct, y_pct)` — note `x_pct/y_pct` are **percentage positions on the plan image**, not lat/lng.
- Public views (`0006_seafields_public_views.sql`) + registration linkage (`0004_seafields_registration_lots.sql`) + audit trigger (`0005`).

Build **`wavecrest_lot_allocations`** the same way (same columns + the extra ones below), and make `SiteMap.tsx` render clickable lot polygons/markers off it (as Seafields/Branscombe do) instead of the static PNG.

## 3. The data to import

Source: **`docs/wavecrest-lot-schedule.DRAFT.csv`** (33 rows, lots 83–115). Columns map to:
`lot_number, stage, sqm, dwelling_type, wholesale_price, retail_price, status, zone, land_only, house_cost, display_price_to_public, public_label, subdivisible, ancillary_dwelling_eligible, internal_notes`.

**Data-confidence is NOT uniform — preserve it.** Add an `area_confidence` (or `area_source`) column when you import, derived from each row's `internal_notes`:
- **surveyed** (high) — only **Lots 88 (2250 m²), 91 (2148 m²), 112 (3013 m²)** — from Quantum feature surveys.
- **plan_ocr** (medium) — most others — OCR of the approved subdivision plan; show as "approx".
- **narrative** — **Lot 109 (~2,500 m²)** — from the purchaser MOM, not surveyed.
- **illegible** (blank sqm) — Lots 85, 89, 93, 94, 106, 107, 108, 113 (and partly 83, 86, 99) — **do not display a fabricated area**; show "area TBC".

**Status flags from the plan:** SOLD = 85, 86, 89, 110, 112, 114; UNDER CONTRACT = 91, 109; POS (not saleable) = 115; the rest available. Two "FUTURE SUBDIVISION" blocks have no lot numbers yet.

**Lot 109 is a live contracted sale** — Jacob & Annabelle Peers, **Koala70 turnkey ($327,700 retail)**. Surface it as under-contract, not available.

## 4. Addressing / geocoding — the key constraint (read before wiring any map)

**No lot has a street number** — titles are not yet issued. Every lot is referenced as `Lot N, Brownlie Street, Waggrakine WA 6530` (some lots front **Ulla Street** — the second frontage road). So:
- **Do not geocode individual lots** — Mapbox cannot resolve "Lot 109"; it only resolves the street/locality. The estate anchor (Brownlie St, Waggrakine → City of Greater Geraldton) is shared by all lots; `estates.ts` already stores a Wavecrest pin (`coords: {lat: -28.705, lng: 114.652}`).
- **Lot positioning is plan-relative** — use `x_pct/y_pct` over the plan image (Seafields pattern), OR import true polygons. Real per-lot **centroids exist only for 88/91/112** (the georeferenced Quantum surveys, Drive ids in §6) — the rest would need the pre-calc plan `25259PC01`.
- **Store a synthetic address** per lot, never a geocoder output: `Lot {N}, Brownlie Street, Waggrakine WA 6530`.

## 5. Build checklist

1. **Migration** — `wavecrest_lot_allocations` (mirror `seafields_lot_allocations` + `status`, `area_confidence`, `land_only`/`retail_price`, `dwelling_type`, `public_label`, `x_pct`/`y_pct`). RLS on. Audit trigger like `0005`.
2. **Import** — load `docs/wavecrest-lot-schedule.DRAFT.csv` via the existing `admin/wavecrest-import` flow (or a seed migration). Carry `area_confidence`; leave illegible areas NULL.
3. **SiteMap** — make it data-driven + clickable (Seafields/Branscombe parity): lot number always; size shown as exact (surveyed) / "approx" (plan) / "TBC" (illegible); status chip (available / under contract / sold / POS).
4. **Per-lot detail** — lot number, size (+confidence), status, dwelling/price where known (Lot 109 = Koala70 $327,700). For sold/contracted lots, hide pricing.
5. **Remove the "coming soon" gate** once lots render.
6. **Verify illegible areas** before publishing exact figures — open the current revision plan (`Wavecrest Stage Plan NEW #`, image-only — needs a visual read) and the pre-calc `25259PC01` to fill 85/89/93/94/106/107/108/113.
7. **Responsive** — the lot map + per-lot cards must reflow ≤414px and ≥1280px (portfolio rule).

## 6. Source provenance (Drive)

- Approved lot grid 83–115 + status + Lot 109: `approved plan Wavecrest Moresby_Geraldton Stg1.pdf` (id `1lS2mhN3nJv3sLLVjrE63ilUnsqkZg4Jo`).
- Surveyed areas + frontage: Quantum surveys — Lot 88 `1CPgXUztQ_4Z8mlbHYjT1yPJht9VAiVtV`, Lot 91 `1-fItTNuukS92pmw-jP4t3_E8ZclervdR`, Lot 112 `1BXBW__QSWvZT715SXChPM35SZIBrEEm0`.
- Lot 109 contract/spec: MOM `1UVuDX6yz8J6_SpgB54dFYJMuNWkWXRse`; email `1FeSNK2N9cQJ5ER0ha-8RGFpU6I1SWLoY`.
- Land prices (PF strategy): `1IW3UBrkelyaizBfHzWWNt9P0v6lO5m7rFKLOpSKBoSU` (Lots 91 & 112 ~$250k, Lot 88 ~$280k).
- Stage/road context: surveyor "Stage 2"; engineering drawings reference "Brownlie Rd Stage 3A" + Brownlie–Ulla intersection. Staging terminology is inconsistent across surveyor vs sales docs — reconcile before labelling stages publicly.
- Current-revision plan (image-only, needs visual read): `Wavecrest Stage Plan NEW #` id `1z9Z5pRSa8aJ9cp-IXEffApVK_4a4F3x0`.

## 7. Cross-repo note (not this repo's job, but relevant)

Lot 109 has been set up as a project in **F2K-Checkpoint** (separate repo/DB) under the Factory2Key tenant for the build/procurement workflow. This F2K-Projects task is only the **public estate marketing page**. If a shared estate/lot source is ever wanted, the same `wavecrest_lot_allocations` data could feed both — but that's a later integration, out of scope here.
