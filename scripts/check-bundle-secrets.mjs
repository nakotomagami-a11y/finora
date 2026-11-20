#!/usr/bin/env node
// Fails when a secret reaches the browser. CI builds the web app with sentinel values in the secret
// environment variables, then this script looks for those values in the client bundle (architecture §12).
//
//   FINORA_SENTINELS=1 pnpm build && node scripts/check-bundle-secrets.mjs
//
// The build must have been made with the sentinels: the script refuses to pass on a bundle it could not test.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT_DIR = "apps/web/.next/static";

/** Every environment variable that holds a secret or a personal contact string. */
export const SECRET_NAMES = [
  "ANTHROPIC_API_KEY",
  "SEC_USER_AGENT",
  "SOCRATA_APP_TOKEN",
  "COURTLISTENER_TOKEN",
  "CERTSPOTTER_API_KEY",
  "SAM_GOV_API_KEY",
];

export const SENTINEL_PREFIX = "finora-sentinel-";

/** The value CI puts in each secret variable for the build. */
export function sentinelFor(name) {
  return `${SENTINEL_PREFIX}${name.toLowerCase().replaceAll("_", "-")}`;
}

/**
 * `files` is `[{ path, text }]`, `sentinels` is `{ NAME: value }`. Returns one message per leak, naming the
 * variable and the file and never repeating the value.
 */
export function findLeaks(files, sentinels) {
  const leaks = [];
  for (const { path, text } of files) {
    for (const [name, value] of Object.entries(sentinels)) {
      if (text.includes(value)) leaks.push(`${path}: the value of ${name} is in the client bundle`);
      if (new RegExp(`NEXT_PUBLIC_${name}`, "u").test(text)) leaks.push(`${path}: ${name} is exposed as NEXT_PUBLIC_${name}`);
    }
  }
  return leaks;
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

function main() {
  const dir = join(ROOT, CLIENT_DIR);
  if (!existsSync(dir)) {
    console.error(`check-bundle-secrets: ${CLIENT_DIR} does not exist; run the web build first.`);
    process.exit(1);
  }

  const sentinels = {};
  for (const name of SECRET_NAMES) {
    if (process.env[name] !== sentinelFor(name)) {
      console.error(`check-bundle-secrets: ${name} was not the sentinel value at build time; the bundle cannot be tested.`);
      process.exit(1);
    }
    sentinels[name] = sentinelFor(name);
  }

  const files = [...walk(dir)]
    .filter((path) => /\.(?:js|css|html|json|map|txt)$/u.test(path))
    .map((path) => ({ path: relative(ROOT, path).replaceAll("\\", "/"), text: readFileSync(path, "utf8") }));
  const leaks = findLeaks(files, sentinels);
  if (leaks.length > 0) {
    for (const leak of leaks) console.error(`check-bundle-secrets: ${leak}`);
    process.exit(1);
  }
  console.log(`check-bundle-secrets: ${files.length} client files checked, no secret found.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
