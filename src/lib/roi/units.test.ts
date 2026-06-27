import { describe, it, expect } from "vitest";
import { buildUnitOptions } from "./units";

/**
 * Phase 5 — representation guardrail (spec §8): no unauthorised unit detail renders.
 * The label is the only thing surfaced to the buyer, so asserting on it is the guardrail.
 */
describe("buildUnitOptions — representation guardrail", () => {
  const authorised = {
    unit_number: 5,
    type_code: "2B",
    bedrooms: 3,
    bathrooms: 2,
    internal_area_m2: 114,
    authorised_for_display: true,
  };
  const unauthorised = {
    unit_number: 31,
    type_code: "2C",
    bedrooms: 2,
    bathrooms: 2,
    internal_area_m2: 114,
    authorised_for_display: false,
  };

  it("renders type/beds/area detail for an authorised unit", () => {
    const [opt] = buildUnitOptions([authorised]);
    expect(opt.number).toBe(5);
    expect(opt.label).toContain("3 bed");
    expect(opt.label).toContain("2 bath");
    expect(opt.label).toContain("114m²");
  });

  it("renders ONLY the number for an unauthorised unit — no detail leaks", () => {
    const [opt] = buildUnitOptions([unauthorised]);
    expect(opt.number).toBe(31);
    expect(opt.label).toBe("Home 31");
    // The guardrail: none of the withheld attributes appear.
    expect(opt.label).not.toContain("bed");
    expect(opt.label).not.toContain("bath");
    expect(opt.label).not.toContain("m²");
    expect(opt.label).not.toContain("2C");
  });

  it("applies the guardrail per-row in a mixed set", () => {
    const opts = buildUnitOptions([authorised, unauthorised]);
    expect(opts.find((o) => o.number === 5)!.label).toContain("bed");
    expect(opts.find((o) => o.number === 31)!.label).toBe("Home 31");
  });

  it("treats null/undefined authorised_for_display as NOT authorised (deny by default)", () => {
    const [opt] = buildUnitOptions([{ unit_number: 9, bedrooms: 3, authorised_for_display: null }]);
    expect(opt.label).toBe("Home 9");
    expect(opt.label).not.toContain("bed");
  });
});
