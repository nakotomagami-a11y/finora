// Writers for the LV layout fixtures (lv-register.md § Fixtures): the files exactly as data.gov.lv
// serves them (a UTF-8 byte-order mark, `;` or `,`, CRLF line ends, quotes only where needed), with
// fixture-only codes (architecture §3.4) and obviously fictional names.
import { fixtureRegisterCode } from "@finora/domain";

const quote = (value: string, separator: string) => (value.includes(separator) || value.includes('"') || /[\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);

/** A CSV as the LV portal writes it. `quoteAll` quotes every field (the VID files do). */
export function lvCsv(header: readonly string[], rows: readonly (readonly string[])[], options: { separator?: string; quoteAll?: boolean; bom?: boolean } = {}): Uint8Array {
  const separator = options.separator ?? ";";
  const cell = (v: string) => (options.quoteAll ? `"${v.replaceAll('"', '""')}"` : quote(v, separator));
  const lines = [header, ...rows].map((r) => r.map(cell).join(separator));
  return new TextEncoder().encode(`${options.bom === false ? "" : "﻿"}${lines.join("\r\n")}\r\n`);
}

/**
 * The n-th LV fixture code: prefix 40003 and a counter from 80000 up, so it never meets the shared
 * fixture world's codes (which count from 00001). Prefixes with no valid code are skipped.
 */
export function lvFixtureCode(n: number, prefix = "40003"): string {
  for (let i = n; ; i += 1000) {
    const code = fixtureRegisterCode("lv", `${prefix}${String(80000 + i).padStart(5, "0")}`);
    if (code) return code;
  }
}
