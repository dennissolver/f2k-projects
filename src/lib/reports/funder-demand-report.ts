// Funder Demand-Coverage Report — data seam + assembly.
//
// Maps an estate's DB rows (registrations + priced lots) into the pure engine's shapes
// (src/lib/reports/funder-demand.ts), runs the builders, and assembles the report + a flat gap
// list (the "Data to instrument" appendix). Read-only service-role queries — no LLM SQL, no writes.
//
// This is also the LLM layer's CONTRACT: FUNDER_REPORT_CAPABILITIES enumerates which metrics are
// real / self-declared / proxy / gap, so a future LLM orchestrator composing reports from these
// primitives knows — at request time — exactly what it can answer and what is a gap (and why).

import { createSupabaseService } from "@/lib/supabase-service";
import {
  buildFunnel,
  funnelConversions,
  buildCoverage,
  buildBuyerMix,
  buildTrend,
  isOk,
  COVER_STAGE_LABEL,
  type RegRow,
  type LotRow,
  type FunnelStage,
  type Metric,
} from "./funder-demand";

// ── Estate source map (which tables back each estate, and what they support) ─────────────────────

interface EstateSource {
  slug: string;
  name: string;
  registrationsTable: string;
  selectionField: string | null; // lots_selected / units_selected / null (no lot-level interest)
  lotTable?: { table: string; idField: string; hasStage: boolean };
}

const SOURCES: Record<string, EstateSource> = {
  seafields: {
    slug: "seafields",
    name: "Seafields Estate",
    registrationsTable: "seafields_registrations",
    selectionField: "lots_selected",
    lotTable: { table: "seafields_lot_allocations", idField: "lot_number", hasStage: true },
  },
  branscombe: {
    slug: "branscombe",
    name: "Branscombe Estate",
    registrationsTable: "branscombe_registrations",
    selectionField: "units_selected",
    lotTable: { table: "branscombe_unit_allocations", idField: "unit_number", hasStage: false },
  },
  wavecrest: {
    slug: "wavecrest",
    name: "Wavecrest Estate",
    registrationsTable: "wavecrest_registrations",
    selectionField: null, // general ROI, no lot selection captured
  },
  "dutton-terrace": {
    slug: "dutton-terrace",
    name: "Dutton Terrace",
    registrationsTable: "dutton_registrations",
    selectionField: null, // concept stage, no lot selection / no priced lot table
  },
};

export function reportableEstates(): { slug: string; name: string }[] {
  return Object.values(SOURCES).map((s) => ({ slug: s.slug, name: s.name }));
}

// ── Capability manifest — the LLM orchestrator's contract ────────────────────────────────────────

export type CapabilityBasis = "real" | "self-declared" | "proxy" | "gap";

export interface CapabilityEntry {
  metric: string;
  basis: CapabilityBasis;
  note: string;
}

/**
 * What the funder-demand primitives can and cannot answer, and on what basis. A future LLM layer
 * reads this to compose reports from the primitives and to declare gaps at request time — without
 * touching SQL or guessing. Keep it in sync with the builders.
 */
export const FUNDER_REPORT_CAPABILITIES: CapabilityEntry[] = [
  { metric: "registered count", basis: "real", note: "row count of ROI submissions (self-declared identity)." },
  { metric: "distinct registrants", basis: "real", note: "de-duplicated by lowercased email." },
  { metric: "verified / spoken to", basis: "gap", note: "no contact/verification field on a registration." },
  { metric: "pre-qualified (borrowing capacity)", basis: "gap", note: "no income/capacity captured." },
  { metric: "finance pre-approval", basis: "self-declared", note: "finance_status = 'Pre-approved by lender' (unverified)." },
  { metric: "deposit down", basis: "proxy", note: "closest signal is an admin intent-lock on a lot — NOT money paid." },
  { metric: "contract signed / settled", basis: "gap", note: "no contract/settlement fields." },
  { metric: "coverage by lot", basis: "real", note: "lots_selected/units_selected demand vs the priced lot table (Seafields, Branscombe only)." },
  { metric: "coverage by price tier", basis: "real", note: "lots grouped by retail_price tiers." },
  { metric: "owner-occupier vs investor split", basis: "self-declared", note: "from buyer_type." },
  { metric: "first-home-buyer count", basis: "self-declared", note: "buyer_type = 'First Home Buyer'." },
  { metric: "FHB scheme eligibility", basis: "gap", note: "income/price-cap eligibility not assessed." },
  { metric: "finance-ready count", basis: "self-declared", note: "finance_status in {pre-approved, cash}." },
  { metric: "borrowing-capacity / income bands", basis: "gap", note: "not captured." },
  { metric: "registrations week-by-week + run-rate", basis: "real", note: "from created_at." },
  { metric: "projected date to cover trigger", basis: "real", note: "registered-interest stage only; needs a threshold + lot supply." },
  { metric: "registered→qualified velocity", basis: "gap", note: "no qualified-stage timestamp." },
];

// ── Assembled report ─────────────────────────────────────────────────────────────────────────────

export interface GapEntry {
  section: string;
  label: string;
  reason: string;
  toInstrument: string;
}

export interface FunderDemandReport {
  estate: { slug: string; name: string };
  generatedAt: string;
  coverStage: string;
  dataError: string | null;
  funnel: ReturnType<typeof buildFunnel>;
  conversions: ReturnType<typeof funnelConversions>;
  coverage: ReturnType<typeof buildCoverage>;
  buyerMix: ReturnType<typeof buildBuyerMix>;
  trend: ReturnType<typeof buildTrend>;
  gaps: GapEntry[];
  capabilities: CapabilityEntry[];
}

/** Default funding-trigger cover Uwe references ("three-times cover"). Tunable per estate later. */
const DEFAULT_COVER_THRESHOLD = 3;

interface RawReg {
  email: string | null;
  buyer_type: string | null;
  finance_status: string | null;
  created_at: string;
  [k: string]: unknown; // the dynamic selection field
}

interface RawLot {
  retail_price: number | null;
  allocated_to: string | null;
  stage?: string | null;
  intent_locked_to_registration_id: string | null;
  [k: string]: unknown; // the dynamic id field
}

export async function buildFunderDemandReport(
  slug: string,
  opts: { coverThreshold?: number; now?: Date } = {},
): Promise<FunderDemandReport> {
  const source = SOURCES[slug];
  if (!source) throw new Error(`Unknown estate slug for funder report: ${slug}`);

  const now = opts.now ?? new Date();
  const supabase = createSupabaseService();
  let dataError: string | null = null;

  // --- registrations ---
  let regRows: RegRow[] = [];
  const regCols = ["email", "buyer_type", "finance_status", "created_at"];
  if (source.selectionField) regCols.push(source.selectionField);
  const { data: regData, error: regErr } = await supabase
    .from(source.registrationsTable)
    .select(regCols.join(","));
  if (regErr) {
    dataError = `Could not read ${source.registrationsTable}: ${regErr.message}`;
  } else {
    regRows = (regData as unknown as RawReg[] | null ?? []).map((r) => ({
      email: r.email,
      selection: source.selectionField
        ? normaliseSelection(r[source.selectionField])
        : [],
      buyerType: r.buyer_type,
      financeStatus: r.finance_status,
      createdAt: r.created_at,
    }));
  }

  // --- lots (only where a priced table exists) ---
  let lotRows: LotRow[] = [];
  if (source.lotTable && !dataError) {
    const lotCols = [
      source.lotTable.idField,
      "retail_price",
      "allocated_to",
      "intent_locked_to_registration_id",
    ];
    if (source.lotTable.hasStage) lotCols.push("stage");
    const { data: lotData, error: lotErr } = await supabase
      .from(source.lotTable.table)
      .select(lotCols.join(","));
    if (lotErr) {
      dataError = `Could not read ${source.lotTable.table}: ${lotErr.message}`;
    } else {
      lotRows = (lotData as unknown as RawLot[] | null ?? []).map((l) => ({
        id: String(l[source.lotTable!.idField]),
        retailPrice: l.retail_price == null ? null : Number(l.retail_price),
        allocatedTo: l.allocated_to ?? null,
        stage: source.lotTable!.hasStage ? (l.stage ?? null) : null,
        intentLockedRegId: l.intent_locked_to_registration_id ?? null,
      }));
    }
  }

  // --- run the primitives ---
  const funnel = buildFunnel(regRows);
  const conversions = funnelConversions(funnel.stages);
  const coverage = buildCoverage(regRows, lotRows);
  const buyerMix = buildBuyerMix(regRows);
  const totalLots = isOk(coverage) ? coverage.value.totalLots : undefined;
  const trend = buildTrend(regRows, {
    coverThreshold: opts.coverThreshold ?? DEFAULT_COVER_THRESHOLD,
    totalLots,
    now,
  });

  return {
    estate: { slug: source.slug, name: source.name },
    generatedAt: now.toISOString(),
    coverStage: COVER_STAGE_LABEL,
    dataError,
    funnel,
    conversions,
    coverage,
    buyerMix,
    trend,
    gaps: collectGaps({ funnel, coverage, buyerMix, trend }),
    capabilities: FUNDER_REPORT_CAPABILITIES,
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────

/** lots_selected / units_selected come back as a TEXT[]; coerce defensively to string[]. */
function normaliseSelection(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  return [];
}

/** Flatten every structured gap across the sections into the "Data to instrument" appendix. */
function collectGaps(parts: {
  funnel: ReturnType<typeof buildFunnel>;
  coverage: ReturnType<typeof buildCoverage>;
  buyerMix: ReturnType<typeof buildBuyerMix>;
  trend: ReturnType<typeof buildTrend>;
}): GapEntry[] {
  const out: GapEntry[] = [];
  const push = (section: string, label: string, m: Metric<unknown>) => {
    if (m.status === "gap") out.push({ section, label, ...m.gap });
  };

  for (const s of parts.funnel.stages) push("Pipeline", s.label, s.metric);
  push("Coverage", "Demand vs supply by lot/tier", parts.coverage);
  push("Buyer mix", "Borrowing-capacity bands", parts.buyerMix.borrowingCapacityBands);
  push("Buyer mix", "Income bands", parts.buyerMix.incomeBands);
  push("Buyer mix", "First-home-buyer scheme eligibility", parts.buyerMix.fhbSchemeEligibility);
  push("Trend", "Projected date to cover trigger", parts.trend.projectedCover);

  // de-dup identical (label+reason) gaps (e.g. funnel "deposit" proxy vs coverage)
  const seen = new Set<string>();
  return out.filter((g) => {
    const k = `${g.label}::${g.reason}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Re-export for the page (avoids the page importing both modules).
export type { FunnelStage };
