import { describe, expect, it } from "vitest";
import { EMPTY_STATE_KEYS, ITEM_CAVEATS_EN, ITEMS } from "./items.generated.ts";

describe("the generated item list (architecture §3.6)", () => {
  it("holds every Part G row once", () => {
    expect(ITEMS).toHaveLength(156);
    expect(new Set(ITEMS.map((item) => item.id)).size).toBe(ITEMS.length);
  });

  it("carries the council's calls", () => {
    const count = (call: string) => ITEMS.filter((item) => item.call === call).length;
    expect({ show: count("show"), caveat: count("caveat"), later: count("later"), hide: count("hide") }).toEqual({
      show: 40,
      caveat: 51,
      later: 60,
      hide: 5,
    });
  });

  it("lists the five HIDE items that every surface's negative tests iterate", () => {
    expect(ITEMS.filter((item) => item.call === "hide").map((item) => item.id)).toEqual([
      "S04.LV.02",
      "S04.LV.03",
      "S04.EE.02",
      "S16.ALL.04",
      "OUT.US.01",
    ]);
  });

  it("gives every CAVEAT item its caveat text", () => {
    for (const item of ITEMS.filter((i) => i.call === "caveat")) {
      expect(item.caveatKey, item.id).toBe(`items.${item.id}.caveat`);
      expect(ITEM_CAVEATS_EN[item.id], item.id).toBeTruthy();
    }
  });

  it("uses only EmptyStateKey members", () => {
    for (const item of ITEMS) for (const key of item.emptyStates) expect(EMPTY_STATE_KEYS).toContain(key);
  });
});
