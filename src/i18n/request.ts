import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { routing } from "./routing";

// Fuseau par défaut tant que l'utilisateur n'a pas le sien (voir UserSettings.timeZone)
const DEFAULT_TIME_ZONE = "America/Toronto";

export default getRequestConfig(async ({ locale }) => {
  // La langue vient du segment [locale] : compatible avec le prérendu (Cache Components)
  if (!locale) {
    const paramValue = await rootParams.locale();
    if (hasLocale(routing.locales, paramValue)) {
      locale = paramValue;
    } else {
      notFound();
    }
  }

  return {
    locale,
    timeZone: DEFAULT_TIME_ZONE,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
