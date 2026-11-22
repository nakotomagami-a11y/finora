// Streamed downloads (architecture §4.5): a large file goes to disk, hashed on the way, never whole into memory.
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { artifactHead, artifactSize, artifactStream, streamedArtifact } from "./artifacts.ts";
import { politeFetch } from "./fetcher.ts";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));
const dir = () => {
  const d = mkdtempSync(join(tmpdir(), "finora-streamed-"));
  dirs.push(d);
  return d;
};

async function withServer(body: (port: number) => Promise<void>, size = 3 * 1024 * 1024, status = 200) {
  const chunk = Buffer.alloc(64 * 1024, "a");
  const server = createServer((_req, res) => {
    res.writeHead(status);
    let sent = 0;
    const pump = () => {
      while (sent < size) {
        sent += chunk.length;
        if (!res.write(chunk)) return void res.once("drain", pump);
      }
      res.end();
    };
    pump();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    await body((server.address() as AddressInfo).port);
  } finally {
    server.close();
  }
}

const local = (extra: object = {}) =>
  politeFetch({ officialHosts: ["files.example.lv"], userAgent: "x", resolve: async () => [{ address: "127.0.0.1", family: 4 }], allowAddress: () => true, allowHttp: true, retries: 0, ...extra });

describe("toFile (the real transport, against a local server)", () => {
  it("writes the body to the file with its size and sha256, and holds no bytes in memory", async () => {
    await withServer(async (port) => {
      const path = join(dir(), "big.bin");
      const res = await local({ maxBytes: 1024 })(`http://files.example.lv:${port}/big`, { toFile: path });
      expect(res.bytes.byteLength).toBe(0);
      expect(res.file?.size).toBe(3 * 1024 * 1024);
      expect(statSync(path).size).toBe(3 * 1024 * 1024);
      expect(res.file?.sha256).toBe(createHash("sha256").update(readFileSync(path)).digest("hex"));
    });
  });

  it("stops past the file cap and leaves no partial file", async () => {
    await withServer(async (port) => {
      const path = join(dir(), "big.bin");
      await expect(local({ maxFileBytes: 1024 * 1024 })(`http://files.example.lv:${port}/big`, { toFile: path })).rejects.toMatchObject({ code: "too_large" });
      expect(existsSync(path)).toBe(false);
    });
  });

  it("leaves no file behind on an HTTP error", async () => {
    await withServer(
      async (port) => {
        const path = join(dir(), "err.bin");
        await expect(local()(`http://files.example.lv:${port}/missing`, { toFile: path })).rejects.toMatchObject({ code: "http_status" });
        expect(existsSync(path)).toBe(false);
      },
      100,
      404,
    );
  });
});

describe("artifact helpers", () => {
  it("read a streamed and an in-memory artifact the same way", async () => {
    await withServer(async (port) => {
      const path = join(dir(), "f.bin");
      const res = await local()(`http://files.example.lv:${port}/f`, { toFile: path });
      const streamed = streamedArtifact("f.bin", res, "2026-11-22T08:00:00.000Z");
      const memory = { name: "m.bin", bytes: new Uint8Array(Buffer.alloc(100, "a")), fetchedAt: "x" };
      expect(artifactSize(streamed)).toBe(3 * 1024 * 1024);
      expect(new TextDecoder().decode(artifactHead(streamed, 4))).toBe("aaaa");
      expect(new TextDecoder().decode(artifactHead(memory, 4))).toBe("aaaa");
      let total = 0;
      for await (const chunk of artifactStream(streamed)) total += (chunk as Buffer).length;
      expect(total).toBe(3 * 1024 * 1024);
      expect(() => streamedArtifact("x", { headers: {} }, "x")).toThrow(/not streamed/);
    }, 3 * 1024 * 1024);
  });
});
