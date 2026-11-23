import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

// The rule reads its terms once per process, so the fictional term is set before ESLint loads.
process.env.FINORA_GUARD_DENYLIST = "zorblax,quellnor fund";
const { ESLint } = await import("eslint");
const eslint = new ESLint({ cwd: repoRoot });

async function denylistMessages(code: string) {
  const [result] = await eslint.lintText(code, { filePath: join(repoRoot, "packages/domain/src/sample.ts") });
  return (result?.messages ?? []).filter((m) => m.ruleId === "finora/denylist");
}

describe("finora/denylist", () => {
  it("flags a denylisted identifier and a denylisted phrase in a string", async () => {
    const messages = await denylistMessages('export const zorblax = "the Quellnor-Fund report";\n');
    expect(messages).toHaveLength(2);
  });

  it("never repeats the matched text", async () => {
    const [message] = await denylistMessages("export const zorblax = 1;\n");
    expect(message?.message).toMatch(/entry 1/);
    expect(message?.message.toLowerCase()).not.toContain("zorblax");
  });

  it("does not match a term inside a longer word", async () => {
    expect(await denylistMessages("export const zorblaxCount = 1;\n")).toHaveLength(0);
  });
});
