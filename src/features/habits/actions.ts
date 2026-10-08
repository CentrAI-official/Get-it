"use server";

import { hasLocale } from "next-intl";
import { refresh } from "next/cache";
import { z } from "zod";
import type { ConfirmState } from "@/components/confirm-dialog";
import { recordIdSchema } from "@/features/goals/schemas";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { requireUser } from "@/server/auth/session";
import {
  createHabit,
  deleteHabit,
  setHabitArchived,
  setHabitDay,
  updateHabit,
} from "@/server/habits/service";
import { getUserTimeZone } from "@/server/profile/service";
import {
  habitFieldErrors,
  habitFormSchema,
  type HabitFormState,
} from "./schemas";

// Chaque Server Action est un point d'entrée public : session, identifiants
// et saisies sont revalidés ici, et les services filtrent sur l'utilisateur.

function habitFormValues(formData: FormData) {
  const read = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };
  return {
    title: read("title"),
    pillar: read("pillar"),
    weekdays: read("weekdays"),
    goalId: read("goalId"),
  };
}

function invalidHabitForm(
  error: z.ZodError,
  formData: FormData,
): HabitFormState {
  const fieldErrors = habitFieldErrors(error);
  return {
    status: "error",
    fieldErrors,
    // Champ caché altéré (ex. langue) : aucune erreur de champ à afficher
    error: Object.keys(fieldErrors).length === 0 ? "unexpected" : undefined,
    values: habitFormValues(formData),
  };
}

export async function createHabitAction(
  _previous: HabitFormState,
  formData: FormData,
): Promise<HabitFormState> {
  const user = await requireUser();
  const parsed = habitFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidHabitForm(parsed.error, formData);

  try {
    const habitId = await createHabit(user.id, parsed.data);
    if (!habitId) {
      return {
        status: "error",
        error: "notFound",
        values: habitFormValues(formData),
      };
    }
  } catch (error) {
    console.error("Création de l'habitude impossible", error);
    return {
      status: "error",
      error: "unexpected",
      values: habitFormValues(formData),
    };
  }
  return redirect({ href: "/habits", locale: parsed.data.locale });
}

export async function updateHabitAction(
  habitId: string,
  _previous: HabitFormState,
  formData: FormData,
): Promise<HabitFormState> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(habitId);
  if (!id.success) return { status: "error", error: "notFound" };
  const parsed = habitFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidHabitForm(parsed.error, formData);

  try {
    const updated = await updateHabit(user.id, id.data, parsed.data);
    if (!updated) return { status: "error", error: "notFound" };
  } catch (error) {
    console.error("Modification de l'habitude impossible", error);
    return {
      status: "error",
      error: "unexpected",
      values: habitFormValues(formData),
    };
  }
  return redirect({ href: "/habits", locale: parsed.data.locale });
}

export async function setHabitArchivedAction(
  habitId: string,
  archived: boolean,
) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(habitId);
  if (!id.success || typeof archived !== "boolean") return;

  try {
    await setHabitArchived(user.id, id.data, archived);
  } catch (error) {
    console.error("Mise en pause de l'habitude impossible", error);
  }
  refresh();
}

export async function deleteHabitAction(
  habitId: string,
  _previous: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(habitId);
  if (!id.success) return { status: "error" };
  const value = formData.get("locale");
  const locale = hasLocale(routing.locales, value)
    ? value
    : routing.defaultLocale;

  try {
    await deleteHabit(user.id, id.data);
  } catch (error) {
    console.error("Suppression de l'habitude impossible", error);
    return { status: "error" };
  }
  return redirect({ href: "/habits", locale });
}

/** Coche ou décoche un jour (aujourd'hui ou un oubli des derniers jours). */
export async function setHabitDayAction(
  habitId: string,
  day: string,
  done: boolean,
) {
  const user = await requireUser();
  const id = recordIdSchema.safeParse(habitId);
  const parsedDay = z.iso.date().safeParse(day);
  if (!id.success || !parsedDay.success || typeof done !== "boolean") return;

  try {
    const timeZone = await getUserTimeZone(user.id);
    await setHabitDay(user.id, {
      habitId: id.data,
      day: parsedDay.data,
      done,
      timeZone,
    });
  } catch (error) {
    console.error("Suivi de l'habitude impossible", error);
  }
  refresh();
}
