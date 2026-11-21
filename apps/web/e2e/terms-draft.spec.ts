import { expect, test } from "@playwright/test";

// Legal's condition: the terms say they are a draft, in every language, until legal clears that language.
const DRAFT_LINE = {
  en: "These terms are a draft until a lawyer has reviewed them.",
  lt: "Šios sąlygos yra projektas, kol jų neperžiūrėjo teisininkas.",
  lv: "Šie noteikumi ir melnraksts, līdz tos pārskata jurists.",
  et: "Need tingimused on mustand, kuni jurist on need üle vaadanud.",
};

for (const [locale, line] of Object.entries(DRAFT_LINE)) {
  test(`the ${locale} terms page shows the draft line`, async ({ page }) => {
    await page.goto(`/${locale}/terms`);
    await expect(page.getByText(line)).toBeVisible();
  });
}
