import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { enabledTools } from "../../tools/index.ts";
import { Footer } from "./Footer.tsx";
import { ToolNav } from "./ToolNav.tsx";

/** The frame of every page: skip link, tool rail or bottom bar from the manifests, main region, footer. */
export async function AppShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("common");
  const tools = enabledTools();

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-btn focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent"
      >
        {t("skipToContent")}
      </a>
      <ToolNav tools={tools} variant="rail" />
      <div className="flex min-h-screen flex-col pb-[calc(64px+env(safe-area-inset-bottom))] md:ml-[var(--rail-w)] md:pb-0">
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[var(--content-max)] flex-1 px-6 pt-8 pb-18 outline-none">
          {children}
        </main>
        <Footer />
      </div>
      <ToolNav tools={tools} variant="bar" />
    </>
  );
}
