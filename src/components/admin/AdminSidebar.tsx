"use client";

import { useState } from "react";
import { PreviewModeToggle } from "./PreviewModeToggle";

interface NavItem {
  href: string;
  label: string;
  group?: string;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/agents", label: "Agents" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/registrations", label: "All Registrations", group: "Inbox" },
  // Seafields
  { href: "/admin/estates/seafields/posts", label: "Blog", group: "Seafields" },
  { href: "/admin/estates/seafields/media", label: "Media", group: "Seafields" },
  { href: "/admin/seafields-stages", label: "Stages", group: "Seafields" },
  { href: "/admin/seafields-lots", label: "Lots", group: "Seafields" },
  { href: "/admin/seafields-import", label: "Import", group: "Seafields" },
  { href: "/admin/seafields-employer-campaign", label: "Employer Campaign", group: "Seafields" },
  // Branscombe
  { href: "/admin/estates/branscombe/posts", label: "Blog", group: "Branscombe" },
  { href: "/admin/estates/branscombe/media", label: "Media", group: "Branscombe" },
  { href: "/admin/branscombe-units", label: "Units", group: "Branscombe" },
  // Wavecrest
  { href: "/admin/wavecrest/posts", label: "Blog", group: "Wavecrest" },
  { href: "/admin/wavecrest/media", label: "Media", group: "Wavecrest" },
  { href: "/admin/wavecrest-stages", label: "Stages", group: "Wavecrest" },
  { href: "/admin/wavecrest-lots", label: "Lots", group: "Wavecrest" },
  { href: "/admin/wavecrest-import", label: "Import", group: "Wavecrest" },
  // Hemp Homes
  { href: "/admin/hemp-homes/posts", label: "Blog", group: "Hemp Homes" },
  { href: "/admin/hemp-homes/media", label: "Media", group: "Hemp Homes" },
  { href: "/admin/hemp-homes/journey", label: "Journey", group: "Hemp Homes" },
  { href: "/admin/hemp-homes/prospects", label: "Prospects", group: "Hemp Homes" },
  { href: "/admin/hemp-homes/outreach/queue", label: "Outreach", group: "Hemp Homes" },
  // Compliance
  { href: "/admin/email-templates", label: "Email Templates", group: "Compliance" },
  { href: "/admin/audit-log", label: "Audit Log", group: "Compliance" },
  // Account
  { href: "/admin/settings", label: "Settings", group: "Account" },
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
        <PreviewModeToggle />
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
