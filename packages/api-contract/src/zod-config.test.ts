// @vitest-environment jsdom
import { z } from "zod";
import { describe, expect, it } from "vitest";

describe("the contract in a browser", () => {
  it("asks Zod not to compile its fast path, so it never probes for eval (the page's CSP has no unsafe-eval)", async () => {
    // A fresh copy of the contract, loaded as a browser would: `window` exists, nothing else has built a schema yet.
    expect("window" in globalThis).toBe(true);
    await import("./zod-config.ts");
    expect(z.config().jitless).toBe(true);
    const { CrashResponse } = await import("./markets.ts");
    expect(CrashResponse.safeParse({ tiles: [] }).success).toBe(true);
  });
});
