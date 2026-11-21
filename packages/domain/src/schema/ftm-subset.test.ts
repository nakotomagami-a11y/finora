import { describe, expect, it } from "vitest";
import { FINORA_EXTENSIONS, FTM_UPSTREAM, PROPS } from "./ftm.ts";

describe("the FollowTheMoney subset (architecture §3.3)", () => {
  it("adds nothing that is neither upstream nor a finora: extension", () => {
    const upstream = new Set<string>(Object.values(FTM_UPSTREAM).flat());
    for (const prop of PROPS) {
      expect(upstream.has(prop) || (FINORA_EXTENSIONS as readonly string[]).includes(prop), prop).toBe(true);
    }
    for (const ext of FINORA_EXTENSIONS) expect(ext.startsWith("finora:")).toBe(true);
  });

  it("holds no property for data Finora never stores (P3)", () => {
    for (const banned of ["birthDate", "nationality", "gender", "passportNumber", "socialSecurityNumber"]) {
      expect(PROPS).not.toContain(banned);
    }
  });
});
