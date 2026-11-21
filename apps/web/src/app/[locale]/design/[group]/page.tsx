import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { GROUPS, isGroup } from "../../../../components/gallery/group-list.ts";
import { GalleryGroup } from "../../../../components/gallery/groups.tsx";
import { ThemeFromQuery } from "../../../../components/gallery/ThemeFromQuery.tsx";
import { Link } from "../../../../i18n/navigation.ts";
import { isDemoMode } from "../../../../lib/server-data.ts";

type Props = {
  params: Promise<{ locale: string; group: string }>;
  searchParams: Promise<{ open?: string }>;
};

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { group } = await params;
  return { title: isGroup(group) ? GROUPS[group] : "Design system", robots: { index: false } };
}

export default async function DesignGroup({ params, searchParams }: Props) {
  if (!isDemoMode()) notFound();
  const { locale, group } = await params;
  if (!isGroup(group)) notFound();
  setRequestLocale(locale);
  const { open } = await searchParams;

  return (
    <>
      <Suspense fallback={null}>
        <ThemeFromQuery />
      </Suspense>
      <p className="text-small text-muted">
        <Link href="/design" className="underline">
          Design system
        </Link>
      </p>
      <h1 tabIndex={-1} className="mt-1 font-serif text-h1 text-ink outline-none">
        {GROUPS[group]}
      </h1>
      <div className="mt-6 flex flex-col gap-5">
        <GalleryGroup group={group} open={open} />
      </div>
    </>
  );
}
