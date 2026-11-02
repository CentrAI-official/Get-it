"use client";

import { CircleAlert, LoaderCircle, Plus, Repeat } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WEEKDAY_DATES } from "@/features/habits/weekdays";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { PlanTarget } from "@/server/development/library";
import { addToPlanAction, replaceInPlanAction } from "../actions";
import { MEALS, type LibraryKind } from "../rules";

type Meal = (typeof MEALS)[number];

const choice =
  "rounded-full border px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const on = "border-primary bg-primary/15 text-foreground";
const off = "border-foreground/10 text-muted-foreground hover:text-foreground";

/**
 * « Ajouter à mon plan » et « Remplacer… » sur la fiche d'un exercice, d'une
 * recette ou d'un outil. Sans plan du bon type : un lien pour le créer.
 */
export function PlanActions({
  itemId,
  kind,
  target,
  planHref,
}: {
  itemId: string;
  kind: LibraryKind;
  target: PlanTarget;
  planHref: `/${string}`;
}) {
  const t = useTranslations("Library.plan");

  if (!target.hasPlan) {
    return (
      <section className="flex flex-col items-start gap-2 rounded-2xl bg-foreground/[0.05] p-4">
        <p className="text-sm">{t(`noPlan.${target.planKind}`)}</p>
        <Button asChild size="sm" variant="outline">
          <Link href={planHref}>{t("createPlan")}</Link>
        </Button>
      </section>
    );
  }
  const replaceable = target.days.some((day) => day.items.length > 0);
  return (
    <section className="flex flex-wrap gap-2">
      <AddDialog
        itemId={itemId}
        kind={kind}
        target={target}
        planHref={planHref}
      />
      {replaceable ? (
        <ReplaceDialog itemId={itemId} target={target} planHref={planHref} />
      ) : null}
    </section>
  );
}

function useDayName() {
  const format = useFormatter();
  return (weekday: number) =>
    format.dateTime(
      WEEKDAY_DATES.find((day) => day.weekday === weekday)?.date ?? new Date(0),
      { weekday: "long", timeZone: "UTC" },
    );
}

function Done({ planHref }: { planHref: `/${string}` }) {
  const t = useTranslations("Library.plan");
  return (
    <div role="status" className="flex flex-col items-start gap-3">
      <p className="font-semibold">{t("done")}</p>
      <Button asChild size="sm">
        <Link href={planHref}>{t("seePlan")}</Link>
      </Button>
    </div>
  );
}

function AddDialog({
  itemId,
  kind,
  target,
  planHref,
}: {
  itemId: string;
  kind: LibraryKind;
  target: PlanTarget;
  planHref: `/${string}`;
}) {
  const t = useTranslations("Library.plan");
  const tMeals = useTranslations("Library.values.meal");
  const tValues = useTranslations("Library.values.allergen");
  const dayName = useDayName();
  const [open, setOpen] = useState(false);
  const [weekday, setWeekday] = useState<number | null>(null);
  const [meal, setMeal] = useState<Meal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const ready = weekday !== null && (kind !== "recipe" || meal !== null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setDone(false);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" />
          {t("add")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addTitle")}</DialogTitle>
          <DialogDescription>{t(`addDescription.${kind}`)}</DialogDescription>
        </DialogHeader>
        {done ? (
          <Done planHref={planHref} />
        ) : (
          <div className="flex flex-col gap-4">
            {target.allergyWarnings.length > 0 ? (
              <Alert variant="destructive">
                <CircleAlert aria-hidden="true" />
                <AlertDescription>
                  {t("allergyWarning", {
                    list: target.allergyWarnings
                      .map((value) => tValues(value as "milk"))
                      .join(", "),
                  })}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("day")}</span>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_DATES.map(({ weekday: value }) => {
                  const session = target.days.find(
                    (day) => day.weekday === value,
                  );
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={weekday === value}
                      onClick={() => setWeekday(value)}
                      className={cn(choice, weekday === value ? on : off)}
                    >
                      {dayName(value)}
                      {session ? (
                        <span className="sr-only">{` (${session.title})`}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {weekday !== null ? (
                <p className="text-xs text-muted-foreground">
                  {target.days.find((day) => day.weekday === weekday)
                    ? t("addToSession", {
                        title:
                          target.days.find((day) => day.weekday === weekday)
                            ?.title ?? "",
                      })
                    : t("newSession")}
                </p>
              ) : null}
            </div>
            {kind === "recipe" ? (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t("meal")}</span>
                <div className="flex flex-wrap gap-2">
                  {MEALS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={meal === value}
                      onClick={() => setMeal(value)}
                      className={cn(choice, meal === value ? on : off)}
                    >
                      {tMeals(value)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                disabled={!ready || pending}
                onClick={() =>
                  startTransition(async () => {
                    if (weekday === null) return;
                    const result = await addToPlanAction({
                      id: itemId,
                      weekday,
                      meal: kind === "recipe" ? meal : null,
                    });
                    if (result.ok) setDone(true);
                    else setError(t(`errors.${result.error}`));
                  })
                }
              >
                {pending ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : null}
                {t("confirmAdd")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReplaceDialog({
  itemId,
  target,
  planHref,
}: {
  itemId: string;
  target: PlanTarget;
  planHref: `/${string}`;
}) {
  const t = useTranslations("Library.plan");
  const dayName = useDayName();
  const [open, setOpen] = useState(false);
  const [choiceKey, setChoiceKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setDone(false);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Repeat aria-hidden="true" />
          {t("replace")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("replaceTitle")}</DialogTitle>
          <DialogDescription>{t("replaceDescription")}</DialogDescription>
        </DialogHeader>
        {done ? (
          <Done planHref={planHref} />
        ) : (
          <div className="flex flex-col gap-4">
            <div role="radiogroup" className="flex flex-col gap-4">
              {target.days
                .filter((day) => day.items.length > 0)
                .map((day) => (
                  <div key={day.weekday} className="flex flex-col gap-1.5">
                    <span className="caps-label text-muted-foreground">
                      {dayName(day.weekday)} · {day.title}
                    </span>
                    {day.items.map((entry) => {
                      const key = `${day.weekday}:${entry.index}`;
                      const selected = choiceKey === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setChoiceKey(key)}
                          className={cn(
                            "rounded-xl border px-3 py-2 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                            selected
                              ? "border-primary bg-primary/10"
                              : "border-foreground/10 hover:bg-foreground/[0.04]",
                          )}
                        >
                          {entry.name}
                        </button>
                      );
                    })}
                  </div>
                ))}
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                disabled={choiceKey === null || pending}
                onClick={() =>
                  startTransition(async () => {
                    if (!choiceKey) return;
                    const [weekday, index] = choiceKey.split(":").map(Number);
                    const result = await replaceInPlanAction({
                      id: itemId,
                      weekday,
                      index,
                    });
                    if (result.ok) setDone(true);
                    else setError(t(`errors.${result.error}`));
                  })
                }
              >
                {pending ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : null}
                {t("confirmReplace")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
