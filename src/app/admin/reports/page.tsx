// Funder Demand-Coverage Report — proof surface for the reports engine.
// Auth: gated by the admin layout (getAdminUser + admin_users allowlist). Server component.
//
// This page hand-renders the funder report from the engine primitives + the gap registry. It is
// the engine-first proof harness for the reports feature: it shows the primitives (funnel,
// coverage, buyer-mix, trend) and the gap-surfacing working end-to-end. The Morgan voice / LLM
// orchestrator (compose any report from these primitives, read the gap manifest) goes on top next.
import Link from "next/link";
import {
  buildFunderDemandReport,
  reportableEstates,
  type GapEntry,
} from "@/lib/reports/funder-demand-report";
import { isOk, type FunnelStage, type Metric } from "@/lib/reports/funder-demand";

export const metadata = { title: "Funder Demand Report — F2K Projects Admin" };
export const dynamic = "force-dynamic"; // always live (read-only counts), never statically cached

const AUD0 = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const num = (n: number) => n.toLocaleString("en-AU");
const cover = (n: number) => `${n.toFixed(2)}×`;
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

function BasisBadge({ basis }: { basis: string }) {
  const map: Record<string, string> = {
    "self-declared": "bg-amber-100 text-amber-800",
    real: "bg-emerald-100 text-emerald-800",
    proxy: "bg-sky-100 text-sky-800",
    none: "bg-slate-200 text-slate-600",
    verified: "bg-emerald-100 text-emerald-800",
  };
  const label = basis === "none" ? "not captured" : basis;
  return (
    <span className={`ml-2 rounded px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${map[basis] ?? "bg-slate-200 text-slate-600"}`}>
      {label}
    </span>
  );
}

function StageValue({ stage }: { stage: FunnelStage }) {
  if (isOk(stage.metric)) {
    return (
      <span className="font-semibold tabular-nums text-slate-900">{num(stage.metric.value)}</span>
    );
  }
  return <span className="text-slate-400">— not captured</span>;
}

function metricGapNote<T>(m: Metric<T>): string | null {
  return m.status === "gap" ? m.gap.reason : null;
}

export default async function FunderReportPage({
  searchParams,
}: {
  searchParams: { estate?: string };
}) {
  const estates = reportableEstates();
  const slug = estates.find((e) => e.slug === searchParams.estate)?.slug ?? "seafields";
  const report = await buildFunderDemandReport(slug);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">Funder demand-coverage report</h2>
        <p className="mt-1 max-w-prose text-sm text-slate-600">
          Whether the demand behind an estate is real enough to lend against — the registration
          pipeline by stage, demand mapped against supply by lot and price tier, the (self-declared)
          buyer mix, and the registration trend. Where the data model can&rsquo;t answer a question
          yet, the report says so and tells you what to start collecting (the &ldquo;data to
          instrument&rdquo; list) rather than showing a misleading number.
        </p>
      </header>

      {/* Cover-stage disclaimer — the most important honesty in the report */}
      <div className="rounded border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <strong>What every &ldquo;cover&rdquo; figure counts:</strong> {report.coverStage}. The only
        instrumented pipeline stage is registered interest, so all cover multiples are expressions of
        interest per available lot — not finance-ready or contracted buyers.
      </div>

      {/* Estate selector */}
      <nav className="flex flex-wrap gap-2">
        {estates.map((e) => {
          const active = e.slug === slug;
          return (
            <Link
              key={e.slug}
              href={`/admin/reports?estate=${e.slug}`}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                active
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {e.name}
            </Link>
          );
        })}
      </nav>

      {report.dataError && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Couldn&rsquo;t load the data:</strong> {report.dataError}
        </div>
      )}

      {/* ── Pipeline funnel ── */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Pipeline by stage</h3>
        <p className="max-w-prose text-sm text-slate-600">
          Registered is real and timestamped. Finance pre-approval is self-declared on the form (not
          lender-verified). The remaining stages a lender underwrites against are not yet instrumented
          — each is a tracked gap below.
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3 text-right">Count</th>
                <th className="px-4 py-3">Basis</th>
              </tr>
            </thead>
            <tbody>
              {report.funnel.stages.map((s) => (
                <tr key={s.key} className="border-b border-slate-100 last:border-0 align-top">
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">{s.label}</span>
                    {metricGapNote(s.metric) && (
                      <p className="mt-0.5 text-xs text-slate-500">{metricGapNote(s.metric)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StageValue stage={s} />
                  </td>
                  <td className="px-4 py-3">
                    <BasisBadge basis={s.basis} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Coverage ── */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Demand vs supply (by lot &amp; price tier)</h3>
        {isOk(report.coverage) ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Overall cover" value={cover(report.coverage.value.overallCover)} />
              <Stat
                label={`Cover, ${report.coverage.value.cheapestLots.n} cheapest lots`}
                value={cover(report.coverage.value.cheapestLots.cover)}
              />
              <Stat
                label="Available lots"
                value={`${num(report.coverage.value.availableLots)} / ${num(report.coverage.value.totalLots)}`}
              />
              <Stat
                label="Intent-locked (proxy)"
                value={num(report.coverage.value.intentLockedLots)}
              />
            </div>
            <p className="max-w-prose text-xs text-slate-500">
              &ldquo;Intent-locked&rdquo; is an admin soft-hold on a lot — a commitment proxy, not a
              paid deposit. Cover = expressions of interest ÷ lots, at the registered-interest stage.
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Price tier</th>
                    <th className="px-4 py-3 text-right">Lots</th>
                    <th className="px-4 py-3 text-right">Available</th>
                    <th className="px-4 py-3 text-right">Interest</th>
                    <th className="px-4 py-3 text-right">Cover</th>
                  </tr>
                </thead>
                <tbody>
                  {report.coverage.value.byTier.map((t) => (
                    <tr key={t.tier} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-slate-900">{t.tier}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{num(t.lotCount)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{num(t.availableLotCount)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{num(t.demand)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {cover(t.cover)}
                        {t.thin && (
                          <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[0.65rem] font-medium uppercase text-red-700">
                            thin
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <GapCallout reason={report.coverage.gap.reason} toInstrument={report.coverage.gap.toInstrument} />
        )}
      </section>

      {/* ── Buyer mix ── */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">
          Buyer mix
          <BasisBadge basis="self-declared" />
        </h3>
        <p className="max-w-prose text-sm text-slate-600">
          Every figure here is self-declared on the registration form and is <strong>not</strong>{" "}
          lender-verified. De-duplicated by registrant.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Registrants" value={num(report.buyerMix.total)} />
          <Stat label="Owner-occupier" value={num(report.buyerMix.ownerOccupier)} />
          <Stat label="Investor" value={num(report.buyerMix.investor)} />
          <Stat label="First-home buyer" value={num(report.buyerMix.firstHomeBuyer)} />
          <Stat label="Finance-ready" value={num(report.buyerMix.financeReady)} />
          <Stat label="Pre-approved" value={num(report.buyerMix.financePreApproval)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <GapCallout label="Borrowing-capacity bands" reason={report.buyerMix.borrowingCapacityBands.status === "gap" ? report.buyerMix.borrowingCapacityBands.gap.reason : ""} toInstrument={report.buyerMix.borrowingCapacityBands.status === "gap" ? report.buyerMix.borrowingCapacityBands.gap.toInstrument : ""} />
          <GapCallout label="Income bands" reason={report.buyerMix.incomeBands.status === "gap" ? report.buyerMix.incomeBands.gap.reason : ""} toInstrument={report.buyerMix.incomeBands.status === "gap" ? report.buyerMix.incomeBands.gap.toInstrument : ""} />
          <GapCallout label="FHB scheme eligibility" reason={report.buyerMix.fhbSchemeEligibility.status === "gap" ? report.buyerMix.fhbSchemeEligibility.gap.reason : ""} toInstrument={report.buyerMix.fhbSchemeEligibility.status === "gap" ? report.buyerMix.fhbSchemeEligibility.gap.toInstrument : ""} />
        </div>
      </section>

      {/* ── Trend ── */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Trend &amp; momentum</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Total registrations" value={num(report.trend.total)} />
          <Stat label="Run-rate / week" value={report.trend.runRatePerWeek.toFixed(1)} />
          {isOk(report.trend.projectedCover) ? (
            <Stat
              label={`Projected date to ${report.trend.projectedCover.value.thresholdCover}× cover`}
              value={
                report.trend.projectedCover.value.projectedDate ??
                "stalled — run-rate 0"
              }
              warn={report.trend.projectedCover.value.projectedDate === null}
            />
          ) : (
            <Stat label="Projected date to cover" value="— needs threshold + supply" />
          )}
        </div>
        {report.trend.byWeek.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Week of</th>
                  <th className="px-4 py-3 text-right">Registrations</th>
                  <th className="px-4 py-3 text-right">Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {report.trend.byWeek.slice(-10).map((w) => (
                  <tr key={w.weekStart} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 text-slate-700">{w.weekStart}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{num(w.count)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{num(w.cumulative)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Data to instrument (gap appendix) ── */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Data to instrument</h3>
        <p className="max-w-prose text-sm text-slate-600">
          What this report can&rsquo;t answer yet, and what to start capturing to close each gap —
          the roadmap to making this estate fully lendable-against.
        </p>
        <div className="space-y-2">
          {report.gaps.map((g: GapEntry, i) => (
            <div key={i} className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
              <p className="font-medium text-amber-900">
                <span className="text-xs uppercase tracking-wide text-amber-600">{g.section}</span>{" "}
                · {g.label}
              </p>
              <p className="mt-1 text-amber-800">{g.reason}</p>
              <p className="mt-1 text-amber-700">
                <strong>To instrument:</strong> {g.toInstrument}
              </p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-slate-400">
        Generated {new Date(report.generatedAt).toLocaleString("en-AU")}. Read-only; figures are live
        from the database at load. Definitions: registration = one ROI submission (self-declared);
        de-duplicated registrant = distinct email; cover = interest ÷ available supply at the
        registered-interest stage.
      </p>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${warn ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${warn ? "text-red-700" : "text-slate-900"}`}>
        {value}
      </p>
    </div>
  );
}

function GapCallout({ label, reason, toInstrument }: { label?: string; reason: string; toInstrument: string }) {
  return (
    <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
      {label && <p className="font-medium text-amber-900">{label}</p>}
      <p className={label ? "mt-1 text-amber-800" : "text-amber-800"}>{reason}</p>
      <p className="mt-1 text-amber-700">
        <strong>To instrument:</strong> {toInstrument}
      </p>
    </div>
  );
}
