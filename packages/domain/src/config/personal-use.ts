// Legal's approved line for rows lit for personal use only (legal 7070727868, 7070739448; qa 7070731934):
// the daily US rows (M01.X.03). The whole line is a fixed template, anchored at both ends, matching the
// Part G caveat. The owner is the only free slot, read from the user's local provider file (legal
// condition 5), so a negation, a near miss or contrary text before or after is refused.

export const PERSONAL_USE_SENTENCE = "For personal use only.";
export const PERSONAL_USE_TEMPLATE = "For personal use only. <owner>'s copyright, via FRED; 1-day lag";

const normalise = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const LINE = /^for personal use only\. (.+)'s copyright, via fred; 1-day lag$/;

/** The owner slot: one line, no ";", no control or format character, and no second sentence. */
function ownerOk(owner: string): boolean {
  return owner.trim() === owner && owner.length <= 120 && !owner.includes(";") && !owner.includes(". ") && !/[\p{Cc}\p{Cf}]/u.test(owner);
}

/** True only for the approved line with an owner filled in, case-insensitive after whitespace normalisation. */
export function isPersonalUseLine(line: string): boolean {
  if (/[\p{Cc}\p{Cf}]/u.test(line.replace(/[\t\n\r]/g, " "))) return false;
  const m = LINE.exec(normalise(line));
  return m !== null && ownerOk(m[1] as string);
}
