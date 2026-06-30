"use client";

import { useCallback, useMemo, useState } from "react";
import { VoiceWidget } from "@caistech/elevenlabs-convai/react";
import { estateVoiceConfig } from "@/voice.config";
import {
  CONCIERGE_NAME,
  buildEstatePrompt,
  buildEstateFirstMessage,
} from "@/lib/estate-voice-prompt.mjs";

export type VoiceMessage = { role: "user" | "assistant"; content: string };

/**
 * "Marni" — the buyer-facing estate CONCIERGE on the public landing + estate pages (the buyer
 * analog of Morgan/Sloane). Same canonical @caistech/elevenlabs-convai stack, shared with the
 * provisioned Morgan agent and driven entirely by per-estate `overrides` so she speaks as Marni
 * about THIS estate. A GUIDE/CLARIFIER, not a form-filler — so this component is self-contained
 * (its own transcript, no parent lift): it answers questions and points the visitor to the next
 * action (pick a lot / register / join the waitlist). If voice can't run (no mic / unsupported)
 * the widget falls back to a typed box routed through the same brain (/api/estate/voice) so the
 * guidance still works (degrade-don't-fake).
 */

export interface EstateVoiceContext {
  name: string;
  location?: string;
  stage?: string;
  pricing?: string;
  model?: "lot-map" | "waitlist";
  extra?: string;
}

export default function BuyerVoiceAgent({ estate }: { estate: EstateVoiceContext }) {
  const [transcript, setTranscript] = useState<VoiceMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  // ALWAYS override the prompt+greeting to Marni (with this estate's indicative facts). This is
  // also what lets the public pages safely share the provisioned Morgan agent (estateVoiceConfig):
  // without an override the shared agent would speak as Morgan.
  const overrides = useMemo(
    () => ({
      agent: {
        prompt: { prompt: buildEstatePrompt(estate) },
        firstMessage: buildEstateFirstMessage(estate),
      },
    }),
    [estate],
  );

  const handleVoiceMessage = useCallback((role: string, text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setTranscript((prev) => [
      ...prev,
      { role: role === "user" ? "user" : "assistant", content: clean },
    ]);
  }, []);

  // Typed fallback (no mic): route through the same brain so Marni still guides.
  const handleTextFallback = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      const withUser: VoiceMessage[] = [...transcript, { role: "user", content: clean }];
      setTranscript(withUser);
      setThinking(true);
      setError(null);
      try {
        const res = await fetch("/api/estate/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: withUser.map((m) => ({ role: m.role, content: m.content })),
            estate,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `${CONCIERGE_NAME} is unavailable right now.`);
        setTranscript([...withUser, { role: "assistant", content: data.reply }]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : `${CONCIERGE_NAME} is unavailable right now — please explore the estate below and register your interest.`,
        );
      } finally {
        setThinking(false);
      }
    },
    [transcript, estate],
  );

  return (
    <div className="estate-voice-widget bg-[#1A2744] text-white p-6 sm:p-8 rounded">
      <div className="mb-5">
        <p className="font-ibm-mono text-xs tracking-[0.4em] uppercase text-[#00B5AD] mb-2">
          Talk to {CONCIERGE_NAME}
        </p>
        <h3 className="font-archivo text-2xl font-black leading-tight">
          New here? {CONCIERGE_NAME} will show you around {estate.name}
        </h3>
        <p className="text-white/60 font-archivo text-base mt-2 max-w-md">
          Ask {CONCIERGE_NAME} what&apos;s available, the difference between buying land or a
          house-and-land package, or how to register your interest. It&apos;s optional — and
          registering is an expression of interest only, with no deposit and no obligation.
        </p>
      </div>

      <VoiceWidget
        {...estateVoiceConfig}
        coachName={CONCIERGE_NAME}
        avatarUrl="/female_avatar.jpeg"
        title={`Talk to ${CONCIERGE_NAME} — your guide to ${estate.name}. She explains what's on offer and how to register your interest.`}
        overrides={overrides}
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
                {m.role === "assistant" ? CONCIERGE_NAME : "You"}:
              </span>{" "}
              <span className="text-white/85">{m.content}</span>
            </div>
          ))}
        </div>
      )}

      {thinking && (
        <p className="font-archivo text-sm text-white/60 mt-3" aria-live="polite">
          {CONCIERGE_NAME} is thinking…
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
