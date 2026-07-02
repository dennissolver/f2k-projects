import { Metadata } from "next";
import DeveloperOnboarding from "@/components/developers/DeveloperOnboarding";

export const metadata: Metadata = {
  title: "For Developers — Partner with Factory2Key | F2K",
  description:
    "Are you a property developer with an estate or project in mind? Tell us your vision and Factory2Key will explore building it with you. Talk to our voice guide, share your plans, and we'll be in touch.",
  openGraph: {
    title: "For Developers — Partner with Factory2Key",
    description:
      "Tell us your vision for your estate and Factory2Key will explore building it with you.",
    url: "https://f2k-projects.vercel.app/developers",
    siteName: "Factory2Key Projects",
    type: "website",
  },
};

export default function DevelopersPage() {
  return (
    <>
      {/* ===== HERO ===== */}
      <section className="relative bg-[#1A2744] text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1A2744] via-[#1A2744] to-[#00B5AD]/20" />
        <div className="relative max-w-[1100px] mx-auto px-4 py-20 md:py-24">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            For Property Developers
          </p>
          <h1 className="font-playfair text-[clamp(2.25rem,5vw,3.75rem)] font-black leading-[1.1] mb-6 max-w-3xl">
            Have an estate in mind? Let&apos;s build it together.
          </h1>
          <p className="text-xl text-white/70 font-archivo leading-relaxed mb-3 max-w-2xl">
            Factory2Key partners with developers to bring residential estates to
            life with architecturally-designed modular homes.
          </p>
          <p className="text-lg text-white/50 font-archivo max-w-2xl">
            Tell us about your project — your vision, your goals and how you like
            to do deals. Talk it through with our voice guide, share your plans,
            and we&apos;ll take it from there.
          </p>
        </div>
      </section>

      {/* ===== THE F2K ESTATE PROCESS (end-to-end offer) ===== */}
      <section className="bg-white border-b border-black/5">
        <div className="max-w-[1100px] mx-auto px-4 py-16">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            How it works, end to end
          </p>
          <h2 className="font-playfair text-[clamp(1.75rem,3.5vw,2.5rem)] font-black text-deep-blue leading-tight mb-4 max-w-3xl">
            We prove your estate up before anyone spends big.
          </h2>
          <p className="font-archivo text-slate leading-relaxed mb-12 max-w-2xl">
            Factory2Key doesn&apos;t just build homes — we de-risk the whole
            estate. We validate real demand with real buyers first, so the
            project you take to market is one the market has already told us it
            wants. Here&apos;s the journey, start to finish.
          </p>

          <ol className="space-y-8">
            {[
              {
                step: "1",
                title: "List your estate — and we prove up the plan",
                body: "You tell us about your estate on this page. If you don't have a master plan yet, we develop one for you. If you do, we cross-check it against the site — confirming it's feasible and actually allowed on the property (zoning, planning rules, and site constraints) before anyone commits.",
              },
              {
                step: "2",
                title: "We build your estate page",
                body: "We create a dedicated, professionally-presented page for your estate — the homes, the vision and the opportunity, ready to put in front of the market.",
              },
              {
                step: "3",
                title: "We engage local agents to promote it",
                body: "We bring trusted local real-estate agents on board to take the estate to their networks and their buyers, right where the demand is.",
              },
              {
                step: "4",
                title: "We gather waitlist registrations and read the real signals",
                body: "As interest comes in, we capture waitlist registrations and cross-check them against genuine market signals — real buyer intent, not guesswork. You get an honest read on demand.",
              },
              {
                step: "5",
                title: "Go, adjust, or stop — then we activate",
                body: "From that evidence we decide together whether the estate stands as it is, needs reshaping to suit the market, or shouldn't proceed. Once it's proven up, we firm up the waitlist page, move interested buyers through the sales pipeline we've built, and engage funders to help support the project.",
              },
            ].map((s) => (
              <li key={s.step} className="flex gap-5">
                <div className="shrink-0 h-11 w-11 rounded-full bg-[#00B5AD] text-white font-playfair font-black text-lg flex items-center justify-center">
                  {s.step}
                </div>
                <div className="pt-1">
                  <h3 className="font-archivo font-bold text-deep-blue text-lg mb-1.5">
                    {s.title}
                  </h3>
                  <p className="font-archivo text-slate leading-relaxed max-w-2xl">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ===== WHAT F2K BRINGS (the tangible value: platform + home pipeline) ===== */}
      <section className="bg-[#1A2744] text-white">
        <div className="max-w-[1100px] mx-auto px-4 py-16">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            What we bring to the table
          </p>
          <h2 className="font-playfair text-[clamp(1.75rem,3.5vw,2.5rem)] font-black leading-tight mb-4 max-w-3xl">
            A whole platform and a home pipeline — not just a page.
          </h2>
          <p className="font-archivo text-white/60 leading-relaxed mb-12 max-w-2xl">
            Everything above runs on tooling and supply we&apos;ve already built.
            You get the marketing platform, the buyer and partner portals, and a
            factory-built home pipeline that gives you cost certainty — end to
            end.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pillar A — the estate platform */}
            <div className="bg-white/[0.04] border border-white/10 rounded-lg p-8">
              <h3 className="font-archivo font-bold text-white text-xl mb-2">
                The estate platform
              </h3>
              <p className="font-archivo text-sm text-white/55 leading-relaxed mb-6">
                A purpose-built web platform for your estate — far more than a
                brochure site. Every party in the deal gets their own view.
              </p>
              <ul className="space-y-3">
                {[
                  "Interactive lot map with live lot details — pricing, sizes, status and availability",
                  "Buyer waitlist and registrations captured, tracked and managed for you",
                  "Agent portal — local agents see masked availability and register their own buyers",
                  "Developer portal — your own dashboard of interest, registrations and progress",
                  "Funder portal — an invite-only, login-gated data room where only authorised funders you approve can see the numbers",
                  "Reporting and analytics on genuine demand signals, not guesswork",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <svg
                      className="w-4 h-4 text-[#00B5AD] shrink-0 mt-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="font-archivo text-sm text-white/80 leading-relaxed">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Pillar B — the modular home pipeline */}
            <div className="bg-white/[0.04] border border-white/10 rounded-lg p-8">
              <h3 className="font-archivo font-bold text-white text-xl mb-2">
                The F2K modular home pipeline
              </h3>
              <p className="font-archivo text-sm text-white/55 leading-relaxed mb-6">
                Behind the platform sits a real supply chain of quality
                factory-built homes — so your estate has product to sell and a
                cost you can count on.
              </p>
              <ul className="space-y-3">
                {[
                  "Architecturally-designed modular homes ready to populate your estate",
                  "Factory-built for cost certainty and predictable delivery timelines",
                  "A pipeline of quality homes — consistent, repeatable, and proven",
                  "House-and-land packages buyers can register interest in from day one",
                  "Design flexibility to match the estate's market and price points",
                  "One coordinated partner across land, homes and delivery",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <svg
                      className="w-4 h-4 text-[#00B5AD] shrink-0 mt-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="font-archivo text-sm text-white/80 leading-relaxed">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== GETTING STARTED (the intake — all you do right now) ===== */}
      <section className="bg-off-white border-b border-black/5">
        <div className="max-w-[1100px] mx-auto px-4 py-12">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            Getting started is simple
          </p>
          <h2 className="font-playfair text-[1.75rem] font-black text-deep-blue leading-tight mb-8 max-w-2xl">
            All you need to do today is tell us about it.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                title: "Share your vision",
                body: "Talk to Morgan, our voice guide, or just fill in the form — whatever suits you.",
              },
              {
                step: "2",
                title: "Send us your plans",
                body: "Upload any plans, sketches, drawings or preferred house designs you already have.",
              },
              {
                step: "3",
                title: "We get in touch",
                body: "Our team reviews everything and reaches out to talk through how we can build it with you.",
              },
            ].map((s) => (
              <div key={s.step} className="flex gap-4">
                <div className="shrink-0 h-9 w-9 rounded-full bg-deep-blue text-white font-playfair font-black flex items-center justify-center">
                  {s.step}
                </div>
                <div>
                  <h3 className="font-archivo font-bold text-deep-blue text-sm mb-1">
                    {s.title}
                  </h3>
                  <p className="font-archivo text-sm text-slate leading-relaxed">
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== VOICE AGENT + FORM ===== */}
      <section className="py-16 px-4 bg-off-white">
        <div className="max-w-[820px] mx-auto">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            Developer Onboarding
          </p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-3">
            Tell us about your project
          </h2>
          <p className="text-slate font-archivo leading-relaxed mb-8">
            Everything below is an enquiry only — no commitment on either side.
            The more you tell us, the better prepared we&apos;ll be when we talk.
          </p>

          {/* ===== WHAT YOU'LL NEED ===== */}
          <div className="bg-white border border-black/5 p-6 mb-8">
            <h3 className="font-archivo font-bold text-deep-blue text-base mb-1">
              What you&apos;ll need
            </h3>
            <p className="font-archivo text-sm text-slate/70 mb-4">
              Handy to have ready before you start — but don&apos;t go hunting.
              Bring what you have and leave the rest; Morgan and the form both let
              you skip anything you&apos;re not sure about.
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5">
              {[
                "Your vision — what you want to build, who it's for, what success looks like",
                "The estate / project name and where it is (suburb & postcode)",
                "Planning / zoning status (zoned, DA lodged or approved, concept, or raw land)",
                "Whether you own or control the site (owned, under option, or negotiating)",
                "The land owner's details, if that isn't you (e.g. you're an agent)",
                "The certificate of title, if you have it — it carries the accurate lot details",
                "Any plans, sketches, drawings or preferred house designs to upload",
                "How you'd like to do a deal (sale, joint venture, staged, build-to-rent)",
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <svg
                    className="w-4 h-4 text-[#00B5AD] shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="font-archivo text-sm text-slate leading-relaxed">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <DeveloperOnboarding />
        </div>
      </section>

      {/* ===== CONTACT ===== */}
      {/* Extra bottom padding leaves clear space for the fixed SayFix pill (bottom-left) to rest
          over, so it doesn't overlap the Submit CTA or these contact links on mobile. */}
      <section className="pt-10 pb-28 sm:pb-16 px-4 bg-warm-grey">
        <div className="max-w-[900px] mx-auto text-center">
          <p className="font-archivo text-sm text-slate mb-2">
            Prefer to talk to a person first?
          </p>
          <p className="font-archivo text-deep-blue font-semibold">
            Dennis McMahon —{" "}
            <a
              href="mailto:dennis@factory2key.com.au?subject=Developer%20partnership%20enquiry"
              className="text-[#00B5AD] hover:underline"
            >
              dennis@factory2key.com.au
            </a>{" "}
            &middot;{" "}
            <a href="tel:+61402612471" className="text-[#00B5AD] hover:underline">
              +61 402 612 471
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
