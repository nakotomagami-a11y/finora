// M1-F1: `finora-cli --help` answers with the usage and exits 0; an unknown command still exits 2.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const main = fileURLToPath(new URL("./main.ts", import.meta.url));
const cli = (...args: string[]) => spawnSync(process.execPath, [main, ...args], { encoding: "utf8", env: { ...process.env, FINORA_DATA_DIR: "" } });

describe("finora-cli help (M1-F1)", () => {
  it("--help, -h and help print the usage and exit 0", () => {
    for (const arg of ["--help", "-h", "help"]) {
      const run = cli(arg);
      expect(run.status, arg).toBe(0);
      expect(run.stdout, arg).toMatch(/^usage: finora-cli <command>/);
      expect(run.stdout, arg).toMatch(/data sync/);
    }
  });

  it("the control: an unknown command prints the usage to stderr and exits 2", () => {
    const run = cli("no-such-command");
    expect(run.status).toBe(2);
    expect(run.stderr).toMatch(/usage: finora-cli/);
  });
});
