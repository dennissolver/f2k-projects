/**
 * Outreach generator: template + prospect → drafted subject/preview/HTML body.
 *
 * Flow:
 *   1. Substitute Liquid-style {{ var }} placeholders against the prospect
 *      (server-side string replace — no Liquid library).
 *   2. Hand the templated draft to Claude (Sonnet) along with the template's
 *      llm_instruction + prospect context. Claude returns a polished version
 *      that respects the original facts but tightens tone, expands relevant
 *      points using source_basis, and never invents claims.
 *   3. Convert the polished markdown to inline HTML for Resend.
 *
 * NEVER auto-send the result — every draft routes through the approval
 * queue (auto_send=false on Phase 1 templates by policy).
 */

import Anthropic from "@anthropic-ai/sdk";
import { getClaudeClientConfig, resolveClaudeModel } from "@caistech/ai-client";
import type { HempHomesOutreachTemplate, HempHomesProspect } from "./types";
import { buildUnsubscribeUrl } from "./unsubscribe-token";

export interface GeneratedDraft {
  subject: string;
  preview: string | null;
  body_md: string;
  body_html: string;
  llm_model: string;
  llm_input_tokens: number | null;
  llm_output_tokens: number | null;
}

function substitute(template: string, vars: Record<string, string | number | null>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    if (v == null || v === "") return "";
    return String(v);
  });
}

function prospectVars(p: HempHomesProspect): Record<string, string | number | null> {
  const canonical = (process.env.NEXT_PUBLIC_CANONICAL_URL ?? "").replace(/\/$/, "");
  return {
    name: p.name,
    location: p.location ?? "",
    region: p.region ?? "",
    state: p.state ?? "",
    wave: p.wave ?? "",
    source_basis: p.source_basis ?? "",
    website_url: p.website_url ?? "",
    indicative_lot_potential: p.indicative_lot_potential ?? "",
    land_size_acres: p.land_size_acres ?? "",
    current_members: p.current_members ?? "",
    unsubscribe_url: buildUnsubscribeUrl(p.id),
    // Public-facing hemp-homes journey landing page on the f2k-projects
    // Next.js app — DO NOT hardcode factory2key.com.au URLs in templates;
    // that domain is a separate WordPress marketing site.
    public_journey_url: `${canonical}/hemp-homes-for-eco-communities`,
  };
}

// Minimal markdown → HTML for plain prose emails. Handles paragraph breaks,
// links, line breaks. Resend renders the rest.
function markdownToHtml(md: string): string {
  const paragraphs = md.split(/\n\s*\n/);
  const htmlParas = paragraphs.map((p) => {
    const safe = p
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    // Linkify URLs
    const linked = safe.replace(
      /(https?:\/\/[^\s<>"']+)/g,
      '<a href="$1" style="color:#0366d6;text-decoration:underline">$1</a>',
    );
    // Single newlines inside a paragraph → <br />
    const withBreaks = linked.replace(/\n/g, "<br />");
    return `<p style="margin:0 0 1em 0;line-height:1.5;">${withBreaks}</p>`;
  });
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:580px;color:#1f2937;">${htmlParas.join("")}</div>`;
}

export async function generateOutreachDraft(
  template: HempHomesOutreachTemplate,
  prospect: HempHomesProspect,
): Promise<GeneratedDraft> {
  const vars = prospectVars(prospect);

  // Step 1: substitute placeholders to get the seed draft.
  const seedSubject = substitute(template.subject_template, vars);
  const seedPreview = template.preview_template
    ? substitute(template.preview_template, vars)
    : null;
  const seedBody = substitute(template.body_md_template, vars);

  // Step 2: Claude polish.
  const config = getClaudeClientConfig({
    openrouterKey: process.env.OPENROUTER_API_KEY,
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    referer: process.env.NEXT_PUBLIC_CANONICAL_URL,
    appTitle: "f2k-projects (hemp-homes outreach)",
  });
  const client = new Anthropic(config);
  const model = resolveClaudeModel({
    openrouterKey: process.env.OPENROUTER_API_KEY,
    override: process.env.AGENT_MODEL,
  });

  const systemPrompt = `You polish prospect-outreach emails for Factory2Key's Hemp Homes for Eco-Communities program.

CONTEXT
- Product: Joey60 Hemp Edition — a 60sqm single-bedroom home built from engineered hemp panels, partnered with Wandara in Townsville for cert + manufacture.
- Stage: pre-cert, pre-sale (target first homes 2027). DO NOT promise sooner.
- Audience: Australian eco-villages, intentional communities, cohousing groups, permaculture villages.
- Sender: Dennis McMahon (always sign off as Dennis).

HEMP-AS-A-BUILD-MATERIAL — verified claims you may use or expand
You can lean on these to add colour about naturalness + indoor-health when the templated draft cues for it. STICK TO THESE; do not invent additional benefits.
- Fast-growing crop: hemp's grow-cycle is roughly 90–120 days, vs decades for timber. Needs minimal pesticide or herbicide and is restorative to soil.
- Carbon-sequestering: hemp panels actively lock in atmospheric CO₂ during the home's lifetime (industry-cited ~110 kg CO₂ per cubic metre of hempcrete).
- Breathable wall system: hemp-lime walls regulate humidity passively — no vapour barriers required, no condensation pockets, no mould-bloom problems associated with sealed conventional envelopes.
- Naturally mould- and pest-resistant: the lime binder and silica content in hemp deter mould, insects, and rodents without chemical treatments.
- No off-gassing: zero formaldehyde, zero VOCs — unlike conventional particleboard, MDF, urea-formaldehyde insulation, and many engineered timber products. Better indoor air, especially for households with respiratory sensitivities.
- Thermal performance: high mass + insulating value keeps indoor temperatures stable, reducing heating/cooling loads.
- Non-toxic full-cycle: from grow to manufacture to occupancy to end-of-life, hemp panels stay non-toxic and biodegradable.

DO NOT claim:
- Specific health outcomes (curing allergies, treating asthma, etc.) — anecdotal at best.
- Cost competitiveness vs other build types — depends on context, not yet validated.
- Lifespan figures beyond what's published — Wandara's panel-life data is pre-cert.
- Australian-grown supply chain unless the source_basis or notes confirm it — Wandara's hemp source isn't published.

YOUR TASK
- Take the templated draft and polish it. Tighten tone, expand the personalisation where source_basis gives you real material, smooth awkward phrasing.
- When the seed touches on hemp benefits, expand using the verified claims above — but keep it concise. One short paragraph of "why hemp" is enough; readers don't need a lecture.
- DO NOT invent facts about the community. If source_basis is empty or vague, keep the email more generic.
- DO NOT promise specific timelines beyond what the seed mentions.
- DO NOT use salesy language. Warm, factual, no pressure.
- KEEP all factual claims (Wandara partnership, 60sqm, hemp panel, 2027 target if mentioned).
- Australian English spelling throughout (organisation, recognise, programme).
- Return ONLY the polished markdown body. NO subject line, NO preheader, NO commentary. Start with "Hi {community name} team," and end with "Dennis McMahon\\nFactory2Key" (or similar sign-off).
- PRESERVE EVERY URL exactly as it appears in the templated draft — they are signed tokens (unsubscribe link, tracking) and MUST NOT be modified, shortened, or paraphrased. The unsubscribe footer in particular is legally required (Australia Spam Act 2003) — never remove or alter it.

ADDITIONAL TEMPLATE INSTRUCTION
${template.llm_instruction ?? "(none provided)"}`;

  // Enriched per-community context Claude can use to scale + personalise.
  // Each field includes a hint about how to use it.
  const lotHint = prospect.indicative_lot_potential != null
    ? `${prospect.indicative_lot_potential} (our internal planning estimate — DO NOT cite this number as a sales target. Use only to gauge scale: 1-3 = small, 4-6 = mid, 7+ = substantial.)`
    : "unknown";
  const acresHint = prospect.land_size_acres != null
    ? `${prospect.land_size_acres} acres (calibrate language: <50 acres = small infill; 50-200 = mid-size estate; 200+ = substantial estate)`
    : "unknown";
  const membersHint = prospect.current_members != null
    ? `${prospect.current_members} (community size context — small/intimate <30, mid 30-150, large 150+)`
    : "unknown";

  const userMessage = `Community: ${prospect.name} (${prospect.state ?? "—"})
Wave: ${prospect.wave ?? "—"}
Region / location: ${prospect.region ?? prospect.location ?? "—"}
Land size: ${acresHint}
Current members: ${membersHint}
Possible Joey60 placements (internal estimate): ${lotHint}
Public website: ${prospect.website_url ?? "(none)"}
Source basis: ${prospect.source_basis ?? "(none)"}
Notes on community: ${prospect.notes ?? "(none)"}

Personalisation guidance:
- Lean on source_basis + notes most heavily — those carry the strongest signal.
- If the website_url is present and the source_basis references specific page content, you may say "we noticed on your site that..." — but only if source_basis actually backs the reference.
- Scale your language to the community size (members + acres). A 12-household urban cohousing project needs different wording from a 700-acre rural ecovillage.
- DO NOT cite the lot estimate as a sales pitch. It exists only to help you size the conversation.
- DO NOT mention region/state explicitly unless it adds something genuine (e.g. "your Margaret River region" only if the source_basis ties it to something).

Templated draft to polish:

---
${seedBody}
---

Return only the polished markdown body.`;

  const resp = await client.messages.create({
    model,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  // Extract text from the first text block.
  const polished = resp.content
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { type: string; text?: string }) => b.text ?? "")
    .join("")
    .trim();

  const finalBody = polished || seedBody; // fall back to seed if LLM returned nothing

  return {
    subject: seedSubject,
    preview: seedPreview,
    body_md: finalBody,
    body_html: markdownToHtml(finalBody),
    llm_model: model,
    llm_input_tokens: resp.usage?.input_tokens ?? null,
    llm_output_tokens: resp.usage?.output_tokens ?? null,
  };
}
