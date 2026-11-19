// Pure checks for the publish guard: no git, no filesystem. guard.mjs feeds them.
// Findings never carry the matched text, so CI logs (public on a public repo) can't leak it.

export const MAX_FILE_BYTES = 1_000_000;
export const MAX_FIXTURE_BYTES = 50_000;

const SECRET_RULES = [
  ["private-key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})/],
  ["anthropic-key", /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ["openai-key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/],
  ["aws-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["slack-token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["telegram-bot-token", /\b\d{8,10}:AA[A-Za-z0-9_-]{33}\b/],
  ["assigned-secret", /\b(?:api[_-]?key|secret|token|passw(?:or)?d)\b\s*[:=]\s*["'][^"'\s]{12,}["']/i],
];

const LOCAL_RULES = [
  ["user-profile-path", /[A-Za-z]:[\\/]{1,2}Users[\\/]{1,2}[^\\/\s'"]+/i],
  ["user-profile-path", /\/[a-z]\/Users\/[^/\s]+/i],
  ["user-profile-path", /(?<![\w.])\/Users\/[A-Za-z][\w.-]*\//],
  ["user-profile-path", /(?<![\w.])\/home\/[a-z_][\w-]*\//],
  ["absolute-windows-path", /(?<![A-Za-z0-9])[A-Za-z]:[\\/][^\s'"`<>|]+/],
];

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const ALLOWED_EMAILS = new Set(["noreply@anthropic.com", "git@github.com"]);
const ALLOWED_EMAIL_DOMAINS = [/(?:^|\.)users\.noreply\.github\.com$/i, /^example\.(?:com|org|net)$/i];

const ELEVEN_DIGITS = /(?<!\d)\d{11}(?!\d)/g;
const LV_PERSONAL_CODE = /(?<!\d)(?:0[1-9]|[12]\d|3[01])(?:0[1-9]|1[0-2])\d{2}-[012]\d{4}(?!\d)/;
const LV_NEW_PERSONAL_CODE = /(?<!\d)3[2-9]\d{4}-\d{5}(?!\d)/;
const LV_MASKED_CODE = /(?<!\d)\d{6}-\*{5}/;
const US_SSN = /(?<!\d)(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}(?!\d)/;
const PHONE = /(?<![\w+])\+\d[\d ()-]{7,18}\d(?!\w)/g;

const BLOCKED_PATHS = [
  [/(?:^|\/)\.env(?:\.(?!example$)[^/]*)?$/, "env-file"],
  [/(?:^|\/)(?:research\/\.cache|\.local|\.guard|node_modules)\//, "local-only-dir"],
  [/\.(?:pem|key|p12|pfx|keystore)$/i, "key-file"],
  [/(?:^|\/)id_(?:rsa|ed25519|ecdsa)(?:\.pub)?$/, "key-file"],
];
const DATA_EXTENSIONS = /\.(?:db|sqlite3?|csv|tsv|parquet|jsonl|ndjson|xlsx?|zip|gz|tgz|tar|7z|rar|dump|bak)$/i;
const FIXTURE_DIR = /(?:^|\/)(?:fixtures|__fixtures__)\//;

export function normalize(text) {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** One term per line; blank lines and lines starting with # are ignored. Ids follow term order. */
export function compileDenylist(source) {
  const terms = source.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  return terms.flatMap((term, i) => {
    const parts = normalize(term).split(/[\s._-]+/).filter(Boolean).map(escapeRegExp);
    if (parts.length === 0) return [];
    return [{ id: i + 1, re: new RegExp(`(?<![a-z0-9])${parts.join("[\\s._-]*")}(?![a-z0-9])`) }];
  });
}

/** Estonian and Lithuanian personal codes share one format and checksum. */
export function isBalticPersonalCode(digits) {
  if (!/^\d{11}$/.test(digits)) return false;
  const century = Number(digits[0]);
  const month = Number(digits.slice(3, 5));
  const day = Number(digits.slice(5, 7));
  if (century < 1 || century > 6 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const weighted = (weights) => weights.reduce((sum, w, i) => sum + w * Number(digits[i]), 0) % 11;
  let check = weighted([1, 2, 3, 4, 5, 6, 7, 8, 9, 1]);
  if (check === 10) check = weighted([3, 4, 5, 6, 7, 8, 9, 1, 2, 3]) % 10;
  return check === Number(digits[10]);
}

function emailAllowed(email) {
  const lower = email.toLowerCase();
  if (ALLOWED_EMAILS.has(lower)) return true;
  const domain = lower.split("@")[1];
  return ALLOWED_EMAIL_DOMAINS.some((re) => re.test(domain));
}

function lineRules(line, denylist) {
  const hits = [];
  for (const [name, re] of SECRET_RULES) if (re.test(line)) hits.push(`secret:${name}`);
  for (const [name, re] of LOCAL_RULES) if (re.test(line)) hits.push(`local:${name}`);
  for (const email of line.match(EMAIL) ?? []) {
    if (!emailAllowed(email)) hits.push("personal:email");
  }
  for (const digits of line.match(ELEVEN_DIGITS) ?? []) {
    if (isBalticPersonalCode(digits)) hits.push("personal:ee-lt-personal-code");
  }
  if (LV_PERSONAL_CODE.test(line) || LV_NEW_PERSONAL_CODE.test(line)) hits.push("personal:lv-personal-code");
  if (LV_MASKED_CODE.test(line)) hits.push("personal:lv-masked-personal-code");
  if (US_SSN.test(line)) hits.push("personal:us-ssn");
  for (const phone of line.match(PHONE) ?? []) {
    if (phone.replace(/\D/g, "").length >= 8) hits.push("personal:phone-number");
  }
  if (denylist.length) {
    const normalized = normalize(line);
    for (const term of denylist) if (term.re.test(normalized)) hits.push(`denylist:entry-${term.id}`);
  }
  return [...new Set(hits)];
}

/** Scans text line by line. `firstLine` lets callers report real line numbers for diff hunks. */
export function scanText(text, denylist = [], firstLine = 1) {
  const findings = [];
  text.split(/\r?\n/).forEach((line, i) => {
    for (const rule of lineRules(line, denylist)) findings.push({ line: firstLine + i, rule });
  });
  return findings;
}

/** Checks a path being added or changed: its name, its kind and its size. */
export function checkPath(path, { bytes = 0, binary = false, reviewedMedia = false } = {}, denylist = []) {
  const findings = [];
  for (const [re, name] of BLOCKED_PATHS) if (re.test(path)) findings.push(`path:${name}`);
  const fixture = FIXTURE_DIR.test(path);
  if (DATA_EXTENSIONS.test(path) && !(fixture && bytes <= MAX_FIXTURE_BYTES && !binary)) {
    findings.push("path:data-file");
  }
  if (bytes > MAX_FILE_BYTES) findings.push("path:too-large");
  if (binary && !reviewedMedia) findings.push("path:unreviewed-binary");
  for (const { rule } of scanText(path, denylist)) findings.push(rule);
  return [...new Set(findings)];
}

export const RULE_HELP = {
  secret: "Looks like a secret or credential. Remove it and rotate it if it was ever real.",
  local: "Points at this machine (a user profile or a local drive path). Use a relative path or a placeholder.",
  personal: "Looks like personal data (email, personal code, phone, SSN). Redact it.",
  denylist: "Matches the private denylist (a name that must never appear in this repo). Remove or generalise it.",
  "path:env-file": "Environment files hold secrets and never get committed. Use .env.example for documentation.",
  "path:local-only-dir": "This folder is local-only by design.",
  "path:key-file": "Key material never gets committed.",
  "path:data-file": "Datasets and downloads stay out of git. Small synthetic fixtures go under fixtures/.",
  "path:too-large": `Files over ${MAX_FILE_BYTES / 1e6} MB don't belong in git.`,
  "path:unreviewed-binary": "Images and other binaries can contain names we can't scan. Check every visible text at full size, then add its hash with `node scripts/guard/guard.mjs review <file>`.",
};

export function explain(rule) {
  return RULE_HELP[rule] ?? RULE_HELP[rule.split(":")[0]] ?? "";
}
