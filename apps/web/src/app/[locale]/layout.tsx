import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { isLocale } from "@finora/i18n";
import { AppShell } from "../../components/shell/AppShell.tsx";
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

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <AppShell>{children}</AppShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
