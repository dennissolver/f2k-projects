"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface DwellingType {
  id: string;
  code: string;
  plan_name: string;
  bedrooms: number | null;
  bathrooms: number | null;
  floor_area_sqm: number | null;
  build_cost_default: number | null;
  display_label: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type Draft = {
  code: string;
  plan_name: string;
  bedrooms: string;
  bathrooms: string;
  floor_area_sqm: string;
  build_cost_default: string;
  display_label: string;
  notes: string;
  is_active: boolean;
};

const EMPTY_DRAFT: Draft = {
  code: "",
  plan_name: "",
  bedrooms: "",
  bathrooms: "",
  floor_area_sqm: "",
  build_cost_default: "",
  display_label: "",
  notes: "",
  is_active: true,
};

function toDraft(d: DwellingType): Draft {
  return {
    code: d.code,
    plan_name: d.plan_name,
    bedrooms: d.bedrooms == null ? "" : String(d.bedrooms),
    bathrooms: d.bathrooms == null ? "" : String(d.bathrooms),
    floor_area_sqm: d.floor_area_sqm == null ? "" : String(d.floor_area_sqm),
    build_cost_default:
      d.build_cost_default == null ? "" : String(d.build_cost_default),
    display_label: d.display_label ?? "",
    notes: d.notes ?? "",
    is_active: d.is_active,
  };
}

function draftToPayload(d: Draft, isCreate: boolean): Record<string, unknown> {
  const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
  const strOrNull = (s: string) => (s.trim() === "" ? null : s.trim());
  const payload: Record<string, unknown> = {
    code: d.code.trim(),
    plan_name: d.plan_name.trim(),
    bedrooms: numOrNull(d.bedrooms),
    bathrooms: numOrNull(d.bathrooms),
    floor_area_sqm: numOrNull(d.floor_area_sqm),
    build_cost_default: numOrNull(d.build_cost_default),
    display_label: strOrNull(d.display_label),
    notes: strOrNull(d.notes),
    is_active: d.is_active,
  };
  if (!isCreate) {
    // On update, omit blank strings that should clear to null vs keep — keep
    // explicit null for cleared inputs. Code can't be blank either way.
  }
  return payload;
}

function fmtAUD(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function SeafieldsDwellingTypesPage() {
  const [items, setItems] = useState<DwellingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/seafields/dwelling-types");
      if (!res.ok) {
        setMessage({ type: "error", text: "Failed to load dwelling types" });
        return;
      }
      const data = await res.json();
      setItems(data.dwelling_types ?? []);
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function startEdit(d: DwellingType) {
    setEditing(d.id);
    setDrafts((prev) => ({ ...prev, [d.id]: toDraft(d) }));
  }

  function cancelEdit() {
    setEditing(null);
  }

  function setDraft<K extends keyof Draft>(id: string, key: K, value: Draft[K]) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }));
  }

  async function saveEdit(id: string) {
    const d = drafts[id];
    if (!d) return;
    if (d.code.trim() === "" || d.plan_name.trim() === "") {
      setMessage({ type: "error", text: "Code and Plan name are required." });
      return;
    }
    setSaving(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/seafields/dwelling-types/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToPayload(d, false)),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Save failed" });
        return;
      }
      setItems((prev) =>
        prev.map((x) => (x.id === id ? (data.dwelling_type as DwellingType) : x)),
      );
      setEditing(null);
      setMessage({
        type: "success",
        text: `Updated ${data.dwelling_type.code}.`,
      });
    } catch {
      setMessage({ type: "error", text: "Network error during save" });
    } finally {
      setSaving(null);
    }
  }

  async function saveCreate() {
    if (createDraft.code.trim() === "" || createDraft.plan_name.trim() === "") {
      setMessage({ type: "error", text: "Code and Plan name are required." });
      return;
    }
    setSaving("__create__");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/seafields/dwelling-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToPayload(createDraft, true)),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Create failed" });
        return;
      }
      setItems((prev) =>
        [...prev, data.dwelling_type as DwellingType].sort((a, b) =>
          a.code.localeCompare(b.code),
        ),
      );
      setCreating(false);
      setCreateDraft(EMPTY_DRAFT);
      setMessage({
        type: "success",
        text: `Created ${data.dwelling_type.code}.`,
      });
    } catch {
      setMessage({ type: "error", text: "Network error during create" });
    } finally {
      setSaving(null);
    }
  }

  async function toggleActive(d: DwellingType) {
    setSaving(d.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/seafields/dwelling-types/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !d.is_active }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Toggle failed" });
        return;
      }
      setItems((prev) =>
        prev.map((x) => (x.id === d.id ? (data.dwelling_type as DwellingType) : x)),
      );
      setMessage({
        type: "success",
        text: `${data.dwelling_type.code} ${data.dwelling_type.is_active ? "activated" : "deactivated"}.`,
      });
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(null);
    }
  }

  const visible = useMemo(
    () => (showInactive ? items : items.filter((x) => x.is_active)),
    [items, showInactive],
  );
  const activeCount = useMemo(
    () => items.filter((x) => x.is_active).length,
    [items],
  );

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">
        Seafields Dwelling Types
      </h2>
      <p className="text-sm text-slate-500 mb-6 max-w-3xl">
        Catalogue of house plans available for House+Land packages on the
        Seafields estate. Each lot can reference one dwelling type via its FK.
        Codes are stable identifiers; soft-delete via the active toggle keeps
        historical lot references intact.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Total dwelling types
          </div>
          <div className="text-2xl font-bold text-slate-900">{items.length}</div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Active
          </div>
          <div className="text-2xl font-bold text-emerald-700">
            {activeCount}
          </div>
        </div>
        <div className="bg-white border rounded p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Show inactive
            </div>
            <div className="text-sm text-slate-600">
              {showInactive ? "Visible" : "Hidden"}
            </div>
          </div>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-5 w-5"
          />
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setCreateDraft(EMPTY_DRAFT);
          }}
          disabled={creating}
          className="bg-slate-900 hover:bg-slate-700 text-white px-3 py-2 rounded text-sm font-semibold disabled:opacity-50"
        >
          + New dwelling type
        </button>
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
          <div className="p-6 text-slate-500">Loading dwelling types…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Plan name</th>
                <th className="px-3 py-2 text-right">Beds</th>
                <th className="px-3 py-2 text-right">Baths</th>
                <th className="px-3 py-2 text-right">Floor m²</th>
                <th className="px-3 py-2 text-right">Build cost</th>
                <th className="px-3 py-2 text-left">Display label</th>
                <th className="px-3 py-2 text-center">Active</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {creating && (
                <CreateRow
                  draft={createDraft}
                  saving={saving === "__create__"}
                  onSetDraft={(k, v) =>
                    setCreateDraft((prev) => ({ ...prev, [k]: v }))
                  }
                  onSave={saveCreate}
                  onCancel={() => {
                    setCreating(false);
                    setCreateDraft(EMPTY_DRAFT);
                  }}
                />
              )}
              {visible.length === 0 && !creating ? (
                <tr>
                  <td
                    colSpan={9}
                    className="p-6 text-center text-slate-500 italic"
                  >
                    {showInactive
                      ? "No dwelling types yet."
                      : "No active dwelling types. Toggle 'Show inactive' or create one."}
                  </td>
                </tr>
              ) : (
                visible.map((d) => (
                  <RowFragment
                    key={d.id}
                    item={d}
                    isEditing={editing === d.id}
                    draft={drafts[d.id]}
                    saving={saving === d.id}
                    onStartEdit={() => startEdit(d)}
                    onCancel={cancelEdit}
                    onSave={() => saveEdit(d.id)}
                    onSetDraft={(k, v) => setDraft(d.id, k, v)}
                    onToggleActive={() => toggleActive(d)}
                  />
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Codes seen post Phase 4.2 V2 merge: <code>2x2BR-ADU</code>,{" "}
        <code>3BR-MOD</code>, <code>3BR-STU-MOD</code>, <code>4BR-MOD</code>,{" "}
        <code>4BR-THE-MOD</code>, <code>5BR-MOD</code>, <code>DUAL-OCC</code>{" "}
        (legacy seed) + <code>GROH-3B</code>, <code>GROH-4B</code>,{" "}
        <code>BAU-3B</code>, <code>DISP-4B</code>, <code>PUB-3B</code>,{" "}
        <code>PUB-4B</code> (workbook). Tanveer & Uwe update via the workbook;
        admin CRUD here is for inline corrections.
      </p>
    </div>
  );
}

function RowFragment(props: {
  item: DwellingType;
  isEditing: boolean;
  draft: Draft | undefined;
  saving: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onSetDraft: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
  onToggleActive: () => void;
}) {
  const {
    item: d,
    isEditing,
    draft,
    saving,
    onStartEdit,
    onCancel,
    onSave,
    onSetDraft,
    onToggleActive,
  } = props;

  if (!isEditing || !draft) {
    return (
      <tr className={`border-t hover:bg-slate-50 ${!d.is_active ? "opacity-50" : ""}`}>
        <td className="px-3 py-2 font-mono text-xs">{d.code}</td>
        <td className="px-3 py-2">{d.plan_name}</td>
        <td className="px-3 py-2 text-right">{d.bedrooms ?? "—"}</td>
        <td className="px-3 py-2 text-right">{d.bathrooms ?? "—"}</td>
        <td className="px-3 py-2 text-right">{d.floor_area_sqm ?? "—"}</td>
        <td className="px-3 py-2 text-right">{fmtAUD(d.build_cost_default)}</td>
        <td className="px-3 py-2 text-slate-600">{d.display_label ?? "—"}</td>
        <td className="px-3 py-2 text-center">
          {d.is_active ? (
            <span className="inline-block bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs font-semibold">
              ACTIVE
            </span>
          ) : (
            <span className="inline-block bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-semibold">
              inactive
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-right whitespace-nowrap">
          <button
            type="button"
            onClick={onStartEdit}
            disabled={saving}
            className="text-blue-600 hover:text-blue-800 text-xs font-medium disabled:opacity-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onToggleActive}
            disabled={saving}
            className="ml-3 text-slate-500 hover:text-slate-800 text-xs font-medium disabled:opacity-50"
          >
            {d.is_active ? "Deactivate" : "Reactivate"}
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t bg-blue-50/30 align-top">
      <td className="px-3 py-2">
        <input
          type="text"
          value={draft.code}
          onChange={(e) => onSetDraft("code", e.target.value)}
          className="w-28 border border-slate-300 rounded px-2 py-1 text-sm font-mono"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={draft.plan_name}
          onChange={(e) => onSetDraft("plan_name", e.target.value)}
          className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          min="0"
          step="1"
          value={draft.bedrooms}
          onChange={(e) => onSetDraft("bedrooms", e.target.value)}
          className="w-16 border border-slate-300 rounded px-2 py-1 text-sm text-right"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          min="0"
          step="1"
          value={draft.bathrooms}
          onChange={(e) => onSetDraft("bathrooms", e.target.value)}
          className="w-16 border border-slate-300 rounded px-2 py-1 text-sm text-right"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          min="0"
          step="0.01"
          value={draft.floor_area_sqm}
          onChange={(e) => onSetDraft("floor_area_sqm", e.target.value)}
          className="w-20 border border-slate-300 rounded px-2 py-1 text-sm text-right"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          min="0"
          step="1"
          value={draft.build_cost_default}
          onChange={(e) => onSetDraft("build_cost_default", e.target.value)}
          className="w-28 border border-slate-300 rounded px-2 py-1 text-sm text-right"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={draft.display_label}
          onChange={(e) => onSetDraft("display_label", e.target.value)}
          className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={draft.is_active}
          onChange={(e) => onSetDraft("is_active", e.target.checked)}
          className="h-4 w-4"
        />
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
  );
}

function CreateRow(props: {
  draft: Draft;
  saving: boolean;
  onSetDraft: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { draft, saving, onSetDraft, onSave, onCancel } = props;
  return (
    <tr className="border-t bg-emerald-50/40 align-top">
      <td className="px-3 py-2">
        <input
          type="text"
          value={draft.code}
          onChange={(e) => onSetDraft("code", e.target.value)}
          placeholder="e.g. NEW-3B"
          className="w-28 border border-slate-300 rounded px-2 py-1 text-sm font-mono"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={draft.plan_name}
          onChange={(e) => onSetDraft("plan_name", e.target.value)}
          placeholder="e.g. 3-bed Custom Plan"
          className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          min="0"
          step="1"
          value={draft.bedrooms}
          onChange={(e) => onSetDraft("bedrooms", e.target.value)}
          className="w-16 border border-slate-300 rounded px-2 py-1 text-sm text-right"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          min="0"
          step="1"
          value={draft.bathrooms}
          onChange={(e) => onSetDraft("bathrooms", e.target.value)}
          className="w-16 border border-slate-300 rounded px-2 py-1 text-sm text-right"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          min="0"
          step="0.01"
          value={draft.floor_area_sqm}
          onChange={(e) => onSetDraft("floor_area_sqm", e.target.value)}
          className="w-20 border border-slate-300 rounded px-2 py-1 text-sm text-right"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          min="0"
          step="1"
          value={draft.build_cost_default}
          onChange={(e) => onSetDraft("build_cost_default", e.target.value)}
          className="w-28 border border-slate-300 rounded px-2 py-1 text-sm text-right"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={draft.display_label}
          onChange={(e) => onSetDraft("display_label", e.target.value)}
          className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={draft.is_active}
          onChange={(e) => onSetDraft("is_active", e.target.checked)}
          className="h-4 w-4"
        />
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1 rounded text-xs font-semibold disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create"}
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
  );
}
