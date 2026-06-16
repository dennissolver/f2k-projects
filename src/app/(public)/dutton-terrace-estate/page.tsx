import { Metadata } from "next";
import { getStaticMapUrl } from "@caistech/mapbox";
import RegistrationForm from "@/components/dutton/RegistrationForm";
import { DUTTON_PARCEL } from "@/data/dutton-parcel";
import { ringToSvgPoints, type StaticFrame } from "@/lib/static-map-overlay";

// Dutton Terrace, Tumby Bay SA 5605 — geocoded (Eyre Peninsula coast, ~640 km W of Adelaide).
const DUTTON = { lat: -34.380017, lng: 136.095408 };

// The satellite frame the parcel outline is drawn over. zoom 16 frames a ~6.3 ha block (≈255 px)
// inside a 640×380 image with surrounding context. The overlay SVG shares this width/height as its
// viewBox, so the vector outline lines up with the raster. Keep zoom in sync with `parcelMap` below.
const PARCEL_FRAME: StaticFrame = {
  centerLng: DUTTON.lng,
  centerLat: DUTTON.lat,
  zoom: 16,
  width: 640,
  height: 380,
};

// Dutton Terrace — first Archetype-C (master-planned / mixed-use) worked build.
// Early/concept stage: hero + stats + land-use mix + register-interest. No interactive lot map
// or pricing yet (the land is unzoned). noindex while it's a review draft, not a launched estate.
export const metadata: Metadata = {
  title: "Dutton Terrace — Register Your Interest | Factory2Key",
  description:
    "Dutton Terrace — a proposed master-planned community at Tumby Bay, South Australia (Eyre Peninsula): ~40 family homes plus childcare and aged-care, on 6.3 ha. Concept stage — register your interest.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Dutton Terrace — a proposed master-planned community (SA)",
    description:
      "~40 family homes + childcare + aged-care on 6.3 ha. Concept stage — register your interest.",
    url: "https://f2k-projects.vercel.app/dutton-terrace-estate",
    siteName: "Factory2Key Projects",
    type: "website",
  },
};

const STATS = [
  { value: "~40", label: "Homes / Lots" },
  { value: "6.31 ha", label: "Site Area" },
  { value: "Mixed-Use", label: "Resi + Care" },
  { value: "Concept", label: "Stage" },
];

const LAND_USE = [
  { use: "Residential", detail: "~40 single-family lots", status: "Proposed" },
  { use: "Childcare Centre", detail: "Designated area within the plan", status: "Proposed" },
  { use: "Aged-Care Facility", detail: "Designated area within the plan", status: "Proposed" },
];

const DETAILS: [string, string][] = [
  ["Location", "Dutton Terrace, Tumby Bay, SA 5605"],
  ["Site Area", "6.306 ha"],
  ["Homes", "~40 single-family residential"],
  ["Land Uses", "Residential · Childcare · Aged-care"],
  ["Parcel", "Allotment 50, Deposited Plan 90582"],
  ["Zoning", "Unzoned — rezoning to be progressed"],
  ["Stage", "Concept · site assessment underway"],
];

export default function DuttonTerraceEstatePage() {
  const regionMap = getStaticMapUrl(DUTTON.lat, DUTTON.lng, { width: 640, height: 380, zoom: 5, style: "streets-v12" });
  // Satellite map framed on the parcel (zoom must match PARCEL_FRAME so the outline aligns).
  const parcelMap = getStaticMapUrl(DUTTON.lat, DUTTON.lng, { width: 640, height: 380, zoom: PARCEL_FRAME.zoom, style: "satellite-streets-v12" });
  const parcelPoints = ringToSvgPoints(DUTTON_PARCEL.ring, PARCEL_FRAME);
  return (
    <div className="dt-page">
      {/* ===== HERO ===== */}
      <section className="relative bg-[#1A2744] text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1A2744] via-[#1A2744] to-[#00B5AD]/20" />
        <div className="relative max-w-[1100px] mx-auto px-4 py-20 md:py-28">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">
            A Factory2Key Project · Concept Stage
          </p>
          <h1 className="font-playfair text-[clamp(2.5rem,5vw,4rem)] font-black leading-[1.1] mb-6">
            Dutton Terrace
          </h1>
          <p className="text-xl text-white/75 font-archivo leading-relaxed mb-2 max-w-2xl">
            A proposed master-planned community — ~40 family homes alongside a childcare centre and
            an aged-care facility.
          </p>
          <p className="text-lg text-white/50 font-archivo mb-8">
            Tumby Bay · South Australia (Eyre Peninsula) · 6.3 ha
          </p>
          <p className="text-white/60 font-archivo leading-relaxed mb-8 max-w-lg">
            Dutton Terrace is at an early concept stage. Register your interest to help shape the
            masterplan and be first to hear as lots, home designs and pricing are confirmed — no
            deposit, no commitment.
          </p>
          <a
            href="#register"
            className="inline-block bg-[#00B5AD] hover:bg-[#009E97] text-white px-8 py-3.5 font-archivo font-semibold transition-colors"
          >
            Register Your Interest &rarr;
          </a>
        </div>
      </section>

      {/* ===== KEY STATS ===== */}
      <section className="bg-white border-b border-black/5">
        <div className="max-w-[1100px] mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="font-playfair text-2xl md:text-3xl font-black text-deep-blue">{s.value}</div>
                <div className="font-ibm-mono text-[0.6rem] tracking-[0.3em] uppercase text-slate/60 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ABOUT + DETAILS ===== */}
      <section className="py-16 px-4 bg-off-white">
        <div className="max-w-[900px] mx-auto">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">About the Development</p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-6">
            A community designed around how people actually live
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="text-slate font-archivo leading-relaxed space-y-4">
              <p>
                Dutton Terrace is a proposed master-planned community on a 6.3-hectare site at
                Tumby Bay, on South Australia&apos;s Eyre Peninsula coast. The vision pairs around <strong>40 single-family homes</strong> with
                the services a growing community needs — a <strong>childcare centre</strong> and an
                <strong> aged-care facility</strong> — so families and older residents can live in the
                same neighbourhood.
              </p>
              <p>
                Factory2Key delivers the homes as factory-built modular dwellings, assembled on site —
                the same delivery model proven across our other Western Australian estates.
              </p>
              <p className="text-sm text-slate/70">
                The site is currently unzoned and at concept stage. Registering interest now helps us
                size the right mix of homes and progress planning with real demand behind it.
              </p>
            </div>
            <div className="space-y-3">
              {DETAILS.map(([label, value]) => (
                <div key={label} className="flex border-b border-black/5 pb-2">
                  <span className="font-ibm-mono text-[0.65rem] tracking-wider uppercase text-slate/50 w-28 shrink-0 pt-0.5">{label}</span>
                  <span className="font-archivo text-sm text-deep-blue">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== LOCATION MAP ===== */}
      {(regionMap || parcelMap) && (
        <section className="py-16 px-4 bg-warm-grey">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">Location</p>
            <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-2">Tumby Bay, Eyre Peninsula</h2>
            <p className="text-slate font-archivo leading-relaxed mb-6 max-w-[760px]">
              Dutton Terrace sits at Tumby Bay — a coastal town on South Australia&apos;s Eyre Peninsula,
              on the shores of Spencer Gulf. The dashed outline shows the <strong>indicative ~6.3 ha site
              extent</strong>; the exact lot boundaries follow once the deposited plan is confirmed and the
              subdivision is approved.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {regionMap && (
                <figure className="bg-white p-2 border border-black/5">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={regionMap} alt="Where Dutton Terrace sits in South Australia" className="w-full h-auto" />
                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#00B5AD] ring-2 ring-white" aria-hidden />
                  </div>
                  <figcaption className="font-ibm-mono text-[0.6rem] tracking-[0.2em] uppercase text-slate/60 mt-2 text-center">Where in South Australia</figcaption>
                </figure>
              )}
              {parcelMap && (
                <figure className="bg-white p-2 border border-black/5">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={parcelMap} alt="Dutton Terrace, Tumby Bay — indicative site extent on satellite imagery" className="w-full h-auto" />
                    {/* Parcel outline overlay. viewBox matches PARCEL_FRAME so the vector outline
                        lines up with the raster; preserveAspectRatio="none" keeps it locked to the
                        responsively-scaled image. Dashed + labelled because it is indicative, not surveyed. */}
                    <svg
                      className="absolute inset-0 w-full h-full"
                      viewBox={`0 0 ${PARCEL_FRAME.width} ${PARCEL_FRAME.height}`}
                      preserveAspectRatio="none"
                      aria-hidden
                    >
                      <polygon
                        points={parcelPoints}
                        fill="#00B5AD"
                        fillOpacity={0.18}
                        stroke="#00B5AD"
                        strokeWidth={2.5}
                        strokeDasharray="8 5"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="absolute top-2 left-2 bg-[#1A2744]/85 text-white font-ibm-mono text-[0.55rem] tracking-[0.15em] uppercase px-2 py-1 rounded">
                      Indicative extent
                    </span>
                  </div>
                  <figcaption className="font-ibm-mono text-[0.6rem] tracking-[0.2em] uppercase text-slate/60 mt-2 text-center">Indicative site extent · Tumby Bay</figcaption>
                </figure>
              )}
            </div>
            <p className="font-archivo text-xs text-slate/50 mt-3">Maps © Mapbox © OpenStreetMap. The outline is an indicative ~6.3 ha extent centred on the site, not a surveyed boundary; the exact parcel (Allotment 50, Deposited Plan 90582) and subdivision layout follow planning confirmation.</p>
          </div>
        </section>
      )}

      {/* ===== LAND-USE MIX (the mixed-use / Archetype-C core) ===== */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-[900px] mx-auto">
          <p className="font-ibm-mono text-[0.65rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-4">The Masterplan Mix</p>
          <h2 className="font-playfair text-[2rem] font-black text-deep-blue leading-tight mb-6">More than a subdivision</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {LAND_USE.map((u) => (
              <div key={u.use} className="bg-off-white p-6 border border-black/5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-playfair text-lg font-black text-deep-blue">{u.use}</h3>
                  <span className="font-ibm-mono text-[0.5rem] tracking-[0.2em] uppercase bg-slate/15 text-slate/70 px-1.5 py-0.5 rounded">{u.status}</span>
                </div>
                <p className="font-archivo text-sm text-slate leading-relaxed">{u.detail}</p>
              </div>
            ))}
          </div>
          <div className="bg-amber-50 border-l-4 border-amber-400 px-4 py-3 mt-6">
            <p className="font-archivo text-sm text-amber-900 leading-relaxed">
              <strong>Lot plans &amp; pricing coming as planning progresses.</strong> The estate is
              unzoned today — a detailed subdivision plan, lot selection and pricing will follow once
              rezoning and approvals advance. Register below and we&apos;ll bring you along.
            </p>
          </div>
        </div>
      </section>

      {/* ===== REGISTER ===== */}
      <section className="py-16 px-4 bg-warm-grey">
        <div className="max-w-[900px] mx-auto">
          <RegistrationForm />
        </div>
      </section>

      {/* ===== DISCLAIMER ===== */}
      <section className="py-10 px-4 bg-white border-t border-black/5">
        <div className="max-w-[900px] mx-auto">
          <p className="font-archivo text-xs text-slate/60 leading-relaxed">
            Dutton Terrace is a proposed development at concept stage. All information shown —
            including the homes, land uses, site area, and the masterplan vision — is indicative only
            and subject to site control, rezoning, planning approval and final confirmation. Nothing
            here is an offer, and registering interest creates no obligation on either side.
          </p>
        </div>
      </section>
    </div>
  );
}
