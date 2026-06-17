"use client";

// Reports — the GENERIC, ask-for-what-you-want builder. Morgan (the discovery consultant) is the
// primary door: describe the report → she resolves it to a validated ReportQuerySpec and fills the
// building-block form → run. The form is the same spec, editable by hand (the fast path). No
// hardcoded reports; the funder demand-coverage report is just one spec this engine produces.
// Auth: gated by the admin layout (getAdminUser + admin_users). The run/voice APIs re-check admin.

import { useCallback, useState } from "react";
import ReportsVoiceAgent, { type VoiceMessage } from "@/components/admin/ReportsVoiceAgent";
import type { ReportQuerySpec, Dataset, GroupBy, ReportView } from "@/lib/reports/query-spec";
import type { ReportResult } from "@/lib/reports/execute";

const ESTATES = [
  { slug: "all", name: "All estates" },
  { slug: "seafields", name: "Seafields" },
  { slug: "branscombe", name: "Branscombe" },
  { slug: "wavecrest", name: "Wavecrest" },
  { slug: "dutton-terrace", name: "Dutton Terrace" },
];
const DATASET_OPTS: { v: Dataset; label: string }[] = [
  { v: "registrations", label: "Registrations" },
  { v: "lots", label: "Lots / units" },
  { v: "emails", label: "Email log" },
];
const GROUPBY_OPTS: { v: GroupBy; label: string }[] = [
  { v: "none", label: "No breakdown" },
  { v: "estate", label: "By estate" },
  { v: "buyerType", label: "By buyer type" },
  { v: "financeStatus", label: "By finance status" },
  { v: "agent", label: "By referring agent" },
  { v: "week", label: "By week" },
  { v: "priceTier", label: "By price tier" },
];
const VIEW_OPTS: { v: ReportView; label: string }[] = [
  { v: "table", label: "Table" },
  { v: "coverage", label: "Coverage (demand vs supply)" },
  { v: "trend", label: "Trend (week by week)" },
];

function specFrom(form: FormState): ReportQuerySpec {
  const metrics =
    form.view === "coverage" ? ["coverage"] : form.view === "trend" ? ["trend"] : form.dedup ? ["count", "dedupCount"] : ["count"];
  return {
    dataset: form.dataset,
    estate: form.estate,
    dateFrom: form.dateFrom || null,
    dateTo: form.dateTo || null,
    filters: { agent: form.agent || null, buyerType: null, financeStatus: null },
    groupBy: form.groupBy,
    metrics: metrics as ReportQuerySpec["metrics"],
    view: form.view,
    format: "screen",
  };
}

interface FormState {
  dataset: Dataset;
  estate: string;
  dateFrom: string;
  dateTo: string;
  groupBy: GroupBy;
  view: ReportView;
  dedup: boolean;
  agent: string;
}

const initialForm: FormState = {
  dataset: "registrations",
  estate: "all",
  dateFrom: "",
  dateTo: "",
  groupBy: "none",
  view: "table",
  dedup: false,
  agent: "",
};

export default function ReportsPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [transcript, setTranscript] = useState<VoiceMessage[]>([]);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (spec: ReportQuerySpec) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reports/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The report could not be built.");
      setResult(data.result as ReportResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The report could not be built.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Morgan emits a confirmed spec → reflect it in the form and run it.
  const onSpec = useCallback(
    (spec: ReportQuerySpec) => {
      setForm((f) => ({
        ...f,
        dataset: spec.dataset,
        estate: spec.estate,
        dateFrom: spec.dateFrom ?? "",
        dateTo: spec.dateTo ?? "",
        groupBy: spec.groupBy,
        view: spec.view,
        dedup: spec.metrics.includes("dedupCount"),
        agent: spec.filters.agent ?? "",
      }));
      run(spec);
    },
    [run],
  );

  function downloadCsv() {
    if (!result || result.columns.length === 0) return;
    const head = result.columns.map((c) => c.label).join(",");
    const body = result.rows
      .map((r) => result.columns.map((c) => JSON.stringify(r[c.key] ?? "")).join(","))
      .join("\n");
    const blob = new Blob([`${head}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sel = "rounded border border-slate-300 px-3 py-2 text-sm bg-white";

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">Reports</h2>
        <p className="mt-1 max-w-prose text-sm text-slate-600">
          Ask for the report you need — by estate, date range, breakdown, and view — and it&rsquo;s
          built on demand. Talk to Morgan to describe it, or build it from the controls. Anything the
          data can&rsquo;t answer yet is shown as an explicit gap, never a misleading number.
        </p>
      </header>

      <ReportsVoiceAgent transcript={transcript} onTranscriptChange={setTranscript} onSpec={onSpec} />

      {/* Building-block form (the spec, editable by hand) */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Dataset
            <select className={sel} value={form.dataset} onChange={(e) => setForm({ ...form, dataset: e.target.value as Dataset })}>
              {DATASET_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Estate
            <select className={sel} value={form.estate} onChange={(e) => setForm({ ...form, estate: e.target.value })}>
              {ESTATES.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            View
            <select className={sel} value={form.view} onChange={(e) => setForm({ ...form, view: e.target.value as ReportView })}>
              {VIEW_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Break down
            <select className={sel} value={form.groupBy} onChange={(e) => setForm({ ...form, groupBy: e.target.value as GroupBy })}>
              {GROUPBY_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            From
            <input type="date" className={sel} value={form.dateFrom} onChange={(e) => setForm({ ...form, dateFrom: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            To
            <input type="date" className={sel} value={form.dateTo} onChange={(e) => setForm({ ...form, dateTo: e.target.value })} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.dedup} onChange={(e) => setForm({ ...form, dedup: e.target.checked })} />
            Count distinct people
          </label>
          <button
            type="button"
            onClick={() => run(specFrom(form))}
            disabled={loading}
            className="ml-auto rounded bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? "Running…" : "Run report"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {result && <ResultView result={result} onCsv={downloadCsv} />}
    </div>
  );
}

function ResultView({ result, onCsv }: { result: ReportResult; onCsv: () => void }) {
  const fmt = (v: string | number) => (typeof v === "number" ? v.toLocaleString("en-AU") : v);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">{result.title}</h3>
        {result.columns.length > 0 && (
          <button type="button" onClick={onCsv} className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
            Download CSV
          </button>
        )}
      </div>

      {result.notes.map((n, i) => (
        <p key={i} className="max-w-prose text-xs text-slate-500">{n}</p>
      ))}

      {/* Coverage view */}
      {result.coverage?.map((c) => (
        <div key={c.estate} className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <div className="px-4 py-2 text-sm font-medium text-slate-900">
            {c.estate} — overall cover {c.result.overallCover.toFixed(2)}× · {c.result.availableLots}/{c.result.totalLots} available
          </div>
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-y border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2">Price tier</th>
                <th className="px-4 py-2 text-right">Lots</th>
                <th className="px-4 py-2 text-right">Interest</th>
                <th className="px-4 py-2 text-right">Cover</th>
              </tr>
            </thead>
            <tbody>
              {c.result.byTier.map((t) => (
                <tr key={t.tier} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-slate-900">{t.tier}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{t.lotCount}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{t.demand}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {t.cover.toFixed(2)}×{t.thin && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[0.65rem] uppercase text-red-700">thin</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Table / trend view */}
      {result.columns.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                {result.columns.map((c) => (
                  <th key={c.key} className={`px-4 py-3 ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.length === 0 ? (
                <tr><td colSpan={result.columns.length} className="px-4 py-6 text-center text-slate-400">No rows for this request.</td></tr>
              ) : (
                result.rows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    {result.columns.map((c) => (
                      <td key={c.key} className={`px-4 py-3 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>{fmt(row[c.key])}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Gaps */}
      {result.gaps.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">What this can&rsquo;t answer yet</p>
          {result.gaps.map((g, i) => (
            <div key={i} className="rounded border border-amber-200 bg-amber-50 px-4 py-2 text-sm">
              <span className="font-medium text-amber-900">{g.topic}</span>
              <span className="text-amber-800"> — {g.reason}</span>
              <span className="text-amber-700"> To instrument: {g.toInstrument}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
