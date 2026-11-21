#!/usr/bin/env node
// The H4 discovery sweep (qa 7066865925, 7067058090; C15): finds names the private denylist cannot
// know yet. It reports file:line and a class only, never the matched text, like the guard.
//
//   node scripts/check-outside-names.mjs tree                every tracked file at HEAD
//   node scripts/check-outside-names.mjs range <base> <head>  the files a slice changed
//   node scripts/check-outside-names.mjs files <path...>      the given files
//
// Classes: host (hostnames, URLs, email domains), org (organisation-shaped phrases), ticker,
// id (a real-shaped register code, LEI, ISIN or CIK), brand (a stem of a private denylist entry),
// binary (a committed binary outside the screenshot baselines). A hit is resolved by coding it,
// removing it, or listing it in the private allowlist with its C15 category:
//   .local/outside-names-allow.txt (this checkout, else the main checkout), or the
//   FINORA_OUTSIDE_NAMES_ALLOW variable; one `<category> <host or phrase>` per line.
// Exit 1 while any hit is unresolved.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isFixtureRegisterCode, isValidLei, isValidRegisterCode } from "../packages/domain/src/ids/check-digits.ts";

/** C15 categories, plus `fictional` for a test or fixture name qa has judged plainly invented. */
export const CATEGORIES = ["public-body", "official-registry", "open-standard", "tool", "licence", "field-name", "fictional"];

/** Out of scope (C14): dependency manifests, licence texts, generated and vendored trees, Agent Office's own mission state. */
const OUT_OF_SCOPE = [/(^|\/)package\.json$/, /(^|\/)pnpm-lock\.yaml$/, /(^|\/)(LICENSE|NOTICE)(\.[a-z]+)?$/i, /(^|\/)(node_modules|\.next|dist|coverage)\//, /^\.agent-office\//, /^scripts\/check-outside-names(\.test)?\.mjs$/];
const BINARY_OK = /(^|\/)__screenshots__\//;
const BINARY_EXT = /\.(png|jpe?g|gif|webp|pdf|zip|gz|xlsx?|docx?|pptx?|sqlite|db|bin)$/i;

const TLDS = "com|net|org|io|co|ai|dev|app|info|biz|eu|lv|lt|ee|us|uk|gov|edu|int|de|fr|nl|se|fi|no|dk|pl|ch|at|be|es|it|ie|lu|ru|cn|jp|kr|tw|hk|sg|au|ca|nz|br|mx|xyz|cloud|tech|me|tv|ly|gg|page|site|online|global|news|finance|money|exchange|network|markets|capital|trade";
const HOST = new RegExp(String.raw`(?<![\w.-])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:${TLDS}))(?![\w-]|\.[a-z0-9])`, "gi");
const RESERVED_HOST = (h) => /(^|\.)(invalid|test|localhost)$/.test(h) || /(^|\.)example(\.|$)/.test(h);
/** A bare `label.tld` counts only on these TLDs, or after a scheme, `@` or `www.`: `obs.at(...)` and `p.news` are code. */
const BARE_TLDS = new Set(["lv", "lt", "ee", "eu", "uk", "us", "gov", "org", "com", "net", "io"]);
const ITEM_ID = /^[sm]\d{2}\.[a-z]{2,3}(\.|$)/i;

const FORMS = String.raw`SIA|AS|UAB|OÜ|AB|Oy|AG|SE|GmbH|PLC|LLC|LLP|Inc\.?|Ltd\.?|Corp\.?|Corporation|S\.A\.|N\.V\.|B\.V\.|S\.p\.A\.`;
const ORG = new RegExp(String.raw`((?:\p{Lu}[\p{Ll}\p{M}&'’-]+\s+){1,4})(?:${FORMS})(?![\p{L}])`, "gu");
/** Plainly fictional first words (fixtures, docs): never a hit. */
const FICTIONAL = new Set(["example", "examples", "sample", "demo", "mock", "placeholder", "fixture", "test", "sentinel", "synthetic", "fictional", "dummy", "fake", "paraugs", "piemers", "naide", "naidis", "pavyzdys"]);

const TICKER_FIELD = /\b(?:ticker|symbol)["']?\s*[:=]\s*["'`]([A-Z0-9.-]{1,10})["'`]/g;
const CASHTAG = /(?<![\w$])\$([A-Z]{2,5})\b(?![{\w])/g;
const FIXTURE_TICKER = /^ZZFX\d{2}$/;

const EID = /\b(lv|ee|lt)-(\d{8,11})\b/g;
const LEI = /\b[0-9A-Z]{18}\d{2}\b/g;
const ISIN = /\b(?:US|LV|LT|EE|GB|DE|FR|NL|SE|FI|IE|LU|CH|JP|TW|KY|BM|CA|AU|XS)[A-Z0-9]{9}\d\b/g;
const CIK = /\bcik\b[^0-9\n]{0,12}(\d{6,10})\b/gi;
const CODE_LENGTH = { lv: 11, ee: 8, lt: 9 };

const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function isValidIsin(isin) {
  const expanded = [...isin].map((c) => (/\d/.test(c) ? c : String(c.charCodeAt(0) - 55))).join("");
  let sum = 0;
  [...expanded].reverse().forEach((d, i) => {
    let n = Number(d);
    if (i % 2 === 1) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    sum += n;
  });
  return sum % 10 === 0;
}

/** `<category> <host or phrase>` lines; a host entry also allows its subdomains. */
export function parseAllowlist(text) {
  const entries = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [category, ...rest] = line.split(/\s+/);
    if (!CATEGORIES.includes(category) || rest.length === 0) throw new Error(`outside-names allowlist: a line needs one of ${CATEGORIES.join(", ")} and a value`);
    entries.push({ category, value: fold(rest.join(" ")) });
  }
  return entries;
}

function allowedAs(allow, text, kind) {
  const value = fold(text);
  for (const e of allow) {
    if (kind === "host" ? value === e.value || value.endsWith(`.${e.value}`) : value.includes(e.value)) return e.category;
  }
  return null;
}

/** Single-word private denylist entries of five letters or more, matched as word stems. */
export function brandStems(denylistText) {
  return denylistText
    .split(/\r?\n/)
    .map((l) => fold(l.trim()))
    .filter((l) => l && !l.startsWith("#") && /^[a-z0-9]{5,}$/.test(l))
    .map((stem) => new RegExp(String.raw`(?<![a-z0-9])${stem}[a-z]*`, "g"));
}

/** Findings for one text file: `{ line, cls, kept }`, where `kept` is the allowlist category or null. */
export function scanText(path, text, { allow = [], stems = [] } = {}) {
  const findings = [];
  const prose = /\.mdx?$/i.test(path);
  text.split(/\r?\n/).forEach((line, i) => {
    const at = i + 1;
    const hit = (cls, matched, kind = "phrase") => findings.push({ line: at, cls, kept: allowedAs(allow, matched, kind) });
    for (const m of line.matchAll(HOST)) {
      const host = m[1].toLowerCase();
      if (RESERVED_HOST(host) || ITEM_ID.test(host) || line[m.index + m[0].length] === "(") continue;
      const labels = host.split(".");
      const anchored = /(:\/\/|@)$/.test(line.slice(0, m.index)) || labels[0] === "www";
      if (labels.length === 2 && !anchored && (labels[0].length < 2 || !BARE_TLDS.has(labels[1]))) continue;
      hit("host", host, "host");
    }
    for (const m of line.matchAll(ORG)) {
      // A fictional word in the phrase, or earlier on the same line, marks the whole name as invented.
      const before = line.slice(0, m.index + m[1].length).split(/[^\p{L}]+/u);
      if (!before.some((w) => FICTIONAL.has(fold(w)))) hit("org", m[0]);
    }
    for (const m of line.matchAll(TICKER_FIELD)) if (!FIXTURE_TICKER.test(m[1])) hit("ticker", m[1]);
    if (prose) for (const m of line.matchAll(CASHTAG)) if (!FIXTURE_TICKER.test(m[1])) hit("ticker", m[1]);
    for (const m of line.matchAll(EID)) {
      const [country, code] = [m[1], m[2]];
      // All-zero bodies are placeholders (lv-00000000001), never a register's code.
      if (code.length === CODE_LENGTH[country] && !/^0+\d{0,2}$/.test(code) && isValidRegisterCode(country, code) && !isFixtureRegisterCode(country, code)) hit("id", m[0]);
    }
    for (const m of line.matchAll(LEI)) if (/[A-Z]/.test(m[0]) && isValidLei(m[0])) hit("id", m[0]);
    for (const m of line.matchAll(ISIN)) if (isValidIsin(m[0])) hit("id", m[0]);
    for (const m of line.matchAll(CIK)) if (!m[1].padStart(10, "0").startsWith("99") && Number(m[1]) > 0) hit("id", m[0]);
    const folded = fold(line);
    for (const stem of stems) for (const m of folded.matchAll(stem)) hit("brand", m[0]);
  });
  return findings;
}

/** `reviewedMedia`: sha256 hashes from the guard's reviewed-media list (images and fonts qa opened). */
export function scanPath(path, bytes, options = {}) {
  if (OUT_OF_SCOPE.some((re) => re.test(path))) return [];
  const binary = bytes.includes(0) || BINARY_EXT.test(path);
  if (binary) {
    const reviewed = options.reviewedMedia?.has(createHash("sha256").update(bytes).digest("hex")) === true;
    return BINARY_OK.test(path) || reviewed ? [] : [{ line: 0, cls: "binary", kept: null }];
  }
  return scanText(path, bytes.toString("utf8"), options);
}

/** The counts-only line qa records (qa-plan-checklist): never a name. */
export function summary(label, results) {
  const all = results.flatMap((r) => r.findings);
  const kept = all.filter((f) => f.kept);
  const byCategory = Object.entries(Object.groupBy(kept, (f) => f.kept)).map(([c, list]) => `${c} ${list.length}`).join(", ");
  return `outside names: sweep ${label}: ${all.length - kept.length} unresolved; kept by C15: ${kept.length}${byCategory ? ` (${byCategory})` : ""}`;
}

function git(args) {
  return execFileSync("git", args, { encoding: "buffer", maxBuffer: 512 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

function privateFile(relativePath) {
  const root = git(["rev-parse", "--show-toplevel"]).toString().trim();
  const own = join(root, relativePath);
  if (existsSync(own)) return own;
  const main = join(dirname(resolve(root, git(["rev-parse", "--git-common-dir"]).toString().trim())), relativePath);
  return existsSync(main) ? main : null;
}

function main(argv) {
  const [mode, ...rest] = argv;
  let paths;
  let label;
  if (mode === "tree") {
    paths = git(["ls-files", "-z"]).toString().split("\0").filter(Boolean);
    label = "tree";
  } else if (mode === "range" && rest.length === 2) {
    paths = git(["diff", "--name-only", "--diff-filter=ACMR", "-z", `${rest[0]}..${rest[1]}`]).toString().split("\0").filter(Boolean);
    label = `${rest[0]}..${rest[1]}`;
  } else if (mode === "files" && rest.length > 0) {
    paths = rest;
    label = "files";
  } else {
    console.error("usage: check-outside-names.mjs tree | range <base> <head> | files <path...>");
    return 2;
  }
  const allowFile = privateFile(join(".local", "outside-names-allow.txt"));
  const allowText = [allowFile ? readFileSync(allowFile, "utf8") : "", (process.env.FINORA_OUTSIDE_NAMES_ALLOW ?? "").replace(/,/g, "\n")].join("\n");
  if (!allowText.trim()) console.warn("outside names: warning: no allowlist found, so public bodies and tools count as hits too.");
  const denylistFile = privateFile(join(".guard", "denylist.txt"));
  const reviewedFile = join(dirname(fileURLToPath(import.meta.url)), "guard", "reviewed-media.txt");
  const reviewedMedia = new Set(existsSync(reviewedFile) ? readFileSync(reviewedFile, "utf8").split(/\r?\n/).map((l) => l.trim().split(/\s+/)[0]).filter((h) => /^[0-9a-f]{64}$/.test(h)) : []);
  const options = { allow: parseAllowlist(allowText), stems: brandStems(denylistFile ? readFileSync(denylistFile, "utf8") : ""), reviewedMedia };
  const results = [];
  for (const path of paths) {
    const bytes = mode === "files" ? readFileSync(path) : git(["show", `${mode === "range" ? rest[1] : "HEAD"}:${path}`]);
    results.push({ path, findings: scanPath(path, bytes, options) });
  }
  for (const { path, findings } of results) for (const f of findings) if (!f.kept) console.log(`  ${path}:${f.line}  ${f.cls}`);
  const line = summary(label, results);
  console.log(line);
  return /: 0 unresolved;/.test(line) ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exit(main(process.argv.slice(2)));
