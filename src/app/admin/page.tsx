import { createSupabaseService } from "@/lib/supabase-service";

async function getCounts() {
  const supabase = createSupabaseService();

  const [seafields, branscombe, hemp, audit] = await Promise.all([
    (supabase.from("seafields_registrations") as any)
      .select("id, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(1)
      .then((r: any) => ({ count: r.count ?? 0, latest: r.data?.[0]?.created_at ?? null })),
    (supabase.from("branscombe_registrations") as any)
      .select("id, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(1)
      .then((r: any) => ({ count: r.count ?? 0, latest: r.data?.[0]?.created_at ?? null })),
    (supabase.from("hemp_homes_waitlist") as any)
      .select("id, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(1)
      .then((r: any) => ({ count: r.count ?? 0, latest: r.data?.[0]?.created_at ?? null }))
      .catch(() => ({ count: 0, latest: null })),
    (supabase.from("audit_log") as any)
      .select("id, actor_email, action, entity_type, created_at, details")
      .order("created_at", { ascending: false })
      .limit(10)
      .then((r: any) => r.data ?? [])
      .catch(() => []),
  ]);

  return { seafields, branscombe, hemp, audit };
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AdminDashboard() {
  const { seafields, branscombe, hemp, audit } = await getCounts();

  const cards = [
    {
      title: "Seafields Registrations",
      count: seafields.count,
      latest: seafields.latest,
      href: "/admin/registrations?type=seafields",
      cta: "View all",
    },
    {
      title: "Branscombe Registrations",
      count: branscombe.count,
      latest: branscombe.latest,
      href: "/admin/registrations?type=branscombe",
      cta: "View all",
    },
    {
      title: "Hemp Homes Waitlist",
      count: hemp.count,
      latest: hemp.latest,
      href: "/admin/registrations?type=hemp",
      cta: "View all",
    },
  ];

  const quickLinks = [
    { href: "/admin/seafields-stages", label: "Manage Seafields Stages" },
    { href: "/admin/seafields-lots", label: "Manage Seafields Lots" },
    { href: "/admin/seafields-pipeline", label: "Seafields Pipeline" },
    { href: "/admin/branscombe-units", label: "Manage Branscombe Units" },
    { href: "/admin/branscombe-pipeline", label: "Branscombe Pipeline" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Dashboard</h2>
        <p className="text-sm text-slate-500">
          Live counts and recent activity across Factory2Key&apos;s purchaser
          projects.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <a
            key={c.title}
            href={c.href}
            className="bg-white border border-slate-200 rounded-lg p-5 hover:border-[#00B5AD] transition-colors no-underline block"
          >
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              {c.title}
            </p>
            <p className="text-4xl font-black text-slate-900 mt-2 mb-1">
              {c.count}
            </p>
            <p className="text-xs text-slate-500">
              Most recent: {formatDate(c.latest)}
            </p>
            <p className="text-xs text-[#00B5AD] font-semibold mt-3">
              {c.cta} →
            </p>
          </a>
        ))}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-3">
          Quick links
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickLinks.map((q) => (
            <a
              key={q.href}
              href={q.href}
              className="bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm hover:border-[#00B5AD] transition-colors no-underline text-slate-900"
            >
              {q.label}
            </a>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-3">
          Recent activity
        </h3>
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2 font-semibold">When</th>
                <th className="px-4 py-2 font-semibold">Actor</th>
                <th className="px-4 py-2 font-semibold">Action</th>
                <th className="px-4 py-2 font-semibold">Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {audit.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500 text-center" colSpan={4}>
                    No activity yet.
                  </td>
                </tr>
              ) : (
                audit.map((row: any) => (
                  <tr key={row.id} className="text-slate-700">
                    <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-4 py-2 text-xs">{row.actor_email ?? "—"}</td>
                    <td className="px-4 py-2 text-xs font-mono">{row.action}</td>
                    <td className="px-4 py-2 text-xs">{row.entity_type}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
