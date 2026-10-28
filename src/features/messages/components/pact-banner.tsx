"use client";

import { Check, ChevronRight, Flame, Handshake } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { openDayPanel } from "@/features/today/day-panel-store";
import { cn } from "@/lib/utils";
import type { PactBanner as PactBannerData } from "@/server/messages/pacts";
import { PactDetailDialog } from "./pact-detail-dialog";

type PactBannerProps = {
  pact: PactBannerData;
  /** Prénom de l'autre personne. */
  name: string;
  timeZone: string;
  onEncourage: () => void;
  /** Le pacte a été quitté : la conversation se met à jour. */
  onChanged: () => void;
};

/** Bandeau du pacte en cours, en haut de la conversation. */
export function PactBanner({
  pact,
  name,
  timeZone,
  onEncourage,
  onChanged,
}: PactBannerProps) {
  const t = useTranslations("Messages.pacts.banner");
  const format = useFormatter();
  const [detail, setDetail] = useState(false);
  const started = pact.dayIndex > 0;
  const bothDone = pact.meToday && pact.themToday;

  return (
    <section
      aria-label={t("label")}
      className={cn(
        "mx-3 mt-2.5 flex shrink-0 flex-col gap-3 rounded-[22px] border p-3.5 sm:mx-5",
        bothDone
          ? "border-primary/55 bg-[linear-gradient(160deg,rgba(255,107,0,0.16),var(--card)_60%)] shadow-[0_0_36px_rgba(255,107,0,0.15)]"
          : "border-primary/30 bg-card",
      )}
    >
      <button
        type="button"
        onClick={() => setDetail(true)}
        className="flex items-center gap-2.5 rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-8.5 shrink-0 items-center justify-center rounded-full",
            bothDone
              ? "bg-primary text-primary-foreground"
              : "bg-primary/15 text-primary",
          )}
        >
          <Handshake className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1 truncate font-bold">{pact.title}</span>
        <span className="shrink-0 text-[0.8rem] font-bold text-primary tabular-nums">
          {started
            ? t("day", { day: pact.dayIndex, days: pact.days })
            : t("startsTomorrow")}
        </span>
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
        <span className="sr-only">{t("details")}</span>
      </button>

      {started ? (
        <>
          <div
            aria-hidden="true"
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${pact.days}, minmax(0, 1fr))`,
            }}
          >
            {pact.cells.map((cell) => (
              <span
                key={cell.day}
                className={cn(
                  "h-2 rounded-full",
                  cell.me && cell.them
                    ? "bg-primary"
                    : cell.state === "future"
                      ? "bg-foreground/8"
                      : cell.me || cell.them
                        ? "bg-[linear-gradient(90deg,color-mix(in_oklab,var(--primary)_50%,transparent)_50%,color-mix(in_oklab,var(--foreground)_12%,transparent)_50%)]"
                        : "bg-foreground/12",
                )}
              />
            ))}
          </div>

          {bothDone ? (
            <p
              role="status"
              className="flex items-center gap-2.5 text-sm font-semibold"
            >
              <span aria-hidden="true" className="flex">
                {[0, 1].map((index) => (
                  <span
                    key={index}
                    className={cn(
                      "flex size-6.5 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground",
                      index === 1 && "-ml-2",
                    )}
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                ))}
              </span>
              {t("bothDone")}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Status
                label={t("you")}
                done={pact.meToday}
                detail={pact.meToday ? t("done") : t("notYet")}
              />
              <Status
                label={name}
                done={pact.themToday}
                detail={
                  pact.themToday
                    ? pact.themTodayAt
                      ? t("doneAt", {
                          time: format.dateTime(new Date(pact.themTodayAt), {
                            hour: "numeric",
                            minute: "2-digit",
                            timeZone,
                          }),
                        })
                      : t("done")
                    : t("notYet")
                }
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[0.8rem]">
              <Flame aria-hidden="true" className="size-4 text-primary" />
              {t.rich("streak", {
                count: pact.streak,
                strong: (chunks) => (
                  <strong className="tabular-nums">{chunks}</strong>
                ),
              })}
            </span>
            {!pact.meToday ? (
              <button
                type="button"
                onClick={() => openDayPanel()}
                className="h-9 rounded-full bg-primary px-3.5 text-[0.8rem] font-bold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {t("doMyPart")}
              </button>
            ) : !pact.themToday ? (
              <button
                type="button"
                onClick={onEncourage}
                className="h-9 rounded-full border border-foreground/15 px-3.5 text-[0.8rem] font-semibold outline-none hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {t("encourage", { name })}
              </button>
            ) : null}
          </div>
          {pact.myHabitMissing ? (
            <p className="text-xs text-destructive">{t("habitMissing")}</p>
          ) : null}
        </>
      ) : null}

      <PactDetailDialog
        pact={pact}
        name={name}
        open={detail}
        onOpenChange={setDetail}
        onEncourage={onEncourage}
        onChanged={onChanged}
      />
    </section>
  );
}

function Status({
  label,
  done,
  detail,
}: {
  label: string;
  done: boolean;
  detail: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-[14px] px-2.5 py-2",
        done ? "bg-primary/10" : "bg-foreground/4",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5.5 shrink-0 items-center justify-center rounded-full",
          done
            ? "bg-primary text-primary-foreground"
            : "border-2 border-dashed border-foreground/35",
        )}
      >
        {done ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[0.8rem] font-semibold">{label}</span>
        <span className="truncate text-[0.7rem] text-muted-foreground">
          {detail}
        </span>
      </span>
    </div>
  );
}
