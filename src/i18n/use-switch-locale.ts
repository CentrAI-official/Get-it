"use client";

import { type Locale } from "next-intl";
import { useTransition } from "react";
import { saveLocalePreferenceAction } from "@/features/settings/actions";
import { usePathname, useRouter } from "./navigation";

/** Change la langue en restant sur la même page, et l'enregistre dans le compte si connecté. */
export function useSwitchLocale() {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchLocale(nextLocale: Locale) {
    startTransition(async () => {
      router.replace(pathname, { locale: nextLocale });
      // La langue suit l'utilisateur sur ses autres appareils ; un échec n'empêche pas le changement
      await saveLocalePreferenceAction(nextLocale).catch(() => undefined);
    });
  }

  return { switchLocale, isPending };
}
