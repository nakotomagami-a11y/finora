import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const DESIGN = readFileSync(join(HERE, "../../../DESIGN.md"), "utf8");
const TOKENS = readFileSync(join(HERE, "tokens.css"), "utf8");

/** Colour tokens from the DESIGN.md table: `| \`--bg\` | \`#0f0e0d\` | \`#f6f4ef\` | ... |`. */
function designColours(): Map<string, { dark: string; light: string }> {
  const rows = new Map<string, { dark: string; light: string }>();
  for (const line of DESIGN.split(/\r?\n/u)) {
    const match = /^\|\s*`(--[a-z0-9-]+)`\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|/u.exec(line);
    if (match) rows.set(match[1] as string, { dark: match[2] as string, light: match[3] as string });
  }
  return rows;
}

function normalise(value: string): string {
  return value.replace(/\s+/gu, " ").replace(/\b0\./gu, ".").replace(/ ?\/ ?/gu, " / ").trim().toLowerCase();
}

/** Declarations of one selector block, such as `[data-theme="light"] { ... }`. */
function block(selector: string): Map<string, string> {
  const start = TOKENS.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`tokens.css has no ${selector} block`);
  const end = TOKENS.indexOf("}", start);
  const declarations = new Map<string, string>();
  for (const match of TOKENS.slice(start, end).matchAll(/(--[a-z0-9-]+):\s*([^;]+);/gu)) {
    declarations.set(match[1] as string, (match[2] as string).trim());
  }
  return declarations;
}

describe("tokens.css against the DESIGN.md colour table", () => {
  const table = designColours();
  const dark = block(":root,\n[data-theme=\"dark\"]");
  const light = block('[data-theme="light"]');
  const lightFallback = new Map<string, string>(
    [...TOKENS.slice(TOKENS.indexOf(":root:not([data-theme])")).matchAll(/(--[a-z0-9-]+):\s*([^;]+);/gu)].map((m) => [m[1] as string, (m[2] as string).trim()]),
  );

  it("reads the table", () => {
    expect(table.size).toBeGreaterThanOrEqual(14);
    expect(table.has("--bg")).toBe(true);
  });

  for (const [token, values] of table) {
    it(`${token} matches in dark and light`, () => {
      expect(dark.get(token), `${token} is missing from the dark theme`).toBeDefined();
      expect(light.get(token), `${token} is missing from the light theme`).toBeDefined();
      expect(normalise(dark.get(token) as string)).toBe(normalise(values.dark));
      expect(normalise(light.get(token) as string)).toBe(normalise(values.light));
    });
  }

  it("repeats the light values in the prefers-color-scheme fallback", () => {
    for (const [token, value] of light) {
      if (token === "--scrim") continue;
      expect(lightFallback.get(token), `${token} differs in the OS-light fallback`).toBe(value);
    }
  });
});
