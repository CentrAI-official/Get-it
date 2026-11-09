import "server-only";
import {
  COMMUNITY_EVENT_LIMITS,
  spotsLeft,
  whenRange,
  type CommunityEventError,
  type CommunityEventInput,
  type EventAttendanceStatus,
  type EventFilters,
  type EventFormat,
} from "@/features/community-events/rules";
import type { PostMediaInput } from "@/features/community/media";
import type { Pillar } from "@/config/pillars";
import type { Prisma } from "@/generated/prisma/client";
import { addDays, minuteOfDay, toCalendarDay, zonedInstant } from "@/lib/dates";
import { getBlockedIds, getCommunityMember } from "@/server/community/members";
import { verifyMedia } from "@/server/community/media";
import { contactIds } from "@/server/contacts/service";
import { db } from "@/server/db";
import { createEvent as createCalendarEvent } from "@/server/events/service";
import { notify } from "@/server/notifications/service";
import { avatarUrls } from "@/server/profile/avatar";
import { getUserTimeZone } from "@/server/profile/service";
import { removeFiles } from "@/server/storage/service";

// Événements de la Communauté. Chaque fonction reçoit l'userId de la session :
// seuls les membres du Centre les voient ; une personne bloquée (dans les deux
// sens) ne voit pas les événements de l'autre ; seul l'hôte modifie, annule ou
// supprime ; le lien d'une rencontre en ligne n'est montré qu'à l'hôte et aux
// inscrits ; la liste des inscrits, seulement à l'hôte.

type Result = { ok: true } | { ok: false; error: CommunityEventError };

/** Un événement sans fin reste « en cours » 3 heures après son début. */
const OPEN_ENDED_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type EventPerson = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
};

export type EventCard = {
  id: string;
  title: string;
  topic: Pillar | null;
  format: EventFormat;
  location: string | null;
  region: string | null;
  /** Instants ISO ; affichés dans le fuseau de la personne qui lit. */
  startsAt: string;
  endsAt: string | null;
  coverUrl: string | null;
  host: EventPerson;
  going: number;
  interested: number;
  capacity: number | null;
  /** Places qui restent (null : sans limite). */
  spots: number | null;
  /** Ma réponse ; null : rien. */
  mine: EventAttendanceStatus | null;
  hosting: boolean;
  cancelled: boolean;
  /** Mes contacts qui y vont (3 au plus). */
  friends: EventPerson[];
};

export type EventDetail = EventCard & {
  description: string;
  /** Lien de la rencontre en ligne : seulement pour l'hôte et les inscrits. */
  onlineUrl: string | null;
  /** Masqué par des signalements (visible par l'hôte seulement). */
  hidden: boolean;
  ended: boolean;
  /** Les inscrits, pour l'hôte seulement. */
  attendees: (EventPerson & { status: EventAttendanceStatus })[] | null;
};

const personSelect = {
  id: true,
  displayName: true,
  username: true,
  avatarPath: true,
} as const;

const cardSelect = {
  id: true,
  hostId: true,
  title: true,
  topic: true,
  format: true,
  location: true,
  region: true,
  startsAt: true,
  endsAt: true,
  capacity: true,
  coverPath: true,
  cancelledAt: true,
  status: true,
  description: true,
  onlineUrl: true,
  host: { select: personSelect },
} as const;

type CardRow = Prisma.CommunityEventGetPayload<{ select: typeof cardSelect }>;

const nameOf = (person: {
  displayName: string | null;
  username: string | null;
}) => person.displayName ?? person.username ?? "";

/** Ce qu'un membre voit : visible, hôte non bloqué ni suspendu (ou ses propres événements). */
function visibleTo(viewerId: string, blocked: string[], now: Date) {
  return {
    OR: [
      { hostId: viewerId },
      {
        status: "visible" as const,
        hostId: { notIn: blocked },
        host: {
          OR: [{ suspendedUntil: null }, { suspendedUntil: { lt: now } }],
        },
      },
    ],
  };
}

/** Pas encore fini (un événement sans fin compte 3 heures après son début). */
function notEnded(now: Date) {
  return {
    OR: [
      { endsAt: { gte: now } },
      {
        endsAt: null,
        startsAt: { gte: new Date(now.getTime() - OPEN_ENDED_MS) },
      },
    ],
  };
}

/** Les cartes : nombres de réponses, ma réponse, mes contacts qui y vont, images. */
async function toCards(
  viewerId: string,
  rows: CardRow[],
): Promise<EventCard[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const [counts, mine, contacts] = await Promise.all([
    db.communityEventAttendee.groupBy({
      by: ["eventId", "status"],
      where: { eventId: { in: ids } },
      _count: { _all: true },
    }),
    db.communityEventAttendee.findMany({
      where: { eventId: { in: ids }, userId: viewerId },
      select: { eventId: true, status: true },
    }),
    contactIds(viewerId),
  ]);
  const friends =
    contacts.size === 0
      ? []
      : await db.communityEventAttendee.findMany({
          where: {
            eventId: { in: ids },
            status: "going",
            userId: { in: [...contacts] },
          },
          orderBy: { createdAt: "asc" },
          select: { eventId: true, profile: { select: personSelect } },
        });
  const urls = await avatarUrls([
    ...rows.flatMap((row) => [row.coverPath, row.host.avatarPath]),
    ...friends.map((friend) => friend.profile.avatarPath),
  ]);
  const person = (profile: {
    id: string;
    displayName: string | null;
    username: string | null;
    avatarPath: string | null;
  }): EventPerson => ({
    id: profile.id,
    name: nameOf(profile),
    username: profile.username,
    avatarUrl: profile.avatarPath
      ? (urls.get(profile.avatarPath) ?? null)
      : null,
  });
  const count = (eventId: string, status: EventAttendanceStatus) =>
    counts.find((entry) => entry.eventId === eventId && entry.status === status)
      ?._count._all ?? 0;

  return rows.map((row) => {
    const going = count(row.id, "going");
    return {
      id: row.id,
      title: row.title,
      topic: row.topic,
      format: row.format,
      location: row.location,
      region: row.region,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null,
      coverUrl: row.coverPath ? (urls.get(row.coverPath) ?? null) : null,
      host: person(row.host),
      going,
      interested: count(row.id, "interested"),
      capacity: row.capacity,
      spots: spotsLeft(row.capacity, going),
      mine: mine.find((entry) => entry.eventId === row.id)?.status ?? null,
      hosting: row.hostId === viewerId,
      cancelled: row.cancelledAt !== null,
      friends: friends
        .filter((friend) => friend.eventId === row.id)
        .slice(0, 3)
        .map((friend) => person(friend.profile)),
    };
  });
}

export type EventsPage = {
  events: EventCard[];
  /** Le prochain événement où je vais (en tête de l'annuaire). */
  next: EventCard | null;
  hasMore: boolean;
  /** Ma région (filtre « Près de moi ») ; null si elle n'est pas connue. */
  region: string | null;
};

/** L'annuaire : les événements à venir, filtrés, du plus proche au plus lointain. */
export async function listCommunityEvents(
  viewerId: string,
  filters: EventFilters,
  page: number,
): Promise<EventsPage> {
  const [blocked, timeZone, profile] = await Promise.all([
    getBlockedIds(viewerId),
    getUserTimeZone(viewerId),
    db.profile.findUnique({
      where: { id: viewerId },
      select: { qcRegion: true },
    }),
  ]);
  const now = new Date();
  const today = toCalendarDay(now, timeZone);
  const range = whenRange(filters.when, today);
  const region = profile?.qcRegion ?? null;
  const where: Prisma.CommunityEventWhereInput = {
    AND: [
      visibleTo(viewerId, blocked, now),
      notEnded(now),
      range.from > today
        ? { startsAt: { gte: zonedInstant(range.from, 0, timeZone) } }
        : {},
      range.to
        ? { startsAt: { lt: zonedInstant(addDays(range.to, 1), 0, timeZone) } }
        : {},
      filters.where === "online" ? { format: "online" } : {},
      filters.where === "near" && region ? { format: "in_person", region } : {},
      filters.topic ? { topic: filters.topic } : {},
      filters.mine
        ? {
            OR: [
              { hostId: viewerId },
              { attendees: { some: { userId: viewerId } } },
            ],
          }
        : { cancelledAt: null },
    ],
  };
  const size = COMMUNITY_EVENT_LIMITS.page;
  const [rows, nextRow] = await Promise.all([
    db.communityEvent.findMany({
      where,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      skip: Math.max(0, page - 1) * size,
      take: size + 1,
      select: cardSelect,
    }),
    db.communityEvent.findFirst({
      where: {
        AND: [
          visibleTo(viewerId, blocked, now),
          notEnded(now),
          { cancelledAt: null },
          { attendees: { some: { userId: viewerId, status: "going" } } },
        ],
      },
      orderBy: { startsAt: "asc" },
      select: cardSelect,
    }),
  ]);
  const [events, next] = await Promise.all([
    toCards(viewerId, rows.slice(0, size)),
    nextRow ? toCards(viewerId, [nextRow]) : Promise.resolve([]),
  ]);
  return {
    events,
    next: next[0] ?? null,
    hasMore: rows.length > size,
    region,
  };
}

/** Un événement, pour un membre du Centre ; null s'il ne le voit pas. */
export async function getCommunityEvent(
  viewerId: string,
  eventId: string,
): Promise<EventDetail | null> {
  const blocked = await getBlockedIds(viewerId);
  const now = new Date();
  const row = await db.communityEvent.findFirst({
    where: {
      AND: [
        { id: eventId, status: { not: "removed" } },
        visibleTo(viewerId, blocked, now),
      ],
    },
    select: cardSelect,
  });
  if (!row) return null;
  const [card] = await toCards(viewerId, [row]);
  if (!card) return null;
  const hosting = row.hostId === viewerId;
  const attendees = hosting
    ? await db.communityEventAttendee.findMany({
        where: { eventId, userId: { notIn: blocked } },
        orderBy: { createdAt: "asc" },
        take: 500,
        select: { status: true, profile: { select: personSelect } },
      })
    : null;
  const urls = attendees
    ? await avatarUrls(attendees.map((entry) => entry.profile.avatarPath))
    : new Map<string, string>();
  const end = row.endsAt ?? new Date(row.startsAt.getTime() + OPEN_ENDED_MS);
  return {
    ...card,
    description: row.description,
    onlineUrl: hosting || card.mine !== null ? row.onlineUrl : null,
    hidden: row.status !== "visible",
    ended: end < now,
    attendees:
      attendees?.map((entry) => ({
        id: entry.profile.id,
        name: nameOf(entry.profile),
        username: entry.profile.username,
        avatarUrl: entry.profile.avatarPath
          ? (urls.get(entry.profile.avatarPath) ?? null)
          : null,
        status: entry.status,
      })) ?? null,
  };
}

/** Membre du Centre, non suspendu : peut créer et répondre. */
async function canTakePart(userId: string): Promise<Result> {
  const member = await getCommunityMember(userId);
  if (!member?.joined) return { ok: false, error: "notMember" };
  if (member.suspendedUntil) return { ok: false, error: "suspended" };
  return { ok: true };
}

/** Début et fin en instants, d'après le fuseau de l'hôte ; erreur si c'est déjà passé. */
function instantsOf(input: CommunityEventInput, timeZone: string) {
  const startsAt = zonedInstant(input.startDay, input.startMinute, timeZone);
  const endsAt =
    input.endDay !== null && input.endMinute !== null
      ? zonedInstant(input.endDay, input.endMinute, timeZone)
      : null;
  return { startsAt, endsAt };
}

/** La photo de couverture : un seul envoi vérifié, une photo. */
async function verifiedCover(userId: string, cover: PostMediaInput) {
  const verified = await verifyMedia(userId, cover.slice(0, 1));
  if (!verified.ok) return null;
  const row = verified.media.rows[0];
  if (!row || row.kind !== "image") return null;
  return { row, uploadIds: verified.media.uploadIds };
}

/** Seulement les colonnes de l'événement (l'entrée validée contient aussi la langue). */
function eventData(input: CommunityEventInput) {
  return {
    title: input.title,
    description: input.description,
    topic: input.topic,
    format: input.format,
    location: input.location,
    region: input.region,
    onlineUrl: input.onlineUrl,
    capacity: input.capacity,
  };
}

/** Crée un événement ; renvoie son identifiant. */
export async function createCommunityEvent(
  userId: string,
  input: CommunityEventInput,
  cover: PostMediaInput,
): Promise<
  { ok: true; id: string } | { ok: false; error: CommunityEventError }
> {
  const allowed = await canTakePart(userId);
  if (!allowed.ok) return allowed;
  const now = new Date();
  const [created, upcoming, timeZone] = await Promise.all([
    db.communityEvent.count({
      where: {
        hostId: userId,
        createdAt: { gte: new Date(now.getTime() - DAY_MS) },
      },
    }),
    db.communityEvent.count({
      where: { hostId: userId, cancelledAt: null, AND: [notEnded(now)] },
    }),
    getUserTimeZone(userId),
  ]);
  if (created >= COMMUNITY_EVENT_LIMITS.perDay) {
    return { ok: false, error: "eventLimit" };
  }
  if (upcoming >= COMMUNITY_EVENT_LIMITS.upcoming) {
    return { ok: false, error: "upcomingLimit" };
  }
  const { startsAt, endsAt } = instantsOf(input, timeZone);
  if (startsAt < now) return { ok: false, error: "inPast" };
  const picture = cover.length > 0 ? await verifiedCover(userId, cover) : null;
  if (cover.length > 0 && !picture) return { ok: false, error: "coverInvalid" };

  const event = await db.$transaction(async (tx) => {
    const row = await tx.communityEvent.create({
      data: {
        hostId: userId,
        ...eventData(input),
        startsAt,
        endsAt,
        timeZone,
        coverPath: picture?.row.path ?? null,
        coverWidth: picture?.row.width ?? null,
        coverHeight: picture?.row.height ?? null,
      },
      select: { id: true },
    });
    if (picture) {
      const { count } = await tx.mediaUpload.updateMany({
        where: { id: { in: picture.uploadIds }, userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (count !== picture.uploadIds.length)
        throw new Error("Image déjà utilisée");
    }
    return row;
  });
  return { ok: true, id: event.id };
}

/** L'événement que l'hôte modifie ; null s'il n'est pas à lui. */
async function hostedEvent(userId: string, eventId: string) {
  return db.communityEvent.findFirst({
    where: { id: eventId, hostId: userId, status: { not: "removed" } },
    select: {
      id: true,
      title: true,
      format: true,
      location: true,
      onlineUrl: true,
      startsAt: true,
      endsAt: true,
      coverPath: true,
      cancelledAt: true,
    },
  });
}

/** Prévient les inscrits (changement ou annulation), jamais l'hôte lui-même. */
async function notifyAttendees(
  eventId: string,
  hostId: string,
  kind: "event_update" | "event_cancelled",
  title: string,
) {
  const attendees = await db.communityEventAttendee.findMany({
    where: { eventId },
    select: { userId: true },
  });
  await Promise.all(
    attendees.map((attendee) =>
      notify({
        userId: attendee.userId,
        kind,
        actorId: hostId,
        href: `/events/${eventId}`,
        subject: title,
      }),
    ),
  );
}

/**
 * Modifie un événement (l'hôte seulement). `cover` : garder, retirer ou une
 * nouvelle photo. Si la date, l'heure ou le lieu change, les inscrits sont prévenus.
 */
export async function updateCommunityEvent(
  userId: string,
  eventId: string,
  input: CommunityEventInput,
  cover: "keep" | "remove" | PostMediaInput,
): Promise<Result> {
  const event = await hostedEvent(userId, eventId);
  if (!event) return { ok: false, error: "notFound" };
  if (event.cancelledAt) return { ok: false, error: "cancelled" };
  const timeZone = await getUserTimeZone(userId);
  const { startsAt, endsAt } = instantsOf(input, timeZone);
  // Un événement déjà commencé garde son début ; un nouveau début ne peut pas être passé
  if (
    startsAt.getTime() !== event.startsAt.getTime() &&
    startsAt < new Date()
  ) {
    return { ok: false, error: "inPast" };
  }
  const picture =
    Array.isArray(cover) && cover.length > 0
      ? await verifiedCover(userId, cover)
      : null;
  if (Array.isArray(cover) && cover.length > 0 && !picture) {
    return { ok: false, error: "coverInvalid" };
  }
  const replaceCover = picture !== null || cover === "remove";
  await db.$transaction(async (tx) => {
    await tx.communityEvent.update({
      where: { id: eventId },
      data: {
        ...eventData(input),
        startsAt,
        endsAt,
        timeZone,
        ...(replaceCover
          ? {
              coverPath: picture?.row.path ?? null,
              coverWidth: picture?.row.width ?? null,
              coverHeight: picture?.row.height ?? null,
            }
          : {}),
      },
    });
    if (picture) {
      await tx.mediaUpload.updateMany({
        where: { id: { in: picture.uploadIds }, userId, usedAt: null },
        data: { usedAt: new Date() },
      });
    }
  });
  if (replaceCover && event.coverPath) {
    await removeFiles([event.coverPath]).catch(() => undefined);
  }
  const moved =
    startsAt.getTime() !== event.startsAt.getTime() ||
    (endsAt?.getTime() ?? null) !== (event.endsAt?.getTime() ?? null) ||
    input.format !== event.format ||
    input.location !== event.location ||
    input.onlineUrl !== event.onlineUrl;
  if (moved)
    await notifyAttendees(eventId, userId, "event_update", input.title);
  return { ok: true };
}

/** Annule un événement (l'hôte seulement) : il reste visible, marqué « Annulé ». */
export async function cancelCommunityEvent(
  userId: string,
  eventId: string,
): Promise<Result> {
  const event = await hostedEvent(userId, eventId);
  if (!event) return { ok: false, error: "notFound" };
  if (event.cancelledAt) return { ok: true };
  await db.communityEvent.update({
    where: { id: eventId },
    data: { cancelledAt: new Date() },
  });
  await notifyAttendees(eventId, userId, "event_cancelled", event.title);
  return { ok: true };
}

/** Supprime un événement et sa photo (l'hôte seulement) ; les inscrits sont prévenus s'il était à venir. */
export async function deleteCommunityEvent(
  userId: string,
  eventId: string,
): Promise<Result> {
  const event = await hostedEvent(userId, eventId);
  if (!event) return { ok: false, error: "notFound" };
  const upcoming = (event.endsAt ?? event.startsAt) > new Date();
  if (upcoming && !event.cancelledAt) {
    await notifyAttendees(eventId, userId, "event_cancelled", event.title);
  }
  await db.communityEvent.delete({ where: { id: eventId } });
  if (event.coverPath) {
    await removeFiles([event.coverPath]).catch(() => undefined);
  }
  return { ok: true };
}

/**
 * « J'y vais », « Intéressé » ou rien (`null`). L'hôte ne répond pas à son
 * propre événement ; « J'y vais » respecte le nombre de places. L'hôte est
 * prévenu quand quelqu'un y va (regroupé par événement).
 */
export async function setEventAttendance(
  userId: string,
  eventId: string,
  status: EventAttendanceStatus | null,
): Promise<Result> {
  const allowed = await canTakePart(userId);
  if (!allowed.ok) return allowed;
  const blocked = await getBlockedIds(userId);
  const now = new Date();
  const event = await db.communityEvent.findFirst({
    where: {
      AND: [
        { id: eventId, status: "visible" },
        visibleTo(userId, blocked, now),
      ],
    },
    select: {
      id: true,
      hostId: true,
      title: true,
      capacity: true,
      cancelledAt: true,
      startsAt: true,
      endsAt: true,
    },
  });
  if (!event || event.hostId === userId)
    return { ok: false, error: "notFound" };
  if (status === null) {
    await db.communityEventAttendee.deleteMany({ where: { eventId, userId } });
    return { ok: true };
  }
  if (event.cancelledAt) return { ok: false, error: "cancelled" };
  const end =
    event.endsAt ?? new Date(event.startsAt.getTime() + OPEN_ENDED_MS);
  if (end < now) return { ok: false, error: "ended" };
  const before = await db.communityEventAttendee.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { status: true },
  });
  if (status === "going" && before?.status !== "going" && event.capacity) {
    const going = await db.communityEventAttendee.count({
      where: { eventId, status: "going" },
    });
    if (going >= event.capacity) return { ok: false, error: "full" };
  }
  await db.communityEventAttendee.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { eventId, userId, status },
    update: { status },
  });
  if (status === "going" && before?.status !== "going") {
    await notify({
      userId: event.hostId,
      kind: "event_rsvp",
      actorId: userId,
      href: `/events/${eventId}`,
      subject: event.title,
      groupKey: `event:${eventId}`,
    });
  }
  return { ok: true };
}

/**
 * Ajoute l'événement à mon calendrier personnel (Mon développement), à l'heure
 * de mon fuseau : une copie privée, que je modifie ou supprime à part.
 */
export async function addCommunityEventToCalendar(
  userId: string,
  eventId: string,
  locale: "fr" | "en",
): Promise<Result & { day?: string }> {
  const event = await getCommunityEvent(userId, eventId);
  if (!event || event.cancelled) return { ok: false, error: "notFound" };
  const timeZone = await getUserTimeZone(userId);
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  const startsOn = toCalendarDay(start, timeZone);
  const startMinute = minuteOfDay(start, timeZone);
  const already = await db.calendarEvent.findFirst({
    where: {
      userId,
      title: event.title,
      startsOn: new Date(`${startsOn}T00:00:00.000Z`),
      startMinute,
    },
    select: { id: true },
  });
  if (already) return { ok: true, day: startsOn };
  const endsOn = end ? toCalendarDay(end, timeZone) : null;
  const endMinute = end ? minuteOfDay(end, timeZone) : null;
  const sameMinute = endsOn === startsOn && endMinute === startMinute;
  const created = await createCalendarEvent(userId, {
    locale,
    title: event.title,
    location: event.location,
    startsOn,
    startMinute,
    endsOn: sameMinute ? null : endsOn,
    endMinute: sameMinute ? null : endMinute,
    repeat: "none",
  });
  if (!created.ok) return { ok: false, error: "unexpected" };
  return { ok: true, day: startsOn };
}

/** L'événement à modifier, pour le formulaire de l'hôte (dans son fuseau). */
export async function getEventForEdit(userId: string, eventId: string) {
  const row = await db.communityEvent.findFirst({
    where: { id: eventId, hostId: userId, status: { not: "removed" } },
    select: {
      id: true,
      title: true,
      description: true,
      topic: true,
      format: true,
      location: true,
      region: true,
      onlineUrl: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      coverPath: true,
      cancelledAt: true,
    },
  });
  if (!row) return null;
  const timeZone = await getUserTimeZone(userId);
  const urls = await avatarUrls([row.coverPath]);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    topic: row.topic,
    format: row.format,
    location: row.location,
    region: row.region,
    onlineUrl: row.onlineUrl,
    startDay: toCalendarDay(row.startsAt, timeZone),
    startMinute: minuteOfDay(row.startsAt, timeZone),
    endDay: row.endsAt ? toCalendarDay(row.endsAt, timeZone) : null,
    endMinute: row.endsAt ? minuteOfDay(row.endsAt, timeZone) : null,
    capacity: row.capacity,
    coverUrl: row.coverPath ? (urls.get(row.coverPath) ?? null) : null,
    cancelled: row.cancelledAt !== null,
  };
}
export type EditableEvent = NonNullable<
  Awaited<ReturnType<typeof getEventForEdit>>
>;
