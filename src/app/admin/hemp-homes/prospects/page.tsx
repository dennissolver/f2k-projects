"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AUS_STATES,
  HEMP_HOMES_PROSPECT_STATUSES,
  type AusState,
  type HempHomesPricingAssumptions,
  type HempHomesProspect,
  type HempHomesProspectStatus,
} from "@/lib/hemp-homes/types";

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(Number(n));
}

function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-AU").format(Math.round(Number(n)));
}

function StatusBadge({ status }: { status: HempHomesProspectStatus }) {
  const map: Record<HempHomesProspectStatus, string> = {
    researched: "bg-slate-100 text-slate-700",
    outreach_sent: "bg-amber-100 text-amber-800",
    in_conversation: "bg-blue-100 text-blue-800",
    committed: "bg-emerald-100 text-emerald-800",
    declined: "bg-red-100 text-red-700",
    paused: "bg-slate-200 text-slate-600",
  };
  const label = HEMP_HOMES_PROSPECT_STATUSES.find((s) => s.value === status)?.label ?? status;
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${map[status]}`}>{label}</span>;
}

function WaveBadge({ wave }: { wave: number | null }) {
  if (wave == null) return <span className="text-xs text-slate-400">—</span>;
  const map: Record<number, string> = {
    1: "bg-emerald-600 text-white",
    2: "bg-blue-600 text-white",
    3: "bg-slate-500 text-white",
  };
  return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${map[wave]}`}>W{wave}</span>;
}

type Filters = {
  wave: "all" | "1" | "2" | "3";
  status: "all" | HempHomesProspectStatus;
  state: "all" | AusState;
  source: "all" | "workbook" | "llm_research" | "manual" | "inbound";
};

export default function HempHomesProspectsPage() {
  const [prospects, setProspects] = useState<HempHomesProspect[]>([]);
  const [assumptions, setAssumptions] = useState<HempHomesPricingAssumptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<HempHomesProspect | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [filters, setFilters] = useState<Filters>({
    wave: "all",
    status: "all",
    state: "all",
    source: "all",
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, aRes] = await Promise.all([
        fetch("/api/admin/hemp-homes/prospects"),
        fetch("/api/admin/hemp-homes/pricing"),
      ]);
      if (pRes.ok) {
        const pd = await pRes.json();
        setProspects(pd.prospects ?? []);
      } else {
        setMessage({ type: "error", text: "Failed to load prospects" });
      }
      if (aRes.ok) {
        const ad = await aRes.json();
        setAssumptions(ad.assumptions);
      }
    } catch {
      setMessage({ type: "error", text: "Network error loading data" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filtered = useMemo(() => {
    return prospects.filter((p) => {
      if (filters.wave !== "all" && String(p.wave ?? "") !== filters.wave) return false;
      if (filters.status !== "all" && p.status !== filters.status) return false;
      if (filters.state !== "all" && p.state !== filters.state) return false;
      if (filters.source !== "all" && p.source !== filters.source) return false;
      return true;
    });
  }, [prospects, filters]);

  const totals = useMemo(() => {
    const t = {
      count: filtered.length,
      lots: 0,
      conservative: 0,
      base: 0,
      optimistic: 0,
    };
    for (const p of filtered) {
      t.lots += p.indicative_lot_potential ?? 0;
      t.conservative += Number(p.conservative_revenue ?? 0);
      t.base += Number(p.base_revenue ?? 0);
      t.optimistic += Number(p.optimistic_revenue ?? 0);
    }
    return t;
  }, [filtered]);

  async function patchProspect(p: HempHomesProspect, body: Record<string, unknown>, label: string) {
    setBusyId(p.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/hemp-homes/prospects/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? `${label} failed` });
        return false;
      }
      setMessage({ type: "success", text: `${label} saved.` });
      fetchAll();
      return true;
    } catch {
      setMessage({ type: "error", text: "Network error" });
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function draftOutreach(p: HempHomesProspect) {
    // Wave-matched template selection.
    const templateSlug =
      p.wave === 2 ? "intro-wave2-engaged" :
      p.wave === 3 ? "intro-wave3-cold" :
      null;
    if (!templateSlug) {
      setMessage({ type: "error", text: `No matching template for wave ${p.wave ?? "?"}. Open Outreach Templates to add one.` });
      return;
    }
    if ((p.contact_emails ?? []).length === 0) {
      setMessage({ type: "error", text: "No contact emails on this prospect — add one first." });
      return;
    }
    if (!confirm(`Generate ${templateSlug} draft for ${p.name}? Will appear in the Outreach Queue for review.`)) return;
    setBusyId(p.id);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/hemp-homes/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospect_id: p.id, template_slug: templateSlug }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Draft failed" });
        return;
      }
      setMessage({
        type: "success",
        text: `Draft created for ${p.name}. Open the Outreach Queue to review.`,
      });
      fetchAll();
    } finally {
      setBusyId(null);
    }
  }

  async function deleteProspect(p: HempHomesProspect) {
    if (!confirm(`Delete "${p.name}"? Cannot be undone.`)) return;
    setBusyId(p.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/hemp-homes/prospects/${p.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: d.error ?? "Delete failed" });
        return;
      }
      setMessage({ type: "success", text: `Deleted ${p.name}.` });
      fetchAll();
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const ok = await patchProspect(
      editing,
      {
        name: editing.name,
        location: editing.location,
        region: editing.region,
        state: editing.state,
        wave: editing.wave,
        status: editing.status,
        website_url: editing.website_url,
        land_size_acres: editing.land_size_acres,
        current_members: editing.current_members,
        indicative_lot_potential: editing.indicative_lot_potential,
        source_basis: editing.source_basis,
        source_url: editing.source_url,
        is_public_safe: editing.is_public_safe,
        notes: editing.notes,
        next_action: editing.next_action,
        contact_emails: editing.contact_emails,
        contact_form_url: editing.contact_form_url,
        contact_phone: editing.contact_phone,
        contact_discovery_notes: editing.contact_discovery_notes,
      },
      "Edit",
    );
    if (ok) setEditing(null);
  }

  async function saveAssumptions(patch: Partial<HempHomesPricingAssumptions>) {
    setBusyId("assumptions");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/hemp-homes/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Failed to save" });
        return;
      }
      setAssumptions(data.assumptions);
      setMessage({ type: "success", text: "Pricing assumptions saved — revenue updated." });
      fetchAll();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Community Prospects</h2>
        <p className="text-sm text-slate-500 max-w-3xl">
          Eco-village and intentional-community pipeline for the Joey60 Hemp Edition.
          Edit lot estimates and pricing to flex the revenue model; flip a row to
          public-safe only with the community&apos;s consent. All figures here are
          INDICATIVE per the V1 workbook caveats — not for external commitments
          pre-AFSL.
        </p>
      </div>

      {message && (
        <div
          className={`p-3 rounded text-sm ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Pricing assumptions */}
      {assumptions && (
        <div className="bg-white border rounded-lg p-5">
          <h3 className="font-semibold text-slate-900 mb-3">Pricing assumptions</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
            <AssumptionField
              label="Low $"
              value={assumptions.price_low}
              onSave={(v) => saveAssumptions({ price_low: v })}
              isMoney
            />
            <AssumptionField
              label="Mid $"
              value={assumptions.price_mid}
              onSave={(v) => saveAssumptions({ price_mid: v })}
              isMoney
              highlight
            />
            <AssumptionField
              label="High $"
              value={assumptions.price_high}
              onSave={(v) => saveAssumptions({ price_high: v })}
              isMoney
            />
            <AssumptionField
              label="Conservative %"
              value={assumptions.capture_conservative * 100}
              onSave={(v) => saveAssumptions({ capture_conservative: v / 100 })}
              isPercent
            />
            <AssumptionField
              label="Base %"
              value={assumptions.capture_base * 100}
              onSave={(v) => saveAssumptions({ capture_base: v / 100 })}
              isPercent
              highlight
            />
            <AssumptionField
              label="Optimistic %"
              value={assumptions.capture_optimistic * 100}
              onSave={(v) => saveAssumptions({ capture_optimistic: v / 100 })}
              isPercent
            />
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Revenue is computed as <code className="text-[0.7rem]">lots × capture rate × mid price</code>.
            Edit mid pricing or any capture rate to instantly reflow every row below.
          </p>
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Tile label="Prospects" value={fmtInt(totals.count)} subline={`${prospects.length} total`} />
        <Tile label="Indicative lots" value={fmtInt(totals.lots)} subline="filtered view" />
        <Tile label="Conservative" value={fmtMoney(totals.conservative)} subline="15% capture × mid" muted />
        <Tile label="Base case" value={fmtMoney(totals.base)} subline="30% capture × mid" highlight />
        <Tile label="Optimistic" value={fmtMoney(totals.optimistic)} subline="50% capture × mid" muted />
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4 flex flex-wrap items-center gap-3 text-sm">
        <FilterSelect label="Wave" value={filters.wave} onChange={(v) => setFilters({ ...filters, wave: v as Filters["wave"] })}
          options={[{ v: "all", l: "All" }, { v: "1", l: "Wave 1" }, { v: "2", l: "Wave 2" }, { v: "3", l: "Wave 3" }]} />
        <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilters({ ...filters, status: v as Filters["status"] })}
          options={[{ v: "all", l: "All" }, ...HEMP_HOMES_PROSPECT_STATUSES.map((s) => ({ v: s.value, l: s.label }))]} />
        <FilterSelect label="State" value={filters.state} onChange={(v) => setFilters({ ...filters, state: v as Filters["state"] })}
          options={[{ v: "all", l: "All" }, ...AUS_STATES.map((s) => ({ v: s.value, l: s.label }))]} />
        <FilterSelect label="Source" value={filters.source} onChange={(v) => setFilters({ ...filters, source: v as Filters["source"] })}
          options={[
            { v: "all", l: "All" },
            { v: "workbook", l: "Workbook" },
            { v: "llm_research", l: "LLM research" },
            { v: "manual", l: "Manual" },
            { v: "inbound", l: "Inbound" },
          ]} />
        <div className="ml-auto text-xs text-slate-500">
          Showing {filtered.length} of {prospects.length}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-slate-500">Loading prospects…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-slate-500">No prospects match the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Wave</th>
                  <th className="px-3 py-2 text-left">Community</th>
                  <th className="px-3 py-2 text-left">State</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Acres</th>
                  <th className="px-3 py-2 text-right">Members</th>
                  <th className="px-3 py-2 text-right">Lots</th>
                  <th className="px-3 py-2 text-right">Base $</th>
                  <th className="px-3 py-2 text-left">Contact</th>
                  <th className="px-3 py-2 text-center">Public-safe</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-slate-50 align-top">
                    <td className="px-3 py-2"><WaveBadge wave={p.wave} /></td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.location ?? "—"}</div>
                      {p.website_url && (
                        <a href={p.website_url} target="_blank" rel="noopener noreferrer" className="text-[0.65rem] text-blue-600 hover:underline">
                          {p.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono">{p.state ?? "—"}</td>
                    <td className="px-3 py-2"><StatusBadge status={p.status} /></td>
                    <td className="px-3 py-2 text-right text-xs">{fmtInt(p.land_size_acres)}</td>
                    <td className="px-3 py-2 text-right text-xs">{fmtInt(p.current_members)}</td>
                    <td className="px-3 py-2 text-right text-xs font-semibold">{fmtInt(p.indicative_lot_potential)}</td>
                    <td className="px-3 py-2 text-right text-xs font-mono">{fmtMoney(p.base_revenue)}</td>
                    <td className="px-3 py-2">
                      <ContactSummary p={p} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => patchProspect(p, { is_public_safe: !p.is_public_safe }, p.is_public_safe ? "Hide from public" : "Allow public mention")}
                        className={`text-xs px-2 py-0.5 rounded font-semibold disabled:opacity-50 ${
                          p.is_public_safe
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                        title={p.is_public_safe ? "Public-safe ON — community has consented to mention" : "Internal-only (default)"}
                      >
                        {p.is_public_safe ? "Public" : "Private"}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => draftOutreach(p)}
                        className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold disabled:opacity-50"
                        title={p.wave ? `Generate wave-${p.wave} intro draft` : "No template for this wave"}
                      >
                        {busyId === p.id ? "…" : "Draft"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => setEditing(p)}
                        className="text-xs text-slate-700 hover:text-slate-900 font-semibold disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => deleteProspect(p)}
                        className="text-xs text-red-600 hover:text-red-800 font-semibold disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-slate-50 font-semibold">
                  <td className="px-3 py-2" colSpan={6}>Totals (filtered)</td>
                  <td className="px-3 py-2 text-right">{fmtInt(totals.lots)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoney(totals.base)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-10 px-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Edit prospect</h3>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-500 hover:text-slate-900 text-sm">Close</button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <Field label="Name">
                <input type="text" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-2" />
              </Field>
              <Field label="Website">
                <input type="text" value={editing.website_url ?? ""} onChange={(e) => setEditing({ ...editing, website_url: e.target.value || null })}
                  className="w-full border border-slate-300 rounded px-3 py-2 font-mono text-xs" />
              </Field>
              <Field label="Location">
                <input type="text" value={editing.location ?? ""} onChange={(e) => setEditing({ ...editing, location: e.target.value || null })}
                  className="w-full border border-slate-300 rounded px-3 py-2" />
              </Field>
              <Field label="State">
                <select value={editing.state ?? ""} onChange={(e) => setEditing({ ...editing, state: (e.target.value || null) as AusState | null })}
                  className="w-full border border-slate-300 rounded px-3 py-2">
                  <option value="">—</option>
                  {AUS_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Wave">
                <select value={editing.wave ?? ""} onChange={(e) => setEditing({ ...editing, wave: (e.target.value ? Number(e.target.value) : null) as 1 | 2 | 3 | null })}
                  className="w-full border border-slate-300 rounded px-3 py-2">
                  <option value="">—</option>
                  <option value="1">Wave 1</option>
                  <option value="2">Wave 2</option>
                  <option value="3">Wave 3</option>
                </select>
              </Field>
              <Field label="Status">
                <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as HempHomesProspectStatus })}
                  className="w-full border border-slate-300 rounded px-3 py-2">
                  {HEMP_HOMES_PROSPECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Land size (acres)">
                <input type="number" step="any" value={editing.land_size_acres ?? ""} onChange={(e) => setEditing({ ...editing, land_size_acres: e.target.value ? Number(e.target.value) : null })}
                  className="w-full border border-slate-300 rounded px-3 py-2" />
              </Field>
              <Field label="Current members">
                <input type="number" value={editing.current_members ?? ""} onChange={(e) => setEditing({ ...editing, current_members: e.target.value ? Number(e.target.value) : null })}
                  className="w-full border border-slate-300 rounded px-3 py-2" />
              </Field>
              <Field label="Indicative lot potential">
                <input type="number" value={editing.indicative_lot_potential ?? ""} onChange={(e) => setEditing({ ...editing, indicative_lot_potential: e.target.value ? Number(e.target.value) : null })}
                  className="w-full border border-slate-300 rounded px-3 py-2" />
              </Field>
              <Field label="Next action">
                <input type="text" value={editing.next_action ?? ""} onChange={(e) => setEditing({ ...editing, next_action: e.target.value || null })}
                  className="w-full border border-slate-300 rounded px-3 py-2" />
              </Field>
              <Field label="Source basis (rationale)" full>
                <textarea value={editing.source_basis ?? ""} onChange={(e) => setEditing({ ...editing, source_basis: e.target.value || null })}
                  rows={3} className="w-full border border-slate-300 rounded px-3 py-2 text-xs" />
              </Field>
              <Field label="Notes" full>
                <textarea value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value || null })}
                  rows={2} className="w-full border border-slate-300 rounded px-3 py-2 text-xs" />
              </Field>
              <Field label="Public-safe" full>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.is_public_safe}
                    onChange={(e) => setEditing({ ...editing, is_public_safe: e.target.checked })} />
                  <span>This community has consented to being mentioned publicly</span>
                </label>
              </Field>
              <Field label="Contact emails (one per line)" full>
                <textarea
                  value={(editing.contact_emails ?? []).join("\n")}
                  onChange={(e) => setEditing({ ...editing, contact_emails: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-mono"
                  placeholder="info@example.com&#10;sales@example.com"
                />
              </Field>
              <Field label="Contact form URL">
                <input type="text" value={editing.contact_form_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, contact_form_url: e.target.value || null })}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-mono" />
              </Field>
              <Field label="Contact phone">
                <input type="text" value={editing.contact_phone ?? ""}
                  onChange={(e) => setEditing({ ...editing, contact_phone: e.target.value || null })}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-mono" />
              </Field>
              <Field label="Contact discovery notes" full>
                <textarea
                  value={editing.contact_discovery_notes ?? ""}
                  onChange={(e) => setEditing({ ...editing, contact_discovery_notes: e.target.value || null })}
                  rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs"
                  placeholder="Discovery notes — labelled inboxes, verification flags, physical address, etc."
                />
              </Field>
            </div>
            <div className="px-5 py-3 border-t bg-slate-50 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-slate-700 hover:text-slate-900">Cancel</button>
              <button type="button" disabled={busyId === editing.id} onClick={saveEdit}
                className="bg-slate-900 hover:bg-slate-700 text-white px-4 py-1.5 rounded text-sm font-semibold disabled:opacity-50">
                {busyId === editing.id ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactSummary({ p }: { p: HempHomesProspect }) {
  const emailCount = p.contact_emails?.length ?? 0;
  return (
    <div className="space-y-0.5 text-xs">
      {emailCount > 0 ? (
        <div className="text-emerald-700 font-semibold">
          {emailCount} email{emailCount === 1 ? "" : "s"}
        </div>
      ) : p.contact_form_url ? (
        <div className="text-amber-700">Form only</div>
      ) : (
        <div className="text-slate-400 italic">No contact</div>
      )}
      {p.contact_phone && (
        <div className="text-slate-500 font-mono text-[0.65rem]">{p.contact_phone}</div>
      )}
    </div>
  );
}

function Tile({ label, value, subline, highlight, muted }: { label: string; value: string; subline?: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div className={`border rounded p-4 ${highlight ? "bg-emerald-50 border-emerald-200" : muted ? "bg-slate-50 border-slate-200" : "bg-white border-slate-200"}`}>
      <div className="text-[0.65rem] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="text-xl md:text-2xl font-bold text-slate-900 mt-1">{value}</div>
      {subline && <div className="text-[0.65rem] text-slate-500 mt-0.5">{subline}</div>}
    </div>
  );
}

function FilterSelect<T extends string>({ label, value, onChange, options }: {
  label: string; value: T; onChange: (v: T) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}
        className="border border-slate-300 rounded px-2 py-1 text-sm">
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  );
}

function AssumptionField({ label, value, onSave, isMoney, isPercent, highlight }: {
  label: string; value: number; onSave: (v: number) => void; isMoney?: boolean; isPercent?: boolean; highlight?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => { setDraft(String(value)); }, [value]);
  return (
    <div className={`rounded p-3 border ${highlight ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
      <div className="text-[0.65rem] uppercase tracking-wider text-slate-500 font-semibold mb-1">{label}</div>
      {editing ? (
        <div className="flex items-center gap-1">
          <input type="number" step="any" value={draft} onChange={(e) => setDraft(e.target.value)}
            className="w-full border border-slate-300 rounded px-2 py-1 text-sm" autoFocus />
          <button onClick={() => { onSave(Number(draft)); setEditing(false); }} className="text-xs text-emerald-700 font-semibold">✓</button>
          <button onClick={() => { setDraft(String(value)); setEditing(false); }} className="text-xs text-slate-500">×</button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="text-lg font-bold text-slate-900 hover:text-slate-700 text-left">
          {isMoney ? `$${value.toLocaleString()}` : isPercent ? `${value.toFixed(1)}%` : value}
        </button>
      )}
    </div>
  );
}
