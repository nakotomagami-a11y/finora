// The raw cache (architecture §4.4 step 1): each source's latest artifacts only, gzip-compressed,
// so a new parserVersion re-parses instead of re-downloading. A source with `rawCache: false`
// (files that hold natural persons who are never stored) and every live-no-store source keep nothing.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import type { RawArtifact } from "@finora/sources";

const safe = (name: string) => name.replace(/[^A-Za-z0-9._-]/g, "_");

export function saveRaw(dir: string, sourceId: string, artifacts: readonly RawArtifact[]): void {
  const target = join(dir, safe(sourceId));
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  artifacts.forEach((a, i) => {
    const meta = { name: a.name, headers: a.headers ?? {}, fetchedAt: a.fetchedAt };
    writeFileSync(join(target, `${String(i).padStart(3, "0")}.json`), JSON.stringify(meta));
    writeFileSync(join(target, `${String(i).padStart(3, "0")}.gz`), gzipSync(a.bytes));
  });
}

export function loadRaw(dir: string, sourceId: string): RawArtifact[] | null {
  const target = join(dir, safe(sourceId));
  let files: string[];
  try {
    files = readdirSync(target).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return null;
  }
  if (files.length === 0) return null;
  return files.map((f) => {
    const meta = JSON.parse(readFileSync(join(target, f), "utf8")) as { name: string; headers: Record<string, string>; fetchedAt: string };
    return { ...meta, bytes: new Uint8Array(gunzipSync(readFileSync(join(target, f.replace(/\.json$/, ".gz"))))) };
  });
}

export function dropRaw(dir: string, sourceId: string): void {
  rmSync(join(dir, safe(sourceId)), { recursive: true, force: true });
}
