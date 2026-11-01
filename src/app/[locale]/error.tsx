"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/features/analytics/error-reporter";

type ErrorPageProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

export default function ErrorPage({ error, retry }: ErrorPageProps) {
  const t = useTranslations("Error");

  useEffect(() => {
    console.error(error);
    // Dashboard de l'équipe (message nettoyé par le serveur, sans l'adresse complète)
    reportClientError(error);
  }, [error]);

  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center"
    >
      <h1 className="font-display text-4xl leading-[0.95] uppercase">
        {t("title")}
      </h1>
      <p className="max-w-md text-muted-foreground">{t("description")}</p>
      <Button size="lg" className="mt-2" onClick={() => retry()}>
        {t("retry")}
      </Button>
    </main>
  );
}
