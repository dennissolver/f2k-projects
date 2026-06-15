"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

type NavItem = { href: string; label: string; external?: boolean };

const ABOUT_F2K: NavItem = {
  href: "https://www.factory2key.com.au",
  label: "About F2K",
  external: true,
};

const DEFAULT_NAV: NavItem[] = [
  { href: "/", label: "Projects" },
  { href: "/seafields-estate", label: "Seafields" },
  { href: "/branscombe-estate", label: "Branscombe" },
  { href: "/hemp-homes-for-eco-communities", label: "Hemp Homes" },
  { href: "/developers", label: "For Developers" },
  { href: "/blog", label: "Blog" },
  ABOUT_F2K,
];

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
  const pathname = usePathname();
  const navItems = navItemsForPath(pathname);
  const developer = developerForPath(pathname);
  const funderRoute = isFunderRoute(pathname);

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
            {navItems.map((item) =>
              item.external ? (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg text-sm transition-colors duration-200 text-slate-500 hover:text-slate-900 no-underline"
                >
                  {item.label} ↗
                </a>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-4 py-2 rounded-lg text-sm transition-colors duration-200 text-slate-500 hover:text-slate-900 no-underline"
                >
                  {item.label}
                </Link>
              ),
            )}
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
            {navItems.map((item) =>
              item.external ? (
                <a
                  key={item.href}
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
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-3 text-base no-underline transition-colors text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
