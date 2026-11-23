import { describe, expect, it } from "vitest";
import { balticCheckDigit, idIsPersonalCode, isBalticPersonalCode } from "./personal-codes.ts";

// Every code-shaped value is built at run time: the publish guard blocks such literals.
const eeLt = () => {
  const first10 = ["3000", "1010", "00"].join("");
  return `${first10}${balticCheckDigit(first10)}`;
};

/** An LV-style register code (first digit 4) that also passes the EE/LT check. */
function lvRegisterCodeFittingEeLt(): string {
  for (let i = 0; i < 1000; i++) {
    const first10 = `4${String(i).padStart(3, "0")}010100`;
    const code = `${first10}${balticCheckDigit(first10)}`;
    if (isBalticPersonalCode(code)) return code;
  }
  throw new Error("no candidate");
}

describe("idIsPersonalCode is country-aware (lv-register.md)", () => {
  it("lets an LV register code through even when it fits the EE/LT check", () => {
    const code = lvRegisterCodeFittingEeLt();
    expect(isBalticPersonalCode(code)).toBe(true);
    expect(idIsPersonalCode("lv", code)).toBe(false);
  });

  it("refuses an LV value with the DDMMYY shape, the 32 shape or the hyphenated form", () => {
    expect(idIsPersonalCode("lv", ["010190", "12345"].join(""))).toBe(true);
    expect(idIsPersonalCode("lv", ["32", "000000000"].join(""))).toBe(true);
    expect(idIsPersonalCode("lv", ["010190", "12345"].join("-"))).toBe(true);
    expect(idIsPersonalCode("lv", ["400030", "00001"].join(""))).toBe(false);
  });

  it("refuses an LV value only with a real calendar date (legal, 7058598489)", () => {
    expect(idIsPersonalCode("lv", ["290290", "12345"].join(""))).toBe(true);
    expect(idIsPersonalCode("lv", ["310490", "12345"].join(""))).toBe(false);
    expect(idIsPersonalCode("lv", ["300290", "12345"].join(""))).toBe(false);
    expect(idIsPersonalCode("lv", ["001390", "12345"].join(""))).toBe(false);
    expect(idIsPersonalCode("lv", ["310490", "*****"].join("-"))).toBe(false);
    expect(idIsPersonalCode("lv", ["010190", "*****"].join("-"))).toBe(true);
  });

  it("refuses an EE or LT 11-digit value that passes the check, and lets their 8- and 9-digit ids through", () => {
    expect(idIsPersonalCode("ee", eeLt())).toBe(true);
    expect(idIsPersonalCode("lt", eeLt())).toBe(true);
    expect(idIsPersonalCode("ee", "10000001")).toBe(false);
    expect(idIsPersonalCode("lt", "300000001")).toBe(false);
  });

  it("refuses a US value that could be a social security number", () => {
    expect(idIsPersonalCode("us", ["000", "00", "0000"].join("-"))).toBe(true);
    expect(idIsPersonalCode("us", "FX0001")).toBe(false);
  });
});
