import { describe, expect, it } from "vitest";
import { BLOCKED_PURPOSES, isBlockedPurpose, isPurposeId, PURPOSES } from "../config/purposes.ts";

describe("purposes (P2, P7)", () => {
  it("offers no blocked use", () => {
    for (const blocked of BLOCKED_PURPOSES) expect(PURPOSES as readonly string[]).not.toContain(blocked);
  });

  it("names every FCRA-type blocked use", () => {
    for (const word of ["credit", "employment", "insurance", "tenancy", "licensing"]) {
      expect(BLOCKED_PURPOSES.some((p) => p.startsWith(word))).toBe(true);
    }
  });

  it("refuses a blocked id as a purpose", () => {
    expect(isPurposeId("credit_decision")).toBe(false);
    expect(isBlockedPurpose("credit_decision")).toBe(true);
    expect(isPurposeId("counterparty_check")).toBe(true);
  });
});
