import { describe, expect, it } from "vitest";
import { findBannedTerms, type BannedLocale } from "@finora/domain";
import { LOCALES, loadMessages } from "@finora/i18n";

type Tree = { [key: string]: string | Tree };

function strings(tree: Tree, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [[path, value] as [string, string]] : strings(value, path);
  });
}

// The banned wording applies to every string Finora writes (DESIGN.md §4). The English list fails the
// build. The Baltic stems are a draft until a native reviewer has confirmed them (packages/i18n/REVIEW.md),
// so a match there is reported as a warning in the test output and does not fail.
describe("catalogue strings and the banned wording", () => {
  for (const locale of LOCALES) {
    it(`${locale} has no banned term`, async () => {
      const messages = (await loadMessages(locale)) as Tree;
      const hits = strings(messages).flatMap(([key, text]) =>
        findBannedTerms(text, locale as BannedLocale).map((match) => `${key}: ${match.kind} "${match.term}"`),
      );
      if (locale === "en") expect(hits).toEqual([]);
      else if (hits.length > 0) console.warn(`banned-terms (${locale}, native review pending):`, hits.join("; "));
    });
  }
});
