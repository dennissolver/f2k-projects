"use client";

import { useEffect, useMemo, useState } from "react";

interface Agent {
  id: string;
  name: string;
  email: string;
  agency: string | null;
  estate_access: string[];
}

interface Client {
  id: string;
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
}

export function ViewAsAgentModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"seafields" | "branscombe">(
    agent.estate_access?.[0] === "branscombe" ? "branscombe" : "seafields"
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/agents/" + agent.id + "/clients");
        if (res.ok) {
          const data = await res.json();
          const allClients: Client[] = [
            ...(data.seafields || []).map((r: any) => ({ ...r, estate: "seafields" as const })),
            ...(data.branscombe || []).map((r: any) => ({ ...r, estate: "branscombe" as const })),
          ];
          setClients(allClients);
        }
      } catch { setClients([]); } 
      finally { setLoading(false); }

      await fetch("/api/admin/audit-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "view_as_agent",
          target_type: "agent",
          target_id: agent.id,
          details: { agent_name: agent.name, admin_view: true },
        }),
      });
    }
    load();
  }, [agent.id, agent.name]);

  const filteredClients = clients.filter((c) => c.estate === activeTab);
  const stages = Array.from(new Set(filteredClients.map((c) => c.stage_name).filter(Boolean))).sort();
  const statuses = Array.from(new Set(filteredClients.map((c) => c.lead_status).filter(Boolean))).sort();

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    let out = [...filteredClients];
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((c) => 
        c.first_name?.toLowerCase().includes(q) || 
        c.last_name?.toLowerCase().includes(q) || 
        c.email?.toLowerCase().includes(q)
      );
    }
    if (stageFilter !== "all") out = out.filter((c) => c.stage_name === stageFilter);
    if (statusFilter !== "all") out = out.filter((c) => c.lead_status === statusFilter);
    return out;
  }, [filteredClients, search, stageFilter, statusFilter]);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-5xl rounded-lg shadow-2xl max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-4 sm:px-5 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">View as: {agent.name}</h3>
            <p className="text-sm text-slate-500">Read-only preview of agent portal</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
        </div>
        <div className="border-b px-4 sm:px-5 py-2 flex gap-4 overflow-x-auto">
          {agent.estate_access?.includes("seafields") && (
            <button onClick={() => setActiveTab("seafields")} className={"text-sm font-medium pb-2 border-b-2 whitespace-nowrap " + (activeTab === "seafields" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500")}>
              Seafields ({clients.filter((c) => c.estate === "seafields").length})
            </button>
          )}
          {agent.estate_access?.includes("branscombe") && (
            <button onClick={() => setActiveTab("branscombe")} className={"text-sm font-medium pb-2 border-b-2 whitespace-nowrap " + (activeTab === "branscombe" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500")}>
              Branscombe ({clients.filter((c) => c.estate === "branscombe").length})
            </button>
          )}
        </div>
        <div className="p-4 border-b bg-slate-50">
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm w-full sm:w-40" />
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm">
              <option value="all">All stages</option>
              {stages.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm">
              <option value="all">All statuses</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="text-sm text-slate-500 self-center ml-auto">{filtered.length} of {filteredClients.length}</span>
          </div>
        </div>
        <div className="overflow-auto flex-1 p-4">
          {loading ? <div className="text-slate-500 text-sm text-center py-8">Loading...</div> : filtered.length === 0 ? (
            <div className="text-slate-400 text-sm border border-dashed rounded p-6 text-center">No clients linked to this agent.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-slate-200 rounded-lg">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Buyer</th>
                    <th className="text-left px-3 py-2 font-semibold">Email</th>
                    <th className="text-left px-3 py-2 font-semibold">Phone</th>
                    <th className="text-left px-3 py-2 font-semibold">{activeTab === "seafields" ? "Lots" : "Units"}</th>
                    <th className="text-left px-3 py-2 font-semibold">Type</th>
                    <th className="text-left px-3 py-2 font-semibold">Timeline</th>
                    <th className="text-left px-3 py-2 font-semibold">Stage</th>
                    <th className="text-left px-3 py-2 font-semibold">Status</th>
                    <th className="text-left px-3 py-2 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{[r.first_name, r.last_name].filter(Boolean).join(" ")}</td>
                      <td className="px-3 py-2 text-slate-600">{r.email}</td>
                      <td className="px-3 py-2 text-slate-600">{r.phone || "-"}</td>
                      <td className="px-3 py-2 text-slate-600">{r.lots_selected?.join(", ") || r.units_selected?.join(", ") || "-"}</td>
                      <td className="px-3 py-2 text-slate-600">{r.buyer_type || "-"}</td>
                      <td className="px-3 py-2 text-slate-600">{r.purchase_timeline || "-"}</td>
                      <td className="px-3 py-2 text-slate-600">{r.stage_name || "-"}</td>
                      <td className="px-3 py-2"><span className={"text-xs px-2 py-0.5 rounded " + (r.lead_status === "allocated" ? "bg-emerald-100 text-emerald-800" : r.lead_status === "qualified" ? "bg-blue-100 text-blue-800" : r.lead_status === "unqualified" ? "bg-rose-100 text-rose-800" : "bg-slate-100")}>{r.lead_status || "new"}</span></td>
                      <td className="px-3 py-2 text-slate-500">{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
