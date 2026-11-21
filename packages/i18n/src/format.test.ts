import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatNumber, formatRelative, formatTime } from "./format.ts";

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

describe("formatDateTime, formatTime and formatRelative", () => {
  it("shows a moment day first with a 24-hour time", () => {
    expect(formatDateTime("en", "2026-11-20T06:10:00Z", "UTC")).toBe("20 Nov 2026, 06:10");
    expect(formatTime("en", "2026-11-22T14:00:00Z", "UTC")).toBe("14:00");
    expect(formatTime("lv", "2026-11-22T14:00:00Z", "UTC")).toBe("14:00");
  });

  it("reads an hour ahead and a few minutes back, in whole units", () => {
    const now = new Date("2026-11-22T12:00:00Z");
    expect(formatRelative("en", "2026-11-22T13:00:00Z", now)).toBe("in 1 hour");
    expect(formatRelative("en", "2026-11-22T11:58:00Z", now)).toBe("2 minutes ago");
    expect(formatRelative("en", "2026-11-22T12:00:20Z", now)).toBe("in 20 seconds");
    expect(formatRelative("en", "2026-11-20T12:00:00Z", now)).toBe("2 days ago");
  });
});
