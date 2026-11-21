#!/usr/bin/env node
// No raw colours outside the design tokens (DESIGN.md, ui-build-plan §3): every colour in UI code
// comes from packages/ui/src/tokens.css. S03 extends this check; until UI code exists it passes.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// FINORA_CHECK_ROOT lets the test point the check at a scratch folder.
const ROOT = process.env.FINORA_CHECK_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const DIRS = ["apps/web/src", "packages/ui/src"];
const TOKENS = "packages/ui/src/tokens.css";
const RAW_COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\(/;

export function rawColourLines(text) {
  return text
    .split(/\r?\n/)
    .map((line, i) => ({ line: i + 1, text: line }))
    .filter(({ text }) => RAW_COLOUR.test(text));
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(?:ts|tsx|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) yield path;
  }
}

function main() {
  const problems = [];
  for (const dir of DIRS) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const file of walk(abs)) {
      const path = relative(ROOT, file).replaceAll("\\", "/");
      if (path === TOKENS) continue;
      for (const hit of rawColourLines(readFileSync(file, "utf8"))) problems.push(`${path}:${hit.line}`);
    }
  }
  if (problems.length) {
    for (const p of problems) console.error(`check-tokens: raw colour at ${p}; use a token from ${TOKENS}`);
    process.exit(1);
  }
  console.log("check-tokens: no raw colours outside the tokens.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
