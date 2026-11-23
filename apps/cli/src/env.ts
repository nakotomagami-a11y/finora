// The CLI's environment, read and checked once. This is the only file of the CLI that reads
// process.env (architecture §2).
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type CliEnv = {
  /** Resolved against the repository root, never the working directory (§15). */
  dataDir: string;
  secUserAgent: string | null;
  shareAlikeMode: "store" | "live-no-store";
  /** `LV_PERSON_ROWS` (§3.3, PS7): validated here and passed in every sync job (SEC-1 on S05). */
  lvPersonRows: "names_no_id" | "role_counts";
};

/** The directory holding pnpm-workspace.yaml, found by walking up from this file. */
export function repoRoot(from = dirname(fileURLToPath(import.meta.url))): string {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    if (dirname(dir) === dir) throw new Error("not inside the Finora repository");
  }
}

export function loadCliEnv(source: Record<string, string | undefined> = process.env): CliEnv {
  const raw = source.FINORA_DATA_DIR && source.FINORA_DATA_DIR !== "" ? source.FINORA_DATA_DIR : "./.data";
  const mode = source.SHARE_ALIKE_MODE ?? "store";
  if (mode !== "store" && mode !== "live-no-store") throw new Error(`Invalid environment: SHARE_ALIKE_MODE must be "store" or "live-no-store"`);
  const lvPersonRows = source.LV_PERSON_ROWS && source.LV_PERSON_ROWS !== "" ? source.LV_PERSON_ROWS : "names_no_id";
  if (lvPersonRows !== "names_no_id" && lvPersonRows !== "role_counts") throw new Error(`Invalid environment: LV_PERSON_ROWS must be "names_no_id" or "role_counts"`);
  return {
    dataDir: isAbsolute(raw) ? raw : resolve(repoRoot(), raw),
    secUserAgent: source.SEC_USER_AGENT && source.SEC_USER_AGENT !== "" ? source.SEC_USER_AGENT : null,
    shareAlikeMode: mode,
    lvPersonRows,
  };
}
