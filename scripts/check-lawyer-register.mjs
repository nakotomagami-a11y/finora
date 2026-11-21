#!/usr/bin/env node
// Policy P13: every question a lawyer must settle has a row in docs/plan/lawyer-register.md,
// and every row has a test that holds its interim value (docs/plan/slices.md, S01 acceptance 7).
// Fails when a `[pending: lawyer <id>]` marker names no row, when a marker names no id, or when
// a register row is missing from the S01 test map. Markers inside `backticks` are examples.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REGISTER = "docs/plan/lawyer-register.md";
const SLICES = "docs/plan/slices.md";
const TEXT = /\.(?:md|ts|tsx|mts|mjs|js|json|ya?ml|css)$/;
const MARKER = /(?<!`)\[pending: lawyer(?: ([A-Z0-9-]+))?\](?!`)/g;

export function registerIds(registerText) {
  return new Set([...registerText.matchAll(/^\|\s*(LAW-[A-Z0-9-]+)\s*\|/gm)].map((m) => m[1]));
}

const TEST_FILE = /`[^`]*\.(?:test|spec)\.[cm]?[jt]sx?`/;
const NO_SURFACE = /^no surface in v1\b/;

/**
 * The register ids the S01 test map holds. A row counts only if its second cell names a
 * `*.test.*` or `*.spec.*` file in backticks, or starts with "no surface in v1"; an id merely
 * mentioned in the section does not count.
 */
export function mappedIds(slicesText) {
  const start = slicesText.indexOf("### S01");
  const end = slicesText.indexOf("### S02", start);
  if (start < 0 || end < 0) throw new Error(`${SLICES} has no S01 section`);
  const mapped = new Set();
  for (const line of slicesText.slice(start, end).split(/\r?\n/)) {
    const cells = line.trim().split("|").map((c) => c.trim());
    if (cells.length < 4 || cells[0] !== "") continue;
    const ids = cells[1].match(/LAW-[A-Z0-9-]+/g);
    if (!ids || cells[1].replace(/LAW-[A-Z0-9-]+|[,\s]/g, "") !== "") continue;
    if (TEST_FILE.test(cells[2]) || NO_SURFACE.test(cells[2])) for (const id of ids) mapped.add(id);
  }
  return mapped;
}

/** files: [{ path, text }]. Returns one message per problem. */
export function checkRegister({ registerText, slicesText, files }) {
  const problems = [];
  const ids = registerIds(registerText);
  const mapped = mappedIds(slicesText);
  for (const id of ids) {
    if (!mapped.has(id)) problems.push(`${id} has no enforcing test in ${SLICES} (S01 acceptance 7)`);
  }
  for (const { path, text } of files) {
    text.split(/\r?\n/).forEach((line, i) => {
      for (const match of line.matchAll(MARKER)) {
        const id = match[1];
        if (!id) problems.push(`${path}:${i + 1}: a [pending: lawyer] marker must name a register id`);
        else if (!ids.has(id)) problems.push(`${path}:${i + 1}: ${id} is not a row in ${REGISTER}`);
      }
    });
  }
  return problems;
}

function trackedTextFiles() {
  const out = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" });
  return out
    .split("\0")
    .filter((p) => p && TEXT.test(p) && !p.startsWith("scripts/guard/") && !p.startsWith("scripts/check-lawyer-register"))
    .map((path) => ({ path, text: readFileSync(join(ROOT, path), "utf8") }));
}

function main() {
  const problems = checkRegister({
    registerText: readFileSync(join(ROOT, REGISTER), "utf8"),
    slicesText: readFileSync(join(ROOT, SLICES), "utf8"),
    files: trackedTextFiles(),
  });
  if (problems.length) {
    for (const p of problems) console.error(`check-lawyer-register: ${p}`);
    process.exit(1);
  }
  console.log("check-lawyer-register: every marker has a row, and every row has a test.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
