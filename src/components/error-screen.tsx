"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/features/analytics/error-reporter";
import { isOutdated, reloadOnce } from "@/lib/outdated";
import { cn } from "@/lib/utils";

type ErrorKind = "update" | "offline" | "other";

/** Ce qui a cassé : une version plus récente est en ligne, le réseau, ou autre chose. */
function kindOf(error: Error): ErrorKind {
  if (isOutdated(error)) return "update";
  const { name, message } = error;
  if (
    name === "TypeError" &&
    /fetch|Load failed|NetworkError|network/i.test(message)
  ) {
    return "offline";
  }
  return "other";
}

/**
 * L'écran d'erreur. Une nouvelle version en ligne recharge la page toute seule ;
 * une coupure de réseau le dit ; le reste est signalé à l'équipe (message
 * nettoyé par le serveur).
 */
export function ErrorScreen({
  error,
  retry,
  fullScreen,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  /** Hors de l'application (site public, connexion) : la page entière. */
  fullScreen?: boolean;
}) {
  const t = useTranslations("Error");
  const kind = kindOf(error);

  useEffect(() => {
    if (kind === "update" && reloadOnce()) return;
    console.error(error);
    if (kind === "other") reportClientError(error);
  }, [error, kind]);

  const Wrapper = fullScreen ? "main" : "div";
  return (
    <Wrapper
      id={fullScreen ? "main" : undefined}
      className={cn(
        "flex flex-col items-center justify-center gap-5 px-4 text-center",
        fullScreen ? "min-h-dvh" : "min-h-[60dvh]",
      )}
    >
      {kind === "offline" ? (
        <WifiOff aria-hidden="true" className="size-8 text-primary" />
      ) : kind === "update" ? (
        <RefreshCw aria-hidden="true" className="size-8 text-primary" />
      ) : null}
      <h1 className="font-display text-4xl leading-[0.95] uppercase">
        {t(`${kind}.title`)}
      </h1>
      <p className="max-w-md text-pretty text-muted-foreground">
        {t(`${kind}.description`)}
      </p>
      <Button
        size="lg"
        className="mt-2"
        onClick={() => (kind === "update" ? window.location.reload() : retry())}
      >
        {t(kind === "update" ? "reload" : "retry")}
      </Button>
    </Wrapper>
  );
}
