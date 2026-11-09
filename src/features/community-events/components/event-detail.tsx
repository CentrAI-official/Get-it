import {
  CalendarDays,
  Clock,
  EyeOff,
  MapPin,
  Users,
  Video,
} from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { ProfileLink } from "@/components/profile-link";
import { Skeleton } from "@/components/ui/skeleton";
import { pillarIcons } from "@/config/pillars";
import { JoinCommunityCard } from "@/features/community/components/join-community-card";
import { recordIdSchema } from "@/features/goals/schemas";
import { mapsUrl } from "@/features/places/rules";
import { getCommunityMember } from "@/server/community/members";
import { getCommunityEvent } from "@/server/community-events/service";
import { getCurrentProfile } from "@/server/profile/service";
import { safeUrl } from "../rules";
import {
  AttendanceButtons,
  CalendarButton,
  HostActions,
  ReportEventButton,
  ShareEventButton,
} from "./event-controls";

/**
 * La page d'un événement : la photo, la date en grand, l'hôte, « J'y vais »,
 * quand et où, la description, qui y va ; pour l'hôte, les inscrits et ses
 * actions. Lit la session : à placer dans un <Suspense>.
 */
export async function EventDetailView({ eventId }: { eventId: string }) {
  const id = recordIdSchema.safeParse(eventId);
  if (!id.success) notFound();
  const profile = await getCurrentProfile();
  const member = await getCommunityMember(profile.id);
  if (!member?.joined) return <JoinCommunityCard />;
  const event = await getCommunityEvent(profile.id, id.data);
  if (!event) notFound();
  const [t, tRegions, format] = await Promise.all([
    getTranslations("CommunityEvents"),
    getTranslations("Marketplace.regions"),
    getFormatter(),
  ]);
  const timeZone = profile.timeZone;
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  const TopicIcon = event.topic ? pillarIcons[event.topic] : CalendarDays;
  const link = safeUrl(event.onlineUrl);
  const when = end
    ? format.dateTimeRange(start, end, {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "numeric",
        minute: "2-digit",
        timeZone,
      })
    : format.dateTime(start, {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "numeric",
        minute: "2-digit",
        timeZone,
      });
  const open = !event.cancelled && !event.ended;

  return (
    <article className="flex flex-col gap-7">
      {event.coverUrl ? (
        // La photo va d'un bord à l'autre sur téléphone
        <div className="-mx-4 overflow-hidden bg-foreground/5 sm:mx-0 sm:rounded-3xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.coverUrl}
            alt=""
            className="aspect-[16/9] w-full object-cover"
          />
        </div>
      ) : null}

      <header className="flex items-start gap-5">
        {/* La date, comme sur un billet */}
        <div className="flex shrink-0 flex-col items-center leading-none">
          <span className="caps-label text-primary">
            {format.dateTime(start, { month: "short", timeZone })}
          </span>
          <span className="font-display text-[4.25rem] leading-[0.9] text-primary tabular-nums">
            {format.dateTime(start, { day: "numeric", timeZone })}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <TopicIcon aria-hidden="true" className="size-3.5 text-primary" />
              {event.topic ? t(`topics.${event.topic}`) : t("topics.general")}
            </span>
            {event.cancelled ? (
              <span className="rounded-full bg-destructive/12 px-2 py-0.5 text-destructive">
                {t("cancelled")}
              </span>
            ) : event.ended ? (
              <span className="rounded-full bg-foreground/8 px-2 py-0.5 text-muted-foreground">
                {t("ended")}
              </span>
            ) : event.spots === 0 ? (
              <span className="rounded-full bg-foreground/8 px-2 py-0.5 text-muted-foreground">
                {t("full")}
              </span>
            ) : null}
          </div>
          <h1 className="text-2xl font-bold text-balance break-words sm:text-3xl">
            {event.title}
          </h1>
          <ProfileLink
            username={event.host.username}
            className="flex w-fit items-center gap-2 rounded-full text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Avatar
              name={event.host.name}
              url={event.host.avatarUrl}
              className="size-6 text-[11px]"
            />
            <span className="text-muted-foreground">
              {t.rich("hostedBy", {
                name: event.host.name,
                strong: (chunks) => (
                  <strong className="font-semibold text-foreground">
                    {chunks}
                  </strong>
                ),
              })}
            </span>
          </ProfileLink>
        </div>
      </header>

      {event.hidden ? (
        <p className="flex items-start gap-2 rounded-2xl bg-foreground/[0.05] p-4 text-sm text-pretty">
          <EyeOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("hiddenNotice")}
        </p>
      ) : null}

      {event.hosting ? (
        <HostActions eventId={event.id} cancelled={event.cancelled} />
      ) : open ? (
        <AttendanceButtons
          eventId={event.id}
          initial={event.mine}
          full={event.spots === 0}
        />
      ) : null}

      <ul className="flex flex-col border-t border-foreground/8">
        <li className="flex items-start gap-3 border-b border-foreground/8 py-3.5">
          <Clock
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-primary"
          />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="font-medium first-letter:uppercase">{when}</span>
            {open && (event.hosting || event.mine) ? (
              <CalendarButton eventId={event.id} />
            ) : null}
          </span>
        </li>
        <li className="flex items-start gap-3 border-b border-foreground/8 py-3.5">
          {event.format === "online" ? (
            <Video
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-primary"
            />
          ) : (
            <MapPin
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-primary"
            />
          )}
          <span className="flex min-w-0 flex-col gap-1">
            {event.format === "online" ? (
              <>
                <span className="font-medium">{t("online")}</span>
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-fit text-sm font-semibold break-all text-primary underline-offset-4 hover:underline"
                  >
                    {t("joinLink")}
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {t("linkHint")}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="font-medium break-words">
                  {event.location}
                </span>
                {event.region ? (
                  <span className="text-sm text-muted-foreground">
                    {tRegions(event.region as "montreal")}
                  </span>
                ) : null}
                {event.location ? (
                  <a
                    href={mapsUrl(event.location)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-fit text-sm font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {t("openMap")}
                  </a>
                ) : null}
              </>
            )}
          </span>
        </li>
        <li className="flex items-start gap-3 border-b border-foreground/8 py-3.5">
          <Users
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-primary"
          />
          <span className="flex min-w-0 flex-col gap-1.5">
            <span className="font-medium">
              {t("counts", {
                going: event.going,
                interested: event.interested,
              })}
            </span>
            {event.spots !== null ? (
              <span className="text-sm text-muted-foreground">
                {t("spots", { count: event.spots })}
              </span>
            ) : null}
            {event.friends.length > 0 ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="flex -space-x-1.5">
                  {event.friends.map((person) => (
                    <Avatar
                      key={person.id}
                      name={person.name}
                      url={person.avatarUrl}
                      className="size-6 text-[11px] ring-2 ring-background"
                    />
                  ))}
                </span>
                {t("friendsGoing", {
                  names: format.list(
                    event.friends.map((person) => person.name),
                  ),
                })}
              </span>
            ) : null}
          </span>
        </li>
      </ul>

      {event.description ? (
        <section aria-labelledby="event-about" className="flex flex-col gap-2">
          <h2 id="event-about" className="caps-label text-muted-foreground">
            {t("about")}
          </h2>
          <p className="text-pretty break-words whitespace-pre-line">
            {event.description}
          </p>
        </section>
      ) : null}

      {event.attendees ? (
        <section
          aria-labelledby="event-attendees"
          className="flex flex-col gap-2 border-t border-foreground/8 pt-6"
        >
          <h2 id="event-attendees" className="caps-label text-muted-foreground">
            {t("attendees.title", { count: event.attendees.length })}
          </h2>
          {event.attendees.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("attendees.empty")}
            </p>
          ) : (
            <ul className="flex flex-col">
              {event.attendees.map((person) => (
                <li
                  key={person.id}
                  className="flex items-center gap-3 border-b border-foreground/8 py-2.5"
                >
                  <ProfileLink
                    username={person.username}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Avatar
                      name={person.name}
                      url={person.avatarUrl}
                      className="size-9 text-sm"
                    />
                    <span className="truncate font-medium">{person.name}</span>
                  </ProfileLink>
                  <span
                    className={
                      person.status === "going"
                        ? "text-xs font-semibold text-primary"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {t(`mine.${person.status}`)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-foreground/8 pt-5">
        <ShareEventButton title={event.title} />
        {event.hosting ? null : <ReportEventButton eventId={event.id} />}
      </div>
    </article>
  );
}

export function EventDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="aspect-[16/9] w-full rounded-3xl" />
      <div className="flex gap-5">
        <Skeleton className="h-20 w-16" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-40" />
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
