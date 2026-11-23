import { API_ROUTES, ErrorResponse, type ApiRoute } from "@finora/api-contract";

/**
 * The typed client of the local API (docs/plan/ui-build-plan.md §2, U2). Every call is described by `API_ROUTES`: the
 * path comes from the route table, the answer is checked against the route's own schema, and a failure is a plain
 * value with an error code, never a thrown message. No secret and no cost figure passes through here.
 */

export type ApiInput = {
  params?: Record<string, string>;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string };

const ROUTES = new Map<string, ApiRoute>(API_ROUTES.map((route) => [route.operationId, route]));

/** A path parameter that would leave its route: `.`, `..`, or anything with a slash or a backslash in it. */
export class UnsafePathParameter extends Error {
  constructor(name: string) {
    super(`unsafe path parameter: ${name}`);
    this.name = "UnsafePathParameter";
  }
}

/** The URL of an operation: `{name}` filled from `params` (each value encoded), then the query string. */
export function buildUrl(route: Pick<ApiRoute, "path">, input: ApiInput = {}): string {
  const path = route.path.replace(/\{([A-Za-z]+)\}/gu, (_, name: string) => {
    const value = input.params?.[name];
    if (value === undefined) throw new Error(`missing path parameter: ${name}`);
    // `encodeURIComponent("..")` is `..`, and a browser or proxy would resolve it: refuse what could leave the route.
    if (value === "" || value === "." || value === ".." || /[/\\]/u.test(value)) throw new UnsafePathParameter(name);
    return encodeURIComponent(value);
  });
  const query = Object.entries(input.query ?? {})
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return query ? `${path}?${query}` : path;
}

export async function callApi(operationId: string, input: ApiInput = {}, doFetch: typeof fetch = (url, init) => fetch(url, init)): Promise<ApiResult<unknown>> {
  const route = ROUTES.get(operationId);
  if (!route) throw new Error(`no such operation: ${operationId}`);
  let url: string;
  try {
    url = buildUrl(route, input);
  } catch (error) {
    // An id from the page's own address that cannot be a path segment is a bad request, not a crash.
    if (error instanceof UnsafePathParameter) return { ok: false, status: 0, code: "bad_request" };
    throw error;
  }
  let response: Response;
  try {
    response = await doFetch(url, {
      method: route.method,
      headers: { Accept: "application/json", ...(input.body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, code: "network" };
  }
  if (!response.ok) {
    const parsed = ErrorResponse.safeParse(await response.json().catch(() => null));
    return { ok: false, status: response.status, code: parsed.success ? parsed.data.error.code : `http_${response.status}` };
  }
  if (route.response === null || response.status === 204) return { ok: true, data: null };
  const parsed = route.response.safeParse(await response.json().catch(() => null));
  // A body that does not match its contract is a bug on one side; the page treats it as a failed request.
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, status: response.status, code: "bad_response" };
}

/** The error codes the sheet and the banners map to their own states. */
export const isAgentsUnavailable = (code: string) => code === "agents_unavailable";
export const isInvestigationRunning = (code: string) => code === "investigation_running";
