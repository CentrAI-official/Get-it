import { CalendarPlus, ChevronRight } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { listUpcomingEventsOf } from "@/server/community-events/service";

/**
 * Les prochains événements d'un groupe ou d'une page pro (3 au plus), la date
 * en grand, et « Créer un événement » pour qui peut en créer ici. Rien quand
 * il n'y a ni événement ni bouton.
 */
export async function UpcomingEvents({
  viewerId,
  owner,
  createHref,
  timeZone,
}: {
  viewerId: string;
  owner: { pageId: string } | { groupId: string };
  /** « Créer un événement » (membre du groupe), ou null. */
  createHref: string | null;
  timeZone: string;
}) {
  const [events, t, format] = await Promise.all([
    listUpcomingEventsOf(viewerId, owner),
    getTranslations("CommunityEvents.upcoming"),
    getFormatter(),
  ]);
  if (events.length === 0 && !createHref) return null;

  return (
    <section
      aria-labelledby="upcoming-events"
      className="flex flex-col gap-2 border-t border-foreground/8 pt-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="upcoming-events" className="caps-label text-muted-foreground">
          {t("title")}
        </h2>
        {createHref ? (
          <Button asChild variant="ghost" size="sm" className="text-primary">
            <Link href={createHref}>
              <CalendarPlus aria-hidden="true" />
              {t("create")}
            </Link>
          </Button>
        ) : null}
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col">
          {events.map((event) => {
            const start = new Date(event.startsAt);
            return (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="group flex items-center gap-4 border-b border-foreground/8 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex w-12 shrink-0 flex-col items-center leading-none">
                    <span className="caps-label text-primary">
                      {format.dateTime(start, { month: "short", timeZone })}
                    </span>
                    <span className="font-display text-3xl text-primary tabular-nums">
                      {format.dateTime(start, { day: "numeric", timeZone })}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-semibold group-hover:underline">
                      {event.title}
                    </span>
                    <span className="text-xs text-muted-foreground first-letter:uppercase">
                      {format.dateTime(start, {
                        weekday: "long",
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone,
                      })}
                      {" · "}
                      {t("going", { count: event.going })}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
