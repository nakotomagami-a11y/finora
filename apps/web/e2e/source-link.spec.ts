import { expect, test } from "@playwright/test";

const PAGES = ["/en", "/lt/crash", "/lv/terms", "/et/nothing-here"];

test.describe("the source-code link (R18)", () => {
  test("the footer shows the link that GET /api/v1/about reports, on every page", async ({ page, request }) => {
    const about = (await (await request.get("/api/v1/about")).json()) as { sourceUrl: string };
    for (const path of PAGES) {
      await page.goto(path);
      const link = page.getByTestId("source-link");
      await expect(link, path).toBeVisible();
      await expect(link, path).toHaveAttribute("href", about.sourceUrl);
      await expect(link, path).toHaveAttribute("rel", /noopener/u);
    }
  });
});
