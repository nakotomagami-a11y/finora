import type { ErrorCode } from "@finora/domain";

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function hostName(hostHeader: string): string {
  const withoutPort = hostHeader.startsWith("[")
    ? hostHeader.slice(0, hostHeader.indexOf("]") + 1)
    : (hostHeader.split(":")[0] ?? "");
  return withoutPort.toLowerCase();
}

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
  if (!host || !ALLOWED_HOSTS.has(hostName(host))) return errorResponse("host_not_allowed", 403);
  if (UNSAFE_METHODS.has(request.method.toUpperCase())) {
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
    "Cross-Origin-Opener-Policy": "same-origin",
  };
}
