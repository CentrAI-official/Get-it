"use client";

import { LoaderCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clockDate } from "@/lib/dates";
import { completePactPartAction } from "../actions";

type PartTimeDialogProps = {
  pactId: string;
  title: string;
  /** Prénom de l'autre personne (ou nom du groupe). */
  name: string;
  /** Minute actuelle dans mon fuseau, au moment d'ouvrir : l'heure la plus tardive. */
  nowMinute: number;
  /** Fermée, après avoir fait sa part ou non. */
  onClose: () => void;
};

const STEP = 15;

/**
 * « J'ai fait ma part » : on choisit l'heure où c'est fait (aujourd'hui,
 * jamais plus tard que maintenant), puis l'habitude reliée est cochée.
 */
export function PartTimeDialog({
  pactId,
  title,
  name,
  nowMinute,
  onClose,
}: PartTimeDialogProps) {
  const t = useTranslations("Messages.pacts.part");
  const tErrors = useTranslations("Messages.errors");
  const format = useFormatter();
  const id = useId();
  const [minute, setMinute] = useState(nowMinute);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const time = (value: number) =>
    format.dateTime(clockDate(value), {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    });
  const move = (delta: number) =>
    setMinute((value) => Math.min(nowMinute, Math.max(0, value + delta)));

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await completePactPartAction(pactId, minute);
      if (result.ok) onClose();
      else setError(tErrors(result.error));
    });
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { title, name })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <label
            htmlFor={`${id}-time`}
            className="caps-label text-muted-foreground"
          >
            {t("question")}
          </label>
          <output
            htmlFor={`${id}-time`}
            aria-live="polite"
            className="text-center font-display text-7xl leading-none"
          >
            {time(minute)}
          </output>
          <p className="text-center text-sm text-muted-foreground">
            {t("today")}
          </p>
          <input
            id={`${id}-time`}
            type="range"
            min={0}
            max={nowMinute}
            step={5}
            value={minute}
            aria-valuetext={time(minute)}
            onChange={(change) => setMinute(Number(change.target.value))}
            className="h-11 w-full cursor-pointer accent-primary"
          />
          <div
            aria-hidden="true"
            className="-mt-2 flex justify-between text-xs text-muted-foreground"
          >
            <span>{time(0)}</span>
            <span>{t("nowAt", { time: time(nowMinute) })}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full"
              disabled={minute === 0}
              onClick={() => move(-STEP)}
            >
              {t("earlier")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full"
              disabled={minute >= nowMinute}
              onClick={() => move(STEP)}
            >
              {t("later")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full"
              disabled={minute === nowMinute}
              onClick={() => setMinute(nowMinute)}
            >
              {t("now")}
            </Button>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            size="lg"
            disabled={pending}
            onClick={confirm}
            className="mt-1 h-12 rounded-full text-base"
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : null}
            {t("confirm", { time: time(minute) })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
