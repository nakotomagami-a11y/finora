// Writes the fixture files from their builders: `pnpm --filter @finora/web fixtures:ui`. The test in
// src/fixtures/ui-fixtures.test.ts fails while the committed files differ from this output.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureText, uiFixtureFiles } from "../src/fixtures/ui-fixtures.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
for (const file of uiFixtureFiles()) {
  const target = join(ROOT, file.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, fixtureText(file.json));
}
process.stdout.write(`wrote ${uiFixtureFiles().length} fixture files\n`);
