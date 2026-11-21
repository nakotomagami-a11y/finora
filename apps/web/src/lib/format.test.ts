import { describe, expect, it } from "vitest";
import { formatShare, formatTokens, meterParts, usageShare } from "./format.ts";

describe("formatTokens", () => {
  it("writes standard tokens the way the screens do", () => {
    expect(formatTokens("en", 150_000)).toBe("150k");
    expect(formatTokens("en", 85_000)).toBe("85k");
    expect(formatTokens("en", 310_000)).toBe("310k");
    expect(formatTokens("en", 2_900_000)).toBe("2.9M");
    expect(formatTokens("en", 3_300_000)).toBe("3.3M");
    expect(formatTokens("en", 999)).toBe("999");
    expect(formatTokens("en", 0)).toBe("0");
  });

  it("rounds down, so a number never reads larger than it is", () => {
    expect(formatTokens("en", 149_999)).toBe("149.9k");
    expect(formatTokens("en", 2_999_999)).toBe("2.9M");
  });

  it("uses the decimal mark of the locale", () => {
    expect(formatTokens("lv", 2_900_000)).toBe("2,9M");
    expect(formatTokens("et", 3_300_000)).toBe("3,3M");
    expect(formatTokens("lt", 1500)).toBe("1,5k");
  });

  it("never goes below zero and ignores a fraction", () => {
    expect(formatTokens("en", -5)).toBe("0");
    expect(formatTokens("en", 1234.9)).toBe("1.2k");
  });
});

describe("usageShare", () => {
  const usage = { used: 120_000, held: 20_000, cap: 500_000 };

  it("counts what is held while a run is in progress, and only what is used once it has settled", () => {
    expect(usageShare(usage, false)).toBe(28);
    expect(usageShare(usage, true)).toBe(24);
  });

  it("rounds down", () => {
    expect(usageShare({ used: 499_999, held: 0, cap: 500_000 }, true)).toBe(99);
  });

  it("is 0 for an empty cap and stops at 100", () => {
    expect(usageShare({ used: 5, held: 0, cap: 0 }, false)).toBe(0);
    expect(usageShare({ used: 900_000, held: 0, cap: 500_000 }, true)).toBe(100);
  });
});

describe("meterParts", () => {
  it("draws used as the solid fill and held as a lighter band after it", () => {
    expect(meterParts({ used: 120_000, held: 20_000, cap: 500_000 }, false)).toEqual({ solid: 24, band: 4 });
  });

  it("has no band once a run has settled", () => {
    expect(meterParts({ used: 120_000, held: 20_000, cap: 500_000 }, true)).toEqual({ solid: 24, band: 0 });
  });

  it("is empty for an empty cap", () => {
    expect(meterParts({ used: 1, held: 1, cap: 0 }, false)).toEqual({ solid: 0, band: 0 });
  });
});

describe("formatShare", () => {
  it("writes the share with a percent sign in every locale", () => {
    expect(formatShare("en", 28)).toBe("28%");
    for (const locale of ["lv", "lt", "et"] as const) expect(formatShare(locale, 28)).toMatch(/^28\s?%$/u);
  });
});
