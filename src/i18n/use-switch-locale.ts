"use client";

import { type Locale } from "next-intl";
import { useTransition } from "react";
import { saveLocalePreferenceAction } from "@/features/settings/actions";
import { useRouter } from "./navigation";
import { stripLocalePrefix } from "./pathname";

/** Change la langue en restant sur la même page, et l'enregistre dans le compte si connecté. */
export function useSwitchLocale() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchLocale(nextLocale: Locale) {
    // L'adresse est lue au clic, pas au rendu : usePathname suspendrait le composant
    // sur les pages à paramètre dynamique (ex. /goals/[id]) avec Cache Components.
    const pathname = stripLocalePrefix(window.location.pathname);
    startTransition(async () => {
      router.replace(pathname, { locale: nextLocale });
      // La langue suit l'utilisateur sur ses autres appareils ; un échec n'empêche pas le changement
      await saveLocalePreferenceAction(nextLocale).catch(() => undefined);
    });
  }

  return { switchLocale, isPending };
}
