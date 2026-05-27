"use client";

import { useCallback, useEffect, useState } from "react";

interface Registration {
  id: string;
  agent_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  suburb: string | null;
  postcode: string | null;
  buyer_type: string | null;
  buyer_profile: string | null;
  current_housing: string | null;
  purchase_timeline: string | null;
  finance_status: string | null;
  units_selected: string[];
  price_preferences: Record<string, string> | null;
  referrer_type: string | null;
  referrer_name: string | null;
  referrer_company: string | null;
  notes: string | null;
  created_at: string;
}

interface AgentOption {
  id: string;
  name: string;
  agency: string | null;
  estate_access: string[];
  active: boolean;
}

interface Props {
  unitId: string;
  unitNumber: number;
  intentLockedToRegistrationId: string | null;
  onIntentLockChanged: (registrationId: string | null) => void;
  onConvertedToAllocation: (fullName: string) => void;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function AdminUnitWaitlist({
  unitId,
  unitNumber,
  intentLockedToRegistrationId,
  onIntentLockChanged,
  onConvertedToAllocation,
}: Props) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const fetchWaitlist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/branscombe/unit-waitlist/${encodeURIComponent(unitId)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load waitlist");
        return;
      }
      setRegistrations(data.registrations || []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    fetchWaitlist();
  }, [fetchWaitlist]);

  useEffect(() => {
    fetch("/api/admin/agents")
      .then((r) => (r.ok ? r.json() : { agents: [] }))
      .then((d: { agents?: AgentOption[] }) =>
        setAgents(
          (d.agents ?? []).filter(
            (a) =>
              a.active &&
              Array.isArray(a.estate_access) &&
              a.estate_access.includes("branscombe"),
          ),
        ),
      )
      .catch(() => {});
  }, []);

  async function patchAllocation(
    body: Record<string, unknown>,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/admin/branscombe/allocations/${unitNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data.error || "Update failed" };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error" };
    }
  }

  async function lockTo(reg: Registration) {
    setActingOn(reg.id);
    setError(null);
    const result = await patchAllocation({
      intent_locked_to_registration_id: reg.id,
    });
    setActingOn(null);
    if (!result.ok) {
      setError(result.error || "Lock failed");
      return;
    }
    onIntentLockChanged(reg.id);
  }

  async function unlock() {
    setActingOn("unlock");
    setError(null);
    const result = await patchAllocation({
      intent_locked_to_registration_id: null,
    });
    setActingOn(null);
    if (!result.ok) {
      setError(result.error || "Unlock failed");
      return;
    }
    onIntentLockChanged(null);
  }

  async function convertToAllocation(reg: Registration) {
    const fullName = `${reg.first_name} ${reg.last_name}`.trim();
    if (
      !confirm(
        `Convert "${fullName}" to a firm allocation on ${unitId}? ` +
          `This sets the public Reserved badge and clears any soft-allocate.`,
      )
    ) {
      return;
    }
    setActingOn(reg.id);
    setError(null);
    const result = await patchAllocation({ allocated_to: fullName });
    setActingOn(null);
    if (!result.ok) {
      setError(result.error || "Convert failed");
      return;
    }
    onConvertedToAllocation(fullName);
  }

  async function removeInterest(reg: Registration) {
    const fullName = `${reg.first_name} ${reg.last_name}`.trim();
    const onlyHere =
      reg.units_selected.filter((u) => u !== unitId).length === 0;
    const msg = onlyHere
      ? `Remove ${fullName}'s interest in ${unitId}? They aren't registered on any other home, so this deletes their registration entirely. This can't be undone.`
      : `Remove ${fullName}'s interest in ${unitId}? They stay registered on their other homes. This can't be undone.`;
    if (!confirm(msg)) return;
    setActingOn(reg.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/branscombe/registrations/${reg.id}/remove-interest`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unitId }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Remove failed");
        return;
      }
      // Drop it from the list; if it held this unit's soft-lock, the endpoint
      // cleared it — tell the parent so the allocation summary refreshes.
      setRegistrations((prev) => prev.filter((r) => r.id !== reg.id));
      if (intentLockedToRegistrationId === reg.id) onIntentLockChanged(null);
    } catch {
      setError("Network error");
    } finally {
      setActingOn(null);
    }
  }

  async function assignAgent(registrationId: string, agentId: string | null) {
    setAssigningId(registrationId);
    setError(null);
    try {
      const res = await fetch("/api/admin/agents/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: registrationId,
          agent_id: agentId,
          estate: "branscombe",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Assign failed");
        return;
      }
      // agent_id lives on the parent registration — reflect it locally so the
      // dropdown shows the saved value immediately (the buyer may sit on several
      // units; each waitlist refetches on open).
      setRegistrations((prev) =>
        prev.map((r) =>
          r.id === registrationId ? { ...r, agent_id: agentId } : r,
        ),
      );
    } catch {
      setError("Network error during assign");
    } finally {
      setAssigningId(null);
    }
  }

  const lockedReg = registrations.find(
    (r) => r.id === intentLockedToRegistrationId,
  );

  return (
    <div className="border-t border-slate-200 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
          Waitlist for this home
        </h4>
        <span className="text-xs text-slate-500">
          {loading ? "…" : `${registrations.length} registered`}
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700 mb-3">
          {error}
        </div>
      )}

      {lockedReg && (
        <div className="bg-amber-50 border border-amber-300 rounded p-3 mb-3">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                Soft-allocated to
              </div>
              <div className="font-semibold text-slate-900 text-sm mt-0.5">
                {lockedReg.first_name} {lockedReg.last_name}
              </div>
              <div className="text-xs text-slate-600">{lockedReg.email}</div>
            </div>
            <button
              onClick={unlock}
              disabled={actingOn === "unlock"}
              className="text-xs text-amber-900 hover:text-amber-700 underline disabled:opacity-50 whitespace-nowrap"
            >
              {actingOn === "unlock" ? "Unlocking…" : "Unlock"}
            </button>
          </div>
          <button
            onClick={() => convertToAllocation(lockedReg)}
            disabled={actingOn === lockedReg.id}
            className="w-full mt-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold py-1.5 rounded disabled:opacity-50"
          >
            {actingOn === lockedReg.id
              ? "Converting…"
              : "Convert to firm allocation →"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-slate-400">Loading…</div>
      ) : registrations.length === 0 ? (
        <div className="text-xs text-slate-500 italic py-2">
          No one has registered interest in this home yet.
        </div>
      ) : (
        <div className="space-y-2">
          {registrations.map((r) => {
            const isLocked = r.id === intentLockedToRegistrationId;
            const isActing = actingOn === r.id;
            const fullName = `${r.first_name} ${r.last_name}`.trim();
            const otherUnits = r.units_selected.filter(
              (u) => u !== unitId,
            ).length;
            return (
              <div
                key={r.id}
                className={`border rounded p-3 ${
                  isLocked
                    ? "border-amber-400 bg-amber-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-slate-900 truncate">
                      {fullName}
                    </div>
                    <div className="text-xs text-slate-600 truncate">
                      <a href={`mailto:${r.email}`} className="hover:underline">
                        {r.email}
                      </a>
                      {r.phone && (
                        <>
                          {" · "}
                          <a href={`tel:${r.phone}`} className="hover:underline">
                            {r.phone}
                          </a>
                        </>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Registered {formatDate(r.created_at)}
                      {otherUnits > 0 &&
                        ` · also interested in ${otherUnits} other home${
                          otherUnits > 1 ? "s" : ""
                        }`}
                    </div>
                  </div>
                  <button
                    onClick={() => removeInterest(r)}
                    disabled={isActing}
                    className="text-[11px] text-slate-400 hover:text-red-600 disabled:opacity-50 whitespace-nowrap"
                    title="Remove this buyer's interest in this home"
                  >
                    {isActing ? "…" : "Remove"}
                  </button>
                </div>

                {(r.buyer_type ||
                  r.purchase_timeline ||
                  r.finance_status ||
                  (r.price_preferences && r.price_preferences[unitId])) && (
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-slate-700">
                    {r.buyer_type && (
                      <div>
                        <span className="text-slate-500">Buyer:</span>{" "}
                        {r.buyer_type}
                      </div>
                    )}
                    {r.buyer_profile && (
                      <div>
                        <span className="text-slate-500">Profile:</span>{" "}
                        {r.buyer_profile}
                      </div>
                    )}
                    {r.purchase_timeline && (
                      <div>
                        <span className="text-slate-500">Timeline:</span>{" "}
                        {r.purchase_timeline}
                      </div>
                    )}
                    {r.finance_status && (
                      <div>
                        <span className="text-slate-500">Finance:</span>{" "}
                        {r.finance_status}
                      </div>
                    )}
                    {r.price_preferences && r.price_preferences[unitId] && (
                      <div className="col-span-2">
                        <span className="text-slate-500">Price expectation:</span>{" "}
                        <span className="font-semibold text-emerald-700">
                          {r.price_preferences[unitId]}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {r.notes && (
                  <div className="mt-2 text-[11px] text-slate-600 italic">
                    &ldquo;{r.notes}&rdquo;
                  </div>
                )}

                {agents.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-[11px] text-slate-500 whitespace-nowrap">
                      Credit to agent
                    </label>
                    <select
                      value={r.agent_id ?? ""}
                      disabled={assigningId === r.id}
                      onChange={(e) =>
                        assignAgent(r.id, e.target.value || null)
                      }
                      className="text-xs border border-slate-300 rounded px-2 py-1 flex-1 min-w-0 disabled:opacity-50"
                      title="Credit this buyer to an agent — they appear in that agent's My Clients. Applies to this buyer across Branscombe."
                    >
                      <option value="">— Unassigned —</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                          {a.agency ? ` (${a.agency})` : ""}
                        </option>
                      ))}
                    </select>
                    {assigningId === r.id && (
                      <span className="text-[11px] text-slate-400">Saving…</span>
                    )}
                  </div>
                )}

                {!isLocked && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => lockTo(r)}
                      disabled={isActing}
                      className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 font-medium px-2.5 py-1 rounded disabled:opacity-50"
                    >
                      {isActing ? "Locking…" : "Lock as priority lead"}
                    </button>
                    <button
                      onClick={() => convertToAllocation(r)}
                      disabled={isActing}
                      className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-900 font-medium px-2.5 py-1 rounded disabled:opacity-50"
                    >
                      {isActing ? "Converting…" : "Allocate firmly"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
