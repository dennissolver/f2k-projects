import { Metadata } from "next";
import RegistrationForm from "@/components/branscombe/RegistrationForm";
import FloorPlanGallery from "@/components/branscombe/FloorPlanGallery";
import ElevationGallery from "@/components/branscombe/ElevationGallery";
import HeroSitePlan from "@/components/branscombe/HeroSitePlan";
import { HOUSE_TYPES, HOUSE_TYPE_INFO, ESTATE_PARKING } from "@/data/branscombe";

export const metadata: Metadata = {
  title: "Branscombe Estate — Register Your Interest | F2K",
  description:
    "37 architecturally designed, single-storey 3-bedroom, 2-bathroom homes in Claremont, Tasmania. 7 Star Energy rated. Register your interest — no deposit required.",
  openGraph: {
    title: "Branscombe Estate — Claremont, Tasmania",
    description:
      "37 architecturally designed single-storey homes in Claremont, Tasmania. Register your interest — no deposit required.",
    url: "https://f2k-projects.vercel.app/branscombe-estate",
    siteName: "Factory2Key Projects",
    type: "website",
    images: [
      {
        url: "https://f2k-projects.vercel.app/branscombe/home-exterior-1.jpg",
        alt: "Branscombe Estate, Claremont Tasmania",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Branscombe Estate — Claremont, Tasmania",
    description:
      "37 architecturally designed single-storey homes in Claremont, Tasmania.",
    images: ["https://f2k-projects.vercel.app/branscombe/home-exterior-1.jpg"],
  },
};

export default function BranscombeEstatePage() {
  return (
    <>
      {/* ===== HERO ===== */}
      <section className="relative bg-[#1A2744] text-white overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1A2744] via-[#1A2744] to-[#00B5AD]/20" />

        <div className="relative max-w-[1100px] mx-auto px-4 py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
                A Factory2Key Development
              </p>
              <h1 className="font-playfair text-[clamp(2.5rem,5vw,4rem)] font-black leading-[1.1] mb-6">
                Branscombe Estate
              </h1>
              <p className="text-xl text-white/70 font-archivo leading-relaxed mb-2">
                37 architecturally designed, single-storey 3-bedroom, 2-bathroom homes.
              </p>
              <p className="text-lg text-white/50 font-archivo mb-8">
                Claremont, Tasmania — 8km from Hobart CBD
              </p>
              <p className="text-white/60 font-archivo leading-relaxed mb-8 max-w-lg">
                Register your interest in a specific home — no deposit, no
                commitment. Simply let us know which home appeals to you and
                we&apos;ll keep you informed as the project progresses.
              </p>
              <a
                href="#site-map"
                className="inline-block bg-[#00B5AD] hover:bg-[#009E97] text-white px-8 py-3.5 font-archivo font-semibold transition-colors"
              >
                Select your home &rarr;
              </a>
            </div>

            {/* Hero plan — vector SVG of the 37-home site plan from Unison 20E92-03 */}
            <div>
              <div className="border border-white/10 bg-white/5 p-3">
                <HeroSitePlan />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="font-ibm-mono text-[0.55rem] tracking-[0.3em] uppercase text-white/50 self-center mr-1">
                  Home types:
                </span>
                {HOUSE_TYPES.map((type) => {
                  const info = HOUSE_TYPE_INFO[type];
                  return (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[0.65rem] font-archivo font-semibold text-white border"
                      style={{
                        backgroundColor: info.color,
                        borderColor: info.border,
                      }}
                    >
                      Type {type}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== KEY STATS ===== */}
      <section className="bg-white border-b border-black/5">
        <div className="max-w-[1100px] mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
            {[
              { value: "37", label: "Homes" },
              { value: "3 Bed / 2 Bath", label: "Per home" },
              { value: "104–114m²", label: "Home area" },
              { value: "350–550m²", label: "Land size" },
              { value: "2026–2028", label: "Construction" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="font-playfair text-2xl md:text-3xl font-black text-deep-blue">
                  {stat.value}
                </div>
                <div className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-slate/60 mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ABOUT THE PROJECT ===== */}
      <section className="py-16 px-4 bg-off-white">
        <div className="max-w-[900px] mx-auto">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            About the Development
          </p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-6">
            Modern Living in Claremont
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="text-slate font-archivo leading-relaxed space-y-4">
              <p>
                Branscombe Estate is a 37-dwelling residential
                development by Factory2Key Pty Ltd, located at 122–124
                Branscombe Road, Claremont TAS 7011 — just 8km from Hobart CBD.
                Land sizes range from approximately 350m² to 550m² per lot.
              </p>
              <p>
                All homes are single-storey, 3-bedroom, 2-bathroom, designed by
                Unison with high-quality finishes and 7 Star Energy rated.
                The development has full planning approval (Permit PLN-21-408.02,
                Glenorchy City Council).
              </p>
            </div>
            <div className="space-y-3">
              {[
                { label: "Developer", value: "Factory2Key Pty Ltd" },
                { label: "Location", value: "122–124 Branscombe Rd, Claremont TAS 7011" },
                { label: "Permit", value: "PLN-21-408.02 (Glenorchy City Council)" },
                { label: "Dwellings", value: "37 single-storey, 3-bed / 2-bath" },
                { label: "House Types", value: "Types 1A, 1B, 2A, 2B, 2C" },
                { label: "Land Sizes", value: "~350m² – 550m² per lot" },
                { label: "Site Area", value: "19,981 m²" },
                {
                  label: "Parking",
                  value: `${ESTATE_PARKING.residentSpacesPerUnit} dedicated spaces per home · ${ESTATE_PARKING.visitorSpaces} shared visitor spaces`,
                },
                { label: "Energy Rating", value: "7 Star" },
                { label: "Designer", value: "Unison" },
                { label: "Timeline", value: "Construction 2026 — Estimated completion late 2027 to mid-2028" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex border-b border-black/5 pb-2"
                >
                  <span className="font-ibm-mono text-[0.65rem] tracking-wider uppercase text-slate/50 w-28 shrink-0 pt-0.5">
                    {item.label}
                  </span>
                  <span className="font-archivo text-sm text-deep-blue">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== VIDEO FLYOVER ===== */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-[1100px] mx-auto">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            Site Flyover
          </p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-6">
            See the Site
          </h2>
          <div className="bg-[#1A2744] p-1">
            <video
              controls
              playsInline
              preload="metadata"
              poster="/branscombe/home-exterior-1.jpg"
              className="w-full h-auto"
            >
              <source
                src="https://eifcgqxpayrpbastpwjo.supabase.co/storage/v1/object/sign/video_storage/122-124%20Branscombe%20Road%20with%20logo2.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9mNTljNmQ5ZC03NWZiLTQzODQtYjJkZC1kODVjZDM3YTk3MjYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlb19zdG9yYWdlLzEyMi0xMjQgQnJhbnNjb21iZSBSb2FkIHdpdGggbG9nbzIubXA0IiwiaWF0IjoxNzczMTMwNTU3LCJleHAiOjE4MzUzMzg1NTd9.w9AxB8_EzpCPz8Dv69sLvJ3R4ZZoXryuW_QL5gPMZwg"
                type="video/mp4"
              />
              Your browser does not support the video tag.
            </video>
          </div>
          <p className="text-xs text-slate/50 font-archivo mt-2 text-center">
            Aerial flyover of 122–124 Branscombe Road, Claremont TAS 7011
          </p>
        </div>
      </section>

      {/* ===== HOUSE TYPES ===== */}
      <section className="py-16 px-4 bg-warm-grey">
        <div className="max-w-[1100px] mx-auto">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            Home Designs
          </p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-4">
            Five Architectural Layouts
          </h2>
          <p className="text-slate font-archivo leading-relaxed mb-4">
            All homes are 3-bedroom, 2-bathroom, single-storey with 7 Star
            Energy rating, designed by Unison. Click any floor plan to view
            full size.
          </p>

          {/* Type summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
            {(
              [
                { type: "1A", size: "104m²", deck: "24m²", units: "U1, U3, U9, U11, U14, U19, U22, U27, U32, U37" },
                { type: "1B", size: "104m²", deck: "24m²", units: "U2, U7, U12, U17, U23, U28, U33" },
                { type: "2A", size: "114m²", deck: "24m²", units: "U4, U8, U13, U18, U24, U29, U34" },
                { type: "2B", size: "114m²", deck: "24m²", units: "U5, U10, U15, U20, U25, U30, U35" },
                { type: "2C", size: "114m²", deck: "24m²", units: "U6, U16, U21, U26, U31, U36" },
              ] as const
            ).map((h) => (
              <div
                key={h.type}
                className="bg-white p-4 border border-black/5 text-center"
              >
                <div className="font-playfair text-lg font-black text-deep-blue">
                  Type {h.type}
                </div>
                <div className="font-ibm-mono text-[0.6rem] tracking-wider text-slate/60 mt-1">
                  {h.size} + {h.deck} DECK
                </div>
                <div className="font-archivo text-xs text-slate mt-1">
                  3 bed &middot; 2 bath
                </div>
                <div className="font-archivo text-[0.6rem] text-[#00B5AD] mt-2 leading-snug">
                  {h.units}
                </div>
              </div>
            ))}
          </div>

          <FloorPlanGallery />
        </div>
      </section>

      {/* ===== ELEVATIONS ===== */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-[1100px] mx-auto">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            Exterior Elevations
          </p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-4">
            Colour Schemes &amp; Elevations
          </h2>
          <p className="text-slate font-archivo leading-relaxed mb-8">
            Each home type is available in three colour schemes — The Forest
            (as per current DA approval), Dark Contemporary, and Light Coastal.
            Click any elevation to view it full size.
          </p>

          <ElevationGallery />
        </div>
      </section>

      {/* ===== PURCHASE TERMS ===== */}
      <section className="py-16 px-4 bg-warm-grey">
        <div className="max-w-[900px] mx-auto">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            Sales Terms
          </p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-3">
            Purchase Terms
          </h2>
          <p className="text-slate font-archivo leading-relaxed mb-8 max-w-[700px]">
            Indicative contract terms for Branscombe Estate house &amp; land
            packages. Full contract documentation is provided at contract
            stage. All terms may be varied by mutual agreement.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "Deposit",
                value: "5%",
                note: "Payable within 5 days of contract",
              },
              {
                label: "Finance",
                value: "30 days",
                note: "Finance approval window from date of contract",
              },
              {
                label: "Settlement",
                value: "On Title",
                note: "Settlement after the issue of title",
              },
              {
                label: "Build",
                value: "Modular",
                note: "Factory-built modules, ~12-14 weeks from site arrival",
              },
            ].map((term) => (
              <div
                key={term.label}
                className="bg-white border border-black/5 p-5"
              >
                <div className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-slate/60 mb-1">
                  {term.label}
                </div>
                <div className="font-playfair text-2xl font-black text-deep-blue mb-2">
                  {term.value}
                </div>
                <div className="font-archivo text-xs text-slate leading-relaxed">
                  {term.note}
                </div>
              </div>
            ))}
          </div>

          <p className="font-archivo text-xs text-slate/60 mt-6 leading-relaxed">
            Terms shown are indicative. Settlement is on a turnkey basis —
            you take possession of a complete, built home. For specific
            questions on contract conditions or land titles, email{" "}
            <a
              href="mailto:dennis@factory2key.com.au?subject=Branscombe%20Estate%20contract%20enquiry"
              className="text-[#00B5AD] hover:underline"
            >
              Dennis
            </a>{" "}
            for full information.
          </p>
        </div>
      </section>

      {/* ===== INTERACTIVE MAP + REGISTRATION FORM ===== */}
      <section className="py-20 px-4 bg-off-white">
        <div className="max-w-[1100px] mx-auto">
          <RegistrationForm />
        </div>
      </section>

      {/* ===== PRIVACY NOTE ===== */}
      <section className="py-8 px-4 bg-white border-t border-black/5">
        <div className="max-w-[900px] mx-auto">
          <p className="text-slate text-sm font-archivo leading-relaxed text-center">
            Registration data collected on this page is used by Factory2Key Pty
            Ltd for project communications only and is not shared with any third
            party for marketing.{" "}
            <a
              href="/privacy"
              className="text-[#00B5AD] hover:text-[#009E97] underline font-semibold transition-colors"
            >
              View our Privacy Policy
            </a>
          </p>
        </div>
      </section>

      {/* ===== CONTACT ===== */}
      <section className="py-10 px-4 bg-warm-grey">
        <div className="max-w-[900px] mx-auto text-center">
          <p className="font-archivo text-sm text-slate mb-2">
            Questions about Branscombe Estate?
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
