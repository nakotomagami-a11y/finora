// The one home of the banned wording (council session 2, DESIGN.md §4). It applies to every string
// Finora writes, controls included. The only exemption is a verbatim excerpt shown in `Quote`
// with its citation, which callers must not pass through these checks.

export type BannedLocale = "en" | "lt" | "lv" | "et";

/** English: whole words, with their inflections. */
export const BANNED_WORDS_EN = [
  "clear", "cleared", "clears", "clearing",
  "safe", "safely", "safety",
  "avoid", "avoided", "avoids",
  "scam", "scams", "scammer", "scammers",
  "fraud", "frauds", "fraudulent", "fraudster", "fraudsters",
] as const;

/** Baltic languages inflect, so these are word stems. A native reviewer confirms them
 *  (`packages/i18n/REVIEW.md`); until then a locale match is a warning and an English match fails. */
export const BANNED_STEMS: Record<Exclude<BannedLocale, "en">, readonly string[]> = {
  lt: ["švar", "saug", "venk", "apgav", "sukč"],
  lv: ["tīr", "droš", "izvair", "krāp"],
  et: ["puhas", "turval", "vältig", "pett"],
};

/** Letter grades shown as a rating ("Rating: B+", "Grade A") and credit-score wording. */
const GRADE_PATTERN = /\b(?:rating|grade|score)\s*[:=]?\s*[A-F][+-]?(?![\p{L}\p{N}])/iu;
const SCORE_PATTERN = /\b(?:credit\s+score|risk\s+score|trust\s+score|score\s+of\s+\d+)\b/iu;

export type BannedMatch = { kind: "word" | "stem" | "grade" | "score"; term: string };

const WORD_PATTERN = new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${BANNED_WORDS_EN.join("|")})(?![\p{L}\p{N}])`, "iu");

/** Returns the banned matches in `text` for a locale, or an empty array. */
export function findBannedTerms(text: string, locale: BannedLocale): BannedMatch[] {
  const matches: BannedMatch[] = [];
  if (locale === "en") {
    const word = WORD_PATTERN.exec(text);
    if (word) matches.push({ kind: "word", term: word[0].toLowerCase() });
  } else {
    const lower = text.toLocaleLowerCase(locale);
    for (const stem of BANNED_STEMS[locale]) {
      if (lower.includes(stem)) matches.push({ kind: "stem", term: stem });
    }
  }
  const grade = GRADE_PATTERN.exec(text);
  if (grade) matches.push({ kind: "grade", term: grade[0] });
  const score = SCORE_PATTERN.exec(text);
  if (score) matches.push({ kind: "score", term: score[0].toLowerCase() });
  return matches;
}
