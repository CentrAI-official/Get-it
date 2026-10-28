"use client";

import { Check, Handshake, LoaderCircle, LogOut } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/server/messages/service";
import type { GroupPactState } from "@/server/messages/group-pacts";
import {
  cancelPactAction,
  listPactHabitsAction,
  respondPactAction,
} from "../actions";
import type { PactError } from "../pacts";
import type { MessageError } from "../rules";

type Habit = { id: string; title: string };

/**
 * Pacte de groupe, en haut de la discussion : les participants et leur
 * avancement, rejoindre (en reliant son habitude), refuser ou quitter.
 */
export function GroupPactPanel({
  pact,
  canWrite,
  onChanged,
}: {
  pact: GroupPactState;
  canWrite: boolean;
  /** Une action a réussi : la discussion se recharge. */
  onChanged: () => void;
}) {
  const t = useTranslations("Messages.groupPact");
  const tErrors = useTranslations("Messages.errors");
  const format = useFormatter();
  const id = useId();
  const [joining, setJoining] = useState(false);
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [choice, setChoice] = useState<string>("new");
  const [error, setError] = useState<MessageError | PactError | null>(null);
  const [pending, startTransition] = useTransition();

  // Habitudes à relier, chargées à l'ouverture du formulaire
  useEffect(() => {
    if (!joining) return;
    let active = true;
    void listPactHabitsAction()
      .catch(() => [])
      .then((list) => {
        if (active) setHabits(list);
      });
    return () => {
      active = false;
    };
  }, [joining]);

  const started = pact.status === "active" && pact.dayIndex > 0;
  const doneToday = pact.participants.filter((p) => p.today).length;
  const day = (value: string) =>
    format.dateTime(toDbDate(value), {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });

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
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setJoining(false);
      onChanged();
    });
  }

  function leave() {
    setError(null);
    startTransition(async () => {
      if (await cancelPactAction(pact.id)) onChanged();
      else setError("unexpected");
    });
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex shrink-0 flex-col gap-3 border-b border-foreground/5 bg-primary/[0.06] px-4 py-3 sm:px-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Handshake aria-hidden="true" className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={`${id}-title`} className="font-semibold break-words">
            {pact.title}
          </h2>
          <p className="text-xs text-muted-foreground">
            {started
              ? t("day", { day: pact.dayIndex, days: pact.days })
              : pact.startsOn
                ? t("startsOn", { date: day(pact.startsOn) })
                : t("proposedBy", { name: pact.proposerName })}
            {" · "}
            {t("need", { need: pact.need, days: pact.days })}
          </p>
        </div>
      </div>

      {pact.participants.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <ul className="flex flex-wrap gap-2" aria-label={t("participants")}>
            {pact.participants.map((person) => (
              <li
                key={person.id}
                className="flex items-center gap-1.5 rounded-full bg-foreground/[0.06] py-1 pr-2.5 pl-1 text-xs"
              >
                <span className="relative">
                  <Avatar
                    name={person.name}
                    url={person.avatarUrl}
                    className="size-6 text-[10px]"
                  />
                  {started && person.today ? (
                    <span className="absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check
                        aria-hidden="true"
                        className="size-2.5"
                        strokeWidth={3}
                      />
                    </span>
                  ) : null}
                </span>
                <span className="max-w-24 truncate font-medium">
                  {person.name}
                </span>
                {started ? (
                  <span className="text-muted-foreground tabular-nums">
                    {t("count", { count: person.count, need: pact.need })}
                  </span>
                ) : null}
                {started && person.today ? (
                  <span className="sr-only">{t("doneToday")}</span>
                ) : null}
              </li>
            ))}
          </ul>
          {started ? (
            <p className="text-xs text-muted-foreground">
              {t("todaySummary", {
                done: doneToday,
                total: pact.participants.length,
              })}
            </p>
          ) : null}
          {pact.myHabitMissing ? (
            <p className="text-xs text-destructive">{t("habitMissing")}</p>
          ) : null}
        </div>
      ) : null}

      {canWrite && pact.canJoin && joining ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-habit`} className="text-sm font-medium">
            {t("habit")}
          </label>
          <select
            id={`${id}-habit`}
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            disabled={habits === null}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="new">{t("newHabit", { title: pact.title })}</option>
            {(habits ?? []).map((habit) => (
              <option key={habit.id} value={habit.id}>
                {habit.title}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{t("privacy")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => respond(true)}
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {t("confirmJoin")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setJoining(false)}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && pact.canJoin ? (
            <>
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => setJoining(true)}
              >
                {t("join")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => respond(false)}
              >
                {t("decline")}
              </Button>
            </>
          ) : null}
          {pact.me === "joined" ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={leave}
              className={cn("text-muted-foreground")}
            >
              <LogOut aria-hidden="true" />
              {pact.proposedByMe && pact.status === "proposed"
                ? t("withdraw")
                : t("leave")}
            </Button>
          ) : null}
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {tErrors(error)}
        </p>
      ) : null}
    </section>
  );
}

/** Étape d'un pacte dans la discussion de groupe : une ligne au centre. */
export function GroupPactNote({
  message,
  name,
}: {
  message: ChatMessage;
  name: string;
}) {
  const t = useTranslations("Messages.groupPact");
  const title = message.pact?.title ?? "";
  const text =
    message.body === "proposed"
      ? message.mine
        ? t("noteProposedByMe", { title })
        : t("noteProposed", { name, title })
      : message.body === "ended"
        ? message.pact?.outcome === "success"
          ? t("noteSuccess", { title })
          : t("noteFailed", { title })
        : t("noteCancelled");
  return (
    <p className="my-3 flex items-center justify-center gap-1.5 px-6 text-center text-xs font-medium text-muted-foreground">
      <Handshake
        aria-hidden="true"
        className="size-3.5 shrink-0 text-primary"
      />
      {text}
    </p>
  );
}
