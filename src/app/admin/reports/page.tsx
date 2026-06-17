// Reports — placeholder while the GENERIC report builder is rebuilt.
//
// The prior version hardcoded a single Funder Demand-Coverage report, which is the wrong shape:
// Reports is meant to be a GENERIC, ask-for-what-you-want interface — the admin describes the
// report they need and a discovery consultant (Morgan) resolves it to a structured query the
// engine composes from read-only building blocks. The funder report is just ONE output of that,
// not the page. This placeholder is live while that generic interface is built.
//
// The composable engine primitives + gap/capability manifest (src/lib/reports/funder-demand.ts)
// survive as the building blocks the generic interface will compose over.
// Auth: gated by the admin layout (getAdminUser + admin_users allowlist).

export const metadata = { title: "Reports — F2K Projects Admin" };

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">Reports</h2>
        <p className="mt-1 max-w-prose text-sm text-slate-600">
          A generic report builder: describe the report you need and it gets composed on demand —
          no pre-built, fixed reports. This page is being rebuilt around that interface (a
          discovery-led request flow over read-only registration and lot data). It is not available
          yet.
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-700">
          The report builder is under construction. You&rsquo;ll be able to ask for the exact cut
          you need (by estate, date range, agent, buyer segment, and so on) and get it on screen and
          as a download — with anything the data can&rsquo;t yet answer surfaced as an explicit gap
          rather than a misleading number.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          In the meantime, the per-estate admin pages still hold the underlying registration and lot
          data.
        </p>
      </div>
    </div>
  );
}
