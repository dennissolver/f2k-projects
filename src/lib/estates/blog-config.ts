/**
 * Estate blog/gallery configuration. One shared blog+gallery system, driven by
 * this per-estate config — Branscombe + Seafields are added here (with their own
 * tables) once Hemp Homes proves the template. Per-estate tables keep each
 * estate's photos structurally separate (a Branscombe photo can never surface in
 * a Hemp Homes blog).
 */
export type EstateSlug = "hemp-homes" | "branscombe" | "seafields";

export interface EstateBlogConfig {
  slug: EstateSlug;
  name: string;
  /** Explanatory header copy for the blog/gallery page (what / why). */
  intro: string;
  accent: string; // hex
  /** Link back to the estate's marketing landing page. */
  landingPath: string;
  /** Supabase table names — parameterise the shared queries per estate. */
  postsTable: string;
  mediaTable: string;
  postMediaTable: string;
  /** Supabase Storage bucket for this estate's media (admin uploads). */
  bucket: string;
  /** Whether Google Drive sync is wired for this estate (false → direct upload only). */
  driveEnabled: boolean;
  /** Estate-specific facts + guardrails injected into the AI post-drafter prompt. */
  aiContext: string;
  /** Table holding this estate's email subscribers (must have an `email` column). */
  subscriberTable: string;
}

// Only estates with a configured (and migrated) blog appear here. Unlisted
// slugs 404 on /blog/<slug>. Branscombe + Seafields land here in step 2.
export const ESTATE_BLOGS: Partial<Record<EstateSlug, EstateBlogConfig>> = {
  "hemp-homes": {
    slug: "hemp-homes",
    name: "Hemp Homes",
    intro:
      "Build-in-public updates and photos from the Joey60 Hemp Edition — the design, material, engineering and prototyping journey toward Australia's eco-communities. New updates as each milestone happens.",
    accent: "#1B4332",
    landingPath: "/hemp-homes-for-eco-communities",
    postsTable: "hemp_homes_posts",
    mediaTable: "hemp_homes_media",
    postMediaTable: "hemp_homes_post_media",
    bucket: "hemp-homes-media",
    driveEnabled: true,
    aiContext: `THE PRODUCT
- The Joey60 Hemp Edition: a 60m² single-bedroom home built from engineered hemp panels, assembled on site as a flat-pack kit (owner-build with community OR built by an F2K team).
- Stage: pre-certification, pre-sale (first homes targeted 2027). NEVER promise sooner.
- Audience: Australian eco-villages, intentional communities, cohousing, permaculture villages.

HEMP FACTS YOU MAY USE (stick to these — do not invent benefits): fast-growing crop (~90-120 day cycle, restorative to soil); carbon-sequestering (locks in CO₂ for the building's life); breathable hemp-lime walls (passive humidity regulation, no mould-prone sealed envelope); naturally mould/pest-resistant; no off-gassing (zero formaldehyde/VOCs); strong thermal performance; non-toxic full lifecycle.

HARD RULES (a violation makes the post unusable):
- NEVER name the materials partner, engineering partner, or any partner company (Wandara included) — they stay anonymous publicly until they agree. Say "our materials partner" / "our engineering partner".
- NEVER claim certification is achieved or give a delivery date earlier than 2027 — the home is being built TOWARD the residential certification pathway; results get published as they happen.
- NEVER claim specific health outcomes, cost-competitiveness, or lifespan figures beyond the facts above.`,
    subscriberTable: "hemp_homes_waitlist",
  },
  branscombe: {
    slug: "branscombe",
    name: "Branscombe",
    intro:
      "Progress updates and photos from Branscombe Estate in Claremont, Tasmania — 37 architecturally individual homes. Follow the build and the estate as it comes together.",
    accent: "#00B5AD",
    landingPath: "/branscombe-estate",
    postsTable: "branscombe_posts",
    mediaTable: "branscombe_media",
    postMediaTable: "branscombe_post_media",
    bucket: "branscombe-media",
    driveEnabled: true,
    aiContext: `THE DEVELOPMENT
- Branscombe Estate, Claremont, Tasmania — a development of 37 architecturally individual homes (each home a distinct design, not a repeated plan).
- Audience: prospective owner-occupiers and investors interested in well-designed Tasmanian homes.

HARD RULES:
- Registration of interest only — no deposit is taken or implied. Never promise availability, price, or completion dates that aren't in the supplied material.
- Do not invent home specifications, prices, or finishes. Ground the post in the supplied photo captions and stage. If captions are thin, write a warm general update about the estate and the build.`,
    subscriberTable: "branscombe_registrations",
  },
  seafields: {
    slug: "seafields",
    name: "Seafields",
    intro:
      "Progress updates and photos from Seafields — a Western Australian land estate. Follow the lots, the stages and the estate as it takes shape.",
    accent: "#1f6feb",
    landingPath: "/seafields-estate",
    postsTable: "seafields_posts",
    mediaTable: "seafields_media",
    postMediaTable: "seafields_post_media",
    bucket: "seafields-media",
    driveEnabled: true,
    aiContext: `THE DEVELOPMENT
- Seafields — a Western Australian residential land estate, released in stages with individual lots.
- Audience: prospective buyers and investors interested in land at Seafields.

HARD RULES:
- Registration of interest only — no deposit is taken or implied. Never promise lot availability, price, or release dates that aren't in the supplied material.
- Do not invent lot details, prices, or stage timing. Ground the post in the supplied photo captions and stage. If captions are thin, write a warm general update about the estate's progress.`,
    subscriberTable: "seafields_registrations",
  },
};

export function getEstateBlog(slug: string): EstateBlogConfig | null {
  return ESTATE_BLOGS[slug as EstateSlug] ?? null;
}

/** Permission key for an estate's media/posts admin (e.g. manage_hemp_homes_media). */
export function estatePermission(slug: EstateSlug, kind: "media" | "posts"): string {
  return `manage_${slug.replace(/-/g, "_")}_${kind}`;
}

/** All configured estate blogs, for the /blog index + nav. */
export const ESTATE_BLOG_LIST: EstateBlogConfig[] = Object.values(ESTATE_BLOGS).filter(
  (c): c is EstateBlogConfig => Boolean(c),
);
