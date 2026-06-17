import Link from "next/link";
import { redirect } from "next/navigation";
import AustraliaMap from "@/components/AustraliaMap";
import EstateCard from "@/components/EstateCard";
import { publicEstates } from "@/data/estates";

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function HomePage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  // Supabase invitation magic-links redirect to the Site URL with ?code=...
  // appended. Forward the code to our auth callback handler so the session
  // cookie is set. (Backstop in case Supabase Site URL is configured to /
  // instead of /api/auth/callback.)
  if (searchParams.code) {
    redirect(
      `/api/auth/callback?code=${encodeURIComponent(searchParams.code)}&next=/admin`,
    );
  }

  // Show product CTA banner in demo mode
  const showProductBanner = isDemoMode;

  return (
    <>
      {showProductBanner && (
        <section className="bg-blue-600 text-white py-4 px-4">
          <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-semibold">
                Build Your Own Estate Sales Platform — $399/month
              </p>
              <p className="text-blue-100 text-sm">
                White-label solution for developers and agents
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              <Link
                href="/pricing"
                className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium text-sm hover:bg-blue-50"
              >
                View Pricing
              </Link>
              <Link
                href="/admin/login"
                className="px-4 py-2 bg-blue-700 text-white rounded-lg font-medium text-sm hover:bg-blue-800"
              >
                Admin Demo
              </Link>
            </div>
          </div>
        </section>
      )}
      {/* HERO — clickable map of Australia (the front door) */}
      <section className="bg-off-white py-12 md:py-16 px-4 border-b border-black/5">
        <div className="max-w-[1100px] mx-auto">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-ember mb-4">
            Our Current Developments
          </p>
          <h1 className="font-playfair text-[clamp(2rem,4vw,3rem)] font-black text-deep-blue leading-tight mb-4">
            Factory2Key Projects
          </h1>
          <p className="text-lg text-slate leading-relaxed font-archivo max-w-[750px] mb-8">
            Tap a state to see what we&apos;re building there, or go straight to an estate by tapping
            its pin. Register your interest in a specific lot or home — no deposit is required or
            accepted. Real estate marketing only.
          </p>

          <div className="max-w-[820px] mx-auto">
            <AustraliaMap />
          </div>
        </div>
      </section>

      {/* All developments, as cards (also the mobile-friendly list view of the map above) */}
      <section className="bg-off-white py-12 md:py-16 px-4 border-b border-black/5">
        <div className="max-w-[1100px] mx-auto">
          <h2 className="font-playfair text-2xl font-black text-deep-blue leading-tight mb-8">
            Every Factory2Key development
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {publicEstates().map((e) => (
              <EstateCard key={e.slug} estate={e} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 px-4 bg-white">
        <div className="max-w-[900px] mx-auto text-center">
          <p className="font-archivo text-sm text-slate mb-3">
            Questions about a Factory2Key development?
          </p>
          <p className="font-archivo text-deep-blue font-semibold">
            Dennis McMahon —{" "}
            <a
              href="mailto:dennis@factory2key.com.au"
              className="text-[#00B5AD] hover:underline"
            >
              dennis@factory2key.com.au
            </a>{" "}
            &middot;{" "}
            <a
              href="tel:+61402612471"
              className="text-[#00B5AD] hover:underline"
            >
              +61 402 612 471
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
