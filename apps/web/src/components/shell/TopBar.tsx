import { cookies } from "next/headers";
import { THEME_COOKIE, themeFromCookie } from "../../lib/theme.ts";
import { ThemeToggle } from "./ThemeToggle.tsx";

/** The bar above every page. The command bar and the spend pill join it in the explorer slice. */
export async function TopBar() {
  const theme = themeFromCookie((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-end gap-3 border-b border-line bg-bg/90 px-6 py-3 backdrop-blur max-md:px-4">
      <ThemeToggle initial={theme} />
    </header>
  );
}
