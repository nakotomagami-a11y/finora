/** Paths that keep their own address: the API, Next.js internals and anything that looks like a file (`.rsc`, `.json`). */
export function isLocaleFree(pathname: string): boolean {
  const last = pathname.split("/").pop() ?? "";
  return pathname.startsWith("/api/") || pathname.startsWith("/_next/") || last.includes(".");
}
