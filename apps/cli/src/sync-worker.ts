// The CLI's worker entry: it resolves a source id against the fixture profile and the shipped
// loaders only; it never imports a module named in its job (SEC-11).
import { fixtureProfileFor } from "@finora/fixtures";
import { serveSyncWorker } from "@finora/ingest";
import { loadersFor } from "@finora/sources";

await serveSyncWorker((sourceId, config) => fixtureProfileFor(config).find((p) => p.loader.meta.id === sourceId)?.loader ?? loadersFor(config).find((l) => l.meta.id === sourceId));
