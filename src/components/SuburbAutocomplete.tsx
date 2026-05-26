"use client";

import { useState, useEffect, useRef } from "react";
import { forwardSearch, featureToGeocodedAddress } from "@caistech/mapbox";
import type { MapboxFeature } from "@caistech/mapbox";

/**
 * Suburb/town autocomplete backed by @caistech/mapbox (AU geocoding) — the
 * shared geocoding layer, NOT a hand-rolled Mapbox fetch. Used by the
 * Branscombe + Seafields registration forms.
 *
 * Additive + graceful: if NEXT_PUBLIC_MAPBOX_TOKEN is absent or the request
 * fails, @caistech/mapbox returns [] and this behaves as a plain text input —
 * it can never block the field. Free-typed text is always captured via
 * onChange; selecting a suggestion fills the suburb and, when available, the
 * postcode. Suggestion rows are 44px tap targets with 16px text for mobile.
 */

interface Props {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onSelectPostcode?: (postcode: string) => void;
  className?: string;
  placeholder?: string;
}

export default function SuburbAutocomplete({
  id,
  value,
  onChange,
  onSelectPostcode,
  className,
  placeholder,
}: Props) {
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  // Skip the lookup immediately after the user picks a suggestion.
  const justSelected = useRef(false);

  useEffect(() => {
    if (justSelected.current || value.trim().length < 4) {
      justSelected.current = false;
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const results = await forwardSearch(value);
        if (cancelled) return;
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch {
        /* network failure — degrade to plain input */
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (f: MapboxFeature) => {
    justSelected.current = true;
    const addr = featureToGeocodedAddress(f);
    onChange(addr.suburb || addr.formatted_address || "");
    if (addr.postcode && onSelectPostcode) onSelectPostcode(addr.postcode);
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        className={className}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-black/10 shadow-lg max-h-60 overflow-auto">
          {suggestions.map((f, i) => {
            const addr = featureToGeocodedAddress(f);
            return (
              <li key={`${f.id}-${i}`}>
                <button
                  type="button"
                  onClick={() => pick(f)}
                  className="w-full text-left px-4 py-3 min-h-[44px] text-base font-archivo text-deep-blue hover:bg-[#00B5AD]/10 transition-colors"
                >
                  {addr.formatted_address || addr.suburb}
                  {addr.postcode && (
                    <span className="text-slate/50 text-sm"> &middot; {addr.postcode}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
