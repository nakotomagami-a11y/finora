import { afterEach, describe, expect, it } from "vitest";
import { acquireLease, heartbeat, releaseLease } from "./leases.ts";
import { openStore, type Store } from "./open.ts";
import { memoryStore, tempDir } from "./test-helpers.ts";

const TTL = 60_000;
const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

describe("leases", () => {
  it("give a resource to one holder only", () => {
    const { db } = memoryStore();
    const a = acquireLease(db, "sync:lv-register", "worker-a", TTL, 1_000);
    const b = acquireLease(db, "sync:lv-register", "worker-b", TTL, 2_000);
    expect(a).not.toBeNull();
    expect(b).toBeNull();
    expect(acquireLease(db, "sync:ee-register", "worker-b", TTL, 2_000)).not.toBeNull();
  });

  it("let the holder renew, and let another holder take an expired lease", () => {
    const { db } = memoryStore();
    const a = acquireLease(db, "runner", "a", TTL, 0)!;
    expect(heartbeat(db, a, TTL, 30_000)).toBe(true);
    expect(acquireLease(db, "runner", "b", TTL, 60_000)).toBeNull();
    const b = acquireLease(db, "runner", "b", TTL, 90_001);
    expect(b).toEqual({ resource: "runner", holder: "b", expiresAt: 150_001 });
    expect(heartbeat(db, a, TTL, 90_002)).toBe(false);
    releaseLease(db, a);
    expect(acquireLease(db, "runner", "a", TTL, 90_003)).toBeNull();
    releaseLease(db, b!);
    expect(acquireLease(db, "runner", "a", TTL, 90_004)).not.toBeNull();
  });

  it("hold across two connections to one store file", () => {
    const dir = tempDir();
    const one: Store = openStore({ dataDir: dir.path });
    const two: Store = openStore({ dataDir: dir.path });
    cleanups.push(() => {
      one.close();
      two.close();
      dir.remove();
    });
    const results = [acquireLease(one.db, "recover", "p1", TTL, 0), acquireLease(two.db, "recover", "p2", TTL, 0)];
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
