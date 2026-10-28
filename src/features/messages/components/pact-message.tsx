"use client";

import { Handshake, LoaderCircle, Share2, Trophy } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { PactCard } from "@/server/messages/pacts";
import {
  cancelPactAction,
  listPactHabitsAction,
  respondPactAction,
} from "../actions";
import type { PactError } from "../pacts";
import type { MessageError } from "../rules";

type PactMessageProps = {
  /** Étape : « proposed », « ended » ou « cancelled ». */
  step: string;
  pact: PactCard;
  /** Prénom de l'autre personne. */
  name: string;
  canWrite: boolean;
  /** Un pacte a changé : la conversation se met à jour. */
  onChanged: () => void;
  /** « Relancer un pacte » depuis la carte de fin. */
  onAgain: () => void;
};

/** Une étape de pacte dans la conversation, affichée selon l'état actuel du pacte. */
export function PactMessage({
  step,
  pact,
  name,
  canWrite,
  onChanged,
  onAgain,
}: PactMessageProps) {
  const t = useTranslations("Messages.pacts.card");
  const format = useFormatter();
  const day = (value: string | null) =>
    value
      ? format.dateTime(toDbDate(value), {
          day: "numeric",
          month: "long",
          timeZone: "UTC",
        })
      : "";

  const pill = (text: string) => (
    <p className="mx-auto my-3 w-fit max-w-full rounded-full bg-foreground/5 px-3 py-1.5 text-center text-xs text-muted-foreground">
      {text}
    </p>
  );

  if (step === "cancelled") return pill(t("cancelled"));
  if (step === "ended") {
    return <PactResult pact={pact} name={name} onAgain={onAgain} />;
  }
  // Proposition : la carte évolue avec le pacte
  if (pact.status === "declined") return pill(t("declined"));
  if (pact.status !== "proposed") {
    return pill(
      t("accepted", { from: day(pact.startsOn), to: day(pact.endsOn) }),
    );
  }
  return pact.proposedByMe ? (
    <WaitingCard pact={pact} name={name} onChanged={onChanged} />
  ) : (
    <ProposalCard
      pact={pact}
      name={name}
      canWrite={canWrite}
      onChanged={onChanged}
    />
  );
}

function Header({ pact, eyebrow }: { pact: PactCard; eyebrow: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
      >
        <Handshake className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-xs text-muted-foreground">{eyebrow}</span>
        <span className="font-heading text-lg font-bold break-words">
          {pact.title}
        </span>
      </div>
    </div>
  );
}

function Chips({ pact }: { pact: PactCard }) {
  const t = useTranslations("Messages.pacts.card");
  return (
    <ul className="flex flex-wrap gap-1.5">
      <li className="rounded-full bg-foreground/6 px-2.5 py-1.5 text-xs tabular-nums">
        {t("days", { days: pact.days })}
      </li>
      <li className="rounded-full bg-foreground/6 px-2.5 py-1.5 text-xs">
        {t("startsTomorrow")}
      </li>
      <li className="rounded-full bg-foreground/6 px-2.5 py-1.5 text-xs">
        {t("rule", { need: pact.need, days: pact.days })}
      </li>
    </ul>
  );
}

function WaitingCard({
  pact,
  name,
  onChanged,
}: Pick<PactMessageProps, "pact" | "name" | "onChanged">) {
  const t = useTranslations("Messages.pacts.card");
  const [pending, startTransition] = useTransition();
  return (
    <article className="my-2 ml-auto flex w-full max-w-sm flex-col gap-3 rounded-3xl border border-primary/30 bg-card p-4">
      <Header pact={pact} eyebrow={t("proposedByMe")} />
      <Chips pact={pact} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {t("waiting", { name })}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              if (await cancelPactAction(pact.id)) onChanged();
            })
          }
        >
          {t("withdraw")}
        </Button>
      </div>
    </article>
  );
}

type Habit = { id: string; title: string; pillar: string };

function ProposalCard({
  pact,
  name,
  canWrite,
  onChanged,
}: Omit<PactMessageProps, "step" | "onAgain">) {
  const t = useTranslations("Messages.pacts.card");
  const tErrors = useTranslations("Messages.errors");
  const tPillars = useTranslations("Pillars");
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [choice, setChoice] = useState<string>("new");
  const [error, setError] = useState<MessageError | PactError | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    void listPactHabitsAction()
      .catch(() => [])
      .then((list) => {
        if (!active) return;
        setHabits(list);
        // Une habitude du même nom est proposée en premier
        const same = list.find(
          (habit) => habit.title.toLowerCase() === pact.title.toLowerCase(),
        );
        if (same) setChoice(same.id);
      });
    return () => {
      active = false;
    };
  }, [pact.title]);

  function respond(accept: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await respondPactAction(
        pact.id,
        accept
          ? {
              accept: true,
              habit:
                choice === "new"
                  ? { kind: "new" }
                  : { kind: "existing", id: choice },
            }
          : { accept: false },
      );
      if (result.ok) onChanged();
      else setError(result.error);
    });
  }

  const options = [
    ...(habits ?? []).map((habit) => ({
      id: habit.id,
      title: habit.title,
      hint: tPillars(`${habit.pillar as "physical"}.name`),
    })),
    {
      id: "new",
      title: t("newHabit", { title: pact.title }),
      hint: t("newHabitHint"),
    },
  ];

  return (
    <article className="my-2 flex w-full max-w-sm flex-col gap-3.5 rounded-3xl border border-primary/35 bg-card p-4 shadow-[0_0_40px_rgba(255,107,0,0.08)]">
      <Header pact={pact} eyebrow={t("proposedToMe", { name })} />
      <Chips pact={pact} />
      {canWrite ? (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{t("linkHabit")}</span>
            {habits === null ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin text-muted-foreground"
              />
            ) : (
              <div
                role="radiogroup"
                aria-label={t("linkHabit")}
                className="flex max-h-44 flex-col gap-1.5 overflow-y-auto"
              >
                {options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={choice === option.id}
                    onClick={() => setChoice(option.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      choice === option.id
                        ? "border-primary bg-primary/10"
                        : "border-foreground/12 bg-foreground/[0.03] hover:bg-foreground/[0.06]",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-4.5 shrink-0 rounded-full",
                        choice === option.id
                          ? "border-5 border-primary"
                          : "border-2 border-foreground/30",
                      )}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold">
                        {option.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {option.hint}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("privacy", { name })}
          </p>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {tErrors(error)}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              disabled={pending || habits === null}
              onClick={() => respond(true)}
              className="h-11 flex-1 rounded-full"
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {t("accept")}
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => respond(false)}
              className="h-11 rounded-full"
            >
              {t("decline")}
            </Button>
          </div>
        </>
      ) : null}
    </article>
  );
}

function PactResult({
  pact,
  name,
  onAgain,
}: Pick<PactMessageProps, "pact" | "name" | "onAgain">) {
  const t = useTranslations("Messages.pacts.card");
  const success = pact.outcome === "success";
  return (
    <article
      className={cn(
        "my-3 flex flex-col items-center gap-4 rounded-3xl border p-5 text-center",
        success
          ? "border-primary/50 bg-[radial-gradient(circle_at_50%_0%,rgba(255,107,0,0.22),var(--card)_65%)] shadow-[0_0_50px_rgba(255,107,0,0.15)]"
          : "border-foreground/10 bg-card",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-16 items-center justify-center rounded-full",
          success
            ? "bg-primary text-primary-foreground glow-primary"
            : "bg-foreground/8 text-muted-foreground",
        )}
      >
        {success ? (
          <Trophy className="size-8" />
        ) : (
          <Handshake className="size-8" />
        )}
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-2xl font-bold">
          {success ? t("successTitle") : t("failedTitle")}
        </h3>
        <p className="text-sm">
          {t("summary", { title: pact.title, days: pact.days, name })}
        </p>
      </div>
      <dl className="grid w-full grid-cols-3 gap-2">
        {[
          { label: t("together"), value: pact.together, accent: true },
          { label: t("you"), value: pact.mine, accent: false },
          { label: name, value: pact.theirs, accent: false },
        ].map((stat) => (
          <div key={stat.label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="truncate text-xs text-muted-foreground">
              {stat.label}
            </dt>
            <dd
              className={cn(
                "font-display text-lg",
                stat.accent && "text-primary",
              )}
            >
              {t("count", { count: stat.value, days: pact.days })}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex w-full flex-col gap-2">
        {success ? (
          <Button asChild className="h-11 rounded-full">
            <Link href={`/community?partager=pact:${pact.id}`}>
              <Share2 aria-hidden="true" />
              {t("share")}
            </Link>
          </Button>
        ) : null}
        <Button
          variant="outline"
          onClick={onAgain}
          className="h-11 rounded-full"
        >
          {t("again")}
        </Button>
      </div>
    </article>
  );
}
