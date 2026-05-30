"use client";

import { useState } from "react";

interface Agent {
  id: string;
  name: string;
  email: string;
}

interface BulkEmailModalProps {
  agentIds: string[];
  agents: Agent[];
  onClose: () => void;
  onSent: () => void;
}

export function BulkEmailModal({ agentIds, agents, onClose, onSent }: BulkEmailModalProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  async function handleSend() {
    if (!subject.trim() || !message.trim()) {
      setError("Subject and message are required");
      return;
    }

    if (!confirm(`Send email to ${agents.length} agent(s)?`)) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/agents/bulk-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentIds, subject, message }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send");
        return;
      }

      setResult({ sent: data.summary.sent, failed: data.summary.failed });
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Send email to agents</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
        </div>

        {result ? (
          <div className="px-5 py-6">
            <div className="text-center">
              <div className="text-4xl mb-2">{result.sent > 0 ? "✓" : "✗"}</div>
              <p className="text-lg font-semibold text-slate-900">
                {result.sent} sent, {result.failed} failed
              </p>
              <button onClick={onClose} className="mt-4 bg-slate-900 text-white px-6 py-2 rounded text-sm font-semibold">
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 py-5 space-y-4">
            <div>
              <div className="text-sm text-slate-600 mb-2">
                <strong>{agents.length}</strong> recipient{agents.length > 1 ? "s" : ""}: {" "}
                {agents.map((a) => a.name).join(", ")}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject *</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm"
                placeholder="Email subject line"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Message *</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm"
                placeholder="Write your message..."
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 border border-slate-300 text-slate-700 px-5 py-2.5 rounded text-sm font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !subject.trim() || !message.trim()}
                className="flex-1 bg-[#00B5AD] text-white px-5 py-2.5 rounded text-sm font-semibold hover:bg-[#009d94] disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
