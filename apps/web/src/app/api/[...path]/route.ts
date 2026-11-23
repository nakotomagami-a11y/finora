import "server-only";
import { handle } from "@finora/server";

// The one place the HTTP API is mounted in the web app. Everything under /api is the server package's.
export async function GET(request: Request): Promise<Response> {
  return handle(request);
}
export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
export async function PUT(request: Request): Promise<Response> {
  return handle(request);
}
export async function PATCH(request: Request): Promise<Response> {
  return handle(request);
}
export async function DELETE(request: Request): Promise<Response> {
  return handle(request);
}
export async function HEAD(request: Request): Promise<Response> {
  return handle(request);
}
