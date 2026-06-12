import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getClaudeClientConfig, resolveClaudeModel } from "@caistech/ai-client";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Voice-discovery agent for the developer onboarding page — "Morgan", a warm,
 * focused discovery coach modelled on the Morgan voice coach from the pipeline.
 *
 * The browser handles speech (Web Speech API: speech-to-text + text-to-speech);
 * this route is the brain. It takes the running transcript and returns Morgan's
 * next spoken line, guiding the developer through their vision, goals, planning
 * status and deal preferences (e.g. joint ventures) to enrich the data before any
 * commercial discussion. Real model call via @caistech/ai-client — no canned
 * replies, no stub.
 */

const schema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(60),
  // Optional light context captured from the form so Morgan can personalise.
  context: z
    .object({
      developer_name: z.string().max(200).optional(),
      estate_name: z.string().max(200).optional(),
      estate_location: z.string().max(200).optional(),
    })
    .optional(),
});

const SYSTEM_PROMPT = `You are Morgan, a warm and focused discovery coach for Factory2Key (F2K), a modular-home developer partner. You are speaking out loud with a property developer who has landed on F2K's developer onboarding page. Your job is to guide a short, natural spoken conversation that draws out the developer's vision so the F2K team is well prepared before any commercial discussion.

WHAT YOU ARE TRYING TO LEARN (cover these conversationally, not as a checklist):
- Their vision for the estate / project and what success looks like to them.
- Goals and motivations — why this project, why now, who it's for.
- Where the project is at on planning / zoning / approvals.
- Deal preferences — how they like to structure projects: outright sale, joint venture, profit-share, staged delivery, etc. Explore JV appetite gently.
- Any constraints, timelines or concerns.

HOW TO SPEAK:
- This is VOICE. Keep every reply short — one or two sentences, then ONE clear question. Never deliver a paragraph; people are listening, not reading.
- Be warm, curious and genuinely interested. Australian English spelling.
- Ask ONE question at a time and build on what they just said.
- Acknowledge their answer briefly before moving on.
- If they greet you or it's the first turn, introduce yourself in one sentence and open with an inviting question about their project.
- Do NOT make commercial commitments, quote prices, or promise terms — you gather, you don't negotiate. If pushed on numbers, say the F2K team will follow up on commercials and steer back to understanding their goals.
- Do NOT invent facts about F2K beyond: F2K builds architecturally-designed modular homes and partners with developers on residential estates.
- When you sense the key areas are covered, warmly let them know you've got a good picture, suggest they finish the details in the form below, and thank them.

Return ONLY Morgan's next spoken line as plain text — no stage directions, no quotes, no markdown.`;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { messages, context } = parsed.data;

  // getClaudeClientConfig throws when neither key is configured — surface that
  // as a graceful "use the form instead" rather than a 500.
  if (!process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "The voice guide is unavailable right now — please fill in the form below and we'll be in touch.",
      },
      { status: 503 },
    );
  }

  const config = getClaudeClientConfig({
    openrouterKey: process.env.OPENROUTER_API_KEY,
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    referer: process.env.NEXT_PUBLIC_CANONICAL_URL,
    appTitle: "f2k-projects (developer onboarding voice)",
  });

  const client = new Anthropic(config);
  const model = resolveClaudeModel({
    openrouterKey: process.env.OPENROUTER_API_KEY,
    override: process.env.AGENT_MODEL,
  });

  const contextLine = context
    ? `Known so far — developer: ${context.developer_name || "unknown"}; estate: ${context.estate_name || "unknown"}; location: ${context.estate_location || "unknown"}.`
    : "";

  // Seed an opening turn if the developer hasn't said anything yet.
  const convo =
    messages.length === 0
      ? [{ role: "user" as const, content: "(The developer just opened the page.)" }]
      : messages;

  try {
    const completion = await client.messages.create({
      model,
      max_tokens: 300,
      system: contextLine ? `${SYSTEM_PROMPT}\n\n${contextLine}` : SYSTEM_PROMPT,
      messages: convo.map((m) => ({ role: m.role, content: m.content })),
    });

    const reply = completion.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return NextResponse.json({
      reply:
        reply ||
        "Tell me a little about the project you have in mind — what's your vision for it?",
    });
  } catch (err) {
    console.error("Developer onboarding voice error:", err);
    return NextResponse.json(
      {
        error:
          "The voice guide hit a snag — please carry on with the form below and we'll follow up.",
      },
      { status: 502 },
    );
  }
}
