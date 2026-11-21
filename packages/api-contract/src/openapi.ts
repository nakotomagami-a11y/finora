// OpenAPI 3.1 from the Zod schemas (architecture §5.1). `pnpm --filter @finora/api-contract openapi`
// writes docs/api/openapi.json; openapi.test.ts fails while that file is stale.
import { z } from "zod";
import { ErrorResponse } from "./errors.ts";
import { API_ROUTES } from "./routes.ts";

type Json = Record<string, unknown>;

const schema = (s: z.ZodType, io: "input" | "output"): Json => {
  const { $schema: _drop, ...rest } = z.toJSONSchema(s, { io, unrepresentable: "any", target: "draft-2020-12" }) as Json;
  return rest;
};

export function buildOpenApi(version: string): Json {
  const paths: Record<string, Json> = {};
  for (const route of API_ROUTES) {
    const parameters: Json[] = [];
    const objectProps = (s: z.ZodType | undefined) => (s && (schema(s, "input").properties as Record<string, Json> | undefined)) ?? {};
    const required = (s: z.ZodType | undefined) => new Set(((s && (schema(s, "input").required as string[] | undefined)) ?? []) as string[]);
    for (const [name, s] of Object.entries(objectProps(route.params))) parameters.push({ name, in: "path", required: true, schema: s });
    const queryRequired = required(route.query);
    for (const [name, s] of Object.entries(objectProps(route.query))) parameters.push({ name, in: "query", required: queryRequired.has(name), schema: s });
    const success: Json =
      route.response === null
        ? { description: "No content" }
        : route.stream === "sse"
          ? { description: "Server-sent events; each `data:` line is one event", content: { "text/event-stream": { itemSchema: schema(route.response, "output") } } }
          : { description: "OK", content: { "application/json": { schema: schema(route.response, "output") } } };
    const operation: Json = {
      operationId: route.operationId,
      ...(parameters.length ? { parameters } : {}),
      ...(route.body ? { requestBody: { required: true, content: { "application/json": { schema: schema(route.body, "input") } } } } : {}),
      responses: { [String(route.status)]: success, default: { $ref: "#/components/responses/Error" } },
    };
    paths[route.path] = { ...(paths[route.path] ?? {}), [route.method.toLowerCase()]: operation };
  }
  return {
    openapi: "3.1.0",
    info: { title: "Finora API", version, license: { name: "AGPL-3.0-or-later", identifier: "AGPL-3.0-or-later" } },
    servers: [{ url: "http://127.0.0.1:3000" }],
    paths,
    components: { responses: { Error: { description: "Error: a machine code", content: { "application/json": { schema: schema(ErrorResponse, "output") } } } } },
  };
}

export const openApiText = (version: string) => `${JSON.stringify(buildOpenApi(version), null, 2)}\n`;
