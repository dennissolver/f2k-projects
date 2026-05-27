"use client";

import { useState } from "react";

export default function AgentResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const { createSupabaseBrowser } = await import("@/lib/supabase-browser");
      const supabase = createSupabaseBrowser();
      // The recovery link establishes a session; update the password on it.
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message || "Could not reset password. Request a fresh link.");
        return;
      }
      window.location.href = "/agent";
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full border border-slate-300 rounded px-3 py-2.5 text-base focus:outline-none focus:border-slate-900";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-slate-200 p-6 sm:p-8">
        <h1 className="text-xl font-bold text-slate-900 mb-1">Set a new password</h1>
        <p className="text-sm text-slate-500 mb-6">
          Choose a new password for your agent account.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-16`}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label={showPw ? "Hide password" : "Show password"}
                onClick={() => setShowPw((s) => !s)}
                className="absolute inset-y-0 right-0 px-3 text-sm text-slate-500 hover:text-slate-800"
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm new password</label>
            <input type={showPw ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} autoComplete="new-password" required />
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700">{error}</div>}
          <button type="submit" disabled={busy} className="w-full bg-slate-900 hover:bg-slate-700 text-white px-5 py-3 min-h-[44px] rounded text-sm font-semibold disabled:opacity-50">
            {busy ? "Saving…" : "Set password + sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
