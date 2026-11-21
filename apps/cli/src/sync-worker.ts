// The CLI's worker entry: it resolves a source id against the fixture profile and the shipped
// loaders only; it never imports a module named in its job (SEC-11).
import { FIXTURE_PROFILE } from "@finora/fixtures";
import { serveSyncWorker } from "@finora/ingest";
import { LOADERS } from "@finora/sources";

await serveSyncWorker((sourceId) => FIXTURE_PROFILE.find((p) => p.loader.meta.id === sourceId)?.loader ?? LOADERS.find((l) => l.meta.id === sourceId));
