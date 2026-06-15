// Per-project funding model — the data behind each funder page (overview + per-project).
//
// Static config, imported client-side, consistent with how the rest of the project data is
// stored (src/data/<project>/...). There is intentionally NO Supabase table for this: the
// numbers come from each project's finance model and are versioned in code, not edited at
// runtime. Where a project has no confirmed model yet, set status 'pending' and the page
// renders the "stack pending confirmation" card instead of figures — never invent numbers.

export type FundingStatus = "pending" | "open" | "triggered";

export type CostStackItem = {
  label: string;
  value: number;
};

/** A confirmed-or-modelled project funding model (status !== 'pending'). */
export type ProjectFundingModel = {
  slug: string; // matches the estate route slug, e.g. "branscombe-estate"
  name: string;
  location: string;
  unit_count: number;
  status: Exclude<FundingStatus, "pending">;

  // The committed development facility lenders fund (the "Funding Package").
  package_amount: number;

  // Project economics (indicative until 3x cover).
  grv: number; // gross realisable value
  tdc: number; // total development cost, ex-finance
  margin_pct: number; // GST-correct, on net realisation
  cost_stack: CostStackItem[]; // sums to tdc

  // Demand vs the 3x (300% cover) trigger.
  demand_current_x: number; // e.g. 1.5
  demand_trigger_x: number; // 3
  demand_note?: string; // e.g. "55 registrations vs 37 lots"
};

/** A project whose finance model isn't confirmed yet — renders the pending card, no figures. */
export type ProjectFundingPending = {
  slug: string;
  name: string;
  location: string;
  status: "pending";
  unit_count?: number;
};

export type ProjectFunding = ProjectFundingModel | ProjectFundingPending;

export function isConfirmedFunding(
  f: ProjectFunding,
): f is ProjectFundingModel {
  return f.status !== "pending";
}

// ---- Lender structure (consistent everywhere) ----
// Senior: 50% of the package + first right of refusal on the retail mortgage book.
// Junior: shares the remaining 50%; each tranche min 10%, max 50% of the package.
export const SENIOR_PCT = 50;
export const JUNIOR_MIN_PCT = 10;
export const JUNIOR_MAX_PCT = 50;

export function seniorAmount(packageAmount: number): number {
  return (SENIOR_PCT / 100) * packageAmount;
}

export function juniorAmount(packageAmount: number, pct: number): number {
  return (pct / 100) * packageAmount;
}
