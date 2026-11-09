"use client";

import { Languages, LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { translatePlanAction, type GeneratePlanResult } from "../actions";
import type { PlanLanguage } from "../plan";
import type { DevelopmentKind } from "../questionnaires";

/**
 * Un plan écrit dans l'autre langue (créé avant un changement de langue) :
 * « Traduire ce plan » le fait récrire par Get iT AI, sur demande seulement
 * (décision du fondateur, 2026-11-08 : une demande sur les 20 du jour).
 */
export function TranslatePlan({
  kind,
  language,
}: {
  kind: DevelopmentKind;
  language: PlanLanguage;
}) {
  const t = useTranslations("Development.translate");
  const tErrors = useTranslations("Development.errors");
  const locale = useLocale();
  const [error, setError] = useState<
    Extract<GeneratePlanResult, { ok: false }>["error"] | null
  >(null);
  const [pending, startTransition] = useTransition();
  const target = locale === "en" ? "en" : "fr";
  if (language === target) return null;

  return (
    <section
      aria-label={t("label")}
      className="flex flex-col gap-3 rounded-2xl bg-primary/[0.07] p-4"
    >
      <p className="flex items-start gap-2 text-sm text-pretty">
        <Languages
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-primary"
        />
        {t("notice", { language: t(`languages.${language}`) })}
      </p>
      <Button
        size="sm"
        disabled={pending}
        className="w-fit"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await translatePlanAction(kind, target);
            if (!result.ok) setError(result.error);
          });
        }}
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : null}
        {pending
          ? t("translating")
          : t("action", { language: t(`languages.${target}`) })}
      </Button>
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {tErrors(error)}
        </p>
      ) : null}
    </section>
  );
}
