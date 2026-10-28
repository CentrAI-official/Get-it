"use client";

import { CircleAlert, CircleCheck, LoaderCircle, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useActionState, useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { XP_REWARDS } from "@/features/xp/rules";
import { saveCheckInAction } from "../actions";
import {
  CHECK_IN_METRICS,
  type CheckInScores,
  type CheckInState,
} from "../schemas";

const SCORES = [1, 2, 3, 4, 5] as const;

/** Check-in du jour : formulaire, puis résumé modifiable une fois enregistré. */
export function CheckInCard({ saved }: { saved: CheckInScores | null }) {
  const t = useTranslations("Today.checkIn");
  const tQuests = useTranslations("Today.quests");
  const [editing, setEditing] = useState(saved === null);

  return (
    <section
      id="check-in"
      aria-labelledby="check-in-title"
      className="flex scroll-mt-24 flex-col gap-4 border-t border-foreground/8 pt-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="check-in-title" className="caps-label text-muted-foreground">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {saved && !editing ? (
              <span className="flex items-center gap-1.5">
                <CircleCheck
                  aria-hidden="true"
                  className="size-4 text-primary"
                />
                {t("done")}
              </span>
            ) : (
              t("question")
            )}
          </p>
        </div>
        {saved && !editing ? (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" />
            {t("edit")}
          </Button>
        ) : saved === null ? (
          // Le premier check-in du jour rapporte de l'XP
          <span className="shrink-0 rounded-lg bg-primary/12 px-2 py-1 text-xs font-bold text-primary tabular-nums">
            {tQuests("xpReward", { xp: XP_REWARDS.checkIn })}
          </span>
        ) : null}
      </div>

      {saved && !editing ? (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CHECK_IN_METRICS.map((metric) => (
            <div
              key={metric}
              className="flex flex-col gap-0.5 rounded-xl bg-foreground/5 px-3 py-2"
            >
              <dt className="text-xs text-muted-foreground">
                {t(`metrics.${metric}`)}
              </dt>
              <dd className="font-display text-lg">
                {t("score", { score: saved[metric] })}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <CheckInForm
          saved={saved}
          onSaved={() => setEditing(false)}
          onCancel={saved ? () => setEditing(false) : undefined}
        />
      )}
    </section>
  );
}

type CheckInFormProps = {
  saved: CheckInScores | null;
  onSaved: () => void;
  onCancel?: () => void;
};

function CheckInForm({ saved, onSaved, onCancel }: CheckInFormProps) {
  const t = useTranslations("Today.checkIn");
  const id = useId();
  // Contrôlées : le formulaire est réinitialisé après chaque envoi
  const [scores, setScores] = useState<Partial<CheckInScores>>(saved ?? {});
  const [state, formAction, pending] = useActionState(
    async (previous: CheckInState, formData: FormData) => {
      const result = await saveCheckInAction(previous, formData);
      if (result.status === "success") onSaved();
      return result;
    },
    { status: "idle" },
  );
  const complete = CHECK_IN_METRICS.every((metric) => scores[metric]);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {CHECK_IN_METRICS.map((metric) => (
        <input
          key={metric}
          type="hidden"
          name={metric}
          value={scores[metric] ?? ""}
        />
      ))}
      {CHECK_IN_METRICS.map((metric) => {
        const labelId = `${id}-${metric}`;
        return (
          <div key={metric} className="flex flex-col gap-2">
            <span id={labelId} className="text-sm font-medium">
              {t(`metrics.${metric}`)}
            </span>
            <RadioGroupPrimitive.Root
              aria-labelledby={labelId}
              orientation="horizontal"
              value={scores[metric]?.toString() ?? ""}
              onValueChange={(value) =>
                setScores((current) => ({
                  ...current,
                  [metric]: Number(value),
                }))
              }
              className="grid max-w-md grid-cols-5 gap-2"
            >
              {SCORES.map((score) => (
                <RadioGroupPrimitive.Item
                  key={score}
                  value={score.toString()}
                  aria-label={t("scoreLabel", {
                    metric: t(`metrics.${metric}`),
                    score,
                  })}
                  className="h-10 rounded-xl border border-foreground/10 bg-foreground/[0.03] font-bold text-muted-foreground tabular-nums transition-colors outline-none hover:bg-foreground/[0.08] hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary/15 data-checked:text-foreground"
                >
                  {score}
                </RadioGroupPrimitive.Item>
              ))}
            </RadioGroupPrimitive.Root>
            <div
              aria-hidden="true"
              className="flex max-w-md justify-between gap-4 text-xs text-muted-foreground"
            >
              <span>{t(`low.${metric}`)}</span>
              <span className="text-right">{t(`high.${metric}`)}</span>
            </div>
          </div>
        );
      })}

      {state.status === "error" && state.error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{t(`errors.${state.error}`)}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={!complete || pending}>
          {pending ? (
            <>
              <LoaderCircle aria-hidden="true" className="animate-spin" />
              {t("saving")}
            </>
          ) : (
            t("save")
          )}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
