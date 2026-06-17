import { describe, it, expect } from "vitest";
import { ReportQuerySpecSchema, REPORT_CAPABILITIES, capabilityManifestForLLM } from "./query-spec";

describe("ReportQuerySpecSchema", () => {
  it("applies safe defaults from a minimal spec", () => {
    const spec = ReportQuerySpecSchema.parse({ dataset: "registrations" });
    expect(spec.estate).toBe("all");
    expect(spec.groupBy).toBe("none");
    expect(spec.metrics).toEqual(["count"]);
    expect(spec.view).toBe("table");
    expect(spec.format).toBe("screen");
    expect(spec.filters).toEqual({ agent: null, buyerType: null, financeStatus: null });
  });

  it("rejects an unknown dataset (the LLM cannot invent one)", () => {
    expect(ReportQuerySpecSchema.safeParse({ dataset: "secrets" }).success).toBe(false);
  });

  it("rejects an unknown group-by / view / metric", () => {
    expect(
      ReportQuerySpecSchema.safeParse({ dataset: "registrations", groupBy: "ssn" }).success,
    ).toBe(false);
    expect(
      ReportQuerySpecSchema.safeParse({ dataset: "registrations", view: "raw-sql" }).success,
    ).toBe(false);
    expect(
      ReportQuerySpecSchema.safeParse({ dataset: "registrations", metrics: ["dump"] }).success,
    ).toBe(false);
  });

  it("requires at least one metric", () => {
    expect(
      ReportQuerySpecSchema.safeParse({ dataset: "registrations", metrics: [] }).success,
    ).toBe(false);
  });
});

describe("REPORT_CAPABILITIES", () => {
  it("describes the three datasets with a basis each", () => {
    expect(REPORT_CAPABILITIES.datasets.map((d) => d.key).sort()).toEqual([
      "emails",
      "lots",
      "registrations",
    ]);
    for (const d of REPORT_CAPABILITIES.datasets) {
      expect(["real", "partial", "gap"]).toContain(d.basis);
    }
  });

  it("renders a compact manifest string for the LLM", () => {
    const s = capabilityManifestForLLM();
    expect(s).toContain("DATASETS:");
    expect(s).toContain("registrations");
    expect(s).toContain("KNOWN GAPS");
  });
});
