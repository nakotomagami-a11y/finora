import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TOKENS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "tokens.css"), "utf8");

function hexTokens(selector: string): Map<string, string> {
  const start = TOKENS.indexOf(`${selector} {`);
  const end = TOKENS.indexOf("}", start);
  return new Map([...TOKENS.slice(start, end).matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/giu)].map((m) => [m[1] as string, m[2] as string]));
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

const THEMES = {
  dark: hexTokens(':root,\n[data-theme="dark"]'),
  light: hexTokens('[data-theme="light"]'),
};
const SURFACES = ["--bg", "--surface", "--surface-2"];
const TEXT = ["--ink", "--ink-2", "--muted", "--accent", "--good", "--warn", "--bad", "--info"];

describe("contrast", () => {
  it("computes known ratios", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#777777")).toBe(1);
  });

  for (const [theme, tokens] of Object.entries(THEMES)) {
    for (const surface of SURFACES) {
      for (const text of TEXT) {
        it(`${theme}: ${text} on ${surface} is at least 4.5:1 (text)`, () => {
          expect(contrast(tokens.get(text) as string, tokens.get(surface) as string)).toBeGreaterThanOrEqual(4.5);
        });
      }
      it(`${theme}: --faint on ${surface} is at least 3:1 (icons and dividers only, never text)`, () => {
        expect(contrast(tokens.get("--faint") as string, tokens.get(surface) as string)).toBeGreaterThanOrEqual(3);
      });
    }
    it(`${theme}: text on an accent fill is at least 4.5:1`, () => {
      expect(contrast(tokens.get("--on-accent") as string, tokens.get("--accent") as string)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
