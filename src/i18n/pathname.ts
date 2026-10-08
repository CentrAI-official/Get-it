import { routing } from "./routing";

/** Chemin sans le préfixe de langue : « /fr/goals/42 » → « /goals/42 », « /en » → « / ». */
export function stripLocalePrefix(pathname: string): string {
  const [, first, ...rest] = pathname.split("/");
  if (!routing.locales.some((locale) => locale === first)) return pathname;
  return `/${rest.join("/")}`;
}
