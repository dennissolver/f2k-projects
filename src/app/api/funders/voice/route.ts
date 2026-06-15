import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getClaudeClientConfig, resolveClaudeModel } from "@caistech/ai-client";
import { z } from "zod";
import {
  STERLING_BASE_PROMPT,
  buildSterlingPrompt,
} from "@/lib/funder-voice-prompt.mjs";
import { getFunding, isConfirmedFunding } from "@/data/funding";

export const dynamic = "force-dynamic";

/**
 * Text fallback for "Sterling", the funder-onboarding guide. The primary experience is the
 * canonical ElevenLabs voice agent (see FunderVoiceAgent.tsx + voice.config.ts). This route is
 * the no-mic fallback brain: when voice can't run, the widget's typed box routes here and we
 * return Sterling's next line using the SAME prompt the voice agent uses — generic on the
 * overview, or the per-project prompt (real numbers) when a project_slug is supplied — so the
 * spoken and typed experiences never drift.
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
  // When set to a confirmed project, Sterling speaks to that project's real figures.
  project_slug: z.string().max(120).nullable().optional(),
});

function systemPromptFor(slug?: string | null): string {
  if (slug) {
    const f = getFunding(slug);
    if (f && isConfirmedFunding(f)) {
      return `${buildSterlingPrompt(f)}

Return ONLY Sterling's next line as plain text — no stage directions, no quotes, no markdown.`;
    }
  }
  return `${STERLING_BASE_PROMPT}

Return ONLY Sterling's next line as plain text — no stage directions, no quotes, no markdown.`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { messages, project_slug } = parsed.data;

  // getClaudeClientConfig throws when neither key is configured — surface that as a graceful
  // "use the form instead" rather than a 500.
  if (!process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "The funder guide is unavailable right now — please register your interest using the form below and we'll be in touch.",
      },
      { status: 503 },
    );
  }

  const config = getClaudeClientConfig({
    openrouterKey: process.env.OPENROUTER_API_KEY,
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    referer: process.env.NEXT_PUBLIC_CANONICAL_URL,
    appTitle: "f2k-projects (funder onboarding voice)",
  });

  const client = new Anthropic(config);
  const model = resolveClaudeModel({
    openrouterKey: process.env.OPENROUTER_API_KEY,
    override: process.env.AGENT_MODEL,
  });

  // Seed an opening turn if the funder hasn't said anything yet.
  const convo =
    messages.length === 0
      ? [
          {
            role: "user" as const,
            content: "(The funder just opened the page.)",
          },
        ]
      : messages;

  try {
    const completion = await client.messages.create({
      model,
      max_tokens: 300,
      system: systemPromptFor(project_slug),
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
        "Are you thinking about the senior position or a junior tranche — and roughly what size?",
    });
  } catch (err) {
    console.error("Funder onboarding voice error:", err);
    return NextResponse.json(
      {
        error:
          "The funder guide hit a snag — please carry on with the form below and we'll follow up.",
      },
      { status: 502 },
    );
  }
}
