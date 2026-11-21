// The worker entry for the core profile: it trusts the shipped loader list only (SEC-11).
import { LOADERS } from "@finora/sources";
import { serveSyncWorker } from "./worker.ts";

await serveSyncWorker((sourceId) => LOADERS.find((l) => l.meta.id === sourceId));
