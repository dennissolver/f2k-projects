"use client";

import { useCallback, useEffect, useState } from "react";
import type { HempHomesOutreachReviewStatus } from "@/lib/hemp-homes/types";

interface QueuedDraft {
  id: string;
  prospect_id: string;
  template_id: string | null;
  generated_at: string;
  drafted_subject: string;
  drafted_preview: string | null;
  drafted_body_md: string;
  drafted_body_html: string | null;
  drafted_to_addresses: string[];
  review_status: HempHomesOutreachReviewStatus;
  reviewer_edited: boolean;
  sent_at: string | null;
  resend_message_id: string | null;
  delivery_status: string | null;
  notes: string | null;
  prospect: {
    id: string;
    name: string;
    slug: string;
    state: string | null;
    wave: number | null;
    status: string;
    source_basis: string | null;
    contact_emails: string[];
    website_url: string | null;
  } | null;
  template: { id: string; slug: string; name: string } | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

export default function HempHomesOutreachQueuePage() {
  const [drafts, setDrafts] = useState<QueuedDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<HempHomesOutreachReviewStatus | "all">("pending");
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit state for the open draft
  const [edit, setEdit] = useState<{
    subject: string;
    body_md: string;
    to: string;
  } | null>(null);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/hemp-homes/outreach/queue?status=${filter}`);
      if (!res.ok) {
        setMessage({ type: "error", text: "Failed to load drafts" });
        return;
      }
      const data = await res.json();
      setDrafts(data.outreach ?? []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const open = openId ? drafts.find((d) => d.id === openId) : null;

  async function saveEdit(id: string) {
    if (!edit) return;
    setBusyId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/hemp-homes/outreach/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drafted_subject: edit.subject,
          drafted_body_md: edit.body_md,
          drafted_to_addresses: edit.to.split("\n").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Save failed" });
        return;
      }
      setMessage({ type: "success", text: "Draft saved." });
      fetchDrafts();
    } finally {
      setBusyId(null);
    }
  }

  async function approve(id: string) {
    if (!confirm("Send this email now? Cannot be undone.")) return;
    setBusyId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/hemp-homes/outreach/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Send failed" });
        return;
      }
      setMessage({ type: "success", text: `Sent. Resend id: ${data.resend_id ?? "—"}` });
      setOpenId(null);
      fetchDrafts();
    } finally {
      setBusyId(null);
    }
  }

  async function discard(id: string) {
    if (!confirm("Discard this draft? It will be marked discarded and not sent.")) return;
    setBusyId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/hemp-homes/outreach/${id}/discard`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: d.error ?? "Discard failed" });
        return;
      }
      setMessage({ type: "success", text: "Discarded." });
      setOpenId(null);
      fetchDrafts();
    } finally {
      setBusyId(null);
    }
  }

  async function reroll(id: string) {
    if (!confirm("Discard this draft and generate a fresh one with the same template?")) return;
    setBusyId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/hemp-homes/outreach/${id}/reroll`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Reroll failed" });
        return;
      }
      setMessage({ type: "success", text: "New draft generated." });
      setOpenId(data.outreach?.id ?? null);
      fetchDrafts();
    } finally {
      setBusyId(null);
    }
  }

  function openDraft(d: QueuedDraft) {
    setOpenId(d.id);
    setEdit({
      subject: d.drafted_subject,
      body_md: d.drafted_body_md,
      to: (d.drafted_to_addresses ?? []).join("\n"),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Outreach Queue</h2>
        <p className="text-sm text-slate-500 max-w-3xl">
          AI-drafted prospect emails awaiting your review. Click a draft to preview, edit the
          subject or body, then Approve (sends via Resend), Reroll (regenerates), or Discard.
          Approval is required for every send in Phase 1; auto-send unlocks per template once
          you&apos;ve trusted a few rounds.
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

      <div className="bg-white border rounded-lg p-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Status</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="border border-slate-300 rounded px-2 py-1 text-sm"
          >
            <option value="pending">Pending</option>
            <option value="approved">Sent</option>
            <option value="discarded">Discarded</option>
            <option value="rerolled">Rerolled</option>
            <option value="all">All</option>
          </select>
        </label>
        <div className="ml-auto text-xs text-slate-500">
          {drafts.length} {filter === "all" ? "drafts" : `"${filter}" drafts`}
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-slate-500">Loading drafts…</div>
        ) : drafts.length === 0 ? (
          <div className="p-6 text-slate-500">
            No {filter === "all" ? "drafts" : `"${filter}" drafts`} yet. Generate a draft from
            <a className="text-emerald-700 underline" href="/admin/hemp-homes/prospects"> the Prospects page</a>.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">Generated</th>
                <th className="px-3 py-2 text-left">Community</th>
                <th className="px-3 py-2 text-left">Template</th>
                <th className="px-3 py-2 text-left">Subject</th>
                <th className="px-3 py-2 text-left">To</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => (
                <tr
                  key={d.id}
                  className="border-t hover:bg-emerald-50/40 cursor-pointer"
                  onClick={() => openDraft(d)}
                >
                  <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{fmtDate(d.generated_at)}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{d.prospect?.name ?? "—"}</div>
                    <div className="text-xs text-slate-500">
                      W{d.prospect?.wave ?? "-"} · {d.prospect?.state ?? "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700">{d.template?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{d.drafted_subject}</td>
                  <td className="px-3 py-2 text-xs font-mono text-slate-500">
                    {(d.drafted_to_addresses ?? []).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {d.review_status === "pending" && (
                      <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold">PENDING</span>
                    )}
                    {d.review_status === "approved" && (
                      <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">SENT</span>
                    )}
                    {d.review_status === "discarded" && (
                      <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-semibold">DISCARDED</span>
                    )}
                    {d.review_status === "rerolled" && (
                      <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-semibold">REROLLED</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && edit && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto py-10 px-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">{open.prospect?.name}</h3>
                <p className="text-xs text-slate-500">
                  {open.template?.name} · generated {fmtDate(open.generated_at)}
                  {open.reviewer_edited && <span className="ml-2 text-amber-700">(edited)</span>}
                </p>
              </div>
              <button type="button" onClick={() => setOpenId(null)} className="text-slate-500 hover:text-slate-900 text-sm">
                Close
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              {open.prospect?.source_basis && (
                <div className="text-xs bg-slate-50 border border-slate-200 rounded p-3 text-slate-700">
                  <span className="font-semibold uppercase tracking-wider text-[0.6rem] text-slate-500 block mb-1">
                    Why we picked this community
                  </span>
                  {open.prospect.source_basis}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">To</label>
                <textarea
                  value={edit.to}
                  onChange={(e) => setEdit({ ...edit, to: e.target.value })}
                  rows={2}
                  disabled={open.review_status !== "pending"}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-mono disabled:opacity-60"
                />
                <p className="text-[0.65rem] text-slate-500 mt-0.5">One email per line.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Subject</label>
                <input
                  type="text"
                  value={edit.subject}
                  onChange={(e) => setEdit({ ...edit, subject: e.target.value })}
                  disabled={open.review_status !== "pending"}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Body (markdown)</label>
                <textarea
                  value={edit.body_md}
                  onChange={(e) => setEdit({ ...edit, body_md: e.target.value })}
                  rows={16}
                  disabled={open.review_status !== "pending"}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-mono disabled:opacity-60"
                />
              </div>
              {open.review_status === "approved" && open.resend_message_id && (
                <div className="text-xs text-slate-500">
                  Sent {fmtDate(open.sent_at)} · Resend id <code className="font-mono">{open.resend_message_id}</code>
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t bg-slate-50 flex items-center gap-2">
              {open.review_status === "pending" ? (
                <>
                  <button
                    type="button"
                    disabled={busyId === open.id}
                    onClick={() => discard(open.id)}
                    className="text-sm text-red-600 hover:text-red-800 font-semibold disabled:opacity-50"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    disabled={busyId === open.id}
                    onClick={() => reroll(open.id)}
                    className="text-sm text-blue-700 hover:text-blue-900 font-semibold disabled:opacity-50"
                  >
                    Reroll
                  </button>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busyId === open.id}
                      onClick={() => saveEdit(open.id)}
                      className="text-sm text-slate-700 hover:text-slate-900 font-semibold disabled:opacity-50"
                    >
                      Save edits
                    </button>
                    <button
                      type="button"
                      disabled={busyId === open.id}
                      onClick={() => approve(open.id)}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-1.5 rounded text-sm font-semibold disabled:opacity-50"
                    >
                      {busyId === open.id ? "…" : "Approve & send"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="ml-auto text-xs text-slate-500">Read-only — this draft is {open.review_status}.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
