// Funder Demand-Coverage Report — engine core (pure aggregations + gap types).
//
// The lender ask (Uwe, 2026-06-17) is a demand-to-settlement PIPELINE, not a registration count.
// Most stages a bank underwrites against (verified → pre-qualified → pre-approved → deposit →
// signed → settled) are NOT instrumented in the f2k registration model — the ROI form captures
// self-declared identity / lot interest / finance_status / buyer_type only. So this engine
// answers what the data supports and returns a structured GAP for everything else
// (degrade-don't-fake). The gaps roll up into the report's "Data to instrument" appendix — the
// lender's own collection roadmap. See docs/reports-feature-spec.md (Funder Demand-Coverage addendum).
//
// This module is PURE (no DB) so it unit-tests without Supabase — same pattern as
// src/lib/analytics/umami.ts. The data seam (funder-demand-report.ts) maps DB rows → these shapes
// and assembles the report. `now` is injectable everywhere a date is needed, for deterministic tests.

// ── Metric / Gap ────────────────────────────────────────────────────────────────────────────────

/** A thing the data cannot answer yet, with the instruction for making it answerable. */
export interface Gap {
  reason: string; // why we can't report it (what's missing in the model)
  toInstrument: string; // what to start capturing to close the gap (the lender's roadmap line)
}

/** Either a real value or a gap. Self-declared values are `ok` but carry `basis` at the section level. */
export type Metric<T> = { status: "ok"; value: T } | { status: "gap"; gap: Gap };

export const ok = <T>(value: T): Metric<T> => ({ status: "ok", value });
export const gap = (reason: string, toInstrument: string): Metric<never> => ({
  status: "gap",
  gap: { reason, toInstrument },
});
export const isOk = <T>(m: Metric<T>): m is { status: "ok"; value: T } => m.status === "ok";

/**
 * The cover-counting stage. Uwe explicitly asks "when you say 3× cover, which stage are you counting
 * at?" — the only instrumented stage is registered interest, so every cover figure carries this.
 */
export const COVER_STAGE_LABEL =
  "registered interest (expressions of interest) — NOT finance-ready buyers";

// ── Normalised row shapes (the seam maps DB rows → these) ────────────────────────────────────────

export interface RegRow {
  email: string | null;
  selection: string[]; // normalised lots_selected / units_selected (lot ids as strings)
  buyerType: string | null;
  financeStatus: string | null;
  createdAt: string; // ISO timestamp
}

export interface LotRow {
  id: string; // lot_number / unit_number as a string (matches RegRow.selection entries)
  retailPrice: number | null;
  allocatedTo: string | null; // a firm buyer name, a reservation-pool label, or null (available)
  stage: string | null;
  intentLockedRegId: string | null; // soft admin hold — a commitment PROXY, not a paid deposit
}

// ── De-dup ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Distinct registrants by lowercased email. The model intentionally allows multiple rows per
 * person (multi-lot interest), so the funnel de-dups to count PEOPLE while coverage keeps rows to
 * measure interest intensity. Rows with no email can't be de-duped → each kept as distinct.
 */
export function dedupeByPerson(rows: RegRow[]): RegRow[] {
  const seen = new Set<string>();
  const out: RegRow[] = [];
  for (const r of rows) {
    const key = r.email?.trim().toLowerCase();
    if (!key) {
      out.push(r);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

// ── Funnel ───────────────────────────────────────────────────────────────────────────────────────

export type StageBasis = "verified" | "self-declared" | "proxy" | "none";

export interface FunnelStage {
  key: string;
  label: string;
  metric: Metric<number>;
  basis: StageBasis;
}

const PRE_APPROVED = "Pre-approved by lender";
const CASH_BUYER = "Cash buyer — no finance needed";

/** The demand-to-settlement funnel: registered is real, finance is self-declared, the rest are gaps. */
export function buildFunnel(rows: RegRow[]): { stages: FunnelStage[] } {
  const people = dedupeByPerson(rows);
  const preApproved = people.filter((r) => r.financeStatus === PRE_APPROVED).length;

  const stages: FunnelStage[] = [
    {
      key: "registered",
      label: "Registered (expressions of interest)",
      metric: ok(rows.length),
      basis: "self-declared",
    },
    {
      key: "registered_deduped",
      label: "Distinct registrants (de-duplicated by email)",
      metric: ok(people.length),
      basis: "self-declared",
    },
    {
      key: "verified",
      label: "Verified / spoken to",
      metric: gap(
        "No contact/verification field exists on a registration — we don't record whether anyone has spoken to or verified a registrant.",
        "Add a verification step (e.g. contacted_at / verified_by) the team sets after a call.",
      ),
      basis: "none",
    },
    {
      key: "pre_qualified",
      label: "Pre-qualified on borrowing capacity",
      metric: gap(
        "No income or borrowing-capacity figure is captured anywhere.",
        "Capture income / borrowing capacity (or a broker pre-qual outcome) per registrant.",
      ),
      basis: "none",
    },
    {
      key: "finance_pre_approval",
      label: "Finance pre-approval (self-declared)",
      metric: ok(preApproved),
      basis: "self-declared",
    },
    {
      key: "deposit",
      label: "Deposit down",
      metric: gap(
        "No deposit is recorded. The closest signal is an admin 'intent lock' on a lot — a soft hold, NOT money paid (reported under coverage as a proxy).",
        "Record deposit taken (amount + date) against a registration.",
      ),
      basis: "proxy",
    },
    {
      key: "signed",
      label: "Contract signed",
      metric: gap("No contract field exists.", "Record contract executed (date) against a registration."),
      basis: "none",
    },
    {
      key: "settled",
      label: "Settled",
      metric: gap("No settlement field exists.", "Record settlement (date) against a registration."),
      basis: "none",
    },
  ];
  return { stages };
}

/** Conversion between consecutive funnel stages where BOTH endpoints are real numbers. */
export function funnelConversions(
  stages: FunnelStage[],
): { from: string; to: string; rate: Metric<number> }[] {
  const out: { from: string; to: string; rate: Metric<number> }[] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    const a = stages[i];
    const b = stages[i + 1];
    if (isOk(a.metric) && isOk(b.metric) && a.metric.value > 0) {
      out.push({ from: a.key, to: b.key, rate: ok(b.metric.value / a.metric.value) });
    } else {
      out.push({
        from: a.key,
        to: b.key,
        rate: gap(
          "Drop-off can't be computed — one of these stages isn't instrumented.",
          "Instrument both stages to report conversion.",
        ),
      });
    }
  }
  return out;
}

// ── Price tiers ──────────────────────────────────────────────────────────────────────────────────

const AUD = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

/**
 * Tier a set of lot prices. Few distinct prices (≤8 — e.g. Seafields' flat size bands) → each
 * distinct price is its own tier. Many distinct prices (e.g. Branscombe per-unit) → quartile bands.
 * Null prices → an "Unpriced" tier. Returns a function mapping a price to its tier label, plus the
 * ordered tier labels (cheapest → dearest, Unpriced last).
 */
export function buildTiering(prices: (number | null)[]): {
  tierOf: (price: number | null) => string;
  order: string[];
} {
  const priced = Array.from(new Set(prices.filter((p): p is number => p != null))).sort(
    (a, b) => a - b,
  );
  const hasUnpriced = prices.some((p) => p == null);

  if (priced.length === 0) {
    return { tierOf: () => "Unpriced", order: hasUnpriced ? ["Unpriced"] : [] };
  }

  if (priced.length <= 8) {
    const order = priced.map((p) => AUD.format(p));
    if (hasUnpriced) order.push("Unpriced");
    return {
      tierOf: (price) => (price == null ? "Unpriced" : AUD.format(price)),
      order,
    };
  }

  // Quartile bands.
  const q = (frac: number) => priced[Math.min(priced.length - 1, Math.floor(frac * priced.length))];
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const labels = [
    `${AUD.format(priced[0])}–${AUD.format(cuts[0])}`,
    `${AUD.format(cuts[0])}–${AUD.format(cuts[1])}`,
    `${AUD.format(cuts[1])}–${AUD.format(cuts[2])}`,
    `${AUD.format(cuts[2])}–${AUD.format(priced[priced.length - 1])}`,
  ];
  const tierOf = (price: number | null): string => {
    if (price == null) return "Unpriced";
    if (price <= cuts[0]) return labels[0];
    if (price <= cuts[1]) return labels[1];
    if (price <= cuts[2]) return labels[2];
    return labels[3];
  };
  const order = [...labels];
  if (hasUnpriced) order.push("Unpriced");
  return { tierOf, order };
}

// ── Coverage (demand vs supply) ──────────────────────────────────────────────────────────────────

export interface LotCoverage {
  id: string;
  price: number | null;
  tier: string;
  demand: number; // # of registration rows that selected this lot
  available: boolean; // no firm buyer allocated
  intentLocked: boolean; // soft admin hold (commitment proxy, not a deposit)
}

export interface TierCoverage {
  tier: string;
  lotCount: number;
  availableLotCount: number;
  demand: number; // total selections across the tier's lots
  cover: number; // demand ÷ lotCount  (stage = registered interest)
  thin: boolean; // cover < 1 — supply not matched by interest
}

export interface CoverageResult {
  overallCover: number; // total selections ÷ total lots (registered-interest stage)
  totalLots: number;
  availableLots: number;
  intentLockedLots: number; // proxy-commitment count
  byLot: LotCoverage[];
  byTier: TierCoverage[];
  cheapestLots: { n: number; cover: number; lotIds: string[] }; // Uwe's "five cheapest" concern
  coverStage: string;
}

/** A pool label (GROH/WACHS/Tarken/…) is a reservation pool, not a sold lot — see seafields-allocation-pool-model. */
function isFirmBuyer(allocatedTo: string | null): boolean {
  // We treat ANY non-empty allocated_to as "not freely available". Distinguishing a named retail
  // buyer from a pool is a separate concern; for supply we only ask "is this lot free to sell?".
  return Boolean(allocatedTo && allocatedTo.trim() !== "");
}

export function buildCoverage(
  rows: RegRow[],
  lots: LotRow[],
  opts: { cheapestN?: number } = {},
): Metric<CoverageResult> {
  if (lots.length === 0) {
    return gap(
      "This estate has no priced lot/unit table, so demand can't be mapped against supply.",
      "Add a lot/unit allocation table with retail_price for this estate.",
    );
  }
  const cheapestN = opts.cheapestN ?? 5;

  // demand per lot id
  const demandByLot = new Map<string, number>();
  for (const r of rows) {
    for (const sel of r.selection) {
      demandByLot.set(sel, (demandByLot.get(sel) ?? 0) + 1);
    }
  }

  const { tierOf, order } = buildTiering(lots.map((l) => l.retailPrice));

  const byLot: LotCoverage[] = lots.map((l) => ({
    id: l.id,
    price: l.retailPrice,
    tier: tierOf(l.retailPrice),
    demand: demandByLot.get(l.id) ?? 0,
    available: !isFirmBuyer(l.allocatedTo),
    intentLocked: Boolean(l.intentLockedRegId),
  }));

  const byTier: TierCoverage[] = order
    .map((tier) => {
      const tierLots = byLot.filter((l) => l.tier === tier);
      const demand = tierLots.reduce((s, l) => s + l.demand, 0);
      const lotCount = tierLots.length;
      return {
        tier,
        lotCount,
        availableLotCount: tierLots.filter((l) => l.available).length,
        demand,
        cover: lotCount > 0 ? demand / lotCount : 0,
        thin: lotCount > 0 && demand / lotCount < 1,
      };
    })
    .filter((t) => t.lotCount > 0);

  const totalDemand = byLot.reduce((s, l) => s + l.demand, 0);
  const cheapest = [...byLot]
    .filter((l) => l.price != null)
    .sort((a, b) => (a.price as number) - (b.price as number))
    .slice(0, cheapestN);
  const cheapestDemand = cheapest.reduce((s, l) => s + l.demand, 0);

  return ok({
    overallCover: lots.length > 0 ? totalDemand / lots.length : 0,
    totalLots: lots.length,
    availableLots: byLot.filter((l) => l.available).length,
    intentLockedLots: byLot.filter((l) => l.intentLocked).length,
    byLot,
    byTier,
    cheapestLots: {
      n: cheapest.length,
      cover: cheapest.length > 0 ? cheapestDemand / cheapest.length : 0,
      lotIds: cheapest.map((l) => l.id),
    },
    coverStage: COVER_STAGE_LABEL,
  });
}

// ── Buyer mix (all self-declared) ────────────────────────────────────────────────────────────────

export interface BuyerMix {
  total: number; // distinct registrants
  ownerOccupier: number;
  investor: number;
  unknownType: number;
  firstHomeBuyer: number;
  financeReady: number; // self-declared pre-approved OR cash
  financePreApproval: number; // self-declared pre-approved only
  selfDeclared: true; // a label the surface must show — none of this is verified
  borrowingCapacityBands: Metric<never>;
  incomeBands: Metric<never>;
  fhbSchemeEligibility: Metric<never>;
}

function classifyBuyer(buyerType: string | null): "owner-occupier" | "investor" | "unknown" {
  if (!buyerType || !buyerType.trim()) return "unknown";
  const t = buyerType.toLowerCase();
  // "Investor — Rental / SMSF" is the rental investor; "Investor — Owner Occupier" lives in it.
  if (t.includes("rental") || t.includes("smsf")) return "investor";
  return "owner-occupier";
}

export function buildBuyerMix(rows: RegRow[]): BuyerMix {
  const people = dedupeByPerson(rows);
  let ownerOccupier = 0;
  let investor = 0;
  let unknownType = 0;
  let firstHomeBuyer = 0;
  let financeReady = 0;
  let financePreApproval = 0;

  for (const r of people) {
    switch (classifyBuyer(r.buyerType)) {
      case "owner-occupier":
        ownerOccupier++;
        break;
      case "investor":
        investor++;
        break;
      default:
        unknownType++;
    }
    if ((r.buyerType ?? "").toLowerCase().includes("first home")) firstHomeBuyer++;
    if (r.financeStatus === PRE_APPROVED || r.financeStatus === CASH_BUYER) financeReady++;
    if (r.financeStatus === PRE_APPROVED) financePreApproval++;
  }

  return {
    total: people.length,
    ownerOccupier,
    investor,
    unknownType,
    firstHomeBuyer,
    financeReady,
    financePreApproval,
    selfDeclared: true,
    borrowingCapacityBands: gap(
      "No borrowing-capacity figure is captured.",
      "Capture borrowing capacity (or band) per registrant.",
    ),
    incomeBands: gap(
      "No income figure is captured.",
      "Capture household income (or band) per registrant.",
    ),
    fhbSchemeEligibility: gap(
      "First-home-buyer COUNT is captured (self-declared buyer_type), but scheme ELIGIBILITY (income/price caps, residency, prior ownership) is not assessed.",
      "Assess FHB-scheme eligibility (income/price thresholds) per first-home registrant.",
    ),
  };
}

// ── Trend ────────────────────────────────────────────────────────────────────────────────────────

/** UTC Monday (YYYY-MM-DD) of the week containing `iso`. Week-bucket key, year-boundary safe. */
export function weekStartUTC(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
  return monday.toISOString().slice(0, 10);
}

export interface TrendResult {
  byWeek: { weekStart: string; count: number; cumulative: number }[];
  runRatePerWeek: number; // trailing up-to-4-week mean of weekly counts
  total: number;
  projectedCover: Metric<{ thresholdCover: number; targetRegistrations: number; projectedDate: string | null }>;
  coverStage: string;
}

/**
 * Registration momentum. `coverThreshold` × `totalLots` = the registered-interest target the funding
 * trigger is set at; with a positive run-rate we project the date it's hit. Qualified-stage velocity
 * is a gap (no qualified timestamp exists).
 */
export function buildTrend(
  rows: RegRow[],
  opts: { coverThreshold?: number; totalLots?: number; now?: Date } = {},
): TrendResult {
  const now = opts.now ?? new Date();
  const counts = new Map<string, number>();
  for (const r of rows) {
    const wk = weekStartUTC(r.createdAt);
    counts.set(wk, (counts.get(wk) ?? 0) + 1);
  }
  const weeks = Array.from(counts.keys()).sort();
  let cumulative = 0;
  const byWeek = weeks.map((weekStart) => {
    cumulative += counts.get(weekStart) ?? 0;
    return { weekStart, count: counts.get(weekStart) ?? 0, cumulative };
  });

  const lastN = byWeek.slice(-4);
  const runRatePerWeek =
    lastN.length > 0 ? lastN.reduce((s, w) => s + w.count, 0) / lastN.length : 0;
  const total = rows.length;

  let projectedCover: TrendResult["projectedCover"];
  if (opts.coverThreshold == null || opts.totalLots == null || opts.totalLots <= 0) {
    projectedCover = gap(
      "No cover threshold / lot supply supplied for this estate, so a projected trigger date can't be computed.",
      "Set the funding-trigger cover threshold and ensure the estate has a priced lot table.",
    );
  } else {
    const targetRegistrations = opts.coverThreshold * opts.totalLots;
    let projectedDate: string | null = null;
    if (total >= targetRegistrations) {
      projectedDate = now.toISOString().slice(0, 10); // already met
    } else if (runRatePerWeek > 0) {
      const weeksOut = (targetRegistrations - total) / runRatePerWeek;
      const d = new Date(now.getTime() + weeksOut * 7 * 24 * 60 * 60 * 1000);
      projectedDate = d.toISOString().slice(0, 10);
    } // else runRate 0 → projectedDate stays null (stalled — surface an early warning)
    projectedCover = ok({
      thresholdCover: opts.coverThreshold,
      targetRegistrations,
      projectedDate,
    });
  }

  return { byWeek, runRatePerWeek, total, projectedCover, coverStage: COVER_STAGE_LABEL };
}
