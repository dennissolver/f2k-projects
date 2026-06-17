"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { PreviewModeToggle } from "./PreviewModeToggle";
import { ESTATES } from "@/data/estates";
import { sectionsForEstate } from "@/data/estate-admin-nav";

// GLOBAL (estate-independent) items — fixed length regardless of estate count.
interface NavItem {
  href: string;
  label: string;
  group?: string;
}
const GLOBAL_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/site-check", label: "Site Check" },
  { href: "/admin/registrations", label: "All Registrations" },
  { href: "/admin/agents", label: "Agents" },
  { href: "/admin/email-templates", label: "Email Templates", group: "Compliance" },
  { href: "/admin/audit-log", label: "Audit Log", group: "Compliance" },
];

// An estate appears in the switcher if it has any admin sections (parked estates are shown greyed).
const SWITCHER_ESTATES = ESTATES.filter((e) => sectionsForEstate(e.slug).length > 0);

// State display order — WA, TAS, SA first (the states we have estates in), the rest as they come,
// Multi-state programmes last. New states appear automatically once they have an estate.
const STATE_ORDER = ["WA", "TAS", "SA", "NT", "QLD", "NSW", "VIC", "ACT", "MULTI"];

interface EstateNode {
  slug: string;
  name: string;
  parked: boolean;
}
interface StateGroup {
  stateAbbr: string;
  stateName: string;
  estates: EstateNode[];
}

function groupByState(): StateGroup[] {
  const map = new Map<string, StateGroup>();
  for (const e of SWITCHER_ESTATES) {
    if (!map.has(e.stateAbbr)) {
      map.set(e.stateAbbr, {
        stateAbbr: e.stateAbbr,
        stateName: e.stateAbbr === "MULTI" ? "Multi-state" : e.stateName,
        estates: [],
      });
    }
    map.get(e.stateAbbr)!.estates.push({
      slug: e.slug,
      name: e.shortName,
      parked: Boolean(e.parked),
    });
  }
  return Array.from(map.values()).sort(
    (a, b) => STATE_ORDER.indexOf(a.stateAbbr) - STATE_ORDER.indexOf(b.stateAbbr),
  );
}

const LAST_ESTATE_KEY = "f2k.admin.lastEstate";

export function AdminSidebar({ email }: { email?: string | null }) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  const groups = useMemo(groupByState, []);

  // The first non-parked estate is the sensible default selection.
  const firstSelectable = useMemo(() => {
    for (const g of groups) {
      const e = g.estates.find((x) => !x.parked);
      if (e) return { state: g.stateAbbr, slug: e.slug };
    }
    return { state: groups[0]?.stateAbbr ?? "", slug: groups[0]?.estates[0]?.slug ?? "" };
  }, [groups]);

  const [activeEstate, setActiveEstate] = useState<string>(firstSelectable.slug);
  const [expandedState, setExpandedState] = useState<string>(firstSelectable.state);

  // Restore the last-used estate (and expand its state).
  useEffect(() => {
    const saved = localStorage.getItem(LAST_ESTATE_KEY);
    if (!saved) return;
    const grp = groups.find((g) => g.estates.some((e) => e.slug === saved && !e.parked));
    if (grp) {
      setActiveEstate(saved);
      setExpandedState(grp.stateAbbr);
    }
  }, [groups]);

  function selectEstate(slug: string) {
    setActiveEstate(slug);
    localStorage.setItem(LAST_ESTATE_KEY, slug);
  }

  const isActive = (href: string) =>
    pathname === href || (href !== "/admin" && pathname.startsWith(href));

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

  const link = (href: string, label: string, key?: string) => (
    <a
      key={key ?? href}
      href={href}
      className={`block rounded px-3 py-2 text-sm transition-colors ${
        isActive(href) ? "bg-white/15 text-white" : "hover:bg-white/10"
      }`}
    >
      {label}
    </a>
  );

  return (
    <aside className="flex min-h-screen w-64 flex-shrink-0 flex-col bg-slate-950 p-4 text-white">
      <a href="/admin" className="mb-8 flex items-center gap-3 no-underline">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#22c55e] text-sm font-bold text-white">
          F2K
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-white">Projects Admin</span>
          <span className="text-xs text-slate-400">by Factory2Key</span>
        </div>
      </a>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {/* GLOBAL */}
        {GLOBAL_NAV.map((item, i) => {
          const showGroup = item.group && (i === 0 || GLOBAL_NAV[i - 1]?.group !== item.group);
          return (
            <div key={item.href}>
              {showGroup && (
                <p className="mb-1 mt-4 px-3 text-[0.6rem] uppercase tracking-[0.25em] text-slate-500">
                  {item.group}
                </p>
              )}
              {link(item.href, item.label)}
            </div>
          );
        })}

        {/* ESTATES — states at the top level; click a state to reveal its estates */}
        {groups.length > 0 && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="mb-1 px-3 text-[0.6rem] uppercase tracking-[0.25em] text-slate-500">
              Estates
            </p>
            {groups.map((g) => {
              const open = expandedState === g.stateAbbr;
              return (
                <div key={g.stateAbbr}>
                  <button
                    type="button"
                    onClick={() => setExpandedState(open ? "" : g.stateAbbr)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm font-medium hover:bg-white/10"
                  >
                    <span>{g.stateName}</span>
                    <span className="text-xs text-slate-400">{open ? "▾" : "▸"}</span>
                  </button>

                  {open && (
                    <div className="ml-2 border-l border-white/10 pl-2">
                      {g.estates.map((e) =>
                        e.parked ? (
                          <div
                            key={e.slug}
                            className="flex cursor-not-allowed items-center justify-between rounded px-3 py-2 text-sm text-slate-500"
                            title="Parked — not active yet"
                          >
                            <span>{e.name}</span>
                            <span className="text-[0.55rem] uppercase tracking-wide">parked</span>
                          </div>
                        ) : (
                          <div key={e.slug}>
                            <button
                              type="button"
                              onClick={() => selectEstate(e.slug)}
                              className={`block w-full rounded px-3 py-2 text-left text-sm transition-colors ${
                                activeEstate === e.slug
                                  ? "bg-white/10 font-medium text-white"
                                  : "hover:bg-white/10"
                              }`}
                            >
                              {e.name}
                            </button>
                            {activeEstate === e.slug && (
                              <div className="ml-2 border-l border-white/10 pl-2">
                                {sectionsForEstate(e.slug).map((s) =>
                                  link(s.href, s.label, `${e.slug}:${s.href}`),
                                )}
                              </div>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>

      <div className="space-y-2 border-t border-white/10 pt-4 text-xs">
        {link("/admin/settings", "Settings")}
        <PreviewModeToggle />
        {email && (
          <p className="truncate px-3 text-slate-400" title={email}>
            {email}
          </p>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full rounded px-3 py-2 text-left transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
        <a
          href="/"
          className="block rounded px-3 py-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          ↗ Public site
        </a>
      </div>
    </aside>
  );
}

export default AdminSidebar;
