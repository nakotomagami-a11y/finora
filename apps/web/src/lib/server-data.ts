import "server-only";
import { getEnv } from "@finora/server/env";

// The render seam for server components: everything a page reads from the server package goes through
// this file, so the dependency stays in one place (architecture §5.3).
export { getAbout } from "@finora/server/render";

/** Demo mode serves fixtures and the state gallery; a normal run does not (`FINORA_DEMO=1`). */
export function isDemoMode(): boolean {
  return getEnv().FINORA_DEMO === "1";
}
