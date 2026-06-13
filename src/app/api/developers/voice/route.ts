import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getClaudeClientConfig, resolveClaudeModel } from "@caistech/ai-client";
import { z } from "zod";
import { DEVELOPER_VOICE_PROMPT } from "@/lib/developer-voice-prompt.mjs";

export const dynamic = "force-dynamic";

/**
 * Text fallback for "Morgan", the developer-onboarding guide. The primary experience is the
 * canonical ElevenLabs voice agent (see DeveloperVoiceAgent.tsx + voice.config.ts). This route
 * is the no-mic fallback brain: when voice can't run, the widget's typed box routes here and
 * we return Morgan's next line using the SAME prompt baked into the voice agent
 * (src/lib/developer-voice-prompt.mjs) so the spoken and typed experiences never drift.
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

// Shared with the provisioned voice agent so spoken + typed never drift. The trailing line
// keeps the typed path turn-shaped (one reply, plain text — no stage directions).
const SYSTEM_PROMPT = `${DEVELOPER_VOICE_PROMPT}

Return ONLY Morgan's next line as plain text — no stage directions, no quotes, no markdown.`;

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
