import { expect, test } from "@playwright/test";

test.describe("the terms link (P7)", () => {
  test("the footer links to terms that name the blocked uses and carry the disclaimer", async ({ page }) => {
    await page.goto("/en");
    await page.getByTestId("terms-link").click();
    await expect(page).toHaveURL(/\/en\/terms$/u);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Terms of use");
    for (const use of ["Credit", "Employment", "Insurance", "Tenancy", "Licensing"]) {
      await expect(page.getByText(`${use} decisions about a private individual or sole trader`, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("Servicing or collecting credit about a private individual or sole trader", { exact: true })).toBeVisible();
    await expect(page.getByText(/investment/iu)).toHaveCount(0);
    await expect(page.getByText(/a purpose is asked for\. The purpose is logged/u)).toBeVisible();
    await expect(page.getByText(/report-a-problem form/u)).toBeVisible();
    await expect(
      page.getByText("Not a credit report. Not for credit, employment, tenancy or insurance decisions."),
    ).toBeVisible();
  });

  test("the terms link is on every locale's pages", async ({ page }) => {
    for (const locale of ["lt", "lv", "et"]) {
      await page.goto(`/${locale}`);
      await expect(page.getByTestId("terms-link")).toHaveAttribute("href", `/${locale}/terms`);
    }
  });
});
