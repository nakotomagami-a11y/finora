// Legal's approved wording for rows lit for personal use only (legal 7070611829, 7070658489): the daily US
// rows (M01.X.03). The check accepts only this sentence, never a pattern, so a negation or a near miss
// is refused. The owner's credit follows it, from the user's local provider file (legal condition 5).

export const PERSONAL_USE_SENTENCE = "For personal use only.";

const normalise = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** True when the line opens with the approved sentence (case and whitespace aside) and a credit follows it. */
export function opensWithPersonalUse(line: string): boolean {
  const text = normalise(line);
  const sentence = normalise(PERSONAL_USE_SENTENCE);
  return text.startsWith(`${sentence} `) && text.length > sentence.length + 1;
}
