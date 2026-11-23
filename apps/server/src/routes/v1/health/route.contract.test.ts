import { describe, expect, it } from "vitest";
import { HealthResponse } from "@finora/api-contract";
import { handle } from "../../../router.ts";

describe("GET /api/v1/health", () => {
  it("returns a body that validates against its contract", async () => {
    const response = await handle(new Request("http://127.0.0.1:3000/api/v1/health", { headers: { host: "127.0.0.1:3000" } }));
    expect(response.status).toBe(200);
    const body = HealthResponse.parse(await response.json());
    expect(body).toMatchObject({ status: "ok", store: null });
  });

  it("is refused for a foreign Host", async () => {
    const response = await handle(new Request("http://127.0.0.1:3000/api/v1/health", { headers: { host: "evil.example" } }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { code: "host_not_allowed" } });
  });
});
