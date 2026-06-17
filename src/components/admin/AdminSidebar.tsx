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
  { href: "/admin/registrations", label: "All Registrations" },
  { href: "/admin/agents", label: "Agents" },
  { href: "/admin/email-templates", label: "Email Templates", group: "Compliance" },
  { href: "/admin/audit-log", label: "Audit Log", group: "Compliance" },
];

// Estates that have at least one admin section, grouped State → Estate for the switcher.
const SWITCHER_ESTATES = ESTATES.filter((e) => sectionsForEstate(e.slug).length > 0);

interface StateGroup {
  stateAbbr: string;
  stateName: string;
  estates: { slug: string; name: string }[];
}
function groupByState(): StateGroup[] {
  const map = new Map<string, StateGroup>();
  for (const e of SWITCHER_ESTATES) {
    const key = e.stateAbbr;
    if (!map.has(key)) map.set(key, { stateAbbr: key, stateName: e.stateName, estates: [] });
    map.get(key)!.estates.push({ slug: e.slug, name: e.shortName });
  }
  return Array.from(map.values());
}

const LAST_STATE_KEY = "f2k.admin.lastState";
const LAST_ESTATE_KEY = "f2k.admin.lastEstate";

export function AdminSidebar({ email }: { email?: string | null }) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  const groups = useMemo(groupByState, []);
  const [stateAbbr, setStateAbbr] = useState<string>(groups[0]?.stateAbbr ?? "");
  const [estateSlug, setEstateSlug] = useState<string>(groups[0]?.estates[0]?.slug ?? "");

  // Remember the last-used state + estate (the two-click cost is paid once per context switch).
  useEffect(() => {
    const s = localStorage.getItem(LAST_STATE_KEY);
    const e = localStorage.getItem(LAST_ESTATE_KEY);
    if (s && groups.some((g) => g.stateAbbr === s)) {
      setStateAbbr(s);
      const grp = groups.find((g) => g.stateAbbr === s)!;
      setEstateSlug(e && grp.estates.some((x) => x.slug === e) ? e : grp.estates[0]?.slug ?? "");
    }
  }, [groups]);

  const estatesInState = groups.find((g) => g.stateAbbr === stateAbbr)?.estates ?? [];
  const sections = sectionsForEstate(estateSlug);

  function onStateChange(next: string) {
    setStateAbbr(next);
    const firstEstate = groups.find((g) => g.stateAbbr === next)?.estates[0]?.slug ?? "";
    setEstateSlug(firstEstate);
    localStorage.setItem(LAST_STATE_KEY, next);
    localStorage.setItem(LAST_ESTATE_KEY, firstEstate);
  }
  function onEstateChange(next: string) {
    setEstateSlug(next);
    localStorage.setItem(LAST_ESTATE_KEY, next);
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

      <nav className="flex-1 space-y-1">
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

        {/* ESTATE SWITCHER — two-step State → Estate */}
        {groups.length > 0 && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="mb-2 px-3 text-[0.6rem] uppercase tracking-[0.25em] text-slate-500">
              Estate
            </p>
            <div className="space-y-2 px-1">
              <select
                aria-label="State"
                value={stateAbbr}
                onChange={(e) => onStateChange(e.target.value)}
                className="w-full rounded bg-slate-800 px-2 py-2 text-sm text-white"
              >
                {groups.map((g) => (
                  <option key={g.stateAbbr} value={g.stateAbbr}>
                    {g.stateName}
                  </option>
                ))}
              </select>
              <select
                aria-label="Estate"
                value={estateSlug}
                onChange={(e) => onEstateChange(e.target.value)}
                className="w-full rounded bg-slate-800 px-2 py-2 text-sm text-white"
              >
                {estatesInState.map((e) => (
                  <option key={e.slug} value={e.slug}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-2 space-y-1">
              {sections.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-500">No admin sections yet.</p>
              ) : (
                sections.map((s) => link(s.href, s.label, `${estateSlug}:${s.href}`))
              )}
            </div>
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
