"use client";

import { useState } from "react";

export default function AgentForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { createBrowserClient } = await import("@supabase/ssr");
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/agent/reset-password`,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setSent(true);
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
        <h1 className="text-xl font-bold text-slate-900 mb-1">Reset your password</h1>
        <p className="text-sm text-slate-500 mb-6">
          Enter your email and we&apos;ll send you a link to set a new password.
        </p>
        {sent ? (
          <div className="bg-sky-50 border border-sky-200 rounded px-3 py-3 text-sm text-sky-800">
            If that email is registered, a reset link is on its way. Check your inbox.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700">{error}</div>}
            <button type="submit" disabled={busy} className="w-full bg-slate-900 hover:bg-slate-700 text-white px-5 py-3 min-h-[44px] rounded text-sm font-semibold disabled:opacity-50">
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <p className="text-xs text-slate-400 mt-6 text-center">
          <a href="/agent/login" className="underline hover:text-slate-700">Back to sign in</a>
        </p>
      </div>
    </div>
  );
}
