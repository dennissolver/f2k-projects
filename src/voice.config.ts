// voice.config.ts — the F2K developer-onboarding voice agent ("Morgan").
//
// Dedicated ElevenLabs ConvAI agent provisioned by scripts/provision-developer-agent.mjs
// (canonical portfolio voice + the @caistech/elevenlabs-convai stack used by SayFix and the
// rest of the portfolio). The agentId is public/safe to commit — the workspace key is never
// exposed; abuse is bounded by the Security allowlist set at provision time.
//
// To refresh the prompt/voice: edit src/lib/developer-voice-prompt.mjs, then re-run
//   node scripts/provision-developer-agent.mjs
import type { VoiceConfig } from "@caistech/elevenlabs-convai";

export const developerVoiceConfig: VoiceConfig = {
  // Prod uses the dedicated F2K agent (bound to the PROD post-call webhook → prod DB). The demo
  // deploy overrides this with NEXT_PUBLIC_ELEVENLABS_DEVELOPER_AGENT_ID = its own agent (bound to
  // the DEMO webhook → demo DB), so demo conversations capture to demo, not prod. One ElevenLabs
  // agent can only post to one webhook URL, hence a separate agent per environment.
  agentId:
    process.env.NEXT_PUBLIC_ELEVENLABS_DEVELOPER_AGENT_ID ||
    "agent_5901ktzqy26zf9e9eyvxqfr28x47",
  placement: "inline",
  mode: "discovery",
  textFallback: true,
};

// "Sloane" — the F2K funder-onboarding voice guide. A SEPARATE dedicated ElevenLabs ConvAI
// agent (institutional persona) for the /funders pages, provisioned by
// scripts/provision-funder-agent.mjs with the GENERIC base prompt + overrides enabled. On a
// per-project funder page the component passes a per-project prompt via the widget's `overrides`
// so Sloane speaks that project's real numbers; on the overview he runs generic.
//
// Until the agent is provisioned, set NEXT_PUBLIC_ELEVENLABS_FUNDER_AGENT_ID to its id. The text
// fallback (/api/funders/voice) works regardless, so the pages stay functional without it.
export const funderVoiceConfig: VoiceConfig = {
  // Until a DEDICATED Sloane agent is provisioned (scripts/provision-funder-agent.mjs → set
  // NEXT_PUBLIC_ELEVENLABS_FUNDER_AGENT_ID), fall back to the already-provisioned Morgan agent.
  // FunderVoiceAgent ALWAYS passes a Sloane prompt+greeting via the widget `overrides`, so the
  // shared agent speaks as Sloane (with this project's numbers), never as Morgan. Swapping to a
  // real Sloane later is just setting the env var. (Caveat while sharing Morgan's agent: its
  // post-call webhook logs transcripts into developer_voice_conversations — cosmetic mislabel;
  // the form captures the authoritative transcript into funder_registrations. A dedicated Sloane
  // binds no webhook, removing this.)
  agentId:
    process.env.NEXT_PUBLIC_ELEVENLABS_FUNDER_AGENT_ID ||
    process.env.NEXT_PUBLIC_ELEVENLABS_DEVELOPER_AGENT_ID ||
    "agent_5901ktzqy26zf9e9eyvxqfr28x47",
  placement: "inline",
  mode: "discovery",
  textFallback: true,
};
