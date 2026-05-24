// @explanatory-header-exempt — nested workflow page; entry-point header lives on the parent surface
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { NotifyRecipientsCard } from "@caistech/property-launch-kit/components";

type Status =
  | "active"
  | "locked_in"
  | "released"
  | "converted_to_sale"
  | "cancelled";
type RegType = "primary" | "backup_list";

interface RegistrationJoinRow {
  joinId: string;
  lot_number: number;
  stage_number: number | null;
  stage_label: string | null;
  registration_type: RegType;
  status: Status;
  position_in_queue: number | null;
  created_at: string;
  registration: {
    id: string;
    agent_id: string | null;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    suburb: string | null;
    postcode: string | null;
    buyer_type: string | null;
    purchase_timeline: string | null;
    finance_status: string | null;
    interest_type: string | null;
    created_at: string;
  };
}

const STATUS_OPTIONS: Status[] = [
  "active",
  "locked_in",
  "released",
  "converted_to_sale",
  "cancelled",
];

const STATUS_BADGE: Record<Status, string> = {
  active: "bg-emerald-100 text-emerald-800",
  locked_in: "bg-blue-100 text-blue-800",
  released: "bg-amber-100 text-amber-800",
  converted_to_sale: "bg-purple-100 text-purple-800",
  cancelled: "bg-slate-200 text-slate-600",
};

const TYPE_BADGE: Record<RegType, string> = {
  primary: "bg-cyan-100 text-cyan-800",
  backup_list: "bg-slate-100 text-slate-700",
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type StatusFilter = "all" | Status;
type StageFilter = "all" | string;

export default function SeafieldsRegistrationsPage() {
  const [rows, setRows] = useState<RegistrationJoinRow[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string; agency: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{
    joinId: string;
    field: "status" | "registration_type";
    nextValue: string;
    reason: string;
  } | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/seafields/registrations");
      if (!res.ok) {
        setMessage({ type: "error", text: "Failed to load registrations" });
        return;
      }
      const data = await res.json();
      setRows(data.registrations ?? []);
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    fetch("/api/admin/agents")
      .then((r) => (r.ok ? r.json() : { agents: [] }))
      .then((d) => setAgents(d.agents ?? []))
      .catch(() => {});
  }, []);

  const stages = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.stage_number != null) set.add(String(r.stage_number));
    }
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (stageFilter !== "all" && String(r.stage_number) !== stageFilter)
        return false;
      if (q) {
        const haystack = `${r.registration.first_name} ${r.registration.last_name} ${r.registration.email} L${r.lot_number}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, stageFilter, search]);

  const counts = useMemo(() => {
    const c = { active: 0, locked_in: 0, released: 0, converted_to_sale: 0, cancelled: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  function openEdit(
    joinId: string,
    field: "status" | "registration_type",
    nextValue: string,
  ) {
    setEditing({ joinId, field, nextValue, reason: "" });
    setMessage(null);
  }

  async function confirmEdit() {
    if (!editing) return;
    if (editing.reason.trim().length < 10) {
      setMessage({
        type: "error",
        text: "Reason must be at least 10 characters.",
      });
      return;
    }
    setSavingId(editing.joinId);
    try {
      const res = await fetch(
        `/api/admin/seafields/registrations/${editing.joinId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            [editing.field]: editing.nextValue,
            reason: editing.reason.trim(),
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Save failed" });
        return;
      }
      // Refresh — queue rerank may have shifted other rows on the same lot.
      await fetchRows();
      setEditing(null);
      setMessage({ type: "success", text: "Updated." });
    } catch {
      setMessage({ type: "error", text: "Network error during save." });
    } finally {
      setSavingId(null);
    }
  }

  async function resendConfirmation(joinId: string) {
    setNotifyingId(joinId);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/seafields/registrations/${joinId}/notify`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Send failed" });
        return;
      }
      setMessage({ type: "success", text: "Confirmation sent." });
    } catch {
      setMessage({ type: "error", text: "Network error during send." });
    } finally {
      setNotifyingId(null);
    }
  }

  async function assignAgent(registrationId: string, agentId: string | null) {
    setMessage(null);
    try {
      const res = await fetch("/api/admin/agents/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_id: registrationId, agent_id: agentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Assign failed" });
        return;
      }
      // agent_id lives on the parent registration — update every join row that
      // shares this registration id (a buyer may appear under several lots).
      setRows((prev) =>
        prev.map((r) =>
          r.registration.id === registrationId
            ? { ...r, registration: { ...r.registration, agent_id: agentId } }
            : r,
        ),
      );
      setMessage({ type: "success", text: agentId ? "Assigned to agent." : "Unassigned." });
    } catch {
      setMessage({ type: "error", text: "Network error during assign." });
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">
        Seafields Registrations
      </h2>
      <p className="text-sm text-slate-500 mb-6 max-w-3xl">
        One row per (registrant × lot). Status and registration_type changes
        require a reason and are audit-logged. Releasing or cancelling a row
        on a lot with backup-list registrants re-ranks queue positions and
        fires queue_position_updated emails automatically.
      </p>

      <NotifyRecipientsCard apiEndpoint="/api/admin/seafields/notify-recipients" />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
        <Stat label="Active" value={counts.active} color="emerald" />
        <Stat label="Locked in" value={counts.locked_in} color="blue" />
        <Stat label="Released" value={counts.released} color="amber" />
        <Stat label="Sold" value={counts.converted_to_sale} color="purple" />
        <Stat label="Cancelled" value={counts.cancelled} color="slate" />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="border border-slate-300 rounded px-2 py-1 text-sm"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as StageFilter)}
          className="border border-slate-300 rounded px-2 py-1 text-sm"
        >
          <option value="all">All stages</option>
          {stages.map((s) => (
            <option key={s} value={s}>
              Stage {s}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Search name, email, lot…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] max-w-md border border-slate-300 rounded px-2 py-1 text-sm"
        />
        <span className="text-xs text-slate-500">
          {filtered.length} of {rows.length}
        </span>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded text-sm ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="p-6 text-slate-500">Loading registrations…</div>
      ) : filtered.length === 0 ? (
        <div className="p-6 text-center text-slate-500 italic bg-white border rounded">
          No registrations match these filters.
        </div>
      ) : (
        <div className="bg-white border rounded overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">When</th>
                <th className="px-3 py-2 text-left">Lot</th>
                <th className="px-3 py-2 text-left">Stage</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">Pos</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Registrant</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Agent</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.joinId} className="hover:bg-slate-50 align-top">
                  <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                    {fmtDateTime(r.created_at)}
                  </td>
                  <td className="px-3 py-2 font-mono font-semibold text-slate-900">
                    L{r.lot_number}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                    {r.stage_number != null
                      ? `S${r.stage_number}${r.stage_label ? ` · ${r.stage_label}` : ""}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <select
                      value={r.registration_type}
                      disabled={savingId === r.joinId}
                      onChange={(e) =>
                        openEdit(r.joinId, "registration_type", e.target.value)
                      }
                      className={`text-xs font-semibold rounded px-2 py-0.5 border border-transparent ${TYPE_BADGE[r.registration_type]} cursor-pointer`}
                    >
                      <option value="primary">primary</option>
                      <option value="backup_list">backup_list</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500 text-right">
                    {r.position_in_queue ?? "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <select
                      value={r.status}
                      disabled={savingId === r.joinId}
                      onChange={(e) =>
                        openEdit(r.joinId, "status", e.target.value)
                      }
                      className={`text-xs font-semibold rounded px-2 py-0.5 border border-transparent ${STATUS_BADGE[r.status]} cursor-pointer`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-slate-900">
                      {r.registration.first_name} {r.registration.last_name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {r.registration.buyer_type ?? ""}
                      {r.registration.purchase_timeline
                        ? ` · ${r.registration.purchase_timeline}`
                        : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    <a
                      href={`mailto:${r.registration.email}`}
                      className="text-[#00B5AD] hover:underline text-sm"
                    >
                      {r.registration.email}
                    </a>
                    {r.registration.phone && (
                      <div className="text-xs text-slate-500">
                        <a
                          href={`tel:${r.registration.phone}`}
                          className="hover:underline"
                        >
                          {r.registration.phone}
                        </a>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <select
                      value={r.registration.agent_id ?? ""}
                      onChange={(e) =>
                        assignAgent(r.registration.id, e.target.value || null)
                      }
                      className="text-xs border border-slate-300 rounded px-2 py-1 max-w-[150px]"
                      title="Assign this buyer to an agent (shows in their My Clients)"
                    >
                      <option value="">— Unassigned —</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                          {a.agency ? ` (${a.agency})` : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => resendConfirmation(r.joinId)}
                      disabled={notifyingId === r.joinId}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium disabled:opacity-50"
                    >
                      {notifyingId === r.joinId ? "Sending…" : "Resend confirmation"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditing(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border rounded shadow-xl max-w-md w-full p-5"
          >
            <h3 className="font-bold text-slate-900 text-lg mb-2">
              Confirm change
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Changing <strong>{editing.field.replace("_", " ")}</strong> to{" "}
              <strong>{editing.nextValue.replace("_", " ")}</strong>. Provide a
              reason — it&apos;s logged to the audit trail and required to
              complete the change.
            </p>
            <textarea
              autoFocus
              value={editing.reason}
              onChange={(e) =>
                setEditing({ ...editing, reason: e.target.value })
              }
              rows={3}
              placeholder="e.g. Registrant requested cancellation by phone"
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
            <div className="text-[11px] text-slate-500 mt-1">
              {editing.reason.length < 10
                ? `Minimum 10 characters (currently ${editing.reason.length}).`
                : `${editing.reason.length} characters.`}
            </div>
            <div className="flex items-center gap-3 mt-4 justify-end">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={savingId === editing.joinId}
                className="text-slate-600 hover:text-slate-900 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmEdit}
                disabled={
                  savingId === editing.joinId || editing.reason.length < 10
                }
                className="bg-slate-900 hover:bg-slate-700 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50"
              >
                {savingId === editing.joinId ? "Saving…" : "Save change"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "blue" | "amber" | "purple" | "slate";
}) {
  const colorMap = {
    emerald: "text-emerald-700",
    blue: "text-blue-700",
    amber: "text-amber-700",
    purple: "text-purple-700",
    slate: "text-slate-700",
  };
  return (
    <div className="bg-white border rounded p-3">
      <div className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={`text-2xl font-bold ${colorMap[color]}`}>{value}</div>
    </div>
  );
}
