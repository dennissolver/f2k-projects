"use client";

import { useCallback, useState } from "react";
import { VoiceWidget } from "@caistech/elevenlabs-convai/react";
import { developerVoiceConfig } from "@/voice.config";

export type VoiceMessage = { role: "user" | "assistant"; content: string };

/**
 * Morgan — the F2K developer-onboarding voice guide.
 *
 * Built on the canonical portfolio voice stack (@caistech/elevenlabs-convai's VoiceWidget +
 * the dedicated ElevenLabs agent provisioned in scripts/provision-developer-agent.mjs), the
 * same stack SayFix uses. The widget renders the SayFix shape — a circular avatar on top,
 * then the conversation/controls below.
 *
 * Morgan does two jobs in one chat: a short discovery conversation, then a GUIDED form fill
 * (she names each field below and tells the developer what to type where). Her prompt lives
 * in src/lib/developer-voice-prompt.mjs and is baked into the agent at provision time.
 *
 * The running transcript is lifted to the parent so it is submitted with the onboarding form
 * and stored for the F2K team. Voice turns arrive via onMessage; if voice can't run (no mic /
 * unsupported browser) the widget falls back to a typed box, which we route through the same
 * Claude brain (/api/developers/voice) so the guidance still works.
 */

interface Props {
  transcript: VoiceMessage[];
  onTranscriptChange: (messages: VoiceMessage[]) => void;
}

export default function DeveloperVoiceAgent({
  transcript,
  onTranscriptChange,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

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

  // Typed fallback (no mic): route through the same discovery brain so Morgan still guides.
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
        const res = await fetch("/api/developers/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: withUser.map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Morgan is unavailable right now.");
        onTranscriptChange([
          ...withUser,
          { role: "assistant", content: data.reply },
        ]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Morgan is unavailable right now — please carry on with the form below.",
        );
      } finally {
        setThinking(false);
      }
    },
    [transcript, onTranscriptChange],
  );

  return (
    <div className="bg-[#1A2744] text-white p-6 sm:p-8">
      <div className="mb-5">
        <p className="font-ibm-mono text-[0.6rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-2">
          Talk to Morgan
        </p>
        <h3 className="font-playfair text-2xl font-black leading-tight">
          Tell us your vision — and she&apos;ll help you fill the form
        </h3>
        <p className="text-white/60 font-archivo text-sm mt-2 max-w-md">
          Morgan asks a few focused questions about your project, then walks you
          through the form below field by field. It&apos;s optional — the form
          works on its own — and you can leave anything blank you don&apos;t have
          to hand.
        </p>
      </div>

      {/* The widget owns the avatar-on-top SayFix shape + the mic/begin controls. We render
          ONE unified transcript below it so the voice turns AND the typed-fallback turns show
          in the same place (the widget's own transcript only covers the live voice path). */}
      <VoiceWidget
        {...developerVoiceConfig}
        coachName="Morgan"
        avatarUrl="/female_avatar.jpeg"
        title="Talk to Morgan — your F2K onboarding guide. She'll help you complete the form below."
        onMessage={handleVoiceMessage}
        onTextFallbackSubmit={handleTextFallback}
        onError={(e) => setError(e)}
      />

      {transcript.length > 0 && (
        <div className="bg-white/5 rounded-lg p-4 mt-4 max-h-64 overflow-y-auto space-y-3">
          {transcript.map((m, i) => (
            <div key={i} className="font-archivo text-sm leading-relaxed">
              <span
                className={`font-semibold ${m.role === "assistant" ? "text-[#00B5AD]" : "text-white"}`}
              >
                {m.role === "assistant" ? "Morgan" : "You"}:
              </span>{" "}
              <span className="text-white/85">{m.content}</span>
            </div>
          ))}
        </div>
      )}

      {thinking && (
        <p className="font-archivo text-sm text-white/60 mt-3" aria-live="polite">
          Morgan is thinking…
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
