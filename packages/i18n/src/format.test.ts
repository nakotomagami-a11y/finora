import { describe, expect, it } from "vitest";
import { formatDate, formatNumber } from "./format.ts";

describe("formatDate", () => {
  it("formats a UTC date in the locale", () => {
    expect(formatDate("en", "2026-11-19")).toBe("19 Nov 2026");
  });
});

describe("formatNumber", () => {
  it("groups digits per locale", () => {
    expect(formatNumber("en", 1234567)).toBe("1,234,567");
    expect(formatNumber("lv", 1234567)).toMatch(/^1\D234\D567$/u);
  });
});
