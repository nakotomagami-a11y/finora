// Streamed artifacts through the pipeline (architecture §4.5; owed before S13 and S15g): a loader
// fetches to a file in the sync's work dir, parses from a stream, and the raw cache keeps the file
// compressed, restoring it as a stream with its size and sha256 checked.
import { createHash } from "node:crypto";
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { gzipSync } from "node:zlib";
import { artifactHead, artifactStream, type ParsedRecord, type RawArtifact } from "@finora/sources";
import { afterEach, describe, expect, it } from "vitest";
import { runSync } from "./pipeline.ts";
import { companies, fakeSource, noNetwork } from "./testing/fake-source.ts";
import { memoryDb, records, tempDir } from "./test-helpers.ts";

const dirs: { remove(): void }[] = [];
afterEach(() => dirs.splice(0).forEach((d) => d.remove()));

/** A loader whose file is written straight into the work dir, one JSON record per line, the as-of first. */
function streamedSource(state: { records: ParsedRecord[]; unchanged?: boolean }, parserVersion = "streamed-1") {
  const loader = fakeSource({ id: "fake-streamed", parserVersion });
  let fetches = 0;
  let parsedFrom: string[] = [];
  Object.assign(loader, {
    async fetch(ctx: { workDir?: string; now: string }) {
      fetches++;
      if (state.unchanged) return { unchanged: true };
      const path = join(ctx.workDir as string, "records.jsonl");
      const text = [JSON.stringify({ asOf: "2026-11-01" }), ...state.records.map((r) => JSON.stringify(r))].join("\n");
      writeFileSync(path, text);
      const bytes = Buffer.from(text);
      const file = { path, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
      return { artifacts: [{ name: "records.jsonl", bytes: new Uint8Array(), fetchedAt: ctx.now, file }] };
    },
    windowStart: () => null,
    asOf(raw: RawArtifact[]) {
      const head = new TextDecoder().decode(artifactHead(raw[0] as RawArtifact, 200)).split("\n")[0] ?? "{}";
      return { in_file_field: (JSON.parse(head) as { asOf?: string }).asOf ?? null };
    },
    async *parse(raw: RawArtifact[]) {
      const artifact = raw[0] as RawArtifact;
      parsedFrom.push(artifact.file ? "file" : "bytes");
      let first = true;
      for await (const line of createInterface({ input: artifactStream(artifact) })) {
        if (first) {
          first = false;
          continue;
        }
        if (line) yield JSON.parse(line) as ParsedRecord;
      }
    },
  });
  return { loader, fetches: () => fetches, parsedFrom: () => parsedFrom, reset: () => (parsedFrom = []) };
}

describe("streamed artifacts in the pipeline", () => {
  it("loads from a streamed file, hashes it by its sha256, and leaves no work dir behind", async () => {
    const db = memoryDb();
    const work = tempDir();
    const raw = tempDir();
    dirs.push(work, raw);
    const source = streamedSource({ records: companies(1, 30) });
    const first = await runSync(db, source.loader, { fetcher: noNetwork, workDir: work.path, rawCacheDir: raw.path });
    expect(first).toMatchObject({ kind: "content" });
    expect(records(db, "fake-streamed")).toBe(30);
    expect(source.parsedFrom()).toEqual(["file"]);
    expect(readdirSync(work.path)).toEqual([]);
    // The same content again: unchanged, from the file's sha256, with nothing written.
    expect((await runSync(db, source.loader, { fetcher: noNetwork, workDir: work.path, rawCacheDir: raw.path })).kind).toBe("unchanged");
  });

  it("re-parses a new parser version from the raw cache as a restored file, never a download", async () => {
    const db = memoryDb();
    const work = tempDir();
    const raw = tempDir();
    dirs.push(work, raw);
    const state = { records: companies(1, 10), unchanged: false };
    const v1 = streamedSource(state);
    await runSync(db, v1.loader, { fetcher: noNetwork, workDir: work.path, rawCacheDir: raw.path });
    state.unchanged = true;
    const v2 = streamedSource(state, "streamed-2");
    const outcome = await runSync(db, v2.loader, { fetcher: noNetwork, workDir: work.path, rawCacheDir: raw.path });
    expect(outcome.kind).toBe("content");
    expect(v2.parsedFrom()).toEqual(["file"]);
    expect(v2.fetches()).toBe(1);
    expect(readdirSync(work.path)).toEqual([]);
  });

  it("a cached file that fails its sha256 is not used: the source is fetched again", async () => {
    const db = memoryDb();
    const work = tempDir();
    const raw = tempDir();
    dirs.push(work, raw);
    const state = { records: companies(1, 10), unchanged: false };
    await runSync(db, streamedSource(state).loader, { fetcher: noNetwork, workDir: work.path, rawCacheDir: raw.path });
    // Swap the cached gzip for another file's: same name, different content.
    const cached = join(raw.path, "fake-streamed", "000.gz");
    writeFileSync(cached, gzipSync(Buffer.from("tampered")));
    state.unchanged = true;
    const v2 = streamedSource(state, "streamed-2");
    // The cache is refused and the re-fetch says unchanged, so the sync cannot re-parse: it fails, loading nothing tampered.
    const outcome = await runSync(db, v2.loader, { fetcher: noNetwork, workDir: work.path, rawCacheDir: raw.path });
    expect(outcome).toMatchObject({ kind: "failed", report: { reason: "raw_cache_missing" } });
    expect(v2.parsedFrom()).toEqual([]);
    expect(v2.fetches()).toBe(2);
  });
});
