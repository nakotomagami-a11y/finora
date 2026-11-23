// Writes docs/api/openapi.json from the schemas: `pnpm --filter @finora/api-contract openapi`.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openApiText } from "./openapi.ts";

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const OPENAPI_FILE = join(REPO_ROOT, "docs", "api", "openapi.json");
export const apiVersion = () => (JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as { version?: string }).version ?? "0.0.0";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(dirname(OPENAPI_FILE), { recursive: true });
  writeFileSync(OPENAPI_FILE, openApiText(apiVersion()));
  process.stdout.write("wrote docs/api/openapi.json\n");
}
