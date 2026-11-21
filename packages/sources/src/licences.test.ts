import { describe, expect, it } from "vitest";
import { checkSource, LICENCES } from "./licences.ts";
import { LOADERS } from "./registry.ts";
import type { FieldMap, SourceMeta } from "./types.ts";

const meta = (overrides: Partial<SourceMeta> = {}): SourceMeta => ({
  id: "lv-example",
  country: "lv",
  publisher: "Example register",
  homepage: "https://data.example.lv/",
  officialHosts: ["data.example.lv"],
  licence: "cc0-1.0",
  attribution: null,
  storage: "store",
  cadence: "daily",
  publishedAtUtc: null,
  asOf: ["in_file_field"],
  maxPurgeShare: 0.02,
  purgeScope: "full",
  deepLink: "https://data.example.lv/record/{recordKey}",
  orderUrl: null,
  requires: [],
  limits: {},
  items: ["S01.LV.01"],
  ...overrides,
});
const map: FieldMap = [{ field: "name", target: { prop: "name" }, itemId: "S01.LV.01", personal: false }];

describe("licence invariants (R12, R13, P1, P11)", () => {
  it("passes a CC0 register in the main store", () => {
    expect(checkSource(meta(), map, ["data.example.lv"])).toEqual([]);
  });

  it("keeps a share-alike licence out of the main store", () => {
    expect(checkSource(meta({ licence: "cc-by-sa-3.0" }), map).join()).toMatch(/needs a licence without share-alike/);
    expect(checkSource(meta({ licence: "cc-by-sa-3.0", storage: "share-alike-store" }), map)).toEqual([]);
    expect(checkSource(meta({ licence: "cc-by-sa-3.0", storage: "live-no-store" }), map)).toEqual([]);
  });

  it("keeps non-commercial or no-redistribution terms to agent-only, live-no-store or connector-cache", () => {
    const restricted = { ...LICENCES["cc0-1.0"]!, id: "x-nc", nonCommercial: true };
    (LICENCES as Record<string, typeof restricted>)["x-nc"] = restricted;
    try {
      expect(checkSource(meta({ licence: "x-nc", storage: "live-cached" }), map).join()).toMatch(/non-commercial/);
      expect(checkSource(meta({ licence: "x-nc", storage: "agent-only" }), map)).toEqual([]);
    } finally {
      delete (LICENCES as Record<string, unknown>)["x-nc"];
    }
  });

  it("refuses a licence with no verifiedOn date and an unknown licence", () => {
    (LICENCES as Record<string, unknown>)["x-unverified"] = { ...LICENCES["cc0-1.0"]!, id: "x-unverified", verifiedOn: null };
    try {
      expect(checkSource(meta({ licence: "x-unverified", storage: "live-cached" }), map).join()).toMatch(/cannot be enabled/);
    } finally {
      delete (LICENCES as Record<string, unknown>)["x-unverified"];
    }
    expect(checkSource(meta({ licence: "nope" }), map).join()).toMatch(/not in LICENCES/);
  });

  it("refuses a deep link, an order URL or a fetch host off the official hosts", () => {
    expect(checkSource(meta({ deepLink: "https://mirror.example.com/{recordKey}" }), map).join()).toMatch(/not on an official host/);
    expect(checkSource(meta({ orderUrl: "https://shop.example.com/order" }), map).join()).toMatch(/not on an official host/);
    expect(checkSource(meta(), map, ["cdn.example.com"]).join()).toMatch(/fetch host cdn.example.com is not official/);
  });

  it("needs meta.items to equal the field map's items, all SHOW or CAVEAT", () => {
    expect(checkSource(meta({ items: [] }), map).join()).toMatch(/missing from meta.items/);
    expect(checkSource(meta({ items: ["S01.LV.01", "S06.LV.01"] }), map).join()).toMatch(/no field-map entry fills/);
    const hide: FieldMap = [{ field: "bo", target: { prop: "name" }, itemId: "S04.LV.02", personal: true }];
    expect(checkSource(meta({ items: ["S04.LV.02"] }), hide).join()).toMatch(/not a SHOW or CAVEAT item/);
  });

  it("gives every licence its flags and every verified licence a date", () => {
    for (const licence of Object.values(LICENCES)) {
      expect(licence.verifiedOn?.date, licence.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(licence.url).toMatch(/^https:\/\//);
    }
    expect(LICENCES["cc-by-sa-3.0"]?.shareAlike).toBe(true);
  });

  it("holds for every shipped loader", () => {
    for (const loader of LOADERS) expect(checkSource(loader.meta, loader.fieldMap), loader.meta.id).toEqual([]);
  });
});
