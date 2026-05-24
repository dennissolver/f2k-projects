import { Metadata } from "next";
import HeroSitePlan from "@/components/seafields/HeroSitePlan";
import RegistrationForm from "@/components/seafields/RegistrationForm";
import {
  DesignGallery,
  type Design,
} from "@caistech/property-launch-kit/components";

const SEAFIELDS_DESIGNS: Design[] = [
  {
    name: "Joey",
    size: "≈100m² overall",
    beds: "2 bed · 1 bath",
    tag: "ANCILLARY / DOWNSIZER",
    detail:
      "Compact modular — bed × 2, single bath, carport + verandah. Ideal as a downsizer, holiday let, or second dwelling on a larger lot.",
    hero: "/seafields/designs/joey-floor-plan.png",
    plan: "/seafields/designs/joey-floor-plan.png",
    secondary: {
      label: "Elevations",
      href: "/seafields/designs/joey-elevations.png",
    },
    priceFrom: "$297,900",
    priceLabel: "House only — from",
  },
  {
    name: "Koala",
    size: "≈110m² overall",
    beds: "ADU configuration",
    tag: "ANCILLARY / DUAL-OCC",
    detail:
      "Ancillary dwelling unit — slightly larger footprint than Joey, suitable for granny flat / dual-occupancy use on lots ≥600m² under R20.",
    hero: "/seafields/designs/joey-floor-plan.png",
    plan: "/seafields/designs/koala-floor-plan.pdf",
    secondary: {
      label: "Option 2",
      href: "/seafields/designs/koala-option-2.pdf",
    },
    priceFrom: "$327,700",
    priceLabel: "House only — from",
  },
  {
    name: "3x2 Modular",
    size: "158m²",
    beds: "3 bed · 2 bath",
    tag: "GROH ELIGIBLE",
    detail:
      "GROH-approved 3-bedroom 2-bathroom modular home. Government Regional Officer Housing eligible. Suitable for first-home buyers and small families. House & land pricing on application.",
    hero: "/seafields/designs/3x2-floor-plan.png",
    plan: "/seafields/designs/3x2-floor-plan.pdf",
    priceFrom: "Price on application",
    priceLabel: "",
  },
  {
    name: "4x2 Modular",
    size: "162m²",
    beds: "4 bed · 2 bath",
    tag: "GROH ELIGIBLE",
    detail:
      "GROH-approved 4-bedroom 2-bathroom modular home. Larger family layout with the same modular delivery economics.",
    hero: "/seafields/designs/4x2-floor-plan.png",
    plan: "/seafields/designs/4x2-floor-plan.pdf",
    priceFrom: "$680,000",
  },
  {
    name: "BigRoo",
    size: "≈310m²",
    beds: "4 bed · 2 bath + Theatre",
    tag: "PREMIUM",
    detail:
      "Premium ≈310m² modular with dedicated theatre room and walk-in robes. Architect-designed kitchen feature. The flagship family home.",
    hero: "/seafields/designs/murchison-floor-plan.png",
    plan: "/seafields/designs/murchison-floor-plan.png",
    priceFrom: "$829,700",
  },
  {
    name: "Wombat",
    size: "191m²",
    beds: "4 bed · 2 bath",
    tag: "FAMILY HOME",
    detail:
      "WAM Napier-series 4-bedroom 2-bathroom modular home, 191m². Plans and house & land pricing are being finalised — contact Uwe for early details.",
    hero: null,
    plan: null,
    priceFrom: "Pricing TBC",
    priceLabel: "",
    placeholder: true,
  },
];

export const metadata: Metadata = {
  title: "Seafields Estate — Register Your Interest | F2K",
  description:
    "145-lot residential subdivision in Waggrakine, Geraldton WA. Vacant serviced land or house & land packages. Register your interest — no deposit required.",
};

export default function SeafieldsEstatePage() {
  return (
    <>
      {/* ===== DISCLAIMER BANNER ===== */}
      <div className="bg-[#1A2744] text-white/80 text-xs font-archivo text-center py-2.5 px-4 leading-relaxed">
        <strong className="text-white">REGISTRATION OF INTEREST ONLY</strong> —
        No deposit is required or accepted. Registering does not create any
        legal or financial obligation.
      </div>

      {/* ===== HERO ===== */}
      <section className="relative bg-[#1A2744] text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1A2744] via-[#1A2744] to-[#00B5AD]/20" />

        <div className="relative max-w-[1100px] mx-auto px-4 py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
                A Factory2Key Development
              </p>
              <h1 className="font-playfair text-[clamp(2.5rem,5vw,4rem)] font-black leading-[1.1] mb-6">
                Seafields Estate
              </h1>
              <p className="text-xl text-white/70 font-archivo leading-relaxed mb-2">
                145 residential lots — vacant land or house &amp; land packages.
              </p>
              <p className="text-lg text-white/50 font-archivo mb-8">
                Waggrakine, Geraldton WA — 8km from Geraldton CBD
              </p>
              <p className="text-white/60 font-archivo leading-relaxed mb-8 max-w-lg">
                Select your preferred lot on the subdivision plan — no deposit,
                no commitment. Available as vacant serviced land or as a
                complete house &amp; land package with Factory2Key modular
                construction. We&apos;ll keep you informed as the project
                progresses.
              </p>
              <a
                href="#site-map"
                className="inline-block bg-[#00B5AD] hover:bg-[#009E97] text-white px-8 py-3.5 font-archivo font-semibold transition-colors"
              >
                Select your lot &rarr;
              </a>
            </div>

            {/* Hero plan — vector SVG rendered from CLE 08B DWG polygons */}
            <div>
              <div className="border border-white/10 bg-white/5 p-3">
                <HeroSitePlan />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="font-ibm-mono text-[0.55rem] tracking-[0.3em] uppercase text-white/50 self-center mr-1">
                  Stages:
                </span>
                {[
                  { label: "1", color: "#B7D5EC", border: "#5694C3" },
                  { label: "2", color: "#F5E7D6", border: "#C7A877" },
                  { label: "3", color: "#F4B0A6", border: "#D06A5B" },
                  { label: "4", color: "#F7E877", border: "#BFA024" },
                  { label: "5", color: "#B8D99B", border: "#6B9B4A" },
                  { label: "6", color: "#C9B2D5", border: "#8A6AA7" },
                  { label: "7", color: "#D6D6D6", border: "#9A9A9A" },
                ].map((s) => (
                  <span
                    key={s.label}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[0.65rem] font-archivo font-semibold text-deep-blue border"
                    style={{
                      backgroundColor: s.color,
                      borderColor: s.border,
                    }}
                  >
                    Stage {s.label}
                  </span>
                ))}
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
              { value: "145", label: "Lots" },
              { value: "445–1522m²", label: "Lot sizes" },
              { value: "From $155k", label: "Land pricing" },
              { value: "From $485k", label: "H&L packages" },
              { value: "From Q3 2026", label: "Stage 1 release" },
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
            Land &amp; Lifestyle in Geraldton&apos;s Growth Corridor
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="text-slate font-archivo leading-relaxed space-y-4">
              <p>
                Seafields Estate is a 145-lot residential subdivision in
                Waggrakine, approximately 8km north of Geraldton CBD. The estate
                is part of a larger ~300-lot development, with over 155 lots
                already sold since 2012.
              </p>
              <p>
                All lots are flat and require minimal earthworks. Reticulated
                water, sewer, and power will be connected as part of subdivision
                works prior to titling, expected around September 2026. Lots
                will be available as vacant serviced land (titled, ready to
                build) or as complete house &amp; land packages with Factory2Key
                modular construction.
              </p>
              <p>
                The $188M Geraldton Health Campus redevelopment, alongside other
                governmental, corporate, and private demand drivers, is driving
                significant demand for housing in the area. Strong early uptake
                has already been signalled — register your interest now to
                avoid disappointment.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { label: "Developer", value: "Factory2Key Pty Ltd" },
                { label: "Location", value: "Pepper Gate, Waggrakine WA 6530" },
                { label: "Zoning", value: "R20 Residential" },
                { label: "Lots", value: "145 residential (staged release)" },
                { label: "Lot Sizes", value: "445m² – 1,522m² (avg 610m²)" },
                { label: "Land Area", value: "8.84 hectares saleable" },
                { label: "Terrain", value: "Flat — minimal earthworks" },
                { label: "Services", value: "Water, sewer, power (reticulated)" },
                { label: "Planner", value: "CLE Town Planning + Design" },
                { label: "Plan Reference", value: "CLE 3027-08B-01 (22 Apr 2026, WAPC 202888)" },
                { label: "Covenant", value: "Estate covenant applies — available on request" },
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

      {/* ===== STAGING ===== */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-[900px] mx-auto">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            Development Staging
          </p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-3">
            Stages 1–3 Open Now — 43 Lots
          </h2>
          <p className="text-slate font-archivo leading-relaxed mb-8 max-w-[700px]">
            Seafields Estate releases in seven stages.{" "}
            <strong>Stages 1 and 3 are open for registration now</strong>{" "}
            (43 lots across the SW Block and Central precincts); Stages 4–7
            release sequentially as the open stages fill. Stage 2 is a single
            retained heritage lot and is not part of the sale. Pricing is set by
            lot size, not by stage, so registering early gives you the best pick
            of available lots without paying a stage premium.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { stage: "Stage 1", lots: "20", area: "SW Block — Launch", rate: "From $155k", state: "OPEN" },
              { stage: "Stage 2", lots: "1",  area: "Heritage — retained", rate: "Not for sale", state: "RESERVED" },
              { stage: "Stage 3", lots: "23", area: "Central",          rate: "From $155k", state: "OPEN" },
              { stage: "Stage 4", lots: "12", area: "East",             rate: "From $155k", state: "LOCKED" },
              { stage: "Stage 5", lots: "25", area: "North",            rate: "From $155k", state: "LOCKED" },
              { stage: "Stage 6", lots: "35", area: "Central Upper",    rate: "From $155k", state: "LOCKED" },
              { stage: "Stage 7", lots: "29", area: "NW Premium",       rate: "From $155k", state: "LOCKED" },
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
                  LOTS
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

          <div className="bg-off-white border border-black/5 p-4 text-center">
            <div className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-slate/60 mb-1">
              Total Estate
            </div>
            <div className="font-archivo text-sm text-deep-blue">
              <strong>145 freehold lots</strong> &middot; CLE Plan 3027-08B-01,
              WAPC 202888 &middot; vacant land $155k–$190k by lot size
            </div>
          </div>
        </div>
      </section>

      {/* ===== LOT CATEGORIES ===== */}
      <section className="py-16 px-4 bg-warm-grey">
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
                desc: "Titled, serviced lots ready to build. Bring your own builder or hold as an investment. From $155,000 — pricing set by lot size band.",
              },
              {
                title: "House & Land Package",
                desc: "Complete turnkey modular home by Factory2Key. Lot + 2, 3, 4 or 5-bedroom modular build + site works. From $485,000.",
              },
            ].map((opt) => (
              <div
                key={opt.title}
                className="bg-white p-6 border border-black/5"
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

      {/* ===== HOME DESIGNS ===== */}
      <section className="py-16 px-4 bg-off-white">
        <div className="max-w-[1100px] mx-auto">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            Factory2Key Home Designs
          </p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-3">
            Modular Homes Built to Plan
          </h2>
          <p className="text-slate font-archivo leading-relaxed mb-8 max-w-[760px]">
            Every Factory2Key home is a factory-built modular dwelling delivered
            to site as complete modules and assembled on a prepared slab. Our
            range spans ancillary dwellings through to large family homes — pick
            a design at registration time and we&apos;ll quote you against your
            selected lot. Indicative time-to-build from site arrival is 12–14
            weeks.
          </p>

          <div className="mb-8">
            <DesignGallery designs={SEAFIELDS_DESIGNS} />
          </div>

          <p className="font-archivo text-xs text-slate/60 leading-relaxed">
            Indicative pricing only. Final price depends on lot size,
            site-works, finish selections, and any approved variations. Time-to-
            build is from site delivery, not from contract — typical
            contract-to-delivery is an additional 8–12 weeks for finance,
            planning, and module manufacture.
          </p>
        </div>
      </section>

      {/* ===== PURCHASE TERMS ===== */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-[900px] mx-auto">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            Sales Terms
          </p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-3">
            Purchase Terms
          </h2>
          <p className="text-slate font-archivo leading-relaxed mb-8 max-w-[700px]">
            Indicative contract terms for both vacant land and house &amp; land
            packages at Seafields Estate. Full contract documentation is
            provided at contract stage.
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
                value: "45 days",
                note: "Finance approval window from contract date",
              },
              {
                label: "Settlement",
                value: "30 days",
                note: "Settlement period after finance approval",
              },
              {
                label: "Covenant",
                value: "Applies",
                note: "Estate covenant — available on request",
              },
            ].map((term) => (
              <div
                key={term.label}
                className="bg-off-white border border-black/5 p-5"
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
            contract. The estate covenant restricts certain construction and
            land-use choices to protect the character of the development —{" "}
            <a
              href="mailto:uwe@factory2key.com.au?subject=Seafields%20Estate%20covenant%20request"
              className="text-[#00B5AD] hover:underline"
            >
              email Uwe
            </a>{" "}
            for the full document.
          </p>
        </div>
      </section>

      {/* ===== INTERACTIVE MAP + REGISTRATION FORM ===== */}
      <section className="py-20 px-4 bg-off-white">
        <div className="max-w-[1200px] mx-auto">
          <RegistrationForm />
        </div>
      </section>

      {/* ===== PRIVACY NOTE ===== */}
      <section className="py-8 px-4 bg-[#1A2744]">
        <div className="max-w-[900px] mx-auto">
          <p className="text-white/40 text-xs font-archivo leading-relaxed text-center">
            Registration data collected on this page is used by Factory2Key Pty
            Ltd for project communications only and is not shared with any third
            party for marketing. Any registration of interest shall not be
            construed as a promise to buy or sell.{" "}
            <a
              href="/privacy"
              className="text-[#00B5AD]/60 hover:text-[#00B5AD] underline transition-colors"
            >
              View our Privacy Policy
            </a>
          </p>
        </div>
      </section>

      {/* ===== CONTACT ===== */}
      <section className="py-10 px-4 bg-warm-grey">
        <div className="max-w-[900px] mx-auto text-center">
          <p className="font-archivo text-sm text-slate mb-3">
            Questions about Seafields Estate?
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
