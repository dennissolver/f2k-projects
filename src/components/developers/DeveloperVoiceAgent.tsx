"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceMessage = { role: "user" | "assistant"; content: string };

/**
 * Morgan — the voice discovery agent for the developer onboarding page.
 *
 * Voice in/out runs entirely in the browser via the Web Speech API
 * (SpeechRecognition for speech-to-text, speechSynthesis for text-to-speech);
 * the reasoning happens server-side at /api/developers/voice (a real Claude
 * call via @caistech/ai-client). The running transcript is lifted to the parent
 * so it is submitted with the onboarding form and stored for the F2K team.
 *
 * Additive + graceful: if the browser has no SpeechRecognition (e.g. Firefox),
 * the component shows a typed fallback so the conversation still works, and the
 * whole agent is optional — the form below never depends on it.
 */

interface Props {
  transcript: VoiceMessage[];
  onTranscriptChange: (messages: VoiceMessage[]) => void;
}

type Status = "idle" | "listening" | "thinking" | "speaking";

export default function DeveloperVoiceAgent({
  transcript,
  onTranscriptChange,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [started, setStarted] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  const recognitionRef = useRef<any>(null);
  // Keep a ref to the latest transcript so async handlers read fresh state.
  const transcriptRef = useRef<VoiceMessage[]>(transcript);
  transcriptRef.current = transcript;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    setSttSupported(Boolean(SR));
    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        /* noop */
      }
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-AU";
    utter.rate = 1;
    utter.pitch = 1;
    setStatus("speaking");
    utter.onend = () => setStatus("idle");
    utter.onerror = () => setStatus("idle");
    window.speechSynthesis.speak(utter);
  }, []);

  // Send the running conversation to Morgan and append her reply.
  const sendToMorgan = useCallback(
    async (messages: VoiceMessage[]) => {
      setStatus("thinking");
      setError(null);
      try {
        const res = await fetch("/api/developers/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Morgan is unavailable right now.");
        }
        const reply: string = data.reply;
        const next = [...messages, { role: "assistant" as const, content: reply }];
        onTranscriptChange(next);
        speak(reply);
      } catch (err) {
        setStatus("idle");
        setError(
          err instanceof Error
            ? err.message
            : "Morgan is unavailable right now — please use the form below.",
        );
      }
    },
    [onTranscriptChange, speak],
  );

  const handleUserUtterance = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      const next = [
        ...transcriptRef.current,
        { role: "user" as const, content: clean },
      ];
      onTranscriptChange(next);
      void sendToMorgan(next);
    },
    [onTranscriptChange, sendToMorgan],
  );

  const startListening = useCallback(() => {
    setError(null);
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) return;
    try {
      window.speechSynthesis?.cancel();
      const recognition = new SR();
      recognition.lang = "en-AU";
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => setStatus("listening");
      recognition.onerror = (e: any) => {
        setStatus("idle");
        if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
          setError(
            "Microphone access was blocked. Allow the mic, or type your answer below.",
          );
        }
      };
      recognition.onend = () => {
        setStatus((s) => (s === "listening" ? "idle" : s));
      };
      recognition.onresult = (event: any) => {
        const text = event?.results?.[0]?.[0]?.transcript ?? "";
        handleUserUtterance(text);
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setStatus("idle");
      setError("Couldn't start the microphone — please type your answer below.");
    }
  }, [handleUserUtterance]);

  const stopAll = useCallback(() => {
    try {
      recognitionRef.current?.stop?.();
    } catch {
      /* noop */
    }
    window.speechSynthesis?.cancel();
    setStatus("idle");
  }, []);

  const beginConversation = useCallback(() => {
    setStarted(true);
    void sendToMorgan(transcriptRef.current); // empty → Morgan opens
  }, [sendToMorgan]);

  const submitTyped = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const v = typed;
      setTyped("");
      handleUserUtterance(v);
    },
    [typed, handleUserUtterance],
  );

  const statusLabel: Record<Status, string> = {
    idle: started ? "Tap the mic and answer" : "Ready when you are",
    listening: "Listening…",
    thinking: "Morgan is thinking…",
    speaking: "Morgan is speaking…",
  };

  return (
    <div className="bg-[#1A2744] text-white p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="font-ibm-mono text-[0.6rem] tracking-[0.4em] uppercase text-[#00B5AD] mb-2">
            Talk to Morgan
          </p>
          <h3 className="font-playfair text-2xl font-black leading-tight">
            Tell us your vision — out loud
          </h3>
          <p className="text-white/60 font-archivo text-sm mt-2 max-w-md">
            Morgan is a voice guide who&apos;ll ask a few focused questions about
            your project, goals and how you like to do deals. It&apos;s optional —
            the form below works on its own — but it helps us prepare properly.
          </p>
        </div>
        <div
          className="shrink-0 h-12 w-12 rounded-full bg-[#00B5AD]/20 flex items-center justify-center"
          aria-hidden
        >
          <svg
            className={`w-6 h-6 text-[#00B5AD] ${status === "listening" || status === "speaking" ? "animate-pulse" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z M19 10v2a7 7 0 01-14 0v-2 M12 19v4"
            />
          </svg>
        </div>
      </div>

      {/* Transcript */}
      {transcript.length > 0 && (
        <div className="bg-white/5 rounded-lg p-4 mb-4 max-h-64 overflow-y-auto space-y-3">
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

      {error && (
        <div className="bg-amber-400/10 border border-amber-400/30 text-amber-200 px-4 py-2 text-sm font-archivo mb-4">
          {error}
        </div>
      )}

      {!started ? (
        <button
          type="button"
          onClick={beginConversation}
          className="bg-[#00B5AD] hover:bg-[#009E97] text-white px-6 py-3 font-archivo font-semibold transition-colors"
        >
          Start the conversation
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="font-archivo text-sm text-white/60 min-w-[150px]">
              {statusLabel[status]}
            </span>
            {sttSupported &&
              (status === "listening" ? (
                <button
                  type="button"
                  onClick={stopAll}
                  className="bg-white/10 hover:bg-white/20 px-5 py-2.5 font-archivo font-semibold transition-colors"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startListening}
                  disabled={status === "thinking" || status === "speaking"}
                  className="bg-[#00B5AD] hover:bg-[#009E97] disabled:opacity-50 px-5 py-2.5 font-archivo font-semibold transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z M19 11a7 7 0 01-14 0H3a9 9 0 008 8.94V23h2v-3.06A9 9 0 0021 11h-2z" />
                  </svg>
                  Answer
                </button>
              ))}
            {(status === "speaking" || status === "thinking") && (
              <button
                type="button"
                onClick={stopAll}
                className="text-white/50 hover:text-white text-sm font-archivo underline"
              >
                Stop
              </button>
            )}
          </div>

          {/* Typed fallback — always available, and the primary path when STT
              is unsupported. */}
          <form onSubmit={submitTyped} className="flex gap-2">
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={
                sttSupported
                  ? "…or type your answer here"
                  : "Type your answer here"
              }
              className="flex-1 bg-white/10 border border-white/15 px-4 py-2.5 font-archivo text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#00B5AD]"
            />
            <button
              type="submit"
              disabled={!typed.trim() || status === "thinking"}
              className="bg-white/10 hover:bg-white/20 disabled:opacity-40 px-5 py-2.5 font-archivo font-semibold transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
