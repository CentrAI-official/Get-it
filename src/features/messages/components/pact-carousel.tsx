"use client";

import { Check, ChevronRight, Flame } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Link } from "@/i18n/navigation";
import { clockDate, minuteOfDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { InboxPact } from "@/server/messages/pacts";
import { PartTimeDialog } from "./part-time-dialog";

type PactCarouselProps = {
  pacts: InboxPact[];
  /** Minute actuelle dans mon fuseau, au chargement (trait « maintenant »). */
  nowMinute: number;
  timeZone: string;
};

/** La ligne de la journée va de 6 h à 22 h. */
const DAY_START = 6 * 60;
const DAY_END = 22 * 60;
const GAP = 12;

const share = (minute: number) =>
  Math.min(1, Math.max(0, (minute - DAY_START) / (DAY_END - DAY_START)));

/**
 * Pactes en cours, en haut de la Messagerie : « Pacte en cours » et le jour
 * (x/y) sont au-dessus des cartes, qu'on fait glisser d'un pacte à l'autre.
 * Chaque carte montre à quelle heure chacun a fait sa part aujourd'hui.
 */
export function PactCarousel({
  pacts,
  nowMinute,
  timeZone,
}: PactCarouselProps) {
  const t = useTranslations("Messages.pacts.carousel");
  const list = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [choosing, setChoosing] = useState<{
    pact: InboxPact;
    nowMinute: number;
  } | null>(null);
  const active = pacts[Math.min(index, pacts.length - 1)];
  if (!active) return null;

  const step = () => {
    const first = list.current?.children[0];
    return first instanceof HTMLElement ? first.offsetWidth + GAP : 1;
  };

  return (
    <section aria-label={t("label")} className="flex flex-col gap-2.5">
      <div className="flex items-end justify-between gap-3">
        <h2 className="caps-label text-muted-foreground">{t("label")}</h2>
        {active.dayIndex > 0 ? (
          <p
            aria-label={t("dayLabel", {
              day: active.dayIndex,
              days: active.days,
            })}
            className="flex items-baseline gap-1.5"
          >
            <span aria-hidden="true" className="text-sm text-muted-foreground">
              {t("dayWord")}
            </span>
            <span
              aria-hidden="true"
              className="font-display text-[1.75rem] leading-none text-primary tabular-nums"
            >
              {active.dayIndex}/{active.days}
            </span>
          </p>
        ) : (
          <p className="text-sm font-semibold text-primary">
            {t("startsTomorrow")}
          </p>
        )}
      </div>

      <ul
        ref={list}
        onScroll={(event) =>
          setIndex(Math.round(event.currentTarget.scrollLeft / step()))
        }
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-3 overflow-x-auto px-4 sm:mx-0 sm:scroll-px-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {pacts.map((pact) => (
          <li
            key={pact.id}
            className={cn(
              "shrink-0 snap-start",
              pacts.length > 1 ? "w-[86%] sm:w-[24rem]" : "w-full",
            )}
          >
            <PactSlide
              pact={pact}
              nowMinute={nowMinute}
              onDoPart={() =>
                setChoosing({
                  pact,
                  nowMinute: minuteOfDay(new Date(), timeZone),
                })
              }
            />
          </li>
        ))}
      </ul>

      {pacts.length > 1 ? (
        <div className="flex justify-center">
          {pacts.map((pact, position) => (
            <button
              key={pact.id}
              type="button"
              aria-label={t("goTo", { n: position + 1, total: pacts.length })}
              aria-current={position === index ? "true" : undefined}
              onClick={() =>
                list.current?.scrollTo({
                  left: position * step(),
                  behavior: "smooth",
                })
              }
              className="flex size-6 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  position === index
                    ? "w-4.5 bg-primary"
                    : "w-1.5 bg-foreground/25",
                )}
              />
            </button>
          ))}
        </div>
      ) : null}

      {choosing ? (
        <PartTimeDialog
          pactId={choosing.pact.id}
          title={choosing.pact.title}
          name={choosing.pact.partner.name}
          nowMinute={choosing.nowMinute}
          onClose={() => setChoosing(null)}
        />
      ) : null}
    </section>
  );
}

function PactSlide({
  pact,
  nowMinute,
  onDoPart,
}: {
  pact: InboxPact;
  nowMinute: number;
  onDoPart: () => void;
}) {
  const t = useTranslations("Messages.pacts.carousel");
  const tBanner = useTranslations("Messages.pacts.banner");
  const format = useFormatter();
  const started = pact.dayIndex > 0;
  const name = pact.partner.name;
  const hour = (minute: number) =>
    format.dateTime(clockDate(minute), {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    });

  return (
    <article className="flex h-full flex-col gap-3 rounded-[22px] border border-primary/30 bg-card p-3.5">
      <Link
        href={`/messages/${pact.conversationId}`}
        aria-label={t("open", { title: pact.title, name })}
        className="flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar
          name={name}
          url={pact.partner.avatarUrl}
          className="size-9 text-sm"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-bold">{pact.title}</span>
          <span className="truncate text-xs text-muted-foreground">
            {t("with", { name })}
          </span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
      </Link>

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

          <div className="flex flex-col gap-2">
            <PartTrack
              label={name}
              minute={pact.themToday ? pact.themTodayMinute : null}
              nowMinute={nowMinute}
            />
            <PartTrack
              label={tBanner("you")}
              minute={pact.meToday ? pact.myTodayMinute : null}
              nowMinute={nowMinute}
            />
            <div
              aria-hidden="true"
              className="relative ml-[4.125rem] h-3.5 text-[10px] text-muted-foreground"
            >
              <span className="absolute left-0">{hour(DAY_START)}</span>
              <span className="absolute left-1/2 -translate-x-1/2">
                {hour(14 * 60)}
              </span>
              <span className="absolute right-0">{hour(DAY_END)}</span>
            </div>
          </div>
        </>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        {started ? (
          <span className="flex items-center gap-1.5 text-[0.8rem]">
            <Flame aria-hidden="true" className="size-4 text-primary" />
            {tBanner.rich("streak", {
              count: pact.streak,
              strong: (chunks) => (
                <strong className="tabular-nums">{chunks}</strong>
              ),
            })}
          </span>
        ) : (
          <span className="text-[0.8rem] text-muted-foreground">
            {tBanner("startsTomorrow")}
          </span>
        )}
        {!started ? null : pact.meToday && pact.themToday ? (
          <span className="text-[0.8rem] font-semibold text-primary">
            {t("bothDone")}
          </span>
        ) : !pact.meToday && !pact.myHabitMissing ? (
          <button
            type="button"
            onClick={onDoPart}
            className="h-9 rounded-full bg-primary px-3.5 text-[0.8rem] font-bold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {tBanner("doMyPart")}
          </button>
        ) : !pact.themToday ? (
          <Link
            href={`/messages/${pact.conversationId}`}
            className="flex h-9 items-center rounded-full border border-foreground/15 px-3.5 text-[0.8rem] font-semibold outline-none hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {tBanner("encourage", { name })}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

/** Une ligne de 6 h à 22 h : l'heure où la part a été faite, et maintenant. */
function PartTrack({
  label,
  minute,
  nowMinute,
}: {
  label: string;
  minute: number | null;
  nowMinute: number;
}) {
  const tBanner = useTranslations("Messages.pacts.banner");
  const format = useFormatter();
  const time =
    minute === null
      ? null
      : format.dateTime(clockDate(minute), {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "UTC",
        });
  const at = minute === null ? 0 : share(minute);

  return (
    <div className="flex items-center gap-2.5">
      <span className="w-14 shrink-0 truncate text-xs font-semibold">
        {label}
      </span>
      <span className="sr-only">
        {time ? tBanner("doneAt", { time }) : tBanner("notYet")}
      </span>
      <div
        aria-hidden="true"
        className="relative h-6.5 flex-1 rounded-full bg-foreground/5"
      >
        <span
          className="absolute -inset-y-1 w-0.5 rounded-full bg-primary/70"
          style={{ left: `calc(13px + (100% - 26px) * ${share(nowMinute)})` }}
        />
        {time ? (
          <>
            <span
              className="absolute top-0 flex size-6.5 items-center justify-center rounded-full bg-primary text-primary-foreground"
              style={{ left: `calc((100% - 26px) * ${at})` }}
            >
              <Check className="size-3.5" strokeWidth={3} />
            </span>
            <span
              className="absolute top-1/2 -translate-y-1/2 text-xs font-semibold whitespace-nowrap"
              style={
                at > 0.65
                  ? { right: `calc((100% - 26px) * ${1 - at} + 32px)` }
                  : { left: `calc((100% - 26px) * ${at} + 32px)` }
              }
            >
              {time}
            </span>
          </>
        ) : (
          <span className="absolute inset-y-0 left-3 flex items-center text-xs text-muted-foreground">
            {tBanner("notYet")}
          </span>
        )}
      </div>
    </div>
  );
}
