import { describe, it, expect } from "vitest";
import {
  dedupeByPerson,
  buildFunnel,
  funnelConversions,
  buildTiering,
  buildCoverage,
  buildBuyerMix,
  buildTrend,
  weekStartUTC,
  isOk,
  type RegRow,
  type LotRow,
} from "./funder-demand";

const reg = (over: Partial<RegRow> = {}): RegRow => ({
  email: "a@example.com",
  selection: [],
  buyerType: null,
  financeStatus: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  ...over,
});

const lot = (over: Partial<LotRow> = {}): LotRow => ({
  id: "1",
  retailPrice: 160000,
  allocatedTo: null,
  stage: null,
  intentLockedRegId: null,
  ...over,
});

describe("dedupeByPerson", () => {
  it("collapses rows sharing a (case-insensitive) email but keeps null-email rows distinct", () => {
    const rows = [
      reg({ email: "X@Example.com" }),
      reg({ email: "x@example.com" }),
      reg({ email: null }),
      reg({ email: null }),
    ];
    expect(dedupeByPerson(rows)).toHaveLength(3); // 1 deduped + 2 null
  });
});

describe("buildFunnel", () => {
  const rows = [
    reg({ email: "a@x.com", financeStatus: "Pre-approved by lender" }),
    reg({ email: "a@x.com", financeStatus: "Pre-approved by lender" }), // dup person, 2nd lot
    reg({ email: "b@x.com", financeStatus: "Currently exploring finance" }),
  ];
  const { stages } = buildFunnel(rows);

  it("counts registered (rows) and deduped registrants (people) separately", () => {
    const registered = stages.find((s) => s.key === "registered")!.metric;
    const deduped = stages.find((s) => s.key === "registered_deduped")!.metric;
    expect(isOk(registered) && registered.value).toBe(3);
    expect(isOk(deduped) && deduped.value).toBe(2);
  });

  it("reports self-declared finance pre-approval on deduped people", () => {
    const pa = stages.find((s) => s.key === "finance_pre_approval")!;
    expect(pa.basis).toBe("self-declared");
    expect(isOk(pa.metric) && pa.metric.value).toBe(1); // a@x.com once
  });

  it("returns gaps (not zeros) for un-instrumented stages", () => {
    for (const key of ["verified", "pre_qualified", "signed", "settled"]) {
      const s = stages.find((st) => st.key === key)!;
      expect(s.metric.status).toBe("gap");
      if (s.metric.status === "gap") {
        expect(s.metric.gap.toInstrument.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("funnelConversions", () => {
  it("computes a rate between two real stages and a gap when one is un-instrumented", () => {
    const { stages } = buildFunnel([reg(), reg({ email: "b@x.com" })]);
    const convs = funnelConversions(stages);
    const regToDedup = convs.find((c) => c.from === "registered" && c.to === "registered_deduped")!;
    expect(isOk(regToDedup.rate)).toBe(true);
    const dedupToVerified = convs.find((c) => c.to === "verified")!;
    expect(dedupToVerified.rate.status).toBe("gap");
  });
});

describe("buildTiering", () => {
  it("uses one tier per distinct price when there are few (≤8)", () => {
    const { order, tierOf } = buildTiering([155000, 160000, 155000, null]);
    expect(order).toContain("Unpriced");
    // two distinct priced tiers + unpriced
    expect(order.filter((o) => o !== "Unpriced")).toHaveLength(2);
    expect(tierOf(155000)).toBe(tierOf(155000));
    expect(tierOf(null)).toBe("Unpriced");
  });

  it("falls back to quartile bands when there are many distinct prices", () => {
    const prices = Array.from({ length: 20 }, (_, i) => 100000 + i * 1000);
    const { order } = buildTiering(prices);
    expect(order).toHaveLength(4); // four quartile bands, no unpriced
  });
});

describe("buildCoverage", () => {
  it("gaps out when the estate has no priced lot table", () => {
    const res = buildCoverage([reg()], []);
    expect(res.status).toBe("gap");
  });

  it("counts per-lot demand, flags thin tiers, and isolates the cheapest lots", () => {
    const lots = [
      lot({ id: "1", retailPrice: 155000 }),
      lot({ id: "2", retailPrice: 155000 }),
      lot({ id: "3", retailPrice: 190000, allocatedTo: "Jane Buyer" }),
      lot({ id: "4", retailPrice: 190000, intentLockedRegId: "reg-1" }),
    ];
    const rows = [
      reg({ email: "a@x.com", selection: ["1", "1" /* not double in one row normally */] }),
      reg({ email: "b@x.com", selection: ["1"] }),
      reg({ email: "c@x.com", selection: ["2"] }),
    ];
    const res = buildCoverage(rows, lots, { cheapestN: 2 });
    expect(isOk(res)).toBe(true);
    if (!isOk(res)) return;
    const v = res.value;

    expect(v.totalLots).toBe(4);
    expect(v.availableLots).toBe(3); // lot 3 has a firm buyer
    expect(v.intentLockedLots).toBe(1); // lot 4

    const lot1 = v.byLot.find((l) => l.id === "1")!;
    expect(lot1.demand).toBe(3); // two selections in row a + one in row b
    expect(lot1.available).toBe(true);

    // 190k tier has 2 lots, 0 demand → thin
    const dearTier = v.byTier.find((t) => t.demand === 0)!;
    expect(dearTier.thin).toBe(true);

    expect(v.cheapestLots.n).toBe(2);
    expect(v.cheapestLots.lotIds.sort()).toEqual(["1", "2"]);
    expect(v.coverStage).toMatch(/registered interest/i);
  });
});

describe("buildBuyerMix", () => {
  it("classifies OO vs investor, counts FHB + self-declared finance, and gaps the unrecorded bands", () => {
    const rows = [
      reg({ email: "a@x.com", buyerType: "First Home Buyer", financeStatus: "Pre-approved by lender" }),
      reg({ email: "b@x.com", buyerType: "Investor — Rental / SMSF", financeStatus: "Cash buyer — no finance needed" }),
      reg({ email: "c@x.com", buyerType: "Investor — Owner Occupier", financeStatus: "Currently exploring finance" }),
      reg({ email: "d@x.com", buyerType: null }),
    ];
    const mix = buildBuyerMix(rows);
    expect(mix.total).toBe(4);
    expect(mix.investor).toBe(1); // only Rental/SMSF
    expect(mix.ownerOccupier).toBe(2); // FHB + Investor—Owner Occupier
    expect(mix.unknownType).toBe(1);
    expect(mix.firstHomeBuyer).toBe(1);
    expect(mix.financeReady).toBe(2); // pre-approved + cash
    expect(mix.financePreApproval).toBe(1);
    expect(mix.selfDeclared).toBe(true);
    expect(mix.borrowingCapacityBands.status).toBe("gap");
    expect(mix.incomeBands.status).toBe("gap");
    expect(mix.fhbSchemeEligibility.status).toBe("gap");
  });
});

describe("buildTrend", () => {
  const rows = [
    reg({ createdAt: "2026-06-01T00:00:00Z" }), // Mon 2026-06-01
    reg({ createdAt: "2026-06-03T00:00:00Z" }), // same week
    reg({ createdAt: "2026-06-09T00:00:00Z" }), // next week
  ];

  it("buckets by ISO-week Monday with a running cumulative", () => {
    const t = buildTrend(rows, { now: new Date("2026-06-15T00:00:00Z") });
    expect(t.byWeek[0].weekStart).toBe("2026-06-01");
    expect(t.byWeek[0].count).toBe(2);
    expect(t.byWeek[1].weekStart).toBe("2026-06-08");
    expect(t.byWeek[1].cumulative).toBe(3);
    expect(t.total).toBe(3);
  });

  it("projects a trigger date from the run-rate when a threshold + supply are given", () => {
    const t = buildTrend(rows, { coverThreshold: 3, totalLots: 10, now: new Date("2026-06-15T00:00:00Z") });
    expect(isOk(t.projectedCover)).toBe(true);
    if (isOk(t.projectedCover)) {
      expect(t.projectedCover.value.targetRegistrations).toBe(30);
      expect(t.projectedCover.value.projectedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("gaps the projection when no threshold/supply is supplied", () => {
    const t = buildTrend(rows, {});
    expect(t.projectedCover.status).toBe("gap");
  });
});

describe("weekStartUTC", () => {
  it("returns the Monday of the week", () => {
    expect(weekStartUTC("2026-06-03T12:00:00Z")).toBe("2026-06-01"); // Wed → Mon
    expect(weekStartUTC("2026-06-07T23:00:00Z")).toBe("2026-06-01"); // Sun → Mon
    expect(weekStartUTC("2026-06-08T01:00:00Z")).toBe("2026-06-08"); // Mon → Mon
  });
});
