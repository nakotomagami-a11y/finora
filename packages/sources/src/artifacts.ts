// Reading a fetched artifact the same way whether it is held in memory or streamed to disk
// (architecture §4.3, §4.5): a loader of a large file parses from `artifactStream`, never whole.
import { createReadStream, openSync, readSync, closeSync } from "node:fs";
import { Readable } from "node:stream";
import type { RawArtifact } from "./types.ts";

/** The artifact's content as a stream, in chunks. */
export function artifactStream(artifact: RawArtifact): Readable {
  return artifact.file ? createReadStream(artifact.file.path) : Readable.from([Buffer.from(artifact.bytes)]);
}

/** The first `n` bytes only, for a header check or an as-of field near the top. */
export function artifactHead(artifact: RawArtifact, n: number): Uint8Array {
  if (!artifact.file) return artifact.bytes.subarray(0, n);
  const fd = openSync(artifact.file.path, "r");
  try {
    const out = Buffer.alloc(Math.min(n, artifact.file.size));
    const read = readSync(fd, out, 0, out.length, 0);
    return new Uint8Array(out.subarray(0, read));
  } finally {
    closeSync(fd);
  }
}

/** The artifact's size in bytes. */
export const artifactSize = (artifact: RawArtifact) => artifact.file?.size ?? artifact.bytes.byteLength;

/** A streamed artifact from a `toFile` response. */
export function streamedArtifact(name: string, response: { headers: Record<string, string>; file?: RawArtifact["file"] }, fetchedAt: string): RawArtifact {
  if (!response.file) throw new Error(`${name}: the response was not streamed to a file`);
  return { name, bytes: new Uint8Array(), headers: response.headers, fetchedAt, file: response.file };
}
