// A route handler bound to its entry in API_ROUTES (architecture §5.1): it validates path params,
// query and body against the contract, then calls the real service once one exists. Until then,
// `FINORA_DEMO=1` serves the route's fixture DTO and anything else answers 501 not_implemented
// (S04b), so the UI builds against the real routes from day one.
import { API_ROUTES, type ApiRoute } from "@finora/api-contract";
import { isBlockedPurpose } from "@finora/domain";
import type { z } from "zod";
import { demoResponse } from "./demo/responses.ts";
import { getEnv } from "./env.ts";
import { errorResponse } from "./guard.ts";
import type { RouteHandler } from "./router-types.ts";

export type ValidInput = { params: Record<string, unknown>; query: Record<string, unknown>; body: unknown; request: Request };
export type Service = (input: ValidInput) => Promise<Response> | Response;

/** The field path of the first issue only: never the value the client sent. */
const where = (error: z.ZodError) => error.issues[0]?.path.join(".") || "(root)";

export function contractRoute(operationId: string, service?: Service): RouteHandler {
  const route = API_ROUTES.find((r) => r.operationId === operationId);
  if (!route) throw new Error(`no API route ${operationId}`);
  return async (request, context) => {
    const input = await validate(route, request, await context.params);
    if (input instanceof Response) return input;
    if (service) return service(input);
    if (getEnv().FINORA_DEMO === "1") return demoResponse(route, input);
    return errorResponse("not_implemented", 501);
  };
}

async function validate(route: ApiRoute, request: Request, rawParams: Record<string, string>): Promise<ValidInput | Response> {
  const params = route.params ? route.params.safeParse(rawParams) : { success: true as const, data: {} };
  if (!params.success) return errorResponse("bad_request", 400, `params.${where(params.error)}`);
  const searchParams = Object.fromEntries(new URL(request.url).searchParams);
  const query = route.query ? route.query.safeParse(searchParams) : { success: true as const, data: {} };
  if (!query.success) return errorResponse("bad_request", 400, `query.${where(query.error)}`);
  let body: unknown = undefined;
  if (route.body) {
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return errorResponse("bad_request", 400, "body");
    }
    const parsed = route.body.safeParse(json);
    if (!parsed.success) {
      // A blocked purpose is not in the list at all (P7); the code names why it was refused.
      if (typeof json === "object" && json !== null && isBlockedPurpose((json as { purposeId?: unknown }).purposeId)) return errorResponse("purpose_blocked", 400);
      return errorResponse("bad_request", 400, `body.${where(parsed.error)}`);
    }
    body = parsed.data;
  }
  return { params: params.data as Record<string, unknown>, query: query.data as Record<string, unknown>, body, request };
}
