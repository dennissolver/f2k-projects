"use client";

import { useCallback, useEffect, useState } from "react";

interface Recipient {
  email: string;
  name: string | null;
  active: boolean;
  added_at: string;
  updated_at: string;
}

export default function NotifyRecipientsCard() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/seafields/notify-recipients");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to load recipients");
      }
      const d = await res.json();
      setRecipients(d.recipients || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/seafields/notify-recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          name: newName.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to add recipient");
      }
      setNewEmail("");
      setNewName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(email: string) {
    if (!confirm(`Remove ${email} from Seafields notifications?`)) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/seafields/notify-recipients?email=${encodeURIComponent(email)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to remove recipient");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded mb-6">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50"
        aria-expanded={!collapsed}
      >
        <div>
          <div className="text-sm font-semibold text-slate-900">
            Notification recipients
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Who gets emailed on new registrations, lot changes, and the daily
            digest. {loading ? "—" : `${recipients.length} active`}.
          </div>
        </div>
        <span className="text-slate-400 text-xs uppercase tracking-wider">
          {collapsed ? "Edit" : "Hide"}
        </span>
      </button>

      {!collapsed && (
        <div className="border-t border-slate-200 px-4 py-3">
          {error && (
            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-sm text-slate-500">Loading…</div>
          ) : (
            <>
              <ul className="divide-y divide-slate-100 mb-4">
                {recipients.length === 0 && (
                  <li className="py-2 text-sm text-slate-500">
                    No recipients — registration emails will only go to the
                    fallback admin address.
                  </li>
                )}
                {recipients.map((r) => (
                  <li
                    key={r.email}
                    className="py-2 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-slate-900 truncate">
                        {r.name ? (
                          <>
                            <span className="font-semibold">{r.name}</span>{" "}
                            <span className="text-slate-500">— {r.email}</span>
                          </>
                        ) : (
                          <span className="font-mono text-xs">{r.email}</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(r.email)}
                      className="text-xs text-red-600 hover:text-red-800 font-medium whitespace-nowrap"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>

              <form
                onSubmit={handleAdd}
                className="flex flex-wrap gap-2 items-end pt-3 border-t border-slate-100"
              >
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                    Name (optional)
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={adding || !newEmail.trim()}
                  className="bg-deep-blue hover:bg-deep-blue/90 text-white px-4 py-1.5 rounded text-sm font-semibold disabled:opacity-50"
                >
                  {adding ? "Adding…" : "Add"}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
