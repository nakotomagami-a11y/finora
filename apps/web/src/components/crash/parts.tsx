"use client";

import { Button, Dialog, Icon, Skeleton } from "@finora/ui";
import type { Locale } from "@finora/i18n";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { asOfText, formatDrawdown, formatMoneyAmount, type RowView } from "./model.ts";

/** The current time, refreshed every `everyMs`: for "Updated N min ago" and the debt estimate. Starts as null on the server. */
export function useNow(everyMs: number): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

export const useLocaleId = (): Locale => useLocale() as Locale;

/** A drop from the peak: an arrow, the signed percentage with a real minus, and the word (visible or for assistive technology). */
export function Drawdown({ pct, word = "hidden", big = false }: { pct: number; word?: "visible" | "hidden"; big?: boolean }) {
  const t = useTranslations("crash");
  const locale = useLocaleId();
  const { text, tiny, atPeak } = formatDrawdown(locale, pct);
  if (atPeak) return <span className="text-ink-2">{t("atPeak")}</span>;
  const shown = tiny ? t("underTenth") : text;
  return (
    <span className={big ? "inline-flex items-center gap-2 text-bad" : "inline-flex items-center gap-1 text-bad"}>
      <Icon name="down" className={big ? "size-6" : "size-3.5"} />
      <span className={big ? "text-[34px] leading-10 font-semibold tracking-[-0.01em] tabular-nums" : "tabular-nums"}>{shown}</span>
      <span className={word === "visible" ? "text-small font-normal text-ink-2" : "sr-only"}>{tiny ? "" : t("fromPeakWord")}</span>
    </span>
  );
}

/** What a row's figure is as of, written for its cadence; a stale row gets the amber "older than its usual refresh" form. */
export function AsOf({ row, now }: { row: RowView; now: Date }) {
  const t = useTranslations("crash");
  const locale = useLocaleId();
  const as = asOfText(locale, row.cadence, row.asOf, now);
  if (as.kind === "none") return null;
  const text = t(`asOf.${as.kind}`, { value: as.text });
  if (row.state === "stale") return <span className="text-warn">{t("stale", { value: as.text })}</span>;
  return <span>{text}</span>;
}

/** A market size in dollars worded for the locale: "≈ $1.2 trillion". Market data, not usage. */
export function useMoney(): (valueUsd: number) => string {
  const t = useTranslations("crash");
  const locale = useLocaleId();
  return (valueUsd) => {
    const { scale, amount } = formatMoneyAmount(locale, valueUsd);
    return t(`money.${scale}`, { amount });
  };
}

export function RowSkeleton({ className = "h-4 w-24" }: { className?: string }) {
  return <Skeleton className={className} />;
}

/** The Retry button of an errored row. A real button with a label, not colour. */
export function RetryButton({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("crash");
  return (
    <button type="button" onClick={onRetry} className="inline-flex min-h-8 items-center text-small text-ink-2 underline decoration-line-strong underline-offset-[3px] hover:text-ink hover:decoration-current">
      {t("retry")}
    </button>
  );
}

/**
 * "How to set it up" for a row or a tile whose provider is not in the local provider file. It opens a dialog that says,
 * in words, what to add and where. Nothing is typed here: Finora takes no key and no secret through the browser.
 */
export function SetupHelp({ codes, onCheck }: { codes: string[]; onCheck: () => void }) {
  const t = useTranslations("crash");
  const locale = useLocaleId();
  const [open, setOpen] = useState(false);
  const list = new Intl.ListFormat(locale === "en" ? "en-GB" : locale, { style: "long", type: "conjunction" }).format(codes);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-8 items-center text-small text-ink-2 underline decoration-line-strong underline-offset-[3px] hover:text-ink hover:decoration-current"
      >
        {t("howToSetUp")}
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("setup.title")}
        description={t("setup.intro")}
        closeLabel={t("setup.close")}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>{t("setup.close")}</Button>
            <Button
              variant="primary"
              data-autofocus
              onClick={() => {
                setOpen(false);
                onCheck();
              }}
            >
              {t("setup.check")}
            </Button>
          </>
        }
      >
        <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 text-body text-ink-2">
          <li>{t("setup.step1")}</li>
          <li>{t("setup.step2", { codes: list })}</li>
          <li>{t("setup.step3")}</li>
        </ol>
        <p className="mt-3 text-small text-muted">{t("setup.private")}</p>
      </Dialog>
    </>
  );
}

/** One line of text with an info icon, for a tile's caveat and attribution lines. The text is plain: never markup. */
export function Caveat({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-start gap-1.5 text-small text-muted">
      <Icon name="info" className="mt-0.5 size-3.5" />
      <span>{children}</span>
    </span>
  );
}
