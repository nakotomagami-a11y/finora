import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

export const CACHE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../.cache/cto");

export function cachePath(name) {
  return join(CACHE_DIR, name);
}

/** Splits one CSV line. The probed files have no line breaks inside quoted fields: row counts match a full CSV parser. */
export function splitCsvLine(line, delimiter) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (line[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { cells.push(cell); cell = ""; }
    else cell += ch;
  }
  cells.push(cell);
  return cells;
}

/** Yields { line, row } per data line; row maps header names to cell values. */
export async function* readCsv(path, delimiter, { limit = Infinity } = {}) {
  const lines = createInterface({ input: createReadStream(path, "utf8"), crlfDelay: Infinity });
  let header;
  let count = 0;
  for await (const line of lines) {
    if (!header) { header = splitCsvLine(line.replace(/^﻿/, ""), delimiter); continue; }
    if (count++ >= limit) break;
    const cells = splitCsvLine(line, delimiter);
    yield { line, row: Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""])) };
  }
}

/** Extracts the first entry of a zip archive (stored or deflate; no zip64). */
export function unzipFirstEntry(zipPath, outPath) {
  const zip = readFileSync(zipPath);
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error(`not a zip file: ${zipPath}`);
  const central = zip.readUInt32LE(eocd + 16);
  const method = zip.readUInt16LE(central + 10);
  const compressedSize = zip.readUInt32LE(central + 20);
  const local = zip.readUInt32LE(central + 42);
  const dataStart = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const data = zip.subarray(dataStart, dataStart + compressedSize);
  writeFileSync(outPath, method === 0 ? data : inflateRawSync(data));
}

export function percentile(sortedMs, p) {
  return Number(sortedMs[Math.min(sortedMs.length - 1, Math.floor(p * sortedMs.length))].toFixed(2));
}

export function seconds(fromMs, toMs = performance.now()) {
  return Number(((toMs - fromMs) / 1000).toFixed(1));
}

/** Reads --name=value flags. */
export function flags(defaults) {
  const out = { ...defaults };
  for (const arg of process.argv.slice(2)) {
    const [name, value] = arg.replace(/^--/, "").split("=");
    if (!(name in defaults)) throw new Error(`unknown flag --${name}; known: ${Object.keys(defaults).join(", ")}`);
    out[name] = typeof defaults[name] === "number" ? Number(value) : value;
  }
  return out;
}
