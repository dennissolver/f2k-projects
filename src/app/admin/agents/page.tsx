"use client";

import { useCallback, useEffect, useState } from "react";

interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  agency: string | null;
  estate_access: string[];
  active: boolean;
  status: string;
  invite_expires_at: string | null;
  created_at: string;
}

const ESTATES = [
  { value: "seafields", label: "Seafields" },
  { value: "branscombe", label: "Branscombe" },
] as const;

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      } else {
        setMsg({ type: "error", text: "Failed to load agents" });
      }
    } catch {
      setMsg({ type: "error", text: "Network error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setActive(agent: Agent, active: boolean) {
    if (!active && !confirm(`Block ${agent.name}? They'll lose portal access immediately.`)) return;
    const res = await fetch(`/api/admin/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (res.ok) {
      setMsg({ type: "success", text: `${agent.name} ${active ? "unblocked" : "blocked"}` });
      load();
    } else {
      setMsg({ type: "error", text: "Update failed" });
    }
  }

  async function remove(agent: Agent) {
    if (!confirm(`Delete ${agent.name}? This revokes their login. Their clients' registrations are kept but unlinked.`)) return;
    const res = await fetch(`/api/admin/agents/${agent.id}`, { method: "DELETE" });
    if (res.ok) {
      setMsg({ type: "success", text: `${agent.name} deleted` });
      load();
    } else {
      setMsg({ type: "error", text: "Delete failed" });
    }
  }

  async function updateAgent(agent: Agent, updates: Partial<Agent>) {
    const res = await fetch(`/api/admin/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      setMsg({ type: "success", text: `${agent.name} updated` });
      load();
    } else {
      setMsg({ type: "error", text: "Update failed" });
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Agents</h2>
      <p className="text-sm text-slate-500 mb-6 max-w-2xl">
        Create and manage external selling agents. Creating an agent emails them an
        invite with an access code; once they activate, they get a portal showing
        only their own buyers&apos; registrations and masked lot availability. Block
        an agent to cut their access instantly; delete to revoke their login entirely.
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

      <button
        onClick={() => setShowCreate(true)}
        className="mb-6 bg-slate-900 hover:bg-slate-700 text-white px-5 py-2.5 min-h-[44px] rounded text-sm font-semibold"
      >
        + Create agent
      </button>

      {loading ? (
        <div className="text-slate-500">Loading agents…</div>
      ) : agents.length === 0 ? (
        <div className="text-slate-400 text-sm border border-dashed rounded p-6 text-center">
          No agents yet. Create one to send an invite.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {agents.map((a) => (
            <div key={a.id} className="border border-slate-200 rounded-lg p-4 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{a.name}</div>
                  <div className="text-sm text-slate-500 truncate">{a.email}</div>
                  {a.agency && <div className="text-sm text-slate-500">{a.agency}</div>}
                </div>
                <span
                  className={`shrink-0 inline-block border px-2 py-0.5 rounded text-xs font-semibold ${
                    !a.active
                      ? "bg-rose-100 text-rose-800 border-rose-300"
                      : a.status === "active"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-amber-100 text-amber-800 border-amber-300"
                  }`}
                >
                  {!a.active ? "blocked" : a.status === "active" ? "active" : "pending"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {a.estate_access?.map((e) => (
                  <span key={e} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    {e}
                  </span>
                ))}
                {a.phone && <span className="text-xs text-slate-400">{a.phone}</span>}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setEditingAgent(a)}
                  className="text-sm px-3 py-1.5 min-h-[40px] rounded border border-slate-300 hover:bg-slate-50 font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => setActive(a, !a.active)}
                  className="text-sm px-3 py-1.5 min-h-[40px] rounded border border-slate-300 hover:bg-slate-50 font-medium"
                >
                  {a.active ? "Block" : "Unblock"}
                </button>
                <button
                  onClick={() => remove(a)}
                  className="text-sm px-3 py-1.5 min-h-[40px] rounded border border-red-300 text-red-700 hover:bg-red-50 font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateAgentModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            load();
          }}
        />
      )}

      {editingAgent && (
        <EditAgentModal
          agent={editingAgent}
          onClose={() => setEditingAgent(null)}
          onSave={(updates) => {
            updateAgent(editingAgent, updates);
            setEditingAgent(null);
          }}
        />
      )}
    </div>
  );
}

function CreateAgentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [agency, setAgency] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [estates, setEstates] = useState<string[]>(["seafields"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ inviteLink: string; code: string; emailSent: boolean } | null>(null);

  function toggleEstate(v: string) {
    setEstates((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (estates.length === 0) {
      setError("Pick at least one project.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          agency: agency.trim() || null,
          estate_access: estates,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create agent");
        return;
      }
      setResult({ inviteLink: data.inviteLink, code: data.code, emailSent: data.emailSent });
      onCreated();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full border border-slate-300 rounded px-3 py-2.5 text-sm focus:outline-none focus:border-slate-900";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-lg shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">
            {result ? "Agent created" : "Create agent"}
          </h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 text-2xl leading-none">
            &times;
          </button>
        </div>

        {result ? (
          <div className="px-5 py-5 space-y-4">
            <p className="text-sm text-slate-600">
              {result.emailSent
                ? "Invite emailed to the agent. You can also send them this link + code directly:"
                : "Email could not be sent — send the agent this link + code directly:"}
            </p>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Activate link</div>
              <div className="flex gap-2">
                <input readOnly value={result.inviteLink} className={inputClass} onFocus={(e) => e.target.select()} />
                <button onClick={() => navigator.clipboard?.writeText(result.inviteLink)} className="shrink-0 px-3 py-2.5 min-h-[44px] rounded border border-slate-300 text-sm">Copy</button>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Access code</div>
              <div className="flex gap-2">
                <input readOnly value={result.code} className={`${inputClass} font-mono tracking-[0.3em] text-base`} onFocus={(e) => e.target.select()} />
                <button onClick={() => navigator.clipboard?.writeText(result.code)} className="shrink-0 px-3 py-2.5 min-h-[44px] rounded border border-slate-300 text-sm">Copy</button>
              </div>
            </div>
            <button onClick={onClose} className="w-full bg-slate-900 hover:bg-slate-700 text-white px-5 py-2.5 min-h-[44px] rounded text-sm font-semibold">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="px-5 py-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Henry Van Tiel" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Agency</label>
              <input value={agency} onChange={(e) => setAgency(e.target.value)} className={inputClass} placeholder="Ray White Geraldton" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="henry.vantiel@raywhite.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="0429 995 121" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Project(s) *</label>
              <div className="flex flex-wrap gap-2">
                {ESTATES.map((est) => (
                  <label key={est.value} className="flex items-center gap-2 border border-slate-300 rounded px-3 py-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={estates.includes(est.value)} onChange={() => toggleEstate(est.value)} className="h-4 w-4" />
                    {est.label}
                  </label>
                ))}
              </div>
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700">{error}</div>}
            <button type="submit" disabled={saving} className="w-full bg-slate-900 hover:bg-slate-700 text-white px-5 py-2.5 min-h-[44px] rounded text-sm font-semibold disabled:opacity-50">
              {saving ? "Creating…" : "Create + send invite"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function EditAgentModal({
  agent,
  onClose,
  onSave,
}: {
  agent: Agent;
  onClose: () => void;
  onSave: (updates: Partial<Agent>) => void;
}) {
  const [name, setName] = useState(agent.name);
  const [agency, setAgency] = useState(agent.agency || "");
  const [phone, setPhone] = useState(agent.phone || "");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    onSave({
      name: name.trim(),
      phone: phone.trim() || null,
      agency: agency.trim() || null,
    });
  }

  const inputClass =
    "w-full border border-slate-300 rounded px-3 py-2.5 text-sm focus:outline-none focus:border-slate-900";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Edit agent</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 text-2xl leading-none">
            &times;
          </button>
        </div>

        <form onSubmit={submit} className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Ant Manton" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Agency</label>
            <input value={agency} onChange={(e) => setAgency(e.target.value)} className={inputClass} placeholder="LJ Hooker" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="0429 995 121" />
          </div>
          <button type="submit" disabled={saving} className="w-full bg-slate-900 hover:bg-slate-700 text-white px-5 py-2.5 min-h-[44px] rounded text-sm font-semibold disabled:opacity-50">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
