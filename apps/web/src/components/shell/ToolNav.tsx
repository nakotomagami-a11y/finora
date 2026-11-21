"use client";

import { Database, Library, Search, Settings, TrendingDown, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "../../i18n/navigation.ts";
import { isActive } from "../../tools/index.ts";
import type { ToolIcon, ToolManifest } from "../../tools/types.ts";

const ICONS: Record<ToolIcon, LucideIcon> = {
  search: Search,
  library: Library,
  crash: TrendingDown,
  sources: Database,
  settings: Settings,
};

type Props = { tools: readonly ToolManifest[]; variant: "rail" | "bar" };

/** The tool rail on screens from 768 px, and the bottom bar below. Both are built from the tool manifests. */
export function ToolNav({ tools, variant }: Props) {
  const t = useTranslations("shell");
  const common = useTranslations("common");
  const pathname = usePathname();
  const main = tools.filter((tool) => tool.placement === "main");
  const bottom = tools.filter((tool) => tool.placement === "bottom");

  const renderItem = (tool: ToolManifest) => {
    const Icon = ICONS[tool.icon];
    const active = isActive(tool, pathname);
    return (
      <li key={tool.id}>
        <Link
          href={tool.href}
          aria-current={active ? "page" : undefined}
          className={[
            "flex flex-col items-center gap-[3px] rounded-btn text-center text-label text-muted no-underline transition-colors",
            "hover:bg-surface hover:text-ink aria-[current=page]:bg-surface-2 aria-[current=page]:text-ink",
            variant === "rail" ? "w-[60px] py-2" : "min-w-14 flex-1 py-2",
          ].join(" ")}
        >
          <Icon aria-hidden className="size-5" strokeWidth={1.75} />
          <span>{t(`tools.${tool.navKey}`)}</span>
        </Link>
      </li>
    );
  };

  if (variant === "rail") {
    return (
      <nav
        aria-label={t("railLabel")}
        className="fixed inset-y-0 left-0 z-30 hidden w-[var(--rail-w)] flex-col items-center gap-1 border-r border-line bg-bg py-4 md:flex"
      >
        <Link
          href="/"
          aria-label={common("appName")}
          className="mb-3 flex h-8 w-10 items-start justify-center font-serif text-[28px] leading-none text-accent no-underline"
        >
          F
        </Link>
        <ul className="m-0 flex list-none flex-col items-center gap-1 p-0">{main.map(renderItem)}</ul>
        <div className="flex-1" />
        <ul className="m-0 flex list-none flex-col items-center gap-1 p-0">{bottom.map(renderItem)}</ul>
      </nav>
    );
  }

  return (
    <nav
      data-bar
      aria-label={t("bottomBarLabel")}
      className="fixed inset-x-0 bottom-0 z-30 h-[calc(var(--bottombar-h)+env(safe-area-inset-bottom))] border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="m-0 flex list-none justify-around gap-1 p-1">{[...main, ...bottom].map(renderItem)}</ul>
    </nav>
  );
}
