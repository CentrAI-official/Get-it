import { CalendarDays, ChevronRight, MapPin, Plus, Video } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PILLARS, pillarIcons } from "@/config/pillars";
import { JoinCommunityCard } from "@/features/community/components/join-community-card";
import { Link } from "@/i18n/navigation";
import { toCalendarDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getCommunityMember } from "@/server/community/members";
import {
  listCommunityEvents,
  type EventCard,
} from "@/server/community-events/service";
import { getCurrentProfile } from "@/server/profile/service";
import {
  EVENT_WHEN,
  EVENT_WHERE,
  parseEventFilters,
  type EventFilters,
} from "../rules";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Adresse de l'annuaire avec ces filtres (les autres gardés). */
function hrefOf(filters: EventFilters, change: Partial<EventFilters>) {
  const next = { ...filters, ...change };
  const query = new URLSearchParams();
  if (next.mine) query.set("vue", "miens");
  if (next.when !== "all") query.set("quand", next.when);
  if (next.where !== "all") query.set("ou", next.where);
  if (next.topic) query.set("sujet", next.topic);
  const text = query.toString();
  return text ? `/events?${text}` : "/events";
}

const chip =
  "flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const chipOn = "border-primary bg-primary/15 text-foreground";
const chipOff =
  "border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:text-foreground";

/**
 * Événements de la Communauté : le prochain où je vais en grand, les filtres
 * (quand, où, sujet), puis les événements jour par jour. Lit la session : à
 * placer dans un <Suspense>.
 */
export async function EventsHome({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await getCurrentProfile();
  const member = await getCommunityMember(profile.id);
  if (!member?.joined) return <JoinCommunityCard />;
  const params = await searchParams;
  const filters = parseEventFilters(params);
  const pageNumber = Math.max(1, Number(params.page ?? 1) || 1);
  const [data, t] = await Promise.all([
    listCommunityEvents(profile.id, filters, pageNumber),
    getTranslations("CommunityEvents"),
  ]);
  const timeZone = profile.timeZone;
  const today = toCalendarDay(new Date(), timeZone);
  const filtered =
    filters.when !== "all" || filters.where !== "all" || filters.topic;
  const pageHref = (page: number) => {
    const base = hrefOf(filters, {});
    return `${base}${base.includes("?") ? "&" : "?"}page=${page}`;
  };

  // Jour par jour, dans le fuseau de la personne
  const days = new Map<string, EventCard[]>();
  for (const event of data.events) {
    const day = toCalendarDay(new Date(event.startsAt), timeZone);
    days.set(day, [...(days.get(day) ?? []), event]);
  }
  const sections = await Promise.all(
    [...days.entries()].map(async ([day, events]) => ({
      day,
      label: await dayLabel(day, today),
      events,
    })),
  );

  return (
    <div className="flex flex-col gap-8">
      {/* Le prochain où je vais : seulement sans filtre (sinon il brouille la liste) */}
      {data.next && !filters.mine && !filtered ? (
        <NextEvent event={data.next} timeZone={timeZone} />
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label={t("viewsLabel")} className="flex gap-2">
            <Link
              href={hrefOf(filters, { mine: false })}
              transitionTypes={["nav-tab"]}
              aria-current={!filters.mine ? "page" : undefined}
              className={cn(chip, !filters.mine ? chipOn : chipOff)}
            >
              {t("views.upcoming")}
            </Link>
            <Link
              href={hrefOf(filters, { mine: true })}
              transitionTypes={["nav-tab"]}
              aria-current={filters.mine ? "page" : undefined}
              className={cn(chip, filters.mine ? chipOn : chipOff)}
            >
              {t("views.mine")}
            </Link>
          </nav>
          <Button asChild className="rounded-full">
            <Link href="/events/new">
              <Plus aria-hidden="true" />
              {t("create")}
            </Link>
          </Button>
        </div>

        {/* Filtres : la liste change sur place, sans faire glisser la page */}
        <div
          role="group"
          aria-label={t("filtersLabel")}
          className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {EVENT_WHEN.map((when) => (
            <Link
              key={when}
              href={hrefOf(filters, { when })}
              transitionTypes={[]}
              scroll={false}
              aria-current={filters.when === when ? "true" : undefined}
              className={cn(chip, filters.when === when ? chipOn : chipOff)}
            >
              {t(`when.${when}`)}
            </Link>
          ))}
          <span aria-hidden="true" className="w-px shrink-0 bg-foreground/10" />
          {EVENT_WHERE.filter(
            (where) => where !== "near" || data.region !== null,
          ).map((where) => (
            <Link
              key={where}
              href={hrefOf(filters, { where })}
              transitionTypes={[]}
              scroll={false}
              aria-current={filters.where === where ? "true" : undefined}
              className={cn(chip, filters.where === where ? chipOn : chipOff)}
            >
              {t(`where.${where}`)}
            </Link>
          ))}
          <span aria-hidden="true" className="w-px shrink-0 bg-foreground/10" />
          {PILLARS.map((pillar) => {
            const Icon = pillarIcons[pillar];
            const on = filters.topic === pillar;
            return (
              <Link
                key={pillar}
                href={hrefOf(filters, { topic: on ? null : pillar })}
                transitionTypes={[]}
                scroll={false}
                aria-current={on ? "true" : undefined}
                className={cn(chip, "gap-1.5", on ? chipOn : chipOff)}
              >
                <Icon aria-hidden="true" className="size-4" />
                {t(`topics.${pillar}`)}
              </Link>
            );
          })}
        </div>
      </div>

      {data.events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={
            filters.mine
              ? t("empty.mineTitle")
              : filtered
                ? t("empty.filteredTitle")
                : t("empty.title")
          }
          description={
            filters.mine
              ? t("empty.mineDescription")
              : filtered
                ? t("empty.filteredDescription")
                : t("empty.description")
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          {sections.map(({ day, label, events }) => (
            <section key={day} aria-label={label} className="flex flex-col">
              <h2 className="border-b border-foreground/8 pb-2 caps-label text-muted-foreground">
                {label}
              </h2>
              <ul className="flex flex-col">
                {events.map((event) => (
                  <li key={event.id}>
                    <EventRow event={event} timeZone={timeZone} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {data.hasMore || pageNumber > 1 ? (
            <div className="flex justify-center gap-3">
              {pageNumber > 1 ? (
                <Button asChild variant="outline">
                  <Link href={pageHref(pageNumber - 1)} transitionTypes={[]}>
                    {t("previous")}
                  </Link>
                </Button>
              ) : null}
              {data.hasMore ? (
                <Button asChild variant="outline">
                  <Link href={pageHref(pageNumber + 1)} transitionTypes={[]}>
                    {t("more")}
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** « Aujourd'hui », « Demain », ou le jour en toutes lettres. */
async function dayLabel(day: string, today: string) {
  const [t, format] = await Promise.all([
    getTranslations("CommunityEvents"),
    getFormatter(),
  ]);
  if (day === today) return t("today");
  const tomorrow = new Date(`${today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (day === tomorrow.toISOString().slice(0, 10)) return t("tomorrow");
  return format.dateTime(new Date(`${day}T12:00:00Z`), {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** Le prochain événement où je vais, en grand : la date en Anton orange. */
async function NextEvent({
  event,
  timeZone,
}: {
  event: EventCard;
  timeZone: string;
}) {
  const [t, format] = await Promise.all([
    getTranslations("CommunityEvents"),
    getFormatter(),
  ]);
  const start = new Date(event.startsAt);
  return (
    <section aria-labelledby="next-event" className="flex flex-col gap-3">
      <h2 id="next-event" className="caps-label text-muted-foreground">
        {t("next")}
      </h2>
      <Link
        href={`/events/${event.id}`}
        className="group flex items-center gap-5 rounded-3xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex shrink-0 flex-col items-center leading-none">
          <span className="caps-label text-primary">
            {format.dateTime(start, { month: "short", timeZone })}
          </span>
          <span className="font-display text-[4.5rem] leading-[0.9] text-primary tabular-nums">
            {format.dateTime(start, { day: "numeric", timeZone })}
          </span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm text-muted-foreground capitalize">
            {format.dateTime(start, {
              weekday: "long",
              hour: "numeric",
              minute: "2-digit",
              timeZone,
            })}
          </span>
          <span className="text-xl font-bold text-pretty break-words group-hover:underline">
            {event.title}
          </span>
          <Place event={event} />
        </span>
        <ChevronRight
          aria-hidden="true"
          className="size-5 shrink-0 text-muted-foreground"
        />
      </Link>
    </section>
  );
}

async function Place({ event }: { event: EventCard }) {
  const t = await getTranslations("CommunityEvents");
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
      {event.format === "online" ? (
        <Video aria-hidden="true" className="size-4 shrink-0" />
      ) : (
        <MapPin aria-hidden="true" className="size-4 shrink-0" />
      )}
      <span className="truncate">
        {event.format === "online" ? t("online") : event.location}
      </span>
    </span>
  );
}

/** Une ligne de l'annuaire : la photo (ou le pilier), l'heure, le titre, le lieu, qui y va. */
async function EventRow({
  event,
  timeZone,
}: {
  event: EventCard;
  timeZone: string;
}) {
  const [t, format] = await Promise.all([
    getTranslations("CommunityEvents"),
    getFormatter(),
  ]);
  const start = new Date(event.startsAt);
  const Icon = event.topic ? pillarIcons[event.topic] : CalendarDays;
  const friend = event.friends[0];

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex items-center gap-4 border-b border-foreground/8 py-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-foreground/[0.06]">
        {event.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <Icon aria-hidden="true" className="size-7 text-primary" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-x-2 text-sm">
          <span className="font-display text-lg leading-none text-primary tabular-nums">
            {format.dateTime(start, {
              hour: "numeric",
              minute: "2-digit",
              timeZone,
            })}
          </span>
          {event.cancelled ? (
            <span className="text-xs font-semibold text-destructive">
              {t("cancelled")}
            </span>
          ) : event.spots === 0 ? (
            <span className="text-xs font-semibold text-muted-foreground">
              {t("full")}
            </span>
          ) : null}
          {event.hosting ? (
            <span className="text-xs font-semibold text-primary">
              {t("hosting")}
            </span>
          ) : event.mine ? (
            <span className="text-xs font-semibold text-primary">
              {t(`mine.${event.mine}`)}
            </span>
          ) : null}
        </span>
        <span className="font-semibold text-pretty break-words group-hover:underline">
          {event.title}
        </span>
        <Place event={event} />
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {event.friends.length > 0 ? (
            <span className="flex -space-x-1.5">
              {event.friends.map((person) => (
                <Avatar
                  key={person.id}
                  name={person.name}
                  url={person.avatarUrl}
                  className="size-5 text-[10px] ring-2 ring-background"
                />
              ))}
            </span>
          ) : null}
          {friend
            ? t("friendGoing", {
                name: friend.name,
                others: Math.max(0, event.going - 1),
              })
            : t("going", { count: event.going })}
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
    </Link>
  );
}

export function EventsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-24 w-full rounded-3xl" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex items-center gap-4">
          <Skeleton className="size-20 rounded-2xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
