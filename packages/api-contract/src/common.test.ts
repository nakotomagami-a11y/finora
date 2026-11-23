import { describe, expect, it } from "vitest";
import { z } from "zod";
import { API_ROUTES } from "./routes.ts";
import { Eid, Usage } from "./common.ts";
import { usage } from "./testing/samples.ts";

const CURRENCY = /usd|cost|price|eur/i;

/** Every property name reachable in a JSON schema. */
function propertyNames(node: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(node)) node.forEach((n) => propertyNames(n, out));
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "properties" && value && typeof value === "object") Object.keys(value).forEach((k) => out.add(k));
      propertyNames(value, out);
    }
  }
  return out;
}

describe("common.ts", () => {
  it("usage is integer standard tokens, nothing else", () => {
    expect(Usage.safeParse(usage()).success).toBe(true);
    expect(Usage.safeParse(usage({ used: 1.5 })).success).toBe(false);
    expect(Usage.safeParse({ ...usage(), unit: "tokens" }).success).toBe(false);
    expect(Usage.safeParse({ ...usage(), costUsd: 0.4 }).success).toBe(false);
  });

  it("no usage schema, and no investigation or agents DTO, has a currency field (cto 7070446775, qa 6)", () => {
    for (const route of API_ROUTES.filter((r) => /investigations|agents|settings/.test(r.path))) {
      for (const s of [route.response, route.body].filter((x): x is z.ZodType => x !== null && x !== undefined)) {
        const names = [...propertyNames(z.toJSONSchema(s, { unrepresentable: "any" }))];
        expect(names.filter((n) => CURRENCY.test(n)), route.operationId).toEqual([]);
      }
    }
  });

  it("an eid is a public id by the domain's table: never a person or relationship row id (PS5)", () => {
    for (const eid of ["lv-40003000018", "ee-00000009", "us-ct-FX0002", "us-cik-9900000042"]) expect(Eid.safeParse(eid).success, eid).toBe(true);
    for (const eid of ["p-12-3", "rel-1-0", "lv-00000000001", "../..", "x".repeat(81)]) expect(Eid.safeParse(eid).success, eid).toBe(false);
  });
});
