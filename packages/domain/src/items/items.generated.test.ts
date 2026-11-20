import { describe, expect, it } from "vitest";
import { ITEMS } from "./items.generated.ts";

describe("the generated item list (architecture §3.6)", () => {
  it("holds every Part G row once", () => {
    expect(ITEMS).toHaveLength(155);
    expect(new Set(ITEMS.map((item) => item.id)).size).toBe(ITEMS.length);
  });

  it("carries the council's calls", () => {
    const count = (call: string) => ITEMS.filter((item) => item.call === call).length;
    expect({ show: count("show"), caveat: count("caveat"), later: count("later"), hide: count("hide") }).toEqual({
      show: 41,
      caveat: 56,
      later: 53,
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
    for (const item of ITEMS.filter((i) => i.call === "caveat")) expect(item.caveat, item.id).toBeTruthy();
  });
});
