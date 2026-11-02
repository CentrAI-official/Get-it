"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { IMAGE_TYPES, VIDEO_TYPES } from "@/features/community/media";
import { requireUser } from "@/server/auth/session";
import {
  addLibraryItemToPlan,
  replaceInPlan,
} from "@/server/development/library";
import {
  deleteLibraryItem,
  importLibrarySeed,
  requestLibraryUpload,
  saveLibraryItem,
  setLibraryStatus,
  type LibrarySaveResult,
} from "@/server/library/service";
import { LIBRARY_STATUSES, libraryItemSchema, MEALS } from "./rules";

// Points d'entrée publics du catalogue. Gestion : réservée à l'équipe Get iT
// (le service revérifie le rôle admin à chaque appel). « Ajouter à mon plan »
// et « Remplacer… » : tout membre, sur son propre plan. Entrées revalidées ici.

const mediaPath = z
  .string()
  .regex(/^library\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/)
  .nullable()
  .optional();

const saveSchema = z.object({
  id: z.uuid().nullable(),
  item: libraryItemSchema,
  status: z.enum(LIBRARY_STATUSES),
  imagePath: mediaPath,
  videoPath: mediaPath,
});

/** Crée ou modifie une fiche du catalogue. */
export async function saveLibraryItemAction(
  input: unknown,
): Promise<LibrarySaveResult | { ok: false; error: "invalid" }> {
  const user = await requireUser();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { id, item, status, imagePath, videoPath } = parsed.data;
  const result = await saveLibraryItem(user.id, id, {
    ...item,
    status,
    imagePath,
    videoPath,
  });
  if (result.ok) refresh();
  return result;
}

const uploadSchema = z.discriminatedUnion("media", [
  z.object({ media: z.literal("image"), contentType: z.enum(IMAGE_TYPES) }),
  z.object({ media: z.literal("video"), contentType: z.enum(VIDEO_TYPES) }),
]);

/** Autorisation d'envoi d'une image ou d'une vidéo du catalogue. */
export async function requestLibraryUploadAction(input: unknown) {
  const user = await requireUser();
  const parsed = uploadSchema.safeParse(input);
  if (!parsed.success) return null;
  return requestLibraryUpload(
    user.id,
    parsed.data.media,
    parsed.data.contentType,
  );
}

/** Publie une fiche, ou la remet en brouillon. */
export async function setLibraryStatusAction(id: unknown, status: unknown) {
  const user = await requireUser();
  const parsed = z
    .object({ id: z.uuid(), status: z.enum(LIBRARY_STATUSES) })
    .safeParse({ id, status });
  if (!parsed.success) return false;
  const ok = await setLibraryStatus(
    user.id,
    parsed.data.id,
    parsed.data.status,
  );
  if (ok) refresh();
  return ok;
}

/** Supprime une fiche et ses fichiers. */
export async function deleteLibraryItemAction(id: unknown) {
  const user = await requireUser();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return false;
  return deleteLibraryItem(user.id, parsed.data);
}

/** Importe le contenu de départ en brouillons (une seule fois par fiche). */
export async function importLibrarySeedAction() {
  const user = await requireUser();
  const count = await importLibrarySeed(user.id);
  if (count !== null) refresh();
  return count;
}

const planDaySchema = z.number().int().min(1).max(7);

/** « Ajouter à mon plan » : la fiche va dans la séance d'un jour (un repas pour une recette). */
export async function addToPlanAction(input: unknown) {
  const user = await requireUser();
  const parsed = z
    .object({
      id: z.uuid(),
      weekday: planDaySchema,
      meal: z.enum(MEALS).nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid" as const };
  const result = await addLibraryItemToPlan(user.id, parsed.data.id, {
    weekday: parsed.data.weekday,
    meal: parsed.data.meal,
  });
  if (result.ok) refresh();
  return result;
}

/** « Remplacer… » : la fiche prend la place d'un élément du plan. */
export async function replaceInPlanAction(input: unknown) {
  const user = await requireUser();
  const parsed = z
    .object({
      id: z.uuid(),
      weekday: planDaySchema,
      index: z.number().int().min(0).max(20),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid" as const };
  const result = await replaceInPlan(user.id, parsed.data.id, {
    weekday: parsed.data.weekday,
    index: parsed.data.index,
  });
  if (result.ok) refresh();
  return result;
}
