import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CompanyReport, CrashResponse, ErrorResponse, EstimateResponse, InvestigationEvent, InvestigationSnapshot, LibraryResponse, NetworkResponse, SearchResponse } from "@finora/api-contract";
import { AgentsStatusResponse } from "@finora/api-contract";
import { describe, expect, it } from "vitest";
import { emptyState, fromSnapshot, reduce, type InvestigationState } from "../lib/investigation-reducer.ts";
import { fixtureText, scenarios, uiFixtureFiles } from "./ui-fixtures.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const read = (path: string): unknown => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

const SCHEMAS = {
  investigation: InvestigationSnapshot,
  crash: CrashResponse,
  search: SearchResponse,
  network: NetworkResponse,
  library: LibraryResponse,
  estimate: EstimateResponse,
  "agents-status": AgentsStatusResponse,
  company: CompanyReport,
  errors: ErrorResponse,
} as const;

/** Every state the plan's table (§12) names, per screen. A state without a file fails here. */
const REQUIRED: Record<string, string[]> = {
  investigation: ["streaming", "question-entity", "question-sanctions", "question-scope", "question-cap", "question-cap-used", "partial", "error", "report", "limit", "overage"],
  crash: ["not-configured", "mixed", "live", "delayed", "stale", "error", "peak-unknown"],
  network: ["graph", "list", "empty", "too-large"],
  search: ["empty", "loading", "results"],
  company: ["lv", "lt", "ee", "us", "sole-trader", "purpose-set"],
  "agents-status": ["off", "ready", "cli-missing", "cli-signed-out", "unsafe", "busy", "overage-permitted", "overage-in-use"],
  estimate: ["default", "measured", "daily-cap"],
  library: ["list", "empty"],
  errors: ["internal"],
};

describe("the committed fixture files", () => {
  const files = uiFixtureFiles();

  it("equal what the builders produce (run `pnpm --filter @finora/web fixtures:ui` after a change)", () => {
    for (const file of files) {
      expect(existsSync(join(ROOT, file.path)), `${file.path} exists`).toBe(true);
      expect(readFileSync(join(ROOT, file.path), "utf8").replace(/\r\n/gu, "\n"), file.path).toBe(fixtureText(file.json));
    }
  });

  it("hold no file the builders do not produce", () => {
    const expected = new Set(files.map((file) => file.path));
    for (const dir of ["fixtures/ui", "fixtures/agents"]) {
      const walk = (path: string): string[] =>
        readdirSync(join(ROOT, path), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(`${path}/${entry.name}`) : [`${path}/${entry.name}`]));
      for (const found of walk(dir)) expect(expected.has(found), `${found} is generated`).toBe(true);
    }
  });

  it("validate against the contract, each in its own screen's schema", () => {
    for (const file of files) {
      const screen = file.path.split("/")[2];
      if (file.path.startsWith("fixtures/agents/")) continue;
      const schema = SCHEMAS[screen as keyof typeof SCHEMAS];
      expect(schema, `a schema for ${screen}`).toBeDefined();
      const result = schema.safeParse(read(file.path));
      expect(result.success, `${file.path}: ${result.success ? "" : JSON.stringify(result.error.issues[0])}`).toBe(true);
    }
  });

  it("hold a file for every state the plan names", () => {
    for (const [screen, states] of Object.entries(REQUIRED)) {
      for (const state of states) expect(existsSync(join(ROOT, "fixtures", "ui", screen, `${state}.json`)), `${screen}/${state}`).toBe(true);
    }
  });

  it("use only fictional names, fixture hosts and official hosts", () => {
    const OFFICIAL = new Set(["manas.tiesas.lv"]);
    for (const file of files) {
      const text = fixtureText(file.json);
      for (const match of text.matchAll(/https?:\/\/([a-z0-9.-]+)/giu)) {
        const host = (match[1] as string).toLowerCase();
        expect(host.endsWith(".example") || OFFICIAL.has(host), `${file.path}: ${host}`).toBe(true);
      }
      expect(text, file.path).not.toMatch(/@[a-z0-9-]+\./iu);
    }
  });
});

describe("the event scripts", () => {
  /** The page-visible state; the live step line is not part of a snapshot. */
  const shown = (state: InvestigationState) => {
    const { connection: _c, gap: _g, lastError: _e, ...rest } = state;
    const runs = Object.fromEntries(Object.entries(rest.runs).map(([id, run]) => [id, { ...run, stepKey: undefined, stepParams: undefined }]));
    return JSON.parse(JSON.stringify({ ...rest, runs })) as unknown;
  };

  it.each(scenarios().map((s) => s.scenario))("replaying %s reaches the state of its snapshot (live equals reload)", (name) => {
    const script = read(`fixtures/agents/${name}.json`) as { events: unknown[]; final: unknown };
    const events = script.events.map((event) => InvestigationEvent.parse(event));
    const final = InvestigationSnapshot.parse(script.final);
    expect(events.map((e) => e.id)).toEqual(events.map((_, i) => i + 1));
    const replayed = events.reduce(reduce, emptyState(final.id));
    expect(replayed.gap).toBe(false);
    expect(shown(replayed)).toEqual(shown(fromSnapshot(final)));
  });

  it("every question scenario ends with one pending question and a waiting run", () => {
    for (const s of scenarios().filter((x) => x.scenario.startsWith("question-"))) {
      expect(s.final.questions.filter((q) => q.answer === undefined)).toHaveLength(1);
      expect(s.final.runs.some((r) => r.status === "waiting")).toBe(true);
    }
  });

  it("the limit and overage scenarios pause the whole investigation with their code", () => {
    const byName = Object.fromEntries(scenarios().map((s) => [s.scenario, s.final]));
    expect(byName.limit?.status).toBe("paused");
    expect(byName.limit?.code).toBe("plan_limit");
    expect(byName.limit?.resetsAt).toBeDefined();
    expect(byName.overage?.status).toBe("paused");
    expect(byName.overage?.code).toBe("overage");
  });
});
