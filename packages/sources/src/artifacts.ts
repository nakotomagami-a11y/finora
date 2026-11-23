// Reading a fetched artifact the same way whether it is held in memory or streamed to disk
// (architecture §4.3, §4.5): a loader of a large file parses from `artifactStream`, never whole.
import { Buffer } from "node:buffer";
import { createReadStream, openSync, readSync, closeSync } from "node:fs";
import { Readable } from "node:stream";
import type { RawArtifact } from "./types.ts";

/** The artifact's content as a stream, in chunks. */
export function artifactStream(artifact: RawArtifact): Readable {
  return artifact.file ? createReadStream(artifact.file.path) : Readable.from([Buffer.from(artifact.bytes)]);
}

/**
 * The artifact's text in decoded chunks of about `chunkBytes`, read synchronously from memory or
 * from its file. A multi-byte character split across two chunks is carried over by the decoder.
 */
export function* artifactText(artifact: RawArtifact, chunkBytes = 1 << 20): Generator<string> {
  const decoder = new TextDecoder("utf-8");
  if (!artifact.file) {
    const bytes = artifact.bytes;
    for (let i = 0; i < bytes.byteLength; i += chunkBytes) yield decoder.decode(bytes.subarray(i, i + chunkBytes), { stream: true });
  } else {
    const fd = openSync(artifact.file.path, "r");
    try {
      const chunk = Buffer.alloc(chunkBytes);
      for (;;) {
        const read = readSync(fd, chunk, 0, chunkBytes, null);
        if (read === 0) break;
        yield decoder.decode(chunk.subarray(0, read), { stream: true });
      }
    } finally {
      closeSync(fd);
    }
  }
  const rest = decoder.decode();
  if (rest) yield rest;
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
