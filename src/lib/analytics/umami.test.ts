import { describe, it, expect } from "vitest";
import { normaliseReferrer, windowRange } from "./umami";

describe("normaliseReferrer", () => {
  it("treats empty/null referrers as direct", () => {
    expect(normaliseReferrer(null)).toBe("direct");
    expect(normaliseReferrer(undefined)).toBe("direct");
    expect(normaliseReferrer("")).toBe("direct");
    expect(normaliseReferrer("   ")).toBe("direct");
  });
  it("classifies email providers", () => {
    expect(normaliseReferrer("https://mail.google.com/")).toBe("email");
    expect(normaliseReferrer("outlook.live.com")).toBe("email");
  });
  it("classifies search engines", () => {
    expect(normaliseReferrer("https://www.google.com/")).toBe("search");
    expect(normaliseReferrer("bing.com")).toBe("search");
  });
  it("classifies social", () => {
    expect(normaliseReferrer("https://facebook.com/x")).toBe("social");
    expect(normaliseReferrer("https://t.co/abc")).toBe("social");
    expect(normaliseReferrer("linkedin.com")).toBe("social");
  });
  it("falls back to referral for everything else", () => {
    expect(normaliseReferrer("https://some-property-blog.com.au")).toBe("referral");
  });
});

describe("windowRange", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  it("'today' starts at local midnight", () => {
    const { startAt, endAt } = windowRange("today", now, null);
    expect(endAt).toBe(now.getTime());
    const start = new Date(startAt);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });

  it("'30d' starts 30 days before now", () => {
    const { startAt } = windowRange("30d", now, null);
    expect(now.getTime() - startAt).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("clamps a window start to the analytics-start-date floor", () => {
    const floor = new Date("2026-06-10T00:00:00Z");
    const { startAt } = windowRange("30d", now, floor); // 30d would predate the floor
    expect(startAt).toBe(floor.getTime());
  });

  it("'all' with no floor falls back to epoch 0", () => {
    const { startAt } = windowRange("all", now, null);
    expect(startAt).toBe(0);
  });
});
