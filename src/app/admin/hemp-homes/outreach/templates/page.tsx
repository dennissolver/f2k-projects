"use client";

import { useCallback, useEffect, useState } from "react";
import type { HempHomesOutreachTemplate } from "@/lib/hemp-homes/types";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

export default function HempHomesOutreachTemplatesPage() {
  const [templates, setTemplates] = useState<HempHomesOutreachTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<HempHomesOutreachTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/hemp-homes/outreach/templates");
      if (!res.ok) return;
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/hemp-homes/outreach/templates/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editing.name,
          description: editing.description,
          subject_template: editing.subject_template,
          preview_template: editing.preview_template,
          body_md_template: editing.body_md_template,
          llm_instruction: editing.llm_instruction,
          active: editing.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Save failed" });
        return;
      }
      setMessage({ type: "success", text: "Template saved." });
      setEditing(null);
      fetchTemplates();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Outreach Templates</h2>
        <p className="text-sm text-slate-500 max-w-3xl">
          DB-stored templates the LLM uses as a starting point. Edit subject, body, and the
          LLM instruction here without redeploying. Use Liquid-style{" "}
          <code className="text-[0.7rem]">{`{{ name }}`}</code>,{" "}
          <code className="text-[0.7rem]">{`{{ state }}`}</code>,{" "}
          <code className="text-[0.7rem]">{`{{ source_basis }}`}</code> etc. — these get
          substituted against each prospect before Claude polishes the result.
        </p>
      </div>

      {message && (
        <div className={`p-3 rounded text-sm ${
          message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>{message.text}</div>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-slate-500">Loading templates…</div>
        ) : templates.length === 0 ? (
          <div className="p-6 text-slate-500">No templates yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Trigger</th>
                <th className="px-3 py-2 text-left">Target</th>
                <th className="px-3 py-2 text-center">Active</th>
                <th className="px-3 py-2 text-center">Auto-send</th>
                <th className="px-3 py-2 text-left">Updated</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-t hover:bg-slate-50 align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{t.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{t.slug}</div>
                    {t.description && <div className="text-xs text-slate-500 mt-1 max-w-md">{t.description}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div className="font-semibold text-slate-700">{t.trigger_type}</div>
                    <div className="text-slate-500 font-mono text-[0.65rem]">
                      {JSON.stringify(t.trigger_config)}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {t.target_waves && <div>Waves: {t.target_waves.join(", ")}</div>}
                    {t.target_statuses && <div>Status: {t.target_statuses.join(", ")}</div>}
                    {t.target_states && <div>States: {t.target_states.join(", ")}</div>}
                  </td>
                  <td className="px-3 py-2 text-center text-xs">
                    {t.active
                      ? <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">ON</span>
                      : <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-semibold">OFF</span>}
                  </td>
                  <td className="px-3 py-2 text-center text-xs">
                    {t.auto_send
                      ? <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-semibold">AUTO</span>
                      : <span className="text-slate-400">manual</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(t.updated_at)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(t)}
                      className="text-xs text-slate-700 hover:text-slate-900 font-semibold"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto py-10 px-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Edit template — {editing.slug}</h3>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-500 hover:text-slate-900 text-sm">Close</button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Name</label>
                <input type="text" value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Description</label>
                <input type="text" value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value || null })}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Subject</label>
                <input type="text" value={editing.subject_template}
                  onChange={(e) => setEditing({ ...editing, subject_template: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Preview text</label>
                <input type="text" value={editing.preview_template ?? ""}
                  onChange={(e) => setEditing({ ...editing, preview_template: e.target.value || null })}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Body (markdown)</label>
                <textarea value={editing.body_md_template}
                  onChange={(e) => setEditing({ ...editing, body_md_template: e.target.value })}
                  rows={14}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-mono" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">LLM instruction</label>
                <textarea value={editing.llm_instruction ?? ""}
                  onChange={(e) => setEditing({ ...editing, llm_instruction: e.target.value || null })}
                  rows={4}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs" />
                <p className="text-[0.65rem] text-slate-500 mt-0.5">
                  Guidance for Claude when polishing the templated draft. E.g. tone, length cap, what to keep/avoid.
                </p>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.active}
                    onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
                  <span>Active (selectable when generating)</span>
                </label>
              </div>
            </div>
            <div className="px-5 py-3 border-t bg-slate-50 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)}
                className="px-3 py-1.5 text-sm text-slate-700 hover:text-slate-900">Cancel</button>
              <button type="button" disabled={busy} onClick={saveEdit}
                className="bg-slate-900 hover:bg-slate-700 text-white px-4 py-1.5 rounded text-sm font-semibold disabled:opacity-50">
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
