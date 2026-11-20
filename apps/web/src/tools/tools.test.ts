import { describe, expect, it } from "vitest";
import { TOOLS, enabledTools, isActive } from "./index.ts";

const byId = (id: string) => TOOLS.find((tool) => tool.id === id)!;

describe("tool manifests", () => {
  it("lists the explorer and Crash monitor as enabled and keeps unbuilt tools out of the rail", () => {
    expect(enabledTools().map((tool) => tool.id)).toEqual(["explorer", "crash"]);
  });

  it("gives every tool a distinct id and href", () => {
    expect(new Set(TOOLS.map((tool) => tool.id)).size).toBe(TOOLS.length);
    expect(new Set(TOOLS.map((tool) => tool.href)).size).toBe(TOOLS.length);
  });

  it("marks the explorer active on the home page and on company pages only", () => {
    expect(isActive(byId("explorer"), "/")).toBe(true);
    expect(isActive(byId("explorer"), "/explorer/lv/00000000000")).toBe(true);
    expect(isActive(byId("explorer"), "/crash")).toBe(false);
  });

  it("marks another tool active on its own path and below it", () => {
    expect(isActive(byId("crash"), "/crash")).toBe(true);
    expect(isActive(byId("crash"), "/crash/anything")).toBe(true);
    expect(isActive(byId("crash"), "/crashes")).toBe(false);
  });
});
