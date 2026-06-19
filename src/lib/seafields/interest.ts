/**
 * Seafields "Land vs House & Land" interest classification.
 *
 * The ROI form lets a registrant choose one of three options:
 *   - "Vacant serviced land only"
 *   - "House & land package (Factory2Key modular build)"
 *   - "Either — exploring options"
 *
 * That choice decides who leads the sale: the agent sells the LAND portion,
 * Factory2Key sells the HOUSE (build) portion. These helpers normalise the
 * raw stored string into a stable kind + the short labels used on the admin
 * registrations table and in the notification email heading, so Uwe and the
 * agent can see at a glance whether the two of them need to coordinate.
 */

export type InterestKind = "land" | "house" | "either" | "unknown";

/** Classify the raw stored interest_type string into a stable kind. */
export function interestKind(raw: string | null | undefined): InterestKind {
  if (!raw) return "unknown";
  const s = raw.toLowerCase();
  // "Either — exploring options" carries neither "house" nor "land", but
  // check it first so the intent is unambiguous.
  if (s.includes("either")) return "either";
  // "House & land package…" contains BOTH "house" and "land" — test house
  // before land so it isn't mis-classified as land-only.
  if (s.includes("house")) return "house";
  if (s.includes("land")) return "land";
  return "unknown";
}

/** Short label for the admin registrations table cell. */
export function interestShortLabel(raw: string | null | undefined): string {
  switch (interestKind(raw)) {
    case "land":
      return "Land only";
    case "house":
      return "House & Land";
    case "either":
      return "Either";
    default:
      return raw ? raw : "—";
  }
}

/**
 * Heading tag for the notification email subject + heading. Returns null when
 * no interest was recorded, so callers can omit the tag entirely.
 */
export function interestEmailTag(raw: string | null | undefined): string | null {
  switch (interestKind(raw)) {
    case "land":
      return "Land Only";
    case "house":
      return "House & Land";
    case "either":
      return "Either — Land or House & Land";
    default:
      return null;
  }
}

/**
 * One-line coordination note for the email body — tells Uwe and the agent who
 * leads which side of the sale so the land sale (agent) and the build sale
 * (Factory2Key) are both managed.
 */
export function interestCoordinationNote(
  raw: string | null | undefined,
): string | null {
  switch (interestKind(raw)) {
    case "land":
      return "Land Only enquiry — the agent leads the land sale.";
    case "house":
      return "House &amp; Land enquiry — Factory2Key leads the modular build; coordinate with the agent on the land.";
    case "either":
      return "Exploring options (land or house &amp; land) — coordinate the agent (land) and Factory2Key (build).";
    default:
      return null;
  }
}

/** Tailwind badge classes for the admin table, keyed by interest kind. */
export function interestBadgeClass(raw: string | null | undefined): string {
  switch (interestKind(raw)) {
    case "land":
      return "bg-amber-100 text-amber-800";
    case "house":
      return "bg-blue-100 text-blue-800";
    case "either":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-gray-100 text-gray-500";
  }
}
