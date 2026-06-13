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
  agentId: "agent_5901ktzqy26zf9e9eyvxqfr28x47",
  placement: "inline",
  mode: "discovery",
  textFallback: true,
};
