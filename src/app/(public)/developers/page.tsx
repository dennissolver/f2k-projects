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

      {/* ===== HOW IT WORKS ===== */}
      <section className="bg-white border-b border-black/5">
        <div className="max-w-[1100px] mx-auto px-4 py-10">
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
                <div className="shrink-0 h-9 w-9 rounded-full bg-[#00B5AD] text-white font-playfair font-black flex items-center justify-center">
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
      <section className="py-10 px-4 bg-warm-grey">
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
