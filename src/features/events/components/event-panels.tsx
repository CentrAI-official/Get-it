import { notFound } from "next/navigation";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { recordIdSchema } from "@/features/goals/schemas";
import { minuteOfDay, toCalendarDay } from "@/lib/dates";
import { getEvent } from "@/server/events/service";
import { getCurrentProfile } from "@/server/profile/service";
import { EventForm } from "./event-form";

// Pages du calendrier personnel. Chacune lit la session : à placer dans un <Suspense>.

const daySchema = z.iso.date();

/** Nouvel événement, sur le jour choisi dans le calendrier (aujourd'hui par défaut). */
export async function NewEventLoader({ day }: { day: string | undefined }) {
  const profile = await getCurrentProfile();
  const now = new Date();
  const today = toCalendarDay(now, profile.timeZone);
  const chosen = daySchema.safeParse(day);
  const start = chosen.success ? chosen.data : today;
  // Aujourd'hui : l'heure pile suivante ; un autre jour : 9 h
  const nextHour = Math.min(
    23 * 60,
    (Math.floor(minuteOfDay(now, profile.timeZone) / 60) + 1) * 60,
  );
  return (
    <EventForm
      event={null}
      defaults={{ day: start, minute: start === today ? nextHour : 9 * 60 }}
    />
  );
}

/** Modifier un événement : introuvable s'il n'est pas à la personne. */
export async function EditEventLoader({ id }: { id: string }) {
  const profile = await getCurrentProfile();
  const eventId = recordIdSchema.safeParse(id);
  if (!eventId.success) notFound();
  const event = await getEvent(profile.id, eventId.data);
  if (!event) notFound();
  return (
    <EventForm
      event={event}
      defaults={{ day: event.startsOn, minute: event.startMinute }}
    />
  );
}

export function EventFormSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-26 rounded-2xl" />
      <Skeleton className="h-26 rounded-2xl" />
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-10 w-28 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-12 rounded-full" />
    </div>
  );
}
