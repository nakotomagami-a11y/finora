import { crash } from "./crash/manifest.ts";
import { explorer } from "./explorer/manifest.ts";
import { library } from "./library/manifest.ts";
import { settings } from "./settings/manifest.ts";
import { sources } from "./sources/manifest.ts";
import type { ToolManifest } from "./types.ts";

/** In rail order. Library, Sources and Settings switch on in the slices that build their pages. */
export const TOOLS: readonly ToolManifest[] = [explorer, library, crash, sources, settings];

export function enabledTools(tools: readonly ToolManifest[] = TOOLS): ToolManifest[] {
  return tools.filter((tool) => tool.enabled);
}

/** The explorer owns `/` and everything under `/explorer`; every other tool owns its own path. */
export function isActive(tool: ToolManifest, pathname: string): boolean {
  if (tool.id === "explorer") return pathname === "/" || pathname === "/explorer" || pathname.startsWith("/explorer/");
  return pathname === tool.href || pathname.startsWith(`${tool.href}/`);
}
