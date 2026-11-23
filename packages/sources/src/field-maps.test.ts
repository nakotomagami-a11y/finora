import { ITEMS } from "@finora/domain";
import { describe, expect, it } from "vitest";
import { checkFieldMap } from "./field-maps.ts";
import { DEFAULT_LOADER_CONFIG, loadersFor } from "./registry.ts";

const LOADERS = loadersFor(DEFAULT_LOADER_CONFIG);
import type { FieldMap } from "./types.ts";

describe("load rule 2 at the field map", () => {
  it("passes SHOW and CAVEAT targets, resolution keys and drops", () => {
    const map: FieldMap = [
      { field: "name", target: { prop: "name" }, itemId: "S01.LV.01", personal: false },
      { field: "officer", target: { prop: "name" }, itemId: "S03.LV.01", personal: true },
      { field: "regcode", target: { resolutionKey: "registrationNumber" }, personal: false },
      { field: "bo_name", target: { dropped: "hide_item" }, personal: true },
    ];
    expect(checkFieldMap("lv-example", map)).toEqual([]);
  });

  it("refuses a HIDE or LATER target, an unknown item, a missing item and a field read twice", () => {
    const map: FieldMap = [
      { field: "bo", target: { prop: "name" }, itemId: "S04.LV.02", personal: true },
      { field: "group", target: { prop: "name" }, itemId: "S05.LV.01", personal: false },
      { field: "x", target: { prop: "name" }, itemId: "S99.LV.01", personal: false },
      { field: "y", target: { prop: "name" }, personal: false },
      { field: "y", target: { dropped: "later_item" }, personal: false },
    ];
    const problems = checkFieldMap("lv-example", map).join("\n");
    expect(problems).toMatch(/S04\.LV\.02, a HIDE or LATER item/);
    expect(problems).toMatch(/S05\.LV\.01, a HIDE or LATER item/);
    expect(problems).toMatch(/unknown item S99\.LV\.01/);
    expect(problems).toMatch(/field y has a target but no item/);
    expect(problems).toMatch(/field y is mapped twice/);
  });

  it("lets one column feed a resolution key and a statement, or two props (M1-F2), but not one target twice", () => {
    const ok: FieldMap = [
      { field: "regcode", target: { resolutionKey: "registrationNumber" }, personal: false },
      { field: "regcode", target: { prop: "registrationNumber" }, itemId: "S01.LV.01", personal: false },
    ];
    expect(checkFieldMap("lv-example", ok)).toEqual([]);
    const twice: FieldMap = [...ok, { field: "regcode", target: { prop: "registrationNumber" }, itemId: "S01.LV.01", personal: false }];
    expect(checkFieldMap("lv-example", twice).join(" ")).toMatch(/regcode is mapped twice to the same target/);
  });

  it("maps nothing to public procurement, which is LATER in every country (LAW-LV-NP-PROCUREMENT)", () => {
    expect(ITEMS.filter((i) => i.section === "S12").every((i) => i.call === "later")).toBe(true);
    for (const loader of LOADERS) {
      expect(loader.fieldMap.filter((e) => e.itemId?.startsWith("S12.")), loader.meta.id).toEqual([]);
    }
  });

  it("holds for every shipped loader", () => {
    for (const loader of LOADERS) expect(checkFieldMap(loader.meta.id, loader.fieldMap), loader.meta.id).toEqual([]);
  });
});
