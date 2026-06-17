"use client";

import { useCallback, useMemo, useState } from "react";
import { VoiceWidget } from "@caistech/elevenlabs-convai/react";
import { reportsVoiceConfig } from "@/voice.config";
import { REPORTS_VOICE_PROMPT, REPORTS_FIRST_MESSAGE } from "@/lib/reports-voice-prompt.mjs";
import type { ReportQuerySpec } from "@/lib/reports/query-spec";

export type VoiceMessage = { role: "user" | "assistant"; content: string };

/**
 * Morgan — the admin REPORTS consultant. The reports analog of DeveloperVoiceAgent / FunderVoiceAgent:
 * the SAME canonical voice stack (@caistech/elevenlabs-convai VoiceWidget + the shared Morgan agent
 * with per-surface prompt overrides), the same avatar-on-top shape, the same transcript-lifted +
 * typed-fallback wiring.
 *
 * Morgan runs report discovery and GUIDES the operator to the building-block form; the typed fallback
 * routes through /api/admin/reports/voice, which returns her next line AND — once the request is
 * confirmed — a validated ReportQuerySpec. When a spec arrives we hand it up via onSpec so the page
 * fills the form and runs it. (Voice turns guide the form; spec emission comes through the typed brain.)
 */

interface Props {
  transcript: VoiceMessage[];
  onTranscriptChange: (messages: VoiceMessage[]) => void;
  /** Called when Morgan emits a confirmed, validated report spec. */
  onSpec: (spec: ReportQuerySpec) => void;
}

export default function ReportsVoiceAgent({ transcript, onTranscriptChange, onSpec }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  // Always override the shared Morgan agent to the reports consultant prompt + greeting.
  const overrides = useMemo(
    () => ({
      agent: {
        prompt: { prompt: REPORTS_VOICE_PROMPT },
        firstMessage: REPORTS_FIRST_MESSAGE,
      },
    }),
    [],
  );

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

  const handleTextFallback = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      const withUser: VoiceMessage[] = [...transcript, { role: "user", content: clean }];
      onTranscriptChange(withUser);
      setThinking(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/reports/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: withUser.map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Morgan is unavailable right now.");
        onTranscriptChange([...withUser, { role: "assistant", content: data.reply }]);
        if (data.spec) onSpec(data.spec as ReportQuerySpec);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Morgan is unavailable — build your report with the form below.",
        );
      } finally {
        setThinking(false);
      }
    },
    [transcript, onTranscriptChange, onSpec],
  );

  return (
    <div className="rounded-lg bg-slate-900 p-6 text-white">
      <div className="mb-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.3em] text-emerald-300">
          Talk to Morgan
        </p>
        <h3 className="mt-1 text-lg font-semibold">Describe the report you need</h3>
        <p className="mt-1 max-w-md text-sm text-white/60">
          Tell Morgan what you want to see — estate, date range, breakdown, and what it&apos;s for.
          She resolves it to an exact request, flags anything the data can&apos;t answer yet, and
          fills the form below. You can always build it by hand instead.
        </p>
      </div>

      <VoiceWidget
        {...reportsVoiceConfig}
        coachName="Morgan"
        avatarUrl="/female_avatar.jpeg"
        title="Talk to Morgan — your reports consultant. She builds the exact report you ask for."
        overrides={overrides}
        onMessage={handleVoiceMessage}
        onTextFallbackSubmit={handleTextFallback}
        onError={(e) => setError(e)}
      />

      {transcript.length > 0 && (
        <div className="mt-4 max-h-56 space-y-2 overflow-y-auto rounded-lg bg-white/5 p-4">
          {transcript.map((m, i) => (
            <div key={i} className="text-sm leading-relaxed">
              <span className={`font-semibold ${m.role === "assistant" ? "text-emerald-300" : "text-white"}`}>
                {m.role === "assistant" ? "Morgan" : "You"}:
              </span>{" "}
              <span className="text-white/85">{m.content}</span>
            </div>
          ))}
        </div>
      )}

      {thinking && (
        <p className="mt-3 text-sm text-white/60" aria-live="polite">
          Morgan is thinking…
        </p>
      )}

      {error && (
        <div className="mt-3 rounded border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
          {error}
        </div>
      )}
    </div>
  );
}
