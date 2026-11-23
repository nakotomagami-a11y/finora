import { describe, expect, it } from "vitest";
import { AboutResponse } from "@finora/api-contract";
import { handle } from "../../../router.ts";

describe("GET /api/v1/about", () => {
  it("returns a body that validates against its contract and carries the source-code link (R18)", async () => {
    const response = await handle(new Request("http://127.0.0.1:3000/api/v1/about", { headers: { host: "127.0.0.1:3000" } }));
    expect(response.status).toBe(200);
    const body = AboutResponse.parse(await response.json());
    expect(body.sourceUrl).toMatch(/^https:\/\//u);
    expect(body.licence).toBe("AGPL-3.0-or-later");
  });
});
