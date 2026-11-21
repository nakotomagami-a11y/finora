import { getCrash } from "../../../../services/markets.ts";

export function GET(): Response {
  return Response.json(getCrash());
}
