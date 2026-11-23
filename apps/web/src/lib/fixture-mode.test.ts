import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const demo = vi.hoisted(() => ({ on: true }));
vi.mock("./server-data.ts", () => ({ isDemoMode: () => demo.on }));

import { findRepoRoot, isFixtureName, listUiFixtures, readUiFixture } from "./fixture-mode.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = findRepoRoot(HERE);

describe("fixture mode", () => {
  beforeEach(() => {
    demo.on = true;
  });

  it("finds the repository root from inside the app", () => {
    expect(ROOT).not.toBeNull();
    expect(findRepoRoot("/")).toBeNull();
  });

  it("reads a fixture by screen and state", () => {
    const report = readUiFixture({ screen: "investigation", state: "report" }, ROOT) as { status: string };
    expect(report.status).toBe("done");
  });

  it("serves nothing outside fixture mode, whatever is asked", () => {
    demo.on = false;
    expect(readUiFixture({ screen: "investigation", state: "report" }, ROOT)).toBeNull();
    expect(listUiFixtures(ROOT)).toEqual({});
  });

  it("returns null for a state with no file", () => {
    expect(readUiFixture({ screen: "investigation", state: "nothing-here" }, ROOT)).toBeNull();
  });

  it("refuses a name that could leave the fixtures folder", () => {
    for (const bad of ["..", "../investigation", "a/b", "a\b", "", "Report", "report.json", "%2e%2e", "a b", "-x"]) {
      expect(isFixtureName(bad), bad).toBe(false);
      expect(readUiFixture({ screen: "investigation", state: bad }, ROOT), bad).toBeNull();
      expect(readUiFixture({ screen: bad, state: "report" }, ROOT), bad).toBeNull();
    }
  });

  it("lists every screen with its states, sorted", () => {
    const list = listUiFixtures(ROOT);
    expect(list.investigation).toContain("report");
    expect(list.crash).toContain("not-configured");
    expect(list.investigation).toEqual([...(list.investigation ?? [])].sort());
  });

  it("returns nothing when there is no repository to read", () => {
    expect(readUiFixture({ screen: "investigation", state: "report" }, null)).toBeNull();
    expect(listUiFixtures(null)).toEqual({});
  });
});
