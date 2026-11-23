import { describe, expect, it } from "vitest";
import { formatShare, formatTokens, formatTokensLeft, meterParts, usageShare } from "./format.ts";

describe("formatTokens, rounding up by default (used, held, estimates)", () => {
  it("writes standard tokens the way the screens do", () => {
    expect(formatTokens("en", 150_000)).toBe("150k");
    expect(formatTokens("en", 85_000)).toBe("85k");
    expect(formatTokens("en", 310_000)).toBe("310k");
    expect(formatTokens("en", 500_000)).toBe("500k");
    expect(formatTokens("en", 3_300_000)).toBe("3.3M");
    expect(formatTokens("en", 999)).toBe("999");
    expect(formatTokens("en", 0)).toBe("0");
  });

  it("rounds up to the digit shown, so use never reads smaller than it is", () => {
    expect(formatTokens("en", 149_020)).toBe("149.1k");
    expect(formatTokens("en", 680_001)).toBe("680.1k");
    expect(formatTokens("en", 2_810_000)).toBe("2.9M");
    expect(formatTokens("en", 1001)).toBe("1.1k");
  });

  it("does not round a number that is already round", () => {
    expect(formatTokens("en", 149_000)).toBe("149k");
    expect(formatTokens("en", 2_900_000)).toBe("2.9M");
  });

  it("moves to millions when rounding up would write 1000k", () => {
    expect(formatTokens("en", 999_950)).toBe("1M");
    expect(formatTokens("en", 999_001)).toBe("999.1k");
    expect(formatTokens("en", 998_900)).toBe("998.9k");
  });

  it("uses the decimal mark of the locale", () => {
    expect(formatTokens("lv", 2_810_000)).toBe("2,9M");
    expect(formatTokens("et", 3_300_000)).toBe("3,3M");
    expect(formatTokens("lt", 1500)).toBe("1,5k");
  });

  it("never goes below zero and ignores a fraction of a token", () => {
    expect(formatTokens("en", -5)).toBe("0");
    expect(formatTokens("en", 1234.9)).toBe("1.3k");
  });
});

describe("formatTokensLeft, rounding down (what is left)", () => {
  it("never reads larger than it is", () => {
    expect(formatTokensLeft("en", 2_999_999)).toBe("2.9M");
    expect(formatTokensLeft("en", 149_999)).toBe("149.9k");
    expect(formatTokensLeft("en", 2_900_000)).toBe("2.9M");
    expect(formatTokensLeft("en", 999)).toBe("999");
  });

  it("keeps a left amount just under a million in thousands", () => {
    expect(formatTokensLeft("en", 999_999)).toBe("999.9k");
  });
});

describe("usageShare", () => {
  const usage = { used: 120_000, held: 20_000, cap: 500_000 };

  it("counts what is held while a run is in progress, and only what is used once it has settled", () => {
    expect(usageShare(usage, false)).toEqual({ percent: 28, underOne: false });
    expect(usageShare(usage, true)).toEqual({ percent: 24, underOne: false });
  });

  it("rounds up to a whole percent", () => {
    expect(usageShare({ used: 100_001, held: 0, cap: 500_000 }, true).percent).toBe(21);
    expect(usageShare({ used: 5_001, held: 0, cap: 500_000 }, true).percent).toBe(2);
  });

  it("calls non-zero use below one percent 'under 1%', not 0", () => {
    expect(usageShare({ used: 1, held: 0, cap: 500_000 }, true)).toEqual({ percent: 1, underOne: true });
    expect(usageShare({ used: 4_999, held: 0, cap: 500_000 }, true)).toEqual({ percent: 1, underOne: true });
    expect(usageShare({ used: 5_000, held: 0, cap: 500_000 }, true)).toEqual({ percent: 1, underOne: false });
    expect(usageShare({ used: 0, held: 0, cap: 500_000 }, true)).toEqual({ percent: 0, underOne: false });
  });

  it("reads 100 only when the cap is reached: 99.6% shows as 99", () => {
    expect(usageShare({ used: 498_000, held: 0, cap: 500_000 }, true).percent).toBe(99);
    expect(usageShare({ used: 499_999, held: 0, cap: 500_000 }, true).percent).toBe(99);
    expect(usageShare({ used: 500_000, held: 0, cap: 500_000 }, true).percent).toBe(100);
    expect(usageShare({ used: 900_000, held: 0, cap: 500_000 }, true).percent).toBe(100);
  });

  it("counts a reserved amount that reaches the cap as reaching it while running", () => {
    expect(usageShare({ used: 400_000, held: 100_000, cap: 500_000 }, false).percent).toBe(100);
  });

  it("is 0 for an empty cap", () => {
    expect(usageShare({ used: 5, held: 0, cap: 0 }, false)).toEqual({ percent: 0, underOne: false });
  });
});

describe("meterParts, with exact values", () => {
  it("draws used as the solid fill and held as a lighter band after it", () => {
    expect(meterParts({ used: 120_000, held: 20_000, cap: 500_000 }, false)).toEqual({ solid: 24, band: 4 });
  });

  it("keeps the fraction, so a small run is a sliver and not an empty bar", () => {
    const { solid } = meterParts({ used: 1_000, held: 0, cap: 500_000 }, true);
    expect(solid).toBeCloseTo(0.2, 10);
    expect(solid).toBeGreaterThan(0);
  });

  it("has no band once a run has settled", () => {
    expect(meterParts({ used: 120_000, held: 20_000, cap: 500_000 }, true)).toEqual({ solid: 24, band: 0 });
  });

  it("is empty for an empty cap and never passes 100", () => {
    expect(meterParts({ used: 1, held: 1, cap: 0 }, false)).toEqual({ solid: 0, band: 0 });
    expect(meterParts({ used: 900_000, held: 0, cap: 500_000 }, true)).toEqual({ solid: 100, band: 0 });
  });
});

describe("formatShare", () => {
  it("writes the share with a percent sign in every locale", () => {
    expect(formatShare("en", 28)).toBe("28%");
    for (const locale of ["lv", "lt", "et"] as const) expect(formatShare(locale, 28)).toMatch(/^28\s?%$/u);
  });
});

describe("describeShare", () => {
  it("writes the percent, or the given words for use below one percent", async () => {
    const { describeShare } = await import("./format.ts");
    expect(describeShare("en", { percent: 28, underOne: false }, "under 1%")).toBe("28%");
    expect(describeShare("en", { percent: 1, underOne: true }, "under 1%")).toBe("under 1%");
    expect(describeShare("lv", { percent: 1, underOne: true }, "mazāk nekā 1%")).toBe("mazāk nekā 1%");
  });
});
