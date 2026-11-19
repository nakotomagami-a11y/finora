#!/usr/bin/env node
// Publish guard: blocks secrets, personal data, local paths, private names and data files
// before they reach git history. See docs/contributing/publishing-checklist.md.
//
//   node scripts/guard/guard.mjs staged             what `git commit` is about to record (pre-commit hook)
//   node scripts/guard/guard.mjs message <file>     a commit message (commit-msg hook)
//   node scripts/guard/guard.mjs push               commits about to be pushed; reads the pre-push hook's stdin
//   node scripts/guard/guard.mjs range <from> <to>  every commit in from..to (CI); an empty or zero <from> scans all of <to>
//   node scripts/guard/guard.mjs tree               every tracked file at HEAD, in full (audit)
//   node scripts/guard/guard.mjs text <file|->      any text, e.g. a PR description or comment before posting it
//   node scripts/guard/guard.mjs review <file...>   record that you checked a binary file (image, PDF) by eye
//
// The private denylist comes from .guard/denylist.txt (gitignored) or the FINORA_GUARD_DENYLIST
// environment variable (a CI secret). Output never repeats the matched text.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkPath, compileDenylist, explain, scanText } from "./rules.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REVIEWED_MEDIA = join(HERE, "reviewed-media.txt");
const ZERO_SHA = /^0+$/;

function git(args, { binary = false } = {}) {
  return execFileSync("git", args, {
    encoding: binary ? "buffer" : "utf8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function repoRoot() {
  return git(["rev-parse", "--show-toplevel"]).trim();
}

/** The local denylist: this checkout's, else the main checkout's (seat worktrees have no gitignored files). */
function denylistFile() {
  const own = join(repoRoot(), ".guard", "denylist.txt");
  if (existsSync(own)) return own;
  const commonDir = resolve(repoRoot(), git(["rev-parse", "--git-common-dir"]).trim());
  const main = join(dirname(commonDir), ".guard", "denylist.txt");
  return existsSync(main) ? main : null;
}

function loadDenylist() {
  const sources = [];
  const file = denylistFile();
  if (file) sources.push(readFileSync(file, "utf8"));
  if (process.env.FINORA_GUARD_DENYLIST) sources.push(process.env.FINORA_GUARD_DENYLIST.replace(/,/g, "\n"));
  if (sources.length === 0) {
    const message = "No private denylist found (.guard/denylist.txt or FINORA_GUARD_DENYLIST): names are NOT being checked.";
    if (process.env.FINORA_GUARD_REQUIRE_DENYLIST === "true") {
      console.error(`guard: ${message}`);
      process.exit(2);
    }
    console.warn(`guard: warning: ${message}`);
  }
  return compileDenylist(sources.join("\n"));
}

function reviewedHashes() {
  if (!existsSync(REVIEWED_MEDIA)) return new Set();
  return new Set(
    readFileSync(REVIEWED_MEDIA, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim().split(/\s+/)[0])
      .filter((h) => /^[0-9a-f]{64}$/.test(h)),
  );
}

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

/** Parses `git diff -U0` output into added lines per file, with their new line numbers. */
function addedLines(diff) {
  const files = new Map();
  let file = null;
  let next = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      file = line === "+++ /dev/null" ? null : line.slice(6);
      if (file && !files.has(file)) files.set(file, []);
    } else if (line.startsWith("@@")) {
      next = Number(/\+(\d+)/.exec(line)?.[1] ?? 0);
    } else if (file && line.startsWith("+")) {
      files.get(file).push({ line: next++, text: line.slice(1) });
    }
  }
  return files;
}

/** Changed paths with binary flags, from `git diff --numstat` (binary files show "-\t-"). */
function changedPaths(numstat) {
  return numstat
    .split("\n")
    .filter(Boolean)
    .map((row) => {
      const [added, , ...rest] = row.split("\t");
      const path = rest.join("\t");
      return { path: path.includes(" => ") ? path.replace(/\{?[^{}]* => ([^{}]*)\}?/, "$1") : path, binary: added === "-" };
    });
}

function scanChange({ label, numstat, diff, blob, size }, denylist, reviewed) {
  const findings = [];
  for (const { path, binary } of changedPaths(numstat)) {
    let bytes = 0;
    let reviewedMedia = false;
    try {
      bytes = size(path);
      if (binary) reviewedMedia = reviewed.has(sha256(blob(path)));
    } catch {
      continue; // deleted in this change
    }
    for (const rule of checkPath(path, { bytes, binary, reviewedMedia }, denylist)) {
      findings.push({ where: `${label}${path}`, rule });
    }
  }
  for (const [path, lines] of addedLines(diff)) {
    for (const { line, text } of lines) {
      for (const { rule } of scanText(text, denylist)) findings.push({ where: `${label}${path}:${line}`, rule });
    }
  }
  return findings;
}

function scanStaged(denylist, reviewed) {
  return scanChange(
    {
      label: "",
      numstat: git(["diff", "--cached", "--numstat", "-M", "--diff-filter=ACMR"]),
      diff: git(["diff", "--cached", "-U0", "--no-color", "--no-ext-diff", "-M", "--diff-filter=ACMR"]),
      blob: (p) => git(["show", `:${p}`], { binary: true }),
      size: (p) => Number(git(["cat-file", "-s", `:${p}`]).trim()),
    },
    denylist,
    reviewed,
  );
}

function scanCommit(sha, denylist, reviewed) {
  const short = sha.slice(0, 10);
  const findings = scanText(git(["log", "-1", "--format=%B", sha]), denylist).map((f) => ({
    where: `${short} message:${f.line}`,
    rule: f.rule,
  }));
  const parent = git(["rev-list", "--parents", "-n", "1", sha]).trim().split(" ")[1];
  const base = parent ?? git(["hash-object", "-t", "tree", "--stdin"]).trim();
  return findings.concat(
    scanChange(
      {
        label: `${short} `,
        numstat: git(["diff", "--numstat", "-M", "--diff-filter=ACMR", base, sha]),
        diff: git(["diff", "-U0", "--no-color", "--no-ext-diff", "-M", "--diff-filter=ACMR", base, sha]),
        blob: (p) => git(["show", `${sha}:${p}`], { binary: true }),
        size: (p) => Number(git(["cat-file", "-s", `${sha}:${p}`]).trim()),
      },
      denylist,
      reviewed,
    ),
  );
}

function commitsBetween(from, to) {
  const args = !from || ZERO_SHA.test(from) ? ["rev-list", "--reverse", to] : ["rev-list", "--reverse", `${from}..${to}`];
  return git(args).split("\n").filter(Boolean);
}

function scanPush(stdin, denylist, reviewed) {
  const findings = [];
  for (const row of stdin.split("\n").filter(Boolean)) {
    const [, localSha, , remoteSha] = row.trim().split(/\s+/);
    if (!localSha || ZERO_SHA.test(localSha)) continue; // a branch deletion pushes no content
    const commits =
      remoteSha && !ZERO_SHA.test(remoteSha)
        ? commitsBetween(remoteSha, localSha)
        : git(["rev-list", "--reverse", localSha, "--not", "--remotes"]).split("\n").filter(Boolean);
    for (const sha of commits) findings.push(...scanCommit(sha, denylist, reviewed));
  }
  return findings;
}

function scanTree(denylist, reviewed) {
  const root = repoRoot();
  const findings = [];
  for (const path of git(["ls-files", "-z"]).split("\0").filter(Boolean)) {
    const body = readFileSync(join(root, path));
    const binary = body.includes(0);
    const meta = { bytes: body.length, binary, reviewedMedia: binary && reviewed.has(sha256(body)) };
    for (const rule of checkPath(path, meta, denylist)) findings.push({ where: path, rule });
    if (binary) continue;
    for (const { line, rule } of scanText(body.toString("utf8"), denylist)) findings.push({ where: `${path}:${line}`, rule });
  }
  return findings;
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function report(findings, what) {
  if (findings.length === 0) {
    console.log(`guard: ${what}: clean.`);
    return 0;
  }
  console.error(`guard: ${what}: ${findings.length} problem(s). Nothing was published.\n`);
  const seen = new Set();
  for (const { where, rule } of findings) console.error(`  ${where}  ${rule}`);
  console.error("");
  for (const { rule } of findings) {
    const help = explain(rule);
    const key = rule.startsWith("path:") ? rule : rule.split(":")[0];
    if (help && !seen.has(key)) {
      seen.add(key);
      console.error(`  ${key}: ${help}`);
    }
  }
  console.error("\nFix the lines above. Never bypass the guard with --no-verify; see docs/contributing/publishing-checklist.md.");
  return 1;
}

function review(files) {
  const root = repoRoot();
  for (const file of files) {
    const hash = sha256(readFileSync(file));
    appendFileSync(REVIEWED_MEDIA, `${hash}  ${relative(root, file).replaceAll("\\", "/")}\n`);
    console.log(`guard: recorded ${file} as reviewed (${hash.slice(0, 12)}…). Stage scripts/guard/reviewed-media.txt with it.`);
  }
  return 0;
}

function main([mode, ...args]) {
  if (mode === "review") return review(args);
  const denylist = loadDenylist();
  const reviewed = reviewedHashes();
  switch (mode) {
    case "staged":
      return report(scanStaged(denylist, reviewed), "staged changes");
    case "message":
      return report(
        scanText(readFileSync(args[0], "utf8"), denylist).map((f) => ({ where: `commit message:${f.line}`, rule: f.rule })),
        "commit message",
      );
    case "push":
      return report(scanPush(readStdin(), denylist, reviewed), "commits to push");
    case "range":
      return report(commitsBetween(args[0], args[1] || "HEAD").flatMap((sha) => scanCommit(sha, denylist, reviewed)), "commit range");
    case "tree":
      return report(scanTree(denylist, reviewed), "tracked files");
    case "text": {
      const text = !args[0] || args[0] === "-" ? readStdin() : readFileSync(args[0], "utf8");
      return report(scanText(text, denylist).map((f) => ({ where: `text:${f.line}`, rule: f.rule })), "text");
    }
    default:
      console.error("usage: guard.mjs staged | message <file> | push | range <from> <to> | tree | text <file|-> | review <file...>");
      return 2;
  }
}

process.exitCode = main(process.argv.slice(2));
