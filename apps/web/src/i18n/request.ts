import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, loadMessages } from "@finora/i18n";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
  return { locale, messages: await loadMessages(locale) };
});
