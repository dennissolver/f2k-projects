// @explanatory-header-exempt — auth surface (login / signup / password flows are self-explanatory by web convention)
"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useCanonicalOrigin } from "@/lib/use-canonical-origin";
import { PasswordField } from "@/components/admin/PasswordField";

function LoginInner() {
  useCanonicalOrigin();
  const searchParams = useSearchParams();
  const initialError = searchParams?.get("error") ?? null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState<"password" | "magic" | "reset" | null>(null);

  function getClient() {
    return createSupabaseBrowser();
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading("password");

    const supabase = getClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(null);
      return;
    }
    window.location.href = "/admin";
  }

  async function handleMagicLink() {
    if (!email) {
      setError("Enter your email address first");
      return;
    }
    setError(null);
    setInfo(null);
    setLoading("magic");

    const supabase = getClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/admin`,
      },
    });

    if (otpError) {
      setError(otpError.message);
      setLoading(null);
      return;
    }
    setInfo(`Magic link sent to ${email}. Check your inbox (and spam folder).`);
    setLoading(null);
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email address first");
      return;
    }
    setError(null);
    setInfo(null);
    setLoading("reset");

    const supabase = getClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/admin/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(null);
      return;
    }
    setInfo(`Password reset link sent to ${email}. Check your inbox.`);
    setLoading(null);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded bg-gold flex items-center justify-center font-bold text-navy">
            F2K
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy">Projects Admin</h1>
            <p className="text-sm text-gray-500">Factory2Key</p>
          </div>
        </div>

        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-f2k-blue outline-none"
            />
          </div>
          <PasswordField
            id="login-password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />

          {error && <p className="text-red-600 text-sm">{error}</p>}
          {info && <p className="text-green-700 text-sm">{info}</p>}

          <button
            type="submit"
            disabled={loading !== null || !email || !password}
            className="w-full bg-navy hover:bg-gray-800 text-white py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {loading === "password" ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-gray-400">
          <div className="flex-1 h-px bg-gray-200" />
          <span>or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleMagicLink}
            disabled={loading !== null}
            className="w-full border border-navy text-navy hover:bg-gray-50 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading === "magic" ? "Sending..." : "Email me a magic link"}
          </button>
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={loading !== null}
            className="w-full text-sm text-gray-500 hover:text-navy underline-offset-2 hover:underline disabled:opacity-50"
          >
            {loading === "reset" ? "Sending..." : "Forgot password?"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-navy" />}>
      <LoginInner />
    </Suspense>
  );
}
