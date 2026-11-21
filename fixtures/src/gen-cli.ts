// `pnpm fixtures:gen [seed]`: writes the world for a seed to fixtures/.generated (gitignored), so
// the synthetic data can be read and diffed. The same seed always gives the same bytes.
import { mkdirSync, writeFileSync } from "node:fs";
import { DEFAULT_SEED, generateWorld, serializeWorld } from "./world.ts";

const seed = Number(process.argv[2] ?? DEFAULT_SEED);
if (!Number.isInteger(seed)) {
  process.stderr.write("usage: pnpm fixtures:gen [integer seed]\n");
  process.exit(2);
}
const dir = new URL("../.generated/", import.meta.url);
mkdirSync(dir, { recursive: true });
const world = generateWorld(seed);
const file = new URL(`world-${seed}.json`, dir);
writeFileSync(file, serializeWorld(world));
process.stdout.write(`fixtures: ${world.companies.length} companies, ${world.roleSets.length} role sets, ${world.stateRecords.length} state records -> ${file.pathname}\n`);
