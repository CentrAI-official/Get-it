"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

type ErrorPageProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

export default function ErrorPage({ error, retry }: ErrorPageProps) {
  const t = useTranslations("Error");

  useEffect(() => {
    // À brancher sur un service de suivi d'erreurs lors du déploiement
    console.error(error);
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
