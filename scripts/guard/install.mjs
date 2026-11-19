#!/usr/bin/env node
// Turns the publish guard on for this clone: points git at .githooks/ and creates the
// local, gitignored .guard/denylist.txt if it doesn't exist yet.
//   node scripts/guard/install.mjs
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
execFileSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: root });

const dir = join(root, ".guard");
const denylist = join(dir, "denylist.txt");
if (!existsSync(denylist)) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    denylist,
    [
      "# Names that must never appear in this public repository: one per line.",
      "# Matching ignores case and accents, and treats spaces, dots and hyphens alike.",
      "# This file is gitignored. CI reads the same list from the FINORA_GUARD_DENYLIST secret.",
      "",
    ].join("\n"),
  );
  console.log(`guard: created ${denylist}. Add the names to keep out of the repo.`);
}
console.log("guard: hooks active (pre-commit, commit-msg, pre-push).");
