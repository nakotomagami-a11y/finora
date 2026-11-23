// Every v1 route and its schemas (architecture §5.1): the server's route table, the UI's client and
// the OpenAPI document are all checked against this one list.
import { z } from "zod";
import { AboutResponse } from "./about.ts";
import { AgentsStatusResponse } from "./agents.ts";
import { Eid, SectionId } from "./common.ts";
import { DisputeRequest, DisputeResponse } from "./disputes.ts";
import { InvestigationEvent } from "./events.ts";
import { ExportQuery, ExportResponse } from "./export.ts";
import { HealthResponse } from "./health.ts";
import {
  AnswerRequest,
  EstimateRequest,
  EstimateResponse,
  FollowUpRequest,
  FollowUpResponse,
  InvestigationSnapshot,
  LibraryResponse,
  StartRequest,
  StartResponse,
} from "./investigations.ts";
import { CrashResponse } from "./markets.ts";
import { NetworkResponse } from "./network.ts";
import { PurposeRequest, PurposeResponse } from "./purpose.ts";
import { CompanyReport, SectionQuery, SectionResponse } from "./report.ts";
import { LiveRegister, SearchQuery, SearchResponse } from "./search.ts";
import { SettingsStatusResponse, StartupResponse, StartupSetting } from "./settings.ts";
import { SourcesResponse } from "./sources.ts";

export type ApiRoute = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  /** OpenAPI-style path: `{name}` for a parameter. */
  path: string;
  operationId: string;
  params?: z.ZodObject;
  query?: z.ZodType;
  body?: z.ZodType;
  response: z.ZodType | null;
  /** The success status; 204 has no body. */
  status: 200 | 201 | 202 | 204;
  /** `sse` for the event stream, whose items are `response`. */
  stream?: "sse";
};

const id = z.object({ id: z.string().min(1) }).strict();
const eid = z.object({ eid: Eid }).strict();

export const API_ROUTES: readonly ApiRoute[] = [
  { method: "GET", path: "/api/v1/health", operationId: "health", response: HealthResponse, status: 200 },
  { method: "GET", path: "/api/v1/about", operationId: "about", response: AboutResponse, status: 200 },
  { method: "GET", path: "/api/v1/search", operationId: "search", query: SearchQuery, response: SearchResponse, status: 200 },
  { method: "GET", path: "/api/v1/search/live/{register}", operationId: "searchLive", params: z.object({ register: LiveRegister }).strict(), query: SearchQuery.pick({ q: true }), response: SearchResponse, status: 200 },
  { method: "GET", path: "/api/v1/companies/{eid}", operationId: "company", params: eid, response: CompanyReport, status: 200 },
  { method: "GET", path: "/api/v1/companies/{eid}/sections/{section}", operationId: "companySection", params: z.object({ eid: Eid, section: SectionId }).strict(), query: SectionQuery, response: SectionResponse, status: 200 },
  { method: "GET", path: "/api/v1/companies/{eid}/network", operationId: "companyNetwork", params: eid, response: NetworkResponse, status: 200 },
  { method: "GET", path: "/api/v1/companies/{eid}/export", operationId: "companyExport", params: eid, query: ExportQuery, response: ExportResponse, status: 200 },
  { method: "POST", path: "/api/v1/purpose", operationId: "purpose", body: PurposeRequest, response: PurposeResponse, status: 200 },
  { method: "POST", path: "/api/v1/disputes", operationId: "dispute", body: DisputeRequest, response: DisputeResponse, status: 201 },
  { method: "GET", path: "/api/v1/sources", operationId: "sources", response: SourcesResponse, status: 200 },
  { method: "POST", path: "/api/v1/investigations/estimate", operationId: "investigationEstimate", body: EstimateRequest, response: EstimateResponse, status: 200 },
  { method: "POST", path: "/api/v1/investigations", operationId: "investigationStart", body: StartRequest, response: StartResponse, status: 201 },
  { method: "GET", path: "/api/v1/investigations", operationId: "investigationLibrary", response: LibraryResponse, status: 200 },
  { method: "GET", path: "/api/v1/investigations/{id}", operationId: "investigation", params: id, response: InvestigationSnapshot, status: 200 },
  { method: "GET", path: "/api/v1/investigations/{id}/events", operationId: "investigationEvents", params: id, query: z.object({ lastEventId: z.coerce.number().int().nonnegative().optional() }).strict(), response: InvestigationEvent, status: 200, stream: "sse" },
  { method: "POST", path: "/api/v1/investigations/{id}/questions/{qid}/answer", operationId: "investigationAnswer", params: z.object({ id: z.string().min(1), qid: z.string().min(1) }).strict(), body: AnswerRequest, response: null, status: 204 },
  { method: "POST", path: "/api/v1/investigations/{id}/resume", operationId: "investigationResume", params: id, response: null, status: 202 },
  { method: "POST", path: "/api/v1/investigations/{id}/stop", operationId: "investigationStop", params: id, response: null, status: 202 },
  { method: "POST", path: "/api/v1/investigations/{id}/runs/{runId}/rerun", operationId: "investigationRerun", params: z.object({ id: z.string().min(1), runId: z.string().min(1) }).strict(), response: null, status: 202 },
  { method: "POST", path: "/api/v1/investigations/{id}/follow-ups", operationId: "investigationFollowUp", params: id, body: FollowUpRequest, response: FollowUpResponse, status: 200 },
  { method: "DELETE", path: "/api/v1/investigations/{id}", operationId: "investigationDelete", params: id, response: null, status: 204 },
  { method: "GET", path: "/api/v1/markets/crash", operationId: "marketsCrash", response: CrashResponse, status: 200 },
  { method: "GET", path: "/api/v1/settings/status", operationId: "settingsStatus", response: SettingsStatusResponse, status: 200 },
  { method: "GET", path: "/api/v1/settings/startup", operationId: "settingsStartup", response: StartupResponse, status: 200 },
  { method: "PUT", path: "/api/v1/settings/startup", operationId: "settingsStartupUpdate", body: StartupSetting, response: StartupResponse, status: 200 },
  { method: "GET", path: "/api/v1/agents/status", operationId: "agentsStatus", response: AgentsStatusResponse, status: 200 },
];
