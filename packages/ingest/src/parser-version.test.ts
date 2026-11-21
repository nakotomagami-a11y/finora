import { afterEach, describe, expect, it } from "vitest";
import { companyRecord, fakeSource } from "./testing/fake-source.ts";
import { count, memoryDb, sync, tempDir } from "./test-helpers.ts";

const dirs: { remove(): void }[] = [];
afterEach(() => dirs.splice(0).forEach((d) => d.remove()));

/** Version 2 of the parser drops the alias field (a field map change, or an item turned HIDE). */
function withAlias(version: string) {
  const loader = fakeSource({ parserVersion: version }, { records: [companyRecord(1, { extra: [{ prop: "alias", value: "Old Alias", itemId: "S01.LV.01" }] })] });
  if (version === "fake-2") {
    const parse = loader.parse.bind(loader);
    loader.parse = async function* (raw, ctx) {
      for await (const r of parse(raw, ctx)) {
        yield { ...r, entities: r.entities.map((e) => ({ ...e, statements: e.statements.filter((s) => s.prop !== "alias") })), hashInput: [...r.hashInput, "v2"] };
      }
    };
  }
  return loader;
}

const aliases = (db: ReturnType<typeof memoryDb>) => count(db, "SELECT COUNT(*) AS n FROM main.statements st JOIN main.props p ON p.id = st.prop_id WHERE p.name = 'alias'");

describe("a new parserVersion re-parses an unchanged artifact (A1)", () => {
  it("re-parses the same file as a content sync, and the newly dropped item is gone", async () => {
    const db = memoryDb();
    await sync(db, withAlias("fake-1"));
    expect(aliases(db)).toBe(1);
    const outcome = await sync(db, withAlias("fake-2"));
    expect(outcome.kind).toBe("content");
    expect(aliases(db)).toBe(0);
  });

  it("re-parses from the raw cache when the change token says the file did not move", async () => {
    const db = memoryDb();
    const dir = tempDir();
    dirs.push(dir);
    const v1 = withAlias("fake-1");
    v1.state.token = "t1";
    await sync(db, v1, { rawCacheDir: dir.path });
    const v2 = withAlias("fake-2");
    v2.state.unchanged = true;
    expect((await sync(db, v2, { rawCacheDir: dir.path })).kind).toBe("content");
    expect(v2.fetches).toBe(1);
    expect(aliases(db)).toBe(0);
  });

  it("re-downloads when the raw cache is missing: slower, never wrong", async () => {
    const db = memoryDb();
    await sync(db, withAlias("fake-1"), { rawCacheDir: null });
    const v2 = withAlias("fake-2");
    let calls = 0;
    const fetch = v2.fetch.bind(v2);
    v2.fetch = async (ctx) => (calls++ === 0 ? { unchanged: true } : fetch(ctx));
    expect((await sync(db, v2, { rawCacheDir: null })).kind).toBe("content");
    expect(calls).toBe(2);
    expect(aliases(db)).toBe(0);
  });

  it("the same artifact and the same parserVersion is unchanged", async () => {
    const db = memoryDb();
    await sync(db, withAlias("fake-1"));
    expect((await sync(db, withAlias("fake-1"))).kind).toBe("unchanged");
  });
});
