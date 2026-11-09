"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { postMediaSchema } from "@/features/community/media";
import { recordIdSchema } from "@/features/goals/schemas";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { toCalendarDay } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";
import {
  addCommunityEventToCalendar,
  addEventComment,
  cancelCommunityEvent,
  createCommunityEvent,
  deleteCommunityEvent,
  deleteEventComment,
  setEventAttendance,
  updateCommunityEvent,
} from "@/server/community-events/service";
import { actingFor } from "@/server/pages/identity";
import { getUserTimeZone } from "@/server/profile/service";
import {
  EVENT_ATTENDANCE,
  communityEventFieldErrors,
  communityEventFormSchema,
  eventCommentSchema,
  type CommunityEventError,
  type CommunityEventField,
} from "./rules";

// Points d'entrée publics : session, identifiants et saisies revalidés ici ;
// le service revérifie l'appartenance au Centre, l'hôte et les blocages.

export type CommunityEventFormState = {
  status: "idle" | "error";
  error?: CommunityEventError;
  fieldErrors?: Partial<Record<CommunityEventField, CommunityEventError>>;
};

const read = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

/** Photo de couverture : un envoi (comme une publication), « keep » ou « remove ». */
function coverOf(formData: FormData) {
  const raw = read(formData, "cover");
  if (raw === "keep" || raw === "remove") return raw;
  try {
    const parsed = postMediaSchema.safeParse(JSON.parse(raw || "[]"));
    return parsed.success ? parsed.data.slice(0, 1) : null;
  } catch {
    return null;
  }
}

/** Crée (`eventId` null) ou modifie un événement, puis ouvre sa page. */
export async function saveCommunityEventAction(
  eventId: string | null,
  _previous: CommunityEventFormState,
  formData: FormData,
): Promise<CommunityEventFormState> {
  const user = await requireUser();
  const id = eventId === null ? null : recordIdSchema.safeParse(eventId);
  if (id && !id.success) return { status: "error", error: "notFound" };
  const timeZone = await getUserTimeZone(user.id);
  const parsed = communityEventFormSchema(
    toCalendarDay(new Date(), timeZone),
  ).safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: communityEventFieldErrors(parsed.error),
    };
  }
  const cover = coverOf(formData);
  if (cover === null) return { status: "error", error: "coverInvalid" };

  let target: string;
  try {
    if (id) {
      const result = await updateCommunityEvent(
        user.id,
        id.data,
        parsed.data,
        cover,
      );
      if (!result.ok) return { status: "error", error: result.error };
      target = id.data;
    } else {
      // Au nom du compte actif (sa page en mode page, retrouvée par la session),
      // ou dans un groupe (l'appartenance est revérifiée par le service)
      const acting = await actingFor(
        user.id,
        read(formData, "identity") || null,
      );
      if (!acting.ok) return { status: "error", error: "notAsPage" };
      const group = recordIdSchema.safeParse(read(formData, "groupId"));
      const result = await createCommunityEvent(
        user.id,
        parsed.data,
        cover === "keep" || cover === "remove" ? [] : cover,
        {
          pageId: acting.pageId,
          groupId: group.success ? group.data : null,
        },
      );
      if (!result.ok) return { status: "error", error: result.error };
      target = result.id;
    }
  } catch (error) {
    console.error("Enregistrement de l'événement impossible", error);
    return { status: "error", error: "unexpected" };
  }
  return redirect({ href: `/events/${target}`, locale: parsed.data.locale });
}

export type EventActionResult =
  { ok: true; day?: string } | { ok: false; error: CommunityEventError };

async function guarded(
  run: () => Promise<EventActionResult>,
): Promise<EventActionResult> {
  try {
    const result = await run();
    if (result.ok) refresh();
    return result;
  } catch (error) {
    console.error("Action sur l'événement impossible", error);
    return { ok: false, error: "unexpected" };
  }
}

/** « J'y vais », « Intéressé », ou retirer sa réponse (null). */
export async function setAttendanceAction(
  eventId: unknown,
  status: unknown,
): Promise<EventActionResult> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(eventId);
  const value = z.enum(EVENT_ATTENDANCE).nullable().safeParse(status);
  if (!id.success || !value.success) return { ok: false, error: "notFound" };
  // Une page ne va pas aux événements : seulement le compte personnel
  const acting = await actingFor(user.id, null);
  if (!acting.ok || acting.pageId) return { ok: false, error: "notAsPage" };
  return guarded(() => setEventAttendance(user.id, id.data, value.data));
}

/** Copie l'événement dans mon calendrier personnel. */
export async function addToCalendarAction(
  eventId: unknown,
  locale: unknown,
): Promise<EventActionResult> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(eventId);
  const lang = z.enum(routing.locales).safeParse(locale);
  if (!id.success || !lang.success) return { ok: false, error: "notFound" };
  return guarded(() =>
    addCommunityEventToCalendar(user.id, id.data, lang.data),
  );
}

/** Annule l'événement (hôte) : les inscrits sont prévenus. */
export async function cancelEventAction(
  eventId: unknown,
): Promise<EventActionResult> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(eventId);
  if (!id.success) return { ok: false, error: "notFound" };
  return guarded(() => cancelCommunityEvent(user.id, id.data));
}

/** Supprime l'événement (hôte), puis revient à l'annuaire. */
export async function deleteEventAction(
  eventId: unknown,
  locale: unknown,
): Promise<EventActionResult> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(eventId);
  const lang = z.enum(routing.locales).safeParse(locale);
  if (!id.success || !lang.success) return { ok: false, error: "notFound" };
  try {
    const result = await deleteCommunityEvent(user.id, id.data);
    if (!result.ok) return result;
  } catch (error) {
    console.error("Suppression de l'événement impossible", error);
    return { ok: false, error: "unexpected" };
  }
  return redirect({ href: "/events", locale: lang.data });
}

/** Écrit dans la discussion, au nom du compte sous lequel l'écran a été chargé. */
export async function addEventCommentAction(
  eventId: unknown,
  body: unknown,
  identity: unknown,
): Promise<EventActionResult> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(eventId);
  if (!id.success) return { ok: false, error: "notFound" };
  const text = eventCommentSchema.safeParse(body);
  if (!text.success) {
    const message = text.error.issues[0]?.message;
    return {
      ok: false,
      error:
        message === "commentTooLong" ? "commentTooLong" : "commentRequired",
    };
  }
  const acting = await actingFor(user.id, identity);
  if (!acting.ok) return { ok: false, error: "notAsPage" };
  return guarded(() =>
    addEventComment(user.id, id.data, text.data, acting.pageId),
  );
}

/** Retire un message de la discussion (le sien, ou tous pour l'hôte). */
export async function deleteEventCommentAction(
  commentId: unknown,
): Promise<EventActionResult> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(commentId);
  if (!id.success) return { ok: false, error: "notFound" };
  return guarded(async () =>
    (await deleteEventComment(user.id, id.data))
      ? { ok: true }
      : { ok: false, error: "notFound" },
  );
}
