// estates.ts — the single estate registry.
//
// One source of truth for every Factory2Key development. The landing-page Australia map, the
// per-state pages, the landing cards, and (optionally) the nav all read from here, so a newly
// onboarded estate appears everywhere by adding ONE entry — no more hardcoded lists drifting
// across page.tsx, ProjectsHeader.tsx and blog-config.ts.
//
// coords drive the map pins (lat/lng → projected via src/lib/australia-map.ts). An estate with
// coords: null (e.g. a multi-state programme) is listed but not pinned on the map.

export type StateAbbr = "WA" | "NT" | "SA" | "QLD" | "NSW" | "VIC" | "TAS" | "ACT";

export interface Estate {
  slug: string;
  name: string;
  shortName: string;
  stateAbbr: StateAbbr | "MULTI";
  stateName: string;
  location: string;
  coords: { lat: number; lng: number } | null;
  href: string;
  status: string;
  type: string;
  dwellings: string;
  blurb: string;
  accent: string; // estate brand accent (pin + card hover)
  image: string;
  cta: string;
  // --- analytics (FTK analytics Phase 1) ---
  // Supabase table holding this estate's lot/home enquiries — the conversion numerator.
  // Absent = this estate has no lot-enquiry funnel (e.g. a journey/waitlist model), so the
  // dashboard renders conversion as N/A rather than a misleading 0%.
  registrationsTable?: string;
  // Include this estate in the analytics dashboard. Traffic (from Umami, filtered by `href`)
  // is tracked for every estate; conversion only where `registrationsTable` is set.
  trackAnalytics?: boolean;
}

export const ESTATES: Estate[] = [
  {
    slug: "seafields",
    name: "Seafields Estate",
    shortName: "Seafields",
    stateAbbr: "WA",
    stateName: "Western Australia",
    location: "Waggrakine, Geraldton WA",
    coords: { lat: -28.7101667, lng: 114.6471437 },
    href: "/seafields-estate",
    status: "Registration Open",
    type: "Residential Subdivision",
    dwellings: "145 lots",
    blurb:
      "145-lot residential subdivision 8km north of Geraldton CBD. Vacant serviced land or house & land packages with Factory2Key modular build.",
    accent: "#C77F3A",
    image: "/seafields/masterplan.jpg",
    cta: "Select your lot",
    registrationsTable: "seafields_registrations",
    trackAnalytics: true,
  },
  {
    slug: "wavecrest",
    name: "Wavecrest Estate",
    shortName: "Wavecrest",
    stateAbbr: "WA",
    stateName: "Western Australia",
    location: "Waggrakine, Geraldton WA",
    coords: { lat: -28.705, lng: 114.652 }, // nudged off Seafields (same locality) so pins don't stack
    href: "/wavecrest-estate",
    status: "Coming Soon",
    type: "Residential Subdivision",
    dwellings: "~1,860 lots",
    blurb:
      "~1,860-lot structure-planned coastal estate in Geraldton's growth corridor. Stage 2 approved, Stage 3 coming. Vacant land or house & land packages.",
    accent: "#2B7FB8",
    image: "/wavecrest/site-photo-01.jpg",
    cta: "Register interest",
    registrationsTable: "wavecrest_registrations",
    trackAnalytics: true,
  },
  {
    slug: "dutton-terrace",
    name: "Dutton Terrace",
    shortName: "Dutton Terrace",
    stateAbbr: "SA",
    stateName: "South Australia",
    location: "Tumby Bay, SA (Eyre Peninsula)",
    coords: { lat: -34.380017, lng: 136.095408 },
    href: "/dutton-terrace-estate",
    status: "Concept Stage",
    type: "Master-Planned Community",
    dwellings: "~40 homes",
    blurb:
      "A proposed master-planned community — ~40 family homes plus childcare and aged-care on 6.3 ha at Tumby Bay. Concept stage; register your interest.",
    accent: "#00B5AD",
    image: "", // no render yet (concept stage) — card shows an accent placeholder
    cta: "Register interest",
    registrationsTable: "dutton_registrations",
    trackAnalytics: true,
  },
  {
    slug: "branscombe",
    name: "Branscombe Estate",
    shortName: "Branscombe",
    stateAbbr: "TAS",
    stateName: "Tasmania",
    location: "Claremont, Tasmania",
    coords: { lat: -42.7953373, lng: 147.2393146 },
    href: "/branscombe-estate",
    status: "Registration Open",
    type: "Residential Homes",
    dwellings: "37 homes",
    blurb:
      "37 architecturally designed, single-storey 3-bed, 2-bath homes on an approved subdivision 8km from Hobart CBD. 7-Star Energy rated.",
    accent: "#3E6B48",
    image: "/branscombe/home-exterior-1.jpg",
    cta: "Select your home",
    registrationsTable: "branscombe_registrations",
    trackAnalytics: true,
  },
  {
    slug: "hemp-homes",
    name: "Hemp Homes for Eco-Communities",
    shortName: "Hemp Homes",
    stateAbbr: "MULTI",
    stateName: "Multi-state",
    location: "Eastern seaboard rollout",
    coords: null, // multi-state programme — listed, not pinned
    href: "/hemp-homes-for-eco-communities",
    status: "In Development",
    type: "Sustainable Modular Homes",
    dwellings: "60m² Joey60",
    blurb:
      "Hemp-built 60m² dwellings for Australian eco-communities. Material work, engineering and prototyping underway — follow the build openly.",
    accent: "#1B4332",
    image: "/hemp-homes/koala70-placeholder-exterior.png",
    cta: "Walk the journey",
    // No lot-enquiry funnel (journey/waitlist model) → conversion renders N/A.
    trackAnalytics: true,
  },
];

// Recognised Australian state colours (sporting/heraldic), muted slightly for an off-white canvas.
// Each state a distinct, "relevant" colour per the landing-map brief.
export const STATE_COLORS: Record<StateAbbr, string> = {
  WA: "#D6A53C", // gold & black
  NT: "#C0612A", // ochre / red-centre
  SA: "#B23A48", // red, blue & gold
  QLD: "#7C2236", // maroon
  NSW: "#4F9DD0", // sky blue
  VIC: "#22416B", // navy
  TAS: "#1F6E54", // bottle green
  ACT: "#2E4A8A", // blue & gold
};

export const STATE_NAMES: Record<StateAbbr, string> = {
  WA: "Western Australia",
  NT: "Northern Territory",
  SA: "South Australia",
  QLD: "Queensland",
  NSW: "New South Wales",
  VIC: "Victoria",
  TAS: "Tasmania",
  ACT: "Australian Capital Territory",
};

export const ALL_STATE_ABBRS: StateAbbr[] = ["WA", "NT", "SA", "QLD", "NSW", "VIC", "TAS", "ACT"];

/** Estates physically located in a given state (excludes MULTI-state programmes). */
export function estatesInState(abbr: StateAbbr): Estate[] {
  return ESTATES.filter((e) => e.stateAbbr === abbr);
}

/** Estates with a map pin (have coords). */
export function pinnedEstates(): Estate[] {
  return ESTATES.filter((e) => e.coords !== null);
}

/** Multi-state / unpinned programmes. */
export function multiStateEstates(): Estate[] {
  return ESTATES.filter((e) => e.stateAbbr === "MULTI");
}

export function estateBySlug(slug: string): Estate | undefined {
  return ESTATES.find((e) => e.slug === slug);
}

/** Estates included in the analytics dashboard (traffic tracked for all of these). */
export function trackedEstates(): Estate[] {
  return ESTATES.filter((e) => e.trackAnalytics);
}

/** State abbrs that currently have at least one estate (for the map's "active" styling). */
export function activeStateAbbrs(): Set<StateAbbr> {
  return new Set(
    ESTATES.filter((e): e is Estate & { stateAbbr: StateAbbr } => e.stateAbbr !== "MULTI").map(
      (e) => e.stateAbbr,
    ),
  );
}
