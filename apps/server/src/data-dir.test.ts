import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { repoRoot, resolveDataDir } from "./data-dir.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

describe("the data directory", () => {
  it("finds the repository root from any app folder", () => {
    expect(repoRoot(join(ROOT, "apps", "web"))).toBe(ROOT);
    expect(repoRoot(join(ROOT, "apps", "server", "src"))).toBe(ROOT);
  });

  it("resolves a relative path against the repository root, not the app folder", () => {
    expect(resolveDataDir("./.data", join(ROOT, "apps", "web"))).toBe(join(ROOT, ".data"));
    expect(resolveDataDir("var/finora", join(ROOT, "apps", "server"))).toBe(join(ROOT, "var", "finora"));
  });

  it("leaves an absolute path alone", () => {
    const absolute = resolve("/finora-data");
    expect(resolveDataDir(absolute, ROOT)).toBe(absolute);
  });
});
