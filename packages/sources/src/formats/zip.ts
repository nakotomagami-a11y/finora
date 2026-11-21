// Reads named members of a zip archive (an XLSX) under hard limits (S04i security review): a member
// path that climbs out, uses a backslash or is absolute is refused, and each member's inflated
// size is capped, as is the total. Anything unexpected throws `archive_unexpected`.
import { crc32, inflateRawSync } from "node:zlib";

export class ArchiveError extends Error {
  override name = "archive_unexpected";
  readonly code = "archive_unexpected";
}

export type ZipLimits = { maxMemberBytes: number; maxTotalBytes: number };

const unsafePath = (name: string) => name.includes("\\") || name.startsWith("/") || /^[A-Za-z]:/.test(name) || name.split("/").includes("..");

export function readZip(bytes: Uint8Array, wanted: readonly string[], limits: ZipLimits): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65_557); p--) {
    if (view.getUint32(p, true) === 0x06054b50) {
      eocd = p;
      break;
    }
  }
  if (eocd < 0) throw new ArchiveError("no end of central directory");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();
  let total = 0;
  const decoder = new TextDecoder();
  for (let k = 0; k < count; k++) {
    if (p + 46 > bytes.length || view.getUint32(p, true) !== 0x02014b50) throw new ArchiveError("bad central directory");
    const method = view.getUint16(p + 10, true);
    const crc = view.getUint32(p + 16, true);
    const compressed = view.getUint32(p + 20, true);
    const size = view.getUint32(p + 24, true);
    const nameLength = view.getUint16(p + 28, true);
    const local = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    p += 46 + nameLength + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
    if (unsafePath(name)) throw new ArchiveError("unsafe member path");
    if (!wanted.includes(name)) continue;
    if (size > limits.maxMemberBytes) throw new ArchiveError("member too large");
    if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) throw new ArchiveError("bad local header");
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + compressed);
    let member: Uint8Array;
    if (method === 0) member = data;
    else if (method === 8) {
      try {
        member = inflateRawSync(data, { maxOutputLength: limits.maxMemberBytes });
      } catch {
        throw new ArchiveError("member inflates past its limit or is corrupt");
      }
    } else throw new ArchiveError("unknown compression");
    if (crc32(member) !== crc) throw new ArchiveError("member checksum mismatch");
    total += member.length;
    if (member.length > limits.maxMemberBytes || total > limits.maxTotalBytes) throw new ArchiveError("archive too large");
    out.set(name, member);
  }
  return out;
}
