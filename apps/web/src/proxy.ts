import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@finora/server/env";
import { guardRequest, securityHeaders } from "@finora/server/guard";
import { routing } from "./i18n/routing.ts";

const handleLocale = createMiddleware(routing);

function withHeaders(response: Response, headers: Record<string, string>): Response {
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
}

/**
 * Runs before every page and API request: refuses a request that does not name this machine,
 * gives each page a fresh CSP nonce, and sends the visitor to a locale-prefixed path.
 */
export function proxy(request: NextRequest): Response {
  const nonce = btoa(crypto.randomUUID());
  const headers = securityHeaders({ nonce, development: getEnv().NODE_ENV === "development" });

  const refused = guardRequest(request);
  if (refused) return withHeaders(refused, headers);

  if (request.nextUrl.pathname.startsWith("/api/")) return withHeaders(NextResponse.next(), headers);

  const forwarded = new Headers(request.headers);
  forwarded.set("content-security-policy", headers["Content-Security-Policy"] as string);
  const response = handleLocale(new NextRequest(request, { headers: forwarded }));
  return withHeaders(response, headers);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\..*).*)"],
};
