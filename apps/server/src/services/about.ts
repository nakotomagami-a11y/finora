import { AboutResponse } from "@finora/api-contract";
import { getEnv } from "../env.ts";
import pkg from "../../package.json" with { type: "json" };

export function getAbout(): AboutResponse {
  const env = getEnv();
  return AboutResponse.parse({
    name: "Finora",
    version: pkg.version,
    commit: env.FINORA_COMMIT ?? null,
    sourceUrl: env.FINORA_SOURCE_URL,
    licence: "AGPL-3.0-or-later",
  });
}
