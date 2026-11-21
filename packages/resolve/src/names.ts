// Name comparison for screening (sanctions.md §7 rules 1 and 3): NFKD, no diacritics, lower case,
// punctuation to spaces, company-form words dropped, tokens sorted; then exact equality or a
// Levenshtein ratio of at least 0.90 on the sorted-token strings.
import { LEGAL_FORM_TOKENS, normalizeText } from "@finora/domain";

export const FUZZY_THRESHOLD = 0.9;

export function nameTokens(name: string): string[] {
  const tokens = normalizeText(name).split(" ").filter(Boolean);
  const kept = tokens.filter((t) => !LEGAL_FORM_TOKENS.has(t));
  return (kept.length > 0 ? kept : tokens).sort();
}

export const nameKey = (name: string) => nameTokens(name).join(" ");

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length]!;
}

/** 1 for equal keys, 0 for nothing in common. */
export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 0 : 1 - levenshtein(a, b) / longest;
}

/** Whether two names match: equal keys, or similar enough (rule 3). */
export function namesMatch(a: string, b: string): "exact" | "fuzzy" | null {
  const ka = nameKey(a);
  const kb = nameKey(b);
  if (!ka || !kb) return null;
  if (ka === kb) return "exact";
  // A length gap alone already rules out the ratio; skip the quadratic work.
  if (Math.min(ka.length, kb.length) / Math.max(ka.length, kb.length) < FUZZY_THRESHOLD) return null;
  return similarity(ka, kb) >= FUZZY_THRESHOLD ? "fuzzy" : null;
}

/** Candidate token: the rarest one in a token-frequency table (rule 2). */
export function rarestToken(tokens: readonly string[], frequency: ReadonlyMap<string, number>): string | null {
  let best: string | null = null;
  for (const t of tokens) if (best === null || (frequency.get(t) ?? 0) < (frequency.get(best) ?? 0)) best = t;
  return best;
}
