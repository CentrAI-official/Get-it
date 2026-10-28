"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { listPactHabitsAction, proposePactAction } from "../actions";
import {
  PACT_DURATIONS,
  PACT_RULES,
  PACT_TITLE_MAX_LENGTH,
  pactNeed,
  type PactError,
  type PactRule,
} from "../pacts";
import type { MessageError } from "../rules";

type ProposePactDialogProps = {
  conversationId: string;
  /** Prénom de l'autre personne. */
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Proposition envoyée : la conversation se met à jour. */
  onProposed: () => void;
};

const chip =
  "h-11 flex-1 rounded-full border text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const chipOn = "border-primary bg-primary/15 text-foreground";
const chipOff =
  "border-foreground/12 bg-foreground/[0.03] text-muted-foreground hover:text-foreground";

/** Proposer un pacte : le défi, la durée, son habitude et la règle de réussite. */
export function ProposePactDialog({
  conversationId,
  name,
  open,
  onOpenChange,
  onProposed,
}: ProposePactDialogProps) {
  const t = useTranslations("Messages.pacts");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("close")}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-lg"
      >
        <div className="flex flex-col gap-1 pr-8">
          <DialogTitle>{t("proposeTitle", { name })}</DialogTitle>
          <DialogDescription>{t("proposeDescription")}</DialogDescription>
        </div>
        {/* Monté à chaque ouverture : formulaire et habitudes à jour */}
        <ProposeForm
          conversationId={conversationId}
          name={name}
          onProposed={() => {
            onOpenChange(false);
            onProposed();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

type Habit = { id: string; title: string; pillar: string };

function ProposeForm({
  conversationId,
  name,
  onProposed,
}: Pick<ProposePactDialogProps, "conversationId" | "name" | "onProposed">) {
  const t = useTranslations("Messages.pacts");
  const tErrors = useTranslations("Messages.errors");
  const tPillars = useTranslations("Pillars");
  const id = useId();
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [habitId, setHabitId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [days, setDays] = useState<(typeof PACT_DURATIONS)[number]>(14);
  const [rule, setRule] = useState<PactRule>("most");
  const [error, setError] = useState<MessageError | PactError | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    void listPactHabitsAction()
      .catch(() => [])
      .then((list) => {
        if (!active) return;
        setHabits(list);
        // Première habitude choisie, et son nom proposé comme défi
        const first = list[0];
        if (first) {
          setHabitId(first.id);
          // Sans écraser ce que l'utilisateur a déjà tapé
          setTitle(
            (current) => current || first.title.slice(0, PACT_TITLE_MAX_LENGTH),
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await proposePactAction(conversationId, {
        title,
        days,
        rule,
        habitId: habitId ?? "",
      });
      if (result.ok) onProposed();
      else setError(result.error);
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-title`} className="text-sm font-semibold">
          {t("challenge")}
        </label>
        <Input
          id={`${id}-title`}
          value={title}
          maxLength={PACT_TITLE_MAX_LENGTH}
          placeholder={t("challengePlaceholder")}
          onChange={(event) => setTitle(event.target.value)}
          className="h-11 rounded-2xl"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span id={`${id}-days`} className="text-sm font-semibold">
          {t("duration")}
        </span>
        <div
          role="radiogroup"
          aria-labelledby={`${id}-days`}
          className="flex gap-2"
        >
          {PACT_DURATIONS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={days === value}
              onClick={() => setDays(value)}
              className={cn(chip, days === value ? chipOn : chipOff)}
            >
              {t("days", { count: value })}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span id={`${id}-habit`} className="text-sm font-semibold">
          {t("habit")}
        </span>
        {habits === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            {t("loading")}
          </p>
        ) : habits.length === 0 ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">{t("noHabits")}</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/habits/new">{t("createHabit")}</Link>
            </Button>
          </div>
        ) : (
          <div
            role="radiogroup"
            aria-labelledby={`${id}-habit`}
            className="flex max-h-48 flex-col gap-2 overflow-y-auto"
          >
            {habits.map((habit) => (
              <button
                key={habit.id}
                type="button"
                role="radio"
                aria-checked={habitId === habit.id}
                onClick={() => setHabitId(habit.id)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  habitId === habit.id
                    ? "border-primary bg-primary/10"
                    : "border-foreground/12 bg-foreground/[0.03] hover:bg-foreground/[0.06]",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-4.5 shrink-0 rounded-full",
                    habitId === habit.id
                      ? "border-5 border-primary"
                      : "border-2 border-foreground/30",
                  )}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{habit.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {tPillars(`${habit.pillar as "physical"}.name`)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {t("habitHelp", { name })}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span id={`${id}-rule`} className="text-sm font-semibold">
          {t("rule")}
        </span>
        <div
          role="radiogroup"
          aria-labelledby={`${id}-rule`}
          className="grid grid-cols-2 gap-2"
        >
          {PACT_RULES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rule === value}
              onClick={() => setRule(value)}
              className={cn(
                "flex flex-col gap-0.5 rounded-2xl border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                rule === value
                  ? "border-primary bg-primary/10"
                  : "border-foreground/12 bg-foreground/[0.03] hover:bg-foreground/[0.06]",
              )}
            >
              <span className="text-sm font-semibold">
                {t(`rules.${value}`)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t(`rules.${value}Hint`)}
              </span>
            </button>
          ))}
        </div>
        <p className="text-sm">
          {t.rich("need", {
            need: pactNeed(days, rule),
            days,
            strong: (chunks) => (
              <strong className="text-primary tabular-nums">{chunks}</strong>
            ),
          })}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("startsTomorrow", { name })}
      </p>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {tErrors(error)}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pending || !habitId}
        className="h-12 rounded-full"
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <Send aria-hidden="true" />
        )}
        {t("send")}
      </Button>
    </form>
  );
}
