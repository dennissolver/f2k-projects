// @explanatory-header-exempt — nested workflow page; entry-point header lives on the parent surface
import { createSupabaseService } from "@/lib/supabase-service";
import { RegistrationActions } from "./RegistrationActions";

export const dynamic = "force-dynamic";

type ProjectFilter = "all" | "seafields" | "branscombe" | "hemp";

interface UnifiedRegistration {
  id: string;
  project: "seafields" | "branscombe" | "hemp";
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  items: string[];
  buyer_type: string | null;
  purchase_timeline: string | null;
  finance_status: string | null;
  agent_name: string | null;
  ownership: "agent" | "house" | "unassigned" | null;
  agent_id: string | null;
}

async function loadRegistrations(filter: ProjectFilter, search: string): Promise<UnifiedRegistration[]> {
  const supabase = createSupabaseService();
  const out: UnifiedRegistration[] = [];

  // Load agents for lookups
  const { data: allAgents } = await (supabase.from("agents") as any)
    .select("id, name, agency")
    .eq("active", true);
  const agentMap = new Map((allAgents || []).map((a: { id: string; name: string; agency: string | null }) => [a.id, a]));

  function getAgentName(agentId: string | null): string | null {
    if (!agentId) return null;
    const agent = agentMap.get(agentId) as { id: string; name: string; agency: string | null } | undefined;
    return agent ? `${agent.name}${agent.agency ? ` (${agent.agency})` : ""}` : null;
  }

  if (filter === "all" || filter === "seafields") {
    const { data } = await (supabase.from("seafields_registrations") as any)
      .select("*")
      .order("created_at", { ascending: false });
    for (const r of (data as any[]) || []) {
      out.push({
        id: r.id,
        project: "seafields",
        created_at: r.created_at,
        name: `${r.first_name} ${r.last_name}`.trim(),
        email: r.email,
        phone: r.phone,
        items: r.lots_selected || [],
        buyer_type: r.buyer_type,
        purchase_timeline: r.purchase_timeline,
        finance_status: r.finance_status,
        agent_name: getAgentName(r.agent_id),
        ownership: r.ownership,
        agent_id: r.agent_id,
      });
    }
  }

  if (filter === "all" || filter === "branscombe") {
    const { data } = await (supabase.from("branscombe_registrations") as any)
      .select("*")
      .order("created_at", { ascending: false });
    for (const r of (data as any[]) || []) {
      out.push({
        id: r.id,
        project: "branscombe",
        created_at: r.created_at,
        name: `${r.first_name} ${r.last_name}`.trim(),
        email: r.email,
        phone: r.phone,
        items: r.units_selected || [],
        buyer_type: r.buyer_type,
        purchase_timeline: r.purchase_timeline,
        finance_status: r.finance_status,
        agent_name: getAgentName(r.agent_id),
        ownership: r.ownership,
        agent_id: r.agent_id,
      });
    }
  }

  if (filter === "all" || filter === "hemp") {
    try {
      const { data } = await (supabase.from("hemp_homes_waitlist") as any)
        .select("*")
        .order("created_at", { ascending: false });
      for (const r of (data as any[]) || []) {
        out.push({
          id: r.id,
          project: "hemp",
          created_at: r.created_at,
          name: r.full_name,
          email: r.email,
          phone: r.phone,
          items: r.regions_of_interest || [],
          buyer_type: r.i_am_a,
          purchase_timeline: r.timeframe,
          finance_status: r.finance_status,
          agent_name: null,
          ownership: null,
          agent_id: null,
        });
      }
    } catch {
      // table may not exist yet — skip silently
    }
  }

  out.sort((a, b) => b.created_at.localeCompare(a.created_at));

  if (search) {
    const q = search.toLowerCase();
    return out.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.items.some((i) => i.toLowerCase().includes(q)),
    );
  }
  return out;
}

const PROJECT_LABEL: Record<UnifiedRegistration["project"], string> = {
  seafields: "Seafields",
  branscombe: "Branscombe",
  hemp: "Hemp Homes",
};

const PROJECT_COLOR: Record<UnifiedRegistration["project"], string> = {
  seafields: "bg-cyan-100 text-cyan-800",
  branscombe: "bg-amber-100 text-amber-800",
  hemp: "bg-emerald-100 text-emerald-800",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: { type?: string; q?: string };
}) {
  const filter = (searchParams.type ?? "all") as ProjectFilter;
  const search = searchParams.q ?? "";
  const registrations = await loadRegistrations(filter, search);

  const filters: { label: string; value: ProjectFilter }[] = [
    { label: "All", value: "all" },
    { label: "Seafields", value: "seafields" },
    { label: "Branscombe", value: "branscombe" },
    { label: "Hemp Homes", value: "hemp" },
  ];

  // Export the CURRENT view (respects the project filter + search box).
  const exportParams = new URLSearchParams();
  if (filter !== "all") exportParams.set("type", filter);
  if (search) exportParams.set("q", search);
  const exportHref = `/api/admin/export-registrations${
    exportParams.toString() ? `?${exportParams.toString()}` : ""
  }`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Registrations</h2>
        <p className="text-sm text-slate-500">
          {registrations.length}{" "}
          {registrations.length === 1 ? "registration" : "registrations"}{" "}
          {filter !== "all"
            ? `for ${PROJECT_LABEL[filter as UnifiedRegistration["project"]]}`
            : "across all projects"}
          {search ? ` matching "${search}"` : ""}.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 text-sm">
          {filters.map((f) => {
            const isActive = filter === f.value;
            const params = new URLSearchParams();
            if (f.value !== "all") params.set("type", f.value);
            if (search) params.set("q", search);
            const href = params.toString()
              ? `?${params.toString()}`
              : "/admin/registrations";
            return (
              <a
                key={f.value}
                href={href}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "bg-white border border-slate-200 text-slate-700 hover:border-slate-400"
                }`}
              >
                {f.label}
              </a>
            );
          })}
        </div>
        <form className="flex-1 max-w-md flex gap-2">
          {filter !== "all" && (
            <input type="hidden" name="type" value={filter} />
          )}
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search name, email, or lot/unit ID…"
            className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded focus:border-slate-400 outline-none"
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-700"
          >
            Search
          </button>
        </form>
        <a
          href={exportHref}
          className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold bg-[#00B5AD] hover:bg-[#009a93] text-white transition-colors no-underline"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
          {filter !== "all" ? ` (${PROJECT_LABEL[filter as UnifiedRegistration["project"]]})` : ""}
        </a>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr className="text-left">
              <th className="px-4 py-2 font-semibold">When</th>
              <th className="px-4 py-2 font-semibold">Project</th>
              <th className="px-4 py-2 font-semibold">Name</th>
              <th className="px-4 py-2 font-semibold">Email</th>
              <th className="px-4 py-2 font-semibold">Items</th>
              <th className="px-4 py-2 font-semibold">Buyer</th>
              <th className="px-4 py-2 font-semibold">Timeline</th>
              <th className="px-4 py-2 font-semibold">Agent</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {registrations.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={10}>
                    No registrations match these filters.
                  </td>
                </tr>
            ) : (
              registrations.map((r) => (
                <tr key={`${r.project}-${r.id}`} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(r.created_at)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[0.65rem] font-semibold uppercase tracking-wider ${PROJECT_COLOR[r.project]}`}
                    >
                      {PROJECT_LABEL[r.project]}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-semibold text-slate-900">
                    {r.name}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    <a
                      href={`mailto:${r.email}`}
                      className="text-[#00B5AD] hover:underline"
                    >
                      {r.email}
                    </a>
                    {r.phone && (
                      <div className="text-xs text-slate-500">
                        <a
                          href={`tel:${r.phone}`}
                          className="hover:underline"
                        >
                          {r.phone}
                        </a>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {r.items.length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span className="font-mono">
                        {r.items.slice(0, 4).join(", ")}
                        {r.items.length > 4 ? "…" : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {r.buyer_type ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {r.purchase_timeline ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {r.agent_name ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    {r.ownership === "agent" ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[0.65rem] font-semibold bg-green-100 text-green-800">
                        Agent
                      </span>
                    ) : r.ownership === "house" ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[0.65rem] font-semibold bg-purple-100 text-purple-800">
                        House
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[0.65rem] font-semibold bg-gray-100 text-gray-800">
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {r.project !== "hemp" && (
                      <RegistrationActions
                        registrationId={r.id}
                        project={r.project}
                        ownership={r.ownership}
                        agentId={r.agent_id}
                      />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
