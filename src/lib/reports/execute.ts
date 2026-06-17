// Generic report executor — runs a VALIDATED ReportQuerySpec via vetted read-only queries.
//
// No LLM SQL: the spec is a Zod-validated structured object (query-spec.ts); this module maps it to
// fixed, parameterised Supabase reads + in-memory aggregation using the shared primitives
// (funder-demand.ts). The funder demand-coverage report is one preset spec this engine reproduces.

import { createSupabaseService } from "@/lib/supabase-service";
import {
  dedupeByPerson,
  buildCoverage,
  buildTrend,
  isOk,
  type RegRow,
  type LotRow,
  type CoverageResult,
  type TrendResult,
} from "./funder-demand";
import { REPORT_CAPABILITIES, type ReportQuerySpec, type GroupBy } from "./query-spec";

// ── estate source map (which tables back each estate) ────────────────────────────────────────────

interface EstateSource {
  slug: string;
  name: string;
  registrationsTable: string;
  selectionField: string | null;
  lotTable?: { table: string; idField: string; hasStage: boolean };
}

const SOURCES: EstateSource[] = [
  {
    slug: "seafields",
    name: "Seafields",
    registrationsTable: "seafields_registrations",
    selectionField: "lots_selected",
    lotTable: { table: "seafields_lot_allocations", idField: "lot_number", hasStage: true },
  },
  {
    slug: "branscombe",
    name: "Branscombe",
    registrationsTable: "branscombe_registrations",
    selectionField: "units_selected",
    lotTable: { table: "branscombe_unit_allocations", idField: "unit_number", hasStage: false },
  },
  {
    slug: "wavecrest",
    name: "Wavecrest",
    registrationsTable: "wavecrest_registrations",
    selectionField: null,
  },
  {
    slug: "dutton-terrace",
    name: "Dutton Terrace",
    registrationsTable: "dutton_registrations",
    selectionField: null,
  },
];

export function reportEstates(): { slug: string; name: string }[] {
  return SOURCES.map((s) => ({ slug: s.slug, name: s.name }));
}

function sourcesFor(estate: string): EstateSource[] {
  return estate === "all" ? SOURCES : SOURCES.filter((s) => s.slug === estate);
}

// ── result shape ─────────────────────────────────────────────────────────────────────────────────

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right";
}
export interface GapEntry {
  topic: string;
  reason: string;
  toInstrument: string;
}
export interface ReportResult {
  spec: ReportQuerySpec;
  title: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  notes: string[];
  gaps: GapEntry[];
  coverage?: { estate: string; result: CoverageResult }[];
  trend?: TrendResult;
}

// ── fetch helpers ────────────────────────────────────────────────────────────────────────────────

interface RawReg {
  email: string | null;
  buyer_type: string | null;
  finance_status: string | null;
  created_at: string;
  referrer_name: string | null;
  [k: string]: unknown;
}

async function fetchRegs(
  src: EstateSource,
  spec: ReportQuerySpec,
): Promise<{ rows: (RegRow & { estate: string; agent: string | null })[]; error: string | null }> {
  const supabase = createSupabaseService();
  const cols = ["email", "buyer_type", "finance_status", "created_at", "referrer_name"];
  if (src.selectionField) cols.push(src.selectionField);

  let q = supabase.from(src.registrationsTable).select(cols.join(","));
  if (spec.dateFrom) q = q.gte("created_at", spec.dateFrom);
  if (spec.dateTo) q = q.lte("created_at", `${spec.dateTo}T23:59:59.999Z`);
  if (spec.filters.buyerType) q = q.eq("buyer_type", spec.filters.buyerType);
  if (spec.filters.financeStatus) q = q.eq("finance_status", spec.filters.financeStatus);
  if (spec.filters.agent) q = q.ilike("referrer_name", `%${spec.filters.agent}%`);

  const { data, error } = await q;
  if (error) return { rows: [], error: `${src.registrationsTable}: ${error.message}` };

  const rows = ((data as unknown as RawReg[] | null) ?? []).map((r) => ({
    email: r.email,
    selection: src.selectionField && Array.isArray(r[src.selectionField])
      ? (r[src.selectionField] as unknown[]).map(String)
      : [],
    buyerType: r.buyer_type,
    financeStatus: r.finance_status,
    createdAt: r.created_at,
    estate: src.name,
    agent: r.referrer_name,
  }));
  return { rows, error: null };
}

interface RawLot {
  retail_price: number | null;
  allocated_to: string | null;
  intent_locked_to_registration_id: string | null;
  [k: string]: unknown;
}

async function fetchLots(src: EstateSource): Promise<LotRow[]> {
  if (!src.lotTable) return [];
  const supabase = createSupabaseService();
  const { data, error } = await supabase
    .from(src.lotTable.table)
    .select(`${src.lotTable.idField},retail_price,allocated_to,intent_locked_to_registration_id`);
  if (error) return [];
  return ((data as unknown as RawLot[] | null) ?? []).map((l) => ({
    id: String(l[src.lotTable!.idField]),
    retailPrice: l.retail_price == null ? null : Number(l.retail_price),
    allocatedTo: l.allocated_to ?? null,
    stage: null,
    intentLockedRegId: l.intent_locked_to_registration_id ?? null,
  }));
}

// ── grouping ─────────────────────────────────────────────────────────────────────────────────────

import { weekStartUTC } from "./funder-demand";

function groupKey(
  row: RegRow & { estate: string; agent: string | null },
  groupBy: GroupBy,
): string {
  switch (groupBy) {
    case "estate":
      return row.estate;
    case "buyerType":
      return row.buyerType?.trim() || "Unspecified";
    case "financeStatus":
      return row.financeStatus?.trim() || "Unspecified";
    case "agent":
      return row.agent?.trim() || "No agent";
    case "week":
      return weekStartUTC(row.createdAt);
    default:
      return "All";
  }
}

const GAP = (g: { topic: string; reason: string; toInstrument: string }) => g;

// ── the executor ─────────────────────────────────────────────────────────────────────────────────

export async function executeReport(spec: ReportQuerySpec): Promise<ReportResult> {
  const notes: string[] = [];
  const gaps: GapEntry[] = [];

  if (spec.dataset === "emails") {
    // Email-log dataset — reconstructed from audit_log email-send events (best effort).
    return executeEmails(spec, notes, gaps);
  }

  if (spec.dataset === "lots") {
    return executeLots(spec, notes, gaps);
  }

  // dataset === "registrations"
  const srcs = sourcesFor(spec.estate);
  const all: (RegRow & { estate: string; agent: string | null })[] = [];
  for (const src of srcs) {
    const { rows, error } = await fetchRegs(src, spec);
    if (error) gaps.push(GAP({ topic: `read ${src.name}`, reason: error, toInstrument: "check table access." }));
    all.push(...rows);
  }

  // Coverage view/metric — cross registrations against lots, per estate (only where a lot table exists).
  if (spec.view === "coverage" || spec.metrics.includes("coverage")) {
    const coverage: { estate: string; result: CoverageResult }[] = [];
    for (const src of srcs) {
      const lots = src.lotTable ? await fetchLots(src) : [];
      const regs = all.filter((r) => r.estate === src.name);
      const cov = buildCoverage(regs, lots);
      if (isOk(cov)) coverage.push({ estate: src.name, result: cov.value });
      else gaps.push(GAP({ topic: `coverage · ${src.name}`, reason: cov.gap.reason, toInstrument: cov.gap.toInstrument }));
    }
    notes.push("Cover counts registered interest (expressions of interest), not finance-ready buyers.");
    return {
      spec,
      title: `Coverage — ${spec.estate === "all" ? "all estates" : spec.estate}`,
      columns: [],
      rows: [],
      notes,
      gaps,
      coverage,
    };
  }

  // Trend view — registrations per ISO week + run-rate.
  if (spec.view === "trend" || spec.metrics.includes("trend")) {
    const trend = buildTrend(all);
    return {
      spec,
      title: `Registration trend — ${spec.estate === "all" ? "all estates" : spec.estate}`,
      columns: [
        { key: "weekStart", label: "Week of", align: "left" },
        { key: "count", label: "Registrations", align: "right" },
        { key: "cumulative", label: "Cumulative", align: "right" },
      ],
      rows: trend.byWeek.map((w) => ({ weekStart: w.weekStart, count: w.count, cumulative: w.cumulative })),
      notes: [`Run-rate ≈ ${trend.runRatePerWeek.toFixed(1)} / week.`],
      gaps,
      trend,
    };
  }

  // Table view — group + count / dedupCount.
  const groups = new Map<string, (RegRow & { estate: string; agent: string | null })[]>();
  for (const r of all) {
    const k = groupKey(r, spec.groupBy);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  const wantDedup = spec.metrics.includes("dedupCount");
  const columns: ReportColumn[] = [
    { key: "group", label: groupLabel(spec.groupBy), align: "left" },
    { key: "count", label: "Registrations", align: "right" },
  ];
  if (wantDedup) columns.push({ key: "deduped", label: "Distinct people", align: "right" });

  const rows = Array.from(groups.entries())
    .map(([group, rs]) => {
      const row: Record<string, string | number> = { group, count: rs.length };
      if (wantDedup) row.deduped = dedupeByPerson(rs).length;
      return row;
    })
    .sort((a, b) => (b.count as number) - (a.count as number));

  notes.push("Registrations are self-declared expressions of interest.");
  return {
    spec,
    title: `Registrations — ${spec.estate === "all" ? "all estates" : spec.estate}`,
    columns,
    rows,
    notes,
    gaps,
  };
}

function groupLabel(g: GroupBy): string {
  return (
    {
      none: "All",
      estate: "Estate",
      priceTier: "Price tier",
      buyerType: "Buyer type",
      financeStatus: "Finance status",
      agent: "Referring agent",
      week: "Week of",
      lot: "Lot",
    } as Record<GroupBy, string>
  )[g];
}

async function executeLots(
  spec: ReportQuerySpec,
  notes: string[],
  gaps: GapEntry[],
): Promise<ReportResult> {
  const srcs = sourcesFor(spec.estate);
  const columns: ReportColumn[] = [
    { key: "group", label: spec.groupBy === "priceTier" ? "Price tier" : "Estate", align: "left" },
    { key: "lots", label: "Lots", align: "right" },
    { key: "available", label: "Available", align: "right" },
  ];
  const rows: Record<string, string | number>[] = [];
  const coverage: { estate: string; result: CoverageResult }[] = [];

  for (const src of srcs) {
    if (!src.lotTable) {
      gaps.push(
        GAP({
          topic: `lots · ${src.name}`,
          reason: "no priced lot/unit table for this estate.",
          toInstrument: "add a priced lot/unit table.",
        }),
      );
      continue;
    }
    const lots = await fetchLots(src);
    if (spec.metrics.includes("coverage") || spec.view === "coverage") {
      const cov = buildCoverage([], lots); // supply-only cover frame (no demand here)
      if (isOk(cov)) coverage.push({ estate: src.name, result: cov.value });
    }
    rows.push({
      group: src.name,
      lots: lots.length,
      available: lots.filter((l) => !l.allocatedTo || l.allocatedTo.trim() === "").length,
    });
  }
  notes.push("Lot supply by estate. Coverage (demand vs supply) needs the registrations dataset.");
  return {
    spec,
    title: `Lots — ${spec.estate === "all" ? "all estates" : spec.estate}`,
    columns,
    rows,
    notes,
    gaps,
    coverage: coverage.length ? coverage : undefined,
  };
}

interface RawAudit {
  created_at: string;
  details: unknown;
  entity_type: string | null;
}

async function executeEmails(
  spec: ReportQuerySpec,
  notes: string[],
  gaps: GapEntry[],
): Promise<ReportResult> {
  const supabase = createSupabaseService();
  let q = supabase
    .from("audit_log")
    .select("created_at,details,entity_type")
    .ilike("action", "%email%");
  if (spec.dateFrom) q = q.gte("created_at", spec.dateFrom);
  if (spec.dateTo) q = q.lte("created_at", `${spec.dateTo}T23:59:59.999Z`);

  const { data, error } = await q;
  if (error) {
    gaps.push(
      GAP({
        topic: "email log",
        reason: `audit_log not readable: ${error.message}`,
        toInstrument: "confirm email sends are logged to audit_log (or a dedicated email-events table).",
      }),
    );
    return { spec, title: "Email log", columns: [], rows: [], notes, gaps };
  }

  const events = (data as unknown as RawAudit[] | null) ?? [];
  const byWeek = new Map<string, number>();
  for (const e of events) byWeek.set(weekStartUTC(e.created_at), (byWeek.get(weekStartUTC(e.created_at)) ?? 0) + 1);

  notes.push("Email sends reconstructed from audit_log email-action events; the agent-notification send (AP1) flows in once live.");
  if (events.length === 0) {
    gaps.push(
      GAP({
        topic: "email log",
        reason: "no email-action events found in audit_log for this window.",
        toInstrument: "ensure send paths log an email event (sendTemplated already does for some flows).",
      }),
    );
  }
  return {
    spec,
    title: "Email log (sends per week)",
    columns: [
      { key: "group", label: "Week of", align: "left" },
      { key: "count", label: "Sends", align: "right" },
    ],
    rows: Array.from(byWeek.entries())
      .map(([group, count]) => ({ group, count }))
      .sort((a, b) => (a.group < b.group ? -1 : 1)),
    notes,
    gaps,
  };
}

/** The manifest of known gaps the LLM/UI surfaces even before a query runs. */
export const STANDING_GAPS = REPORT_CAPABILITIES.knownGaps;
