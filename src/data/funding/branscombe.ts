import type { ProjectFundingModel } from "./types";

// Branscombe funding model — from the V23/V24 finance model (build brief §11).
//
// Funding package = the back-to-back PEAK DRAWN exposure (~$8.0M), chosen by Dennis as the
// figure lenders fund (2026-06-15). Buyer progress-payments flow back as the build rises, so
// the facility peaks low and clears mid-build — this is the de-risked exposure number, not the
// $14.93M base senior ask nor the $17.7M total development cost. Senior 50% ≈ $4.0M; junior
// 10% floor ≈ $0.8M.
//
// Cost stack sums to the total development cost (ex-finance) of $17,735,006 and is shown against
// GRV ($25,345,000) in the project's cost-vs-revenue visual — a SEPARATE thing from the funding
// package above (which is the senior/junior capital stack). Margin 23.0% is GST-correct on net
// realisation. Demand ~1.5x cover (55 registrations vs 37 lots); trigger is 3x (111).

export const branscombeFunding: ProjectFundingModel = {
  slug: "branscombe-estate",
  name: "Branscombe",
  location: "Claremont TAS",
  unit_count: 37,
  status: "open",

  package_amount: 8_000_000, // back-to-back peak drawn (Dennis 2026-06-15)

  grv: 25_345_000, // 37 × $685,000
  tdc: 17_735_006,
  margin_pct: 23.0,
  cost_stack: [
    { label: "Land", value: 2_500_000 },
    { label: "Site works", value: 3_500_000 },
    { label: "Modules", value: 7_314_000 },
    { label: "Shipping — sea", value: 1_800_000 },
    { label: "Shipping — land", value: 196_500 },
    { label: "Install & complexing", value: 666_000 },
    { label: "Builder & warranty", value: 185_000 },
    { label: "Finishing", value: 919_968 },
    { label: "Fees", value: 653_538 },
  ],

  demand_current_x: 1.5,
  demand_trigger_x: 3,
  demand_note: "≈55 registrations vs 37 lots",
};
