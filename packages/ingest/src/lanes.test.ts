import { describe, expect, it } from "vitest";
import { fakeSource } from "./testing/fake-source.ts";
import { lanesOf } from "./worker.ts";

describe("lanesOf (architecture §4.5, cto on S04i)", () => {
  it("groups by lane and puts the register first by meta.order, whatever the list order", () => {
    const loaders = [
      fakeSource({ id: "lv-financials", country: "lv" }),
      fakeSource({ id: "sanctions-a", country: "intl", lane: "sanctions" }),
      fakeSource({ id: "lv-officers", country: "lv" }),
      fakeSource({ id: "lv-register", country: "lv", order: 0 }),
      fakeSource({ id: "gleif", country: "intl", lane: "gleif" }),
    ];
    expect([...lanesOf(loaders)]).toEqual([
      ["lv", ["lv-register", "lv-financials", "lv-officers"]],
      ["sanctions", ["sanctions-a"]],
      ["gleif", ["gleif"]],
    ]);
  });
});
