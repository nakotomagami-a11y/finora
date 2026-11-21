// Policy P3 and canary scans (PS5): no personal code is ever stored, logged or output. Apply these
// to values that can belong to a person, never to a company's registration number (qa #20).

/** The check digit of an Estonian or Lithuanian code (the first ten digits given). */
export function balticCheckDigit(first10: string): number {
  const n = [...first10].map(Number);
  const sum = (weights: number[]) => weights.reduce((acc, w, i) => acc + w * (n[i] ?? 0), 0) % 11;
  let c = sum([1, 2, 3, 4, 5, 6, 7, 8, 9, 1]);
  if (c === 10) c = sum([3, 4, 5, 6, 7, 8, 9, 1, 2, 3]);
  return c === 10 ? 0 : c;
}

/** Estonian and Lithuanian personal codes share one format and checksum. */
export function isBalticPersonalCode(digits: string): boolean {
  if (!/^[1-6]\d{10}$/.test(digits)) return false;
  const month = Number(digits.slice(3, 5));
  const day = Number(digits.slice(5, 7));
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  return balticCheckDigit(digits.slice(0, 10)) === Number(digits[10]);
}

const LV_CODE = /\b\d{6}-(?:\d{5}|[*x]{5}|\d[*x]{4})\b/i;
const ELEVEN_DIGITS = /(?<![\d-])\d{11}(?![\d-])/g;
const US_SSN = /\b\d{3}-\d{2}-\d{4}\b/;

export type PersonalCodeHit = { kind: "lv_personal_code" | "ee_lt_personal_code" | "us_ssn" };

export function findPersonalCodes(text: string): PersonalCodeHit[] {
  const hits: PersonalCodeHit[] = [];
  if (LV_CODE.test(text)) hits.push({ kind: "lv_personal_code" });
  if ([...text.matchAll(ELEVEN_DIGITS)].some((m) => isBalticPersonalCode(m[0]))) hits.push({ kind: "ee_lt_personal_code" });
  if (US_SSN.test(text)) hits.push({ kind: "us_ssn" });
  return hits;
}

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** A calendar date as DDMMYY. 29 February counts for every year: the century is unknown. */
function isDdmmyy(six: string): boolean {
  const day = Number(six.slice(0, 2));
  const month = Number(six.slice(2, 4));
  return month >= 1 && month <= 12 && day >= 1 && day <= (DAYS_IN_MONTH[month - 1] ?? 0);
}

/**
 * Whether a sole trader's own register id has the shape of a personal code of its country
 * (docs/plan/loaders/lv-register.md, legal's S04a condition). Country-aware on purpose: about 6%
 * of LV register codes happen to pass the EE/LT check, and no LV register code fits the LV shapes.
 */
export function idIsPersonalCode(country: string, value: string): boolean {
  const digits = value.replace(/[\s-]/g, "");
  if (country === "lv") {
    // 11 digits, or 6 + hyphen + 5 (masked forms too); refused only for the 32 prefix or a real
    // DDMMYY date (legal's condition: a value that fails the date check is not an LV code).
    const lv = /^(\d{6})-?(?:\d{5}|[*x]{5}|\d[*x]{4})$/i.exec(value.trim());
    if (!lv?.[1]) return false;
    return lv[1].startsWith("32") || isDdmmyy(lv[1]);
  }
  if (country === "ee" || country === "lt") return /^\d{11}$/.test(digits) && isBalticPersonalCode(digits);
  if (country === "us") return US_SSN.test(value) || /^\d{9}$/.test(digits);
  return findPersonalCodes(value).length > 0;
}

/** A company's own identifiers, never scanned as personal codes (qa #20). */
export const COMPANY_ID_PROPS: ReadonlySet<string> = new Set(["registrationNumber", "vatCode", "taxNumber", "leiCode", "idNumber", "cikCode"]);

/** Internal person row ids (architecture §3.3) are never output, logged or stored outside their row. */
export const PERSON_EID = /\bp-\d+-\d+\b/;
