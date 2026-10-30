"use server";

import { refresh, revalidatePath } from "next/cache";
import { recordIdSchema } from "@/features/goals/schemas";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { requireUser } from "@/server/auth/session";
import { createEvent, deleteEvent, updateEvent } from "@/server/events/service";
import {
  eventFieldErrors,
  eventFormSchema,
  type EventError,
  type EventField,
} from "./rules";

// Points d'entrée publics : session, identifiants et saisies sont revalidés ici.

/** Le calendrier déjà visité (gardé par Next) est relu au retour, pas réaffiché tel quel. */
const CALENDAR_PAGE = "/[locale]/services";

export type EventFormState = {
  status: "idle" | "error";
  error?: EventError;
  fieldErrors?: Partial<Record<EventField, EventError>>;
};

/** Ajoute (`eventId` null) ou modifie un événement, puis revient au calendrier sur son jour. */
export async function saveEventAction(
  eventId: string | null,
  _previous: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const user = await requireUser();
  const id = eventId === null ? null : recordIdSchema.safeParse(eventId);
  if (id && !id.success) return { status: "error", error: "notFound" };

  const parsed = eventFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: eventFieldErrors(parsed.error) };
  }

  try {
    if (id) {
      const updated = await updateEvent(user.id, id.data, parsed.data);
      if (!updated) return { status: "error", error: "notFound" };
    } else {
      const created = await createEvent(user.id, parsed.data);
      if (!created.ok) return { status: "error", error: created.error };
    }
  } catch (error) {
    console.error("Enregistrement de l'événement impossible", error);
    return { status: "error", error: "unexpected" };
  }
  revalidatePath(CALENDAR_PAGE, "page");
  return redirect({
    href: { pathname: "/services", query: { day: parsed.data.startsOn } },
    locale: parsed.data.locale,
  });
}

/** Supprime un événement depuis le calendrier (glisser, puis « Supprimer »). */
export async function deleteEventAction(eventId: string) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(eventId);
  if (!id.success) return false;
  try {
    const deleted = await deleteEvent(user.id, id.data);
    refresh();
    return deleted;
  } catch (error) {
    console.error("Suppression de l'événement impossible", error);
    return false;
  }
}

/** Supprime un événement depuis sa page, puis revient au calendrier. */
export async function deleteEventAndReturnAction(
  eventId: string,
  locale: string,
) {
  await deleteEventAction(eventId);
  revalidatePath(CALENDAR_PAGE, "page");
  const target = routing.locales.find((value) => value === locale);
  return redirect({
    href: "/services",
    locale: target ?? routing.defaultLocale,
  });
}
