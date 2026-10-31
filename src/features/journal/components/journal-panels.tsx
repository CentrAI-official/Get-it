import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Flame,
  Lock,
  NotebookPen,
} from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckInCard } from "@/features/today/components/check-in-card";
import { CHECK_IN_METRICS } from "@/features/today/schemas";
import { Link } from "@/i18n/navigation";
import { addDays, toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getJournalPage, getJournalRecap } from "@/server/journal/service";
import { getCurrentProfile } from "@/server/profile/service";
import { storageEnabled } from "@/server/storage/service";
import { journalFont } from "../font";
import { JOURNAL_PERIODS, type JournalPeriod } from "../rules";
import { JournalEditor } from "./journal-editor";
import { JournalMedia } from "./journal-media";

// Pages du journal. Chacune lit la session : à placer dans un <Suspense>.

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** « AAAA-MM-JJ » valide, sinon undefined (le service ramène à aujourd'hui). */
const asDay = (value: string | undefined) =>
  value &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(toDbDate(value).getTime())
    ? value
    : undefined;

const link =
  "flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

const dayHref = (day: string, today: string) =>
  day === today ? "/profile/journal" : `/profile/journal?day=${day}`;

/** Page du journal d'un jour : à écrire, à relire, ou vide. */
export async function JournalDayPanel({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await getCurrentProfile();
  const params = await searchParams;
  const [page, t, tCheckIn, format] = await Promise.all([
    getJournalPage(profile.id, profile.timeZone, asDay(one(params.day))),
    getTranslations("Journal"),
    getTranslations("Today.checkIn"),
    getFormatter(),
  ]);
  const { day, today, body, checkIn } = page;
  const date = format.dateTime(toDbDate(day), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label={t("day.previous")}
          >
            <Link href={dayHref(addDays(day, -1), today)}>
              <ChevronLeft aria-hidden="true" />
            </Link>
          </Button>
          <div className="flex min-w-0 flex-col items-center text-center">
            {/* La date en tête de page, dans l'écriture de l'application */}
            <h2 className="text-xl font-semibold first-letter:uppercase">
              {date}
            </h2>
            {day === today ? (
              <p className="text-sm font-medium text-primary">
                {t("day.today")}
              </p>
            ) : (
              <Link
                href="/profile/journal"
                className={cn(link, "text-primary")}
              >
                {t("day.backToToday")}
              </Link>
            )}
          </div>
          {day < today ? (
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              aria-label={t("day.next")}
            >
              <Link href={dayHref(addDays(day, 1), today)}>
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <span aria-hidden="true" className="size-8" />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="flex items-center gap-1.5 text-sm">
            <Flame
              aria-hidden="true"
              className={cn(
                "size-4",
                page.streak > 0 ? "text-primary" : "text-muted-foreground",
              )}
            />
            {t("streak", { count: page.streak })}
          </p>
          <Link href="/profile/journal/recap" className={link}>
            <BookOpen aria-hidden="true" className="size-4" />
            {t("day.recapLink")}
          </Link>
        </div>
      </div>

      {/* Le check-in se fait le jour même ; celui d'un autre jour se relit */}
      {day === today ? (
        <CheckInCard saved={checkIn} />
      ) : checkIn ? (
        <section
          aria-labelledby="journal-check-in"
          className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
        >
          <h3 id="journal-check-in" className="font-heading font-semibold">
            {t("day.checkIn")}
          </h3>
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {CHECK_IN_METRICS.map((metric) => (
              <div key={metric} className="flex items-baseline gap-1.5">
                <dt className="text-muted-foreground">
                  {tCheckIn(`metrics.${metric}`)}
                </dt>
                <dd className="font-bold tabular-nums">
                  {tCheckIn("score", { score: checkIn[metric] })}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <div className="border-t border-foreground/8 pt-6">
        {page.editable ? (
          <div className="flex flex-col gap-6">
            <JournalEditor key={day} day={day} body={body} />
            <JournalMedia
              day={day}
              media={page.media}
              editable
              photosEnabled={storageEnabled()}
            />
          </div>
        ) : body || page.media.length > 0 ? (
          <article className="flex flex-col gap-3">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Lock aria-hidden="true" className="size-4" />
              {t("day.locked")}
            </p>
            {/* Une ancienne page se relit sur les mêmes lignes de carnet */}
            {body ? (
              <div className="relative pl-6">
                <span
                  aria-hidden="true"
                  className="absolute top-0 bottom-0 left-2 w-px bg-foreground/12"
                />
                <p
                  className={cn(
                    journalFont.className,
                    "min-h-[40vh] journal-lines pt-[0.2rem] text-[1.125rem] break-words whitespace-pre-wrap text-foreground/90",
                  )}
                >
                  {body}
                </p>
              </div>
            ) : null}
            <JournalMedia
              day={day}
              media={page.media}
              editable={false}
              photosEnabled={false}
            />
          </article>
        ) : (
          <EmptyState
            icon={NotebookPen}
            title={t("day.emptyTitle")}
            description={t("day.emptyDescription")}
            action={
              <Button asChild>
                <Link href="/profile/journal">{t("day.writeToday")}</Link>
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}

export function JournalDaySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-24" />
      </div>
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

/** Récap d'une semaine ou d'un mois : chiffres et pages à relire. */
export async function JournalRecapPanel({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await getCurrentProfile();
  const params = await searchParams;
  const period: JournalPeriod =
    JOURNAL_PERIODS.find((item) => item === one(params.period)) ?? "week";
  const [recap, t, format] = await Promise.all([
    getJournalRecap(
      profile.id,
      profile.timeZone,
      period,
      asDay(one(params.at)),
    ),
    getTranslations("Journal.recap"),
    getFormatter(),
  ]);
  const href = (at: string | null, value: JournalPeriod = period) =>
    `/profile/journal/recap?period=${value}${at ? `&at=${at}` : ""}`;
  const title =
    period === "week"
      ? format.dateTimeRange(toDbDate(recap.from), toDbDate(recap.to), {
          day: "numeric",
          month: "long",
          timeZone: "UTC",
        })
      : format.dateTime(toDbDate(recap.from), {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        });
  const { stats } = recap;
  const score = (value: number | null) =>
    value === null ? t("noCheckIn") : t("score", { value });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div
          role="radiogroup"
          aria-label={t("periodLabel")}
          className="flex gap-2"
        >
          {JOURNAL_PERIODS.map((value) => (
            <Link
              key={value}
              role="radio"
              aria-checked={value === period}
              href={href(null, value)}
              className={cn(
                "flex rounded-full border px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                value === period
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`periods.${value}`)}
            </Link>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label={t(`previous.${period}`)}
          >
            <Link href={href(recap.previous)}>
              <ChevronLeft aria-hidden="true" />
            </Link>
          </Button>
          <h2 className="font-heading text-xl font-bold first-letter:uppercase">
            {title}
          </h2>
          {recap.next ? (
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              aria-label={t(`next.${period}`)}
            >
              <Link href={href(recap.next)}>
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <span aria-hidden="true" className="size-8" />
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-foreground/8 pt-6 sm:grid-cols-3">
        <div className="flex flex-col gap-0.5">
          <dt className="text-sm text-muted-foreground">{t("written")}</dt>
          <dd className="font-heading text-2xl font-bold">
            {t("writtenValue", {
              written: stats.written,
              elapsed: stats.elapsed,
            })}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-sm text-muted-foreground">{t("streak")}</dt>
          <dd className="font-heading text-2xl font-bold">
            {t("days", { count: recap.streak })}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-sm text-muted-foreground">{t("words")}</dt>
          <dd className="font-heading text-2xl font-bold">
            {format.number(stats.words)}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-sm text-muted-foreground">{t("mood")}</dt>
          <dd className="font-heading text-2xl font-bold">
            {score(stats.mood)}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-sm text-muted-foreground">{t("energy")}</dt>
          <dd className="font-heading text-2xl font-bold">
            {score(stats.energy)}
          </dd>
        </div>
      </dl>

      <section
        aria-labelledby="journal-recap-pages"
        className="flex flex-col gap-2 border-t border-foreground/8 pt-6"
      >
        <h2
          id="journal-recap-pages"
          className="caps-label text-muted-foreground"
        >
          {t("pages")}
        </h2>
        {recap.entries.length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title={t(`empty.${period}`)}
            description={t("emptyDescription")}
            action={
              <Button asChild>
                <Link href="/profile/journal">{t("writeToday")}</Link>
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col">
            {recap.entries.map((entry) => (
              <li key={entry.day} className="border-b border-foreground/8">
                <Link
                  href={dayHref(entry.day, recap.today)}
                  className="flex flex-col gap-1 rounded-md py-3 outline-none hover:bg-foreground/[0.02] focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold first-letter:uppercase">
                      {format.dateTime(toDbDate(entry.day), {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        timeZone: "UTC",
                      })}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {t("wordsCount", { count: entry.words })}
                    </span>
                  </span>
                  <span className="line-clamp-2 text-sm break-words text-muted-foreground">
                    {entry.excerpt}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function JournalRecapSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-44 rounded-full" />
      <Skeleton className="mx-auto h-7 w-52" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </div>
    </div>
  );
}
