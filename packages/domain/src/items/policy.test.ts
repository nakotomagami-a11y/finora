import { describe, expect, it } from "vitest";
import { eidKind, isInternalEid } from "../ids/eid.ts";
import { ITEMS } from "./items.generated.ts";
import { HIDE_ITEM_IDS, isLoadable } from "./policy.ts";

describe("load rule 2", () => {
  it("loads SHOW and CAVEAT items only", () => {
    for (const item of ITEMS) expect(isLoadable(item.id)).toBe(item.call === "show" || item.call === "caveat");
    expect(isLoadable("S99.XX.01")).toBe(false);
  });

  it("lists the five HIDE items", () => {
    expect([...HIDE_ITEM_IDS].sort()).toEqual(["OUT.US.01", "S04.EE.02", "S04.LV.02", "S04.LV.03", "S16.ALL.04"]);
  });
});

describe("entity ids", () => {
  it("tells public ids from internal row ids", () => {
    expect(eidKind("ee-00000000")).toBe("ee");
    expect(eidKind("us-cik-9900000001")).toBe("sec");
    expect(eidKind("p-12-0")).toBe("person");
    expect(isInternalEid("rel-12-3")).toBe(true);
    expect(isInternalEid("lv-00000000000")).toBe(false);
    expect(eidKind("nonsense")).toBeNull();
  });
});
