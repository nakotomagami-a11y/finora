import { HealthResponse } from "@finora/api-contract";
import pkg from "../../package.json" with { type: "json" };

export function getHealth(): HealthResponse {
  return HealthResponse.parse({ status: "ok", version: pkg.version, store: null });
}
