/**
 * ROI portal — the representation guardrail for unit options (spec §8).
 *
 * A unit's type / beds / baths / area may ONLY be rendered when `authorised_for_display`
 * is true. Unauthorised units are selectable by number only — never with type/area detail.
 * This is the single place that mapping lives, so the qualify page and the guardrail test
 * share exactly one implementation (no drift).
 */

export type UnitOption = { number: number; label: string };

export interface UnitRow {
  unit_number: number;
  type_code?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  internal_area_m2?: number | null;
  authorised_for_display?: boolean | null;
}

/**
 * Map raw unit rows to selectable options. Authorised units get a descriptive label
 * (beds / baths / area); unauthorised units get ONLY "Home N" — no detail leaks.
 */
export function buildUnitOptions(rows: UnitRow[]): UnitOption[] {
  return (rows ?? []).map((u) => {
    if (u.authorised_for_display) {
      const bits = [
        u.bedrooms != null ? `${u.bedrooms} bed` : null,
        u.bathrooms != null ? `${u.bathrooms} bath` : null,
        u.internal_area_m2 != null ? `${u.internal_area_m2}m²` : null,
      ].filter(Boolean);
      return {
        number: u.unit_number,
        label: `Home ${u.unit_number}${bits.length ? ` — ${bits.join(" / ")}` : ""}`,
      };
    }
    return { number: u.unit_number, label: `Home ${u.unit_number}` };
  });
}
