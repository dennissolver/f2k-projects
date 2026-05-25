"use client";

import { useState } from "react";
import Image from "next/image";

const PLANS = [
  {
    src: "/branscombe/floorplan-1a.png",
    alt: "Floor plan Type 1A — 104m² + 24m² deck",
    label: "Type 1A — 104m² + 24m² Deck",
    types: "U1, U3, U9, U11, U14, U19, U22, U27, U32, U37",
  },
  {
    src: "/branscombe/floorplan-1b.png",
    alt: "Floor plan Type 1B — 104m² + 24m² deck",
    label: "Type 1B — 104m² + 24m² Deck",
    types: "U2, U7, U12, U17, U23, U28, U33",
  },
  {
    src: "/branscombe/floorplan-2a.png",
    alt: "Floor plan Type 2A — 114m² + 24m² deck",
    label: "Type 2A — 114m² + 24m² Deck",
    types: "U4, U8, U13, U18, U24, U29, U34",
  },
  {
    src: "/branscombe/floorplan-2b.png",
    alt: "Floor plan Type 2B — 114m² + 24m² deck",
    label: "Type 2B — 114m² + 24m² Deck",
    types: "U5, U10, U15, U20, U25, U30, U35",
  },
  {
    src: "/branscombe/floorplan-2c.png",
    alt: "Floor plan Type 2C — 114m² + 24m² deck",
    label: "Type 2C — 114m² + 24m² Deck",
    types: "U6, U16, U21, U26, U31, U36",
  },
];

export default function FloorPlanGallery() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <button
            key={plan.src}
            type="button"
            onClick={() => setExpanded(plan.src)}
            className="bg-white p-3 border border-black/5 hover:border-[#00B5AD]/40 transition-colors cursor-pointer group text-left"
          >
            <div className="relative w-full h-56 bg-white">
              <Image
                src={plan.src}
                alt={plan.alt}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-contain"
              />
            </div>
            <div className="mt-3">
              <p className="font-archivo text-sm font-semibold text-deep-blue group-hover:text-[#00B5AD] transition-colors">
                {plan.label}
              </p>
              <p className="font-archivo text-[0.65rem] text-slate/50 mt-1">
                Homes: {plan.types}
              </p>
              <p className="font-ibm-mono text-[0.6rem] tracking-wider text-[#00B5AD] mt-2 uppercase">
                Click to view full size
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox overlay */}
      {expanded && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setExpanded(null)}
        >
          <button
            type="button"
            onClick={() => setExpanded(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl font-light z-[101]"
            aria-label="Close"
          >
            &times;
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={expanded}
            alt="Floor plan — enlarged view"
            className="max-w-full max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
