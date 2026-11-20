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

export function mappedIds(slicesText) {
  const start = slicesText.indexOf("### S01");
  const end = slicesText.indexOf("### S02", start);
  if (start < 0 || end < 0) throw new Error(`${SLICES} has no S01 section`);
  return new Set(slicesText.slice(start, end).match(/LAW-[A-Z0-9-]+/g) ?? []);
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
