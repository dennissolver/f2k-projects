#!/usr/bin/env node
/**
 * Provision/refresh the F2K funder-onboarding voice agent ("Sloane").
 *
 * Dedicated, idempotent ElevenLabs ConvAI agent for the /funders pages. Sloane explains the
 * back-to-back funding model + the senior/junior structure and GUIDES the funder through the
 * registration form (see the shared GENERIC base prompt in src/lib/funder-voice-prompt.mjs). On
 * a per-project funder page the page passes a per-project prompt via the widget's `overrides`
 * (the agent is provisioned with overrides ENABLED), so Sloane speaks that project's real
 * numbers; on the overview he runs with this generic prompt.
 *
 * Idempotent: pass the stored agent id (NEXT_PUBLIC_ELEVENLABS_FUNDER_AGENT_ID) to update in
 * place; otherwise it finds the agent by name, and only creates one if none exists (aborts on
 * 2+ to avoid touching the wrong agent).
 *
 * Run:  node --env-file=.env.local scripts/provision-funder-agent.mjs
 * Needs: ELEVENLABS_API_KEY + CANONICAL_VOICE_ID in the env. Prints the agent id to set as
 * NEXT_PUBLIC_ELEVENLABS_FUNDER_AGENT_ID (or paste into src/voice.config.ts).
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
  SLOANE_BASE_PROMPT,
  SLOANE_FIRST_MESSAGE,
} from "../src/lib/funder-voice-prompt.mjs";

// The ElevenLabs key lives in the portfolio's automated-setup env files, not in this repo.
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
// The canonical portfolio voice (Rachel) by default. Sloane is an institutional persona — set
// CANONICAL_VOICE_ID to a different, more measured voice if you want him to sound distinct.
const voiceId =
  process.env.CANONICAL_VOICE_ID ||
  process.env.ELEVENLABS_VOICE_ID ||
  "21m00Tcm4TlvDq8ikWAM";
const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_CANONICAL_URL ||
  "https://f2k-projects.vercel.app";
const existingAgentId = process.env.NEXT_PUBLIC_ELEVENLABS_FUNDER_AGENT_ID || undefined;

// AGENT_LABEL lets us provision a SEPARATE agent per environment (e.g. " — Demo").
const AGENT_LABEL = process.env.AGENT_LABEL || "";
const AGENT_NAME = `F2K Funder Guide (Sloane)${AGENT_LABEL}`;

if (!apiKey) {
  console.error(
    "ELEVENLABS_API_KEY not found in env or sayfix/cais-shared-services .env.local.",
  );
  process.exit(1);
}

const host = new URL(baseUrl).host;
const allowedOrigins = standardAllowlist(host);

const updateOpts = {
  systemPrompt: SLOANE_BASE_PROMPT,
  firstMessage: SLOANE_FIRST_MESSAGE,
  voiceId,
  name: AGENT_NAME,
};

let agentId;
let created = false;

console.log(`Provisioning "${AGENT_NAME}" (host ${host})…`);

if (existingAgentId && existingAgentId !== "agent_funder_unprovisioned") {
  await getAgent(apiKey, existingAgentId); // throws if it no longer exists
  agentId = existingAgentId;
  await updateAgent(apiKey, agentId, updateOpts);
} else {
  const matches = await findAgentsByName(apiKey, AGENT_NAME);
  if (matches.length > 1) {
    console.error(
      `Refusing to guess: ${matches.length} agents named "${AGENT_NAME}" exist (${matches
        .map((m) => m.agentId)
        .join(", ")}). Set NEXT_PUBLIC_ELEVENLABS_FUNDER_AGENT_ID to the right one.`,
    );
    process.exit(1);
  }
  if (matches.length === 1) {
    agentId = matches[0].agentId;
    await updateAgent(apiKey, agentId, updateOpts);
  } else {
    const result = await createAgent(apiKey, {
      config: { agentName: AGENT_NAME, voiceId },
      systemPrompt: SLOANE_BASE_PROMPT,
      firstMessage: SLOANE_FIRST_MESSAGE,
      enableOverrides: true,
    });
    agentId = result.agentId;
    created = true;
  }
}

// Enable per-session overrides (so each project page can inject its own prompt/greeting) + lock
// the Security allowlist (without it, anyone reading the public agent id could spend our key).
await setAgentOverrides(apiKey, agentId);
await setAllowlist(apiKey, agentId, allowedOrigins);

// NOTE: no post-call webhook here. Unlike Morgan (developer onboarding), the funder transcript is
// captured client-side by the VoiceWidget and submitted with the registration form — there is no
// funder_voice_conversations table to deliver to. Add a webhook (bindWorkspaceWebhook) only if we
// later want abandonment-proof server-side capture.

console.log(`  agent ${agentId} (${created ? "created" : "updated"}); overrides on; allowlist ${allowedOrigins.join(", ")}`);
console.log("\n✅ Done.");
console.log(`Set this (Vercel + .env.local, type=plain — it's a public id):`);
console.log(`NEXT_PUBLIC_ELEVENLABS_FUNDER_AGENT_ID=${agentId}`);
