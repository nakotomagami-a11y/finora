import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { HIDE_ITEM_IDS } from "@finora/domain";
import { describe, expect, it } from "vitest";
import { DEFAULT_SEED, generateWorld, serializeWorld } from "./src/world.ts";

describe("the fixture world (§4.6, qa #22)", () => {
  it("is byte-identical for the same seed, and differs for another", () => {
    expect(serializeWorld(generateWorld(7))).toBe(serializeWorld(generateWorld(7)));
    expect(serializeWorld(generateWorld(7))).not.toBe(serializeWorld(generateWorld(8)));
  });

  it("`pnpm fixtures:gen` writes the same bytes on every run", () => {
    const file = new URL(`./.generated/world-${DEFAULT_SEED}.json`, import.meta.url);
    const run = () => {
      execFileSync(process.execPath, [new URL("./src/gen-cli.ts", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")], { stdio: "ignore" });
      return readFileSync(file);
    };
    const first = run();
    rmSync(file);
    expect(run().equals(first)).toBe(true);
    expect(first.toString("utf8")).toBe(serializeWorld(generateWorld(DEFAULT_SEED)));
  });

  it("holds about 2,000 entities in four countries, with sole traders, officers and every HIDE item", () => {
    const world = generateWorld();
    expect([...new Set(world.companies.map((c) => c.country))].sort()).toEqual(["ee", "lt", "lv", "us"]);
    const people = world.roleSets.reduce((n, r) => n + r.lines.length, 0);
    expect(world.companies.length + people).toBeGreaterThan(1800);
    expect(world.companies.length + people).toBeLessThan(2400);
    expect(world.companies.filter((c) => ["lv-ik", "ee-fie", "lt-ii"].includes(c.legalForm)).length).toBe(45);
    expect(world.hide.map((h) => h.itemId).sort()).toEqual([...HIDE_ITEM_IDS].sort());
    for (const country of ["lv", "ee", "lt", "us"]) {
      expect(world.companies.some((c) => c.country === country && c.name.startsWith("Example Company")), country).toBe(true);
    }
  });

  it("uses fictional names only", () => {
    const world = generateWorld();
    for (const c of world.companies) expect(c.name).toMatch(/^(Example|Sample|Demo|Test|Placeholder|Mock|Ābeļu|Dārzs|Ķēde|Šķūnis|Gaisma|Õun|Pärn|Küla|Mägi|Sõber|Ąžuolas|Šilas|Ūkis|Žiedas|Kelias|Harbor|Prairie|Summit|Canyon|Lakeside) /);
    for (const r of world.roleSets) for (const l of r.lines) expect(l.name).toMatch(/^Officer [A-Z][a-z]+ \d+$/);
  });
});
