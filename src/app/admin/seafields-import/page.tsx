"use client";

import { useState } from "react";

interface LotChange {
  lot_number: number;
  changes: Record<string, unknown>;
}
interface ImportSummary {
  dryRun: boolean;
  reason: string | null;
  stages: {
    upserted: Array<{ stage_number: number; changes: Record<string, unknown> }>;
    no_op: number;
  };
  dwelling_types: {
    upserted: Array<{ code: string; changes: Record<string, unknown> }>;
    inserted: Array<{ code: string }>;
    no_op: number;
  };
  lots: {
    total_in_workbook: number;
    matched: number;
    updated: LotChange[];
    no_op: number;
    orphans: Array<{ lot_number: number; reason: string }>;
  };
  gap_lots: number[];
  warnings: string[];
  errors: string[];
}

function fmt(v: unknown): string {
  if (v === null) return "—";
  if (typeof v === "boolean") return v ? "✓" : "✗";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function SeafieldsImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [running, setRunning] = useState<"dry" | "apply" | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(dryRun: boolean) {
    if (!file) {
      setError("Pick a workbook file first.");
      return;
    }
    if (!dryRun && reason.trim().length < 10) {
      setError("Reason must be ≥10 characters when applying.");
      return;
    }
    setRunning(dryRun ? "dry" : "apply");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("dryRun", String(dryRun));
      if (!dryRun) fd.append("reason", reason.trim());

      const res = await fetch("/api/admin/seafields/import-workbook", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setSummary(data as ImportSummary);
    } catch (err) {
      setError(`Request failed: ${(err as Error).message}`);
    } finally {
      setRunning(null);
    }
  }

  const canApply =
    !!summary && summary.dryRun && summary.errors.length === 0 && reason.trim().length >= 10;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">
        Seafields — Workbook Import
      </h2>
      <p className="text-sm text-slate-500 mb-6 max-w-3xl">
        Re-runnable selective merge. DA plan (lot numbers, areas, zoning code)
        is never touched. Workbook owns stage rate, allocation bucket, status,
        dwelling type FK, pricing overrides, display flags, internal notes.
        Run a dry-run first to review the diff, then apply with a reason.
      </p>

      <div className="bg-white border rounded p-5 mb-5">
        <label className="block text-sm font-semibold text-slate-800 mb-2">
          Workbook file (.xlsx)
        </label>
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setSummary(null);
            setError(null);
          }}
          className="block text-sm"
        />
        {file && (
          <p className="mt-2 text-xs text-slate-500">
            {file.name} · {Math.round(file.size / 1024)} KB
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => run(true)}
            disabled={!file || running !== null}
            className="bg-slate-900 hover:bg-slate-700 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50"
          >
            {running === "dry" ? "Running dry-run…" : "Run dry-run"}
          </button>

          <div className="flex-1 min-w-[280px]">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Reason for change (required to apply, ≥10 chars)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. merging Uwe-signed V1 workbook on 2026-05-16"
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={() => run(false)}
            disabled={!canApply || running !== null}
            className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50 self-end"
            title={
              !summary
                ? "Run a dry-run first"
                : !summary.dryRun
                ? "Refresh with a dry-run before re-applying"
                : summary.errors.length > 0
                ? "Resolve errors in dry-run before applying"
                : reason.trim().length < 10
                ? "Reason required"
                : ""
            }
          >
            {running === "apply" ? "Applying…" : "Apply changes"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {summary && (
        <div className="space-y-5">
          <div
            className={`p-3 rounded text-sm border ${
              summary.dryRun
                ? "bg-blue-50 text-blue-800 border-blue-200"
                : "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}
          >
            <strong>{summary.dryRun ? "DRY RUN" : "APPLIED"}</strong>
            {" — "}
            {summary.stages.upserted.length} stages,{" "}
            {summary.dwelling_types.upserted.length +
              summary.dwelling_types.inserted.length}{" "}
            dwelling types, {summary.lots.updated.length} lots{" "}
            {summary.dryRun ? "would change" : "changed"}.
          </div>

          <Section
            title="Stages"
            subtitle={`${summary.stages.upserted.length} changed · ${summary.stages.no_op} unchanged`}
          >
            {summary.stages.upserted.length === 0 ? (
              <Empty />
            ) : (
              <ChangeTable
                head={["Stage", "Field", "New value"]}
                rows={summary.stages.upserted.flatMap((s) =>
                  Object.entries(s.changes).map(([k, v]) => [
                    `Stage ${s.stage_number}`,
                    k,
                    fmt(v),
                  ]),
                )}
              />
            )}
          </Section>

          <Section
            title="Dwelling types"
            subtitle={`${summary.dwelling_types.inserted.length} inserted · ${summary.dwelling_types.upserted.length} updated · ${summary.dwelling_types.no_op} unchanged`}
          >
            {summary.dwelling_types.inserted.length === 0 &&
            summary.dwelling_types.upserted.length === 0 ? (
              <Empty />
            ) : (
              <ChangeTable
                head={["Code", "Action", "Field", "New value"]}
                rows={[
                  ...summary.dwelling_types.inserted.map((d) => [
                    d.code,
                    "INSERT",
                    "—",
                    "(new row)",
                  ]),
                  ...summary.dwelling_types.upserted.flatMap((d) =>
                    Object.entries(d.changes).map(([k, v]) => [
                      d.code,
                      "UPDATE",
                      k,
                      fmt(v),
                    ]),
                  ),
                ]}
              />
            )}
          </Section>

          <Section
            title="Lots"
            subtitle={`${summary.lots.total_in_workbook} in workbook · ${summary.lots.matched} matched · ${summary.lots.updated.length} would change · ${summary.lots.no_op} unchanged · ${summary.lots.orphans.length} orphans · ${summary.gap_lots.length} DB-only`}
          >
            {summary.lots.updated.length === 0 ? (
              <Empty />
            ) : (
              <ChangeTable
                head={["Lot #", "Field", "New value"]}
                rows={summary.lots.updated.flatMap((l) =>
                  Object.entries(l.changes).map(([k, v]) => [
                    String(l.lot_number),
                    k,
                    fmt(v),
                  ]),
                )}
              />
            )}
          </Section>

          {summary.lots.orphans.length > 0 && (
            <Section
              title="Orphans"
              subtitle="In workbook but not in DB — skipped (DA plan governs membership)"
            >
              <ChangeTable
                head={["Lot #", "Reason"]}
                rows={summary.lots.orphans.map((o) => [
                  String(o.lot_number),
                  o.reason,
                ])}
              />
            </Section>
          )}

          {summary.gap_lots.length > 0 && (
            <Section
              title="DB-only lots"
              subtitle={`Lots in DB not covered by this workbook — left untouched. (${summary.gap_lots.length} total)`}
            >
              <p className="text-xs font-mono break-all p-3 bg-slate-50 rounded text-slate-600">
                {summary.gap_lots.join(", ")}
              </p>
            </Section>
          )}

          {summary.warnings.length > 0 && (
            <Section title="Warnings" subtitle={`${summary.warnings.length}`}>
              <ul className="text-xs space-y-1 text-amber-800 p-3 bg-amber-50 rounded">
                {summary.warnings.map((w, i) => (
                  <li key={i}>· {w}</li>
                ))}
              </ul>
            </Section>
          )}

          {summary.errors.length > 0 && (
            <Section title="Errors" subtitle={`${summary.errors.length}`}>
              <ul className="text-xs space-y-1 text-red-800 p-3 bg-red-50 rounded">
                {summary.errors.map((e, i) => (
                  <li key={i}>· {e}</li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border rounded overflow-hidden">
      <header className="px-4 py-2 bg-slate-50 border-b flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <span className="text-xs text-slate-500">{subtitle}</span>}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

function Empty() {
  return <p className="text-sm text-slate-500 italic">No changes.</p>;
}

function ChangeTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-auto max-h-96 border rounded">
      <table className="w-full text-xs">
        <thead className="bg-slate-100 sticky top-0">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-2 py-1 text-left font-semibold text-slate-700">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t hover:bg-slate-50">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
