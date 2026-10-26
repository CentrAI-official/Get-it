"use server";

import { hasLocale } from "next-intl";
import { refresh } from "next/cache";
import { z } from "zod";
import type { ConfirmState } from "@/components/confirm-dialog";
import { uploadRequestSchema } from "@/features/community/media";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { requireUser } from "@/server/auth/session";
import {
  removeGoalPhoto,
  requestGoalPhotoUpload,
  setGoalPhoto,
} from "@/server/goals/photo";
import {
  addMilestone,
  createGoal,
  deleteGoal,
  deleteMilestone,
  setGoalStatus,
  setMilestoneDone,
  updateGoal,
} from "@/server/goals/service";
import {
  firstGoalError,
  GOAL_STATUSES,
  goalFieldErrors,
  goalFormSchema,
  milestoneFormSchema,
  recordIdSchema,
  type GoalFormState,
  type ItemFormState,
} from "./schemas";

// Chaque Server Action est un point d'entrée public : session, identifiants
// et saisies sont revalidés ici, et les services filtrent sur l'utilisateur.

function goalFormValues(formData: FormData) {
  const read = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };
  return {
    title: read("title"),
    description: read("description"),
    pillar: read("pillar"),
    targetDate: read("targetDate"),
  };
}

function invalidGoalForm(error: z.ZodError, formData: FormData): GoalFormState {
  const fieldErrors = goalFieldErrors(error);
  return {
    status: "error",
    fieldErrors,
    // Champ caché altéré (ex. langue) : aucune erreur de champ à afficher
    error: Object.keys(fieldErrors).length === 0 ? "unexpected" : undefined,
    values: goalFormValues(formData),
  };
}

export async function createGoalAction(
  _previous: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const user = await requireUser();
  const parsed = goalFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidGoalForm(parsed.error, formData);

  let goalId: string;
  try {
    const created = await createGoal(user.id, parsed.data);
    if (!created.ok) {
      return {
        status: "error",
        fieldErrors: { pillar: created.error },
        values: goalFormValues(formData),
      };
    }
    goalId = created.id;
  } catch (error) {
    console.error("Création de l'objectif impossible", error);
    return {
      status: "error",
      error: "unexpected",
      values: goalFormValues(formData),
    };
  }
  return redirect({ href: `/goals/${goalId}`, locale: parsed.data.locale });
}

export async function updateGoalAction(
  goalId: string,
  _previous: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(goalId);
  if (!id.success) return { status: "error", error: "notFound" };
  const parsed = goalFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidGoalForm(parsed.error, formData);

  try {
    const updated = await updateGoal(user.id, id.data, parsed.data);
    if (!updated) return { status: "error", error: "notFound" };
    if (updated === "goalLimit") {
      return {
        status: "error",
        fieldErrors: { pillar: "goalLimit" },
        values: goalFormValues(formData),
      };
    }
  } catch (error) {
    console.error("Modification de l'objectif impossible", error);
    return {
      status: "error",
      error: "unexpected",
      values: goalFormValues(formData),
    };
  }
  return redirect({ href: `/goals/${id.data}`, locale: parsed.data.locale });
}

/** Atteint, repris ou archivé ; « goalLimit » si l'aspect a déjà 3 objectifs en cours. */
export async function setGoalStatusAction(
  goalId: string,
  status: string,
): Promise<{ ok: boolean; error?: "goalLimit" }> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(goalId);
  const nextStatus = z.enum(GOAL_STATUSES).safeParse(status);
  if (!id.success || !nextStatus.success) return { ok: false };

  try {
    const result = await setGoalStatus(user.id, id.data, nextStatus.data);
    if (result === "goalLimit") return { ok: false, error: "goalLimit" };
    refresh();
    return { ok: result };
  } catch (error) {
    console.error("Changement de statut impossible", error);
    return { ok: false };
  }
}

// Photo d'un objectif : mêmes envois vérifiés que la photo de profil

export async function requestGoalPhotoUploadAction(
  goalId: unknown,
  files: unknown,
) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(goalId);
  const parsed = uploadRequestSchema.safeParse(files);
  if (!id.success) return { ok: false as const, error: "notFound" as const };
  if (!parsed.success) {
    return { ok: false as const, error: "mediaType" as const };
  }
  try {
    return await requestGoalPhotoUpload(user.id, id.data, parsed.data);
  } catch (error) {
    console.error("Envoi de la photo de l'objectif impossible", error);
    return { ok: false as const, error: "unexpected" as const };
  }
}

const goalPhotoSchema = z.object({
  uploadId: z.uuid(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export async function setGoalPhotoAction(goalId: unknown, upload: unknown) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(goalId);
  const parsed = goalPhotoSchema.safeParse(upload);
  if (!id.success) return { ok: false as const, error: "notFound" as const };
  if (!parsed.success) {
    return { ok: false as const, error: "mediaType" as const };
  }
  try {
    const result = await setGoalPhoto(user.id, id.data, parsed.data);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    console.error("Photo de l'objectif impossible à enregistrer", error);
    return { ok: false as const, error: "unexpected" as const };
  }
}

export async function removeGoalPhotoAction(goalId: unknown) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(goalId);
  if (!id.success) return false;
  const done = await removeGoalPhoto(user.id, id.data).catch(() => false);
  if (done) refresh();
  return done;
}

export async function deleteGoalAction(
  goalId: string,
  _previous: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(goalId);
  if (!id.success) return { status: "error" };
  const value = formData.get("locale");
  const locale = hasLocale(routing.locales, value)
    ? value
    : routing.defaultLocale;

  try {
    await deleteGoal(user.id, id.data);
  } catch (error) {
    console.error("Suppression de l'objectif impossible", error);
    return { status: "error" };
  }
  return redirect({ href: "/goals", locale });
}

export async function addMilestoneAction(
  goalId: string,
  _previous: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(goalId);
  if (!id.success) return { status: "error", error: "notFound" };
  const parsed = milestoneFormSchema.safeParse(Object.fromEntries(formData));
  const title = formData.get("title");
  const values = { title: typeof title === "string" ? title : undefined };
  if (!parsed.success) {
    return { status: "error", error: firstGoalError(parsed.error), values };
  }

  try {
    const added = await addMilestone(user.id, id.data, parsed.data.title);
    if (!added) return { status: "error", error: "notFound" };
  } catch (error) {
    console.error("Ajout du jalon impossible", error);
    return { status: "error", error: "unexpected", values };
  }
  refresh();
  return { status: "success" };
}

export async function setMilestoneDoneAction(
  milestoneId: string,
  done: boolean,
) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(milestoneId);
  if (!id.success || typeof done !== "boolean") return;

  try {
    await setMilestoneDone(user.id, id.data, done);
  } catch (error) {
    console.error("Mise à jour du jalon impossible", error);
  }
  refresh();
}

export async function deleteMilestoneAction(milestoneId: string) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(milestoneId);
  if (!id.success) return;

  try {
    await deleteMilestone(user.id, id.data);
  } catch (error) {
    console.error("Suppression du jalon impossible", error);
  }
  refresh();
}
