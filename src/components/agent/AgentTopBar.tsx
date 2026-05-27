"use client";

import { useState } from "react";

export function AgentTopBar({ name }: { name: string }) {
  const [out, setOut] = useState(false);

  async function signOut() {
    setOut(true);
    try {
      const { createSupabaseBrowser } = await import("@/lib/supabase-browser");
      const supabase = createSupabaseBrowser();
      await supabase.auth.signOut();
      window.location.href = "/agent/login";
    } finally {
      setOut(false);
    }
  }

  return (
    <header className="bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="font-semibold text-sm">Seafields · Agent</span>
          <nav className="flex gap-1">
            <a href="/agent" className="px-3 py-2 rounded text-sm hover:bg-white/10 transition-colors">
              My Clients
            </a>
            <a href="/agent/availability" className="px-3 py-2 rounded text-sm hover:bg-white/10 transition-colors">
              Availability
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-300 hidden sm:inline" title={name}>
            {name}
          </span>
          <button
            onClick={signOut}
            disabled={out}
            className="px-3 py-2 min-h-[40px] rounded hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            {out ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}
