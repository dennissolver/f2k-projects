"use client";

import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
  group?: string;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/registrations", label: "Registrations", group: "Inbox" },
  { href: "/admin/seafields-stages", label: "Seafields Stages", group: "Seafields" },
  { href: "/admin/seafields-lots", label: "Seafields Lots", group: "Seafields" },
  { href: "/admin/seafields-pipeline", label: "Seafields Pipeline", group: "Seafields" },
  { href: "/admin/branscombe-units", label: "Branscombe Units", group: "Branscombe" },
  { href: "/admin/branscombe-pipeline", label: "Branscombe Pipeline", group: "Branscombe" },
  { href: "/admin/audit-log", label: "Audit Log", group: "Compliance" },
];

export function AdminSidebar({ email }: { email?: string | null }) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const { createBrowserClient } = await import("@supabase/ssr");
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      await supabase.auth.signOut();
      window.location.href = "/admin/login";
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <aside className="w-64 bg-slate-950 text-white min-h-screen p-4 flex-shrink-0 flex flex-col">
      <a href="/admin" className="flex items-center gap-3 mb-8 no-underline">
        <div className="h-8 w-8 rounded-lg bg-[#22c55e] flex items-center justify-center font-bold text-white text-sm">
          F2K
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-white">Projects Admin</span>
          <span className="text-xs text-slate-400">by Factory2Key</span>
        </div>
      </a>

      <nav className="space-y-1 flex-1">
        {NAV.map((item, i) => {
          const showGroupHeader =
            item.group &&
            (i === 0 || NAV[i - 1]?.group !== item.group);
          return (
            <div key={item.href}>
              {showGroupHeader && (
                <p className="text-[0.6rem] tracking-[0.25em] uppercase text-slate-500 mt-4 mb-1 px-3">
                  {item.group}
                </p>
              )}
              <a
                href={item.href}
                className="block px-3 py-2 rounded text-sm hover:bg-white/10 transition-colors"
              >
                {item.label}
              </a>
            </div>
          );
        })}
      </nav>

      <div className="pt-4 border-t border-white/10 space-y-2 text-xs">
        {email && (
          <p className="px-3 text-slate-400 truncate" title={email}>
            {email}
          </p>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full text-left px-3 py-2 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
        <a
          href="/"
          className="block px-3 py-2 rounded text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          ↗ Public site
        </a>
      </div>
    </aside>
  );
}

export default AdminSidebar;
