import Link from "next/link";
import { redirect } from "next/navigation";

const currentDevelopments = [
  {
    name: "Wavecrest Estate",
    location: "Waggrakine, Geraldton WA",
    state: "WA",
    dwellings: "~1,860 lots",
    type: "Residential Subdivision",
    status: "Coming Soon",
    desc: "~1,860-lot structure-planned coastal estate in Geraldton's growth corridor. Stage 2 approved, Stage 3 coming. Vacant land or house & land packages.",
    image: "/wavecrest/site-photo-01.jpg",
    href: "/wavecrest-estate",
    cta: "Register interest",
  },
  {
    name: "Seafields Estate",
    location: "Waggrakine, Geraldton WA",
    state: "WA",
    dwellings: "145 lots",
    type: "Residential Subdivision",
    status: "Registration Open",
    desc: "145-lot residential subdivision 8km north of Geraldton CBD. Vacant serviced land or house & land packages with Factory2Key modular build.",
    image: "/seafields/masterplan.jpg",
    href: "/seafields-estate",
    cta: "Select your lot",
  },
  {
    name: "Branscombe Estate",
    location: "Claremont, Tasmania",
    state: "TAS",
    dwellings: "37 homes",
    type: "Residential Homes",
    status: "Registration Open",
    desc: "37 architecturally designed, single-storey 3-bedroom, 2-bathroom homes on an approved subdivision 8km from Hobart CBD. 7 Star Energy rated.",
    image: "/branscombe/home-exterior-1.jpg",
    href: "/branscombe-estate",
    cta: "Select your home",
  },
  {
    name: "Hemp Homes for Eco-Communities",
    location: "Eastern seaboard rollout",
    state: "Multi-state",
    dwellings: "60m² Joey60",
    type: "Sustainable Modular Homes",
    status: "In Development",
    desc: "Hemp-built 60m² dwellings for Australian eco-communities. Material work, engineering and prototyping underway — follow the build openly.",
    image: "/hemp-homes/koala70-placeholder-exterior.png",
    href: "/hemp-homes-for-eco-communities",
    cta: "Walk the journey",
  },
];

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

  return (
    <>
      <section className="bg-off-white py-16 md:py-20 px-4 border-b border-black/5">
        <div className="max-w-[1100px] mx-auto">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-ember mb-4">
            Our Current Developments
          </p>
          <h1 className="font-playfair text-[clamp(2rem,4vw,3rem)] font-black text-deep-blue leading-tight mb-4">
            Factory2Key Projects
          </h1>
          <p className="text-lg text-slate leading-relaxed font-archivo max-w-[750px] mb-10">
            These are the active Factory2Key-led residential developments.
            Register your interest in a specific lot or home — no deposit is
            required or accepted. Real estate marketing only.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {currentDevelopments.map((p) => (
              <Link
                key={p.name}
                href={p.href}
                className="group bg-white border border-black/5 hover:border-[#00B5AD] transition-colors flex flex-col no-underline overflow-hidden"
              >
                <div className="aspect-[4/3] bg-warm-grey overflow-hidden">
                  <img
                    src={p.image}
                    alt={`${p.name} — ${p.location}`}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-ember">
                      {p.state} · {p.type}
                    </span>
                    <span className="font-archivo text-[0.65rem] font-bold uppercase tracking-wide bg-[#00B5AD]/10 text-[#00B5AD] px-2 py-0.5 rounded-sm whitespace-nowrap">
                      {p.status}
                    </span>
                  </div>
                  <h3 className="font-playfair text-xl font-black text-deep-blue leading-tight mb-1">
                    {p.name}
                  </h3>
                  <p className="font-archivo text-sm text-slate/70 mb-3">
                    {p.location} · {p.dwellings}
                  </p>
                  <p className="font-archivo text-sm text-slate leading-relaxed mb-4 flex-1">
                    {p.desc}
                  </p>
                  <span className="font-archivo text-sm font-semibold text-[#00B5AD] group-hover:underline mt-auto">
                    {p.cta} →
                  </span>
                </div>
              </Link>
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
