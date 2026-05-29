"use client";

import { useState } from "react";

type ViewMode = "plan" | "stage2" | "aerial" | "panorama";

const VIEWS: { mode: ViewMode; label: string; description: string }[] = [
  { mode: "plan", label: "Plan view", description: "Lot layout plan" },
  { mode: "stage2", label: "Schematic grid", description: "Stage 2 approval plan" },
  { mode: "aerial", label: "Satellite", description: "Aerial view of the estate" },
  { mode: "panorama", label: "Official drawing", description: "Panoramic views from the estate" },
];

const VIEW_IMAGES: Record<ViewMode, string> = {
  plan: "/wavecrest/wavecrest-lot-layout.png",
  stage2: "/wavecrest/wavecrest-stage2-approval.png",
  aerial: "/wavecrest/wavecrest-aerial.jpg",
  panorama: "/wavecrest/wavecrest-panorama.jpg",
};

export default function SiteMap() {
  const [viewMode, setViewMode] = useState<ViewMode>("plan");

  return (
    <div>
      {/* View mode toggle */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="font-archivo text-xs text-slate font-semibold uppercase tracking-wider">
          View:
        </span>
        <div className="inline-flex border-2 border-deep-blue/20 rounded-sm overflow-hidden">
          {VIEWS.map((view) => {
            const isActive = viewMode === view.mode;
            return (
              <button
                key={view.mode}
                type="button"
                onClick={() => setViewMode(view.mode)}
                className={`font-archivo text-xs px-3 py-1.5 transition-colors ${
                  isActive
                    ? "bg-deep-blue text-white"
                    : "bg-white text-slate hover:bg-deep-blue/5"
                }`}
              >
                {view.label}
              </button>
            );
          })}
        </div>
        <span className="font-archivo text-xs text-slate/60 ml-2">
          {VIEWS.find((v) => v.mode === viewMode)?.description}
        </span>
      </div>

      {/* Image display */}
      <div className="bg-white border border-black/10 p-1">
        <img
          src={VIEW_IMAGES[viewMode]}
          alt={`Wavecrest Estate - ${VIEWS.find((v) => v.mode === viewMode)?.label}`}
          className="w-full h-auto"
        />
      </div>

      {/* Image navigation hint */}
      <div className="mt-2 flex items-center justify-between">
        <div className="font-archivo text-xs text-slate/60">
          Use the tabs above to switch between views
        </div>
        <div className="flex gap-1">
          {VIEWS.map((view, idx) => (
            <button
              key={view.mode}
              type="button"
              onClick={() => setViewMode(view.mode)}
              className={`w-2 h-2 rounded-full transition-colors ${
                viewMode === view.mode
                  ? "bg-[#00B5AD]"
                  : "bg-slate/20 hover:bg-slate/40"
              }`}
              aria-label={`Go to ${view.label}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
