// sanctions.md §7a: the files that hold listed individuals are never kept on disk; the lists that
// hold none keep the default raw cache. The pipeline's side is `ingest/src/person-list.test.ts`.
import { describe, expect, it } from "vitest";
import { LOADERS } from "../registry.ts";

const PERSON_LISTS = ["eu-fsf", "us-ofac-sdn", "us-ofac-cons", "uk-sanctions-list"];

describe("raw cache of the sanctions lists", () => {
  it("is off for the EU, OFAC and UK lists, which hold individuals", () => {
    for (const id of PERSON_LISTS) {
      const loader = LOADERS.find((l) => l.meta.id === id);
      expect(loader?.meta.rawCache, id).toBe(false);
    }
  });

  it("stays on for the lists that hold no individual", () => {
    for (const id of ["esma-ncasp", "lv-fid-frozen"]) expect(LOADERS.find((l) => l.meta.id === id)?.meta.rawCache, id).toBeUndefined();
  });
});
