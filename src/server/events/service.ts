import "server-only";
import {
  MAX_EVENTS,
  type CalendarEvent,
  type EventError,
  type EventInput,
} from "@/features/events/rules";
import { fromDbDate, toDbDate } from "@/lib/dates";
import { db } from "@/server/db";

// Calendrier personnel. Chaque fonction reçoit l'userId de la session et filtre
// dessus : un événement n'est jamais lu ni modifié par quelqu'un d'autre.

const eventSelect = {
  id: true,
  title: true,
  location: true,
  startsOn: true,
  startMinute: true,
  endsOn: true,
  endMinute: true,
  repeat: true,
} as const;

function toEvent(row: {
  id: string;
  title: string;
  location: string | null;
  startsOn: Date;
  startMinute: number;
  endsOn: Date;
  endMinute: number;
  repeat: CalendarEvent["repeat"];
}): CalendarEvent {
  return {
    ...row,
    startsOn: fromDbDate(row.startsOn),
    endsOn: fromDbDate(row.endsOn),
  };
}

/** Seulement les colonnes de l'événement (l'entrée validée contient aussi la langue). */
function toEventData(input: EventInput) {
  return {
    title: input.title,
    location: input.location,
    startsOn: toDbDate(input.startsOn),
    startMinute: input.startMinute,
    endsOn: toDbDate(input.endsOn),
    endMinute: input.endMinute,
    repeat: input.repeat,
  };
}

/**
 * Événements qui peuvent tomber entre `from` et `to` : ceux qui commencent dans
 * la période, et ceux qui se répètent et ont commencé avant sa fin.
 */
export async function listEventsBetween(
  userId: string,
  from: string,
  to: string,
): Promise<CalendarEvent[]> {
  const rows = await db.calendarEvent.findMany({
    where: {
      userId,
      startsOn: { lte: toDbDate(to) },
      OR: [{ repeat: { not: "none" } }, { startsOn: { gte: toDbDate(from) } }],
    },
    orderBy: [{ startMinute: "asc" }, { createdAt: "asc" }],
    take: MAX_EVENTS,
    select: eventSelect,
  });
  return rows.map(toEvent);
}

/** Un événement à modifier, ou null s'il n'existe pas pour cet utilisateur. */
export async function getEvent(userId: string, eventId: string) {
  const row = await db.calendarEvent.findFirst({
    where: { id: eventId, userId },
    select: eventSelect,
  });
  return row ? toEvent(row) : null;
}

export async function createEvent(
  userId: string,
  input: EventInput,
): Promise<{ ok: true } | { ok: false; error: EventError }> {
  const count = await db.calendarEvent.count({ where: { userId } });
  if (count >= MAX_EVENTS) return { ok: false, error: "eventLimit" };
  await db.calendarEvent.create({ data: { userId, ...toEventData(input) } });
  return { ok: true };
}

/** Modifie un événement. Faux s'il n'existe pas pour cet utilisateur. */
export async function updateEvent(
  userId: string,
  eventId: string,
  input: EventInput,
) {
  const { count } = await db.calendarEvent.updateMany({
    where: { id: eventId, userId },
    data: toEventData(input),
  });
  return count > 0;
}

/** Supprime un événement (et toutes ses répétitions). */
export async function deleteEvent(userId: string, eventId: string) {
  const { count } = await db.calendarEvent.deleteMany({
    where: { id: eventId, userId },
  });
  return count > 0;
}
