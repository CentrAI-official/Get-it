"use client";

import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOffline } from "next/offline";

/**
 * « Pas de connexion » : le réseau est coupé. Les gestes faits pendant ce temps
 * (cocher, aimer, envoyer) attendent et repartent tout seuls au retour du réseau
 * (`experimental.useOffline` dans next.config.ts). Même pastille que le message
 * « Publication enregistrée ».
 */
export function OfflineBanner() {
  const t = useTranslations("Offline");
  const offline = useOffline();
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4rem)] z-40 flex justify-center px-4 lg:top-20"
    >
      {offline ? (
        <p className="flex max-w-full items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm text-background shadow-lg">
          <WifiOff aria-hidden="true" className="size-4 shrink-0" />
          <span className="min-w-0">
            <span className="font-semibold">{t("title")}</span>{" "}
            {t("description")}
          </span>
        </p>
      ) : null}
    </div>
  );
}
