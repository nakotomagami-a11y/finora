import { describe, expect, it, vi } from "vitest";
import { checkFieldMap } from "../../field-maps.ts";
import { checkSource } from "../../licences.ts";
import { parseAll, values } from "../../intl/sanctions-test-helpers.ts";
import { personFieldProblems } from "../../person-fields.ts";
import type { FetchContext, ParsedRecord, RawArtifact } from "../../types.ts";
import { lvCsv } from "../fixture-csv.ts";
import { lvFx } from "../fixture-world.ts";
import { LV_BIRTH_DATE_CANARY, LV_MEMBERS_HEADER, LV_MEMBERS_UNKNOWN_HOLDER, LV_OFFICERS_DAY2, LV_OFFICERS_HEADER, lvMaskedCodeCanary, lvMembersCsv, lvOfficersCsv } from "./fixture.ts";
import { fetchLvPeopleFile, LV_PEOPLE_LOADERS, lvPeopleLoaders, lvUrMembers, lvUrOfficers, lvUrOfficersLoader, signingRights } from "./lv-people.ts";

const art = (name: string, bytes: Uint8Array): RawArtifact => ({ name, bytes, fetchedAt: "2026-11-21T00:00:00Z" });
const officersRaw = (bytes = lvOfficersCsv()) => [art("officers.csv", bytes)];
const membersRaw = (bytes = lvMembersCsv()) => [art("members.csv", bytes)];
const setOf = (records: ParsedRecord[], n: number, family: "officers" | "members") => records.find((r) => r.recordKey === `lv-${lvFx(n).code}|${family}`);
const statementsOf = (record: ParsedRecord | undefined, eid: string) => record?.entities.filter((e) => e.eid === eid).flatMap((e) => e.statements) ?? [];
const prop = (record: ParsedRecord | undefined, eid: string, name: string) => statementsOf(record, eid).find((s) => s.prop === name)?.value;
const roleCounts = lvUrOfficersLoader({ personRows: "role_counts" });
const set1 = (n: number) => `1${lvFx(n).code}`;

describe("lv-ur-officers (lv-people.md)", () => {
  it("builds one role set per company from rows not grouped by company, in company-code order", async () => {
    const { records } = await parseAll(lvUrOfficers, officersRaw());
    const keys = records.map((r) => r.recordKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual(keys);
    expect(setOf(records, 1, "officers")!.lineIds).toEqual(["1001", "1003", "1010"]);
    expect(setOf(records, 1, "officers")!.entities[0]).toEqual({ eid: `lv-${lvFx(1).code}`, schema: "Company", country: "lv", code: lvFx(1).code, ref: true, statements: [] });
  });

  it("numbers person rows by file order within the set, never by name", async () => {
    const { records } = await parseAll(lvUrOfficers, officersRaw());
    const timber = setOf(records, 1, "officers");
    const people = timber!.entities.filter((e) => e.schema === "Person");
    expect(people.map((p) => [p.eid, p.statements[0]!.value])).toEqual([
      [`p-${set1(1)}-1`, "Test Person Zed"],
      [`p-${set1(1)}-2`, "Test Person A"],
      [`p-${set1(1)}-3`, "Test Person Adam"],
    ]);
    expect(people.map((p) => p.statements[0]!.line)).toEqual([0, 1, 2]);
  });

  it("maps each line to a Directorship: role, body, signing rights, start date, organization and director", async () => {
    const { records } = await parseAll(lvUrOfficers, officersRaw());
    const timber = setOf(records, 1, "officers");
    expect(statementsOf(timber, `rel-${set1(1)}-2`)).toEqual([
      { prop: "organization", value: `lv-${lvFx(1).code}`, itemId: "S03.LV.01", line: 1 },
      { prop: "role", value: "CHAIR_OF_BOARD", itemId: "S03.LV.01", line: 1 },
      { prop: "finora:governingBody", value: "EXECUTIVE_BOARD", itemId: "S03.LV.01", line: 1 },
      { prop: "finora:signingRights", value: "WITH_ALL", itemId: "S03.LV.01", line: 1 },
      { prop: "startDate", value: "2017-06-15", itemId: "S03.LV.01", line: 1 },
      { prop: "director", value: `p-${set1(1)}-2`, itemId: "S03.LV.01", line: 1 },
    ]);
    expect(prop(setOf(records, 2, "officers"), `rel-${set1(2)}-1`, "finora:signingRights")).toBe("WITH_AT_LEAST:2");
    expect(values(setOf(records, 3, "officers"), "name", `-${set1(3)}-2`)).toEqual(["Test Person E"]);
  });

  it("keeps every position and body; an empty position is unspecified, an empty date or body is absent", async () => {
    const { records } = await parseAll(lvUrOfficers, officersRaw());
    const roles = new Set(records.flatMap((r) => r.entities.flatMap((e) => e.statements.filter((s) => s.prop === "role").map((s) => s.value))));
    expect(roles.size).toBe(16);
    expect(roles).toContain("unspecified");
    const bodies = new Set(records.flatMap((r) => r.entities.flatMap((e) => e.statements.filter((s) => s.prop === "finora:governingBody").map((s) => s.value))));
    expect(bodies.size).toBe(10);
    const manager = setOf(records, 21, "officers");
    expect(prop(manager, `rel-${set1(21)}-1`, "startDate")).toBeUndefined();
    expect(prop(setOf(records, 22, "officers"), `rel-${set1(22)}-1`, "finora:signingRights")).toBeUndefined();
    expect(records.flatMap((r) => r.dropped ?? []).filter((d) => d.reason === "unknown_enum")).toEqual([]);
  });

  it("gives the same fixture human in two companies two unrelated rows", async () => {
    const { records } = await parseAll(lvUrOfficers, officersRaw());
    const a1 = setOf(records, 1, "officers")!.entities.find((e) => e.statements.some((s) => s.value === "Test Person A"))!;
    const a4 = setOf(records, 4, "officers")!.entities.find((e) => e.statements.some((s) => s.value === "Test Person A"))!;
    expect(a1.eid).not.toBe(a4.eid);
    expect(a1.eid.split("-")[1]).not.toBe(a4.eid.split("-")[1]);
  });

  it("links a company officer only through the party gate, and a foreign officer as an org- holder", async () => {
    const { records } = await parseAll(lvUrOfficers, officersRaw());
    const demo = setOf(records, 2, "officers")!;
    const rel = `rel-${set1(2)}-2`;
    expect(prop(demo, rel, "director")).toBeUndefined();
    expect(demo.parties).toEqual([{ code: { country: "lv", value: lvFx(1).code }, entities: [{ eid: rel, schema: "Directorship", country: "lv", statements: [{ prop: "director", value: `lv-${lvFx(1).code}`, itemId: "S03.LV.01", line: 1 }] }] }]);
    expect(JSON.stringify(demo.entities)).not.toContain("Example Timber");
    const works = setOf(records, 5, "officers")!;
    expect(works.parties?.[0]?.code).toEqual({ country: "lv", value: lvFx(4).code });
    // A foreign holder goes through the party gate too, proven by its register type (SEC-9).
    const bakery = setOf(records, 3, "officers")!;
    const foreign = bakery.parties!.find((p) => p.type === "FOREIGN_ENTITY")!;
    const org = foreign.entities.find((e) => e.schema === "Organization")!;
    expect(bakery.entities.find((e) => e.schema === "Organization")).toBeUndefined();
    expect(org.eid).toMatch(/^org-[0-9a-f]{20}$/);
    expect(org.statements).toEqual([{ prop: "name", value: "Sample Holdings Ltd", itemId: "S03.LV.01", line: 2 }]);
    expect(foreign.entities.find((e) => e.eid === `rel-${set1(3)}-3`)?.statements).toEqual([{ prop: "director", value: org.eid, itemId: "S03.LV.01", line: 2 }]);
  });

  it("drops an unknown holder type whole, counted", async () => {
    const { records, drops } = await parseAll(lvUrOfficers, officersRaw());
    expect(drops).toEqual(["unknown_enum"]);
    expect(JSON.stringify(records)).not.toContain("Mystery Body");
    expect(setOf(records, 2, "officers")!.lineIds).not.toContain("1022");
  });

  it("never stores, hashes or keys a masked code or birth date, and counts each as personal_code", async () => {
    for (const loader of [lvUrOfficers, roleCounts]) {
      const { records } = await parseAll(loader, officersRaw());
      const text = JSON.stringify(records);
      expect(text).not.toContain(lvMaskedCodeCanary());
      expect(text).not.toContain(LV_BIRTH_DATE_CANARY);
      for (const r of records) expect(personFieldProblems(r), r.recordKey).toEqual([]);
      const persons = records.flatMap((r) => r.entities.filter((e) => e.schema === "Person"));
      for (const p of persons) expect(p.statements.map((s) => s.prop)).toEqual(["name"]);
      expect(setOf(records, 1, "officers")!.dropped?.filter((d) => d.reason === "personal_code")).toHaveLength(6);
    }
  });

  it("loads no name and no person row in role_counts mode, and keeps roles, bodies and dates", async () => {
    const { records } = await parseAll(roleCounts, officersRaw());
    expect(records.flatMap((r) => r.entities).filter((e) => e.schema === "Person")).toEqual([]);
    const text = JSON.stringify(records);
    for (const name of ["Test Person Zed", "Test Person A", "Test Person Q0"]) expect(text).not.toContain(name);
    const timber = setOf(records, 1, "officers")!;
    expect(prop(timber, `rel-${set1(1)}-2`, "director")).toBeUndefined();
    expect(prop(timber, `rel-${set1(1)}-2`, "role")).toBe("CHAIR_OF_BOARD");
    expect(prop(timber, `rel-${set1(1)}-2`, "startDate")).toBe("2017-06-15");
    expect(timber.dropped?.filter((d) => d.reason === "lv_person_rows_role_counts")).toHaveLength(3);
    // Company and foreign holders are company data: kept in both modes.
    const foreign = setOf(records, 3, "officers")!.parties!.find((p) => p.type === "FOREIGN_ENTITY")!;
    expect(foreign.entities.flatMap((e) => e.statements).filter((st) => st.prop === "name").map((st) => st.value)).toEqual(["Sample Holdings Ltd"]);
    expect(setOf(records, 2, "officers")!.parties).toHaveLength(1);
  });

  it("changes the parserVersion with the mode, and only the name moves the hash between modes", async () => {
    expect(roleCounts.parserVersion).not.toBe(lvUrOfficers.parserVersion);
    expect(lvPeopleLoaders({ personRows: "role_counts" })[0]!.parserVersion).toBe(roleCounts.parserVersion);
    expect(lvPeopleLoaders()[0]).toBe(lvUrOfficers);
    expect(() => lvUrOfficersLoader({ personRows: "pseudonym" as never })).toThrow();
    const names = (await parseAll(lvUrOfficers, officersRaw())).records;
    const counts = (await parseAll(roleCounts, officersRaw())).records;
    expect(setOf(counts, 18, "officers")!.hashInput).not.toEqual(setOf(names, 18, "officers")!.hashInput);
    for (const r of counts) for (const h of r.hashInput) expect(h).not.toMatch(/Test Person/);
  });

  it("on day 2: a spelling fix keeps the line id, a removed line leaves its id, an added line gets one", async () => {
    const day1 = setOf((await parseAll(lvUrOfficers, officersRaw())).records, 1, "officers")!;
    const day2 = setOf((await parseAll(lvUrOfficers, officersRaw(lvOfficersCsv(LV_OFFICERS_DAY2)))).records, 1, "officers")!;
    expect(day1.lineIds).toEqual(["1001", "1003", "1010"]);
    expect(day2.lineIds).toEqual(["1001", "1003", "1050"]);
    expect(day2.hashInput).not.toEqual(day1.hashInput);
    expect(values(day2, "name")).toEqual(["Test Person Zed", "Test Persson A", "Test Person R"]);
  });

  it("fails schema_changed on a missing column, and dates the file by its registration and change dates", async () => {
    const missing = lvCsv(LV_OFFICERS_HEADER.filter((h) => h !== "governing_body"), [["1"]]);
    await expect(parseAll(lvUrOfficers, officersRaw(missing))).rejects.toMatchObject({ name: "schema_changed" });
    expect(lvUrOfficers.asOf(officersRaw()).max_date_in_data).toBe("2026-11-17");
  });

  it("formats signing rights with and without a count", () => {
    expect([signingRights("WITH_AT_LEAST", "2"), signingRights("INDIVIDUALLY", "0"), signingRights("", "3")]).toEqual(["WITH_AT_LEAST:2", "INDIVIDUALLY", null]);
  });
});

describe("lv-ur-members (lv-people.md)", () => {
  it("drops natural-person and joint-owner lines before any other field is read, counted by type", async () => {
    const { records, drops } = await parseAll(lvUrMembers, membersRaw());
    expect(drops.sort()).toEqual(["invalid_code", "joint_owners", "natural_person_type", "natural_person_type", "natural_person_type", "natural_person_type", "no_code", "unknown_enum"]);
    const text = JSON.stringify(records);
    for (const name of ["Test Person A", "Test Person F", "Test Person G", "Test Person H", "Test Person I", "Mystery Trust"]) expect(text).not.toContain(name);
    expect(setOf(records, 17, "members")).toBeUndefined();
    expect(setOf(records, 20, "members")).toBeUndefined();
    expect(setOf(records, 1, "members")).toBeUndefined();
  });

  it("loads a company holder through the party gate as a company-to-company Ownership", async () => {
    const { records } = await parseAll(lvUrMembers, membersRaw());
    const sub = setOf(records, 21, "members")!;
    expect(sub.entities).toEqual([{ eid: `lv-${lvFx(21).code}`, schema: "Company", country: "lv", code: lvFx(21).code, ref: true, statements: [] }]);
    const legal = sub.parties![0]!;
    expect(legal.type).toBeUndefined();
    expect(legal.code).toEqual({ country: "lv", value: lvFx(1).code });
    expect(legal.entities[0]!.statements).toEqual([
      { prop: "asset", value: `lv-${lvFx(21).code}`, itemId: "S04.LV.01", line: 0 },
      { prop: "owner", value: `lv-${lvFx(1).code}`, itemId: "S17.LV.01", line: 0 },
      { prop: "sharesCount", value: "2800", itemId: "S04.LV.01", line: 0 },
      { prop: "sharesValue", value: "1 EUR", itemId: "S04.LV.01", line: 0 },
      { prop: "startDate", value: "2015-03-03", itemId: "S04.LV.01", line: 0 },
    ]);
    expect(sub.lineIds).toEqual(["2001", "2012"]);
  });

  it("hands an NP-form holder and one the register lacks to the store's gate, never linking them by type", async () => {
    const { records } = await parseAll(lvUrMembers, membersRaw());
    const works = setOf(records, 5, "members")!;
    expect(works.parties!.map((p) => [p.type, p.code?.value])).toEqual([
      [undefined, lvFx(4).code],
      [undefined, LV_MEMBERS_UNKNOWN_HOLDER],
    ]);
  });

  it("gives a foreign holder an org- id from the company and the line, typed for the gate", async () => {
    const { records } = await parseAll(lvUrMembers, membersRaw());
    const demo = setOf(records, 2, "members")!;
    const foreign = demo.parties![0]!;
    expect(foreign.type).toBe("FOREIGN_ENTITY");
    const [org, own] = foreign.entities;
    expect(org!.eid).toMatch(/^org-[0-9a-f]{20}$/);
    expect(org!.statements).toEqual([{ prop: "name", value: "Sample Holdings Ltd", itemId: "S04.LV.01", line: 0 }]);
    expect(own!.statements.find((s) => s.prop === "owner")).toEqual({ prop: "owner", value: org!.eid, itemId: "S04.LV.01", line: 0 });
    const again = setOf((await parseAll(lvUrMembers, membersRaw())).records, 2, "members")!;
    expect(again.parties![0]!.entities[0]!.eid).toBe(org!.eid);
    const other = setOf(records, 23, "members")!.parties![0]!.entities[0]!.eid;
    expect(other).not.toBe(org!.eid);
  });

  it("keeps duplicate ids as distinct lines, counted, and an LVL holding in LVL", async () => {
    const { records } = await parseAll(lvUrMembers, membersRaw());
    const exporter = setOf(records, 23, "members")!;
    const debtor = setOf(records, 22, "members")!;
    expect([debtor.lineIds, exporter.lineIds]).toEqual([["2008"], ["2008"]]);
    expect(exporter.dropped).toEqual([{ reason: "duplicate_key" }]);
    expect(debtor.parties![0]!.entities[0]!.statements.find((s) => s.prop === "sharesValue")?.value).toBe("10 LVL");
  });

  it("never keeps a code or birth date, and counts one on a corporate line", async () => {
    const { records } = await parseAll(lvUrMembers, membersRaw());
    const text = JSON.stringify(records);
    expect(text).not.toContain(lvMaskedCodeCanary());
    expect(text).not.toContain(LV_BIRTH_DATE_CANARY);
    expect(setOf(records, 21, "members")!.dropped).toEqual([{ reason: "personal_code" }, { reason: "personal_code" }]);
    for (const r of records) expect(personFieldProblems(r), r.recordKey).toEqual([]);
  });

  it("fails schema_changed on a missing column", async () => {
    const missing = lvCsv(LV_MEMBERS_HEADER.filter((h) => h !== "number_of_shares"), [["1"]]);
    await expect(parseAll(lvUrMembers, membersRaw(missing))).rejects.toMatchObject({ name: "schema_changed" });
  });
});

describe("the lv-people sources", () => {
  it("refuse the beneficial-owner, shareholder and joint-owner datasets before any request", async () => {
    const fetcher = vi.fn();
    const ctx = { fetcher, keys: {}, now: "2026-11-21T00:00:00Z", lastToken: null } as unknown as FetchContext;
    for (const [slug, file] of [["patiesie-labuma-guveji", "beneficial_owners.csv"], ["stockholders", "stockholders.csv"], ["members", "members_joint_owners.csv"]] as const) {
      await expect(fetchLvPeopleFile(ctx, slug, file)).rejects.toMatchObject({ name: "fetch_denied" });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("pass the licence and field-map checks, in load order", () => {
    expect(LV_PEOPLE_LOADERS.map((l) => l.meta.id)).toEqual(["lv-ur-officers", "lv-ur-members"]);
    for (const l of [...LV_PEOPLE_LOADERS, roleCounts]) {
      expect(checkFieldMap(l.meta.id, l.fieldMap)).toEqual([]);
      expect(checkSource(l.meta, l.fieldMap, ["data.gov.lv"])).toEqual([]);
    }
  });
});
