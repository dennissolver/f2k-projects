"use client";

import { useState, Fragment } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ESTATES } from "@/data/estates";

type NavItem = { href: string; label: string; external?: boolean };

const ABOUT_F2K: NavItem = {
  href: "https://www.factory2key.com.au",
  label: "About F2K",
  external: true,
};

// The default/hub nav now leads with an "Estates" menu (registry-driven, below) instead of
// hardcoded per-estate links, so a newly-onboarded estate appears automatically. The estate-scoped
// nav (navItemsForPath) is unchanged — a buyer on one estate still sees only that estate's pages.
const DEFAULT_NAV: NavItem[] = [
  { href: "/", label: "Projects" },
  { href: "/developers", label: "For Developers" },
  { href: "/blog", label: "Blog" },
  ABOUT_F2K,
];

// Estates grouped State → Estate for the hub mega-menu, read from the registry. Location is shown
// as each estate's subtitle (so the place is visible without a third nav level — matches the
// admin switcher's two-step shape).
const ESTATE_MENU: { state: string; estates: { href: string; name: string; location: string }[] }[] =
  (() => {
    const order: string[] = [];
    const map = new Map<string, { href: string; name: string; location: string }[]>();
    for (const e of ESTATES) {
      const state = e.stateAbbr === "MULTI" ? "Multi-state" : e.stateName;
      if (!map.has(state)) {
        map.set(state, []);
        order.push(state);
      }
      map.get(state)!.push({ href: e.href, name: e.shortName, location: e.location });
    }
    return order.map((state) => ({ state, estates: map.get(state)! }));
  })();

// Developer credited in the header differs per project (Dennis, 2026-06-12):
// Seafields + Wavecrest are developed by Dual Focus; Branscombe + Hemp Homes by
// Factory2Key. The Projects hub (landing) credits no single developer. Anything
// else (blog, pricing, privacy) stays unattributed too.
function developerForPath(pathname: string | null): string | null {
  if (
    pathname?.startsWith("/seafields") ||
    pathname?.startsWith("/wavecrest")
  ) {
    return "Dual Focus";
  }
  if (
    pathname?.startsWith("/branscombe") ||
    pathname?.startsWith("/hemp-homes")
  ) {
    return "Factory2Key";
  }
  return null;
}

// Estate-scoped nav: a buyer on one estate sees only that estate's own
// blog+gallery and About F2K — never cross-links to the other estates, which
// confused buyers (Uwe, 2026-05-26). Hemp Homes + the Projects hub keep the
// full nav.
function navItemsForPath(pathname: string | null): NavItem[] {
  if (pathname?.startsWith("/seafields-estate")) {
    return [
      { href: "/blog/seafields", label: "Seafields Blog & Gallery" },
      ABOUT_F2K,
    ];
  }
  if (pathname?.startsWith("/branscombe-estate")) {
    return [
      { href: "/blog/branscombe", label: "Branscombe Blog & Gallery" },
      ABOUT_F2K,
    ];
  }
  return DEFAULT_NAV;
}

// Funder routes (/funders, /{estate}/funders) are a SEPARATE audience + legal footing from the
// buyer pages (build brief §9): they get their own banner — directed to registered Australian
// banks — NOT the purchaser "registration of interest only / no deposit" banner.
function isFunderRoute(pathname: string | null): boolean {
  return pathname === "/funders" || (pathname?.endsWith("/funders") ?? false);
}

export default function ProjectsHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [estatesOpen, setEstatesOpen] = useState(false);
  const pathname = usePathname();
  const navItems = navItemsForPath(pathname);
  const developer = developerForPath(pathname);
  const funderRoute = isFunderRoute(pathname);
  // The Estates mega-menu shows only on the hub/default nav — never on an estate-scoped page (a
  // buyer on one estate must not see cross-links to the others; Uwe, 2026-05-26).
  const showEstatesMenu = navItems === DEFAULT_NAV;

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-50 backdrop-blur-xl bg-white/90">
      {funderRoute ? (
        /* Funder disclaimer banner — registered Australian banks only (NOT the buyer banner) */
        <div className="bg-[#142C44] text-white/80 text-xs font-archivo text-center py-2 px-4 leading-relaxed">
          <strong className="text-white">FOR REGISTERED AUSTRALIAN BANKS (ADIs)</strong> —
          Registration of interest only. Not an offer or invitation, and not
          financial product advice. Figures are indicative and subject to formal terms.
        </div>
      ) : (
        /* Purchaser disclaimer banner */
        <div className="bg-[#1A2744] text-white/80 text-xs font-archivo text-center py-2 px-4 leading-relaxed">
          <strong className="text-white">REGISTRATION OF INTEREST ONLY</strong> —
          No deposit is required or accepted. Registering does not create any
          legal or financial obligation.
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 group no-underline">
            <div className="w-8 h-8 bg-[#22c55e] rounded-lg flex items-center justify-center text-white font-bold text-sm group-hover:bg-[#4ade80] transition-colors">
              F2K
            </div>
            <div className="flex items-baseline">
              <span className="font-semibold text-lg text-slate-900">
                Factory2Key Projects
              </span>
              {developer && (
                <span className="text-xs ml-2 hidden sm:inline text-slate-500">
                  Developer: {developer}
                </span>
              )}
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Fragment key={item.href}>
                {item.external ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg text-sm transition-colors duration-200 text-slate-500 hover:text-slate-900 no-underline"
                  >
                    {item.label} ↗
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    className="px-4 py-2 rounded-lg text-sm transition-colors duration-200 text-slate-500 hover:text-slate-900 no-underline"
                  >
                    {item.label}
                  </Link>
                )}
                {showEstatesMenu && item.href === "/" && (
                  <div
                    className="relative"
                    onMouseLeave={() => setEstatesOpen(false)}
                  >
                    <button
                      type="button"
                      onClick={() => setEstatesOpen((v) => !v)}
                      aria-expanded={estatesOpen}
                      className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-900"
                    >
                      Estates ▾
                    </button>
                    {estatesOpen && (
                      <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                        {ESTATE_MENU.map((grp) => (
                          <div key={grp.state} className="py-1">
                            <p className="px-3 py-1 text-[0.6rem] uppercase tracking-wide text-slate-400">
                              {grp.state}
                            </p>
                            {grp.estates.map((e) => (
                              <Link
                                key={e.href}
                                href={e.href}
                                onClick={() => setEstatesOpen(false)}
                                className="block rounded px-3 py-2 no-underline hover:bg-slate-100"
                              >
                                <span className="block text-sm text-slate-900">{e.name}</span>
                                <span className="block text-xs text-slate-500">{e.location}</span>
                              </Link>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Fragment>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="md:hidden p-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-6 h-6"
            >
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <nav className="md:hidden border-t border-slate-200 py-2">
            {navItems.map((item) => (
              <Fragment key={item.href}>
                {item.external ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-3 text-base no-underline transition-colors text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                  >
                    {item.label} ↗
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-3 text-base no-underline transition-colors text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                  >
                    {item.label}
                  </Link>
                )}
                {showEstatesMenu && item.href === "/" && (
                  <div className="my-1 border-y border-slate-100 py-1">
                    {ESTATE_MENU.map((grp) => (
                      <div key={grp.state}>
                        <p className="px-4 pt-2 text-[0.6rem] uppercase tracking-wide text-slate-400">
                          {grp.state}
                        </p>
                        {grp.estates.map((e) => (
                          <Link
                            key={e.href}
                            href={e.href}
                            onClick={() => setMenuOpen(false)}
                            className="flex min-h-[44px] items-center px-6 text-base no-underline text-slate-700 hover:bg-slate-100"
                          >
                            {e.name}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </Fragment>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
