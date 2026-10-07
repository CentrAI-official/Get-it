"use client";

import { type Locale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "./navigation";

/** Change la langue en restant sur la même page. */
export function useSwitchLocale() {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchLocale(nextLocale: Locale) {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return { switchLocale, isPending };
}
