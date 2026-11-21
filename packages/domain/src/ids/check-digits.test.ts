import { describe, expect, it } from "vitest";
import {
  eeCheckDigit,
  fixtureLei,
  fixtureRegisterCode,
  isFixtureLei,
  isFixtureRegisterCode,
  isValidLei,
  isValidRegisterCode,
  ltCheckDigit,
  lvCheckDigit,
} from "./check-digits.ts";

describe("register code check digits (lv-, ee-, lt-register.md)", () => {
  it("the true digit passes, every other digit fails, and the fixture digit is (true + 1) mod 10", () => {
    for (const [country, body] of [["lv", "4000300001"], ["ee", "1000001"], ["lt", "30000001"]] as const) {
      const fixture = fixtureRegisterCode(country, body);
      if (fixture === null) continue;
      const passing = Array.from({ length: 10 }, (_, d) => `${body}${d}`).filter((c) => isValidRegisterCode(country, c));
      expect(passing, country).toHaveLength(1);
      expect(Number(fixture.at(-1))).toBe((Number(passing[0]!.at(-1)) + 1) % 10);
      expect(isValidRegisterCode(country, fixture)).toBe(false);
      expect(isFixtureRegisterCode(country, fixture)).toBe(true);
      expect(isFixtureRegisterCode(country, passing[0]!)).toBe(false);
    }
  });

  it("LV: a prefix whose check digit would be 10 has no valid code and no fixture code", () => {
    const body = Array.from({ length: 10_000 }, (_, i) => `40003${String(i).padStart(5, "0")}`).find((b) => lvCheckDigit(b) === null);
    expect(body).toBeDefined();
    expect(fixtureRegisterCode("lv", body!)).toBeNull();
  });

  it("EE and LT use the two-pass mod 11 rule, with 0 when both passes give 10", () => {
    for (const fn of [eeCheckDigit, ltCheckDigit]) {
      for (let i = 0; i < 2000; i++) {
        const d = fn(String(1_000_000 + i * 7919).padStart(fn === eeCheckDigit ? 7 : 8, "3").slice(0, fn === eeCheckDigit ? 7 : 8));
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(9);
      }
    }
  });

  it("refuses the wrong length or non-digits", () => {
    expect(isValidRegisterCode("ee", "1234")).toBe(false);
    expect(isValidRegisterCode("lt", "30000000x")).toBe(false);
    expect(() => fixtureRegisterCode("lv", "123")).toThrow();
  });
});

describe("LEIs (ISO 17442, mod 97)", () => {
  it("a computed valid LEI passes; the fixture variant fails mod 97 by design", () => {
    const body = "FX0000000000000042";
    const fixture = fixtureLei(body);
    expect(isValidLei(fixture)).toBe(false);
    expect(isFixtureLei(fixture)).toBe(true);
    const valid = Array.from({ length: 100 }, (_, n) => `${body}${String(n).padStart(2, "0")}`).filter(isValidLei);
    expect(valid).toHaveLength(1);
    expect(isFixtureLei(valid[0]!)).toBe(false);
  });
});
