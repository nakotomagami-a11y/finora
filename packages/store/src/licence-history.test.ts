import { describe, expect, it } from "vitest";
import { sourceRefForStatement } from "./provenance.ts";
import { writeRecord } from "./registry.ts";
import { company, contentSync, memoryStore, statementIdOf } from "./test-helpers.ts";

const write = (db: Parameters<typeof writeRecord>[0], syncId: number, eid: string, name: string) =>
  writeRecord(db, { syncId, sourceId: "ee-register", recordKey: eid, hashInput: [eid, name], entities: [company(eid, name, { legalForm: "ee-ou" })] });

describe("R3: a licence change never rewrites older rows", () => {
  it("keeps the old licence on rows written before and puts the new one on rows written after", () => {
    const { db } = memoryStore();
    const before = contentSync(db, "ee-register", "2026-10-01T00:00:00.000Z", { licenceId: "cc-by-4.0" });
    write(db, before, "ee-00000001", "Example Holding OÜ");
    write(db, before, "ee-00000002", "Sample Works OÜ");

    const after = contentSync(db, "ee-register", "2026-11-01T00:00:00.000Z", { licenceId: "cc0-1.0" });
    write(db, after, "ee-00000001", "Example Holding OÜ");
    write(db, after, "ee-00000002", "Sample Works Group OÜ");
    write(db, after, "ee-00000003", "Third Example OÜ");

    const licence = (eid: string) => sourceRefForStatement(db, statementIdOf(db, eid)).licenceId;
    expect(licence("ee-00000001")).toBe("cc-by-4.0");
    expect(licence("ee-00000002")).toBe("cc0-1.0");
    expect(licence("ee-00000003")).toBe("cc0-1.0");
    expect(sourceRefForStatement(db, statementIdOf(db, "ee-00000001")).checkedAt).toBe("2026-11-01T00:00:00.000Z");
  });
});
