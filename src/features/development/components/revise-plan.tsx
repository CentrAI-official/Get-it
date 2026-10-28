"use client";

import { CircleAlert, CircleCheck, LoaderCircle, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { revisePlanAction, type GeneratePlanResult } from "../actions";
import { REVISION_MAX_LENGTH } from "../prompts";
import type { DevelopmentKind } from "../questionnaires";

/**
 * « Modifier mon plan » : la personne écrit ce qu'elle veut changer, Get iT AI
 * ajuste le plan et garde le reste.
 */
export function RevisePlan({
  kind,
  onCrisis,
}: {
  kind: DevelopmentKind;
  onCrisis: () => void;
}) {
  const t = useTranslations("Development.revise");
  const tErrors = useTranslations("Development.errors");
  const id = useId();
  const [changes, setChanges] = useState("");
  const [error, setError] = useState<
    Extract<GeneratePlanResult, { ok: false }>["error"] | null
  >(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await revisePlanAction(kind, changes);
      if (result.ok) {
        setChanges("");
        setDone(true);
        return;
      }
      if (result.error === "crisis") onCrisis();
      else setError(result.error);
    });
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
    >
      <div className="flex flex-col gap-1">
        <h3 id={`${id}-title`} className="font-heading text-lg font-bold">
          {t("title")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      {pending ? (
        <p role="status" className="flex items-center gap-2 py-4 text-sm">
          <LoaderCircle
            aria-hidden="true"
            className="size-4 animate-spin text-primary"
          />
          {t("loading")}
        </p>
      ) : (
        <>
          {done ? (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-primary"
            >
              <CircleCheck aria-hidden="true" className="size-4" />
              {t("done")}
            </p>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>
                {error === "invalid" ? t("tooShort") : tErrors(error)}
              </AlertDescription>
            </Alert>
          ) : null}
          <label htmlFor={`${id}-changes`} className="sr-only">
            {t("label")}
          </label>
          <Textarea
            id={`${id}-changes`}
            value={changes}
            onChange={(event) => setChanges(event.target.value)}
            maxLength={REVISION_MAX_LENGTH}
            rows={3}
            placeholder={t(`placeholder.${kind}`)}
          />
          <Button
            className="w-fit"
            disabled={changes.trim().length < 3}
            onClick={submit}
          >
            <Sparkles aria-hidden="true" />
            {t("submit")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("notice")}</p>
        </>
      )}
    </section>
  );
}
