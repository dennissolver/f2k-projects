/**
 * ROI portal — per-estate config that isn't (yet) a DB column.
 *
 * Colour schemes are estate-specific catalogue data (spec §6.D / §5: "estate config seeds
 * units, types, colour schemes"). Kept here keyed by slug until promoted to an estate column.
 * Adding an estate = add an entry (config, not code changes elsewhere).
 */

export const ESTATE_COLOUR_SCHEMES: Record<string, string[]> = {
  branscombe: ["The Forest", "Dark Contemporary", "Light Coastal"],
};

export function colourSchemesForEstate(slug: string): string[] {
  return ESTATE_COLOUR_SCHEMES[slug] ?? [];
}

/** Deposit menu (spec §7.C) — floor 5%, never anchored below. */
export const DEPOSIT_OPTIONS = ["5%", "7.5%", "10%", "Other"] as const;

export const PURCHASER_ENTITY_TYPES = [
  "Individual",
  "Joint",
  "Company",
  "Trust",
  "SMSF",
  "TBC",
] as const;

export const FINANCE_STATUSES = [
  "Cash",
  "Finance required",
  "Pre-approved",
] as const;

export const CONTACT_METHODS = ["Email", "Phone", "SMS"] as const;
