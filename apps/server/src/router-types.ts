export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RouteContext = { params: Promise<Record<string, string>> };

export type RouteHandler = (request: Request, context: RouteContext) => Response | Promise<Response>;

export type RouteModule = Partial<Record<HttpMethod, RouteHandler>>;

export type RouteEntry = { pattern: string; module: RouteModule };
