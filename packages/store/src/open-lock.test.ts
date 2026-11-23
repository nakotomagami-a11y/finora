// openStore waits for another connection's lock from its very first statement: a version check run
// before the busy timeout failed with "database is locked" while a parallel lane held the store,
// ending that lane's worker as worker_crashed (found in the fixture load, fix 7 on S05).
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openStore } from "./open.ts";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A second process holds an exclusive lock on the main file for `ms`, then lets go. */
const HOLDER = `
const { DatabaseSync } = require("node:sqlite");
const { writeFileSync } = require("node:fs");
const [path, signal, ms] = process.argv.slice(1);
const db = new DatabaseSync(path);
db.exec("PRAGMA locking_mode = EXCLUSIVE; BEGIN EXCLUSIVE; CREATE TABLE IF NOT EXISTS hold (x); INSERT INTO hold VALUES (1);");
writeFileSync(signal, "");
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(ms));
db.exec("COMMIT");
db.close();
`;

describe("openStore and another connection's lock", () => {
  it("waits for the lock from its first statement instead of failing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "finora-lock-"));
    dirs.push(dir);
    openStore({ dataDir: dir }).close();
    const signal = join(dir, "locked");
    const child = spawn(process.execPath, ["-e", HOLDER, join(dir, "finora.db"), signal, "400"], { stdio: "ignore" });
    const exited = new Promise((r) => child.once("exit", r));
    for (let i = 0; i < 500 && !existsSync(signal); i++) await new Promise((r) => setTimeout(r, 10));
    expect(existsSync(signal)).toBe(true);
    const start = performance.now();
    const store = openStore({ dataDir: dir });
    const waited = performance.now() - start;
    store.close();
    await exited;
    // It opened, after waiting for the holder rather than failing at once.
    expect(waited).toBeGreaterThan(100);
  }, 30_000);
});
