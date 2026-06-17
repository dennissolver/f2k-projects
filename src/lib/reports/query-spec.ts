// Generic report builder — the ReportQuerySpec (the structured contract) + the capability manifest.
//
// Reports is a GENERIC, ask-for-what-you-want interface: the admin (via Morgan, the discovery
// consultant) describes the report they need; the LLM resolves it into a VALIDATED ReportQuerySpec;
// a server executor runs VETTED read-only queries from that spec. The model composes a SPEC, never
// SQL — that is the security spine (no LLM SQL on PII; the 0027 rail). The funder demand-coverage
// report is just one preset of this engine, not a hardcoded page.
//
// This module is the single source of truth both the executor and the LLM consume:
//  - ReportQuerySpecSchema validates anything the LLM emits (or the form builds).
//  - REPORT_CAPABILITIES tells the LLM what datasets/group-bys/metrics/filters exist and what is a
//    gap, so it composes within the real data and declares gaps at request time.

import { z } from "zod";

export const DATASETS = ["registrations", "lots", "emails"] as const;
export const GROUP_BYS = [
  "none",
  "estate",
  "priceTier",
  "buyerType",
  "financeStatus",
  "agent",
  "week",
  "lot",
] as const;
export const METRICS = ["count", "dedupCount", "coverage", "trend"] as const;
export const VIEWS = ["table", "coverage", "trend"] as const;
export const FORMATS = ["screen", "csv"] as const;

export type Dataset = (typeof DATASETS)[number];
export type GroupBy = (typeof GROUP_BYS)[number];
export type ReportMetric = (typeof METRICS)[number];
export type ReportView = (typeof VIEWS)[number];

export const ReportQuerySpecSchema = z.object({
  dataset: z.enum(DATASETS),
  /** estate slug, or "all" for cross-estate. */
  estate: z.string().min(1).default("all"),
  /** ISO dates (YYYY-MM-DD) or null for open-ended. */
  dateFrom: z.string().nullable().default(null),
  dateTo: z.string().nullable().default(null),
  filters: z
    .object({
      agent: z.string().nullable().default(null),
      buyerType: z.string().nullable().default(null),
      financeStatus: z.string().nullable().default(null),
    })
    .default({ agent: null, buyerType: null, financeStatus: null }),
  groupBy: z.enum(GROUP_BYS).default("none"),
  metrics: z.array(z.enum(METRICS)).min(1).default(["count"]),
  view: z.enum(VIEWS).default("table"),
  format: z.enum(FORMATS).default("screen"),
});

export type ReportQuerySpec = z.infer<typeof ReportQuerySpecSchema>;

/** A human + machine description of what the engine can compose, for the LLM's discovery + the UI. */
export interface CapabilityManifest {
  datasets: {
    key: Dataset;
    label: string;
    basis: "real" | "partial" | "gap";
    note: string;
    groupBys: GroupBy[];
    metrics: ReportMetric[];
  }[];
  filters: { key: string; label: string; note: string }[];
  knownGaps: { topic: string; reason: string; toInstrument: string }[];
}

export const REPORT_CAPABILITIES: CapabilityManifest = {
  datasets: [
    {
      key: "registrations",
      label: "Registrations (expressions of interest)",
      basis: "real",
      note: "ROI submissions per estate; self-declared identity/buyer-type/finance-status.",
      groupBys: ["none", "estate", "buyerType", "financeStatus", "agent", "week", "priceTier"],
      metrics: ["count", "dedupCount", "trend"],
    },
    {
      key: "lots",
      label: "Lots / units (supply)",
      basis: "partial",
      note: "Priced lot/unit tables exist only for Seafields + Branscombe; other estates have none (a gap).",
      groupBys: ["none", "estate", "priceTier"],
      metrics: ["count", "coverage"],
    },
    {
      key: "emails",
      label: "Email log (sends)",
      basis: "partial",
      note: "Reconstructed from audit_log email-send events; the agent-notification send (AP1) flows in once live.",
      groupBys: ["none", "estate", "week"],
      metrics: ["count"],
    },
  ],
  filters: [
    { key: "estate", label: "Estate", note: "One estate slug or all estates." },
    { key: "dateRange", label: "Date range", note: "created_at window (ISO dates)." },
    { key: "agent", label: "Referring agent", note: "Registrations attributed to an agent." },
    { key: "buyerType", label: "Buyer type", note: "Self-declared (First Home Buyer, Investor…)." },
    { key: "financeStatus", label: "Finance status", note: "Self-declared (Pre-approved, Cash…)." },
  ],
  knownGaps: [
    {
      topic: "pipeline stages beyond registered",
      reason: "verified / pre-qualified / deposit / signed / settled are not instrumented.",
      toInstrument: "add the stage fields to the registration record.",
    },
    {
      topic: "borrowing capacity / income bands",
      reason: "not captured on the ROI form.",
      toInstrument: "capture income / borrowing capacity per registrant.",
    },
    {
      topic: "coverage for estates without a priced lot table",
      reason: "Wavecrest/Dutton have no lot-selection + no priced lots.",
      toInstrument: "add a priced lot/unit table for the estate.",
    },
  ],
};

/** The compact, token-cheap manifest string the LLM consultant reads to compose + declare gaps. */
export function capabilityManifestForLLM(): string {
  const lines: string[] = ["DATASETS:"];
  for (const d of REPORT_CAPABILITIES.datasets) {
    lines.push(
      `- ${d.key} [${d.basis}]: ${d.note} group-by: ${d.groupBys.join("/")}; metrics: ${d.metrics.join("/")}.`,
    );
  }
  lines.push("FILTERS: " + REPORT_CAPABILITIES.filters.map((f) => f.key).join(", ") + ".");
  lines.push("KNOWN GAPS (say so, don't fake): ");
  for (const g of REPORT_CAPABILITIES.knownGaps) lines.push(`- ${g.topic}: ${g.reason}`);
  return lines.join("\n");
}
