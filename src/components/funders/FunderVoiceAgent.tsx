"use client";

import { useCallback, useMemo, useState } from "react";
import { VoiceWidget } from "@caistech/elevenlabs-convai/react";
import { funderVoiceConfig } from "@/voice.config";
import {
  buildSterlingPrompt,
  buildSterlingFirstMessage,
  STERLING_BASE_PROMPT,
  STERLING_FIRST_MESSAGE,
} from "@/lib/funder-voice-prompt.mjs";
import type { ProjectFundingModel } from "@/data/funding";

export type VoiceMessage = { role: "user" | "assistant"; content: string };

/**
 * Sterling — the F2K funder-onboarding voice guide. The funder analog of Morgan
 * (DeveloperVoiceAgent): the SAME canonical portfolio voice stack
 * (@caistech/elevenlabs-convai's VoiceWidget + a dedicated ElevenLabs agent provisioned in
 * scripts/provision-funder-agent.mjs), the same avatar-on-top SayFix shape, the same
 * transcript-lifted-to-parent + typed-fallback wiring.
 *
 * Sterling does two jobs in one short conversation: explain the back-to-back funding model +
 * the senior/junior structure, then GUIDE the funder through the registration form field by
 * field. When `project` is supplied (a confirmed funder page), his prompt + greeting are
 * overridden per-project so he speaks that project's real numbers (the agent is provisioned
 * with overrides enabled); on the overview he runs generic. The typed fallback routes through
 * the same brain (/api/funders/voice) with the project_slug so guidance never drifts.
 */

interface Props {
  transcript: VoiceMessage[];
  onTranscriptChange: (messages: VoiceMessage[]) => void;
  /** The live ElevenLabs conversation id (from onConnect), lifted so the form can submit it. */
  onConversationId?: (conversationId: string) => void;
  /** When set, Sterling speaks to this project's real figures. Omit on the overview page. */
  project?: ProjectFundingModel;
}

export default function FunderVoiceAgent({
  transcript,
  onTranscriptChange,
  onConversationId,
  project,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  // ALWAYS override the prompt+greeting to Sterling — per-project (real numbers) on a project
  // page, generic on the overview. This is also what lets the funder pages safely share the
  // provisioned Morgan agent (see funderVoiceConfig): without an override the shared agent would
  // speak as Morgan. A dedicated Sterling agent honours these overrides identically.
  const overrides = useMemo(
    () =>
      project
        ? {
            agent: {
              prompt: { prompt: buildSterlingPrompt(project) },
              firstMessage: buildSterlingFirstMessage(project),
            },
          }
        : {
            agent: {
              prompt: { prompt: STERLING_BASE_PROMPT },
              firstMessage: STERLING_FIRST_MESSAGE,
            },
          },
    [project],
  );

  // Voice turns: the widget hands us each final message (source 'ai' | 'user').
  const handleVoiceMessage = useCallback(
    (role: string, text: string) => {
      const clean = text.trim();
      if (!clean) return;
      onTranscriptChange([
        ...transcript,
        { role: role === "user" ? "user" : "assistant", content: clean },
      ]);
    },
    [transcript, onTranscriptChange],
  );

  // Typed fallback (no mic): route through the same discovery brain so Sterling still guides.
  const handleTextFallback = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      const withUser: VoiceMessage[] = [
        ...transcript,
        { role: "user", content: clean },
      ];
      onTranscriptChange(withUser);
      setThinking(true);
      setError(null);
      try {
        const res = await fetch("/api/funders/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: withUser.map((m) => ({ role: m.role, content: m.content })),
            project_slug: project?.slug ?? null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Sterling is unavailable right now.");
        onTranscriptChange([
          ...withUser,
          { role: "assistant", content: data.reply },
        ]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Sterling is unavailable right now — please carry on with the form below.",
        );
      } finally {
        setThinking(false);
      }
    },
    [transcript, onTranscriptChange, project],
  );

  return (
    <div className="bg-[#142C44] text-white p-6 sm:p-8 rounded">
      <div className="mb-5">
        <p className="font-ibm-mono text-xs tracking-[0.4em] uppercase text-[#C77F3A] mb-2">
          Talk to Sterling
        </p>
        <h3 className="font-archivo text-2xl font-black leading-tight">
          Senior or junior? Sterling will walk you through it
        </h3>
        <p className="text-white/60 font-archivo text-sm mt-2 max-w-md">
          Sterling explains the funding model and the senior/junior structure
          {project ? ` for ${project.name}` : ""}, then helps you complete the
          registration below, field by field. It&apos;s optional — the form works
          on its own — and this is a registration of interest only, not advice or
          an offer.
        </p>
      </div>

      {/* The widget owns the avatar-on-top SayFix shape + the mic/begin controls. We render ONE
          unified transcript below it so voice turns AND typed-fallback turns show in one place. */}
      <VoiceWidget
        {...funderVoiceConfig}
        coachName="Sterling"
        // TODO(avatar): reusing Morgan's avatar as a placeholder — provide a dedicated funder
        // avatar in /public (e.g. /sterling_avatar.jpeg) and point avatarUrl at it.
        avatarUrl="/female_avatar.jpeg"
        title="Talk to Sterling — F2K's funder guide. He'll explain the structure and help you complete the registration below."
        overrides={overrides}
        onConnect={(conversationId) => onConversationId?.(conversationId)}
        onMessage={handleVoiceMessage}
        onTextFallbackSubmit={handleTextFallback}
        onError={(e) => setError(e)}
      />

      {transcript.length > 0 && (
        <div className="bg-white/5 rounded-lg p-4 mt-4 max-h-64 overflow-y-auto space-y-3">
          {transcript.map((m, i) => (
            <div key={i} className="font-archivo text-sm leading-relaxed">
              <span
                className={`font-semibold ${m.role === "assistant" ? "text-[#C77F3A]" : "text-white"}`}
              >
                {m.role === "assistant" ? "Sterling" : "You"}:
              </span>{" "}
              <span className="text-white/85">{m.content}</span>
            </div>
          ))}
        </div>
      )}

      {thinking && (
        <p className="font-archivo text-sm text-white/60 mt-3" aria-live="polite">
          Sterling is thinking…
        </p>
      )}

      {error && (
        <div className="bg-amber-400/10 border border-amber-400/30 text-amber-200 px-4 py-2 text-sm font-archivo mt-4">
          {error}
        </div>
      )}
    </div>
  );
}
