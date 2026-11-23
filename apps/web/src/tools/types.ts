import type { Messages } from "@finora/i18n";

export type ToolIcon = "search" | "library" | "crash" | "sources" | "settings";

/** What a tool tells the shell. Adding a tool means a manifest, a route group, its API routes and its i18n keys. */
export type ToolManifest = {
  id: string;
  /** Key under `shell.tools` in the message catalogues. */
  navKey: keyof Messages["shell"]["tools"];
  /** A locale-free path. */
  href: string;
  icon: ToolIcon;
  /** A tool whose pages are not built yet stays out of the rail. */
  enabled: boolean;
  /** `bottom` tools (Sources, Settings) sit under the spacer of the rail. */
  placement: "main" | "bottom";
};
