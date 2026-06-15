"use client";

import { usePathname } from "next/navigation";

// Funder routes (/funders, /{estate}/funders) are a separate audience + legal footing from the
// buyer pages: they must NOT carry the buyer "real estate marketing only / no financial product"
// disclaimer (it directly contradicts a page inviting a bank to fund a development). They get a
// funder-appropriate line instead. Mirrors the path-aware banner in ProjectsHeader.
function isFunderRoute(pathname: string | null): boolean {
  return pathname === "/funders" || (pathname?.endsWith("/funders") ?? false);
}

export default function ProjectsFooter() {
  const pathname = usePathname();
  const funderRoute = isFunderRoute(pathname);
  return (
    <footer className="border-t border-slate-200 bg-white py-8 mt-auto text-slate-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#22c55e] rounded flex items-center justify-center">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span>
                Factory2Key Projects — Built by{" "}
                <span className="text-slate-900 font-medium">Factory2Key</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <a
                href="https://www.factory2key.com.au"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-900 transition-colors"
              >
                factory2key.com.au
              </a>
              <span className="hidden sm:inline opacity-30">|</span>
              <a
                href="tel:+61402612471"
                className="hover:text-slate-900 transition-colors"
              >
                +61 402 612 471
              </a>
              <span className="hidden sm:inline opacity-30">|</span>
              <a
                href="mailto:dennis@factory2key.com.au"
                className="hover:text-slate-900 transition-colors"
              >
                dennis@factory2key.com.au
              </a>
              <span className="hidden sm:inline opacity-30">|</span>
              <a
                href="/privacy"
                className="hover:text-slate-900 transition-colors"
              >
                Privacy
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs opacity-70">
            <div>
              &copy; {new Date().getFullYear()} Factory2Key Pty Ltd. All rights
              reserved.
            </div>
            <div>
              {funderRoute
                ? "Directed to registered Australian banks (ADIs). Registration of interest only — not an offer or invitation, and not financial product advice."
                : "Real estate marketing only. No financial product is offered on this site."}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
