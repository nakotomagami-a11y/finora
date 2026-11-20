import { errorResponse, guardRequest } from "./guard.ts";
import { ROUTE_TABLE } from "./route-table.ts";
import type { HttpMethod, RouteEntry } from "./router-types.ts";

const METHODS: readonly HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

type Match = { entry: RouteEntry; params: Record<string, string> };

/** Static segments beat dynamic ones, so `/companies/search` would win over `/companies/:eid`. */
export function matchRoute(pathname: string, table: readonly RouteEntry[] = ROUTE_TABLE): Match | null {
  const segments = pathname.split("/").filter(Boolean);
  let best: { match: Match; statics: number } | null = null;
  for (const entry of table) {
    const pattern = entry.pattern.split("/").filter(Boolean);
    if (pattern.length !== segments.length) continue;
    const params: Record<string, string> = {};
    let statics = 0;
    let ok = true;
    for (const [i, part] of pattern.entries()) {
      const actual = segments[i] as string;
      if (part.startsWith(":")) {
        try {
          params[part.slice(1)] = decodeURIComponent(actual);
        } catch {
          ok = false;
          break;
        }
      } else if (part === actual) {
        statics += 1;
      } else {
        ok = false;
        break;
      }
    }
    if (ok && (best === null || statics > best.statics)) best = { match: { entry, params }, statics };
  }
  return best?.match ?? null;
}

/** The API: a web-standard handler with no dependency on Next. Every path goes through the local-only guard first. */
export async function handle(request: Request, table: readonly RouteEntry[] = ROUTE_TABLE): Promise<Response> {
  const refused = guardRequest(request);
  if (refused) return refused;

  const url = new URL(request.url);
  const match = matchRoute(url.pathname.replace(/\/+$/u, "") || "/", table);
  if (!match) return errorResponse("not_found", 404);

  const requested = request.method.toUpperCase();
  const method = requested === "HEAD" ? "GET" : requested;
  const handler = METHODS.includes(method as HttpMethod) ? match.entry.module[method as HttpMethod] : undefined;
  if (!handler) {
    const allow = METHODS.filter((m) => match.entry.module[m]).join(", ");
    const response = errorResponse("method_not_allowed", 405);
    response.headers.set("Allow", allow);
    return response;
  }

  try {
    const response = await handler(request, { params: Promise.resolve(match.params) });
    return requested === "HEAD" ? new Response(null, { status: response.status, headers: response.headers }) : response;
  } catch (error) {
    console.error("API handler failed:", error instanceof Error ? error.message : "unknown error");
    return errorResponse("internal_error", 500);
  }
}
