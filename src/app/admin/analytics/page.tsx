// Cross-estate analytics dashboard (FTK analytics Phase 1).
// Auth: gated by the admin layout (getAdminUser + admin_users allowlist). Server component —
// reads the lib/analytics adapter (Umami traffic + submission counts, cached ~10 min).
import Link from "next/link";
import type { AnalyticsWindow } from "@/lib/analytics/umami";
import { getComparison, type EstateAnalytics } from "@/lib/analytics/adapter";

export const metadata = { title: "Analytics — F2K Projects Admin" };

const WINDOWS: { key: AnalyticsWindow; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "month", label: "This month" },
  { key: "30d", label: "Last 30 days" },
  { key: "all", label: "All time" },
];

function pct(fraction: number | null): string {
  if (fraction === null) return "—";
  return `${(fraction * 100).toFixed(1)}%`;
}

function num(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
}

function topSource(row: EstateAnalytics): string {
  if (!row.sources) return "—";
  const entries = Object.entries(row.sources).filter(([, v]) => v > 0);
  if (entries.length === 0) return "—";
  const [label, count] = entries.sort((a, b) => b[1] - a[1])[0];
  const total = entries.reduce((s, [, v]) => s + v, 0);
  return `${label} ${Math.round((count / total) * 100)}%`;
}

function topDevice(row: EstateAnalytics): string {
  if (!row.devices || row.devices.length === 0) return "—";
  const top = [...row.devices].sort((a, b) => b.count - a.count)[0];
  return top.label;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { window?: string };
}) {
  const window: AnalyticsWindow =
    (WINDOWS.find((w) => w.key === searchParams.window)?.key as AnalyticsWindow) ?? "30d";
  const { configured, rows } = await getComparison(window);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">Estate analytics</h2>
        <p className="mt-1 max-w-prose text-sm text-slate-600">
          Traffic and enquiry conversion per estate, side by side, so you can compare how each
          estate is performing and whether the messaging is landing. Conversion is enquiries ÷
          unique visitors (with sessions shown as the secondary figure). Numbers are up to 10
          minutes behind. Estates with no enquiry form show conversion as N/A.
        </p>
      </header>

      {!configured && (
        <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Traffic tracking not yet configured.</strong> Set{" "}
          <code>NEXT_PUBLIC_UMAMI_WEBSITE_ID</code> + <code>UMAMI_API_KEY</code> in Vercel to
          populate the traffic columns. Enquiry counts below are live from the database regardless.
        </div>
      )}

      <nav className="flex flex-wrap gap-2">
        {WINDOWS.map((w) => {
          const active = w.key === window;
          return (
            <Link
              key={w.key}
              href={`/admin/analytics?window=${w.key}`}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                active
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {w.label}
            </Link>
          );
        })}
      </nav>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Estate</th>
              <th className="px-4 py-3 text-right">Visitors</th>
              <th className="px-4 py-3 text-right">Sessions</th>
              <th className="px-4 py-3 text-right">Pageviews</th>
              <th className="px-4 py-3 text-right">Enquiries</th>
              <th className="px-4 py-3 text-right">Conversion</th>
              <th className="px-4 py-3">Top source</th>
              <th className="px-4 py-3">Top device</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                    style={{ backgroundColor: row.accent }}
                    aria-hidden
                  />
                  {row.name}
                </td>
                {row.available ? (
                  <>
                    <td className="px-4 py-3 text-right tabular-nums">{num(row.traffic?.uniques)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{num(row.traffic?.sessions)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{num(row.traffic?.pageviews)}</td>
                  </>
                ) : (
                  <td className="px-4 py-3 text-center text-slate-400" colSpan={3}>
                    traffic unavailable
                  </td>
                )}
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.hasFunnel ? num(row.submissions) : "N/A"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.hasFunnel ? (
                    <span>
                      <span className="font-semibold text-slate-900">
                        {pct(row.conversionUniques)}
                      </span>
                      <span className="ml-1 text-xs text-slate-400">
                        / {pct(row.conversionSessions)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-400">N/A</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{topSource(row)}</td>
                <td className="px-4 py-3 text-slate-600">{topDevice(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Conversion = enquiries ÷ unique visitors (headline) / ÷ sessions (secondary). Visitor
        counts are cookieless estimates. The gap between the two conversion figures reflects how
        often buyers revisit before enquiring.
      </p>
    </div>
  );
}
