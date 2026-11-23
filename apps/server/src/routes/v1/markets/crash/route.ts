import { getCrash } from "../../../../services/markets.ts";

export function GET(request: Request): Response {
  return Response.json(getCrash({ fetchSite: request.headers.get("sec-fetch-site") }));
}
