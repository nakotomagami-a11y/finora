import { describe, expect, it } from "vitest";
import { LOCALES, loadMessages, type Locale } from "./index.ts";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

/** The names of the ICU arguments in a message: `{name}`, `{count, plural, ...}`. */
export function icuArguments(message: string): string[] {
  return [...message.matchAll(/\{\s*([A-Za-z_][\w]*)/g)].map((m) => m[1] as string).sort();
}

describe("icuArguments", () => {
  it("lists plain and plural arguments", () => {
    expect(icuArguments("Hello {name}, {count, plural, one {# item} other {# items}}")).toEqual(["count", "name"]);
  });
});

describe("catalogue parity", async () => {
  const entries = await Promise.all(LOCALES.map(async (l) => [l, flatten((await loadMessages(l)) as Tree)] as const));
  const catalogues = new Map<Locale, Map<string, string>>(entries);
  const reference = catalogues.get("en") as Map<string, string>;

  it.each(LOCALES.filter((l) => l !== "en"))("%s has every key of en, and no extra", (locale) => {
    const keys = [...(catalogues.get(locale) as Map<string, string>).keys()].sort();
    expect(keys).toEqual([...reference.keys()].sort());
  });

  it.each(LOCALES)("%s has no empty string", (locale) => {
    for (const [key, value] of catalogues.get(locale) as Map<string, string>) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it.each(LOCALES.filter((l) => l !== "en"))("%s uses the same ICU arguments as en", (locale) => {
    for (const [key, value] of catalogues.get(locale) as Map<string, string>) {
      expect(icuArguments(value), key).toEqual(icuArguments(reference.get(key) ?? ""));
    }
  });
});
