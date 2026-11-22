// Starts the production server the way a person would (no FINORA_DEMO), for the tests that prove the demo-only
// pages stay shut. A plain .mjs file, because the e2e tests may not read the process environment themselves.
import { spawn } from "node:child_process";

/** Spawns `scripts/run-next.mjs start` on `port` with the shell's environment minus FINORA_DEMO. */
export function startPlainServer(port) {
  const { FINORA_DEMO: _demo, ...rest } = process.env;
  return spawn(process.execPath, ["scripts/run-next.mjs", "start"], { env: { ...rest, FINORA_PORT: String(port) }, stdio: "ignore" });
}
