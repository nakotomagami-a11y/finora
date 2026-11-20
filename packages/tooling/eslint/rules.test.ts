import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const eslint = new ESLint({ cwd: repoRoot });

async function ruleIds(code: string, file: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: join(repoRoot, file) });
  return (result?.messages ?? []).map((m) => m.ruleId ?? "fatal");
}

describe("the shared ESLint config (architecture §2)", () => {
  it("rejects `any`", async () => {
    expect(await ruleIds("export const x: any = 1;\n", "packages/domain/src/sample.ts")).toContain(
      "@typescript-eslint/no-explicit-any",
    );
  });

  it("rejects process.env outside env.ts", async () => {
    const code = "export const port = process.env.PORT;\n";
    expect(await ruleIds(code, "packages/domain/src/sample.ts")).toContain("no-restricted-properties");
    expect(await ruleIds(code, "apps/server/src/env.ts")).not.toContain("no-restricted-properties");
  });

  it("rejects Node built-ins in packages/domain, prefixed or bare", async () => {
    for (const source of ["node:fs", "fs", "path"]) {
      const code = `import x from "${source}";\nexport default x;\n`;
      expect(await ruleIds(code, "packages/domain/src/sample.ts")).toContain("no-restricted-imports");
    }
  });

  it("allows Node built-ins outside packages/domain", async () => {
    const code = 'import { join } from "node:path";\nexport const p = join("a", "b");\n';
    expect(await ruleIds(code, "packages/tooling/eslint/sample.ts")).not.toContain("no-restricted-imports");
  });

  it("rejects an import of a workspace package the file's package does not declare", async () => {
    const code = 'import { x } from "@finora/store";\nexport default x;\n';
    expect(await ruleIds(code, "packages/domain/src/sample.ts")).toContain("finora/declared-workspace-deps");
  });

  it("allows a package to import itself", async () => {
    const code = 'import { ITEMS } from "@finora/domain";\nexport default ITEMS;\n';
    expect(await ruleIds(code, "packages/domain/src/sample.ts")).not.toContain("finora/declared-workspace-deps");
  });
});
