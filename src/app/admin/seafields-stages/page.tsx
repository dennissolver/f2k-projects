"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface Stage {
  id: string;
  stage_number: number;
  stage_label: string;
  rate_per_sqm: number | null;
  escalation_pct: number | null;
  is_open_for_registration: boolean;
  auto_advance_threshold_pct: number;
  public_visible: boolean;
  updated_at: string;
}

type Draft = {
  stage_label: string;
  rate_per_sqm: string;
  is_open_for_registration: boolean;
  auto_advance_threshold_pct: string;
  public_visible: boolean;
};

const MATERIAL_KEYS = new Set<keyof Draft>([
  "rate_per_sqm",
  "is_open_for_registration",
  "auto_advance_threshold_pct",
  "public_visible",
]);

function toDraft(s: Stage): Draft {
  return {
    stage_label: s.stage_label,
    rate_per_sqm: s.rate_per_sqm == null ? "" : String(s.rate_per_sqm),
    is_open_for_registration: s.is_open_for_registration,
    auto_advance_threshold_pct: String(s.auto_advance_threshold_pct),
    public_visible: s.public_visible,
  };
}

function fmtAUD(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export default function SeafieldsStagesPage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchStages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/seafields/stages");
      if (!res.ok) {
        setMessage({ type: "error", text: "Failed to load stages" });
        return;
      }
      const data = await res.json();
      setStages(data.stages ?? []);
    } catch {
      setMessage({ type: "error", text: "Network error loading stages" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStages();
  }, [fetchStages]);

  function startEdit(s: Stage) {
    setEditing(s.id);
    setDrafts((prev) => ({ ...prev, [s.id]: toDraft(s) }));
    setReasons((prev) => ({ ...prev, [s.id]: "" }));
  }

  function cancelEdit() {
    setEditing(null);
  }

  function setDraft<K extends keyof Draft>(
    id: string,
    key: K,
    value: Draft[K],
  ) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }));
  }

  function diffFor(id: string): Partial<Draft> & {
    touchesMaterial: boolean;
  } {
    const s = stages.find((x) => x.id === id);
    const d = drafts[id];
    if (!s || !d) return { touchesMaterial: false };
    const out: Partial<Draft> = {};
    let touchesMaterial = false;
    const cur = toDraft(s);
    (Object.keys(d) as (keyof Draft)[]).forEach((k) => {
      if (d[k] !== cur[k]) {
        (out as Record<keyof Draft, Draft[keyof Draft]>)[k] = d[k];
        if (MATERIAL_KEYS.has(k)) touchesMaterial = true;
      }
    });
    return { ...out, touchesMaterial };
  }

  async function save(id: string) {
    const d = drafts[id];
    if (!d) return;
    const diff = diffFor(id);
    const { touchesMaterial, ...changes } = diff;
    if (Object.keys(changes).length === 0) {
      setMessage({ type: "error", text: "No changes to save." });
      return;
    }
    const reason = reasons[id]?.trim() ?? "";
    if (touchesMaterial && reason.length < 10) {
      setMessage({
        type: "error",
        text: "A reason (≥10 chars) is required when changing rate, registration status, advance threshold, or public visibility.",
      });
      return;
    }

    setSaving(id);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {};
      if ("stage_label" in changes) payload.stage_label = changes.stage_label;
      if ("rate_per_sqm" in changes) {
        payload.rate_per_sqm =
          changes.rate_per_sqm === "" ? null : Number(changes.rate_per_sqm);
      }
      if ("is_open_for_registration" in changes)
        payload.is_open_for_registration = changes.is_open_for_registration;
      if ("auto_advance_threshold_pct" in changes) {
        payload.auto_advance_threshold_pct = Number(
          changes.auto_advance_threshold_pct,
        );
      }
      if ("public_visible" in changes)
        payload.public_visible = changes.public_visible;
      if (touchesMaterial) payload.reason = reason;

      const res = await fetch(`/api/admin/seafields/stages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Save failed" });
        return;
      }
      // Patch the stage in state with the fresh row.
      setStages((prev) =>
        prev.map((x) => (x.id === id ? (data.stage as Stage) : x)),
      );
      setEditing(null);
      setMessage({
        type: "success",
        text: `Stage ${data.stage.stage_number} updated.`,
      });
    } catch {
      setMessage({ type: "error", text: "Network error during save" });
    } finally {
      setSaving(null);
    }
  }

  const openCount = useMemo(
    () => stages.filter((s) => s.is_open_for_registration).length,
    [stages],
  );

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">
        Seafields Stages
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        Release ladder for Seafields Estate. Edit a stage to set $/m², open
        or lock registration, tune the auto-advance threshold, or toggle
        public visibility. Changes to rate, gating, threshold, or visibility
        require a reason — captured in the audit log.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Total stages
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {stages.length}
          </div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Open for registration
          </div>
          <div className="text-2xl font-bold text-emerald-700">
            {openCount}
          </div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Rates set
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {stages.filter((s) => s.rate_per_sqm != null).length} /{" "}
            {stages.length}
          </div>
        </div>
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

      <div className="bg-white border rounded overflow-hidden">
        {loading ? (
          <div className="p-6 text-slate-500">Loading stages…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Label</th>
                <th className="px-3 py-2 text-right">$/m²</th>
                <th className="px-3 py-2 text-right">Escalation</th>
                <th className="px-3 py-2 text-center">Open</th>
                <th className="px-3 py-2 text-right">Threshold</th>
                <th className="px-3 py-2 text-center">Public</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s) => {
                const isEditing = editing === s.id;
                const d = drafts[s.id];
                const diff = isEditing ? diffFor(s.id) : { touchesMaterial: false };
                return (
                  <RowFragment
                    key={s.id}
                    stage={s}
                    isEditing={isEditing}
                    draft={d}
                    touchesMaterial={diff.touchesMaterial}
                    reason={reasons[s.id] ?? ""}
                    saving={saving === s.id}
                    onStartEdit={() => startEdit(s)}
                    onCancel={cancelEdit}
                    onSave={() => save(s.id)}
                    onSetDraft={(k, v) => setDraft(s.id, k, v)}
                    onSetReason={(v) =>
                      setReasons((prev) => ({ ...prev, [s.id]: v }))
                    }
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Stage 1 should be the only stage open at launch. Stages 2–7 stay
        locked until the auto-advance threshold (default 80% of public-pool
        lots Reserved + Sold) tips Stage 2 open — at which point
        registrants get a price-protection notification.
      </p>
    </div>
  );
}

function RowFragment(props: {
  stage: Stage;
  isEditing: boolean;
  draft: Draft | undefined;
  touchesMaterial: boolean;
  reason: string;
  saving: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onSetDraft: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
  onSetReason: (v: string) => void;
}) {
  const {
    stage: s,
    isEditing,
    draft: d,
    touchesMaterial,
    reason,
    saving,
    onStartEdit,
    onCancel,
    onSave,
    onSetDraft,
    onSetReason,
  } = props;

  if (!isEditing || !d) {
    return (
      <tr className="border-t hover:bg-slate-50">
        <td className="px-3 py-2 font-semibold">{s.stage_number}</td>
        <td className="px-3 py-2">{s.stage_label}</td>
        <td className="px-3 py-2 text-right">
          {s.rate_per_sqm != null ? fmtAUD(s.rate_per_sqm) : "—"}
        </td>
        <td className="px-3 py-2 text-right text-slate-600">
          {fmtPct(s.escalation_pct)}
        </td>
        <td className="px-3 py-2 text-center">
          {s.is_open_for_registration ? (
            <span className="inline-block bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs font-semibold">
              OPEN
            </span>
          ) : (
            <span className="inline-block bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-semibold">
              locked
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-right">
          {s.auto_advance_threshold_pct}%
        </td>
        <td className="px-3 py-2 text-center">
          {s.public_visible ? "✓" : "—"}
        </td>
        <td className="px-3 py-2 text-right">
          <button
            type="button"
            onClick={onStartEdit}
            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
          >
            Edit
          </button>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="border-t bg-blue-50/30">
        <td className="px-3 py-2 font-semibold align-top">{s.stage_number}</td>
        <td className="px-3 py-2">
          <input
            type="text"
            value={d.stage_label}
            onChange={(e) => onSetDraft("stage_label", e.target.value)}
            className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
          />
        </td>
        <td className="px-3 py-2 text-right">
          <input
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            value={d.rate_per_sqm}
            onChange={(e) => onSetDraft("rate_per_sqm", e.target.value)}
            placeholder="—"
            className="w-28 border border-slate-300 rounded px-2 py-1 text-sm text-right"
          />
        </td>
        <td className="px-3 py-2 text-right text-slate-400 text-xs italic">
          (recomputed)
        </td>
        <td className="px-3 py-2 text-center">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={d.is_open_for_registration}
              onChange={(e) =>
                onSetDraft("is_open_for_registration", e.target.checked)
              }
              className="h-4 w-4"
            />
          </label>
        </td>
        <td className="px-3 py-2 text-right">
          <input
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            max="100"
            value={d.auto_advance_threshold_pct}
            onChange={(e) =>
              onSetDraft("auto_advance_threshold_pct", e.target.value)
            }
            className="w-20 border border-slate-300 rounded px-2 py-1 text-sm text-right"
          />
          <span className="ml-1 text-xs text-slate-500">%</span>
        </td>
        <td className="px-3 py-2 text-center">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={d.public_visible}
              onChange={(e) => onSetDraft("public_visible", e.target.checked)}
              className="h-4 w-4"
            />
          </label>
        </td>
        <td className="px-3 py-2 text-right whitespace-nowrap">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="bg-slate-900 hover:bg-slate-700 text-white px-3 py-1 rounded text-xs font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="ml-2 text-slate-600 hover:text-slate-900 text-xs disabled:opacity-50"
          >
            Cancel
          </button>
        </td>
      </tr>
      {touchesMaterial && (
        <tr className="bg-blue-50/30">
          <td colSpan={8} className="px-3 py-2 pt-0">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Reason for change (required, ≥10 chars)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => onSetReason(e.target.value)}
              placeholder="e.g. opening Stage 2 after Stage 1 hit 82% allocation threshold"
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Required because this change affects rate, registration
              gating, advance threshold, or public visibility. Stored in
              the audit log with your email and timestamp.
            </p>
          </td>
        </tr>
      )}
    </>
  );
}
