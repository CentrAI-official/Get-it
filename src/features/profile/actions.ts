"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { uploadRequestSchema } from "@/features/community/media";
import { requireUser } from "@/server/auth/session";
import {
  removeAvatar,
  requestAvatarUpload,
  setAvatar,
  setBio,
} from "@/server/profile/avatar";
import { BIO_MAX_LENGTH } from "./rules";

// Points d'entrée publics du profil : session et entrées revalidées ici.

export async function requestAvatarUploadAction(files: unknown) {
  const user = await requireUser();
  const parsed = uploadRequestSchema.safeParse(files);
  if (!parsed.success)
    return { ok: false as const, error: "mediaType" as const };
  try {
    return await requestAvatarUpload(user.id, parsed.data);
  } catch (error) {
    console.error("Envoi de la photo de profil impossible", error);
    return { ok: false as const, error: "unexpected" as const };
  }
}

const avatarSchema = z.object({
  uploadId: z.uuid(),
  width: z.number().int().min(1).max(4096),
  height: z.number().int().min(1).max(4096),
});

export async function setAvatarAction(upload: unknown) {
  const user = await requireUser();
  const parsed = avatarSchema.safeParse(upload);
  if (!parsed.success)
    return { ok: false as const, error: "mediaType" as const };
  try {
    const result = await setAvatar(user.id, parsed.data);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    console.error("Photo de profil impossible à enregistrer", error);
    return { ok: false as const, error: "unexpected" as const };
  }
}

export async function removeAvatarAction() {
  const user = await requireUser();
  const done = await removeAvatar(user.id).catch(() => false);
  if (done) refresh();
  return done;
}

const bioSchema = z
  .string()
  .trim()
  .max(BIO_MAX_LENGTH)
  .transform((value) => value || null);

export async function setBioAction(bio: unknown) {
  const user = await requireUser();
  const parsed = bioSchema.safeParse(bio);
  if (!parsed.success) return false;
  await setBio(user.id, parsed.data);
  refresh();
  return true;
}
