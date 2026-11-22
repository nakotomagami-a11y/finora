// sanctions.md §7a: the files that hold listed individuals are never kept on disk, the LV
// frozen-assets file included (column 6 and its birth-date rows, qa M1); ESMA holds none. The pipeline's side is `ingest/src/person-list.test.ts`.
import { describe, expect, it } from "vitest";
import { DEFAULT_LOADER_CONFIG, loadersFor } from "../registry.ts";

const LOADERS = loadersFor(DEFAULT_LOADER_CONFIG);

const PERSON_LISTS = ["eu-fsf", "us-ofac-sdn", "us-ofac-cons", "uk-sanctions-list", "lv-fid-frozen"];

describe("raw cache of the sanctions lists", () => {
  it("is off for the EU, OFAC, UK and LV frozen-assets lists, which hold individuals", () => {
    for (const id of PERSON_LISTS) {
      const loader = LOADERS.find((l) => l.meta.id === id);
      expect(loader?.meta.rawCache, id).toBe(false);
    }
  });

  it("stays on for the lists that hold no individual", () => {
    for (const id of ["esma-ncasp"]) expect(LOADERS.find((l) => l.meta.id === id)?.meta.rawCache, id).toBeUndefined();
  });
});
