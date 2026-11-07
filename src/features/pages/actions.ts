"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { uploadRequestSchema } from "@/features/community/media";
import { requireUser } from "@/server/auth/session";
import { setPageFollow, type PageFollowError } from "@/server/pages/follows";
import {
  createPage,
  deletePage,
  PAGE_IMAGES,
  removePageImage,
  requestPageImageUpload,
  setPageImage,
  updatePage,
} from "@/server/pages/service";
import {
  pageFieldErrors,
  pageFormSchema,
  type PageError,
  type PageField,
} from "./rules";

// Points d'entrée publics des pages pro : session et saisies revalidées ici.

export type PageFormState = {
  status: "idle" | "error" | "saved";
  error?: PageError;
  fieldErrors?: Partial<Record<PageField, PageError>>;
  handle?: string;
};

/** Crée la page (`mode` « create ») ou la modifie (« update »). */
export async function savePageAction(
  mode: "create" | "update",
  _previous: PageFormState,
  formData: FormData,
): Promise<PageFormState> {
  const user = await requireUser();
  const parsed = pageFormSchema.safeParse({
    ...Object.fromEntries(formData),
    regions: formData.getAll("regions"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: pageFieldErrors(parsed.error) };
  }
  try {
    const result =
      mode === "create"
        ? await createPage(user.id, parsed.data)
        : await updatePage(user.id, parsed.data);
    if (!result.ok) {
      return result.error === "handleTaken"
        ? { status: "error", fieldErrors: { handle: "handleTaken" } }
        : { status: "error", error: result.error };
    }
    refresh();
    return { status: "saved", handle: result.handle };
  } catch (error) {
    console.error("Page : enregistrement impossible", error);
    return { status: "error", error: "unexpected" };
  }
}

/** Supprime la page et ses annonces. */
export async function deletePageAction() {
  const user = await requireUser();
  try {
    return await deletePage(user.id);
  } catch (error) {
    console.error("Page : suppression impossible", error);
    return false;
  }
}

const imageSchema = z.enum(PAGE_IMAGES);

/** Autorisation d'envoi du logo ou de la couverture. */
export async function requestPageImageUploadAction(files: unknown) {
  const user = await requireUser();
  const parsed = uploadRequestSchema.safeParse(files);
  if (!parsed.success)
    return { ok: false as const, error: "mediaType" as const };
  return requestPageImageUpload(user.id, parsed.data);
}

const uploadSchema = z.strictObject({
  uploadId: z.uuid(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

/** Le logo ou la couverture, une fois le fichier envoyé. */
export async function setPageImageAction(which: unknown, upload: unknown) {
  const user = await requireUser();
  const image = imageSchema.safeParse(which);
  const parsed = uploadSchema.safeParse(upload);
  if (!image.success || !parsed.success) {
    return { ok: false as const, error: "unexpected" as const };
  }
  const result = await setPageImage(user.id, image.data, parsed.data);
  if (result.ok) refresh();
  return result;
}

/** Retire le logo ou la couverture. */
export async function removePageImageAction(which: unknown) {
  const user = await requireUser();
  const image = imageSchema.safeParse(which);
  if (!image.success) return false;
  const removed = await removePageImage(user.id, image.data);
  if (removed) refresh();
  return removed;
}

/** S'abonner à une page pro, ou se désabonner. */
export async function setPageFollowAction(
  pageId: unknown,
  follow: unknown,
): Promise<{ ok: true } | { ok: false; error: PageFollowError }> {
  const user = await requireUser();
  const id = z.uuid().safeParse(pageId);
  if (!id.success || typeof follow !== "boolean") {
    return { ok: false, error: "notFound" };
  }
  try {
    return await setPageFollow(user.id, id.data, follow);
  } catch (error) {
    console.error("Abonnement à une page impossible", error);
    return { ok: false, error: "notFound" };
  }
}
