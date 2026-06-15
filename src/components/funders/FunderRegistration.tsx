"use client";

import { useState } from "react";
import FunderVoiceAgent, { type VoiceMessage } from "./FunderVoiceAgent";
import FunderRegistrationForm from "./FunderRegistrationForm";
import type { ProjectFundingModel } from "@/data/funding";

/**
 * Client wrapper that owns the Sterling discovery transcript so it is shared between the voice
 * agent and the registration form — the form submits the transcript with the funder's details.
 * The funder analog of DeveloperOnboarding: voice agent stacked above the form.
 */
export default function FunderRegistration({
  project,
  sourcePage,
}: {
  project: ProjectFundingModel;
  sourcePage: string;
}) {
  const [transcript, setTranscript] = useState<VoiceMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <FunderVoiceAgent
        project={project}
        transcript={transcript}
        onTranscriptChange={setTranscript}
        onConversationId={setConversationId}
      />
      <FunderRegistrationForm
        project={project}
        voiceTranscript={transcript}
        voiceConversationId={conversationId}
        sourcePage={sourcePage}
      />
    </div>
  );
}
