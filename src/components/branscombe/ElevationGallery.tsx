"use client";

import { useState } from "react";
import Image from "next/image";

// The three colour schemes are shared across Type 1 and Type 2 (confirmed by
// Unison / Luke Tingley, 2026-06-05 — finishes taken verbatim from the original
// concept-plan schedules). Defined once and reused for both types so the two
// galleries can never drift apart again (was F2KSFLDS-20).
//
// `name` is a plain-English colour tag estimated from the render + hex (the
// Unison/Dulux spec names alone don't read to buyers); it leads the caption
// with the spec name kept in muted text underneath.
type Finish = { part: string; name: string; colour: string; hex: string; note?: string };

const SCHEMES: {
  id: "scheme1" | "scheme2" | "scheme3";
  label: string;
  tag?: string;
  finishes: Finish[];
}[] = [
  {
    id: "scheme1",
    label: "Scheme 1 — The Forest",
    tag: "DA approved",
    finishes: [
      { part: "AXON cladding", name: "Charcoal", colour: "Dulux Domino", hex: "#3C3E3F" },
      { part: "STRIA cladding", name: "Stone Grey", colour: "Dulux Dieskau", hex: "#CBC9C5" },
      { part: "EASYLAP cladding", name: "Warm Timber", colour: "Dulux Malay", hex: "#8E7C66", note: "visual approximation" },
      { part: "Windows / metal", name: "Monument", colour: "Colorbond Monument", hex: "#323233" },
      { part: "Roof", name: "Basalt Grey", colour: "Colorbond Basalt", hex: "#6D6C6E" },
    ],
  },
  {
    id: "scheme2",
    label: "Scheme 2 — Dark Contemporary",
    finishes: [
      { part: "AXON cladding", name: "Charcoal", colour: "Dulux Domino", hex: "#3C3E3F" },
      { part: "STRIA cladding", name: "Graphite", colour: "Dulux Klavier", hex: "#363436" },
      { part: "EASYLAP cladding", name: "Slate Grey", colour: "Dulux Teahouse", hex: "#666966" },
      { part: "Windows / metal", name: "Monument", colour: "Colorbond Monument", hex: "#323233" },
      { part: "Roof", name: "Ironstone", colour: "Colorbond Ironstone", hex: "#3E434C" },
    ],
  },
  {
    id: "scheme3",
    label: "Scheme 3 — Light Coastal",
    finishes: [
      { part: "AXON cladding", name: "Soft Stone", colour: "Dulux Dieskau", hex: "#CBC9C5" },
      { part: "STRIA cladding", name: "Eucalypt Grey", colour: "Dulux Flooded Gum", hex: "#A3A29F" },
      { part: "EASYLAP cladding", name: "Natural White", colour: "Dulux Natural White", hex: "#EEECE5" },
      { part: "Windows / metal", name: "Shale Grey", colour: "Colorbond Shale Grey", hex: "#BDBFBA" },
      { part: "Roof", name: "Surfmist", colour: "Colorbond Surfmist", hex: "#E4E2D5" },
    ],
  },
];

const TYPES: { group: string; srcPrefix: string }[] = [
  { group: "Type 1 (104m²)", srcPrefix: "/branscombe/elevation-type1" },
  { group: "Type 2 (114m²)", srcPrefix: "/branscombe/elevation-type2" },
];

export default function ElevationGallery() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      <div className="space-y-10">
        {TYPES.map((type) => (
          <div key={type.group}>
            <h3 className="font-playfair text-xl font-black text-deep-blue mb-4">
              {type.group}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {SCHEMES.map((scheme) => {
                const src = `${type.srcPrefix}-${scheme.id}.jpeg`;
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setExpanded(src)}
                    className="bg-off-white p-2 border border-black/5 hover:border-[#00B5AD]/40 transition-colors cursor-pointer group text-left"
                  >
                    <Image
                      src={src}
                      alt={`${type.group} ${scheme.label}`}
                      width={600}
                      height={400}
                      className="w-full h-auto object-cover"
                    />
                    <p className="font-archivo text-sm font-semibold text-deep-blue mt-2 group-hover:text-[#00B5AD] transition-colors">
                      {scheme.label}
                      {scheme.tag && (
                        <span className="ml-2 inline-block align-middle bg-[#00B5AD]/10 text-[#0E7C77] text-[0.6rem] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded">
                          {scheme.tag}
                        </span>
                      )}
                    </p>
                    <dl className="mt-2 space-y-1">
                      {scheme.finishes.map((finish) => (
                        <div key={finish.part} className="flex items-start gap-1.5">
                          <span
                            className="mt-[3px] w-2.5 h-2.5 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: finish.hex }}
                            aria-hidden="true"
                          />
                          <dt className="font-archivo text-[0.65rem] text-slate/60 shrink-0">
                            {finish.part}:
                          </dt>
                          <dd className="font-archivo text-[0.65rem] text-slate/80 font-medium">
                            {finish.name}
                            <span className="text-slate/40"> — {finish.colour}</span>
                            {finish.note && (
                              <span className="text-slate/40"> ({finish.note})</span>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </button>
                );
              })}
            </div>
          </div>
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
            className="absolute top-4 right-4 flex items-center justify-center w-11 h-11 text-white/80 hover:text-white text-3xl font-light z-[101]"
            aria-label="Close"
          >
            &times;
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={expanded}
            alt="Elevation — enlarged view"
            className="max-w-full max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
