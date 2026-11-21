// The raw cache (architecture §4.4 step 1): each source's latest artifacts only, gzip-compressed,
// so a new parserVersion re-parses instead of re-downloading. A source with `rawCache: false`
// (files that hold natural persons who are never stored) and every live-no-store source keep nothing.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { SOURCE_ID, type RawArtifact } from "@finora/sources";

/** No decompressed artifact may be larger than this (SEC-9). */
export const RAW_MAX_BYTES = 2 * 1024 ** 3;

/** The source's own folder inside the cache; refuses any id that could leave it (SEC-8). */
function folder(dir: string, sourceId: string): string {
  if (!SOURCE_ID.test(sourceId)) throw new Error("a raw cache folder needs a valid source id");
  const root = resolve(dir);
  const target = resolve(root, sourceId);
  const rel = relative(root, target);
  if (rel === "" || rel.startsWith("..") || rel.includes("/") || rel.includes("\\")) throw new Error("a raw cache folder stays inside the cache");
  return target;
}

export function saveRaw(dir: string, sourceId: string, artifacts: readonly RawArtifact[]): void {
  const target = folder(dir, sourceId);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  artifacts.forEach((a, i) => {
    const meta = { name: a.name, headers: a.headers ?? {}, fetchedAt: a.fetchedAt };
    writeFileSync(join(target, `${String(i).padStart(3, "0")}.json`), JSON.stringify(meta));
    writeFileSync(join(target, `${String(i).padStart(3, "0")}.gz`), gzipSync(a.bytes));
  });
}

export function loadRaw(dir: string, sourceId: string, maxBytes = RAW_MAX_BYTES): RawArtifact[] | null {
  const target = folder(dir, sourceId);
  let files: string[];
  try {
    files = readdirSync(target).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return null;
  }
  if (files.length === 0) return null;
  return files.map((f) => {
    const meta = JSON.parse(readFileSync(join(target, f), "utf8")) as { name: string; headers: Record<string, string>; fetchedAt: string };
    const bytes = gunzipSync(readFileSync(join(target, f.replace(/\.json$/, ".gz"))), { maxOutputLength: maxBytes });
    return { ...meta, bytes: new Uint8Array(bytes) };
  });
}

export function dropRaw(dir: string, sourceId: string): void {
  rmSync(folder(dir, sourceId), { recursive: true, force: true });
}
