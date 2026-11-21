import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { isLocale } from "@finora/i18n";
import { AppShell } from "../../components/shell/AppShell.tsx";
import { CspNonce } from "../../components/shell/CspNonce.tsx";
import { THEME_COOKIE, themeFromCookie } from "../../lib/theme.ts";
import "../globals.css";

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: isLocale(locale) ? locale : "en", namespace: "common" });
  return { title: { default: t("appName"), template: `%s · ${t("appName")}` } };
}

export default async function LocaleLayout({ children, params }: Props) {
  // Every page is rendered per request: the CSP nonce changes with each one, and static HTML cannot carry it.
  await connection();
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const theme = themeFromCookie((await cookies()).get(THEME_COOKIE)?.value);
  const nonce = /'nonce-([^']+)'/u.exec((await headers()).get("content-security-policy") ?? "")?.[1];

  return (
    <html lang={locale} {...(theme === "system" ? {} : { "data-theme": theme })}>
      <body>
        {nonce ? <CspNonce nonce={nonce} /> : null}
        <NextIntlClientProvider>
          <AppShell>{children}</AppShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
