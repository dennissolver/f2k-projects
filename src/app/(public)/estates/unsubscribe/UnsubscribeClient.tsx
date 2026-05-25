"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function UnsubscribeClient() {
  const token = useSearchParams().get("t");
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [err, setErr] = useState("");

  async function unsubscribe() {
    if (!token) {
      setErr("This link is missing its token.");
      setState("error");
      return;
    }
    setState("working");
    try {
      const res = await fetch(`/api/estates/unsubscribe?t=${encodeURIComponent(token)}`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? "Could not unsubscribe.");
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setErr("Network error — please try again.");
      setState("error");
    }
  }

  return (
    <div className="bg-white border border-black/10 rounded-lg p-8 max-w-md w-full text-center">
      {state === "done" ? (
        <>
          <h1 className="text-xl font-bold text-slate-900 mb-2">You&apos;re unsubscribed</h1>
          <p className="text-slate-600 text-sm">
            You won&apos;t receive any more update emails. You can re-register any time on our site.
          </p>
        </>
      ) : state === "error" ? (
        <>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h1>
          <p className="text-slate-600 text-sm">{err}</p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Unsubscribe from updates?</h1>
          <p className="text-slate-600 text-sm mb-5">
            Click below to stop receiving update emails. You can always re-register later.
          </p>
          <button
            type="button"
            onClick={unsubscribe}
            disabled={state === "working"}
            className="bg-slate-900 hover:bg-slate-700 text-white px-5 py-2.5 rounded font-semibold text-sm disabled:opacity-50"
          >
            {state === "working" ? "Unsubscribing…" : "Yes, unsubscribe me"}
          </button>
        </>
      )}
    </div>
  );
}
