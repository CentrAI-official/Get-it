"use client";

import { Handshake, LoaderCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { PactBanner } from "@/server/messages/pacts";
import { cancelPactAction } from "../actions";

type PactDetailDialogProps = {
  pact: PactBanner;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEncourage: () => void;
  onChanged: () => void;
};

/** Le détail d'un pacte : calendrier des jours, scores, encourager ou quitter. */
export function PactDetailDialog({
  pact,
  name,
  open,
  onOpenChange,
  onEncourage,
  onChanged,
}: PactDetailDialogProps) {
  const t = useTranslations("Messages.pacts.detail");
  const format = useFormatter();
  const quitId = useId();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  // Jour du calendrier : formaté en UTC pour ne pas glisser d'un jour
  const date = (day: string, options: { day: "numeric"; month?: "long" }) =>
    format.dateTime(toDbDate(day), { ...options, timeZone: "UTC" });

  function quit() {
    startTransition(async () => {
      if (await cancelPactAction(pact.id)) {
        onOpenChange(false);
        onChanged();
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) setConfirming(false);
      }}
    >
      <DialogContent
        closeLabel={t("close")}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-lg"
      >
        <div className="flex items-center gap-3.5 pr-8">
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground glow-primary"
          >
            <Handshake className="size-7" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <DialogTitle className="break-words">{pact.title}</DialogTitle>
            <DialogDescription>
              {pact.startsOn && pact.endsOn
                ? t("with", {
                    name,
                    from: date(pact.startsOn, {
                      day: "numeric",
                      month: "long",
                    }),
                    to: date(pact.endsOn, { day: "numeric", month: "long" }),
                  })
                : name}
            </DialogDescription>
          </div>
        </div>

        <p className="w-fit rounded-full bg-white/6 px-3 py-1.5 text-xs">
          {t("rule", { need: pact.need, days: pact.days })}
        </p>

        <dl className="grid grid-cols-3 gap-2">
          {[
            { label: t("together"), value: pact.together, accent: true },
            { label: t("you"), value: pact.mine, accent: false },
            { label: name, value: pact.theirs, accent: false },
          ].map((stat) => (
            <div
              key={stat.label}
              className={cn(
                "flex min-w-0 flex-col gap-0.5 rounded-2xl p-3",
                stat.accent
                  ? "border border-primary/30 bg-primary/10"
                  : "bg-white/4",
              )}
            >
              <dt className="truncate text-xs text-muted-foreground">
                {stat.label}
              </dt>
              <dd
                className={cn(
                  "font-mono text-xl font-bold",
                  stat.accent && "text-primary",
                )}
              >
                {t("score", {
                  count: stat.value,
                  days: stat.accent ? pact.days : Math.max(pact.dayIndex, 0),
                })}
              </dd>
            </div>
          ))}
        </dl>

        {pact.cells.length > 0 ? (
          <section className="flex flex-col gap-2.5 rounded-[20px] border border-white/8 bg-card p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">
                {t("calendar", { days: pact.days })}
              </h3>
              <span className="flex gap-2.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full bg-primary"
                  />
                  {t("you")}
                </span>
                <span className="flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full bg-silver"
                  />
                  {name}
                </span>
              </span>
            </div>
            <ol className="grid grid-cols-7 gap-1.5">
              {pact.cells.map((cell) => {
                const label = date(cell.day, { day: "numeric", month: "long" });
                const status =
                  cell.state === "future"
                    ? t("dayFuture", { date: label })
                    : cell.me && cell.them
                      ? t("dayBoth", { date: label })
                      : cell.me
                        ? t("dayMine", { date: label })
                        : cell.them
                          ? t("dayTheirs", { date: label, name })
                          : t("dayNone", { date: label });
                return (
                  <li
                    key={cell.day}
                    aria-label={status}
                    className={cn(
                      "flex h-11 flex-col items-center justify-center gap-1 rounded-xl",
                      cell.me && cell.them
                        ? "bg-primary/12"
                        : cell.state === "future"
                          ? "bg-white/3 text-muted-foreground"
                          : "bg-white/5",
                      cell.state === "today" &&
                        "ring-2 ring-primary ring-inset",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="font-mono text-xs font-bold"
                    >
                      {date(cell.day, { day: "numeric" })}
                    </span>
                    <span aria-hidden="true" className="flex gap-0.5">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          cell.me ? "bg-primary" : "border border-white/25",
                        )}
                      />
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          cell.them ? "bg-silver" : "border border-white/25",
                        )}
                      />
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        <div className="flex flex-col gap-2.5">
          {pact.status === "active" ? (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onEncourage();
              }}
              className="h-11 rounded-full"
            >
              {t("encourage", { name })}
            </Button>
          ) : null}
          {confirming ? (
            <div
              role="alertdialog"
              aria-labelledby={quitId}
              className="flex flex-col gap-2.5 rounded-[18px] border border-destructive/35 bg-destructive/8 p-3.5"
            >
              <p id={quitId} className="font-semibold">
                {t("quitTitle")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("quitDescription", { name })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                  className="flex-1 rounded-full"
                >
                  {t("keep")}
                </Button>
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={quit}
                  className="flex-1 rounded-full"
                >
                  {pending ? (
                    <LoaderCircle aria-hidden="true" className="animate-spin" />
                  ) : null}
                  {t("quitConfirm")}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setConfirming(true)}
              className="h-11 rounded-full text-destructive hover:text-destructive"
            >
              {t("quit")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
