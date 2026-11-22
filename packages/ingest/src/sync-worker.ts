// The worker entry for the core profile: it trusts the shipped loader list only (SEC-11).
import { loadersFor } from "@finora/sources";
import { serveSyncWorker } from "./worker.ts";

await serveSyncWorker((sourceId, config) => loadersFor(config).find((l) => l.meta.id === sourceId));
