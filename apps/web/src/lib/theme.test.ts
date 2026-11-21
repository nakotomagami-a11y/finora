import { describe, expect, it } from "vitest";
import { themeFromCookie } from "./theme.ts";

describe("themeFromCookie", () => {
  it("accepts dark and light", () => {
    expect(themeFromCookie("dark")).toBe("dark");
    expect(themeFromCookie("light")).toBe("light");
  });

  it("treats a missing or unknown value as the system choice", () => {
    expect(themeFromCookie(undefined)).toBe("system");
    expect(themeFromCookie("")).toBe("system");
    expect(themeFromCookie("purple")).toBe("system");
  });
});
