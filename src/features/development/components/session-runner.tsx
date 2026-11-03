"use client";

import { ArrowLeft, ArrowRight, Check, CircleCheck, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChallengeOutcome,
  ReplaceMeal,
  SavingsToBudget,
} from "@/features/plan-logs/components/item-follow-up";
import { PracticeTimer } from "@/features/plan-logs/components/practice-timer";
import type { PlanLogControls } from "@/features/plan-logs/components/use-plan-logs";
import {
  breathPatternOf,
  findLog,
  practiceMinutes,
  savingsActionOf,
  type LoggedKind,
} from "@/features/plan-logs/rules";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type RunnerItem = {
  kicker: string | null;
  name: string;
  sub: string | null;
  /** Fiche du catalogue, s'il y en a une. */
  ref: string | null;
  /** Nom complet dans le plan (avec le repas) : c'est lui que le serveur garde. */
  planName: string;
  /** Nom et détail tels qu'écrits dans le plan (durée, rythme, montant). */
  text: string;
};

/** Ce qu'il faut pour cocher les éléments de la séance. */
export type RunnerLogging = {
  kind: LoggedKind;
  /** Le jour où noter : jamais un jour à venir. */
  day: string;
  weekday: number;
  controls: PlanLogControls;
  currency: string;
  /** Durée des fiches du catalogue, pour le minuteur. */
  minutes: Record<string, number>;
};

/** Le geste d'une étape : cocher, puis ce qui est propre au type de plan. */
function StepActions({
  logging,
  item,
  position,
  onNext,
}: {
  logging: RunnerLogging;
  item: RunnerItem;
  position: number;
  onNext: () => void;
}) {
  const t = useTranslations("Development.plan.runner");
  const { kind, day, weekday, controls, currency } = logging;
  const target = { kind, day, weekday, position, name: item.planName };
  const log = findLog(controls.rows, day, weekday, position, item.planName);

  if (!log) {
    return (
      <div className="flex flex-col gap-1">
        <Button
          size="lg"
          className="h-14 w-full rounded-full text-base"
          onClick={() => {
            controls.save(target, {
              done: true,
              replacedBy: null,
              outcome: null,
            });
            // Un défi et un virement ont encore une question : on reste sur l'étape
            const asks =
              kind === "social" ||
              (kind === "financial" && savingsActionOf(item.text) !== null);
            if (!asks) onNext();
          }}
        >
          <Check aria-hidden="true" strokeWidth={3} />
          {t(`action.${kind}`)}
        </Button>
        {kind === "nutrition" ? (
          <ReplaceMeal
            target={target}
            log={null}
            controls={controls}
            onSaved={onNext}
          />
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-semibold text-primary">
          <CircleCheck aria-hidden="true" className="size-5" />
          {t(`doneState.${kind}`)}
        </span>
        <button
          type="button"
          onClick={() =>
            controls.save(target, {
              done: false,
              replacedBy: null,
              outcome: null,
            })
          }
          className="min-h-11 rounded-lg text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("undo")}
        </button>
      </div>
      {kind === "nutrition" ? (
        <ReplaceMeal target={target} log={log} controls={controls} />
      ) : null}
      {kind === "social" ? (
        <ChallengeOutcome
          target={target}
          log={log}
          controls={controls}
          onChosen={onNext}
        />
      ) : null}
      {kind === "financial" ? (
        <SavingsToBudget
          target={target}
          text={item.text}
          log={log}
          currency={currency}
          controls={controls}
        />
      ) : null}
    </div>
  );
}

/**
 * « Commencer » : la séance du jour, un élément à la fois, en plein écran sur
 * téléphone (comme le mode Focus de « Ma journée »). Chaque élément se coche
 * (`logging`) et compte dans la série de son pilier.
 */
export function SessionRunner({
  open,
  onOpenChange,
  title,
  items,
  mediaLabel,
  logging,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: RunnerItem[];
  /** « Voir la démo », « Voir la recette »… ; null sans catalogue. */
  mediaLabel: string | null;
  logging: RunnerLogging | null;
}) {
  const t = useTranslations("Development.plan.runner");
  const [step, setStep] = useState(0);
  const finished = step >= items.length;
  const item = items[Math.min(step, items.length - 1)];
  const isDone = (entry: RunnerItem, index: number) =>
    logging !== null &&
    findLog(
      logging.controls.rows,
      logging.day,
      logging.weekday,
      index,
      entry.planName,
    ) !== null;
  const doneCount = items.filter(isDone).length;
  const allDone = logging === null || doneCount === items.length;
  const next = () => setStep((current) => current + 1);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) setStep(0);
      }}
    >
      <DialogContent
        closeLabel={t("close")}
        className="inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto overscroll-contain rounded-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] ring-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(44rem,calc(100dvh-4rem))] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6 sm:ring-1"
        onClickCapture={(event) => {
          // La fiche s'ouvre dans la page : la séance se ferme
          if (
            event.target instanceof Element &&
            event.target.closest("a[href]")
          ) {
            onOpenChange(false);
          }
        }}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("description")}
        </DialogDescription>

        <div
          role="progressbar"
          aria-label={t("progressLabel")}
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={Math.min(step + 1, items.length)}
          className="mr-12 flex gap-1.5"
        >
          {items.map((entry, index) => (
            <span
              key={`${entry.name}-${index}`}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                (logging ? isDone(entry, index) : index <= step)
                  ? "bg-primary"
                  : index === step
                    ? "bg-primary/40"
                    : "bg-foreground/10",
              )}
            />
          ))}
        </div>

        {finished ? (
          <div
            role="status"
            className="flex flex-1 flex-col items-center justify-center gap-4 text-center"
          >
            {allDone ? (
              <span className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check aria-hidden="true" className="size-9" strokeWidth={3} />
              </span>
            ) : null}
            <p className="font-display text-5xl tracking-wide uppercase">
              {allDone
                ? t("doneTitle")
                : t("partialTitle", { done: doneCount, total: items.length })}
            </p>
            <p className="max-w-xs text-pretty text-muted-foreground">
              {allDone
                ? t("doneText", { title })
                : doneCount > 0
                  ? t("partialText")
                  : t("noneText")}
            </p>
            {logging && doneCount > 0 ? (
              <p className="text-sm font-semibold text-primary">
                {t("doneStreak")}
              </p>
            ) : null}
            <Button
              size="lg"
              className="mt-2 h-12"
              onClick={() => onOpenChange(false)}
            >
              {t("close")}
            </Button>
          </div>
        ) : item ? (
          <>
            <div className="flex flex-1 flex-col justify-center gap-4 py-8">
              <span className="caps-label text-muted-foreground">
                {t("step", { current: step + 1, total: items.length })}
              </span>
              {item.kicker ? (
                <span className="font-display text-3xl tracking-wide text-primary uppercase">
                  {item.kicker}
                </span>
              ) : null}
              <h2 className="font-display text-5xl leading-none tracking-wide text-balance uppercase">
                {item.name}
              </h2>
              {item.sub ? (
                <p className="text-lg text-muted-foreground">{item.sub}</p>
              ) : null}
              {item.ref && mediaLabel ? (
                <Button asChild variant="outline" className="mt-2 h-11 w-fit">
                  <Link href={`/services/library/${item.ref}`}>
                    <Play aria-hidden="true" />
                    {mediaLabel}
                  </Link>
                </Button>
              ) : null}
              {logging?.kind === "mental" ? (
                <PracticeTimer
                  key={step}
                  minutes={
                    practiceMinutes(item.text) ??
                    (item.ref ? (logging.minutes[item.ref] ?? null) : null)
                  }
                  pattern={breathPatternOf(item.text)}
                />
              ) : null}
            </div>
            <div className="flex flex-col gap-3">
              {logging ? (
                <StepActions
                  logging={logging}
                  item={item}
                  position={step}
                  onNext={next}
                />
              ) : null}
              {logging?.controls.error ? (
                <p role="alert" className="text-sm font-medium text-primary">
                  {t(`errors.${logging.controls.error}`)}
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  size="lg"
                  className="h-11"
                  disabled={step === 0}
                  onClick={() => setStep((current) => current - 1)}
                >
                  <ArrowLeft aria-hidden="true" />
                  {t("previous")}
                </Button>
                <Button
                  size="lg"
                  variant={logging ? "ghost" : "default"}
                  className="h-11"
                  onClick={next}
                >
                  {step === items.length - 1 ? t("finish") : t("next")}
                  {step === items.length - 1 ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <ArrowRight aria-hidden="true" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
