"use client";

import { useState } from "react";
import DeveloperVoiceAgent, { type VoiceMessage } from "./DeveloperVoiceAgent";
import DeveloperOnboardingForm from "./DeveloperOnboardingForm";

/**
 * Client wrapper that owns the voice-discovery transcript so it is shared
 * between Morgan (the voice agent) and the onboarding form — the form submits
 * the transcript along with the developer's typed details.
 */
export default function DeveloperOnboarding() {
  const [transcript, setTranscript] = useState<VoiceMessage[]>([]);

  return (
    <div className="space-y-8">
      <DeveloperVoiceAgent
        transcript={transcript}
        onTranscriptChange={setTranscript}
      />
      <DeveloperOnboardingForm voiceTranscript={transcript} />
    </div>
  );
}
