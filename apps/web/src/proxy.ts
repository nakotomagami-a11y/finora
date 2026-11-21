import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@finora/server/env";
import { guardRequest, securityHeaders } from "@finora/server/guard";
import { routing } from "./i18n/routing.ts";
import { isLocaleFree } from "./lib/paths.ts";

const handleLocale = createMiddleware(routing);

function withHeaders(response: Response, headers: Record<string, string>): Response {
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
}

/**
 * Runs before every page and API request except Next.js's static files. It refuses a request that does not name
 * this machine, gives each response a fresh CSP nonce, and sends a page request to a locale-prefixed path. A path
 * that is not a page still passes the guard and still gets the headers.
 */
export function proxy(request: NextRequest): Response {
  const nonce = btoa(crypto.randomUUID());
  const headers = securityHeaders({ nonce, development: getEnv().NODE_ENV === "development" });

  const refused = guardRequest(request);
  if (refused) return withHeaders(refused, headers);

  const forwarded = new Headers(request.headers);
  forwarded.set("content-security-policy", headers["Content-Security-Policy"] as string);

  if (isLocaleFree(request.nextUrl.pathname)) {
    return withHeaders(NextResponse.next({ request: { headers: forwarded } }), headers);
  }
  return withHeaders(handleLocale(new NextRequest(request, { headers: forwarded })), headers);
}

// A literal, because Next.js reads it without running the file. Everything except `_next/static` (public build
// files): a dotted path must not skip the guard.
export const config = { matcher: ["/((?!_next/static).*)"] };
