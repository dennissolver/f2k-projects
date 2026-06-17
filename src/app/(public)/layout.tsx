import Script from "next/script";
import ProjectsHeader from "@/components/ProjectsHeader";
import ProjectsFooter from "@/components/ProjectsFooter";

// FTK analytics Phase 1 — Umami tracking, cookieless, no consent banner.
// Mounted ONLY in the (public) layout (NOT the root layout) so /admin, /agent, and the demo
// deploy never pollute the production bucket whose numbers we compare across estates (and later
// sell to advertisers). Suppressed in demo mode, and a no-op until the website-id env is set.
const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
const umamiSrc =
  process.env.NEXT_PUBLIC_UMAMI_SRC || "https://cloud.umami.is/script.js";
const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const analyticsEnabled = Boolean(umamiWebsiteId) && !isDemoMode;

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      {analyticsEnabled && (
        <Script
          src={umamiSrc}
          data-website-id={umamiWebsiteId}
          strategy="afterInteractive"
          defer
        />
      )}
      <ProjectsHeader />
      <main className="flex-1">{children}</main>
      <ProjectsFooter />
    </div>
  );
}
