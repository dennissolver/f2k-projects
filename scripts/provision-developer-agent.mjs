#!/usr/bin/env node
/**
 * Provision/refresh the F2K developer-onboarding voice agent ("Morgan").
 *
 * Dedicated, idempotent ElevenLabs ConvAI agent for the /developers page. Morgan runs a
 * short discovery chat then GUIDES the developer through the onboarding form (see the
 * shared prompt in src/lib/developer-voice-prompt.mjs). No memory tools / webhook — the
 * transcript is captured client-side by the VoiceWidget and submitted with the form.
 *
 * Idempotent: pass the stored agent id (NEXT_PUBLIC_ELEVENLABS_DEVELOPER_AGENT_ID) to update
 * in place; otherwise it finds the agent by name, and only creates one if none exists
 * (aborts on 2+ to avoid touching the wrong agent).
 *
 * Run:  node --env-file=.env.local scripts/provision-developer-agent.mjs
 * Needs: ELEVENLABS_API_KEY + CANONICAL_VOICE_ID in the env. Prints the agent id to paste
 * into src/voice.config.ts.
 */
import {
  createAgent,
  updateAgent,
  getAgent,
  findAgentsByName,
  setAgentOverrides,
  setAllowlist,
  standardAllowlist,
} from "@caistech/elevenlabs-convai";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  DEVELOPER_VOICE_PROMPT,
  DEVELOPER_FIRST_MESSAGE,
} from "../src/lib/developer-voice-prompt.mjs";

// The ElevenLabs key lives in the portfolio's automated-setup env files, not in this repo.
// Source it from the env, falling back to the shared locations sayfix provisioning uses.
function envFrom(path, key) {
  try {
    return (readFileSync(path, "utf8").match(new RegExp(`^${key}=(.+)$`, "m")) || [])[1];
  } catch {
    return undefined;
  }
}
const SHARED_ENVS = [
  join(homedir(), "PycharmProjects", "sayfix", ".env.local"),
  join(homedir(), "PycharmProjects", "cais-shared-services", ".env.local"),
];
const apiKey =
  process.env.ELEVENLABS_API_KEY ||
  SHARED_ENVS.map((p) => envFrom(p, "ELEVENLABS_API_KEY")).find(Boolean);
// The canonical portfolio voice (Rachel) — the same default SayFix + interview agents use.
const voiceId =
  process.env.CANONICAL_VOICE_ID ||
  process.env.ELEVENLABS_VOICE_ID ||
  "21m00Tcm4TlvDq8ikWAM";
const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_CANONICAL_URL ||
  "https://f2k-projects.vercel.app";
const existingAgentId = process.env.NEXT_PUBLIC_ELEVENLABS_DEVELOPER_AGENT_ID || undefined;

const AGENT_NAME = "F2K Developer Guide (Morgan)";

if (!apiKey) {
  console.error(
    "ELEVENLABS_API_KEY not found in env or sayfix/cais-shared-services .env.local.",
  );
  process.exit(1);
}

const host = new URL(baseUrl).host;
const allowedOrigins = standardAllowlist(host);

const updateOpts = {
  systemPrompt: DEVELOPER_VOICE_PROMPT,
  firstMessage: DEVELOPER_FIRST_MESSAGE,
  voiceId,
  name: AGENT_NAME,
};

let agentId;
let created = false;

console.log(`Provisioning "${AGENT_NAME}" (host ${host})…`);

if (existingAgentId) {
  await getAgent(apiKey, existingAgentId); // throws if it no longer exists
  agentId = existingAgentId;
  await updateAgent(apiKey, agentId, updateOpts);
} else {
  const matches = await findAgentsByName(apiKey, AGENT_NAME);
  if (matches.length > 1) {
    console.error(
      `Refusing to guess: ${matches.length} agents named "${AGENT_NAME}" exist (${matches
        .map((m) => m.agentId)
        .join(", ")}). Set NEXT_PUBLIC_ELEVENLABS_DEVELOPER_AGENT_ID to the right one.`,
    );
    process.exit(1);
  }
  if (matches.length === 1) {
    agentId = matches[0].agentId;
    await updateAgent(apiKey, agentId, updateOpts);
  } else {
    const result = await createAgent(apiKey, {
      config: { agentName: AGENT_NAME, voiceId },
      systemPrompt: DEVELOPER_VOICE_PROMPT,
      firstMessage: DEVELOPER_FIRST_MESSAGE,
      enableOverrides: true,
    });
    agentId = result.agentId;
    created = true;
  }
}

// Enable per-session overrides (so the page can refine prompt/greeting later) + lock the
// Security allowlist (without it, anyone reading the public agent id could spend our key).
if (!created) await setAgentOverrides(apiKey, agentId);
await setAllowlist(apiKey, agentId, allowedOrigins);

console.log(`  agent ${agentId} (${created ? "created" : "updated"}); overrides on; allowlist ${allowedOrigins.join(", ")}`);
console.log("\n✅ Done. Put this in src/voice.config.ts (agentId) — it is public/safe to commit:");
console.log(`  agentId: "${agentId}"`);
