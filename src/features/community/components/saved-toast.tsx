"use client";

import { Bookmark, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Défilement (en pixels) qui fait disparaître le message. */
const DISMISS_SCROLL = 48;

/**
 * Message posé en haut de l'écran après « Enregistrer » (décision du
 * fondateur, 2026-11-08) : le toucher mène aux publications enregistrées ; il
 * disparaît dès qu'on fait défiler, qu'on quitte la page ou qu'on la recharge.
 */
export function SavedToast({
  saved,
  onDismiss,
}: {
  /** null : aucun message ; true : enregistrée ; false : retirée. */
  saved: boolean | null;
  onDismiss: () => void;
}) {
  const t = useTranslations("Community.post");

  useEffect(() => {
    if (saved === null) return;
    const start = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - start) > DISMISS_SCROLL) onDismiss();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [saved, onDismiss]);

  // Page quittée (Next la garde cachée) : le message ne revient pas au retour
  useLayoutEffect(() => onDismiss, [onDismiss]);

  if (saved === null) return null;
  const pill =
    "pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4rem)] z-40 flex justify-center px-4 lg:top-20"
    >
      {saved ? (
        <Link href="/profile/posts?view=saved" className={pill}>
          <Bookmark
            aria-hidden="true"
            className="size-4 shrink-0 fill-current"
          />
          <span className="min-w-0 truncate">{t("savedToast")}</span>
          <span className="shrink-0 font-semibold underline underline-offset-4">
            {t("savedToastLink")}
          </span>
          <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
        </Link>
      ) : (
        <p className={cn(pill, "pointer-events-none")}>
          <Bookmark aria-hidden="true" className="size-4 shrink-0" />
          {t("unsavedNotice")}
        </p>
      )}
    </div>
  );
}
