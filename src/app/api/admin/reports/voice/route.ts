import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getClaudeClientConfig, resolveClaudeModel } from "@caistech/ai-client";
import { z } from "zod";
import { getAdminUser } from "@/lib/admin-auth";
import { REPORTS_VOICE_PROMPT } from "@/lib/reports-voice-prompt.mjs";
import { ReportQuerySpecSchema, capabilityManifestForLLM } from "@/lib/reports/query-spec";

export const dynamic = "force-dynamic";

/**
 * Morgan, the admin reports consultant — text-fallback brain (and the same prompt the voice agent
 * uses, so spoken + typed never drift). Admin-gated. Returns Morgan's next line AND, once she has
 * confirmed the request, a structured ReportQuerySpec the page applies to the form / runs. The model
 * composes a SPEC, never SQL.
 */

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(60),
});

const SYSTEM_PROMPT = `${REPORTS_VOICE_PROMPT}

CAPABILITY MANIFEST (compose only within this; declare gaps for anything outside it):
${capabilityManifestForLLM()}

OUTPUT FORMAT — return ONLY a JSON object, no markdown, no prose outside it:
{"reply": "<your next line to the operator, plain text>", "spec": null}
Set "spec" to null while you are still in discovery or awaiting confirmation. ONLY once the operator
has CONFIRMED the request, set "spec" to the full report spec:
{"dataset","estate","dateFrom","dateTo","filters":{"agent","buyerType","financeStatus"},"groupBy","metrics":[...],"view","format":"screen"}
Use null for any unset date/filter. Keep "reply" conversational even when emitting a spec (e.g. "Running that now.").`;

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Not authorised." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (!process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "The reports consultant is unavailable — use the form below to build your report." },
      { status: 503 },
    );
  }

  const config = getClaudeClientConfig({
    openrouterKey: process.env.OPENROUTER_API_KEY,
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    referer: process.env.NEXT_PUBLIC_CANONICAL_URL,
    appTitle: "f2k-projects (admin reports consultant)",
  });
  const client = new Anthropic(config);
  const model = resolveClaudeModel({
    openrouterKey: process.env.OPENROUTER_API_KEY,
    override: process.env.AGENT_MODEL,
  });

  const convo =
    parsed.data.messages.length === 0
      ? [{ role: "user" as const, content: "(The operator just opened the Reports page.)" }]
      : parsed.data.messages;

  try {
    const completion = await client.messages.create({
      model,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: convo.map((m) => ({ role: m.role, content: m.content })),
    });

    const raw = completion.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // Parse the JSON envelope; if the model strays, fall back to treating it all as the reply.
    let reply = raw;
    let spec: unknown = null;
    try {
      const obj = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
      if (obj && typeof obj === "object") {
        reply = typeof obj.reply === "string" ? obj.reply : raw;
        spec = obj.spec ?? null;
      }
    } catch {
      // not JSON — keep raw as the reply, no spec
    }

    // Validate any emitted spec defensively — never trust the model's shape.
    let validSpec = null;
    if (spec) {
      const s = ReportQuerySpecSchema.safeParse(spec);
      if (s.success) validSpec = s.data;
    }

    return NextResponse.json({
      reply: reply || "What report do you need — which estate, what window, and what's it for?",
      spec: validSpec,
    });
  } catch (err) {
    console.error("Admin reports voice error:", err);
    return NextResponse.json(
      { error: "The consultant hit a snag — build your report with the form below." },
      { status: 502 },
    );
  }
}
