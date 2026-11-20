import { getHealth } from "../../../services/health.ts";

export function GET(): Response {
  return Response.json(getHealth());
}
