// Legal 7093040951 on S05 T2: the narrow rule for a foreign holder's short company form.
import { describe, expect, it } from "vitest";
import { endsWithShortCompanyForm } from "./legal-forms.ts";

describe("endsWithShortCompanyForm", () => {
  it("accepts a listed form, spelt as the form, as the last of two words or more", () => {
    for (const name of ["Example OÜ", "Example Shipping AS", "Example AB", "Example Oy", "Example AG", "Example S.A.", "Example B.V.", "Example NV,"]) expect(endsWithShortCompanyForm(name), name).toBe(true);
  });

  it("reads a decomposed form as the listed one, and strips trailing marks and a final period (qa NITs)", () => {
    for (const name of ["Example OÜ", "Example AS.", 'Example "Shipping AS"', "Example AS”", "Example AB;"]) expect(endsWithShortCompanyForm(name), name).toBe(true);
    expect(endsWithShortCompanyForm("Example S.A.")).toBe(true);
  });

  it("refuses a bare form, another spelling, a form that is not last, and an unlisted token", () => {
    for (const name of ["AS", "Test Person As", "Test Person as", "AS Test Person", "Example Ab", "Example XY", ""]) expect(endsWithShortCompanyForm(name), name).toBe(false);
  });
});
