import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DeletionsLog } from "./deletions-log.ts";
import { tempDir } from "./test-helpers.ts";

const dirs: { remove(): void }[] = [];
afterEach(() => dirs.splice(0).forEach((d) => d.remove()));
const dir = () => {
  const d = tempDir();
  dirs.push(d);
  return d.path;
};

describe("deletions.log fails closed", () => {
  it("appends one line per deletion with an id and a date only", () => {
    const log = new DeletionsLog(join(dir(), "deletions.log"));
    log.append({ table: "disputes", id: "7", deletedAt: "2026-11-20T00:00:00.000Z" });
    log.append({ table: "suppressions", id: "3", deletedAt: "2026-11-21T00:00:00.000Z", note: "extra" } as never);
    expect(log.entries()).toEqual([
      { table: "disputes", id: "7", deletedAt: "2026-11-20T00:00:00.000Z" },
      { table: "suppressions", id: "3", deletedAt: "2026-11-21T00:00:00.000Z" },
    ]);
    expect(readFileSync(log.path, "utf8")).not.toContain("extra");
  });

  it("throws on a failed append, so the caller never deletes", () => {
    const log = new DeletionsLog(join(dir(), "missing", "deletions.log"));
    expect(() => log.append({ table: "disputes", id: "1", deletedAt: "2026-11-20T00:00:00.000Z" })).toThrow();
  });

  it("throws when the log is missing or corrupt, so a repair refuses", () => {
    const path = join(dir(), "deletions.log");
    expect(() => new DeletionsLog(path).entries()).toThrow();
    writeFileSync(path, '{"table":"disputes","id":"1"\n');
    expect(() => new DeletionsLog(path).entries()).toThrow();
  });
});
