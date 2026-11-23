import "server-only";
import { getEnv } from "./env.ts";
import { startMarkets } from "./services/markets.ts";

let booted = false;

/**
 * Starts the background work of the app (job runner, scheduled refreshes) once per process, and
 * refuses to start when the environment is invalid. Later slices add their jobs here.
 */
export function boot(): void {
  if (booted) return;
  getEnv();
  startMarkets();
  booted = true;
}
