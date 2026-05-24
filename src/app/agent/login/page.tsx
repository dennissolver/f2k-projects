"use client";

import { useState } from "react";

async function browserClient() {
  const { createBrowserClient } = await import("@supabase/ssr");
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export default function AgentLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "info"; text: string } | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const supabase = await browserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setMsg({ type: "error", text: error.message || "Sign-in failed." });
        return;
      }
      window.location.href = "/agent";
    } catch {
      setMsg({ type: "error", text: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  async function magicLink() {
    if (!email.trim()) {
      setMsg({ type: "error", text: "Enter your email first, then request a magic link." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const supabase = await browserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/agent` },
      });
      setMsg(
        error
          ? { type: "error", text: error.message }
          : { type: "info", text: "Check your email for a magic sign-in link." },
      );
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full border border-slate-300 rounded px-3 py-2.5 text-base focus:outline-none focus:border-slate-900";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-slate-200 p-6 sm:p-8">
        <h1 className="text-xl font-bold text-slate-900 mb-1">Agent sign in</h1>
        <p className="text-sm text-slate-500 mb-6">
          Sign in to the Seafields agent portal to see your clients and lot
          availability.
        </p>

        <form onSubmit={signIn} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <a href="/agent/forgot-password" className="text-xs text-slate-500 underline hover:text-slate-800">
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-16`}
                autoComplete="current-password"
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

          {msg && (
            <div
              className={`rounded px-3 py-2 text-sm ${
                msg.type === "error"
                  ? "bg-red-50 border border-red-200 text-red-700"
                  : "bg-sky-50 border border-sky-200 text-sky-800"
              }`}
            >
              {msg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-slate-900 hover:bg-slate-700 text-white px-5 py-3 min-h-[44px] rounded text-sm font-semibold disabled:opacity-50"
          >
            {busy ? "Working…" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={magicLink}
            disabled={busy}
            className="text-sm text-slate-600 underline hover:text-slate-900 disabled:opacity-50"
          >
            Email me a magic sign-in link instead
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-6 text-center">
          New agent with an invite? <a href="/agent/activate" className="underline hover:text-slate-700">Activate your account</a>
        </p>
      </div>
    </div>
  );
}
