import { expect, test } from "@playwright/test";

const PAGES = ["/en", "/lv/design/typography", "/lt/design/forms", "/et/design/data", "/en/design/overlays"];

test.describe("fonts and third parties", () => {
  test("a page load makes no request to any other origin", async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? "").origin;
    const foreign: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith(origin) && !url.startsWith("data:") && !url.startsWith("blob:")) foreign.push(url);
    });
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    expect(foreign).toEqual([]);
  });

  test("the three faces load from our own origin and cover the Baltic letters", async ({ page, baseURL }) => {
    const fontRequests: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "font") fontRequests.push(request.url());
    });
    await page.goto("/lv/design/typography");
    await page.evaluate(async () => {
      const text = "ĄČĘĖĮŠŲŪŽ ĀČĒĢĪĶĻŅŠŪŽ ÕÄÖÜŠŽ";
      await Promise.all([
        document.fonts.load('400 14px "Geist Variable"', text),
        document.fonts.load('400 26px "Instrument Serif"', text),
        document.fonts.load('400 12px "Geist Mono Variable"', text),
      ]);
    });
    const loaded = await page.evaluate(() =>
      [...document.fonts].filter((face) => face.status === "loaded").map((face) => `${face.family}|${face.unicodeRange}`),
    );
    for (const family of ["Geist Variable", "Instrument Serif", "Geist Mono Variable"]) {
      expect(loaded.some((entry) => entry.replaceAll('"', "").startsWith(`${family}|`)), `${family} did not load`).toBe(true);
    }
    // The Baltic letters sit in the latin-ext subset of each face; at least one request carries it.
    expect(fontRequests.some((url) => /latin-ext/u.test(url))).toBe(true);
    for (const url of fontRequests) expect(url.startsWith(new URL(baseURL ?? "").origin)).toBe(true);
  });

  test("every Baltic letter renders in the intended face, not a fallback", async ({ page }) => {
    await page.goto("/lv/design/typography");
    const fallback = await page.evaluate(async () => {
      const text = "ĄČĘĖĮŠŲŪŽąčęėįšųūžĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūžÕÄÖÜŠŽõäöüšž";
      const faces = ['"Geist Variable"', '"Instrument Serif"', '"Geist Mono Variable"'];
      const missing: string[] = [];
      for (const face of faces) {
        await document.fonts.load(`16px ${face}`, text);
        for (const char of text) if (!document.fonts.check(`16px ${face}`, char)) missing.push(`${face}: ${char}`);
      }
      return missing;
    });
    expect(fallback).toEqual([]);
  });
});
