import type { ErrorCode } from "@finora/domain";

/** `localhost`, `127.0.0.1` or `[::1]`, with an optional numeric port. Anything else, including a junk port, is refused. */
const LOCAL_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/iu;
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function errorResponse(code: ErrorCode, status: number, detail?: string): Response {
  return Response.json({ error: { code, ...(detail ? { detail } : {}) } }, { status });
}

/**
 * The local-only guard (architecture §12): a page or API call must name this machine in `Host`, and an
 * unsafe request that carries an `Origin` must come from that same host. This stops DNS rebinding and
 * cross-site requests that would spend the key of the person running Finora.
 * Returns a refusal, or null when the request may go on.
 */
export function guardRequest(request: Request): Response | null {
  const host = request.headers.get("host");
  if (!host || !LOCAL_HOST.test(host)) return errorResponse("host_not_allowed", 403);
  if (UNSAFE_METHODS.has(request.method.toUpperCase())) {
    if (request.headers.get("sec-fetch-site") === "cross-site") return errorResponse("forbidden", 403);
    const origin = request.headers.get("origin");
    if (origin !== null) {
      let originHost: string;
      try {
        originHost = new URL(origin).host.toLowerCase();
      } catch {
        return errorResponse("forbidden", 403);
      }
      if (originHost !== host.toLowerCase()) return errorResponse("forbidden", 403);
    }
  }
  return null;
}

export type SecurityHeaderOptions = { nonce: string; development: boolean };

/** The headers every response carries: a nonce-based CSP, no framing, no sniffing, no referrer. */
export function securityHeaders({ nonce, development }: SecurityHeaderOptions): Record<string, string> {
  const scripts = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(development ? ["'unsafe-eval'"] : [])];
  // The nonce also covers the one <style> element Radix adds to lock page scroll under an open dialog.
  const styles = development ? ["'self'", "'unsafe-inline'"] : ["'self'", `'nonce-${nonce}'`];
  const connect = ["'self'", ...(development ? ["ws://127.0.0.1:*", "ws://localhost:*"] : [])];
  const csp = [
    "default-src 'self'",
    `script-src ${scripts.join(" ")}`,
    `style-src ${styles.join(" ")}`,
    // React and Radix place popovers with `style` attributes; style elements still need the nonce.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connect.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  return {
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}
