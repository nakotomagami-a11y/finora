import { getAbout } from "../../../services/about.ts";

export function GET(): Response {
  return Response.json(getAbout());
}
