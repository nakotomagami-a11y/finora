// The raw cache (architecture §4.4 step 1): each source's latest artifacts only, gzip-compressed,
// so a new parserVersion re-parses instead of re-downloading. A source with `rawCache: false`
// (files that hold natural persons who are never stored) and every live-no-store source keep nothing.
// A streamed artifact (a file on disk) is compressed and restored as a stream, never held whole.
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip, gunzipSync, gzipSync } from "node:zlib";
import { SOURCE_ID, type ArtifactFile, type RawArtifact } from "@finora/sources";

/** No decompressed in-memory artifact may be larger than this (SEC-9). */
export const RAW_MAX_BYTES = 2 * 1024 ** 3;
/** A streamed artifact restored to disk may be this large. */
export const RAW_MAX_FILE_BYTES = 8 * 1024 ** 3;

type Meta = { name: string; headers: Record<string, string>; fetchedAt: string; file?: { size: number; sha256: string } };

/** The source's own folder inside the cache; refuses any id that could leave it (SEC-8). */
function folder(dir: string, sourceId: string): string {
  if (!SOURCE_ID.test(sourceId)) throw new Error("a raw cache folder needs a valid source id");
  const root = resolve(dir);
  const target = resolve(root, sourceId);
  const rel = relative(root, target);
  if (rel === "" || rel.startsWith("..") || rel.includes("/") || rel.includes("\\")) throw new Error("a raw cache folder stays inside the cache");
  return target;
}

export async function saveRaw(dir: string, sourceId: string, artifacts: readonly RawArtifact[]): Promise<void> {
  const target = folder(dir, sourceId);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const [i, a] of artifacts.entries()) {
    const base = join(target, String(i).padStart(3, "0"));
    const meta: Meta = { name: a.name, headers: a.headers ?? {}, fetchedAt: a.fetchedAt, ...(a.file ? { file: { size: a.file.size, sha256: a.file.sha256 } } : {}) };
    writeFileSync(`${base}.json`, JSON.stringify(meta));
    if (a.file) await pipeline(createReadStream(a.file.path), createGzip(), createWriteStream(`${base}.gz`));
    else writeFileSync(`${base}.gz`, gzipSync(a.bytes));
  }
}

/** Counts and hashes what streams through, and stops past `max` bytes. */
function meter(max: number): Transform & { size: () => number; sha256: () => string } {
  const hash = createHash("sha256");
  let size = 0;
  const t = new Transform({
    transform(chunk: Buffer, _enc, done) {
      size += chunk.length;
      if (size > max) return done(new Error("raw artifact larger than its cap"));
      hash.update(chunk);
      done(null, chunk);
    },
  });
  return Object.assign(t, { size: () => size, sha256: () => hash.digest("hex") });
}

/**
 * The cached artifacts, or null when there are none or they fail their check. A streamed artifact
 * is decompressed into `workDir` and must match the size and sha256 it was saved with.
 */
export async function loadRaw(dir: string, sourceId: string, workDir: string, maxBytes = RAW_MAX_BYTES, maxFileBytes = RAW_MAX_FILE_BYTES): Promise<RawArtifact[] | null> {
  const target = folder(dir, sourceId);
  let files: string[];
  try {
    files = readdirSync(target).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return null;
  }
  if (files.length === 0) return null;
  const out: RawArtifact[] = [];
  for (const f of files) {
    const meta = JSON.parse(readFileSync(join(target, f), "utf8")) as Meta;
    const gz = join(target, f.replace(/\.json$/, ".gz"));
    if (!meta.file) {
      const { file: _none, ...rest } = meta;
      out.push({ ...rest, bytes: new Uint8Array(gunzipSync(readFileSync(gz), { maxOutputLength: maxBytes })) });
      continue;
    }
    mkdirSync(workDir, { recursive: true });
    const path = join(workDir, `raw-${f.replace(/\.json$/, "")}`);
    const m = meter(maxFileBytes);
    try {
      await pipeline(createReadStream(gz), createGunzip(), m, createWriteStream(path, { mode: 0o600 }));
    } catch {
      rmSync(path, { force: true });
      return null;
    }
    const file: ArtifactFile = { path, size: m.size(), sha256: m.sha256() };
    if (file.size !== meta.file.size || file.sha256 !== meta.file.sha256) {
      rmSync(path, { force: true });
      return null;
    }
    out.push({ name: meta.name, headers: meta.headers, fetchedAt: meta.fetchedAt, bytes: new Uint8Array(), file });
  }
  return out;
}

export function dropRaw(dir: string, sourceId: string): void {
  rmSync(folder(dir, sourceId), { recursive: true, force: true });
}
