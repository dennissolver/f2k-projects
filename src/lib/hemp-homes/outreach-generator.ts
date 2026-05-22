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

YOUR TASK
- Take the templated draft and polish it. Tighten tone, expand the personalisation where source_basis gives you real material, smooth awkward phrasing.
- DO NOT invent facts about the community. If source_basis is empty or vague, keep the email more generic.
- DO NOT promise specific timelines beyond what the seed mentions.
- DO NOT use salesy language. Warm, factual, no pressure.
- KEEP all factual claims (Wandara partnership, 60sqm, hemp panel, 2027 target if mentioned).
- Australian English spelling throughout (organisation, recognise, programme).
- Return ONLY the polished markdown body. NO subject line, NO preheader, NO commentary. Start with "Hi {community name} team," and end with "Dennis McMahon\\nFactory2Key" (or similar sign-off).

ADDITIONAL TEMPLATE INSTRUCTION
${template.llm_instruction ?? "(none provided)"}`;

  const userMessage = `Community: ${prospect.name} (${prospect.state ?? "—"})
Wave: ${prospect.wave ?? "—"}
Source basis: ${prospect.source_basis ?? "(none)"}
Notes on community: ${prospect.notes ?? "(none)"}

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
