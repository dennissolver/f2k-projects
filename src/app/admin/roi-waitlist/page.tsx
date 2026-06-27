"use client";

import { useCallback, useEffect, useState } from "react";

interface WaitlistRow {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  buyer_category: string | null;
  status: string;
  consent_contact: boolean;
  nudged_at: string | null;
  submitted_at: string;
  agent_name: string | null;
  introducing_agent_id: string | null;
}

interface AgentLite {
  id: string;
  name: string;
  estate_access: string[];
}

interface Metrics {
  waitlist_total: number;
  qualification_total: number;
  attributed: number;
  unassigned: number;
  nudged: number;
  finance_ready: number;
  by_status: Record<string, number>;
  by_agent: { agent: string; waitlist: number; qualifications: number }[];
}

export default function AdminRoiWaitlistPage() {
  const [rows, setRows] = useState<WaitlistRow[]>([]);
  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wlRes, agRes, mRes] = await Promise.all([
        fetch("/api/admin/roi/waitlist?estate=branscombe"),
        fetch("/api/admin/agents"),
        fetch("/api/admin/roi/metrics?estate=branscombe"),
      ]);
      const wl = await wlRes.json();
      if (wlRes.ok) setRows(wl.waitlist || []);
      else setMsg({ type: "error", text: wl.error || "Failed to load" });
      if (agRes.ok) {
        const ag = await agRes.json();
        setAgents(
          (ag.agents || []).filter((a: AgentLite) => a.estate_access?.includes("branscombe")),
        );
      }
      if (mRes.ok) setMetrics(await mRes.json());
    } catch {
      setMsg({ type: "error", text: "Network error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function assign(row: WaitlistRow, agentId: string | null) {
    let reason: string | undefined;
    if (row.introducing_agent_id) {
      const r = prompt(
        `Re-assign ${row.name} from their current agent? Enter a reason (logged):`,
      );
      if (r == null) return; // cancelled
      reason = r;
    }
    setAssigning(row.id);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/roi/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waitlist_id: row.id, agent_id: agentId, reason }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: "success", text: `${row.name} ${agentId ? "assigned" : "unassigned"}` });
        load();
      } else {
        setMsg({ type: "error", text: data.error || "Assign failed" });
      }
    } catch {
      setMsg({ type: "error", text: "Network error" });
    } finally {
      setAssigning(null);
    }
  }

  async function sendQualification(row: WaitlistRow) {
    if (!confirm(`Email the qualification form link to ${row.name} (${row.email})?`)) return;
    setSending(row.id);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/roi/send-qualification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waitlist_id: row.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: "success", text: `Qualification form sent to ${row.name}` });
        load();
      } else {
        setMsg({ type: "error", text: data.error || "Failed to send" });
      }
    } catch {
      setMsg({ type: "error", text: "Network error" });
    } finally {
      setSending(null);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Waitlist (ROI portal)</h2>
      <p className="text-sm text-slate-500 mb-6 max-w-2xl">
        Buyers who joined the Branscombe waitlist through an agent link or directly. Each is
        attributed to its introducing agent at first touch (or sits in the unassigned pool). Send a
        buyer the qualification form to capture their preferred homes and indicative terms — the
        link is pre-attributed and pre-filled.
      </p>

      {msg && (
        <div
          className={`mb-4 p-3 rounded text-sm ${
            msg.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Funnel metrics */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          {[
            { label: "Waitlist", value: metrics.waitlist_total },
            { label: "Qualified (EOI)", value: metrics.qualification_total },
            { label: "Attributed", value: metrics.attributed },
            { label: "Unassigned", value: metrics.unassigned },
            { label: "Nudged", value: metrics.nudged },
            { label: "Finance-ready", value: metrics.finance_ready },
          ].map((m) => (
            <div key={m.label} className="border border-slate-200 rounded-lg p-3 bg-white">
              <div className="text-2xl font-bold text-slate-900">{m.value}</div>
              <div className="text-xs text-slate-500">{m.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end mb-3">
        <a
          href="/api/admin/roi/export?estate=branscombe"
          className="text-xs px-3 py-2 min-h-[36px] inline-flex items-center rounded border border-slate-300 hover:bg-slate-50 font-semibold"
        >
          Export CSV
        </a>
      </div>

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-slate-400 text-sm border border-dashed rounded p-6 text-center">
          No waitlist registrations yet.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Buyer</th>
                <th className="text-left px-4 py-3 font-semibold">Agent</th>
                <th className="text-left px-4 py-3 font-semibold">Category</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Sent</th>
                <th className="text-left px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{r.name}</div>
                    <div className="text-xs text-slate-500">{r.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={r.introducing_agent_id ?? ""}
                      disabled={assigning === r.id}
                      onChange={(e) => assign(r, e.target.value || null)}
                      className={`text-xs border rounded px-2 py-1.5 min-h-[36px] max-w-[160px] ${
                        r.introducing_agent_id ? "border-slate-300 text-slate-700" : "border-amber-300 text-amber-700"
                      }`}
                    >
                      <option value="">Unassigned</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.buyer_category || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block border border-slate-300 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold">
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {r.nudged_at ? new Date(r.nudged_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => sendQualification(r)}
                      disabled={sending === r.id}
                      className="text-xs px-3 py-1.5 min-h-[36px] rounded border border-[#00B5AD] text-[#00766f] hover:bg-[#00B5AD]/10 disabled:opacity-50 font-semibold"
                    >
                      {sending === r.id ? "Sending…" : "Send qualification form"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
