// Register code check digits (lv-register.md, ee-register.md, lt-register.md) and LEIs (ISO 17442,
// mod 97). The fixture rule (architecture §3.4, qa #9): a fixture code carries (true check digit
// + 1) mod 10, so no register can ever have issued it; a fixture LEI fails mod 97.

const digits = (code: string) => [...code].map(Number);
const weighted = (d: number[], w: number[]) => w.reduce((sum, wi, i) => sum + wi * (d[i] ?? 0), 0);

/** LV: weights 9,1,4,8,3,10,2,5,7,6 over the first 10 digits; (3 - sum) mod 11; 10 means no valid code. */
export function lvCheckDigit(first10: string): number | null {
  const c = (((3 - weighted(digits(first10), [9, 1, 4, 8, 3, 10, 2, 5, 7, 6])) % 11) + 11) % 11;
  return c === 10 ? null : c;
}

/** EE (8 digits) and LT (9 digits) share the two-pass mod 11 rule over all digits but the last. */
function twoPass(body: string): number {
  const d = digits(body);
  const n = d.length;
  let s = weighted(d, Array.from({ length: n }, (_, i) => (i % 9) + 1)) % 11;
  if (s === 10) s = weighted(d, Array.from({ length: n }, (_, i) => ((i + 2) % 9) + 1)) % 11;
  return s === 10 ? 0 : s;
}

export const eeCheckDigit = (first7: string) => twoPass(first7);
export const ltCheckDigit = (first8: string) => twoPass(first8);

const CODE_RULES = {
  lv: { length: 11, check: (b: string) => lvCheckDigit(b) },
  ee: { length: 8, check: (b: string) => eeCheckDigit(b) },
  lt: { length: 9, check: (b: string) => ltCheckDigit(b) },
} as const;
export type BalticCountry = keyof typeof CODE_RULES;

/** A code a register could have issued: the right length and the true check digit. */
export function isValidRegisterCode(country: BalticCountry, code: string): boolean {
  const rule = CODE_RULES[country];
  if (!new RegExp(`^\\d{${rule.length}}$`).test(code)) return false;
  const c = rule.check(code.slice(0, -1));
  return c !== null && c === Number(code.at(-1));
}

/** The fixture variant of a prefix: (true check digit + 1) mod 10; null where the prefix has no valid code. */
export function fixtureRegisterCode(country: BalticCountry, body: string): string | null {
  const rule = CODE_RULES[country];
  if (body.length !== rule.length - 1) throw new Error(`${country} code body must have ${rule.length - 1} digits`);
  const c = rule.check(body);
  return c === null ? null : `${body}${(c + 1) % 10}`;
}

export function isFixtureRegisterCode(country: BalticCountry, code: string): boolean {
  const rule = CODE_RULES[country];
  if (!new RegExp(`^\\d{${rule.length}}$`).test(code)) return false;
  const c = rule.check(code.slice(0, -1));
  return c !== null && (c + 1) % 10 === Number(code.at(-1));
}

/** ISO 7064 mod 97-10 over an LEI's characters (letters as 10-35). */
function mod97(value: string): number {
  let rest = 0;
  for (const ch of value.toUpperCase()) {
    const n = /[0-9]/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const digit of n) rest = (rest * 10 + Number(digit)) % 97;
  }
  return rest;
}

export function isValidLei(lei: string): boolean {
  return /^[A-Z0-9]{18}\d{2}$/.test(lei) && mod97(lei) === 1;
}

/** A fixture LEI: 18 characters and two check digits that fail mod 97 by design. */
export function fixtureLei(body18: string): string {
  if (!/^[A-Z0-9]{18}$/.test(body18)) throw new Error("an LEI body has 18 characters");
  const valid = 98 - mod97(`${body18}00`);
  return `${body18}${String((valid + 1) % 100).padStart(2, "0")}`;
}

export const isFixtureLei = (lei: string) => /^[A-Z0-9]{18}\d{2}$/.test(lei) && !isValidLei(lei);
