// The local provider map (C15): endpoints of coded sources never sit in the tree. The probes read
// them from research/.cache/osint/providers.json (gitignored), a JSON object of code -> URL
// template with {domain}, {name}, {type} or {query} placeholders. Without the file, a probe that
// needs a coded source stops and says which code is missing.
import { existsSync, readFileSync } from "node:fs";

const FILE = new URL("../../.cache/osint/providers.json", import.meta.url);
let map = null;

export function provider(code) {
  map ??= existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};
  const template = map[code];
  if (typeof template !== "string") throw new Error(`needs_source: ${code} is not in research/.cache/osint/providers.json`);
  return template;
}
