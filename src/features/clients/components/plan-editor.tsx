"use client";

import { LoaderCircle, Plus, Send, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEVELOPMENT_PLAN_LIMITS } from "@/features/development/plan";
import { useRouter } from "@/i18n/navigation";
import {
  answerProposalAction,
  proposePlanChangeAction,
  withdrawProposalAction,
} from "../actions";
import {
  PROPOSAL_LIMITS,
  type ProposalError,
  type Schedule,
} from "../proposals";
import type { ShareableKind } from "../rules";

type DraftItem = { key: number; name: string; detail: string };
type DraftDay = { on: boolean; title: string; items: DraftItem[] };

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
let nextKey = 1;
const draftItem = (name = "", detail = ""): DraftItem => ({
  key: nextKey++,
  name,
  detail,
});

function ErrorLine({ error }: { error: ProposalError | null }) {
  const t = useTranslations("Clients.proposals.errors");
  return error ? (
    <p role="alert" className="text-sm text-destructive">
      {t(error)}
    </p>
  ) : null;
}

/**
 * Le pro modifie la semaine type d'un plan que son client lui montre. Rien ne
 * change pour le client avant qu'il accepte.
 */
export function PlanEditor({
  clientId,
  clientName,
  kind,
  schedule,
  pending,
}: {
  clientId: string;
  clientName: string;
  kind: ShareableKind;
  schedule: Schedule;
  pending: { id: string; note: string } | null;
}) {
  const t = useTranslations("Clients.proposals");
  const format = useFormatter();
  const router = useRouter();
  const id = useId();
  const [days, setDays] = useState<Record<number, DraftDay>>(() =>
    Object.fromEntries(
      WEEKDAYS.map((weekday) => {
        const session = schedule.find((day) => day.weekday === weekday);
        return [
          weekday,
          {
            on: Boolean(session),
            title: session?.title ?? "",
            items: session
              ? session.items.map((item) => draftItem(item.name, item.detail))
              : [draftItem()],
          },
        ];
      }),
    ),
  );
  const [note, setNote] = useState(pending?.note ?? "");
  const [error, setError] = useState<ProposalError | null>(null);
  const [pendingSend, startTransition] = useTransition();
  const [withdrawing, startWithdraw] = useTransition();

  // 1er janvier 2024 : un lundi
  const dayName = (weekday: number) =>
    format.dateTime(new Date(Date.UTC(2024, 0, weekday)), {
      weekday: "long",
      timeZone: "UTC",
    });
  const update = (weekday: number, change: (day: DraftDay) => DraftDay) =>
    setDays((current) => {
      const day = current[weekday];
      return day ? { ...current, [weekday]: change(day) } : current;
    });

  function send() {
    const scheduleEdit = WEEKDAYS.flatMap((weekday) => {
      const day = days[weekday];
      if (!day?.on) return [];
      return [
        {
          weekday,
          title: day.title,
          items: day.items
            .filter((item) => item.name.trim())
            .map(({ name, detail }) => ({ name, detail })),
        },
      ];
    });
    startTransition(async () => {
      setError(null);
      const result = await proposePlanChangeAction({
        clientId,
        kind,
        schedule: scheduleEdit,
        note,
      }).catch(() => ({ ok: false as const, error: "unexpected" as const }));
      if (result.ok) router.push(`/clients/${clientId}`);
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {pending ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-primary/8 p-4 text-sm">
          <p className="text-pretty">
            {t("pendingNotice", { name: clientName })}
          </p>
          <Button
            variant="outline"
            className="h-10 w-fit"
            disabled={withdrawing}
            onClick={() =>
              startWithdraw(async () => {
                if (await withdrawProposalAction(pending.id)) {
                  router.push(`/clients/${clientId}`);
                }
              })
            }
          >
            {t("withdraw")}
          </Button>
        </div>
      ) : null}

      <ol className="flex flex-col">
        {WEEKDAYS.map((weekday) => {
          const day = days[weekday];
          if (!day) return null;
          return (
            <li
              key={weekday}
              className="flex flex-col gap-3 border-b border-foreground/8 py-4"
            >
              <label
                htmlFor={`${id}-${weekday}-on`}
                className="flex min-h-11 cursor-pointer items-center gap-3"
              >
                <Checkbox
                  id={`${id}-${weekday}-on`}
                  checked={day.on}
                  onCheckedChange={(state) =>
                    update(weekday, (current) => ({
                      ...current,
                      on: state === true,
                    }))
                  }
                />
                <span className="font-semibold capitalize">
                  {dayName(weekday)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {day.on ? t("session") : t("noSession")}
                </span>
              </label>
              {day.on ? (
                <div className="flex flex-col gap-3 pl-7">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`${id}-${weekday}-title`}
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {t("title")}
                    </label>
                    <Input
                      id={`${id}-${weekday}-title`}
                      value={day.title}
                      maxLength={80}
                      onChange={(event) =>
                        update(weekday, (current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <ul className="flex flex-col gap-2">
                    {day.items.map((item, index) => (
                      <li key={item.key} className="flex items-start gap-2">
                        <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-2">
                          <Input
                            aria-label={t("itemName", { number: index + 1 })}
                            value={item.name}
                            maxLength={PROPOSAL_LIMITS.itemName}
                            placeholder={t("itemNamePlaceholder")}
                            onChange={(event) =>
                              update(weekday, (current) => ({
                                ...current,
                                items: current.items.map((entry) =>
                                  entry.key === item.key
                                    ? { ...entry, name: event.target.value }
                                    : entry,
                                ),
                              }))
                            }
                          />
                          <Input
                            aria-label={t("itemDetail", { number: index + 1 })}
                            value={item.detail}
                            maxLength={PROPOSAL_LIMITS.itemDetail}
                            placeholder={t("itemDetailPlaceholder")}
                            onChange={(event) =>
                              update(weekday, (current) => ({
                                ...current,
                                items: current.items.map((entry) =>
                                  entry.key === item.key
                                    ? { ...entry, detail: event.target.value }
                                    : entry,
                                ),
                              }))
                            }
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-lg"
                          aria-label={t("removeItem", { number: index + 1 })}
                          disabled={day.items.length === 1}
                          onClick={() =>
                            update(weekday, (current) => ({
                              ...current,
                              items: current.items.filter(
                                (entry) => entry.key !== item.key,
                              ),
                            }))
                          }
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {day.items.length < DEVELOPMENT_PLAN_LIMITS.itemsPerDay ? (
                    <Button
                      variant="ghost"
                      className="h-10 w-fit text-primary hover:text-primary"
                      onClick={() =>
                        update(weekday, (current) => ({
                          ...current,
                          items: [...current.items, draftItem()],
                        }))
                      }
                    >
                      <Plus aria-hidden="true" />
                      {t("addItem")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-note`} className="text-sm font-medium">
          {t("note", { name: clientName })}
        </label>
        <Textarea
          id={`${id}-note`}
          value={note}
          maxLength={PROPOSAL_LIMITS.note}
          placeholder={t("notePlaceholder")}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <p className="text-xs text-pretty text-muted-foreground">
        {t("sendHint", { name: clientName })}
      </p>
      <ErrorLine error={error} />
      <Button className="h-11 w-fit" disabled={pendingSend} onClick={send}>
        {pendingSend ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <Send aria-hidden="true" />
        )}
        {t("send", { name: clientName })}
      </Button>
    </div>
  );
}

/** Le client accepte (son plan change) ou refuse une modification. */
export function ProposalAnswerButtons({
  proposalId,
  canAccept,
}: {
  proposalId: string;
  canAccept: boolean;
}) {
  const t = useTranslations("Clients.proposals");
  const [error, setError] = useState<ProposalError | null>(null);
  const [pending, startTransition] = useTransition();
  const answer = (accept: boolean) =>
    startTransition(async () => {
      setError(null);
      const result = await answerProposalAction(proposalId, accept).catch(
        () => ({ ok: false as const, error: "unexpected" as const }),
      );
      if (!result.ok) setError(result.error);
    });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {canAccept ? (
          <Button
            className="h-11"
            disabled={pending}
            onClick={() => answer(true)}
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : null}
            {t("accept")}
          </Button>
        ) : null}
        <Button
          variant="outline"
          className="h-11"
          disabled={pending}
          onClick={() => answer(false)}
        >
          {t("decline")}
        </Button>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}
