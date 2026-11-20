import { describe, expect, it } from "vitest";
import { EnvError, loadEnv } from "./env.ts";

describe("loadEnv", () => {
  it("fills the defaults", () => {
    const env = loadEnv({});
    expect(env.FINORA_PORT).toBe(3000);
    expect(env.FINORA_DATA_DIR).toBe("./.data");
    expect(env.FINORA_DEMO).toBeUndefined();
    expect(env.FINORA_SOURCE_URL).toMatch(/^https:\/\//u);
  });

  it("reads a valid port and demo flag", () => {
    const env = loadEnv({ FINORA_PORT: "4100", FINORA_DEMO: "1" });
    expect(env.FINORA_PORT).toBe(4100);
    expect(env.FINORA_DEMO).toBe("1");
  });

  it("treats an empty value as unset", () => {
    expect(loadEnv({ FINORA_PORT: "" }).FINORA_PORT).toBe(3000);
  });

  it.each([
    ["FINORA_PORT", "not-a-port"],
    ["FINORA_PORT", "70000"],
    ["FINORA_DEMO", "yes"],
    ["FINORA_SOURCE_URL", "not a url"],
    ["NODE_ENV", "staging"],
  ])("fails naming %s when it is %s", (name, value) => {
    expect(() => loadEnv({ [name]: value })).toThrowError(name);
    try {
      loadEnv({ [name]: value });
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      expect((error as EnvError).variables).toEqual([name]);
    }
  });

  it("names every invalid variable at once", () => {
    try {
      loadEnv({ FINORA_PORT: "x", FINORA_DEMO: "y" });
      expect.unreachable();
    } catch (error) {
      expect((error as EnvError).variables.sort()).toEqual(["FINORA_DEMO", "FINORA_PORT"]);
    }
  });
});
