"use server";

import { refresh } from "next/cache";
import { recordIdSchema } from "@/features/goals/schemas";
import { requireUser } from "@/server/auth/session";
import {
  createMusicTrack,
  requestMusicUpload,
  setTrackActive,
} from "@/server/stories/music";
import { musicTrackFormSchema, musicUploadSchema } from "./music";

// Catalogue de musique, pour l'équipe Get iT (rôle admin revérifié par le service).

/** Autorisation d'envoi d'un fichier audio. */
export async function requestMusicUploadAction(input: unknown) {
  const user = await requireUser();
  const parsed = musicUploadSchema.safeParse(input);
  if (!parsed.success) return null;
  return requestMusicUpload(user.id, parsed.data.contentType).catch(
    (error: unknown) => {
      console.error("Envoi de musique impossible", error);
      return null;
    },
  );
}

/** Ajoute un morceau au catalogue, après l'envoi de son fichier. */
export async function createMusicTrackAction(input: unknown) {
  const user = await requireUser();
  const parsed = musicTrackFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid" };
  try {
    const result = await createMusicTrack(user.id, parsed.data);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    console.error("Morceau impossible à ajouter", error);
    return { ok: false as const, error: "unexpected" };
  }
}

/** Retire un morceau du catalogue (ou le remet). */
export async function setTrackActiveAction(trackId: unknown, active: unknown) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(trackId);
  if (!id.success || typeof active !== "boolean") return false;
  const done = await setTrackActive(user.id, id.data, active).catch(
    () => false,
  );
  if (done) refresh();
  return done;
}
