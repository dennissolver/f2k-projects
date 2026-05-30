"use client";

import { useEffect, useState, useMemo } from "react";
import { useAgent, canAccess } from "@/components/agent/AgentContext";

interface Client {
  registration_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  lots_selected: string[] | null;
  units_selected: string[] | null;
  buyer_type: string | null;
  purchase_timeline: string | null;
  created_at: string;
  estate: "seafields" | "branscombe";
  stage_name: string | null;
  lead_status: string | null;
  lot_statuses: { lot: string; status: string }[] | null;
}

type SortField = "name" | "email" | "phone" | "buyer_type" | "timeline" | "stage" | "status" | "date";
type SortDir = "asc" | "desc";

function ClientGrid({ clients, title }: { clients: Client[]; title: string }) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const stages = useMemo(() => {
    const s = new Set(clients.map((c) => c.stage_name).filter((v): v is string => v !== null && v !== undefined));
    return Array.from(s).sort();
  }, [clients]);

  const statuses = useMemo(() => {
    const s = new Set(clients.map((c) => c.lead_status).filter((v): v is string => v !== null && v !== undefined));
    return Array.from(s).sort();
  }, [clients]);

  const filtered = useMemo(() => {
    let out = [...clients];
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(
        (c) =>
          c.first_name?.toLowerCase().includes(q) ||
          c.last_name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
      );
    }
    if (stageFilter !== "all") out = out.filter((c) => c.stage_name === stageFilter);
    if (statusFilter !== "all") out = out.filter((c) => c.lead_status === statusFilter);

    out.sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      switch (sortField) {
        case "name":
          aVal = [a.first_name, a.last_name].filter(Boolean).join(" ").toLowerCase();
          bVal = [b.first_name, b.last_name].filter(Boolean).join(" ").toLowerCase();
          break;
        case "email":
          aVal = a.email?.toLowerCase() || "";
          bVal = b.email?.toLowerCase() || "";
          break;
        case "phone":
          aVal = a.phone || "";
          bVal = b.phone || "";
          break;
        case "buyer_type":
          aVal = a.buyer_type || "";
          bVal = b.buyer_type || "";
          break;
        case "timeline":
          aVal = a.purchase_timeline || "";
          bVal = b.purchase_timeline || "";
          break;
        case "stage":
          aVal = a.stage_name || "";
          bVal = b.stage_name || "";
          break;
        case "status":
          aVal = a.lead_status || "";
          bVal = b.lead_status || "";
          break;
        case "date":
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return out;
  }, [clients, search, stageFilter, statusFilter, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="ml-1 opacity-40">{sortField === field ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
  );

  if (clients.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">{title}</h2>
        <div className="text-slate-400 text-sm border border-dashed rounded p-6 text-center">
          No clients linked to you yet. When a buyer you referred registers — or an admin assigns one to you - they&apos;ll appear here.
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">{title}</h2>
      <div className="flex flex-wrap gap-3 mb-4">
        <input type="text" placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm w-48" />
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm">
          <option value="all">All stages</option>
          {stages.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-sm text-slate-500 self-center ml-auto">{filtered.length} of {clients.length}</span>
      </div>
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => handleSort("name")}>Buyer <SortIcon field="name" /></th>
              <th className="text-left px-3 py-2 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => handleSort("email")}>Email <SortIcon field="email" /></th>
              <th className="text-left px-3 py-2 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => handleSort("phone")}>Phone <SortIcon field="phone" /></th>
              <th className="text-left px-3 py-2 font-semibold">Lots</th>
              <th className="text-left px-3 py-2 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => handleSort("stage")}>Stage <SortIcon field="stage" /></th>
              <th className="text-left px-3 py-2 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => handleSort("status")}>Status <SortIcon field="status" /></th>
              <th className="text-left px-3 py-2 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => handleSort("buyer_type")}>Type <SortIcon field="buyer_type" /></th>
              <th className="text-left px-3 py-2 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => handleSort("timeline")}>Timeline <SortIcon field="timeline" /></th>
              <th className="text-left px-3 py-2 font-semibold cursor-pointer hover:bg-slate-100" onClick={() => handleSort("date")}>Registered <SortIcon field="date" /></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.registration_id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{c.email || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{c.phone || "—"}</td>
                <td className="px-3 py-2 text-slate-600 font-mono text-xs">
                  {c.estate === "seafields" ? c.lots_selected?.map((l) => l.replace(/^L/, "L")).join(", ") || "—" : c.units_selected?.map((u) => u.replace(/^U/, "U")).join(", ") || "—"}
                </td>
                <td className="px-3 py-2">{c.stage_name || "—"}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${c.lead_status === "active" ? "bg-emerald-100 text-emerald-800" : c.lead_status === "locked_in" ? "bg-blue-100 text-blue-800" : c.lead_status === "converted_to_sale" ? "bg-purple-100 text-purple-800" : c.lead_status === "cancelled" ? "bg-rose-100 text-rose-800" : c.lead_status === "released" ? "bg-slate-100 text-slate-800" : "bg-slate-100 text-slate-600"}`}>
                    {c.lead_status || "—"}
                  </span>
                </td>
                <td className="px-3 py-2">{c.buyer_type || "—"}</td>
                <td className="px-3 py-2">{c.purchase_timeline || "—"}</td>
                <td className="px-3 py-2 text-slate-500">{new Date(c.created_at).toLocaleDateString("en-AU")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function MyClientsPage() {
  const { estateAccess } = useAgent();
  const [seafields, setSeafields] = useState<Client[]>([]);
  const [branscombe, setBranscombe] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/agent/my-clients");
        if (res.ok) {
          const data = await res.json();
          setSeafields(data.seafields || []);
          setBranscombe(data.branscombe || []);
        } else setError("Couldn't load your clients.");
      } catch { setError("Network error."); } finally { setLoading(false); }
    })();
  }, []);

  const showSeafields = canAccess(estateAccess, "seafields");
  const showBranscombe = canAccess(estateAccess, "branscombe");
  const both = showSeafields && showBranscombe;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">My Clients</h1>
      <p className="text-sm text-slate-500 mb-6 max-w-2xl">The buyers registered to you. These are the registrations linked to your agent account — you see their full details; all other buyers stay private.</p>
      {error && <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700 mb-4">{error}</div>}
      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : (
        <>
          {showSeafields && <ClientGrid title={both ? "Seafields Estate" : "My Clients"} clients={seafields} />}
          {showBranscombe && <ClientGrid title={both ? "Branscombe Estate" : "My Clients"} clients={branscombe} />}
        </>
      )}
    </div>
  );
}