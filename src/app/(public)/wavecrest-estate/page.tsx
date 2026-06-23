import { Metadata } from "next";
import RegistrationForm from "@/components/wavecrest/RegistrationForm";
import SiteMap from "@/components/wavecrest/SiteMap";
import LotList from "@/components/wavecrest/LotList";

export const metadata: Metadata = {
  title: "Wavecrest Estate — Register Your Interest | F2K",
  description:
    "~1,860-lot residential estate in Waggrakine, Geraldton WA. Vacant serviced land or house & land packages. Register your interest — no deposit required.",
  openGraph: {
    title: "Wavecrest Estate — Waggrakine, Geraldton WA",
    description:
      "~1,860-lot residential estate in Waggrakine, Geraldton WA. Vacant serviced land or house & land packages. Register your interest.",
    url: "https://f2k-projects.vercel.app/wavecrest-estate",
    siteName: "Factory2Key Projects",
    type: "website",
    images: [
      {
        url: "https://f2k-projects.vercel.app/wavecrest/site-photo-01.jpg",
        alt: "Wavecrest Estate, Geraldton WA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Wavecrest Estate — Waggrakine, Geraldton WA",
    description:
      "~1,860-lot residential estate in Waggrakine, Geraldton WA.",
    images: ["https://f2k-projects.vercel.app/wavecrest/site-photo-01.jpg"],
  },
};

export default function WavecrestEstatePage() {
  return (
    <>
      {/* ===== HERO ===== */}
      <section className="relative bg-[#1A2744] text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1A2744] via-[#1A2744] to-[#00B5AD]/20" />

        <div className="relative max-w-[1100px] mx-auto px-4 py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
                A Factory2Key Project
              </p>
              <h1 className="font-playfair text-[clamp(2.5rem,5vw,4rem)] font-black leading-[1.1] mb-6">
                Wavecrest Estate
              </h1>
              <p className="text-xl text-white/70 font-archivo leading-relaxed mb-2">
                ~1,860 residential lots — vacant land or house &amp; land packages.
              </p>
              <p className="text-lg text-white/50 font-archivo mb-8">
                Waggrakine, Geraldton WA — 8km from Geraldton CBD
              </p>
              <p className="text-white/60 font-archivo leading-relaxed mb-8 max-w-lg">
                Register your interest in Wavecrest Estate — no deposit, no
                commitment. Simply let us know what you&apos;re looking for and
                we&apos;ll keep you informed as stages are released.
              </p>
              <a
                href="#register"
                className="inline-block bg-[#00B5AD] hover:bg-[#009E97] text-white px-8 py-3.5 font-archivo font-semibold transition-colors"
              >
                Register Your Interest &rarr;
              </a>
            </div>

            {/* Hero site plan */}
            <div>
              <div className="border border-white/10 bg-white/5 p-3">
                <img
                  src="/wavecrest/wavecrest-lot-layout.png"
                  alt="Wavecrest Estate lot layout"
                  className="w-full h-auto"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="font-ibm-mono text-[0.55rem] tracking-[0.3em] uppercase text-white/50 self-center mr-1">
                  Available:
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[0.65rem] font-archivo font-semibold text-white border border-white/20">
                  Stage 2
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[0.65rem] font-archivo font-semibold text-white border border-white/20">
                  Stage 3
                </span>
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
              { value: "~1,860", label: "Total Lots" },
              { value: "300m²+", label: "Lot Sizes" },
              { value: "TBC", label: "Land Pricing" },
              { value: "TBC", label: "H&L Packages" },
              { value: "2026+", label: "Releases" },
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
            A New Coastal Community in Geraldton&apos;s Growth Corridor
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="text-slate font-archivo leading-relaxed space-y-4">
              <p>
                Wavecrest Estate is a ~1,860-lot residential subdivision in
                Waggrakine, approximately 8km north of Geraldton CBD. The estate
                is being developed by Humfrey Land Developments (HLD) with
                Factory2Key Pty Ltd as Project Manager.
              </p>
              <p>
                The estate features ocean and city views, with a mix of lot sizes
                from 300m² townhouse lots through to 1ha premium blocks. Key
                features include a Town Centre, Northern Recreational Area,
                School site, Tourist Resort, and Caravan Park.
              </p>
              <p>
                Stage 2 (61 lots) is approved for construction with underground
                services. Stage 3 features 2,000m² premium lots with ocean and
                city views.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { label: "Project Manager", value: "Factory2Key Pty Ltd" },
                { label: "Developer", value: "Humfrey Land Developments (HLD)" },
                { label: "Landowner", value: "Hunt Property JV / Kenesta Pty Ltd" },
                { label: "Applicant", value: "Property Friends Pty Ltd" },
                { label: "Location", value: "Waggrakine, Geraldton WA 6530" },
                { label: "Total Lots", value: "~1,860 (structure planned)" },
                { label: "Zoning", value: "R80 – R1 (varied by stage)" },
                { label: "Services", value: "Underground (per stage)" },
                { label: "Stage 2", value: "61 lots — approved" },
                { label: "Stage 3", value: "2,000m² premium lots — approved" },
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

      {/* ===== FLYOVER VIDEO ===== */}
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
              poster="/wavecrest/site-photo-01.jpg"
              className="w-full h-auto"
            >
              <source
                src="/wavecrest/flyover.mp4"
                type="video/mp4"
              />
              Your browser does not support the video tag.
            </video>
          </div>
          <p className="text-xs text-slate/50 font-archivo mt-2 text-center">
            Aerial flyover of Wavecrest Estate, Geraldton WA
          </p>
        </div>
      </section>

      {/* ===== STAGING ===== */}
      <section className="py-16 px-4 bg-warm-grey">
        <div className="max-w-[900px] mx-auto">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            Development Staging
          </p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-3">
            Stage 2 Now Selling — Stage 3 Coming Soon
          </h2>
          <p className="text-slate font-archivo leading-relaxed mb-8 max-w-[700px]">
            Wavecrest Estate releases in multiple stages. Stage 2 (61 lots) is
            now approved for construction. Stage 3 features premium 2,000m²
            blocks with ocean and city views. Additional stages will be released
            sequentially as the development progresses.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { stage: "Stage 2", lots: "61", area: "Ocean & city views", rate: "TBC", state: "OPEN" },
              { stage: "Stage 3", lots: "TBC", area: "2,000m² premium", rate: "TBC", state: "COMING SOON" },
              { stage: "Future", lots: "TBC", area: "Various", rate: "TBC", state: "LOCKED" },
              { stage: "Future", lots: "TBC", area: "Various", rate: "TBC", state: "LOCKED" },
            ].map((t) => (
              <div
                key={t.stage}
                className={`p-4 border text-center ${
                  t.state === "OPEN"
                    ? "bg-[#E6F8F7] border-[#00B5AD]"
                    : "bg-off-white border-black/5"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <div className="font-playfair text-base font-black text-deep-blue">
                    {t.stage}
                  </div>
                  <span
                    className={`font-ibm-mono text-[0.45rem] tracking-[0.2em] px-1.5 py-0.5 rounded ${
                      t.state === "OPEN"
                        ? "bg-[#00B5AD] text-white"
                        : "bg-slate/15 text-slate/70"
                    }`}
                  >
                    {t.state}
                  </span>
                </div>
                <div
                  className={`font-archivo text-2xl font-bold mt-1 ${
                    t.state === "OPEN" ? "text-[#00B5AD]" : "text-slate/60"
                  }`}
                >
                  {t.lots}
                </div>
                <div className="font-ibm-mono text-[0.55rem] tracking-wider text-slate/60 mt-1">
                  {t.lots === "TBC" ? "" : "LOTS"}
                </div>
                <div className="font-archivo text-[0.7rem] text-slate/80 mt-2 leading-tight">
                  {t.area}
                </div>
                <div className="font-archivo text-xs text-slate mt-1">
                  {t.rate}
                </div>
              </div>
            ))}
          </div>

          <p className="font-archivo text-xs text-slate/50 leading-relaxed">
            Stage labelling is being reconciled across the subdivision and sales
            documentation — the lots below are the currently released grid
            (Brownlie Street frontage).
          </p>
        </div>
      </section>

      {/* ===== LOT AVAILABILITY ===== */}
      <section id="lots" className="py-16 px-4 bg-white">
        <div className="max-w-[1100px] mx-auto">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            Lot Availability
          </p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-3">
            Browse the Lots
          </h2>
          <p className="text-slate font-archivo leading-relaxed mb-8 max-w-[700px]">
            The current Brownlie Street grid (Lots 83–115). Tap any lot for its
            size, status and indicative pricing where available. Areas are shown
            as exact (surveyed), approximate (from the approved plan) or
            &ldquo;TBC&rdquo; where survey confirmation is pending — we don&apos;t
            publish a figure we can&apos;t stand behind.
          </p>

          <div className="bg-amber-50 border-l-4 border-amber-400 px-4 py-3 mb-6 flex items-start gap-3">
            <svg
              className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01M4.06 19h15.88a2 2 0 001.79-2.89L13.79 4.11a2 2 0 00-3.58 0L2.27 16.11A2 2 0 004.06 19z"
              />
            </svg>
            <div>
              <p className="font-archivo font-semibold text-amber-900 text-sm leading-snug">
                All lot information shown is indicative and subject to final
                confirmation
              </p>
              <p className="text-amber-900/85 font-archivo text-xs leading-relaxed mt-1">
                Every lot&apos;s size, shape, boundary, area and final lot
                numbering remains subject to confirmation against the approved
                deposited plan and final title survey. Registering interest does
                not guarantee allocation or final dimensions.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div>
              <SiteMap />
            </div>
            <div>
              <LotList />
            </div>
          </div>
        </div>
      </section>

      {/* ===== LOT CATEGORIES ===== */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-[900px] mx-auto">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            Purchase Options
          </p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-8">
            Two Ways to Buy
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                title: "Vacant Serviced Land",
                desc: "Titled, serviced lots ready to build. Bring your own builder or hold as an investment. Pricing to be confirmed.",
              },
              {
                title: "House & Land Package",
                desc: "Complete turnkey modular home by Factory2Key. Lot + modular build + site works. Pricing to be confirmed.",
              },
            ].map((opt) => (
              <div
                key={opt.title}
                className="bg-off-white p-6 border border-black/5"
              >
                <h3 className="font-playfair text-lg font-black text-deep-blue mb-2">
                  {opt.title}
                </h3>
                <p className="font-archivo text-sm text-slate leading-relaxed">
                  {opt.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== DISPLAY HOME ===== */}
      <section className="py-16 px-4 bg-warm-grey">
        <div className="max-w-[900px] mx-auto">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            Display Home
          </p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-3">
            Lot 91 — 2 Brownlie Street
          </h2>
          <p className="text-slate font-archivo leading-relaxed mb-6 max-w-[700px]">
            A single-lift Modular WA display home is planned for Lot 91,
            2 Brownlie Street. This will showcase the quality and design of
            homes available in the estate. Contact us for more information on
            the display home opening.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 border border-black/5">
              <div className="font-playfair text-xl font-black text-deep-blue mb-1">
                Lot 91
              </div>
              <div className="font-archivo text-sm text-slate">
                2 Brownlie Street
              </div>
              <div className="font-ibm-mono text-[0.55rem] text-slate/50 mt-2">
                ADDRESS
              </div>
            </div>
            <div className="bg-white p-4 border border-black/5">
              <div className="font-playfair text-xl font-black text-deep-blue mb-1">
                Single-Lift
              </div>
              <div className="font-archivo text-sm text-slate">
                Modular WA Home
              </div>
              <div className="font-ibm-mono text-[0.55rem] text-slate/50 mt-2">
                DESIGN
              </div>
            </div>
            <div className="bg-white p-4 border border-black/5">
              <div className="font-playfair text-xl font-black text-deep-blue mb-1">
                Opening TBC
              </div>
              <div className="font-archivo text-sm text-slate">
                Mid-DA (RFI due 8 June)
              </div>
              <div className="font-ibm-mono text-[0.55rem] text-slate/50 mt-2">
                STATUS
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MARKET CONTEXT ===== */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-[900px] mx-auto">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            Geraldton Market
          </p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-6">
            Strong Growth Fundamentals
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { value: "$533K", label: "Median house price", sub: "Waggrakine" },
              { value: "27%", label: "Annual growth", sub: "Year-on-year" },
              { value: "<1%", label: "Rental vacancy", sub: "Geraldton region" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-playfair text-2xl md:text-3xl font-black text-[#00B5AD]">
                  {stat.value}
                </div>
                <div className="font-archivo text-sm text-deep-blue font-semibold mt-1">
                  {stat.label}
                </div>
                <div className="font-ibm-mono text-[0.55rem] text-slate/50 uppercase mt-0.5">
                  {stat.sub}
                </div>
              </div>
            ))}
          </div>
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
            Indicative contract terms for Wavecrest Estate. Full contract
            documentation will be provided at contract stage.
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
                value: "TBC",
                note: "Finance approval window from contract date",
              },
              {
                label: "Settlement",
                value: "On Title",
                note: "Settlement after the issue of title",
              },
              {
                label: "Covenant",
                value: "TBC",
                note: "Estate covenant — available on request",
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
            Terms shown are indicative and may be varied by mutual agreement at
            contract.{" "}
            <a
              href="mailto:uwe@factory2key.com.au?subject=Wavecrest%20Estate%20enquiry"
              className="text-[#00B5AD] hover:underline"
            >
              Contact us
            </a>{" "}
            for the full document and pricing details.
          </p>
        </div>
      </section>

      {/* ===== REGISTRATION FORM ===== */}
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
            Questions about Wavecrest Estate?
          </p>
          <p className="font-archivo text-deep-blue font-semibold mb-1.5">
            Uwe Jacobs —{" "}
            <a
              href="mailto:uwe@factory2key.com.au"
              className="text-[#00B5AD] hover:underline"
            >
              uwe@factory2key.com.au
            </a>{" "}
            &middot;{" "}
            <a
              href="tel:+61400417043"
              className="text-[#00B5AD] hover:underline"
            >
              +61 400 417 043
            </a>
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
