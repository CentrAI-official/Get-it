"use client";

import { Check, LoaderCircle, Trash2, Trophy } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toDisplayWeight, type WeightUnit, type WorkoutRecord } from "../rules";

/** « 62,5 kg » dans l'unité de la personne. */
export function useWeightLabel(unit: WeightUnit) {
  const t = useTranslations("Workouts.units");
  const format = useFormatter();
  return (grams: number) =>
    `${format.number(toDisplayWeight(grams, unit), {
      maximumFractionDigits: 2,
    })} ${t(unit)}`;
}

/** La fin de la séance : durée, séries, volume, records et ressenti. */
export function WorkoutSummary({
  title,
  minutes,
  doneSets,
  totalSets,
  volumeGrams,
  records,
  feeling,
  unit,
  pending,
  offline,
  canContinue,
  onClose,
  onContinue,
  onDelete,
}: {
  title: string;
  minutes: number;
  doneSets: number;
  totalSets: number;
  volumeGrams: number;
  records: readonly WorkoutRecord[];
  feeling: number | null;
  unit: WeightUnit;
  /** Pas encore reçu par le serveur. */
  pending: boolean;
  /** Le dernier envoi a échoué : la séance attend le réseau. */
  offline: boolean;
  canContinue: boolean;
  onClose: () => void;
  onContinue: () => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}) {
  const t = useTranslations("Workouts.summary");
  const tUnits = useTranslations("Workouts.units");
  const tFeelings = useTranslations("Workouts.feelings");
  const format = useFormatter();
  const weight = useWeightLabel(unit);
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, startTransition] = useTransition();

  // Anton n'a pas l'espace fine des milliers : espace insécable
  const volume = format
    .number(Math.round(toDisplayWeight(volumeGrams, unit)))
    .replace(/ /g, " ");
  const tiles = [
    { label: t("duration"), value: t("minutes", { count: minutes }) },
    {
      label: t("sets"),
      value: t("setsValue", { done: doneSets, total: totalSets }),
    },
    { label: t("volume"), value: `${volume} ${tUnits(unit)}` },
  ];

  function run(action: () => Promise<boolean>) {
    setFailed(false);
    startTransition(async () => {
      try {
        if (!(await action())) setFailed(true);
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pt-8">
      <div
        role="status"
        className="flex flex-col items-center gap-3 text-center"
      >
        <span className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check aria-hidden="true" className="size-9" strokeWidth={3} />
        </span>
        <h2 className="font-display text-5xl tracking-wide uppercase">
          {t("title")}
        </h2>
        <p className="text-muted-foreground">{title}</p>
      </div>

      <dl className="grid grid-cols-3 gap-2 border-y border-foreground/8 py-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="flex min-w-0 flex-col items-center gap-1 text-center"
          >
            <dt className="text-xs text-muted-foreground">{tile.label}</dt>
            <dd className="font-display text-2xl leading-tight tabular-nums">
              {tile.value}
            </dd>
          </div>
        ))}
      </dl>

      {records.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="caps-label text-muted-foreground">{t("records")}</h3>
          <ul className="flex flex-col gap-2">
            {records.map((record) => (
              <li
                key={record.exercise}
                className="flex items-center gap-3 rounded-2xl bg-primary/10 p-3"
              >
                <Trophy
                  aria-hidden="true"
                  className="size-5 shrink-0 text-primary"
                />
                <span className="min-w-0 text-sm font-semibold">
                  {record.exercise}
                  <span className="block font-normal text-muted-foreground">
                    {record.weightGrams
                      ? t("recordWeight", {
                          weight: weight(record.weightGrams),
                          reps: record.reps ?? 0,
                        })
                      : record.reps
                        ? t("recordReps", { reps: record.reps })
                        : t("recordTime", { seconds: record.seconds ?? 0 })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {feeling ? (
        <p className="text-center text-sm text-muted-foreground">
          {t("feeling", { feeling: tFeelings(String(feeling) as "1") })}
        </p>
      ) : null}
      {pending && offline ? (
        <p role="status" className="text-center text-sm text-muted-foreground">
          {t("pending")}
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {t("failed")}
        </p>
      ) : null}

      <div className="mt-auto flex flex-col gap-2">
        <Button size="lg" className="h-14 text-base" onClick={onClose}>
          {t("close")}
        </Button>
        {canContinue ? (
          <Button
            variant="outline"
            size="lg"
            className="h-12"
            disabled={busy || pending}
            onClick={() => run(onContinue)}
          >
            {busy ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : null}
            {t("continue")}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          className="h-11 text-muted-foreground"
          disabled={busy || pending}
          onClick={() => setConfirming(true)}
        >
          <Trash2 aria-hidden="true" />
          {t("delete")}
        </Button>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => run(onDelete)}
            >
              {t("deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
