"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  postMediaSchema,
  uploadRequestSchema,
} from "@/features/community/media";
import {
  firstCommunityError,
  type CommunityError,
} from "@/features/community/rules";
import { requireUser } from "@/server/auth/session";
import type { UploadSlot } from "@/server/community/media";
import {
  attachJournalMedia,
  removeJournalMedia,
  requestJournalUploads,
  type JournalMediaError,
} from "@/server/journal/media";
import {
  saveJournalEntry,
  type SaveJournalResult,
} from "@/server/journal/service";
import { getUserTimeZone } from "@/server/profile/service";
import { journalEntrySchema } from "./rules";

/**
 * Enregistre une page du journal (appelée automatiquement pendant l'écriture).
 * Le jour vient du navigateur, mais le serveur revérifie qu'il est encore
 * modifiable dans le fuseau de l'utilisateur.
 */
export async function saveJournalAction(
  input: unknown,
): Promise<SaveJournalResult | { ok: false; error: "invalid" | "unexpected" }> {
  const user = await requireUser();
  const parsed = journalEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const timeZone = await getUserTimeZone(user.id);
    const result = await saveJournalEntry(user.id, timeZone, parsed.data);
    // Enregistrement automatique : la page n'est rafraîchie que si la série
    // ou l'XP changent (première version de la page, ou page vidée)
    if (result.ok && (result.xp > 0 || !result.saved)) refresh();
    return result;
  } catch (error) {
    console.error("Page du journal impossible à enregistrer", error);
    return { ok: false, error: "unexpected" };
  }
}

// Photos et vidéos d'une page : envoyées directement au stockage avec une
// autorisation du serveur, puis jointes à la page après vérification

const daySchema = z.iso.date();

export async function requestJournalUploadsAction(
  day: unknown,
  files: unknown,
): Promise<
  { ok: true; slots: UploadSlot[] } | { ok: false; error: CommunityError }
> {
  const user = await requireUser();
  const parsedDay = daySchema.safeParse(day);
  const parsed = uploadRequestSchema.safeParse(files);
  if (!parsedDay.success) return { ok: false, error: "unexpected" };
  if (!parsed.success) {
    return { ok: false, error: firstCommunityError(parsed.error) };
  }
  try {
    const timeZone = await getUserTimeZone(user.id);
    const result = await requestJournalUploads(
      user.id,
      timeZone,
      parsedDay.data,
      parsed.data,
    );
    if (result.ok) return result;
    // Page plus modifiable : l'envoi est refusé comme une erreur ordinaire
    return {
      ok: false,
      error: result.error === "locked" ? "unexpected" : result.error,
    };
  } catch (error) {
    console.error("Autorisation d'envoi du journal impossible", error);
    return { ok: false, error: "unexpected" };
  }
}

export async function attachJournalMediaAction(
  day: unknown,
  media: unknown,
): Promise<{ ok: true } | { ok: false; error: JournalMediaError }> {
  const user = await requireUser();
  const parsedDay = daySchema.safeParse(day);
  const parsed = postMediaSchema.safeParse(media);
  if (!parsedDay.success) return { ok: false, error: "unexpected" };
  if (!parsed.success) {
    return { ok: false, error: firstCommunityError(parsed.error) };
  }
  try {
    const timeZone = await getUserTimeZone(user.id);
    const result = await attachJournalMedia(
      user.id,
      timeZone,
      parsedDay.data,
      parsed.data,
    );
    if (result.ok) refresh();
    return result;
  } catch (error) {
    console.error("Média du journal impossible à joindre", error);
    return { ok: false, error: "unexpected" };
  }
}

export async function removeJournalMediaAction(mediaId: unknown) {
  const user = await requireUser();
  const id = z.uuid().safeParse(mediaId);
  if (!id.success) return false;
  try {
    const timeZone = await getUserTimeZone(user.id);
    const result = await removeJournalMedia(user.id, timeZone, id.data);
    if (result.ok) refresh();
    return result.ok;
  } catch (error) {
    console.error("Média du journal impossible à retirer", error);
    return false;
  }
}
