import { describe, it, expect } from "vitest";
import { computeConversion } from "./conversion";

describe("computeConversion", () => {
  it("returns null when there is no funnel (submissions === null)", () => {
    expect(computeConversion(null, 100)).toBeNull();
  });
  it("returns null on a zero denominator (no divide-by-zero → no NaN/Infinity)", () => {
    expect(computeConversion(5, 0)).toBeNull();
  });
  it("returns null on a missing denominator", () => {
    expect(computeConversion(5, null)).toBeNull();
    expect(computeConversion(5, undefined)).toBeNull();
  });
  it("computes the fraction for valid inputs", () => {
    expect(computeConversion(12, 100)).toBeCloseTo(0.12, 5);
    expect(computeConversion(0, 80)).toBe(0); // zero conversions, real denominator
  });
});
