import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { childArgs, childEnv } from "../scripts/run-next.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "run-next.mjs");

describe("childEnv", () => {
  const inherited = { NODE_ENV: "development", __NEXT_PRIVATE_TEST: "1", PATH: "/bin", FINORA_PORT: "3100" };

  it("sets NODE_ENV per command and replaces the inherited value", () => {
    expect(childEnv("start", inherited).NODE_ENV).toBe("production");
    expect(childEnv("build", inherited).NODE_ENV).toBe("production");
    expect(childEnv("dev", { ...inherited, NODE_ENV: "production" }).NODE_ENV).toBe("development");
  });

  it("leaves behind every variable that is not on the list, whatever its case", () => {
    const hostile = {
      __NEXT_PRIVATE_TEST: "1",
      __next_private_origin: "http://elsewhere",
      NEXT_RUNTIME: "edge",
      next_deployment_id: "x",
      NEXT_DEPLOYMENT_ID: "x",
      TURBOPACK: "1",
      PORT: "9999",
      HOSTNAME: "other",
      SOME_OTHER_APP_TOKEN: "t",
    };
    const env = childEnv("start", { ...hostile, PATH: "/bin" });
    expect(Object.keys(env).sort()).toEqual(["NODE_ENV", "PATH"]);
  });

  it("keeps what Finora and the system need", () => {
    const wanted = {
      PATH: "/bin",
      Path: "bin-dir",
      SystemRoot: "system-root",
      USERPROFILE: "profile-dir",
      FINORA_PORT: "3100",
      FINORA_DATA_DIR: "./.data",
      ANTHROPIC_API_KEY: "k",
      NEXT_PUBLIC_ANTHROPIC_API_KEY: "k",
      NODE_OPTIONS: "--max-old-space-size=4096",
      LANG: "en_GB.UTF-8",
    };
    const env = childEnv("build", { ...wanted, NODE_ENV: "development" });
    for (const [name, value] of Object.entries(wanted)) expect(env[name], name).toBe(value);
    expect(env.NODE_ENV).toBe("production");
  });

  it("does not change the environment it was given", () => {
    const copy = { ...inherited };
    childEnv("start", copy);
    expect(copy).toEqual(inherited);
  });
});

describe("childArgs", () => {
  it("binds dev and start to 127.0.0.1 on FINORA_PORT, defaulting to 3000", () => {
    expect(childArgs("start", {})).toEqual(["--hostname", "127.0.0.1", "--port", "3000"]);
    expect(childArgs("dev", { FINORA_PORT: "4100" })).toEqual(["--hostname", "127.0.0.1", "--port", "4100"]);
  });

  it("gives build no address", () => {
    expect(childArgs("build", { FINORA_PORT: "4100" })).toEqual([]);
  });

  it("refuses a port that is not a port", () => {
    expect(() => childArgs("start", { FINORA_PORT: "abc" })).toThrowError("FINORA_PORT");
    expect(() => childArgs("start", { FINORA_PORT: "70000" })).toThrowError("FINORA_PORT");
  });
});

describe("the script", () => {
  it("refuses an unknown command", () => {
    const result = spawnSync(process.execPath, [SCRIPT, "serve"], { encoding: "utf8" });
    expect(result.status).toBe(2);
  });

  it("names the variable when FINORA_PORT is invalid", () => {
    const result = spawnSync(process.execPath, [SCRIPT, "start"], { encoding: "utf8", env: { ...process.env, FINORA_PORT: "nope" } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("FINORA_PORT");
  });
});
