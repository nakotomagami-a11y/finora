// M1-F2's fixture-loader half (council 7092078338, qa 7092845003): every fixture loader has a field
// map written out like a real loader's, never derived from its own records. The fixture world still
// loads as today, every map passes the field-map check, and a fixture that starts writing an
// undeclared pair (qa's probe: notes under S01.LV.01) is refused prop_not_in_item.
import { runSync } from "@finora/ingest";
import { isLoadable } from "@finora/domain";
import { checkFieldMap, type ParsedRecord, type SourceLoader } from "@finora/sources";
import { openStore, scanStore } from "@finora/store";
import { describe, expect, it } from "vitest";
import { fixtureProfileFor, fxLvRegister, fxUsState, jsonLoader, world } from "./src/loaders.ts";

const CONFIG = { lvPersonRows: "names_no_id", lvShortCompanyForms: true } as const;
const noNetwork = async (): Promise<never> => {
  throw new Error("the fixture profile never fetches");
};
const PROFILE = fixtureProfileFor(CONFIG).map((p) => p.loader);
const LOADERS: SourceLoader[] = [...PROFILE, fxUsState];

async function recordsOf(loader: SourceLoader): Promise<ParsedRecord[]> {
  const fetched = await loader.fetch({ fetcher: noNetwork as never, keys: {}, now: "2026-11-24T00:00:00Z", lastToken: null });
  if ("unchanged" in fetched && fetched.unchanged) return [];
  const out: ParsedRecord[] = [];
  for await (const r of loader.parse(fetched.artifacts, { now: "2026-11-24T00:00:00Z" })) out.push(r as ParsedRecord);
  return out;
}

/** The (item, prop) pairs a set of records writes, on loadable items only (HIDE and LATER are refused earlier). */
function writtenPairs(records: readonly ParsedRecord[]): string[] {
  const pairs = new Set<string>();
  for (const r of records) {
    for (const e of [...r.entities, ...(r.parties ?? []).flatMap((p) => p.entities)]) {
      for (const st of e.statements) if (isLoadable(st.itemId)) pairs.add(`${st.itemId} ${st.prop}`);
    }
  }
  return [...pairs].sort();
}
const declaredPairs = (loader: SourceLoader) => new Set(loader.fieldMap.flatMap((e) => ("prop" in e.target && e.itemId ? [`${e.itemId} ${e.target.prop}`] : [])));

describe("fixture loaders declare their field maps (M1-F2)", () => {
  it("passes every fixture loader's map through the field-map check", () => {
    for (const loader of LOADERS) expect(checkFieldMap(loader.meta.id, loader.fieldMap), loader.meta.id).toEqual([]);
  });

  it("declares every pair the fixture world writes, so it loads as today", async () => {
    for (const loader of PROFILE) {
      const declared = declaredPairs(loader);
      const missing = writtenPairs(await recordsOf(loader)).filter((p) => !declared.has(p));
      expect(missing, loader.meta.id).toEqual([]);
    }
    // The live-cached fixture writes on view; its records come from fetchRecord.
    const code = world().stateRecords[0]!.code;
    const datasets = (await (fxUsState as unknown as { fetchRecord: (ctx: unknown, key: string) => Promise<{ artifacts?: { bytes: Uint8Array }[] }[]> }).fetchRecord(null, code)).flatMap((d) => d.artifacts ?? []);
    const stateRecords = datasets.flatMap((a) => JSON.parse(new TextDecoder().decode(a.bytes)) as ParsedRecord[]);
    const declared = declaredPairs(fxUsState);
    expect(writtenPairs(stateRecords).filter((p) => !declared.has(p))).toEqual([]);
  });

  it("refuses qa's probe: a fixture writing notes under S01.LV.01 through the fixture profile", async () => {
    const { db, close } = openStore({ dataDir: null });
    try {
      const records = await recordsOf(fxLvRegister);
      const probe = records.map((r, i) =>
        i === 0 ? { ...r, entities: r.entities.map((e, j) => (j === 0 ? { ...e, statements: [...e.statements, { prop: "notes", value: "Probe note zqxnotes", itemId: "S01.LV.01" }] } : e)) } : r,
      );
      // A fixture loader whose own records write the new pair, added to the profile as qa did: its map
      // is the register's, written out, so the records can't widen it.
      const probing = jsonLoader(fxLvRegister.meta, fxLvRegister.fieldMap, () => probe);
      const profile = [...fixtureProfileFor(CONFIG).filter((p) => p.loader.meta.id !== "fx-lv-register"), { exportName: "fxProbe", loader: probing }];
      expect(profile.some((p) => p.loader === probing)).toBe(true);
      // The old map was derived from the records, so it declared whatever they wrote: not any more.
      expect(writtenPairs(probe)).toContain("S01.LV.01 notes");
      expect(declaredPairs(probing).has("S01.LV.01 notes")).toBe(false);
      const outcome = await runSync(db, probing, { fetcher: noNetwork });
      expect(outcome.kind).toBe("content");
      expect(outcome.report?.dropped.prop_not_in_item).toBe(1);
      expect(scanStore(db, ["zqxnotes"])).toEqual([]);
    } finally {
      close();
    }
  });
});
