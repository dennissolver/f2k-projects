/**
 * Blog-post generator: curated photos + journey context → a drafted post.
 *
 * Flow:
 *   1. Give Claude the pool of curated/captioned media (id + caption + alt +
 *      kind), the recent post titles (so it doesn't repeat itself), and the
 *      estate context.
 *   2. Claude returns a JSON draft: title, markdown body, stage, state, and an
 *      ordered list of media_ids it selected (first = hero).
 *   3. The caller inserts a DRAFT post + post_media rows. NEVER auto-publishes
 *      and NEVER sends — the operator edits and approves before publish/send.
 *
 * Mirrors outreach-generator.ts (same @caistech/ai-client setup). Photo
 * selection is caption-based for now (vision is a later upgrade).
 *
 * Two entry points share one engine (runDraft):
 *   - generatePostDraft       → Hemp Homes (prompt preserved verbatim).
 *   - generateEstatePostDraft → any estate, prompt composed from its config.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getClaudeClientConfig, resolveClaudeModel } from "@caistech/ai-client";
import type { HempHomesStage, HempHomesState } from "./types";

export interface PostGenInputMedia {
  id: string;
  kind: "image" | "video";
  caption: string | null;
  alt_text: string | null;
}

export interface PostGenRecentPost {
  title: string;
  stage: string;
}

export interface GeneratedPost {
  title: string;
  overview: string;
  stage: HempHomesStage;
  state: HempHomesState;
  media_ids: string[]; // ordered, first = hero
  llm_model: string;
  llm_input_tokens: number | null;
  llm_output_tokens: number | null;
}

const ALLOWED_STAGES: HempHomesStage[] = [
  "design", "material_development", "engineering", "prototyping",
  "building", "certification", "install", "community",
];
const ALLOWED_STATES: HempHomesState[] = ["completed", "in_progress", "scheduled"];

const OUTPUT_SPEC = `OUTPUT
Return ONLY a single JSON object, no prose, no code fences:
{
  "title": "short, specific, no clickbait",
  "overview": "the post body in markdown — 2 to 4 short paragraphs",
  "stage": one of [design, material_development, engineering, prototyping, building, certification, install, community],
  "state": one of [completed, in_progress, scheduled],
  "media_ids": ["<id>", ...]   // 1-4 ids from the supplied photos, most relevant first (first = hero). [] if none fit.
}`;

// Hemp Homes prompt — preserved verbatim (its output is the proven reference).
const HEMP_SYSTEM_PROMPT = `You write short "build in public" blog posts for Factory2Key's Hemp Homes for Eco-Communities program. The posts go on the PUBLIC website and (after the operator approves) to people who signed up to follow the journey.

THE PRODUCT
- The Joey60 Hemp Edition: a 60m² single-bedroom home built from engineered hemp panels, assembled on site as a flat-pack kit (owner-build with community OR built by an F2K team).
- Stage: pre-certification, pre-sale (first homes targeted 2027). NEVER promise sooner.
- Audience: Australian eco-villages, intentional communities, cohousing groups, permaculture villages — people who already live the ethos.

VOICE
- Upbeat, warm, eco-conscious, educational. Genuinely excited about the build, never hypey or salesy.
- Teach something each post — about hemp as a material, or about this stage of the build. The reader should finish a little more informed.
- Australian English (organisation, recognise, fibre, metre). Short paragraphs. No emoji. No exclamation-point spam.
- These are standalone updates — do NOT number them "Day 1 / Update 3" or imply a strict sequence.

HEMP FACTS YOU MAY USE OR EXPAND (stick to these — do not invent benefits)
- Fast-growing crop: ~90-120 day grow cycle vs decades for timber; minimal pesticide/herbicide; restorative to soil.
- Carbon-sequestering: hemp panels lock in atmospheric CO₂ for the life of the building (industry-cited ~110 kg CO₂ per m³ of hempcrete).
- Breathable wall system: hemp-lime regulates humidity passively — no vapour barriers, no condensation pockets, no sealed-envelope mould problems.
- Naturally mould- and pest-resistant: lime binder + silica deter mould, insects, rodents without chemical treatment.
- No off-gassing: zero formaldehyde, zero VOCs, unlike particleboard/MDF/urea-formaldehyde insulation. Better indoor air.
- Thermal performance: high mass + insulating value keeps indoor temperatures stable, cutting heating/cooling loads.
- Non-toxic full-cycle: grow → manufacture → occupancy → end-of-life stays non-toxic and biodegradable.

HARD RULES (a violation makes the post unusable)
- NEVER name the materials partner, the engineering partner, or any partner company (Wandara included). They stay anonymous publicly until they agree to be named. Refer to "our materials partner" / "our engineering partner".
- NEVER claim certification is achieved or give a delivery date earlier than 2027. The home is being built TOWARD the residential certification pathway; results get published as they happen.
- NEVER claim specific health outcomes (curing asthma/allergies), cost-competitiveness, or lifespan figures beyond the facts above.
- Do NOT invent events. Ground the post in the supplied photo captions and the current stage. If the captions are thin, write a warm general update about that stage and the material — do not fabricate specifics.
- Only select photos from the supplied list, by their exact id.

${OUTPUT_SPEC}`;

// Generic prompt skeleton for any estate. Estate-specific facts + guardrails
// come from the estate config's aiContext.
function buildSystemPrompt(estateName: string, aiContext: string): string {
  return `You write short "build in public" blog posts for ${estateName}, an Australian Factory2Key development. The posts go on the PUBLIC website and (after the operator approves) to people following the project.

${aiContext}

VOICE
- Upbeat, warm, educational. Genuinely interested in the work, never hypey or salesy.
- Teach the reader something about this stage of the development. Short paragraphs.
- Australian English (organisation, recognise, metre, colour). No emoji. No exclamation-point spam.
- Standalone updates — do NOT number them "Day 1 / Update 3" or imply a strict sequence.

UNIVERSAL RULES
- Registration of interest only — never promise deposits, contracts, guaranteed availability, prices or dates not in the supplied material.
- Do NOT invent events, specs, or figures. Ground the post in the supplied photo captions and the current stage. If captions are thin, write a warm general update — do not fabricate specifics.
- Only select photos from the supplied list, by their exact id.

${OUTPUT_SPEC}`;
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

/** Operator's standing "about this estate/product" context → appended to the
 * system prompt. Empty = no change (Hemp Homes stays verbatim). */
function withOperatorContext(systemPrompt: string, estateContext?: string | null): string {
  const t = (estateContext ?? "").trim();
  if (!t) return systemPrompt;
  return `${systemPrompt}

WHAT THE OPERATOR WANTS YOU TO KNOW ABOUT THIS ESTATE/PRODUCT (extra background — weave in what's relevant; the HARD RULES above still apply):
${t}`;
}

export interface DraftOptions {
  /** Standing per-estate context (the "system" field, persisted). */
  estateContext?: string | null;
  /** One-off steer for THIS post (the "post" field, not persisted). */
  postPrompt?: string | null;
}

async function runDraft(
  photos: PostGenInputMedia[],
  recentPosts: PostGenRecentPost[],
  systemPrompt: string,
  postPrompt?: string | null,
): Promise<GeneratedPost> {
  const config = getClaudeClientConfig({
    openrouterKey: process.env.OPENROUTER_API_KEY,
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    referer: process.env.NEXT_PUBLIC_CANONICAL_URL,
    appTitle: "f2k-projects (estate posts)",
  });
  const client = new Anthropic(config);
  const model = resolveClaudeModel({
    openrouterKey: process.env.OPENROUTER_API_KEY,
    override: process.env.AGENT_MODEL,
  });

  const photoLines = photos.length
    ? photos
        .map(
          (p) =>
            `- id: ${p.id} | ${p.kind} | caption: ${p.caption ?? "(none)"} | alt: ${p.alt_text ?? "(none)"}`,
        )
        .join("\n")
    : "(no curated photos available — write a text-only update for the most fitting stage, media_ids: [])";

  const recentLines = recentPosts.length
    ? recentPosts.map((r) => `- "${r.title}" (${r.stage})`).join("\n")
    : "(none yet)";

  const steer = (postPrompt ?? "").trim();
  const steerBlock = steer
    ? `\nWHAT THE OPERATOR WANTS THIS POST TO BE ABOUT (build the post around this; still ground it in the photos + stage, still obey the rules):\n${steer}\n`
    : "";

  const userMessage = `Available curated photos to choose from (select 1-4 most relevant by exact id; pick the strongest as the hero / first):
${photoLines}

Recent posts already published — do NOT repeat these topics or angles:
${recentLines}
${steerBlock}
Write one fresh, standalone build-in-public post. Pick the stage that best matches the photos you select (or the most current stage if writing text-only). Return only the JSON object.`;

  const resp = await client.messages.create({
    model,
    max_tokens: 1200,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = resp.content
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { type: string; text?: string }) => b.text ?? "")
    .join("")
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    throw new Error("LLM returned unparseable output — try again.");
  }

  const title = String(parsed.title ?? "").trim();
  const overview = String(parsed.overview ?? "").trim();
  if (title.length < 3) throw new Error("LLM produced no usable title.");
  if (overview.length < 10) throw new Error("LLM produced no usable body.");

  const stage: HempHomesStage = ALLOWED_STAGES.includes(parsed.stage)
    ? parsed.stage
    : "building";
  const state: HempHomesState = ALLOWED_STATES.includes(parsed.state)
    ? parsed.state
    : "in_progress";

  const offered = new Set(photos.map((p) => p.id));
  const media_ids = Array.isArray(parsed.media_ids)
    ? parsed.media_ids
        .filter((id: unknown): id is string => typeof id === "string" && offered.has(id))
        .slice(0, 4)
    : [];

  return {
    title,
    overview,
    stage,
    state,
    media_ids,
    llm_model: model,
    llm_input_tokens: resp.usage?.input_tokens ?? null,
    llm_output_tokens: resp.usage?.output_tokens ?? null,
  };
}

/** Hemp Homes drafter — base prompt preserved verbatim; operator context + a
 * per-post steer layer on top when supplied (empty = identical to before). */
export async function generatePostDraft(
  photos: PostGenInputMedia[],
  recentPosts: PostGenRecentPost[],
  opts: DraftOptions = {},
): Promise<GeneratedPost> {
  return runDraft(
    photos,
    recentPosts,
    withOperatorContext(HEMP_SYSTEM_PROMPT, opts.estateContext),
    opts.postPrompt,
  );
}

/** Generic estate drafter — prompt composed from the estate's config + the
 * operator's standing context + a per-post steer. */
export async function generateEstatePostDraft(
  estateName: string,
  aiContext: string,
  photos: PostGenInputMedia[],
  recentPosts: PostGenRecentPost[],
  opts: DraftOptions = {},
): Promise<GeneratedPost> {
  return runDraft(
    photos,
    recentPosts,
    withOperatorContext(buildSystemPrompt(estateName, aiContext), opts.estateContext),
    opts.postPrompt,
  );
}
