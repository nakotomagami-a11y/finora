import { ErrorResponse, PurposeResponse } from "@finora/api-contract";

/**
 * The purpose gate's client (architecture §5.1, P2). The purpose is kept by the server in an httpOnly cookie, so
 * this file stores nothing: it asks the server to set the purpose and reads back when that expires. Page code
 * never sees the cookie, and a blocked purpose is refused by the server with `purpose_blocked`.
 */

export type SetPurposeResult = { ok: true; purposeId: PurposeResponse["purposeId"]; expiresAt: string } | { ok: false; code: string };

export async function setPurpose(purposeId: PurposeResponse["purposeId"], doFetch: typeof fetch = (input, init) => fetch(input, init)): Promise<SetPurposeResult> {
  let response: Response;
  try {
    response = await doFetch("/api/v1/purpose", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ purposeId }),
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, code: "network" };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ErrorResponse.safeParse(body);
    return { ok: false, code: error.success ? error.data.error.code : `http_${response.status}` };
  }
  const parsed = PurposeResponse.safeParse(body);
  return parsed.success ? { ok: true, ...parsed.data } : { ok: false, code: "bad_response" };
}

/** Whether a purpose set earlier is still in force at `now`. */
export function purposeInForce(expiresAt: string | null, now: Date): boolean {
  return expiresAt !== null && new Date(expiresAt).getTime() > now.getTime();
}
